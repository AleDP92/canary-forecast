import { useEffect, useState } from 'react'
import { LocationPanel } from './components/LocationPanel'
import { ModelSelector } from './components/ModelSelector'
import { LayerControls } from './components/LayerControls'
import { WeatherMap, type Probe } from './components/WeatherMap'
import { DEFAULT_LOCATION_ID, LOCATIONS } from './data/locations'
import { DEFAULT_MODEL_ID, MODELS, getModel } from './data/models'
import { LAYER_BUTTONS, type LayerId, type WindMode } from './data/mapLayers'
import { useMapLayers } from './hooks/useMapLayer'
import { useAiSummaries } from './hooks/useAiSummaries'
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

  // Capas del mapa: interruptores independientes, ninguna activa al abrir
  const [activeLayers, setActiveLayers] = useState<LayerId[]>([])
  const [windMode, setWindMode] = useState<WindMode>('mean')
  const mapLayers = useMapLayers(activeLayers, windMode, modelId)
  const [probe, setProbe] = useState<Probe | null>(null)

  const toggleLayer = (id: LayerId) => {
    const next = activeLayers.includes(id) ? activeLayers.filter((l) => l !== id) : [...activeLayers, id]
    setActiveLayers(next)
    if (!next.length) {
      mapLayers.setPlaying(false)
      setProbe(null)
    }
  }

  const current = useCurrentForAll(LOCATIONS, modelId)
  const forecast = useForecast(location, ALL_MODEL_IDS)
  const aiSummaries = useAiSummaries()

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
        <div className={`map-wrap${activeLayers.length ? ' map-wrap--layer' : ''}`}>
          <WeatherMap
            current={current.data}
            selectedId={locationId}
            onSelect={setLocationId}
            active={activeLayers}
            windMode={windMode}
            frames={mapLayers.frames}
            frameIndex={mapLayers.index}
            grid={mapLayers.grid}
            probe={probe}
            onProbe={setProbe}
          />
          <div className="map-toolbar">
            <div className="layer-picker" role="group" aria-label="Capa del mapa">
              {LAYER_BUTTONS.map((l) => {
                const active = activeLayers.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`layer-toggle${active ? ' layer-toggle--active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleLayer(l.id)}
                  >
                    <span aria-hidden="true">{l.icon}</span> {l.name}
                  </button>
                )
              })}
            </div>
          </div>
          {activeLayers.length > 0 && (
            <LayerControls
              active={activeLayers}
              windMode={windMode}
              onWindMode={setWindMode}
              frames={mapLayers.frames}
              index={mapLayers.index}
              nowIndex={mapLayers.nowIndex}
              onIndex={mapLayers.setIndex}
              playing={mapLayers.playing}
              onPlaying={mapLayers.setPlaying}
              observedError={mapLayers.observedError}
              gridError={mapLayers.gridError}
              missing={mapLayers.missing}
              modelName={getModel(modelId).name}
              grid={mapLayers.grid}
              probe={probe}
              onClearProbe={() => setProbe(null)}
            />
          )}
        </div>
        <LocationPanel
          location={location}
          onLocationChange={setLocationId}
          modelId={modelId}
          current={current.data?.[locationId]}
          forecast={forecast.data}
          forecastError={forecast.error}
          aiSummaries={aiSummaries}
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
