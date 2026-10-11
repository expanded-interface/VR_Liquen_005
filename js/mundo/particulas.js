/**
 * Partículas con coste controlado: todo el movimiento se calcula en el vertex shader.
 *  · Esporas: polvo vivo que flota en el aire del bosque y del microcosmos.
 *  · Dispersión: la exhalación de la escena 6. Sale de la boca hacia la roca y el suelo,
 *    se posa y se vuelve verde (nuevas colonias). Sólo una ráfaga activa a la vez.
 */
import * as THREE from 'three';
import {U, GLSL_ONDAS} from './materiales.js';
import {rnd, rr, TAU} from '../nucleo/utilidades.js';

export class Esporas {
  constructor(n) {
    const pp = new Float32Array(n * 3);
    const pr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rr(0, TAU);
      const d = Math.sqrt(rnd()) * 14;
      pp.set([Math.cos(a) * d, rr(0, 9), Math.sin(a) * d], i * 3);
      pr[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(pr, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {...U, uColor: {value: new THREE.Color(0xd9e6c0)}, uAlpha: {value: 0}, uFall: {value: 0.04}, uSize: {value: 22}},
      vertexShader: /* glsl */ `attribute float aR; uniform float uFall, uSize; varying float vW; varying float vR; ${GLSL_ONDAS}
        void main(){ vec3 p = position; p.y = mod(p.y - uTime*uFall*(0.5+aR), 9.0);
          p.x += sin(uTime*0.3 + aR*20.0)*0.3; p.z += cos(uTime*0.25 + aR*13.0)*0.3;
          vec4 wp = modelMatrix*vec4(p,1.0); vW = waveAt(wp.xyz); vR=aR;
          vec4 mv = viewMatrix*wp; gl_PointSize = min(uSize*(0.4+aR)*(1.0+vW*1.5)/(-mv.z), 22.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `precision mediump float; uniform vec3 uColor, uNetColor; uniform float uAlpha; varying float vW; varying float vR;
        void main(){ vec2 c = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(c));
          gl_FragColor = vec4(mix(uColor, uNetColor, clamp(vW,0.0,1.0)), a*uAlpha*(0.4+0.6*vR) + a*vW*0.7*uAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.puntos = new THREE.Points(g, this.mat);
    this.puntos.frustumCulled = false;
    this.puntos.raycast = () => {};
    this.n = n;
  }
  set alfa(v) {
    this.mat.uniforms.uAlpha.value = v;
    this.puntos.visible = v > 0.003;
  }
  recortar(n) {
    this.puntos.geometry.setDrawRange(0, n);
  }
}

export class Dispersion {
  constructor(n = 520) {
    const semillas = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) semillas.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // no se usa
    g.setAttribute('aS', new THREE.BufferAttribute(semillas, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uT0: {value: -999},
        uOrigen: {value: new THREE.Vector3()},
        uDir: {value: new THREE.Vector3(0, 0, -1)},
        uFuerza: {value: 0.7},
        uSuelo: {value: 0},
      },
      vertexShader: /* glsl */ `
        attribute vec4 aS; uniform float uTime, uT0, uFuerza, uSuelo; uniform vec3 uOrigen, uDir;
        varying float vVida; varying float vPosado;
        void main(){
          float age = uTime - uT0;
          vVida = age;
          // dirección en cono alrededor de uDir, con algo de apertura lateral
          vec3 lado = normalize(cross(uDir, vec3(0.0,1.0,0.0)));
          float abre = (aS.x - 0.5) * 2.2;
          vec3 d = normalize(uDir + lado * abre * 0.6 + vec3(0.0, (aS.y - 0.35) * 0.5, 0.0));
          float alcance = mix(0.6, 7.0, pow(aS.z, 1.6)) * (0.6 + 0.6 * uFuerza);
          float t = 1.0 - exp(-age * (0.9 + aS.w));
          vec3 p = uOrigen + d * alcance * t;
          // caída lenta hasta posarse
          float caida = smoothstep(0.6, 4.5 + aS.w * 3.0, age);
          p.y = mix(p.y, uSuelo + 0.02 + aS.y * 0.03, caida);
          p.x += sin(age * 1.3 + aS.x * 30.0) * 0.06 * (1.0 - caida);
          vPosado = caida;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(11.0 * (0.4 + aS.z) / -mv.z, 1.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `precision mediump float; varying float vVida; varying float vPosado;
        void main(){
          if (vVida < 0.0 || vVida > 26.0) discard;
          vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c));
          vec3 col = mix(vec3(0.95, 0.97, 0.85), vec3(0.55, 0.9, 0.45), vPosado);
          float fin = 1.0 - smoothstep(16.0, 26.0, vVida);
          gl_FragColor = vec4(col, a * fin * mix(0.9, 0.55, vPosado));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.puntos = new THREE.Points(g, this.mat);
    this.puntos.frustumCulled = false;
    this.puntos.visible = false;
    this.puntos.raycast = () => {};
  }

  /** origen y dir en el espacio local del grupo que lo contiene */
  disparar(origen, dir, fuerza, ahora, alturaSuelo = 0) {
    const u = this.mat.uniforms;
    u.uOrigen.value.copy(origen);
    u.uDir.value.copy(dir).normalize();
    u.uFuerza.value = fuerza;
    u.uT0.value = ahora;
    u.uSuelo.value = alturaSuelo;
    this.puntos.visible = true;
  }
  apagar() {
    this.mat.uniforms.uT0.value = -999;
    this.puntos.visible = false;
  }
}
