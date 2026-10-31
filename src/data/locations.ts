export interface Location {
  id: string
  name: string
  island: string
  lat: number
  lon: number
  /** Zoom mínimo al que aparece en el mapa (evita que los marcadores se tapen) */
  minZoom: number
}

export const LOCATIONS: Location[] = [
  // Tenerife
  { id: 'sc-tenerife', name: 'Santa Cruz de Tenerife', island: 'Tenerife', lat: 28.4636, lon: -16.2518, minZoom: 0 },
  { id: 'la-laguna', name: 'La Laguna', island: 'Tenerife', lat: 28.4874, lon: -16.3159, minZoom: 10 },
  { id: 'puerto-cruz', name: 'Puerto de la Cruz', island: 'Tenerife', lat: 28.4140, lon: -16.5449, minZoom: 9 },
  { id: 'los-cristianos', name: 'Los Cristianos', island: 'Tenerife', lat: 28.0510, lon: -16.7180, minZoom: 9 },
  { id: 'teide', name: 'Teide (Izaña)', island: 'Tenerife', lat: 28.3090, lon: -16.4994, minZoom: 9 },
  // Gran Canaria
  { id: 'las-palmas', name: 'Las Palmas de Gran Canaria', island: 'Gran Canaria', lat: 28.1235, lon: -15.4363, minZoom: 0 },
  { id: 'maspalomas', name: 'Maspalomas', island: 'Gran Canaria', lat: 27.7606, lon: -15.5860, minZoom: 9 },
  { id: 'tejeda', name: 'Tejeda', island: 'Gran Canaria', lat: 27.9950, lon: -15.6150, minZoom: 9 },
  // Lanzarote
  { id: 'arrecife', name: 'Arrecife', island: 'Lanzarote', lat: 28.9630, lon: -13.5477, minZoom: 0 },
  { id: 'la-graciosa', name: 'Caleta de Sebo', island: 'La Graciosa', lat: 29.2318, lon: -13.5036, minZoom: 9 },
  // Fuerteventura
  { id: 'puerto-rosario', name: 'Puerto del Rosario', island: 'Fuerteventura', lat: 28.5004, lon: -13.8627, minZoom: 0 },
  { id: 'corralejo', name: 'Corralejo', island: 'Fuerteventura', lat: 28.7310, lon: -13.8675, minZoom: 9 },
  { id: 'morro-jable', name: 'Morro Jable', island: 'Fuerteventura', lat: 28.0500, lon: -14.3550, minZoom: 9 },
  // La Gomera
  { id: 'san-sebastian', name: 'San Sebastián de La Gomera', island: 'La Gomera', lat: 28.0916, lon: -17.1133, minZoom: 0 },
  // La Palma
  { id: 'sc-palma', name: 'Santa Cruz de La Palma', island: 'La Palma', lat: 28.6835, lon: -17.7642, minZoom: 0 },
  { id: 'los-llanos', name: 'Los Llanos de Aridane', island: 'La Palma', lat: 28.6585, lon: -17.9182, minZoom: 9 },
  // El Hierro
  { id: 'valverde', name: 'Valverde', island: 'El Hierro', lat: 27.8090, lon: -17.9150, minZoom: 0 },
]

export const DEFAULT_LOCATION_ID = 'sc-tenerife'

/** Encuadre inicial para que se vean las ocho islas */
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [27.62, -18.2],
  [29.3, -13.4],
]

/**
 * Zona máxima del mapa: las islas más unos 100 km alrededor
 * (al este llega a rozar la costa africana). No se puede salir de ella.
 */
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [26.75, -19.25],
  [30.35, -12.35],
]
