import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  SVGOverlay,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import type { CurrentConditions } from '../api/openMeteo'
import { GRID, GRID_COLS, GRID_ROWS, nearestGridIndex, type ModelGrid } from '../api/modelGrid'
import { LOCATIONS, MAP_BOUNDS, type Location } from '../data/locations'
import { describeWeather } from '../data/weatherCodes'
import { arrowColor, type MapLayer } from '../data/mapLayers'
import { RADAR_MAX_NATIVE_ZOOM, type LayerFrame } from '../hooks/useMapLayer'
import { GRID_BOUNDS, renderGridFrame } from '../utils/gridImage'

interface Props {
  current: Record<string, CurrentConditions> | null
  selectedId: string
  onSelect: (id: string) => void
}

interface LayerProps {
  layer: MapLayer | null
  frames: LayerFrame[]
  frameIndex: number
  grid: ModelGrid | null
  /** Flechas de viento sobre capas que no son de viento */
  showArrows: boolean
}

interface MapProps extends Props, LayerProps {
  probe: Probe | null
  onProbe: (p: Probe | null) => void
}

// Proyección de Mercator (en radianes) para colocar las flechas sobre la rejilla
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const STEP_RAD = (GRID.step * Math.PI) / 180
const ARROWS_HEIGHT = (mercY(GRID.latMax) - mercY(GRID.latMin)) / STEP_RAD

/**
 * Flechas de viento en cada punto de la rejilla (SVG: nítidas a cualquier zoom).
 * El color indica la fuerza del viento medio: verde flojo, amarillo moderado, rojo fuerte.
 */
function WindArrows({ speed, direction }: { speed: Float32Array; direction: Float32Array }) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const [zoom, setZoom] = useState(() => map.getZoom())
  // Con el mapa muy alejado, una flecha de cada dos para que no se amontonen
  const stride = zoom <= 6 ? 2 : 1
  const arrows = []
  for (let r = 0; r < GRID_ROWS; r += stride) {
    const y = (mercY(GRID.latMax) - mercY(GRID.latMin + r * GRID.step)) / STEP_RAD
    for (let c = 0; c < GRID_COLS; c += stride) {
      const i = r * GRID_COLS + c
      if (speed[i] < 2) continue
      // La dirección meteorológica es de dónde viene: la flecha apunta hacia donde va
      const angle = (direction[i] + 180) % 360
      const len = (0.16 + Math.min(speed[i], 60) / 400) * stride
      const head = 0.09 * stride
      const d = `M0 ${len} L0 ${-len} M${-head} ${-len + head * 1.2} L0 ${-len} L${head} ${-len + head * 1.2}`
      arrows.push(
        <g key={i} transform={`translate(${c} ${y}) rotate(${angle})`}>
          <path className="wind-arrow__halo" d={d} />
          <path className="wind-arrow" d={d} style={{ stroke: arrowColor(speed[i]) }} />
        </g>,
      )
    }
  }
  return (
    <SVGOverlay
      bounds={GRID_BOUNDS}
      attributes={{ viewBox: `0 0 ${GRID_COLS - 1} ${ARROWS_HEIGHT}`, preserveAspectRatio: 'none' }}
      zIndex={12}
    >
      <g className="wind-arrows">{arrows}</g>
    </SVGOverlay>
  )
}

/**
 * Los fotogramas de radar observado se montan todos a la vez y solo el actual
 * es visible, así ya están cargados al animar. Los de previsión se dibujan al
 * vuelo a partir de la rejilla del modelo.
 */
function LayerFrames({ layer, frames, frameIndex, grid, showArrows }: LayerProps) {
  if (!layer) return null
  const current = frames[frameIndex]
  const values = current?.kind === 'forecast' ? grid?.fields[layer.field]?.[current.gridIndex] : undefined
  const imageUrl = values ? renderGridFrame(values, layer) : null
  // El viento se toma de la hora prevista más cercana (también sobre el radar observado)
  const windIndex = current && grid ? (current.kind === 'forecast' ? current.gridIndex : nearestGridIndex(grid, current.time)) : -1
  const speed = windIndex >= 0 ? grid?.fields.wind_speed_10m?.[windIndex] : undefined
  const direction = windIndex >= 0 ? grid?.fields.wind_direction_10m?.[windIndex] : undefined

  return (
    <>
      {layer.observed &&
        frames.map((f, i) =>
          f.kind === 'observed' ? (
            <TileLayer
              key={f.url}
              url={f.url}
              opacity={i === frameIndex ? 0.95 : 0}
              zIndex={10}
              maxNativeZoom={RADAR_MAX_NATIVE_ZOOM}
              maxZoom={18}
              attribution='Radar: <a href="https://www.rainviewer.com/">RainViewer</a> · AEMET'
            />
          ) : null,
        )}
      {imageUrl && <ImageOverlay url={imageUrl} bounds={GRID_BOUNDS} opacity={1} zIndex={11} />}
      {(layer.arrows || showArrows) && speed && direction && <WindArrows speed={speed} direction={direction} />}
    </>
  )
}

export interface Probe {
  lat: number
  lon: number
  /** Fijado con un clic o toque (no desaparece al sacar el ratón) */
  pinned: boolean
}

/** Lee la posición del ratón o del toque para mostrar los datos de ese punto */
function MapProbe({ probe, onProbe }: { probe: Probe | null; onProbe: (p: Probe | null) => void }) {
  useMapEvents({
    mousemove: (e) => {
      if (!probe?.pinned) onProbe({ lat: e.latlng.lat, lon: e.latlng.lng, pinned: false })
    },
    mouseout: () => {
      if (!probe?.pinned) onProbe(null)
    },
    click: (e) => onProbe({ lat: e.latlng.lat, lon: e.latlng.lng, pinned: true }),
  })
  return probe?.pinned ? (
    <CircleMarker center={[probe.lat, probe.lon]} radius={6} pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#fff', fillOpacity: 1 }} />
  ) : null
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

export function WeatherMap({ layer, frames, frameIndex, grid, showArrows, probe, onProbe, ...props }: MapProps) {
  return (
    <MapContainer bounds={MAP_BOUNDS} boundsOptions={{ padding: [24, 24] }} minZoom={6} className="map" scrollWheelZoom>
      <TileLayer
        className="basemap"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LayerFrames layer={layer} frames={frames} frameIndex={frameIndex} grid={grid} showArrows={showArrows} />
      {layer && <MapProbe probe={probe} onProbe={onProbe} />}
      <Markers {...props} />
    </MapContainer>
  )
}
