/**
 * Talo folioso procedural (inspirado en Pseudocyphellaria / Sticta del bosque valdiviano).
 * Una roseta de lóbulos ondulados alrededor de un centro viejo y hundido.
 * El centro hundido es deliberado: es el "valle" sobre el que flota el visitante
 * cuando el viaje de escala lo vuelve del tamaño de una espora.
 *
 * Uniforms propios:
 *  uCrece   0-1 · extensión del talo desde el centro (crecimiento radial con borde irregular)
 *  uDetalle 0-1 · aparece la textura fina (poros, fibras de hifas) al aumentar la escala
 *  uBrillo  0-1 · halo que guía la atención en la escena 1
 */
import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {U, GLSL_ONDAS} from './materiales.js';
import {rr, T, TAU} from '../nucleo/utilidades.js';

export const RADIO_TALO = 0.17;
export const RADIO_CENTRO = 0.038;

export function crearTalo() {
  // indexada para que las normales sean suaves (sin facetas al ampliarse ×70)
  const ico = new THREE.IcosahedronGeometry(1, 4);
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  const base = mergeVertices(ico);
  const p = base.attributes.position;
  for (let i = 0; i < p.count; i++) {
    T.v1.fromBufferAttribute(p, i);
    const a = Math.atan2(T.v1.z, T.v1.x);
    const ond = 1 + 0.2 * Math.sin(a * 7) + 0.08 * Math.sin(a * 13 + T.v1.y * 4);
    // lóbulo aplanado con el borde levantado
    const borde = Math.pow(Math.hypot(T.v1.x, T.v1.z), 3) * 0.35;
    p.setXYZ(i, T.v1.x * ond, T.v1.y * (0.22 + 0.08 * Math.sin(a * 5)) + borde, T.v1.z * ond);
  }
  const colores = [0x8f9e74, 0x7c8f63, 0xa3ad86, 0xb9b079, 0x6f8458].map((h) => new THREE.Color(h));
  const partes = [];
  // Centro viejo: disco bajo, agrietado
  const disco = new THREE.CircleGeometry(RADIO_CENTRO * 1.25, 28);
  disco.rotateX(-Math.PI / 2);
  disco.translate(0, 0.002, 0);
  disco.deleteAttribute('uv');
  disco.deleteAttribute('normal');
  const cd = new Float32Array(disco.attributes.position.count * 3);
  for (let k = 0; k < cd.length; k += 3) new THREE.Color(0x56603f).toArray(cd, k);
  disco.setAttribute('color', new THREE.BufferAttribute(cd, 3));
  partes.push(disco);
  // Dos anillos de lóbulos
  const anillos = [
    {n: 9, r0: RADIO_CENTRO + 0.02, r1: RADIO_CENTRO + 0.045, s0: 0.03, s1: 0.042},
    {n: 13, r0: 0.1, r1: 0.13, s0: 0.035, s1: 0.05},
  ];
  anillos.forEach((an, ia) => {
    for (let i = 0; i < an.n; i++) {
      const g = base.clone();
      const a = (i / an.n) * TAU + rr(-0.2, 0.2) + ia * 0.3;
      const rad = rr(an.r0, an.r1);
      const s = rr(an.s0, an.s1);
      T.m.compose(
        T.v1.set(Math.cos(a) * rad, rr(0.0, 0.006), Math.sin(a) * rad),
        T.q.setFromEuler(T.e.set(0, -a, rr(-0.15, 0.1))),
        T.s.set(s * 1.25, s, s)
      );
      g.applyMatrix4(T.m);
      const col = colores[(i + ia * 2) % colores.length];
      const cols = new Float32Array(g.attributes.position.count * 3);
      for (let k = 0; k < cols.length; k += 3) col.toArray(cols, k);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      partes.push(g);
    }
  });
  const geo = mergeGeometries(partes);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uCrece: {value: 1},
      uDetalle: {value: 0},
      uBrillo: {value: 0},
    },
    vertexColors: true,
    vertexShader: /* glsl */ `
      varying vec3 vLp; varying vec3 vWp; varying vec3 vN; varying vec3 vCol;
      void main(){
        vLp = position; vCol = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWp = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform vec3 uFogColor, uLight, uAmbient, uLightDir, uNetColor;
      uniform float uFogDensity, uCrece, uDetalle, uBrillo, uNet;
      varying vec3 vLp; varying vec3 vWp; varying vec3 vN; varying vec3 vCol;
      ${GLSL_ONDAS}
      void main(){
        float r = length(vLp.xz) / ${RADIO_TALO.toFixed(3)};
        vec4 n = texture2D(uNoise, vLp.xz * 9.0);
        // crecimiento radial con borde lobulado
        if (r > uCrece * (0.82 + 0.36 * n.g) + 0.02) discard;
        vec3 N = normalize(vN);
        vec3 col = vCol * (0.7 + 0.5 * n.r);
        // textura fina: poros y fibras que sólo se ven de cerca
        vec4 f = texture2D(uNoise, vLp.xz * 70.0 + vLp.y * 30.0);
        float fibra = 1.0 - smoothstep(0.0, 0.08, f.b);
        col = mix(col, col * (0.6 + 0.8 * f.r), uDetalle * 0.7);
        col += vec3(0.85, 0.82, 0.7) * fibra * uDetalle * 0.25;
        // centro viejo: grietas
        float centro = 1.0 - smoothstep(0.18, 0.3, r);
        col *= 1.0 - centro * (1.0 - smoothstep(0.0, 0.05, texture2D(uNoise, vLp.xz * 22.0).b)) * 0.6;
        float dif = max(dot(N, uLightDir), 0.0);
        vec3 V = normalize(cameraPosition - vWp);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col = col * (uAmbient * 1.4 + uLight * dif) + vec3(0.75, 0.9, 0.7) * rim * 0.18;
        col += vec3(0.6, 1.0, 0.85) * uBrillo * (0.15 + 0.35 * rim);
        col += uNetColor * (uNet * 0.25 + waveAt(vWp) * 0.8);
        vec3 dv = vWp - cameraPosition;
        float k = uFogDensity * uFogDensity * dot(dv, dv);
        col = mix(col, uFogColor, clamp(1.0 - exp(-k), 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const talo = new THREE.Mesh(geo, mat);
  talo.name = 'talo';
  return talo;
}
