import { useEffect, useState } from 'react'
import { canaryHourNow } from '../utils/time'

/**
 * Resúmenes del tiempo generados con IA (Gemini) en la GitHub Action de
 * despliegue (scripts/generate-summaries.mjs) y publicados como JSON estático
 * junto a la web. La clave de API nunca llega al navegador.
 */
export interface AiSummaries {
  generatedAt: string
  /** Fecha en Canarias (YYYY-MM-DD) en que se generó */
  date: string
  /** «hoy» o «esta noche y mañana» */
  period: string
  aiModel: string
  weatherModel: string
  general: string
  locations: Record<string, { titular: string; resumen: string }>
}

const URL_SUMMARIES = './data/resumenes.json'
const REFRESH_MS = 30 * 60 * 1000

export function useAiSummaries(): AiSummaries | null {
  const [data, setData] = useState<AiSummaries | null>(null)

  useEffect(() => {
    const load = () =>
      fetch(URL_SUMMARIES, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: AiSummaries | null) => {
          // Solo se muestran los del día de hoy: si la Action no ha corrido, mejor nada que algo viejo
          const today = canaryHourNow().slice(0, 10)
          setData(d && d.date === today ? d : null)
        })
        .catch(() => setData(null))
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  return data
}
