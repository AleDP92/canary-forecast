import type { CSSProperties } from 'react'
import { nearestGridIndex, nearestGridValue, sampleGrid, type ModelGrid } from '../api/modelGrid'
import {
  FILL_LAYERS,
  LAYER_BUTTONS,
  WIND_SCALES,
  legendGradient,
  legendPosition,
  windColor,
  type FillLayer,
  type LayerId,
  type WindMode,
} from '../data/mapLayers'
import { windDirection } from '../data/weatherCodes'
import type { LayerFrame } from '../hooks/useMapLayer'
import { formatFrameTime } from '../utils/time'
import type { Probe } from './WeatherMap'

interface Props {
  active: LayerId[]
  windMode: WindMode
  onWindMode: (m: WindMode) => void
  frames: LayerFrame[]
  index: number
  nowIndex: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  observedError: string | null
  gridError: string | null
  /** Capas activas que el modelo no ofrece */
  missing: LayerId[]
  modelName: string
  grid: ModelGrid | null
  probe: Probe | null
  onClearProbe: () => void
}

/** Datos de lluvia, CAPE y viento en el punto señalado, en la hora del fotograma */
function PointReadout({
  grid,
  frame,
  probe,
  windMode,
  onClear,
}: {
  grid: ModelGrid | null
  frame: LayerFrame
  probe: Probe | null
  windMode: WindMode
  onClear: () => void
}) {
  if (!probe) {
    return <div className="point-readout muted">Pasa el ratón o toca el mapa para ver lluvia, CAPE y viento en un punto.</div>
  }
  if (!grid) return null
  // Sobre el radar observado se usa la hora prevista más cercana
  const gi = frame.kind === 'forecast' ? frame.gridIndex : nearestGridIndex(grid, frame.time)
  const f = grid.fields
  const sample = (v: Float32Array[] | null) => (v ? sampleGrid(v[gi], probe.lat, probe.lon) : null)
  const rain = sample(f.precipitation)
  const cape = sample(f.cape)
  const wind = sample(f.wind_speed_10m)
  const gusts = sample(f.wind_gusts_10m)
  const dir = f.wind_direction_10m ? nearestGridValue(f.wind_direction_10m[gi], probe.lat, probe.lon) : null
  const colorValue = windMode === 'gusts' ? gusts : wind

  if (wind == null && rain == null) {
    return <div className="point-readout muted">Ese punto queda fuera de la zona de previsión.</div>
  }
  return (
    <div className="point-readout">
      <span className="point-readout__where">
        📍 {probe.lat.toFixed(2)}° N, {Math.abs(probe.lon).toFixed(2)}° O
        {frame.kind === 'observed' && <span className="muted"> (modelo, {formatFrameTime(grid.times[gi])})</span>}
      </span>
      <span>🌧️ {rain == null ? '–' : `${rain.toFixed(1)} mm/h`}</span>
      <span>⚡ {cape == null ? 'n/d' : `${Math.round(cape)} J/kg`}</span>
      <span>
        <i
          className="point-readout__dot"
          style={{ background: colorValue == null ? undefined : windColor(windMode, colorValue) }}
        />
        💨 {wind == null ? '–' : `${Math.round(wind)} km/h ${windDirection(dir)}`}
        {gusts != null && <span className="muted"> · rachas {Math.round(gusts)}</span>}
      </span>
      {probe.pinned && (
        <button type="button" className="point-readout__close" onClick={onClear} aria-label="Quitar punto">
          ✕
        </button>
      )}
    </div>
  )
}

function FillLegend({ layer }: { layer: FillLayer }) {
  return (
    <span className="layer-legend" aria-label={`Escala de ${layer.name} en ${layer.unit}`}>
      <span className="layer-legend__name">{layer.icon}</span>
      <span className="layer-legend__bar">
        <i style={{ background: legendGradient(layer) }} />
        {layer.legend.map((v) => {
          const pos = legendPosition(layer, v)
          // Los extremos se alinean hacia dentro para no salirse de la barra
          const shift = pos <= 5 ? '0' : pos >= 95 ? '-100%' : '-50%'
          return (
            <span key={v} style={{ left: `${pos}%`, transform: `translateX(${shift})` }}>
              {v}
            </span>
          )
        })}
      </span>
      <span className="muted layer-legend__unit">{layer.unit}</span>
    </span>
  )
}

function WindLegend({ mode }: { mode: WindMode }) {
  const [low, mid, high] = WIND_SCALES[mode].legend
  return (
    <span className="arrow-legend" aria-label={`Color de las flechas según ${WIND_SCALES[mode].name.toLowerCase()}`}>
      💨
      <i style={{ background: windColor(mode, low - 5) }} />
      &lt;{low}
      <i style={{ background: windColor(mode, mid) }} />
      {mid}
      <i style={{ background: windColor(mode, high) }} />
      &gt;{high} km/h
    </span>
  )
}

function relative(frame: LayerFrame, now: LayerFrame): string {
  const minutes = Math.round((frame.time - now.time) / 60)
  if (minutes === 0) return frame.kind === 'observed' ? 'último dato' : 'ahora'
  if (minutes < 0) return `hace ${-minutes} min`
  return minutes < 60 ? `+${minutes} min` : `+${Math.round(minutes / 60)} h`
}

const layerName = (id: LayerId) => LAYER_BUTTONS.find((b) => b.id === id)!.name

export function LayerControls(props: Props) {
  const { active, windMode, frames, index, nowIndex, onIndex, playing, onPlaying, modelName } = props
  const { observedError, gridError, missing } = props
  const withRadar = active.includes('rain')
  const missingNote = missing.length > 0 && (
    <div className="radar-controls__warn">
      {modelName} no ofrece {missing.map(layerName).join(' ni ')} en Open-Meteo. Prueba con otro modelo.
    </div>
  )

  if (!frames.length) {
    const error = gridError ?? observedError
    return (
      <div className={`radar-controls${error ? ' error' : ''}`}>
        {missingNote || (
          <span className={error ? undefined : 'muted'}>{error ? `Capas no disponibles: ${error}` : 'Cargando capas…'}</span>
        )}
      </div>
    )
  }

  const frame = frames[index]
  const pastCount = withRadar ? nowIndex + 1 : 0
  // Proporción de la barra que corresponde al radar observado
  const nowPct = withRadar && frames.length > 1 ? (nowIndex / (frames.length - 1)) * 100 : 0
  const isForecast = frame.kind === 'forecast'
  const fills = FILL_LAYERS.filter((l) => active.includes(l.id) && !missing.includes(l.id))

  return (
    <div className="radar-controls">
      <div className="radar-controls__row">
        <button
          type="button"
          className="radar-controls__play"
          onClick={() => onPlaying(!playing)}
          aria-label={playing ? 'Pausar animación' : 'Reproducir animación'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="radar-timeline" style={{ '--now-pct': `${nowPct}%` } as CSSProperties}>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={index}
            onChange={(e) => {
              onPlaying(false)
              onIndex(Number(e.target.value))
            }}
            aria-label="Momento de las capas"
            aria-valuetext={`${formatFrameTime(frame.time)}, ${isForecast ? 'previsión' : 'radar'}`}
          />
          <div className="radar-timeline__track" aria-hidden="true">
            {pastCount > 0 && <span className="radar-timeline__past">Radar</span>}
            <span className="radar-timeline__future">
              {frames.length > pastCount ? `Previsión ${modelName}` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="radar-controls__now"
          onClick={() => {
            onPlaying(false)
            onIndex(nowIndex)
          }}
          disabled={index === nowIndex}
        >
          Ahora
        </button>
      </div>

      <div className="radar-controls__row radar-controls__info">
        <span className={`radar-badge${isForecast ? ' radar-badge--forecast' : ''}`}>
          {isForecast ? `Previsión · ${modelName}` : 'Radar observado'}
        </span>
        <span className="radar-controls__time">
          <strong>{formatFrameTime(frame.time)}</strong>{' '}
          <span className="muted">· {relative(frame, frames[nowIndex])}</span>
        </span>
        {active.includes('wind') && (
          <div className="segmented" role="group" aria-label="Color de las flechas">
            <button type="button" aria-pressed={windMode === 'mean'} onClick={() => props.onWindMode('mean')}>
              Medio
            </button>
            <button type="button" aria-pressed={windMode === 'gusts'} onClick={() => props.onWindMode('gusts')}>
              Rachas
            </button>
          </div>
        )}
      </div>

      <div className="radar-controls__row radar-controls__legends">
        {fills.map((l) => (
          <FillLegend key={l.id} layer={l} />
        ))}
        {active.includes('wind') && <WindLegend mode={windMode} />}
      </div>

      <PointReadout grid={props.grid} frame={frame} probe={props.probe} windMode={windMode} onClear={props.onClearProbe} />
      {gridError && <div className="radar-controls__warn">No se pudo cargar la previsión: {gridError}</div>}
      {missingNote}
      {isForecast &&
        fills.map((l) => (
          <div key={l.id} className="radar-controls__note muted">
            {l.note}
          </div>
        ))}
    </div>
  )
}
