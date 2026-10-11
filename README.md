# Memoria de un liquen

Experiencia WebXR para el navegador de **Meta Quest 3**, hecha con **XR Blocks 0.22** sobre three.js 0.186,
con **Spark 2.1** para los Gaussian Splats. Se abre desde una URL; no hay que instalar nada ni conceder permisos.

Ocho escenas continuas: el bosque valdiviano presente → convertirse en liquen (viaje de escala ×70) →
encuentro entre hongo y alga → intimidad celular → de la célula a la roca → soplar para dispersar la vida →
el bosque maduro → la red invisible.

## Ejecutar

Es un sitio estático (módulos ES + import map, sin compilación).

```bash
# en esta carpeta
npx http-server -p 8080        # o: python3 -m http.server 8080
```

- **Computador:** abre `http://localhost:8080` → “Ver en el navegador” (simulador de XR Blocks).
- **Meta Quest 3:** WebXR exige HTTPS. Publica la carpeta tal cual (GitHub Pages, Netlify, Vercel) o
  expón el servidor local con un túnel HTTPS. En el Quest, abre la URL y pulsa “Entrar en VR”.

Parámetros de URL para ensayo: `?escena=5` (empezar en una escena), `?velocidad=4` (acelerar),
`?sinsplat` (forzar el bosque procedural), `?debug` (registro en consola y `window.memoria`).

## Controles

| Acción | Quest (controles) | Quest (manos) | Navegador |
| --- | --- | --- | --- |
| Soplar (escena 6) | Mano a la boca y abrirla hacia la roca · o mantener gatillo | Mano a la boca y abrirla · o mantener pellizco | Mantener clic · tecla B |
| Línea de tiempo (pausa) | Botón lateral (grip) | Pellizco largo (1,3 s) | T o Espacio |
| Saltar a un capítulo | Mirar/apuntar un punto + gatillo | Mirar un punto + pellizco | Teclas 1–8 |
| Pulsos en la red (escena 8) | Mover las manos rápido · gatillo | Igual | Clic |

Nada es obligatorio: sin interacción, la escena 6 continúa sola a los 28 s y la línea de tiempo se
cierra sola a los 12 s. Abrir el menú del sistema del visor pausa la experiencia.

## Estructura

```
index.html              portada ligera + import map con versiones fijadas
css/estilo.css          portada
js/main.js              opciones de XR Blocks, carga del bosque inicial, entrada
js/config.js            recursos, duraciones, textos de las 8 escenas, calidad  ← se edita aquí
js/nucleo/              utilidades, ruido horneado en textura, sonido procedural (5 capas)
js/sistemas/            A splats (Spark) · B modelos GLB opcionales · subtítulos · línea de tiempo · soplido
js/mundo/               materiales, paisaje y roca, talo del liquen, microcosmos, bosque, fauna, red, partículas
js/escenas/             director (máquina de estados) + 01…08, una escena por archivo
assets/splats/          aquí va el Gaussian Splat del bosque (ver LEEME.md)
assets/modelos/         GLB opcionales del liquen y la roca (ver LEEME.md)
```

Cada escena es una función del tiempo que escribe `mundo.estado` (zoom, atmósfera, crecimiento,
red…). `js/mundo/mundo.js` traduce ese estado a objetos y uniforms. El final de cada escena coincide con
el inicio de la siguiente, así que el recorrido no tiene cortes; los saltos de la línea de tiempo pasan
por un fundido de 2 s.

## Qué se verificó y qué es alternativa

Verificado en el código fuente de XR Blocks 0.22 (`github.com/google/xrblocks`):

| Necesidad | Estado | Cómo se resolvió |
| --- | --- | --- |
| Gaussian Splats | **No es nativo de XR Blocks**: lo trae **Spark** | Patrón de la muestra oficial `samples/xr_realism/3dgs_walkthrough`: `SplatMesh` + `SparkRenderer` registrado con `xb.SparkRendererHolder`, fundidos con `mesh.opacity` |
| Deformar un splat o volverlo malla | No disponible | La metamorfosis se simula: escala del mundo, opacidad, `recolor` de Spark y capas procedurales encima |
| GLB/GLTF | Sí (GLTFLoader de three, el mismo de XR Blocks) | `js/sistemas/modelos.js`, con respaldo procedural |
| Scripts y shaders propios | Sí (`xb.Script` + `THREE.ShaderMaterial`) | Todos los materiales del mundo son shaders ligeros con ruido horneado |
| Partículas | XR Blocks no trae un sistema | `THREE.Points` con el movimiento en el vertex shader |
| Audio espacial | Se usa Web Audio directamente | `PannerNode` HRTF; el contexto se crea con el primer toque |
| Manos y controles | Sí (`options.enableHands()`, `onSelectStart/End`, `onSqueezeStart`) | Pellizco = gatillo; grip para la línea de tiempo |
| Soplido | Quest 3 no tiene sensor de exhalación; el micrófono requeriría permiso | Gesto mano‑boca‑afuera, gatillo mantenido o espera |
| Estados y navegación | Se programan en un `xb.Script` | `js/escenas/director.js` |
| Publicación | Sitio estático con import map | Cualquier hosting HTTPS |

## Pendiente de probar en el visor

Este código se probó en Chromium de escritorio (simulador de XR Blocks, render por software): las ocho
escenas, los saltos, la pausa y la continuación automática funcionan sin errores. **No se ha medido en un
Quest 3** ni con un splat real cargado. Antes de exhibir:

1. Tasa de cuadros por escena con el splat definitivo (meta: 72 Hz; se pide 90 Hz si el visor lo ofrece).
   Si la media de los primeros 6 s cae bajo 66 FPS, se recortan helechos, esporas y el ancho de los splats.
2. Memoria al cargar y sacar el splat de escena (escenas 2→5 y 7).
3. Que el suelo del splat coincida con la roca (`SPLAT_BOSQUE.posicion`).
4. Comodidad del viaje de escala (escena 2) con personas sensibles al mareo.
5. El gesto de soplido con manos y con controles, de pie y sentado.

Los presupuestos de rendimiento son **estimaciones**: ~600 k splats para el bosque, <20 k triángulos por
GLB, <1 000 partículas simultáneas, un solo entorno pesado activo a la vez.

## Ciencia y metáfora

- Se representa un liquen folioso con fotobionte de alga verde trebouxioide. Muchos líquenes del bosque
  valdiviano (*Pseudocyphellaria*, *Sticta*) usan cianobacterias; las notas en pantalla lo aclaran como representación artística.
- Los apresorios no se muestran como universales; el intercambio (polioles como el ribitol) se dibuja como flujo de luz.
- La formación de suelo se muestra como un proceso condensado en el que participan agua, clima y otros organismos.
- La red final es una metáfora de la interdependencia, no un mapa de conexiones reales.
- Especies elegidas para la selva valdiviana costera: olivillo, arrayán, copihue, nalca, chucao, ranita de Darwin,
  ciervo volante, monito del monte. El alerce costero se dejó fuera por su distribución en altura.
