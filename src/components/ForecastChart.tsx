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
}

const H = 240
const PAD = { top: 16, right: 36, bottom: 28, left: 36 }

function niceRange(values: number[]): [number, number] {
  if (!values.length) return [0, 1]
  let min = Math.floor(Math.min(...values))
  let max = Math.ceil(Math.max(...values))
  if (max - min < 4) {
    const mid = (max + min) / 2
    min = Math.floor(mid - 2)
    max = Math.ceil(mid + 2)
  }
  return [min, max]
}

export function ForecastChart({ times, series, bars, unit }: Props) {
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
  const [min, max] = niceRange(all)
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

  // Paso entero "bonito" (1, 2 o 5 grados) para unas 4–6 líneas de referencia
  const step = [1, 2, 5, 10].find((s) => (max - min) / s <= 6) ?? 10
  const yTicks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) yTicks.push(v)

  const dayStarts = times
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => i === 0 || t.endsWith('T00:00'))

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
              {unit}
            </text>
          </g>
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
                {s.name}: {s.values[hover] == null ? '–' : `${s.values[hover]!.toFixed(1)}${unit}`}
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
