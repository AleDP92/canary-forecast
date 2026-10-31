import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
import { ImageOverlay, MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import type { CurrentConditions } from '../api/openMeteo'
import type { PrecipGrid } from '../api/precipGrid'
import { LOCATIONS, MAP_BOUNDS, type Location } from '../data/locations'
import { describeWeather } from '../data/weatherCodes'
import { RADAR_MAX_NATIVE_ZOOM, type RadarFrame } from '../hooks/useRadar'
import { PRECIP_BOUNDS, renderPrecipFrame } from '../utils/precipImage'

interface Props {
  current: Record<string, CurrentConditions> | null
  selectedId: string
  onSelect: (id: string) => void
}

interface MapProps extends Props {
  /** Fotogramas del radar; vacío si el radar está desactivado */
  radarFrames: RadarFrame[]
  radarIndex: number
  precipGrid: PrecipGrid | null
}

/**
 * Los fotogramas observados se montan todos a la vez y solo el actual es
 * visible, así las imágenes ya están cargadas cuando se anima. Los de
 * previsión se dibujan al vuelo a partir de la rejilla del modelo.
 */
function RadarLayers({ frames, index, grid }: { frames: RadarFrame[]; index: number; grid: PrecipGrid | null }) {
  const current = frames[index]
  const forecastUrl = current?.kind === 'forecast' && grid ? renderPrecipFrame(grid, current.gridIndex) : null
  return (
    <>
      {frames.map((f, i) =>
        f.kind === 'observed' ? (
          <TileLayer
            key={f.url}
            url={f.url}
            opacity={i === index ? 0.8 : 0}
            zIndex={10}
            maxNativeZoom={RADAR_MAX_NATIVE_ZOOM}
            maxZoom={18}
            attribution='Radar: <a href="https://www.rainviewer.com/">RainViewer</a> · AEMET'
          />
        ) : null,
      )}
      {forecastUrl && <ImageOverlay url={forecastUrl} bounds={PRECIP_BOUNDS} opacity={0.85} zIndex={11} />}
    </>
  )
}

/** Color de fondo según la temperatura */
function tempColor(t: number | null | undefined): string {
  if (t == null) return '#94a3b8'
  if (t < 5) return '#6366f1'
  if (t < 10) return '#3b82f6'
  if (t < 15) return '#06b6d4'
  if (t < 20) return '#10b981'
  if (t < 25) return '#eab308'
  if (t < 30) return '#f97316'
  return '#dc2626'
}

function markerIcon(loc: Location, c: CurrentConditions | undefined, selected: boolean) {
  const t = c?.temperature_2m
  const { icon } = describeWeather(c?.weather_code, c?.is_day !== 0)
  const temp = t == null ? '–' : `${Math.round(t)}°`
  return L.divIcon({
    className: '',
    html: `<div class="temp-marker${selected ? ' temp-marker--selected' : ''}" style="--marker-bg:${tempColor(t)}" aria-label="${loc.name}">
      <span>${icon}</span><strong>${temp}</strong></div>`,
    iconSize: [62, 28],
    iconAnchor: [31, 14],
  })
}

function Markers({ current, selectedId, onSelect }: Props) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const [zoom, setZoom] = useState(() => map.getZoom())
  const icons = useMemo(
    () =>
      Object.fromEntries(
        LOCATIONS.map((loc) => [loc.id, markerIcon(loc, current?.[loc.id], loc.id === selectedId)]),
      ),
    [current, selectedId],
  )
  const visible = LOCATIONS.filter((loc) => loc.id === selectedId || zoom >= loc.minZoom)

  return (
    <>
      {visible.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lon]}
          icon={icons[loc.id]}
          zIndexOffset={loc.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(loc.id) }}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {loc.name} · {loc.island}
          </Tooltip>
        </Marker>
      ))}
    </>
  )
}

export function WeatherMap({ radarFrames, radarIndex, precipGrid, ...props }: MapProps) {
  return (
    <MapContainer bounds={MAP_BOUNDS} boundsOptions={{ padding: [24, 24] }} minZoom={6} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RadarLayers frames={radarFrames} index={radarIndex} grid={precipGrid} />
      <Markers {...props} />
    </MapContainer>
  )
}
