/**
 * SISTEMA D (parte) · Soplido sin micrófono.
 *
 * Meta Quest 3 no tiene un sensor de exhalación, y la vía con micrófono exige un permiso
 * que esta experiencia decidió no pedir. El soplo se reconoce con un gesto de cuerpo:
 *
 *   1. Mano (o control) junto a la boca, quieta un instante  → "toma aire"
 *   2. La mano se abre hacia delante, alejándose de la cara  → "sopla"
 *
 * Alternativas equivalentes: mantener el gatillo o el pellizco ~0,6 s, la tecla B en el
 * navegador, o simplemente esperar (la escena continúa sola tras config.esperaMaxima).
 */
import * as THREE from 'three';
import {clamp, T} from '../nucleo/utilidades.js';

const DIST_BOCA = 0.24; // m
const T_ARMADO = 0.18; // s junto a la boca
const VEL_SOPLO = 0.55; // m/s hacia delante

export class Soplido {
  constructor() {
    this.estados = [];
    this.boca = new THREE.Vector3();
    this.cercania = 0; // 0-1: qué tan cerca de la boca hay una mano (para retroalimentación)
    this.tGatillo = 0;
    this.gatilloUsado = false;
  }

  reiniciar() {
    this.estados = [];
    this.tGatillo = 0;
    this.gatilloUsado = false;
  }

  /**
   * @returns {null|{fuerza:number, origen:THREE.Vector3, dir:THREE.Vector3}}
   */
  actualizar(dt, cabeza, fwd, controladores, gatilloMantenido) {
    // la boca, unos centímetros por delante y por debajo de los ojos
    this.boca.copy(cabeza).addScaledVector(fwd, 0.07);
    this.boca.y -= 0.09;
    const adelante = T.v3.set(fwd.x, 0, fwd.z).normalize();
    let resultado = null;
    let cerca = 0;

    for (let i = 0; i < controladores.length; i++) {
      const c = controladores[i];
      if (!c || !c.visible) {
        this.estados[i] = null;
        continue;
      }
      c.getWorldPosition(T.v1);
      let e = this.estados[i];
      if (!e) {
        e = this.estados[i] = {p: T.v1.clone(), armado: 0, vel: new THREE.Vector3()};
        continue;
      }
      const d = Math.max(dt, 1e-3);
      T.v2.copy(T.v1).sub(e.p).divideScalar(d);
      if (T.v2.length() > 8) {
        // salto del seguimiento: se ignora
        e.p.copy(T.v1);
        continue;
      }
      e.vel.lerp(T.v2, 0.35);
      e.p.copy(T.v1);
      const dist = T.v1.distanceTo(this.boca);
      cerca = Math.max(cerca, clamp(1 - (dist - 0.12) / 0.35));
      if (dist < DIST_BOCA) {
        e.armado += dt;
      } else if (e.armado > T_ARMADO) {
        const avance = e.vel.dot(adelante);
        if (avance > VEL_SOPLO && dist < 0.6) {
          resultado = {fuerza: clamp(avance / 1.6, 0.4, 1), origen: this.boca.clone(), dir: adelante.clone()};
          e.armado = 0;
        } else if (dist > 0.6) {
          e.armado = 0;
        }
      } else {
        e.armado = 0;
      }
    }
    this.cercania = cerca;

    // gatillo / pellizco mantenido
    if (gatilloMantenido) {
      this.tGatillo += dt;
      if (this.tGatillo > 0.6 && !this.gatilloUsado) {
        this.gatilloUsado = true;
        resultado = resultado || {fuerza: 0.8, origen: this.boca.clone(), dir: adelante.clone()};
      }
    } else {
      this.tGatillo = 0;
      this.gatilloUsado = false;
    }
    return resultado;
  }

  /** Soplo forzado (teclado o espera) */
  automatico(cabeza, fwd, fuerza = 0.7) {
    const dir = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    return {fuerza, origen: cabeza.clone().addScaledVector(dir, 0.07).setY(cabeza.y - 0.09), dir};
  }
}
