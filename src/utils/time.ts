const TZ = 'Atlantic/Canary'

/** Hora actual en Canarias con el formato de Open-Meteo: "YYYY-MM-DDTHH:00" */
export function canaryHourNow(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`
}

/** Índice de la primera hora >= la hora actual de Canarias */
export function currentHourIndex(times: string[]): number {
  const now = canaryHourNow()
  const i = times.findIndex((t) => t >= now)
  return i === -1 ? 0 : i
}

// Las fechas de Open-Meteo ya están en hora de Canarias; se tratan como UTC
// para formatearlas sin que la zona horaria del navegador las desplace.
function asUtc(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00Z` : `${iso}Z`)
}

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const hourFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const weekdayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' })

export const formatDay = (iso: string) => dayFmt.format(asUtc(iso))
export const formatHour = (iso: string) => hourFmt.format(asUtc(iso))
export const formatWeekday = (iso: string) => weekdayFmt.format(asUtc(iso))

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}
