import { useMemo, useState } from 'react'
import type { IndexSeries } from '../api/openMeteo'
import { INDICES, INDEX_SOURCE_VARS, levelFor, thresholdsFor, type IndexDef, type SourceRow } from '../data/indices'
import { MODELS, getModel } from '../data/models'
import { currentHourIndex, formatDay, formatHour } from '../utils/time'
import { ForecastChart, type ChartSeries } from './ForecastChart'

interface Props {
  modelId: string
  sources: Record<string, IndexSeries> | null
  error: string | null
}

const RANGES = [
  { hours: 48, label: '48 h' },
  { hours: 168, label: '7 días' },
]

/** Serie horaria de un índice para un modelo */
function computeIndex(def: IndexDef, s: IndexSeries): (number | null)[] {
  return s.time.map((_, i) => {
    const row = {} as SourceRow
    for (const v of INDEX_SOURCE_VARS) row[v] = s.values[v][i] ?? null
    return def.compute(row)
  })
}

/** Valor más desfavorable (máximo, o mínimo si `lowerIsWorse`) y su hora */
function worst(def: IndexDef, values: (number | null)[], times: string[]) {
  let best: { value: number; time: string } | null = null
  values.forEach((v, i) => {
    if (v == null) return
    if (!best || (def.lowerIsWorse ? v < best.value : v > best.value)) best = { value: v, time: times[i] }
  })
  return best as { value: number; time: string } | null
}

export function ConvectionPanel({ modelId, sources, error }: Props) {
  const [indexId, setIndexId] = useState('cape')
  const [hours, setHours] = useState(48)
  const [compare, setCompare] = useState(false)
  const model = getModel(modelId)
  const def = INDICES.find((d) => d.id === indexId) ?? INDICES[0]

  // Series de todos los índices para todos los modelos, recortadas al rango elegido
  const computed = useMemo(() => {
    if (!sources) return null
    const anyModel = sources[modelId] ?? Object.values(sources)[0]
    const start = currentHourIndex(anyModel.time)
    const times = anyModel.time.slice(start, start + hours)
    const byModel: Record<string, Record<string, (number | null)[]>> = {}
    for (const [m, s] of Object.entries(sources)) {
      byModel[m] = Object.fromEntries(INDICES.map((d) => [d.id, computeIndex(d, s).slice(start, start + hours)]))
    }
    return { times, byModel }
  }, [sources, modelId, hours])

  if (error) return <p className="error">No se pudieron cargar los índices: {error}</p>
  if (!computed) return <p className="muted">Cargando índices…</p>

  const { times, byModel } = computed
  const has = (m: string, id: string) => byModel[m]?.[id]?.some((v) => v != null)

  const lines: ChartSeries[] = compare
    ? MODELS.filter((m) => has(m.id, def.id)).map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        values: byModel[m.id][def.id],
        emphasis: m.id === modelId,
      }))
    : has(modelId, def.id)
      ? [{ id: model.id, name: model.name, color: model.color, values: byModel[modelId][def.id], emphasis: true }]
      : []

  const unavailableIn = MODELS.filter((m) => !has(m.id, def.id)).map((m) => m.name)

  return (
    <div className="convection">
      <p className="muted convection__intro">
        Valor más desfavorable en {hours === 48 ? 'las próximas 48 h' : 'los próximos 7 días'} según{' '}
        <strong>{model.name}</strong>. Pulsa un índice para ver su evolución.
      </p>

      <div className="index-grid" role="radiogroup" aria-label="Índice">
        {INDICES.map((d) => {
          const w = worst(d, byModel[modelId]?.[d.id] ?? [], times)
          const lvl = levelFor(d, w?.value ?? null)
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === def.id}
              className={`index-card${d.id === def.id ? ' index-card--active' : ''}`}
              onClick={() => setIndexId(d.id)}
            >
              <span className="index-card__name">{d.name}</span>
              {w ? (
                <>
                  <span className="index-card__value">
                    {w.value.toFixed(d.digits)}
                    {d.unit && <small>{d.unit === '°' ? d.unit : ` ${d.unit}`}</small>}
                  </span>
                  <span className="index-card__level" style={{ color: lvl?.color }}>
                    ● {lvl?.label}
                  </span>
                  <span className="index-card__time muted">
                    {formatDay(w.time.slice(0, 10))} {formatHour(w.time)}
                  </span>
                </>
              ) : (
                <span className="index-card__na muted">No disponible en {model.name}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="section-title">
        <h3>{def.name}</h3>
        <div className="convection__controls">
          <div className="segmented" role="group" aria-label="Periodo">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                type="button"
                aria-pressed={hours === r.hours}
                onClick={() => setHours(r.hours)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Comparar
          </label>
        </div>
      </div>

      {lines.length ? (
        <ForecastChart
          times={times}
          series={lines}
          unit={def.unit}
          digits={def.digits}
          minSpan={def.minSpan}
          zeroBased={def.zeroBased}
          thresholds={thresholdsFor(def)}
        />
      ) : (
        <p className="muted">
          {model.name} no ofrece este índice. Prueba con otro modelo o activa «Comparar».
        </p>
      )}

      <p className="index-help">{def.description}</p>
      <ul className="index-levels">
        {def.levels.map((l) => (
          <li key={l.label}>
            <i style={{ background: l.color }} />
            {l.label}
            {Number.isFinite(l.from) && (
              <span className="muted">
                {' '}
                ({def.lowerIsWorse ? '≤' : '≥'} {l.from}
                {def.unit && ` ${def.unit}`})
              </span>
            )}
          </li>
        ))}
      </ul>
      {unavailableIn.length > 0 && (
        <p className="muted index-note">No disponible en: {unavailableIn.join(', ')}.</p>
      )}
    </div>
  )
}
