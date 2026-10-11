import * as THREE from 'three';
import {clamp} from './utilidades.js';

/**
 * Ruido horneado una sola vez en una textura RGBA que se repite.
 * Los shaders la muestrean en vez de calcular fbm por píxel (gran ahorro en la GPU del Quest).
 * R: fbm base · G: fbm fino (manchas de liquen) · B: cresta |fbm-0.5| (grietas, venas) · A: fbm grave (musgo)
 */
export function texturaRuido(N = 256) {
  const tabla = (P, s) => {
    const t = new Float32Array(P * P);
    let x = s;
    for (let i = 0; i < t.length; i++) {
      x = (x * 16807) % 2147483647;
      t[i] = (x - 1) / 2147483646;
    }
    return t;
  };
  const vnoise = (u, v, P, t) => {
    const x = u * P;
    const y = v * P;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % P) + P) % P;
    const y0 = ((yi % P) + P) % P;
    const x1 = (x0 + 1) % P;
    const y1 = (y0 + 1) % P;
    const a = t[y0 * P + x0];
    const b = t[y0 * P + x1];
    const c = t[y1 * P + x0];
    const d = t[y1 * P + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (u, v, P0, s) => {
    let a = 0.5;
    let sum = 0;
    let P = P0;
    for (let o = 0; o < 5; o++) {
      sum += a * vnoise(u, v, P, s[o]);
      P *= 2;
      a *= 0.5;
    }
    return sum / 0.97;
  };
  const capas = [11, 23, 37, 51].map((b) => [0, 1, 2, 3, 4].map((o) => tabla(4 << o, b * 97 + o * 13)));
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const i = (y * N + x) * 4;
      data[i] = clamp(fbm(u, v, 4, capas[0])) * 255;
      data[i + 1] = clamp(fbm(u, v, 4, capas[1])) * 255;
      data[i + 2] = clamp(Math.abs(fbm(u, v, 4, capas[2]) - 0.5) * 2) * 255;
      data[i + 3] = clamp(fbm(u, v, 4, capas[3])) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
