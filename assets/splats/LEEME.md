# Gaussian Splats del bosque

La experiencia busca estos archivos en orden (ver `js/config.js → SPLAT_BOSQUE.fuentes`):

1. `bosque-valdiviano.spz` — **la captura propia del bosque** (recomendado).
2. `valley.spz` — paisaje de prueba de los ejemplos de Spark, descargado aquí.
3. `https://sparkjs.dev/assets/splats/valley.spz` — el mismo, en remoto (puede fallar por CORS).

Si ninguno carga, se usa el bosque procedural y la experiencia funciona igual.

## Paisaje de prueba (para validar el render en el Quest hoy)

Descarga `https://sparkjs.dev/assets/splats/valley.spz` y guárdalo aquí como `valley.spz`.
Es el que usa el ejemplo WebXR oficial de Spark. **No es un bosque valdiviano**; sirve sólo para
probar rendimiento y transiciones. El repositorio de Spark es MIT, pero el archivo no declara
licencia propia: confírmala antes de una exhibición pública.

## Captura propia (lo que pide el proyecto)

1. **Capturar** un claro del bosque con una roca con líquenes al centro: Polycam, Luma, Scaniverse,
   KIRI o fotogrametría propia + entrenamiento 3DGS (Postshot, Nerfstudio/gsplat).
   Recorre el claro en círculos a dos alturas, con luz difusa (día nublado: típico del bosque valdiviano).
2. **Limpiar y recortar** en SuperSplat (playcanvas.com/supersplat): borra flotantes y el cielo,
   centra el claro en el origen con la roca ~1 m hacia −Z.
3. **Reducir**: para WebXR, Spark recomienda del orden de 500 000–750 000 splats.
4. **Exportar** a `.spz` (SuperSplat lo exporta; también la herramienta de compresión de Spark).
5. Guardar como `bosque-valdiviano.spz` y ajustar en `js/config.js`:
   `escala`, `posicion` (subir o bajar para que el suelo del splat coincida con el piso real)
   y `cuaternion` (muchos .spz vienen con Y invertida: `[1, 0, 0, 0]`).

Alternativa generativa: World Labs Marble genera mundos desde imagen o texto y exporta splats SPZ
(requiere su plan pagado). Útil para bocetos; para el proyecto final se recomienda captura real.
