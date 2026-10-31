import { GRID, GRID_COLS, GRID_ROWS } from '../api/modelGrid'
import { colorFor, type FillLayer } from '../data/mapLayers'

/** Píxeles por celda de la rejilla: la interpolación bilineal suaviza el resultado */
const SCALE = 10
/** Celdas sobre las que se difumina el borde de la rejilla para que no se vea el rectángulo */
const EDGE_FADE = 2

const smoothstep = (x: number) => (x >= 1 ? 1 : x <= 0 ? 0 : x * x * (3 - 2 * x))

/** Límites geográficos de la imagen (coinciden con los puntos extremos de la rejilla) */
export const GRID_BOUNDS: [[number, number], [number, number]] = [
  [GRID.latMin, GRID.lonMin],
  [GRID.latMax, GRID.lonMax],
]

/** Caché por array de valores y capa (el mismo array puede pintarse con escalas distintas) */
const imageCache = new WeakMap<Float32Array, Map<string, string>>()

/** Dibuja un instante de una variable de la rejilla como imagen PNG (data URL) interpolada */
export function renderGridFrame(values: Float32Array, layer: FillLayer): string {
  let perLayer = imageCache.get(values)
  const cached = perLayer?.get(layer.id)
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
      const [r, g, b, a] = colorFor(layer.stops, v)
      // Difuminado por separado en cada eje: bordes suaves y esquinas redondeadas
      const fade =
        smoothstep(Math.min(gx, GRID_COLS - 1 - gx) / EDGE_FADE) *
        smoothstep(Math.min(gy, GRID_ROWS - 1 - gy) / EDGE_FADE)
      const o = (py * w + px) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = a * fade
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL()
  if (!perLayer) imageCache.set(values, (perLayer = new Map()))
  perLayer.set(layer.id, url)
  return url
}
