import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** smoothstep entre a y b */
export const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Campana: sube entre a-b, se mantiene, baja entre c-d */
export const ventana = (a, b, c, d, x) => suave(a, b, x) * (1 - suave(c, d, x));
export const easeInOut = (x) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;

// Aleatorio determinista: el bosque es siempre el mismo
let semilla = 7;
export const rnd = () => {
  semilla = (semilla * 16807) % 2147483647;
  return (semilla - 1) / 2147483646;
};
export const rr = (a, b) => a + (b - a) * rnd();
export const sembrar = (s) => {
  semilla = s;
};

// Temporales reutilizables (sin basura por cuadro)
export const T = {
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  e: new THREE.Euler(),
  m: new THREE.Matrix4(),
  s: new THREE.Vector3(),
  c: new THREE.Color(),
};

/** Textura radial para halos y destellos */
export function texturaBrillo(r = 255, g = 255, b = 255) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.25, `rgba(${r},${g},${b},0.35)`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sprite(rgb, escala, opacidad = 1) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texturaBrillo(...rgb),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: opacidad,
      fog: false,
    })
  );
  s.scale.setScalar(escala);
  return s;
}

/** Vibración de los controles (Gamepad haptics, sin permisos) */
export function vibrar(xb, intensidad = 0.4, ms = 60) {
  const sesion = xb.core.renderer?.xr?.getSession?.();
  if (!sesion) return;
  for (const src of sesion.inputSources) {
    const act = src.gamepad?.hapticActuators?.[0];
    if (act?.pulse) {
      try {
        act.pulse(clamp(intensidad), ms);
      } catch (e) {
        /* algunos controles no vibran */
      }
    }
  }
}

/** Desactiva el raycast de todo un subárbol: el gesto es global y así no hay raycasts por cuadro. */
export function sinRaycast(obj) {
  obj.traverse((o) => {
    o.raycast = () => {};
  });
}
