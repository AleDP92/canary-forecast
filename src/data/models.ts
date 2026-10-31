export interface WeatherModel {
  /** Identificador del modelo en la API de Open-Meteo */
  id: string
  name: string
  provider: string
  /** Resolución aproximada sobre Canarias */
  resolution: string
  description: string
  color: string
}

/**
 * Modelos verificados con datos sobre Canarias en Open-Meteo.
 * HARMONIE-AROME de AEMET y AROME de Météo-France no están disponibles
 * para esta zona en Open-Meteo.
 */
export const MODELS: WeatherModel[] = [
  {
    id: 'ecmwf_ifs',
    name: 'ECMWF IFS',
    provider: 'Centro Europeo (ECMWF)',
    resolution: '9 km',
    description: 'El modelo global de referencia. Muy fiable a medio plazo.',
    color: '#2563eb',
  },
  {
    id: 'ecmwf_aifs025_single',
    name: 'ECMWF AIFS',
    provider: 'Centro Europeo (ECMWF)',
    resolution: '25 km',
    description: 'Modelo basado en inteligencia artificial del ECMWF.',
    color: '#7c3aed',
  },
  {
    id: 'icon_seamless',
    name: 'ICON',
    provider: 'Servicio Alemán (DWD)',
    resolution: '7–13 km',
    description: 'Combina ICON-EU (7 km), que cubre Canarias, con ICON global.',
    color: '#059669',
  },
  {
    id: 'meteofrance_seamless',
    name: 'ARPEGE',
    provider: 'Météo-France',
    resolution: '~10 km',
    description: 'Modelo global francés con mayor resolución sobre Europa y el Atlántico.',
    color: '#db2777',
  },
  {
    id: 'ukmo_seamless',
    name: 'UKMO',
    provider: 'Met Office (Reino Unido)',
    resolution: '10 km',
    description: 'Modelo global del servicio meteorológico británico.',
    color: '#ea580c',
  },
  {
    id: 'gfs_seamless',
    name: 'GFS',
    provider: 'NOAA (EE. UU.)',
    resolution: '13–25 km',
    description: 'Modelo global estadounidense, se actualiza cada 6 horas.',
    color: '#0891b2',
  },
  {
    id: 'gem_seamless',
    name: 'GEM',
    provider: 'Servicio Canadiense (ECCC)',
    resolution: '15–25 km',
    description: 'Modelo global canadiense.',
    color: '#65a30d',
  },
  {
    id: 'jma_seamless',
    name: 'JMA',
    provider: 'Agencia Japonesa (JMA)',
    resolution: '~20 km',
    description: 'Modelo global japonés.',
    color: '#a16207',
  },
]

export const DEFAULT_MODEL_ID = 'ecmwf_ifs'

export function getModel(id: string): WeatherModel {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}
