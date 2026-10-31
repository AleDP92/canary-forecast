import type { CSSProperties } from 'react'
import { MODELS, getModel } from '../data/models'

interface Props {
  selected: string
  onChange: (id: string) => void
}

export function ModelSelector({ selected, onChange }: Props) {
  const current = getModel(selected)
  return (
    <section className="model-selector" aria-label="Modelo meteorológico">
      <div className="chips" role="radiogroup" aria-label="Elegir modelo">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === selected}
            className={`chip${m.id === selected ? ' chip--active' : ''}`}
            style={{ '--model-color': m.color } as CSSProperties}
            onClick={() => onChange(m.id)}
            title={`${m.provider} · ${m.resolution}`}
          >
            <span className="chip__dot" aria-hidden="true" />
            {m.name}
          </button>
        ))}
      </div>
      <p className="model-info">
        <strong>{current.name}</strong> · {current.provider} · resolución {current.resolution}.{' '}
        <span className="muted">{current.description}</span>
      </p>
    </section>
  )
}
