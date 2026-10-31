import { useState } from 'react'
import type { CurrentConditions, ModelSeries } from '../api/openMeteo'
import { LOCATIONS, type Location } from '../data/locations'
import { MODELS, getModel } from '../data/models'
import { describeWeather, windDirection } from '../data/weatherCodes'
import { useIndexSources } from '../hooks/useWeather'
import { currentHourIndex, formatDay } from '../utils/time'
import { AiSummary } from './AiSummary'
import { ConvectionPanel } from './ConvectionPanel'
import type { AiSummaries } from '../hooks/useAiSummaries'
import { ForecastChart, type ChartSeries } from './ForecastChart'

interface Props {
  location: Location
  onLocationChange: (id: string) => void
  modelId: string
  current: CurrentConditions | undefined
  forecast: Record<string, ModelSeries> | null
  forecastError: string | null
  /** Resúmenes con IA; null si no hay (o no son de hoy) */
  aiSummaries: AiSummaries | null
}

const HOURS = 48
const ISLANDS = [...new Set(LOCATIONS.map((l) => l.island))]
const ALL_MODEL_IDS = MODELS.map((m) => m.id)
type Tab = 'general' | 'convection'
const fmt = (v: number | null | undefined, digits = 0) => (v == null ? '–' : v.toFixed(digits))

/** Dispersión de la máxima de hoy entre modelos: indica cuánto coinciden */
function modelAgreement(forecast: Record<string, ModelSeries>) {
  const maxes = MODELS.map((m) => forecast[m.id]?.daily.temperature_2m_max[0]).filter(
    (v): v is number => v != null,
  )
  if (maxes.length < 2) return null
  const spread = Math.max(...maxes) - Math.min(...maxes)
  const level = spread <= 1.5 ? 'alto' : spread <= 3 ? 'medio' : 'bajo'
  return { spread, level, count: maxes.length }
}

export function LocationPanel({ location, onLocationChange, modelId, current, forecast, forecastError, aiSummaries }: Props) {
  const [compare, setCompare] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  // Los índices solo se descargan al abrir la pestaña de convección
  const indices = useIndexSources(location, ALL_MODEL_IDS, tab === 'convection')
  const model = getModel(modelId)
  const series = forecast?.[modelId]
  const weather = describeWeather(current?.weather_code, current?.is_day !== 0)

  let chart = null
  if (series) {
    const start = currentHourIndex(series.hourly.time)
    const slice = <T,>(arr: T[]) => arr.slice(start, start + HOURS)
    const times = slice(series.hourly.time)
    const lines: ChartSeries[] = compare
      ? MODELS.filter((m) => forecast?.[m.id]).map((m) => ({
          id: m.id,
          name: m.name,
          color: m.color,
          values: slice(forecast![m.id].hourly.temperature_2m),
          emphasis: m.id === modelId,
        }))
      : [{ id: model.id, name: model.name, color: model.color, values: slice(series.hourly.temperature_2m), emphasis: true }]
    chart = (
      <ForecastChart
        times={times}
        series={lines}
        bars={compare ? undefined : slice(series.hourly.precipitation)}
        unit="°"
      />
    )
  }

  const agreement = forecast ? modelAgreement(forecast) : null

  return (
    <aside className="panel">
      <header className="panel__header">
        <div className="panel__place">
          <label className="place-picker">
            <span className="sr-only">Zona</span>
            <select value={location.id} onChange={(e) => onLocationChange(e.target.value)}>
              {ISLANDS.map((island) => (
                <optgroup key={island} label={island}>
                  {LOCATIONS.filter((l) => l.island === island).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="muted">{location.island} · elige otra zona aquí o en el mapa</p>
        </div>
        <span className="badge" style={{ background: model.color }}>
          {model.name}
        </span>
      </header>

      <section className="now" aria-label="Condiciones actuales">
        <div className="now__main">
          <span className="now__icon" aria-hidden="true">
            {weather.icon}
          </span>
          <div>
            <div className="now__temp">{fmt(current?.temperature_2m)}°</div>
            <div>{weather.label}</div>
          </div>
        </div>
        <dl className="now__details">
          <div>
            <dt>Sensación</dt>
            <dd>{fmt(current?.apparent_temperature)}°</dd>
          </div>
          <div>
            <dt>Humedad</dt>
            <dd>{fmt(current?.relative_humidity_2m)}%</dd>
          </div>
          <div>
            <dt>Viento</dt>
            <dd>
              {fmt(current?.wind_speed_10m)} km/h {windDirection(current?.wind_direction_10m)}
            </dd>
          </div>
          <div>
            <dt>Rachas</dt>
            <dd>{fmt(current?.wind_gusts_10m)} km/h</dd>
          </div>
          <div>
            <dt>Nubosidad</dt>
            <dd>{fmt(current?.cloud_cover)}%</dd>
          </div>
          <div>
            <dt>Precipitación</dt>
            <dd>{fmt(current?.precipitation, 1)} mm</dd>
          </div>
        </dl>
      </section>

      {aiSummaries && <AiSummary summaries={aiSummaries} locationId={location.id} />}

      <div className="tabs" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={tab === 'general'} onClick={() => setTab('general')}>
          General
        </button>
        <button type="button" role="tab" aria-selected={tab === 'convection'} onClick={() => setTab('convection')}>
          ⚡ Convección
        </button>
      </div>

      {tab === 'convection' ? (
        <ConvectionPanel modelId={modelId} sources={indices.data} error={indices.error} />
      ) : (
        <>
          <section>
            <div className="section-title">
              <h3>Próximas 48 horas</h3>
              <label className="toggle">
                <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                Comparar modelos
              </label>
            </div>
            {forecastError && <p className="error">No se pudo cargar la previsión: {forecastError}</p>}
            {!forecast && !forecastError && <p className="muted">Cargando previsión…</p>}
            {chart}
            {agreement && (
              <p className="agreement">
                Acuerdo entre modelos: <strong className={`agreement--${agreement.level}`}>{agreement.level}</strong>{' '}
                <span className="muted">
                  (la máxima de hoy varía {agreement.spread.toFixed(1)}° entre {agreement.count} modelos)
                </span>
              </p>
            )}
          </section>

          {series && (
            <section>
              <h3>Próximos 7 días · {model.name}</h3>
              <ul className="daily">
                {series.daily.time.map((day, i) => {
                  const d = describeWeather(series.daily.weather_code[i])
                  return (
                    <li key={day}>
                      <span className="daily__day">{i === 0 ? 'Hoy' : formatDay(day)}</span>
                      <span className="daily__icon" title={d.label}>
                        {d.icon}
                      </span>
                      <span className="daily__temps">
                        <strong>{fmt(series.daily.temperature_2m_max[i])}°</strong>{' '}
                        <span className="muted">{fmt(series.daily.temperature_2m_min[i])}°</span>
                      </span>
                      <span className="daily__rain">💧 {fmt(series.daily.precipitation_sum[i], 1)} mm</span>
                      <span className="daily__wind">💨 {fmt(series.daily.wind_gusts_10m_max[i])} km/h</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </aside>
  )
}
