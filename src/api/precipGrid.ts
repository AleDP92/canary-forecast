/**
 * Rejilla de precipitación prevista sobre Canarias, a partir de Open-Meteo.
 * Sirve para continuar el radar hacia el futuro con la previsión de un modelo.
 *
 * Open-Meteo cuenta cada punto como una llamada (límite ~600/min por usuario),
 * así que la rejilla es de 0,25° (~25 km, parecida a la resolución de los modelos
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

export interface PrecipGrid {
  modelId: string
  /** Instantes en segundos Unix (precipitación acumulada en la hora anterior) */
  times: number[]
  /** Por instante: valores en mm/h, fila a fila de sur a norte (row * GRID_COLS + col) */
  values: Float32Array[]
}

const CACHE_MS = 15 * 60 * 1000
const cache = new Map<string, { at: number; grid: PrecipGrid }>()

export async function fetchPrecipGrid(modelId: string, signal?: AbortSignal): Promise<PrecipGrid> {
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
    hourly: 'precipitation',
    models: modelId,
    forecast_days: '3',
    timeformat: 'unixtime',
    timezone: 'GMT',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (res.status === 429) throw new Error('Límite de peticiones de Open-Meteo alcanzado; prueba de nuevo en un minuto')
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.reason ?? `Error ${res.status} al consultar Open-Meteo`)

  const points = data as { hourly: { time: number[]; precipitation: (number | null)[] } }[]
  const times = points[0].hourly.time
  const values = times.map((_, t) => {
    const arr = new Float32Array(points.length)
    points.forEach((p, i) => (arr[i] = p.hourly.precipitation[t] ?? 0))
    return arr
  })
  const grid = { modelId, times, values }
  cache.set(modelId, { at: Date.now(), grid })
  return grid
}
