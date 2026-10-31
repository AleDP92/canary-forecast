# canary-forecast

Web que muestra la previsión del tiempo en tiempo real sobre las Islas Canarias, con varios modelos meteorológicos que se pueden cambiar y comparar.

## Funcionalidades

- **Mapa de Canarias**, limitado a las islas más unos 100 km alrededor (no se puede alejar ni desplazar fuera), con la temperatura y el estado del cielo actuales en 16 localidades. Al acercar el mapa aparecen más puntos.
- **Selector de modelos**: ECMWF IFS, ECMWF AIFS, ICON, ARPEGE, UKMO, GFS, GEM y JMA.
- **Selector de zona** en la cabecera del panel derecho (también se puede elegir pulsando en el mapa).
- **Resumen con IA** (Google Gemini) del tiempo de hoy, o de esta noche y mañana si es por la tarde, para cada localidad y para toda Canarias. Ver [Resumen con IA](#resumen-con-ia).
- **Panel de detalle** con las condiciones actuales, una gráfica de 48 horas (temperatura y precipitación) y la previsión de 7 días.
- **Modo comparar**: superpone en la misma gráfica la temperatura de todos los modelos e indica cuánto coinciden entre sí.
- **Capas en el mapa**, activables por separado y combinables (al abrir no hay ninguna activa), con una línea de tiempo común de 48 h:
  - 🌧️ **Lluvia**: las últimas 2 horas de radar real (RainViewer, con datos de los radares de AEMET) y, a continuación, la precipitación prevista por el modelo.
  - ⚡ **CAPE**: energía disponible para la convección.
  - 💨 **Viento**: flechas de dirección coloreadas por fuerza (verde flojo, amarillo moderado, rojo fuerte), según el viento medio o las rachas.
  - **Datos de un punto**: al pasar el ratón o tocar el mapa se muestran la lluvia, el CAPE, el viento y las rachas de ese lugar en la hora elegida.
  - Con alguna capa activa el mapa base pasa a gris para que los colores contrasten.
  - Al activar o quitar capas, o al cambiar de modelo, se mantiene la hora elegida.
- Se actualiza sola (el mapa cada 10 min, la previsión cada 30 min).
- El enlace guarda el modelo y la localidad elegidos (`?modelo=gfs_seamless&lugar=las-palmas`), así que se puede compartir. Las capas del mapa no se guardan: siempre se abre sin ninguna.

## Fuentes de datos

- [Open-Meteo](https://open-meteo.com/) para los modelos: gratuita, sin clave de API, licencia CC BY 4.0.
- [RainViewer](https://www.rainviewer.com/api.html) para el radar: gratuita. Solo ofrece las últimas ~2 h, sin predicción, con zoom nativo máximo 7 (a más zoom la imagen se amplía).
- Las capas de previsión salen de una rejilla de 312 puntos (cada 0,3°, cubriendo toda la zona del mapa) de Open-Meteo, interpolada y difuminada en los bordes. Open-Meteo cuenta cada punto como una llamada (límite ~600/min por usuario), pero no cada variable, así que lluvia, CAPE y viento se piden juntos. La rejilla se guarda 15 min en memoria y solo se pide al activar una capa. ECMWF AIFS y JMA no ofrecen CAPE.

### Índices por modelo

El Índice K y el Total Totals se calculan con temperaturas y puntos de rocío a 850, 700 y 500 hPa. ECMWF IFS (9 km) no publica niveles de presión en Open-Meteo, así que para esos índices se usa ECMWF IFS a 25 km. El CIN se muestra en valor absoluto porque cada modelo usa un signo distinto.

| Índice | Modelos |
|---|---|
| CAPE | IFS, ICON, ARPEGE, UKMO, GFS, GEM |
| CIN | IFS, ICON, UKMO, GFS |
| Lifted Index | GFS |
| Isocero | ICON, GFS |
| K, TT, T500 | todos |

HARMONIE-AROME (AEMET) y AROME (Météo-France), los modelos de mayor resolución para la zona, **no están disponibles para Canarias en Open-Meteo**. Para añadirlos habría que usar AEMET OpenData, que requiere una clave de API.

## Resumen con IA

Los resúmenes **no se generan en el navegador**, para no exponer la clave de API. Los crea [`scripts/generate-summaries.mjs`](scripts/generate-summaries.mjs) en la GitHub Action de despliegue:

1. Descarga de Open-Meteo la previsión de ECMWF IFS para las 16 localidades (una sola petición).
2. Hace **una sola llamada** a Gemini con todos los datos y pide la respuesta en JSON.
3. Guarda el resultado en `dist/data/resumenes.json`, que se publica con la web.

La Action se ejecuta en cada push a `main` y además a las 06:30, 12:30 y 18:30 UTC, para que el resumen esté al día. La web solo lo muestra si es del día de hoy; si no hay clave o la llamada falla, se publica igual sin resumen.

**Para activarlo:**

1. Crea una clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey).
2. Añádela al repo como secreto `GEMINI_API_KEY` (Settings → Secrets and variables → Actions), o con `gh secret set GEMINI_API_KEY`.
3. Opcional: crea la variable de repo `GEMINI_MODEL` para usar otro modelo (por defecto `gemini-3.5-flash-lite`).

Para probarlo en local: `node scripts/generate-summaries.mjs --dry-run` muestra el prompt sin llamar a Gemini, y `GEMINI_API_KEY=… node scripts/generate-summaries.mjs public/data/resumenes.json` genera el archivo para `npm run dev`.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev      # servidor local en http://localhost:5173
npm run build    # compilación de producción en dist/
npm run lint
```

## Despliegue

Cada push a `main` publica la web en GitHub Pages mediante `.github/workflows/deploy.yml`. La primera vez hay que activarlo en **Settings → Pages → Source: GitHub Actions**.

## Estructura

```
src/
  api/openMeteo.ts        peticiones a Open-Meteo
  hooks/useAiSummaries.ts resúmenes con IA publicados por la Action
scripts/
  generate-summaries.mjs  genera los resúmenes con Gemini (se ejecuta en la Action)
  data/models.ts          lista de modelos (añadir o quitar aquí)
  data/locations.ts       localidades del mapa
  data/weatherCodes.ts    códigos WMO → texto e icono
  data/indices.ts         índices de convección: fórmulas y umbrales
  data/mapLayers.ts       capas del mapa: variable, escala de color y leyenda
  api/modelGrid.ts        rejilla de previsión para las capas
  utils/gridImage.ts      interpolación y pintado de la rejilla
  hooks/useWeather.ts     carga y refresco automático de datos
  hooks/useMapLayer.ts    línea de tiempo y animación de las capas
  components/             mapa, selector, panel y gráfica
```
