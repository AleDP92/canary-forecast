import { useEffect, useState } from 'react'
import { LocationPanel } from './components/LocationPanel'
import { ModelSelector } from './components/ModelSelector'
import { WeatherMap } from './components/WeatherMap'
import { DEFAULT_LOCATION_ID, LOCATIONS } from './data/locations'
import { DEFAULT_MODEL_ID, MODELS } from './data/models'
import { useCurrentForAll, useForecast } from './hooks/useWeather'
import { formatClock } from './utils/time'
import './App.css'

const ALL_MODEL_IDS = MODELS.map((m) => m.id)

/** Lee modelo y ubicación de la URL (?modelo=…&lugar=…) para poder compartir enlaces */
function readParam(name: string, valid: string[], fallback: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && valid.includes(value) ? value : fallback
}

export default function App() {
  const [modelId, setModelId] = useState(() => readParam('modelo', ALL_MODEL_IDS, DEFAULT_MODEL_ID))
  const [locationId, setLocationId] = useState(() =>
    readParam('lugar', LOCATIONS.map((l) => l.id), DEFAULT_LOCATION_ID),
  )
  const location = LOCATIONS.find((l) => l.id === locationId) ?? LOCATIONS[0]

  const current = useCurrentForAll(LOCATIONS, modelId)
  const forecast = useForecast(location, ALL_MODEL_IDS)

  useEffect(() => {
    const params = new URLSearchParams({ modelo: modelId, lugar: locationId })
    window.history.replaceState(null, '', `?${params}`)
  }, [modelId, locationId])

  const reloadAll = () => {
    current.reload()
    forecast.reload()
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Tiempo en Canarias</h1>
          <p className="muted">Previsión en tiempo real con varios modelos meteorológicos</p>
        </div>
        <div className="status">
          {current.loading ? (
            <span className="muted">Actualizando…</span>
          ) : current.updatedAt ? (
            <span className="muted">Actualizado a las {formatClock(current.updatedAt)}</span>
          ) : null}
          <button type="button" className="refresh" onClick={reloadAll} disabled={current.loading}>
            ↻ Actualizar
          </button>
        </div>
      </header>

      <ModelSelector selected={modelId} onChange={setModelId} />

      {current.error && <p className="error">No se pudieron cargar los datos del mapa: {current.error}</p>}

      <main className="layout">
        <div className="map-wrap">
          <WeatherMap current={current.data} selectedId={locationId} onSelect={setLocationId} />
          <label className="location-picker">
            <span className="sr-only">Ubicación</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {[...new Set(LOCATIONS.map((l) => l.island))].map((island) => (
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
        </div>
        <LocationPanel
          location={location}
          modelId={modelId}
          current={current.data?.[locationId]}
          forecast={forecast.data}
          forecastError={forecast.error}
        />
      </main>

      <footer className="footer muted">
        Datos de{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0). Las condiciones "actuales" son la estimación del modelo, no una observación de estación.
      </footer>
    </div>
  )
}
