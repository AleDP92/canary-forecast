/**
 * Índices de inestabilidad y convección.
 * Algunos vienen directamente de Open-Meteo y otros se calculan a partir de
 * temperaturas y puntos de rocío en niveles de presión.
 */

/** Variables horarias que se piden a Open-Meteo para calcular los índices */
export const INDEX_SOURCE_VARS = [
  'cape',
  'convective_inhibition',
  'lifted_index',
  'freezing_level_height',
  'temperature_850hPa',
  'dew_point_850hPa',
  'temperature_700hPa',
  'dew_point_700hPa',
  'temperature_500hPa',
] as const

export type IndexSourceVar = (typeof INDEX_SOURCE_VARS)[number]
export type SourceRow = Record<IndexSourceVar, number | null>

export interface Level {
  /** Se aplica si el valor es >= `from` (o <= `from` cuando `lowerIsWorse`) */
  from: number
  label: string
  color: string
}

export interface IndexDef {
  id: string
  name: string
  short: string
  unit: string
  digits: number
  description: string
  /** true si valores más bajos indican más inestabilidad (LI, T500) */
  lowerIsWorse?: boolean
  zeroBased?: boolean
  minSpan: number
  /** Niveles de menor a mayor riesgo */
  levels: Level[]
  compute: (r: SourceRow) => number | null
}

const GREEN = '#16a34a'
const YELLOW = '#ca8a04'
const ORANGE = '#ea580c'
const RED = '#dc2626'
const PURPLE = '#9333ea'

const bothDefined = (...v: (number | null)[]) => v.every((x) => x != null)

export const INDICES: IndexDef[] = [
  {
    id: 'cape',
    name: 'CAPE',
    short: 'CAPE',
    unit: 'J/kg',
    digits: 0,
    description:
      'Energía disponible para que una burbuja de aire ascienda por sí sola. Cuanto mayor, más fuertes pueden ser las corrientes ascendentes de una tormenta.',
    zeroBased: true,
    minSpan: 400,
    levels: [
      { from: 0, label: 'Estable', color: GREEN },
      { from: 300, label: 'Débil', color: YELLOW },
      { from: 1000, label: 'Moderada', color: ORANGE },
      { from: 2500, label: 'Fuerte', color: RED },
    ],
    compute: (r) => r.cape,
  },
  {
    id: 'k_index',
    name: 'Índice K',
    short: 'K',
    unit: '',
    digits: 0,
    description:
      'Combina el gradiente térmico entre 850 y 500 hPa con la humedad en niveles bajos y medios. Muy usado para estimar la probabilidad de tormentas de masa de aire.',
    minSpan: 20,
    levels: [
      { from: -Infinity, label: 'Tormentas improbables', color: GREEN },
      { from: 20, label: 'Tormentas aisladas', color: YELLOW },
      { from: 26, label: 'Tormentas dispersas', color: ORANGE },
      { from: 31, label: 'Tormentas numerosas', color: RED },
      { from: 36, label: 'Tormentas muy probables', color: PURPLE },
    ],
    // K = (T850 − T500) + Td850 − (T700 − Td700)
    compute: (r) =>
      bothDefined(r.temperature_850hPa, r.temperature_500hPa, r.dew_point_850hPa, r.temperature_700hPa, r.dew_point_700hPa)
        ? r.temperature_850hPa! - r.temperature_500hPa! + r.dew_point_850hPa! - (r.temperature_700hPa! - r.dew_point_700hPa!)
        : null,
  },
  {
    id: 'total_totals',
    name: 'Total Totals',
    short: 'TT',
    unit: '',
    digits: 0,
    description:
      'Suma de la diferencia de temperatura y de humedad entre 850 y 500 hPa. Valores altos indican un ambiente favorable a tormentas organizadas.',
    minSpan: 20,
    levels: [
      { from: -Infinity, label: 'Baja', color: GREEN },
      { from: 44, label: 'Tormentas posibles', color: YELLOW },
      { from: 50, label: 'Tormentas probables', color: ORANGE },
      { from: 55, label: 'Tormentas fuertes', color: RED },
    ],
    // TT = T850 + Td850 − 2·T500
    compute: (r) =>
      bothDefined(r.temperature_850hPa, r.dew_point_850hPa, r.temperature_500hPa)
        ? r.temperature_850hPa! + r.dew_point_850hPa! - 2 * r.temperature_500hPa!
        : null,
  },
  {
    id: 'lifted_index',
    name: 'Lifted Index',
    short: 'LI',
    unit: '',
    digits: 1,
    description:
      'Diferencia entre el aire a 500 hPa y una burbuja elevada desde superficie. Negativo = la burbuja es más cálida que su entorno y tiende a subir.',
    lowerIsWorse: true,
    minSpan: 6,
    levels: [
      { from: Infinity, label: 'Estable', color: GREEN },
      { from: 0, label: 'Marginal', color: YELLOW },
      { from: -3, label: 'Inestable', color: ORANGE },
      { from: -6, label: 'Muy inestable', color: RED },
    ],
    compute: (r) => r.lifted_index,
  },
  {
    id: 'cin',
    name: 'Inhibición (CIN)',
    short: 'CIN',
    unit: 'J/kg',
    digits: 0,
    description:
      'Energía que hay que vencer para que se dispare la convección. Una inhibición fuerte puede impedir las tormentas aunque haya mucho CAPE.',
    zeroBased: true,
    minSpan: 100,
    levels: [
      { from: 0, label: 'Débil', color: YELLOW },
      { from: 50, label: 'Moderada', color: ORANGE },
      { from: 200, label: 'Fuerte', color: RED },
    ],
    // Cada modelo usa un signo distinto: se muestra la magnitud
    compute: (r) => (r.convective_inhibition == null ? null : Math.abs(r.convective_inhibition)),
  },
  {
    id: 't500',
    name: 'Temperatura a 500 hPa',
    short: 'T500',
    unit: '°',
    digits: 1,
    description:
      'Temperatura a unos 5.500 m. En Canarias lo habitual es entre −8 y −12 °C; valores por debajo de −15 °C suelen indicar aire frío en altura (DANA) e inestabilidad.',
    lowerIsWorse: true,
    minSpan: 6,
    levels: [
      { from: Infinity, label: 'Normal', color: GREEN },
      { from: -13, label: 'Algo fría', color: YELLOW },
      { from: -16, label: 'Aire frío en altura', color: ORANGE },
      { from: -20, label: 'Muy fría (posible DANA)', color: RED },
    ],
    compute: (r) => r.temperature_500hPa,
  },
  {
    id: 'freezing_level',
    name: 'Isocero',
    short: '0 °C',
    unit: 'm',
    digits: 0,
    description: 'Altitud a la que la temperatura baja a 0 °C. Por debajo de ~2.500 m puede nevar en las cumbres del Teide.',
    lowerIsWorse: true,
    minSpan: 500,
    levels: [
      { from: Infinity, label: 'Alta', color: GREEN },
      { from: 3000, label: 'Media', color: YELLOW },
      { from: 2500, label: 'Nieve posible en cumbres', color: ORANGE },
    ],
    compute: (r) => r.freezing_level_height,
  },
]

export function levelFor(def: IndexDef, value: number | null): Level | null {
  if (value == null) return null
  let match = def.levels[0]
  for (const lvl of def.levels) {
    if (def.lowerIsWorse ? value <= lvl.from : value >= lvl.from) match = lvl
  }
  return match
}

/** Umbrales para dibujar en la gráfica (se omite el primer nivel, que es la base) */
export function thresholdsFor(def: IndexDef) {
  return def.levels
    .slice(1)
    .filter((l) => Number.isFinite(l.from))
    .map((l) => ({ value: l.from, color: l.color }))
}
