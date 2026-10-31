/** Códigos meteorológicos WMO que devuelve Open-Meteo */
const CODES: Record<number, { label: string; day: string; night: string }> = {
  0: { label: 'Despejado', day: '☀️', night: '🌙' },
  1: { label: 'Mayormente despejado', day: '🌤️', night: '🌙' },
  2: { label: 'Parcialmente nuboso', day: '⛅', night: '☁️' },
  3: { label: 'Nublado', day: '☁️', night: '☁️' },
  45: { label: 'Niebla', day: '🌫️', night: '🌫️' },
  48: { label: 'Niebla con escarcha', day: '🌫️', night: '🌫️' },
  51: { label: 'Llovizna débil', day: '🌦️', night: '🌧️' },
  53: { label: 'Llovizna', day: '🌦️', night: '🌧️' },
  55: { label: 'Llovizna intensa', day: '🌧️', night: '🌧️' },
  56: { label: 'Llovizna helada', day: '🌧️', night: '🌧️' },
  57: { label: 'Llovizna helada intensa', day: '🌧️', night: '🌧️' },
  61: { label: 'Lluvia débil', day: '🌦️', night: '🌧️' },
  63: { label: 'Lluvia', day: '🌧️', night: '🌧️' },
  65: { label: 'Lluvia intensa', day: '🌧️', night: '🌧️' },
  66: { label: 'Lluvia helada', day: '🌧️', night: '🌧️' },
  67: { label: 'Lluvia helada intensa', day: '🌧️', night: '🌧️' },
  71: { label: 'Nevada débil', day: '🌨️', night: '🌨️' },
  73: { label: 'Nevada', day: '🌨️', night: '🌨️' },
  75: { label: 'Nevada intensa', day: '❄️', night: '❄️' },
  77: { label: 'Granos de nieve', day: '🌨️', night: '🌨️' },
  80: { label: 'Chubascos débiles', day: '🌦️', night: '🌧️' },
  81: { label: 'Chubascos', day: '🌧️', night: '🌧️' },
  82: { label: 'Chubascos fuertes', day: '⛈️', night: '⛈️' },
  85: { label: 'Chubascos de nieve', day: '🌨️', night: '🌨️' },
  86: { label: 'Chubascos de nieve fuertes', day: '❄️', night: '❄️' },
  95: { label: 'Tormenta', day: '⛈️', night: '⛈️' },
  96: { label: 'Tormenta con granizo', day: '⛈️', night: '⛈️' },
  99: { label: 'Tormenta con granizo fuerte', day: '⛈️', night: '⛈️' },
}

export function describeWeather(code: number | null | undefined, isDay = true) {
  const entry = code == null ? undefined : CODES[code]
  if (!entry) return { label: 'Sin datos', icon: '–' }
  return { label: entry.label, icon: isDay ? entry.day : entry.night }
}

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export function windDirection(deg: number | null | undefined): string {
  if (deg == null) return '–'
  return DIRECTIONS[Math.round(deg / 45) % 8]
}
