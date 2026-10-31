import { useEffect, useMemo, useState } from 'react'
import { fetchModelGrid, type ModelGrid } from '../api/modelGrid'
import { getLayer, type LayerId } from '../data/mapLayers'

/**
 * Línea de tiempo de la capa activa del mapa:
 * - Lluvia: radar observado de RainViewer (últimas ~2 h, cada 10 min; sobre
 *   Canarias usa los radares de AEMET) seguido de la precipitación prevista
 *   por el modelo, porque RainViewer no ofrece predicción en su API gratuita.
 * - CAPE y viento: solo previsión del modelo, desde la hora actual.
 */
const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const REFRESH_MS = 5 * 60 * 1000
const FORECAST_HOURS = 48

export const RADAR_MAX_NATIVE_ZOOM = 7

export type LayerFrame =
  | { kind: 'observed'; time: number; url: string }
  | { kind: 'forecast'; time: number; gridIndex: number }

export function useMapLayer(layerId: LayerId | null, modelId: string) {
  const layer = getLayer(layerId)
  const wantsObserved = !!layer?.observed
  const [observed, setObserved] = useState<LayerFrame[]>([])
  const [observedError, setObservedError] = useState<string | null>(null)
  const [grid, setGrid] = useState<ModelGrid | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  /** Instante elegido (segundos Unix); null = «ahora» */
  const [selected, setSelected] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  // Radar observado: solo con la capa de lluvia, al activarla y cada 5 minutos
  useEffect(() => {
    if (!wantsObserved) return
    const controller = new AbortController()
    const load = () =>
      fetch(RAINVIEWER_URL, { signal: controller.signal })
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
          setObservedError(null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setObservedError(err instanceof Error ? err.message : 'Error desconocido')
        })
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [wantsObserved])

  // Rejilla del modelo (todas las capas salen de la misma petición)
  const active = layer != null
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    // Espera breve: si se pasan varios modelos seguidos solo se pide el último
    // (cada rejilla cuenta como ~200 llamadas en el límite de Open-Meteo)
    const timer = window.setTimeout(() => {
      fetchModelGrid(modelId, controller.signal)
        .then((g) => {
          setGrid(g)
          setGridError(null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setGridError(err instanceof Error ? err.message : 'Error desconocido')
        })
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [active, modelId])

  const currentGrid = grid?.modelId === modelId ? grid : null
  const fieldMissing = !!(layer && currentGrid && !currentGrid.fields[layer.field])

  const frames = useMemo<LayerFrame[]>(() => {
    if (!layer) return []
    const pastFrames = layer.observed ? observed : []
    // Con lluvia se espera al radar para que «ahora» quede bien colocado, salvo que falle
    if (layer.observed && !pastFrames.length && !observedError) return []
    const currentHour = Math.floor(Date.now() / 3_600_000) * 3600
    const start = pastFrames.at(-1)?.time ?? currentHour - 1
    const future: LayerFrame[] =
      currentGrid && currentGrid.fields[layer.field]
        ? currentGrid.times
            .map((time, gridIndex) => ({ kind: 'forecast' as const, time, gridIndex }))
            .filter((f) => f.time > start && f.time <= start + FORECAST_HOURS * 3600)
        : []
    return [...pastFrames, ...future]
  }, [layer, observed, observedError, currentGrid])

  /** «Ahora»: último fotograma observado, o la primera hora prevista */
  const nowIndex = layer?.observed ? Math.max(0, frames.findLastIndex((f) => f.kind === 'observed')) : 0

  // El fotograma más cercano al instante elegido: así se mantiene la hora al
  // cambiar de capa o de modelo
  let index = nowIndex
  if (selected != null && frames.length) {
    let best = Infinity
    frames.forEach((f, i) => {
      const d = Math.abs(f.time - selected)
      if (d < best) {
        best = d
        index = i
      }
    })
  }
  index = Math.min(index, frames.length - 1)
  const setIndex = (i: number) => setSelected(frames[i]?.time ?? null)

  // Animación: más rápida en el radar, una pausa en «ahora» y al final
  useEffect(() => {
    if (!playing || frames.length < 2 || index < 0) return
    const frame = frames[index]
    const delay = index === nowIndex || index === frames.length - 1 ? 1500 : frame.kind === 'observed' ? 450 : 650
    const timer = window.setTimeout(() => setSelected(frames[(index + 1) % frames.length].time), delay)
    return () => window.clearTimeout(timer)
  }, [playing, index, frames, nowIndex])

  return {
    layer,
    frames,
    index,
    nowIndex,
    setIndex,
    playing,
    setPlaying,
    observedError,
    gridError,
    grid: currentGrid,
    fieldMissing,
  }
}
