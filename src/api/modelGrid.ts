/**
 * Rejilla de variables previstas sobre Canarias (lluvia, CAPE, viento), a
 * partir de Open-Meteo. Alimenta las capas del mapa.
 *
 * Open-Meteo cuenta cada punto como una llamada (límite ~600/min por usuario),
 * pero no cada variable: por eso todas las capas salen de una sola petición.
 * La rejilla es de 0,25° (~25 km, parecida a la resolución de los modelos
 * globales) y se guarda en memoria unos minutos.
 */

export const GRID = {
  latMin: 27.5,
  latMax: 29.5,
  lonMin: -18.5,
  lonMax: -13.0,
  step: 0.25,
}

export const GRID_ROWS = Math.round((GRID.latMax - GRID.latMin) / GRID.step) + 1
export const GRID_COLS = Math.round((GRID.lonMax - GRID.lonMin) / GRID.step) + 1

export const GRID_FIELDS = [
  'precipitation',
  'cape',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
] as const

export type GridField = (typeof GRID_FIELDS)[number]

export interface ModelGrid {
  modelId: string
  /** Instantes en segundos Unix */
  times: number[]
  /**
   * Por variable y por instante: valores fila a fila de sur a norte
   * (row * GRID_COLS + col). `null` si el modelo no ofrece esa variable.
   */
  fields: Record<GridField, Float32Array[] | null>
}

const CACHE_MS = 15 * 60 * 1000
const cache = new Map<string, { at: number; grid: ModelGrid }>()

export async function fetchModelGrid(modelId: string, signal?: AbortSignal): Promise<ModelGrid> {
  const hit = cache.get(modelId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.grid

  const lats: string[] = []
  const lons: string[] = []
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      lats.push((GRID.latMin + r * GRID.step).toFixed(2))
      lons.push((GRID.lonMin + c * GRID.step).toFixed(2))
    }
  }
  const params = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    hourly: GRID_FIELDS.join(','),
    models: modelId,
    forecast_days: '3',
    timeformat: 'unixtime',
    timezone: 'GMT',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (res.status === 429) throw new Error('Límite de peticiones de Open-Meteo alcanzado; prueba de nuevo en un minuto')
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.reason ?? `Error ${res.status} al consultar Open-Meteo`)

  type Point = { hourly: { time: number[] } & Record<GridField, (number | null)[] | undefined> }
  const points = data as Point[]
  const times = points[0].hourly.time

  const fields = {} as ModelGrid['fields']
  for (const f of GRID_FIELDS) {
    const available = points.some((p) => p.hourly[f]?.some((v) => v != null))
    fields[f] = available
      ? times.map((_, t) => {
          const arr = new Float32Array(points.length)
          points.forEach((p, i) => (arr[i] = p.hourly[f]?.[t] ?? 0))
          return arr
        })
      : null
  }
  const grid = { modelId, times, fields }
  cache.set(modelId, { at: Date.now(), grid })
  return grid
}
