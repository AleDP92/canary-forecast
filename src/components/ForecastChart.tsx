import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { formatDay, formatHour } from '../utils/time'

export interface ChartSeries {
  id: string
  name: string
  color: string
  values: (number | null)[]
  emphasis?: boolean
}

interface Props {
  times: string[]
  series: ChartSeries[]
  /** Precipitación (mm) que se dibuja como barras */
  bars?: (number | null)[]
  unit: string
  /** Decimales en el recuadro de valores */
  digits?: number
  /** Amplitud mínima del eje Y (evita exagerar variaciones pequeñas) */
  minSpan?: number
  /** Incluir siempre el 0 en el eje Y */
  zeroBased?: boolean
  /** Líneas horizontales de referencia (umbrales) */
  thresholds?: { value: number; color: string }[]
}

const H = 240
const PAD = { top: 16, right: 36, bottom: 28, left: 44 }

/** Paso "bonito" (1, 2, 5 × 10ⁿ) para unas 4–6 líneas de referencia */
function niceStep(range: number): number {
  const raw = range / 5
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}

function niceRange(values: number[], minSpan: number, zeroBased: boolean) {
  let lo = values.length ? Math.min(...values) : 0
  let hi = values.length ? Math.max(...values) : minSpan
  if (zeroBased) {
    lo = Math.min(0, lo)
    hi = Math.max(0, hi)
  }
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = zeroBased && lo >= 0 ? 0 : mid - minSpan / 2
    hi = lo + minSpan
  }
  const step = niceStep(hi - lo)
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step }
}

export function ForecastChart({
  times,
  series,
  bars,
  unit,
  digits = 1,
  minSpan = 4,
  zeroBased = false,
  thresholds = [],
}: Props) {
  const [hover, setHover] = useState<number | null>(null)
  // El ancho del SVG sigue al contenedor para que el texto no se encoja en móvil
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const n = times.length
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  const { min, max, step } = niceRange(all, minSpan, zeroBased)
  const barMax = Math.max(2, ...(bars ?? []).map((v) => v ?? 0))

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
  const barH = (v: number) => (v / barMax) * innerH * 0.6

  const path = (values: (number | null)[]) => {
    let d = ''
    let open = false
    values.forEach((v, i) => {
      if (v == null) {
        open = false
        return
      }
      d += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      open = true
    })
    return d
  }

  const yTicks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) yTicks.push(Number(v.toPrecision(6)))
  const axisUnit = unit.length <= 2 ? unit : ''

  const midnights = times.map((t, i) => ({ t, i })).filter(({ t }) => t.endsWith('T00:00'))
  // La etiqueta del primer día solo si cabe antes de la siguiente medianoche
  const dayStarts =
    n && (!midnights.length || x(midnights[0].i) - x(0) >= 60)
      ? [{ t: times[0], i: 0 }, ...midnights]
      : midnights

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))))
  }

  const ordered = [...series].sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis))

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfica de previsión horaria">
        {yTicks.map((v) => (
          <g key={v}>
            <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart__label" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
              {v}
              {axisUnit}
            </text>
          </g>
        ))}
        {thresholds
          .filter((t) => t.value > min && t.value < max)
          .map((t) => (
            <line
              key={t.value}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t.value)}
              y2={y(t.value)}
              stroke={t.color}
              strokeDasharray="6 4"
              strokeOpacity={0.8}
            />
          ))}
        {dayStarts.map(({ t, i }) => (
          <g key={t}>
            {i > 0 && <line className="chart__day" x1={x(i)} x2={x(i)} y1={PAD.top} y2={H - PAD.bottom} />}
            <text className="chart__label" x={x(i) + 4} y={H - 8}>
              {formatDay(t.slice(0, 10))}
            </text>
          </g>
        ))}
        {bars?.map((v, i) =>
          v ? (
            <rect
              key={i}
              className="chart__bar"
              x={x(i) - innerW / n / 2}
              width={Math.max(1, innerW / n - 1)}
              y={H - PAD.bottom - barH(v)}
              height={barH(v)}
            />
          ) : null,
        )}
        {bars && (
          <text className="chart__label chart__label--rain" x={W - PAD.right + 6} y={H - PAD.bottom - innerH * 0.6 + 4}>
            {barMax.toFixed(0)}mm
          </text>
        )}
        {ordered.map((s) => (
          <path
            key={s.id}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.emphasis ? 3 : 1.5}
            strokeOpacity={s.emphasis || series.length === 1 ? 1 : 0.75}
            strokeLinejoin="round"
          />
        ))}
        {hover != null && (
          <g>
            <line className="chart__cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
            {series.map((s) =>
              s.values[hover] != null ? (
                <circle key={s.id} cx={x(hover)} cy={y(s.values[hover]!)} r={s.emphasis ? 4 : 3} fill={s.color} />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <div className="chart__tooltip" aria-live="polite">
        {hover != null ? (
          <>
            <strong>
              {formatDay(times[hover].slice(0, 10))} {formatHour(times[hover])}
            </strong>
            {series.map((s) => (
              <span key={s.id} className={s.emphasis ? 'tooltip__item--emphasis' : undefined}>
                <i style={{ background: s.color }} />
                {s.name}: {s.values[hover] == null ? '–' : `${s.values[hover]!.toFixed(digits)}${unit.length > 2 ? ' ' : ''}${unit}`}
              </span>
            ))}
            {bars && <span>💧 {(bars[hover] ?? 0).toFixed(1)} mm</span>}
          </>
        ) : (
          <span className="muted">Pasa el ratón por la gráfica para ver los valores</span>
        )}
      </div>
    </div>
  )
}
