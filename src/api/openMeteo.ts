import { INDEX_SOURCE_VARS, type IndexSourceVar } from '../data/indices'
import type { Location } from '../data/locations'

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'
const TIMEZONE = 'Atlantic/Canary'

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'weather_code',
  'is_day',
  'cloud_cover',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
] as const

const HOURLY_VARS = [
  'temperature_2m',
  'precipitation',
  'weather_code',
  'is_day',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
] as const

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
] as const

export type CurrentVar = (typeof CURRENT_VARS)[number]
export type HourlyVar = (typeof HOURLY_VARS)[number]
export type DailyVar = (typeof DAILY_VARS)[number]

export type CurrentConditions = { time: string } & Record<CurrentVar, number | null>

export interface ModelSeries {
  hourly: { time: string[] } & Record<HourlyVar, (number | null)[]>
  daily: { time: string[] } & Record<DailyVar, (number | null)[]>
}

async function getJson(params: Record<string, string>, signal?: AbortSignal) {
  const url = `${BASE_URL}?${new URLSearchParams(params)}`
  const res = await fetch(url, { signal })
  const data = await res.json()
  if (!res.ok || data?.error) {
    throw new Error(data?.reason ?? `Error ${res.status} al consultar Open-Meteo`)
  }
  return data
}

/**
 * Condiciones actuales en todas las ubicaciones para un modelo,
 * en una sola petición.
 */
export async function fetchCurrentForAll(
  locations: Location[],
  modelId: string,
  signal?: AbortSignal,
): Promise<Record<string, CurrentConditions>> {
  const data = await getJson(
    {
      latitude: locations.map((l) => l.lat).join(','),
      longitude: locations.map((l) => l.lon).join(','),
      current: CURRENT_VARS.join(','),
      models: modelId,
      timezone: TIMEZONE,
    },
    signal,
  )
  const list = Array.isArray(data) ? data : [data]
  return Object.fromEntries(locations.map((loc, i) => [loc.id, list[i].current as CurrentConditions]))
}

/**
 * Previsión horaria y diaria de una ubicación para varios modelos a la vez.
 * Open-Meteo añade el sufijo `_<modelo>` a cada variable cuando se piden varios.
 */
export async function fetchForecastByModel(
  location: Location,
  modelIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, ModelSeries>> {
  const data = await getJson(
    {
      latitude: String(location.lat),
      longitude: String(location.lon),
      hourly: HOURLY_VARS.join(','),
      daily: DAILY_VARS.join(','),
      models: modelIds.join(','),
      forecast_days: '7',
      timezone: TIMEZONE,
    },
    signal,
  )

  const pick = <V extends string>(block: Record<string, unknown>, vars: readonly V[], model: string) => {
    const single = modelIds.length === 1
    const out: Record<string, unknown> = { time: block.time }
    for (const v of vars) out[v] = block[single ? v : `${v}_${model}`] ?? []
    return out
  }

  return Object.fromEntries(
    modelIds.map((m) => [
      m,
      {
        hourly: pick(data.hourly, HOURLY_VARS, m),
        daily: pick(data.daily, DAILY_VARS, m),
      } as unknown as ModelSeries,
    ]),
  )
}

/**
 * Algunos modelos no publican ciertas variables en Open-Meteo (p. ej. ECMWF IFS
 * a 9 km no tiene niveles de presión). Para esos casos se usa otra versión del
 * mismo modelo.
 */
const INDEX_FALLBACK_MODEL: Record<string, string> = {
  ecmwf_ifs: 'ecmwf_ifs025',
}

export interface IndexSeries {
  time: string[]
  /** Valores por variable; `null` en toda la serie si el modelo no la ofrece */
  values: Record<IndexSourceVar, (number | null)[]>
}

/** Variables de inestabilidad (CAPE, niveles de presión…) de una ubicación para varios modelos */
export async function fetchIndexSources(
  location: Location,
  modelIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, IndexSeries>> {
  const requested = [...new Set([...modelIds, ...modelIds.map((m) => INDEX_FALLBACK_MODEL[m]).filter(Boolean)])]
  const data = await getJson(
    {
      latitude: String(location.lat),
      longitude: String(location.lon),
      hourly: INDEX_SOURCE_VARS.join(','),
      models: requested.join(','),
      forecast_days: '7',
      timezone: TIMEZONE,
    },
    signal,
  )
  const hourly = data.hourly as Record<string, (number | null)[]>
  const series = (model: string, v: string) =>
    (requested.length === 1 ? hourly[v] : hourly[`${v}_${model}`]) ?? []
  const hasData = (arr: (number | null)[]) => arr.some((x) => x != null)

  return Object.fromEntries(
    modelIds.map((m) => {
      const values = {} as IndexSeries['values']
      for (const v of INDEX_SOURCE_VARS) {
        let arr = series(m, v)
        const fallback = INDEX_FALLBACK_MODEL[m]
        if (!hasData(arr) && fallback) arr = series(fallback, v)
        values[v] = arr
      }
      return [m, { time: hourly.time as unknown as string[], values }]
    }),
  )
}
