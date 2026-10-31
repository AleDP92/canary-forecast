import { useEffect, useState } from 'react'

/**
 * Radar de precipitación de RainViewer (API pública gratuita).
 * Ofrece las últimas ~2 h en fotogramas de 10 min, con zoom nativo hasta 7.
 * Sobre Canarias usa los radares de AEMET.
 */
const API_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const REFRESH_MS = 5 * 60 * 1000

export interface RadarFrame {
  time: number
  url: string
}

export const RADAR_MAX_NATIVE_ZOOM = 7

export function useRadar(enabled: boolean) {
  const [frames, setFrames] = useState<RadarFrame[]>([])
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Descarga la lista de fotogramas al activar el radar y cada 5 minutos
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
          const list: RadarFrame[] = (data.radar?.past ?? []).map((f: { time: number; path: string }) => ({
            time: f.time,
            // Esquema de color 2 (Universal Blue), suavizado y nieve activados
            url: `${data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
          }))
          setFrames(list)
          setIndex(list.length - 1)
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

  // Animación: avanza un fotograma cada medio segundo y se detiene un poco en el último
  useEffect(() => {
    if (!enabled || !playing || frames.length < 2) return
    const last = index === frames.length - 1
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % frames.length), last ? 1500 : 500)
    return () => window.clearTimeout(timer)
  }, [enabled, playing, index, frames.length])

  return { frames, error, index, setIndex, playing, setPlaying }
}
