import { useEffect, useMemo, useState } from 'react'
import { fetchPrecipGrid, type PrecipGrid } from '../api/precipGrid'

/**
 * Línea de tiempo del radar:
 * - Pasado: radar observado de RainViewer (últimas ~2 h, cada 10 min).
 *   Sobre Canarias usa los radares de AEMET. Zoom nativo hasta 7.
 * - Futuro: precipitación prevista por el modelo seleccionado (cada hora),
 *   porque RainViewer no ofrece predicción en su API gratuita.
 */
const API_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const REFRESH_MS = 5 * 60 * 1000
const FORECAST_HOURS = 48

export const RADAR_MAX_NATIVE_ZOOM = 7

export type RadarFrame =
  | { kind: 'observed'; time: number; url: string }
  | { kind: 'forecast'; time: number; gridIndex: number }

export function useRadar(enabled: boolean, modelId: string) {
  const [observed, setObserved] = useState<RadarFrame[]>([])
  const [error, setError] = useState<string | null>(null)
  const [grid, setGrid] = useState<PrecipGrid | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  /** Instante elegido (segundos Unix); null = el más reciente observado */
  const [selected, setSelected] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  // Radar observado: al activar y cada 5 minutos
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const load = () =>
      fetch(API_URL, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`Error ${r.status}`)
          return r.json()
        })
        .then((data) => {
          setObserved(
            (data.radar?.past ?? []).map((f: { time: number; path: string }) => ({
              kind: 'observed',
              time: f.time,
              // Esquema de color 2 (Universal Blue), suavizado y nieve activados
              url: `${data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
            })),
          )
          setError(null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Error desconocido')
        })
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  // Previsión del modelo seleccionado
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    // Espera breve: si se pasan varios modelos seguidos solo se pide el último
    // (cada rejilla cuenta como ~200 llamadas en el límite de Open-Meteo)
    const timer = window.setTimeout(() => {
      fetchPrecipGrid(modelId, controller.signal)
        .then((g) => {
          setGrid(g)
          setForecastError(null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setForecastError(err instanceof Error ? err.message : 'Error desconocido')
        })
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, modelId])

  const frames = useMemo<RadarFrame[]>(() => {
    // Se espera al radar observado para que «ahora» quede bien colocado,
    // salvo que el radar haya fallado: entonces se muestra solo la previsión
    if (!observed.length && !error) return []
    const lastObserved = observed.at(-1)?.time ?? Math.floor(Date.now() / 3_600_000) * 3600
    const limit = lastObserved + FORECAST_HOURS * 3600
    const future: RadarFrame[] =
      grid?.modelId === modelId
        ? grid.times
            .map((time, gridIndex) => ({ kind: 'forecast' as const, time, gridIndex }))
            .filter((f) => f.time > lastObserved && f.time <= limit)
        : []
    return [...observed, ...future]
  }, [observed, grid, modelId, error])

  /** Último fotograma observado = «ahora» */
  const nowIndex = Math.max(0, observed.length - 1)
  const found = selected == null ? -1 : frames.findIndex((f) => f.time === selected)
  const index = found === -1 ? Math.min(nowIndex, frames.length - 1) : found
  const setIndex = (i: number) => setSelected(frames[i]?.time ?? null)

  // Animación: más rápida en el radar, una pausa en «ahora» y al final
  useEffect(() => {
    if (!enabled || !playing || frames.length < 2) return
    const frame = frames[index]
    const delay = index === nowIndex || index === frames.length - 1 ? 1500 : frame.kind === 'observed' ? 450 : 650
    const timer = window.setTimeout(() => setSelected(frames[(index + 1) % frames.length].time), delay)
    return () => window.clearTimeout(timer)
  }, [enabled, playing, index, frames, nowIndex])

  return {
    frames,
    index,
    nowIndex,
    setIndex,
    playing,
    setPlaying,
    error,
    forecastError,
    grid: grid?.modelId === modelId ? grid : null,
  }
}
