import { useEffect, useState } from 'react'
import { LocationPanel } from './components/LocationPanel'
import { ModelSelector } from './components/ModelSelector'
import { LayerControls } from './components/LayerControls'
import { WeatherMap, type Probe } from './components/WeatherMap'
import { DEFAULT_LOCATION_ID, LOCATIONS } from './data/locations'
import { DEFAULT_MODEL_ID, MODELS, getModel } from './data/models'
import { MAP_LAYERS, getLayer, layerFromSlug, type LayerId } from './data/mapLayers'
import { useMapLayer } from './hooks/useMapLayer'
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

  const [layerId, setLayerId] = useState<LayerId | null>(() => {
    const params = new URLSearchParams(window.location.search)
    // `?radar=1` era el enlace antiguo de la capa de lluvia
    return layerFromSlug(params.get('capa')) ?? (params.has('radar') ? 'rain' : null)
  })
  const mapLayer = useMapLayer(layerId, modelId)
  const [showArrows, setShowArrows] = useState(true)
  const [probe, setProbe] = useState<Probe | null>(null)

  /** Pulsar la capa activa la desactiva; al activar una se reproduce la animación */
  const toggleLayer = (id: LayerId) => {
    const isActive = layerId === id || (id === 'wind' && layerId === 'gusts')
    setLayerId(isActive ? null : id)
    mapLayer.setPlaying(!isActive)
    if (isActive) setProbe(null)
  }

  const current = useCurrentForAll(LOCATIONS, modelId)
  const forecast = useForecast(location, ALL_MODEL_IDS)

  useEffect(() => {
    const params = new URLSearchParams({ modelo: modelId, lugar: locationId })
    const layer = getLayer(layerId)
    if (layer) params.set('capa', layer.slug)
    window.history.replaceState(null, '', `?${params}`)
  }, [modelId, locationId, layerId])

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
        <div className={`map-wrap${layerId ? ' map-wrap--layer' : ''}`}>
          <WeatherMap
            current={current.data}
            selectedId={locationId}
            onSelect={setLocationId}
            layer={mapLayer.layer}
            frames={mapLayer.frames}
            frameIndex={mapLayer.index}
            grid={mapLayer.grid}
            showArrows={showArrows}
            probe={probe}
            onProbe={setProbe}
          />
          <div className="map-toolbar">
            <div className="layer-picker" role="group" aria-label="Capa del mapa">
              {MAP_LAYERS.filter((l) => l.id !== 'gusts').map((l) => {
                const active = layerId === l.id || (l.id === 'wind' && layerId === 'gusts')
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
          {mapLayer.layer && (
            <LayerControls
              layer={mapLayer.layer}
              onLayer={setLayerId}
              frames={mapLayer.frames}
              index={mapLayer.index}
              nowIndex={mapLayer.nowIndex}
              onIndex={mapLayer.setIndex}
              playing={mapLayer.playing}
              onPlaying={mapLayer.setPlaying}
              observedError={mapLayer.observedError}
              gridError={mapLayer.gridError}
              fieldMissing={mapLayer.fieldMissing}
              modelName={getModel(modelId).name}
              grid={mapLayer.grid}
              probe={probe}
              onClearProbe={() => setProbe(null)}
              showArrows={showArrows}
              onShowArrows={setShowArrows}
            />
          )}
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
