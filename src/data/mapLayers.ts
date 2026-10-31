import type { GridField } from '../api/modelGrid'

/** Parada de la escala de color: valor, r, g, b, opacidad (0–1) */
export type ColorStop = [value: number, r: number, g: number, b: number, a: number]

export type LayerId = 'rain' | 'cape' | 'wind'
export type WindMode = 'mean' | 'gusts'

/** Capas de color (lluvia, CAPE); el viento se dibuja con flechas */
export interface FillLayer {
  id: Exclude<LayerId, 'wind'>
  name: string
  icon: string
  field: GridField
  unit: string
  /** Por debajo del primer valor no se pinta nada */
  stops: ColorStop[]
  /** Valores que se muestran en la leyenda */
  legend: number[]
  note: string
  /** Muestra el radar observado antes de la previsión */
  observed?: boolean
}

export const FILL_LAYERS: FillLayer[] = [
  {
    id: 'rain',
    name: 'Lluvia',
    icon: '🌧️',
    field: 'precipitation',
    unit: 'mm/h',
    // Imita el esquema «Universal Blue» de RainViewer para que radar y previsión se lean igual
    stops: [
      [0.1, 205, 195, 140, 0.8],
      [0.5, 100, 190, 225, 0.92],
      [2, 16, 140, 220, 0.97],
      [5, 0, 95, 170, 1],
      [10, 0, 50, 110, 1],
    ],
    legend: [0.1, 0.5, 2, 5, 10],
    note: 'Lluvia prevista: precipitación acumulada en la hora según el modelo (rejilla de ~30 km), no es radar real.',
    observed: true,
  },
  {
    id: 'cape',
    name: 'CAPE',
    icon: '⚡',
    field: 'cape',
    unit: 'J/kg',
    stops: [
      [100, 245, 230, 120, 0.6],
      [300, 245, 200, 50, 0.85],
      [1000, 240, 120, 30, 0.92],
      [2500, 210, 30, 30, 0.97],
      [4000, 130, 30, 160, 1],
    ],
    legend: [300, 1000, 2500, 4000],
    note: 'CAPE: energía disponible para la convección. Más de 1000 J/kg favorece tormentas si hay disparo.',
  },
]

/** Botones del selector de capas, en orden */
export const LAYER_BUTTONS: { id: LayerId; name: string; icon: string }[] = [
  { id: 'rain', name: 'Lluvia', icon: '🌧️' },
  { id: 'cape', name: 'CAPE', icon: '⚡' },
  { id: 'wind', name: 'Viento', icon: '💨' },
]

export interface WindScale {
  name: string
  field: GridField
  stops: ColorStop[]
  legend: [number, number, number]
}

/**
 * Escalas de color de las flechas de viento (km/h):
 * verde = flojo, amarillo = moderado, rojo = fuerte.
 */
export const WIND_SCALES: Record<WindMode, WindScale> = {
  mean: {
    name: 'Viento medio',
    field: 'wind_speed_10m',
    stops: [
      [0, 22, 163, 74, 1],
      [15, 22, 163, 74, 1],
      [30, 234, 179, 8, 1],
      [50, 220, 38, 38, 1],
    ],
    legend: [15, 30, 50],
  },
  gusts: {
    name: 'Rachas',
    field: 'wind_gusts_10m',
    stops: [
      [0, 22, 163, 74, 1],
      [25, 22, 163, 74, 1],
      [45, 234, 179, 8, 1],
      [70, 220, 38, 38, 1],
    ],
    legend: [25, 45, 70],
  },
}

export function windColor(mode: WindMode, kmh: number): string {
  const [r, g, b] = colorFor(WIND_SCALES[mode].stops, kmh)
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

export function colorFor(stops: ColorStop[], v: number): [number, number, number, number] {
  if (v < stops[0][0]) return [0, 0, 0, 0]
  for (let i = 1; i < stops.length; i++) {
    const [v1, r1, g1, b1, a1] = stops[i]
    if (v < v1) {
      const [v0, r0, g0, b0, a0] = stops[i - 1]
      const f = (v - v0) / (v1 - v0)
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, (a0 + (a1 - a0) * f) * 255]
    }
  }
  const [, r, g, b, a] = stops[stops.length - 1]
  return [r, g, b, a * 255]
}

/** Degradado CSS de la escala, para la leyenda */
export function legendGradient(layer: FillLayer): string {
  const parts = layer.stops.map(([v, r, g, b, a]) => {
    const pct = legendPosition(layer, v)
    return `rgba(${r},${g},${b},${Math.max(a, 0.5)}) ${pct.toFixed(0)}%`
  })
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

/**
 * Posición (0–100 %) de un valor dentro de la barra de la leyenda. Cada tramo
 * entre paradas ocupa lo mismo, porque las escalas no son lineales (lluvia).
 */
export function legendPosition(layer: FillLayer, v: number): number {
  const { stops } = layer
  const n = stops.length - 1
  if (v <= stops[0][0]) return 0
  for (let i = 1; i <= n; i++) {
    if (v <= stops[i][0]) {
      const f = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      return ((i - 1 + f) / n) * 100
    }
  }
  return 100
}
