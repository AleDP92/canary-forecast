import type { CSSProperties } from 'react'
import type { RadarFrame } from '../hooks/useRadar'
import { formatFrameTime } from '../utils/time'

interface Props {
  frames: RadarFrame[]
  index: number
  nowIndex: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  error: string | null
  forecastError: string | null
  modelName: string
}

function relative(frame: RadarFrame, now: RadarFrame): string {
  const minutes = Math.round((frame.time - now.time) / 60)
  if (minutes === 0) return 'último dato'
  if (minutes < 0) return `hace ${-minutes} min`
  return minutes < 60 ? `+${minutes} min` : `+${Math.round(minutes / 60)} h`
}

export function RadarControls(props: Props) {
  const { frames, index, nowIndex, onIndex, playing, onPlaying, error, forecastError, modelName } = props
  if (!frames.length) {
    return (
      <div className={`radar-controls${error ? ' error' : ' muted'}`}>
        {error ? `Radar no disponible: ${error}` : 'Cargando radar…'}
      </div>
    )
  }

  const frame = frames[index]
  const forecastCount = frames.length - nowIndex - 1
  // Proporción de la barra que corresponde al radar observado
  const nowPct = frames.length > 1 ? (nowIndex / (frames.length - 1)) * 100 : 100
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
            aria-label="Momento del radar"
            aria-valuetext={`${formatFrameTime(frame.time)}, ${isForecast ? 'previsión' : 'radar'}`}
          />
          <div className="radar-timeline__track" aria-hidden="true">
            <span className="radar-timeline__past">Radar</span>
            <span className="radar-timeline__future">{forecastCount > 0 ? `Previsión ${modelName}` : ''}</span>
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
        <span className="radar-legend" aria-label="Intensidad de precipitación: de débil a fuerte">
          <span className="muted">Débil</span>
          <i />
          <span className="muted">Fuerte</span>
        </span>
      </div>
      {forecastError && <div className="radar-controls__warn">No se pudo cargar la previsión: {forecastError}</div>}
      {isForecast && (
        <div className="radar-controls__note muted">
          Precipitación acumulada en la hora según el modelo (rejilla de ~25 km), no es radar real.
        </div>
      )}
    </div>
  )
}
