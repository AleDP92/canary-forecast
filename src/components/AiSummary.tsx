import { useState } from 'react'
import type { AiSummaries } from '../hooks/useAiSummaries'
import { formatClock } from '../utils/time'

interface Props {
  summaries: AiSummaries
  locationId: string
}

/** Tarjeta con el resumen del tiempo generado por IA para la zona elegida */
export function AiSummary({ summaries, locationId }: Props) {
  const [showGeneral, setShowGeneral] = useState(false)
  const item = summaries.locations[locationId]
  if (!item) return null

  const periodLabel = summaries.period === 'hoy' ? 'Resumen de hoy' : 'Esta noche y mañana'

  return (
    <section className="ai-summary" aria-label={periodLabel}>
      <div className="ai-summary__head">
        <span className="ai-summary__tag">✨ IA</span>
        <h3>{periodLabel}</h3>
      </div>
      <p className="ai-summary__title">{item.titular}</p>
      <p className="ai-summary__text">{item.resumen}</p>
      {showGeneral && <p className="ai-summary__text ai-summary__general">{summaries.general}</p>}
      <div className="ai-summary__foot">
        <button type="button" className="link-button" onClick={() => setShowGeneral(!showGeneral)}>
          {showGeneral ? 'Ocultar resumen de Canarias' : 'Ver resumen de toda Canarias'}
        </button>
        <span className="muted">
          Generado con {summaries.aiModel} a partir de {summaries.weatherModel} a las{' '}
          {formatClock(new Date(summaries.generatedAt))}. Puede contener errores.
        </span>
      </div>
    </section>
  )
}
