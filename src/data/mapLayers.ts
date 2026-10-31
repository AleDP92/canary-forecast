import type { GridField } from '../api/modelGrid'

/** Parada de la escala de color: valor, r, g, b, opacidad (0–1) */
export type ColorStop = [value: number, r: number, g: number, b: number, a: number]

export type LayerId = 'rain' | 'cape' | 'wind' | 'gusts'

export interface MapLayer {
  id: LayerId
  /** Nombre corto para el selector y el parámetro de la URL */
  slug: string
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
  /** Dibuja flechas de dirección del viento */
  arrows?: boolean
}

export const MAP_LAYERS: MapLayer[] = [
  {
    id: 'rain',
    slug: 'lluvia',
    name: 'Lluvia',
    icon: '🌧️',
    field: 'precipitation',
    unit: 'mm/h',
    // Imita el esquema «Universal Blue» de RainViewer para que radar y previsión se lean igual
    stops: [
      [0.1, 230, 220, 180, 0.45],
      [0.5, 128, 208, 224, 0.75],
      [2, 16, 160, 224, 0.85],
      [5, 0, 112, 160, 0.92],
      [10, 0, 64, 112, 1],
    ],
    legend: [0.1, 0.5, 2, 5, 10],
    note: 'Precipitación acumulada en la hora según el modelo (rejilla de ~25 km), no es radar real.',
    observed: true,
  },
  {
    id: 'cape',
    slug: 'cape',
    name: 'CAPE',
    icon: '⚡',
    field: 'cape',
    unit: 'J/kg',
    stops: [
      [100, 250, 240, 150, 0.25],
      [300, 250, 220, 80, 0.55],
      [1000, 245, 140, 40, 0.7],
      [2500, 220, 40, 40, 0.8],
      [4000, 150, 40, 170, 0.85],
    ],
    legend: [300, 1000, 2500, 4000],
    note: 'Energía disponible para la convección según el modelo. Más de 1000 J/kg favorece tormentas si hay disparo.',
  },
  {
    id: 'wind',
    slug: 'viento',
    name: 'Viento',
    icon: '💨',
    field: 'wind_speed_10m',
    unit: 'km/h',
    stops: [
      [5, 160, 220, 240, 0.15],
      [15, 120, 210, 170, 0.45],
      [30, 240, 220, 80, 0.6],
      [50, 245, 140, 40, 0.7],
      [70, 220, 40, 40, 0.8],
      [100, 150, 40, 170, 0.85],
    ],
    legend: [15, 30, 50, 70, 100],
    note: 'Viento medio a 10 m según el modelo. Las flechas indican hacia dónde sopla.',
    arrows: true,
  },
  {
    id: 'gusts',
    slug: 'rachas',
    name: 'Rachas',
    icon: '💨',
    field: 'wind_gusts_10m',
    unit: 'km/h',
    stops: [
      [10, 160, 220, 240, 0.15],
      [25, 120, 210, 170, 0.45],
      [45, 240, 220, 80, 0.6],
      [70, 245, 140, 40, 0.7],
      [90, 220, 40, 40, 0.8],
      [120, 150, 40, 170, 0.85],
    ],
    legend: [25, 45, 70, 90, 120],
    note: 'Rachas máximas a 10 m según el modelo. Las flechas indican la dirección del viento medio.',
    arrows: true,
  },
]

export function getLayer(id: LayerId | null): MapLayer | null {
  return MAP_LAYERS.find((l) => l.id === id) ?? null
}

export function layerFromSlug(slug: string | null): LayerId | null {
  return MAP_LAYERS.find((l) => l.slug === slug)?.id ?? null
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
export function legendGradient(layer: MapLayer): string {
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
export function legendPosition(layer: MapLayer, v: number): number {
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
