import { GRID, GRID_COLS, GRID_ROWS, type PrecipGrid } from '../api/precipGrid'

/** Píxeles por celda de la rejilla: la interpolación bilineal suaviza el resultado */
const SCALE = 10
/** Celdas sobre las que se difumina el borde de la rejilla para que no se vea el rectángulo */
const EDGE_FADE = 2

/**
 * Escala de color en mm/h, imitando el esquema «Universal Blue» de RainViewer
 * para que radar y previsión se lean igual.
 */
const STOPS: [mm: number, r: number, g: number, b: number, a: number][] = [
  [0.1, 230, 220, 180, 0.45],
  [0.5, 128, 208, 224, 0.75],
  [2, 16, 160, 224, 0.85],
  [5, 0, 112, 160, 0.92],
  [10, 0, 64, 112, 1],
]

function colorFor(mm: number): [number, number, number, number] {
  if (mm < STOPS[0][0]) return [0, 0, 0, 0]
  for (let i = 1; i < STOPS.length; i++) {
    const [m1, r1, g1, b1, a1] = STOPS[i]
    if (mm < m1) {
      const [m0, r0, g0, b0, a0] = STOPS[i - 1]
      const f = (mm - m0) / (m1 - m0)
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, (a0 + (a1 - a0) * f) * 255]
    }
  }
  const [, r, g, b, a] = STOPS[STOPS.length - 1]
  return [r, g, b, a * 255]
}

/** Límites geográficos de la imagen (coinciden con los puntos extremos de la rejilla) */
export const PRECIP_BOUNDS: [[number, number], [number, number]] = [
  [GRID.latMin, GRID.lonMin],
  [GRID.latMax, GRID.lonMax],
]

const imageCache = new WeakMap<Float32Array, string>()

/** Dibuja un instante de la rejilla como imagen PNG (data URL) interpolada */
export function renderPrecipFrame(grid: PrecipGrid, timeIndex: number): string {
  const values = grid.values[timeIndex]
  const cached = imageCache.get(values)
  if (cached) return cached

  const w = (GRID_COLS - 1) * SCALE
  const h = (GRID_ROWS - 1) * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const at = (r: number, c: number) => values[r * GRID_COLS + c]

  for (let py = 0; py < h; py++) {
    // La fila 0 de la imagen es el norte; la fila 0 de la rejilla es el sur
    const gy = (h - 1 - py) / SCALE
    const r0 = Math.min(Math.floor(gy), GRID_ROWS - 2)
    const fy = gy - r0
    for (let px = 0; px < w; px++) {
      const gx = px / SCALE
      const c0 = Math.min(Math.floor(gx), GRID_COLS - 2)
      const fx = gx - c0
      const v =
        at(r0, c0) * (1 - fx) * (1 - fy) +
        at(r0, c0 + 1) * fx * (1 - fy) +
        at(r0 + 1, c0) * (1 - fx) * fy +
        at(r0 + 1, c0 + 1) * fx * fy
      const [r, g, b, a] = colorFor(v)
      const edge = Math.min(gx, gy, GRID_COLS - 1 - gx, GRID_ROWS - 1 - gy)
      const fade = Math.min(1, edge / EDGE_FADE)
      const o = (py * w + px) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = a * fade * fade
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL()
  imageCache.set(values, url)
  return url
}
