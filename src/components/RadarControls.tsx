import type { RadarFrame } from '../hooks/useRadar'
import { formatClock } from '../utils/time'

interface Props {
  frames: RadarFrame[]
  index: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  error: string | null
}

export function RadarControls({ frames, index, onIndex, playing, onPlaying, error }: Props) {
  if (error) return <div className="radar-controls error">Radar no disponible: {error}</div>
  if (!frames.length) return <div className="radar-controls muted">Cargando radar…</div>

  const frame = frames[index]
  const minutesAgo = Math.round((Date.now() / 1000 - frame.time) / 60)

  return (
    <div className="radar-controls">
      <button
        type="button"
        className="radar-controls__play"
        onClick={() => onPlaying(!playing)}
        aria-label={playing ? 'Pausar animación' : 'Reproducir animación'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
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
      />
      <span className="radar-controls__time">
        <strong>{formatClock(new Date(frame.time * 1000))}</strong>
        <span className="muted">{index === frames.length - 1 ? ` · hace ${minutesAgo} min` : ''}</span>
      </span>
      <span className="radar-legend" aria-label="Intensidad de precipitación: de débil a fuerte">
        <span className="muted">Débil</span>
        <i />
        <span className="muted">Fuerte</span>
      </span>
    </div>
  )
}
