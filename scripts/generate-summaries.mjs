#!/usr/bin/env node
/**
 * Genera con IA (Google Gemini) un resumen del tiempo de hoy para cada
 * localidad, a partir de la previsión de ECMWF IFS en Open-Meteo.
 *
 * Se ejecuta en la GitHub Action de despliegue, para que la clave de API
 * no llegue nunca al navegador. El resultado es un JSON estático que la web
 * lee junto al resto de archivos.
 *
 * Uso:
 *   GEMINI_API_KEY=… node scripts/generate-summaries.mjs <salida.json>
 *   node scripts/generate-summaries.mjs --dry-run      (muestra el prompt, sin llamar a Gemini)
 *
 * Variables de entorno:
 *   GEMINI_API_KEY  clave de Google AI Studio (obligatoria salvo en --dry-run)
 *   GEMINI_MODEL    modelo a usar (por defecto gemini-3.5-flash-lite)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { LOCATIONS } from '../src/data/locations.ts'

const DRY_RUN = process.argv.includes('--dry-run')
const OUTPUT = process.argv.slice(2).find((a) => !a.startsWith('--'))
const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const WEATHER_MODEL = 'ecmwf_ifs'
const TZ = 'Atlantic/Canary'

const HOURLY = [
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'cape',
]
const DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'wind_gusts_10m_max']
/** A partir de esta hora el resumen cubre «esta noche y mañana» */
const EVENING_HOUR = 18

/** Descripción breve de los códigos WMO, para que la IA no tenga que interpretarlos */
const WMO = {
  0: 'despejado', 1: 'poco nuboso', 2: 'nubes y claros', 3: 'cubierto', 45: 'niebla', 48: 'niebla',
  51: 'llovizna débil', 53: 'llovizna', 55: 'llovizna intensa', 61: 'lluvia débil', 63: 'lluvia',
  65: 'lluvia intensa', 80: 'chubascos débiles', 81: 'chubascos', 82: 'chubascos fuertes',
  95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta con granizo',
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
const dir = (deg) => DIRS[Math.round(deg / 45) % 8]
const r = (v, d = 0) => (v == null ? '?' : Number(v).toFixed(d))

function canaryNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    hour: Number(get('hour')),
  }
}

async function fetchWeather() {
  const params = new URLSearchParams({
    latitude: LOCATIONS.map((l) => l.lat).join(','),
    longitude: LOCATIONS.map((l) => l.lon).join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    models: WEATHER_MODEL,
    forecast_days: '2',
    timezone: TZ,
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

/** Periodo que cubre el resumen según la hora: lo que queda de hoy, o esta noche y mañana */
function periodFor(now) {
  const evening = now.hour >= EVENING_HOUR
  return {
    evening,
    label: evening ? 'esta noche y mañana' : 'hoy',
    // Desde la hora actual (redondeada a múltiplo de 3) hasta el final del periodo
    startHour: Math.floor(now.hour / 3) * 3,
    endHour: evening ? 48 : 24,
    days: evening ? [0, 1] : [0],
  }
}

/** Resumen compacto de los datos de una localidad, cada 3 horas, para el prompt */
function describeLocation(loc, d, period) {
  const h = d.hourly
  const lines = []
  for (let i = period.startHour; i < Math.min(period.endHour, h.time.length); i += 3) {
    const hour = `${i >= 24 ? 'mañana ' : ''}${h.time[i].slice(11, 16)}`
    lines.push(
      `${hour} ${r(h.temperature_2m[i])}°C, ${WMO[h.weather_code[i]] ?? `código ${h.weather_code[i]}`}, ` +
        `nubes ${r(h.cloud_cover[i])}%, lluvia ${r(h.precipitation[i], 1)} mm (prob. ${r(h.precipitation_probability[i])}%), ` +
        `viento ${r(h.wind_speed_10m[i])} km/h ${dir(h.wind_direction_10m[i])} rachas ${r(h.wind_gusts_10m[i])}, CAPE ${r(h.cape[i])}`,
    )
  }
  const day = d.daily
  return [
    `### ${loc.id} — ${loc.name} (${loc.island}), ${Math.round(d.elevation)} m`,
    ...period.days.map(
      (k) =>
        `${k === 0 ? 'Hoy' : 'Mañana'}: máx ${r(day.temperature_2m_max[k])}°C, mín ${r(day.temperature_2m_min[k])}°C, ` +
        `lluvia total ${r(day.precipitation_sum[k], 1)} mm, rachas máx ${r(day.wind_gusts_10m_max[k])} km/h`,
    ),
    ...lines,
  ].join('\n')
}

function buildPrompt(weather, now, period) {
  return [
    `Fecha: ${now.date}. Hora actual en Canarias: ${now.time}.`,
    `Haz el resumen para: ${period.label}.`,
    `Datos de previsión del modelo ECMWF IFS (vía Open-Meteo), cada 3 horas:`,
    '',
    ...LOCATIONS.map((loc, i) => describeLocation(loc, weather[i], period)),
  ].join('\n')
}

const SYSTEM = `Eres un meteorólogo que conoce bien el clima de las Islas Canarias (alisios, mar de nubes, calima, diferencias entre norte y sur, cumbres).
Escribe en español de España, con un tono cercano y claro para el público general, sin emojis.
Básate SOLO en los datos que se te dan: no inventes fenómenos, avisos ni cifras que no aparezcan.
Resume el periodo que se indica (lo que queda de hoy, o esta noche y mañana), a partir de la hora actual.
Menciona lo relevante: cielo, temperaturas, lluvia (cuándo y cuánta), viento y rachas si son notables (más de 40 km/h).
Si hay CAPE alto (más de 1000 J/kg) junto con lluvia o chubascos, avisa de posibles tormentas.
Para cada localidad: un titular de 3 a 7 palabras y un resumen de 2 o 3 frases.
Añade además un resumen general de Canarias de 2 o 3 frases que destaque las diferencias entre islas.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    general: { type: 'STRING' },
    localidades: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', enum: LOCATIONS.map((l) => l.id) },
          titular: { type: 'STRING' },
          resumen: { type: 'STRING' },
        },
        required: ['id', 'titular', 'resumen'],
      },
    },
  },
  required: ['general', 'localidades'],
}

async function askGemini(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`)
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new Error(`Gemini no devolvió texto: ${JSON.stringify(data).slice(0, 500)}`)
  return JSON.parse(text)
}

async function main() {
  const now = canaryNow()
  const period = periodFor(now)
  const weather = await fetchWeather()
  const prompt = buildPrompt(weather, now, period)

  if (DRY_RUN) {
    console.log(`--- Instrucciones ---\n${SYSTEM}\n\n--- Datos (${prompt.length} caracteres) ---\n${prompt}`)
    return
  }
  if (!API_KEY) {
    console.warn('GEMINI_API_KEY no definida: no se generan resúmenes.')
    return
  }
  if (!OUTPUT) throw new Error('Falta la ruta del archivo de salida')

  const result = await askGemini(prompt)
  const locations = {}
  for (const item of result.localidades ?? []) {
    if (LOCATIONS.some((l) => l.id === item.id)) locations[item.id] = { titular: item.titular, resumen: item.resumen }
  }
  const missing = LOCATIONS.filter((l) => !locations[l.id]).map((l) => l.id)
  if (missing.length) console.warn(`Sin resumen para: ${missing.join(', ')}`)

  const output = {
    generatedAt: new Date().toISOString(),
    date: now.date,
    period: period.label,
    aiModel: MODEL,
    weatherModel: 'ECMWF IFS',
    general: result.general,
    locations,
  }
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(output, null, 2))
  console.log(`Resúmenes de ${Object.keys(locations).length} localidades guardados en ${OUTPUT} (${MODEL})`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
