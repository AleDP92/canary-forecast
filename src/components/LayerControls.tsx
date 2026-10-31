import type { CSSProperties } from 'react'
import {
  nearestGridIndex,
  nearestGridValue,
  sampleGrid,
  type ModelGrid,
} from '../api/modelGrid'
import { arrowColor, legendGradient, legendPosition, type LayerId, type MapLayer } from '../data/mapLayers'
import { windDirection } from '../data/weatherCodes'
import type { LayerFrame } from '../hooks/useMapLayer'
import { formatFrameTime } from '../utils/time'
import type { Probe } from './WeatherMap'

interface Props {
  layer: MapLayer
  onLayer: (id: LayerId) => void
  frames: LayerFrame[]
  index: number
  nowIndex: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  observedError: string | null
  gridError: string | null
  fieldMissing: boolean
  modelName: string
  grid: ModelGrid | null
  probe: Probe | null
  onClearProbe: () => void
  showArrows: boolean
  onShowArrows: (v: boolean) => void
}

/** Datos de lluvia, CAPE y viento en el punto señalado, en la hora del fotograma */
function PointReadout({ grid, frame, probe, onClear }: { grid: ModelGrid | null; frame: LayerFrame; probe: Probe | null; onClear: () => void }) {
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
        <i className="point-readout__dot" style={{ background: wind == null ? undefined : arrowColor(wind) }} />
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

function relative(frame: LayerFrame, now: LayerFrame): string {
  const minutes = Math.round((frame.time - now.time) / 60)
  if (minutes === 0) return frame.kind === 'observed' ? 'último dato' : 'ahora'
  if (minutes < 0) return `hace ${-minutes} min`
  return minutes < 60 ? `+${minutes} min` : `+${Math.round(minutes / 60)} h`
}

export function LayerControls(props: Props) {
  const { layer, frames, index, nowIndex, onIndex, playing, onPlaying, modelName } = props
  const { observedError, gridError, fieldMissing } = props

  if (fieldMissing && !layer.observed) {
    return (
      <div className="radar-controls muted">
        {modelName} no ofrece {layer.name} en Open-Meteo. Prueba con otro modelo.
      </div>
    )
  }
  if (!frames.length) {
    const error = gridError ?? observedError
    return (
      <div className={`radar-controls${error ? ' error' : ' muted'}`}>
        {error ? `${layer.name} no disponible: ${error}` : `Cargando ${layer.name.toLowerCase()}…`}
      </div>
    )
  }

  const frame = frames[index]
  const pastCount = layer.observed ? nowIndex + 1 : 0
  // Proporción de la barra que corresponde al radar observado
  const nowPct = layer.observed && frames.length > 1 ? (nowIndex / (frames.length - 1)) * 100 : 0
  const isForecast = frame.kind === 'forecast'

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
            aria-label={`Momento de la capa ${layer.name}`}
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
        {layer.arrows && (
          <div className="segmented" role="group" aria-label="Tipo de viento">
            <button type="button" aria-pressed={layer.id === 'wind'} onClick={() => props.onLayer('wind')}>
              Medio
            </button>
            <button type="button" aria-pressed={layer.id === 'gusts'} onClick={() => props.onLayer('gusts')}>
              Rachas
            </button>
          </div>
        )}
        <span className={`radar-badge${isForecast ? ' radar-badge--forecast' : ''}`}>
          {layer.icon} {isForecast ? `${layer.name} · ${modelName}` : 'Radar observado'}
        </span>
        <span className="radar-controls__time">
          <strong>{formatFrameTime(frame.time)}</strong>{' '}
          <span className="muted">· {relative(frame, frames[nowIndex])}</span>
        </span>
        {!layer.arrows && (
          <label className="toggle arrows-toggle">
            <input type="checkbox" checked={props.showArrows} onChange={(e) => props.onShowArrows(e.target.checked)} />
            Flechas de viento
          </label>
        )}
        {(layer.arrows || props.showArrows) && (
          <span className="arrow-legend" aria-label="Color de las flechas según el viento medio">
            <i style={{ background: arrowColor(10) }} />
            &lt;15
            <i style={{ background: arrowColor(30) }} />
            30
            <i style={{ background: arrowColor(50) }} />
            &gt;50 km/h
          </span>
        )}
        <span className="layer-legend" aria-label={`Escala de ${layer.name} en ${layer.unit}`}>
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
      </div>
      <PointReadout grid={props.grid} frame={frame} probe={props.probe} onClear={props.onClearProbe} />
      {gridError && <div className="radar-controls__warn">No se pudo cargar la previsión: {gridError}</div>}
      {fieldMissing && layer.observed && (
        <div className="radar-controls__warn">{modelName} no ofrece previsión de {layer.name.toLowerCase()}.</div>
      )}
      {isForecast && <div className="radar-controls__note muted">{layer.note}</div>}
    </div>
  )
}
