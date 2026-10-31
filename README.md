# canary-forecast

Web que muestra la previsión del tiempo en tiempo real sobre las Islas Canarias, con varios modelos meteorológicos que se pueden cambiar y comparar.

## Funcionalidades

- **Mapa de las islas** con la temperatura y el estado del cielo actuales en 16 localidades. Al acercar el mapa aparecen más puntos.
- **Selector de modelos**: ECMWF IFS, ECMWF AIFS, ICON, ARPEGE, UKMO, GFS, GEM y JMA.
- **Panel de detalle** con las condiciones actuales, una gráfica de 48 horas (temperatura y precipitación) y la previsión de 7 días.
- **Modo comparar**: superpone en la misma gráfica la temperatura de todos los modelos e indica cuánto coinciden entre sí.
- Se actualiza sola (el mapa cada 10 min, la previsión cada 30 min).
- El enlace guarda el modelo y la localidad elegidos (`?modelo=gfs_seamless&lugar=las-palmas`), así que se puede compartir.

## Fuente de datos

[Open-Meteo](https://open-meteo.com/): gratuita, sin clave de API, licencia CC BY 4.0.

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
  hooks/useWeather.ts     carga y refresco automático de datos
  components/             mapa, selector, panel y gráfica
```
