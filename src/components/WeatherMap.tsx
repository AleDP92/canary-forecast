import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  SVGOverlay,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { CurrentConditions } from '../api/openMeteo'
import { GRID, GRID_COLS, GRID_ROWS, nearestGridIndex, type GridField, type ModelGrid } from '../api/modelGrid'
import { LOCATIONS, MAP_BOUNDS, REGION_BOUNDS, type Location } from '../data/locations'
import { describeWeather } from '../data/weatherCodes'
import { FILL_LAYERS, WIND_SCALES, windColor, type LayerId, type WindMode } from '../data/mapLayers'
import { RADAR_MAX_NATIVE_ZOOM, type LayerFrame } from '../hooks/useMapLayer'
import { GRID_BOUNDS, renderGridFrame } from '../utils/gridImage'

interface Props {
  current: Record<string, CurrentConditions> | null
  selectedId: string
  onSelect: (id: string) => void
}

interface LayerProps {
  /** Capas activas (combinables) */
  active: LayerId[]
  windMode: WindMode
  frames: LayerFrame[]
  frameIndex: number
  grid: ModelGrid | null
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
 * Dirección y longitud según el viento medio; color según la escala elegida
 * (viento medio o rachas): verde flojo, amarillo moderado, rojo fuerte.
 */
function WindArrows({
  speed,
  colorBy,
  direction,
  mode,
}: {
  speed: Float32Array
  colorBy: Float32Array
  direction: Float32Array
  mode: WindMode
}) {
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
          <path className="wind-arrow" d={d} style={{ stroke: windColor(mode, colorBy[i]) }} />
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
 * Dibuja las capas activas en el instante elegido. Los fotogramas de radar
 * observado se montan todos a la vez y solo el actual es visible, así ya están
 * cargados al animar. La previsión se dibuja al vuelo a partir de la rejilla.
 */
function LayerFrames({ active, windMode, frames, frameIndex, grid }: LayerProps) {
  const current = frames[frameIndex]
  if (!current) return null
  // Hora de la rejilla: la del fotograma, o la prevista más cercana sobre el radar observado
  const gi = grid ? (current.kind === 'forecast' ? current.gridIndex : nearestGridIndex(grid, current.time)) : -1
  const field = (f: GridField) => (gi >= 0 ? grid?.fields[f]?.[gi] : undefined)

  // CAPE debajo y lluvia encima, para que la lluvia se lea sobre el CAPE
  const fills = [...FILL_LAYERS].reverse().filter((l) => active.includes(l.id))
  const showRadar = active.includes('rain')
  const speed = field('wind_speed_10m')
  const direction = field('wind_direction_10m')
  const colorBy = field(WIND_SCALES[windMode].field)

  return (
    <>
      {showRadar &&
        frames.map((f, i) =>
          f.kind === 'observed' ? (
            <TileLayer
              key={f.url}
              url={f.url}
              opacity={i === frameIndex ? 0.95 : 0}
              zIndex={11}
              maxNativeZoom={RADAR_MAX_NATIVE_ZOOM}
              maxZoom={18}
              attribution='Radar: <a href="https://www.rainviewer.com/">RainViewer</a> · AEMET'
            />
          ) : null,
        )}
      {fills.map((layer, k) => {
        // Sobre el radar observado la lluvia ya la pinta el radar
        if (layer.observed && current.kind === 'observed') return null
        const values = field(layer.field)
        return values ? (
          <ImageOverlay key={layer.id} url={renderGridFrame(values, layer)} bounds={GRID_BOUNDS} opacity={1} zIndex={10 + k} />
        ) : null
      })}
      {active.includes('wind') && speed && direction && colorBy && (
        <WindArrows speed={speed} colorBy={colorBy} direction={direction} mode={windMode} />
      )}
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

/**
 * Impide alejar el mapa más allá de la zona de Canarias: el zoom mínimo es el
 * que muestra la zona completa. Se recalcula si cambia el tamaño del mapa.
 */
function LimitToRegion() {
  const map = useMap()
  useEffect(() => {
    const update = () => map.setMinZoom(map.getBoundsZoom(REGION_BOUNDS))
    update()
    map.on('resize', update)
    return () => {
      map.off('resize', update)
    }
  }, [map])
  return null
}

export function WeatherMap({ active, windMode, frames, frameIndex, grid, probe, onProbe, ...props }: MapProps) {
  return (
    <MapContainer
      bounds={MAP_BOUNDS}
      boundsOptions={{ padding: [24, 24] }}
      maxBounds={REGION_BOUNDS}
      maxBoundsViscosity={1}
      zoomSnap={0.25}
      className="map"
      scrollWheelZoom
    >
      <LimitToRegion />
      <TileLayer
        className="basemap"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LayerFrames active={active} windMode={windMode} frames={frames} frameIndex={frameIndex} grid={grid} />
      {active.length > 0 && <MapProbe probe={probe} onProbe={onProbe} />}
      <Markers {...props} />
    </MapContainer>
  )
}
