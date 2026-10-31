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
  /** Capa de viento: las flechas se muestran siempre */
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
      [0.1, 205, 195, 140, 0.8],
      [0.5, 100, 190, 225, 0.92],
      [2, 16, 140, 220, 0.97],
      [5, 0, 95, 170, 1],
      [10, 0, 50, 110, 1],
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
      [100, 245, 230, 120, 0.6],
      [300, 245, 200, 50, 0.85],
      [1000, 240, 120, 30, 0.92],
      [2500, 210, 30, 30, 0.97],
      [4000, 130, 30, 160, 1],
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
      [5, 120, 200, 120, 0.15],
      [15, 60, 175, 85, 0.35],
      [30, 230, 195, 40, 0.45],
      [50, 235, 120, 30, 0.55],
      [70, 210, 40, 40, 0.6],
      [100, 130, 30, 160, 0.65],
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
      [10, 120, 200, 120, 0.15],
      [25, 60, 175, 85, 0.35],
      [45, 230, 195, 40, 0.45],
      [70, 235, 120, 30, 0.55],
      [90, 210, 40, 40, 0.6],
      [120, 130, 30, 160, 0.65],
    ],
    legend: [25, 45, 70, 90, 120],
    note: 'Rachas máximas a 10 m según el modelo. Las flechas indican la dirección del viento medio.',
    arrows: true,
  },
]

/**
 * Color de las flechas según el viento medio (km/h):
 * verde = flojo, amarillo = moderado, rojo = fuerte.
 */
export const ARROW_STOPS: ColorStop[] = [
  [0, 22, 163, 74, 1],
  [15, 22, 163, 74, 1],
  [30, 234, 179, 8, 1],
  [50, 220, 38, 38, 1],
]

export function arrowColor(kmh: number): string {
  const [r, g, b] = colorFor(ARROW_STOPS, kmh)
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

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
