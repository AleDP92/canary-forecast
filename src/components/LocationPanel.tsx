import { useState } from 'react'
import type { CurrentConditions, ModelSeries } from '../api/openMeteo'
import type { Location } from '../data/locations'
import { MODELS, getModel } from '../data/models'
import { describeWeather, windDirection } from '../data/weatherCodes'
import { currentHourIndex, formatDay } from '../utils/time'
import { ForecastChart, type ChartSeries } from './ForecastChart'

interface Props {
  location: Location
  modelId: string
  current: CurrentConditions | undefined
  forecast: Record<string, ModelSeries> | null
  forecastError: string | null
}

const HOURS = 48
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

export function LocationPanel({ location, modelId, current, forecast, forecastError }: Props) {
  const [compare, setCompare] = useState(false)
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
        <div>
          <h2>{location.name}</h2>
          <p className="muted">{location.island}</p>
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
    </aside>
  )
}
