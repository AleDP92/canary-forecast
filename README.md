# canary-forecast

Web que muestra la previsión del tiempo en tiempo real sobre las Islas Canarias, con varios modelos meteorológicos que se pueden cambiar y comparar.

## Funcionalidades

- **Mapa de las islas** con la temperatura y el estado del cielo actuales en 16 localidades. Al acercar el mapa aparecen más puntos.
- **Selector de modelos**: ECMWF IFS, ECMWF AIFS, ICON, ARPEGE, UKMO, GFS, GEM y JMA.
- **Panel de detalle** con las condiciones actuales, una gráfica de 48 horas (temperatura y precipitación) y la previsión de 7 días.
- **Modo comparar**: superpone en la misma gráfica la temperatura de todos los modelos e indica cuánto coinciden entre sí.
- **Capas animadas en el mapa** con línea de tiempo de 48 h:
  - 🌧️ **Lluvia**: las últimas 2 horas de radar real (RainViewer, con datos de los radares de AEMET) y, a continuación, la precipitación prevista por el modelo.
  - ⚡ **CAPE**: energía disponible para la convección.
  - 💨 **Viento**: viento medio o rachas.
  - **Flechas de viento** sobre cualquier capa, de color según la fuerza (verde flojo, amarillo moderado, rojo fuerte).
  - **Datos de un punto**: al pasar el ratón o tocar el mapa se muestran la lluvia, el CAPE, el viento y las rachas de ese lugar en la hora elegida.
  - Con una capa activa el mapa base pasa a gris para que los colores contrasten.
  - Al cambiar de capa o de modelo se mantiene la hora elegida.
- **Pestaña Convección** con CAPE, CIN, Índice K, Total Totals, Lifted Index, temperatura a 500 hPa (detección de DANA) e isocero. Muestra el valor más desfavorable, su nivel de riesgo y una gráfica con umbrales, comparable entre modelos.
- Se actualiza sola (el mapa cada 10 min, la previsión cada 30 min).
- El enlace guarda el modelo y la localidad elegidos (`?modelo=gfs_seamless&lugar=las-palmas`), así que se puede compartir.

## Fuentes de datos

- [Open-Meteo](https://open-meteo.com/) para los modelos: gratuita, sin clave de API, licencia CC BY 4.0.
- [RainViewer](https://www.rainviewer.com/api.html) para el radar: gratuita. Solo ofrece las últimas ~2 h, sin predicción, con zoom nativo máximo 7 (a más zoom la imagen se amplía).
- Las capas de previsión salen de una rejilla de 207 puntos (cada 0,25°) de Open-Meteo, interpolada y difuminada en los bordes. Open-Meteo cuenta cada punto como una llamada (límite ~600/min por usuario), pero no cada variable, así que lluvia, CAPE y viento se piden juntos. La rejilla se guarda 15 min en memoria y solo se pide al activar una capa. ECMWF AIFS y JMA no ofrecen CAPE.

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
