/**
 * Configuración central: recursos, duraciones, textos y calidad.
 * Todo lo que un equipo de producción querría ajustar sin tocar la lógica vive aquí.
 */

const PARAMS = new URLSearchParams(location.search);

/** ?velocidad=4 acelera toda la experiencia (ensayos). ?escena=5 empieza en esa escena. ?sinsplat fuerza el bosque procedural. */
export const VELOCIDAD = Math.min(10, Math.max(0.25, parseFloat(PARAMS.get('velocidad')) || 1));
export const ESCENA_INICIAL = Math.min(8, Math.max(1, parseInt(PARAMS.get('escena'), 10) || 1));
export const DEPURAR = PARAMS.has('debug');
export const ES_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);

/* ------------------------------------------------------------------
   SISTEMA A · Gaussian Splat del bosque
   Se prueban las fuentes en orden. Si ninguna carga, la experiencia
   usa el bosque procedural (js/mundo/bosque.js) y sigue funcionando.
   ------------------------------------------------------------------ */
export const SPLAT_BOSQUE = {
  activo: !PARAMS.has('sinsplat'),
  fuentes: [
    // 1. Captura propia del bosque valdiviano (recomendado). Ver assets/splats/LEEME.md
    {url: 'assets/splats/bosque-valdiviano.spz', nombre: 'Bosque valdiviano (captura propia)'},
    // 2. Paisaje de valle público de los ejemplos de Spark (World Labs), útil para validar
    //    el render en el Quest mientras no exista la captura. No es un bosque valdiviano.
    {url: 'assets/splats/valley.spz', nombre: 'Valle de prueba (local)'},
    {url: 'https://sparkjs.dev/assets/splats/valley.spz', nombre: 'Valle de prueba (sparkjs.dev)'},
  ],
  // Transformación por defecto, igual a la del ejemplo WebXR de Spark para valley.spz.
  // Ajustar para cada captura (los .spz suelen venir con Y invertida: cuaternión (1,0,0,0)).
  escala: 0.5,
  posicion: [0, 0, 0],
  cuaternion: [1, 0, 0, 0],
  // Ancho de render de cada splat en desviaciones estándar: menor = más rápido en el Quest.
  maxStdDev: Math.sqrt(5),
  tiempoMaximoCarga: 30, // segundos antes de pasar al bosque procedural
};

/* ------------------------------------------------------------------
   SISTEMA B · Modelos GLB/GLTF opcionales
   Si url es null (o falla la carga) se usa la versión procedural.
   ------------------------------------------------------------------ */
export const MODELOS = {
  liquen: {url: null, escala: 1}, // talo folioso (p. ej. Pseudocyphellaria) · assets/modelos/liquen.glb
  roca: {url: null, escala: 1}, // roca basáltica · assets/modelos/roca.glb
};

/* ------------------------------------------------------------------
   Geometría de la escena (metros, espacio local-floor del Quest)
   ------------------------------------------------------------------ */
export const LUGAR = {
  rocaDistancia: 1.05, // distancia horizontal de la roca frente al visitante
  rocaRadio: 0.42,
  rocaAltura: 0.55, // altura de la cara superior, donde vive el liquen
  escalaMicro: 70, // aumento máximo del viaje de escala (escena 2)
};

/* ------------------------------------------------------------------
   Guion: ocho escenas
   duracion: segundos a velocidad 1. textos: [segundo, línea, opciones]
   'nota' = línea pequeña en tipografía mono que separa lo científico
   de lo artístico; se muestra en voz baja y desaparece.
   ------------------------------------------------------------------ */
export const ESCENAS = [
  {
    id: 1,
    nombre: 'Bosque presente',
    duracion: 62,
    textos: [[38, 'Algo pequeño guarda una memoria larga.']],
  },
  {
    id: 2,
    nombre: 'Transformación en liquen',
    duracion: 46,
    textos: [
      [8, 'Deja de medir el mundo con tu cuerpo.'],
      [26, 'Mi superficie es un paisaje.'],
    ],
  },
  {
    id: 3,
    nombre: 'Encuentro entre hongo y alga',
    duracion: 62,
    textos: [
      [10, 'Antes de ser paisaje, fui encuentro.'],
      [28, 'Una forma de habitar con otra.'],
      [44, 'Una alianza entre mundos distintos.'],
      [50, 'Hifas de un hongo (izquierda) y células de un alga verde (derecha). Representación artística.', {nota: true}],
    ],
  },
  {
    id: 4,
    nombre: 'Interacción celular',
    duracion: 52,
    textos: [
      [8, 'Ella convierte la luz en azúcar. Yo la envuelvo, guardo el agua y le traigo minerales.'],
      [
        24,
        'Hifas presionadas contra la pared celular (apresorios). El hongo recibe polioles, como el ribitol, que el alga produce al fotosintetizar. No todos los líquenes tienen esta anatomía.',
        {nota: true},
      ],
    ],
  },
  {
    id: 5,
    nombre: 'Colonización de la roca',
    duracion: 64,
    textos: [
      [10, 'Sobre la piedra aprendí la paciencia.'],
      [30, 'Cada siglo, un grano. Cada grano, un lugar para otros.'],
      [
        44,
        'Los líquenes ayudan a meteorizar la roca junto al agua, el clima y otros organismos. Formar suelo toma siglos o milenios; aquí el tiempo está condensado.',
        {nota: true},
      ],
    ],
  },
  {
    id: 6,
    nombre: 'Dispersión de la vida',
    duracion: 30, // tras la exhalación (o la espera) la respuesta dura esto
    esperaMaxima: 28, // sin interacción, la secuencia continúa sola
    textos: [[3, 'Si alguna vez fuiste comienzo, ¿cómo volverías a dispersar la vida?']],
    ayuda: 'Lleva una mano a la boca y ábrela hacia la roca · o mantén el gatillo',
  },
  {
    id: 7,
    nombre: 'Bosque maduro',
    duracion: 66,
    textos: [
      [12, 'Musgos. Helechos. Raíces. Nada llegó solo.'],
      [
        40,
        'Selva valdiviana costera: olivillo, arrayán, copihue, nalca. Viven aquí el chucao, la ranita de Darwin, el ciervo volante y el monito del monte.',
        {nota: true},
      ],
    ],
  },
  {
    id: 8,
    nombre: 'Red ecológica',
    duracion: 70, // después la escena queda abierta para observar
    textos: [
      [14, 'No fui solo una forma sobre la roca.'],
      [24, 'Fui tiempo, encuentro y transformación.'],
      [36, 'Y tú, por un instante, también habitaste esta red.'],
      [50, 'Los filamentos son una metáfora de la interdependencia, no un mapa de conexiones reales.', {nota: true}],
    ],
  },
];

/* ------------------------------------------------------------------
   Rendimiento
   ------------------------------------------------------------------ */
export const CALIDAD = {
  fpsMinimo: 66, // si la media cae bajo esto durante 6 s seguidos, se recorta lo decorativo
  // 72 Hz es la frecuencia nativa del navegador del Quest: más margen por cuadro y menos riesgo de tirones.
  // ?hz=90 la sube si el visor la ofrece.
  frecuenciaPreferida: parseInt(PARAMS.get('hz'), 10) || 72,
  particulas: 900,
  particulasBaja: 400,
};
