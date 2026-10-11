/**
 * Línea de tiempo discreta: ocho puntos orgánicos sobre un arco.
 * Oculta durante la experiencia normal. Al abrirla la experiencia se pausa.
 * Selección por mirada o por el rayo de un control/mano; se confirma con gatillo o pellizco.
 * Si nadie hace nada en 12 s, se cierra sola y la experiencia continúa.
 */
import * as THREE from 'three';
import {clamp, lerp, T, texturaBrillo} from '../nucleo/utilidades.js';

const N = 8;
const RADIO = 1.15;
const ARCO = 0.95; // radianes que abarca el arco

export class LineaTiempo {
  constructor(nombres) {
    this.nombres = nombres;
    this.grupo = new THREE.Group();
    this.grupo.name = 'linea-tiempo';
    this.grupo.visible = false;
    this.abierta = false;
    this.alfa = 0;
    this.hover = -1;
    this.actual = 0;
    this.inactiva = 0;

    const brillo = texturaBrillo(200, 255, 230);
    this.puntos = [];
    for (let i = 0; i < N; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({map: brillo, transparent: true, depthTest: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending})
      );
      s.renderOrder = 1000;
      const a = (i / (N - 1) - 0.5) * ARCO;
      s.userData.ang = a;
      s.position.set(Math.sin(a) * RADIO, 0, -Math.cos(a) * RADIO);
      this.grupo.add(s);
      this.puntos.push(s);
    }
    // hilo que une los puntos (una hifa)
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48 - 0.5) * ARCO;
      pts.push(new THREE.Vector3(Math.sin(a) * RADIO, Math.sin(k * 0.9) * 0.004, -Math.cos(a) * RADIO));
    }
    this.hilo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color: 0x8ff5cf, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false})
    );
    this.hilo.renderOrder = 999;
    this.grupo.add(this.hilo);
    // anillo del momento actual
    this.anillo = new THREE.Mesh(
      new THREE.RingGeometry(0.026, 0.031, 40),
      new THREE.MeshBasicMaterial({color: 0xe39a3b, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false})
    );
    this.anillo.renderOrder = 1001;
    this.grupo.add(this.anillo);
    // etiqueta
    this.cv = document.createElement('canvas');
    this.cv.width = 1536;
    this.cv.height = 160;
    this.etTex = new THREE.CanvasTexture(this.cv);
    this.etTex.colorSpace = THREE.SRGBColorSpace;
    this.etiqueta = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.1),
      new THREE.MeshBasicMaterial({map: this.etTex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0})
    );
    this.etiqueta.renderOrder = 1002;
    this.etiqueta.position.set(0, 0.11, -RADIO);
    this.grupo.add(this.etiqueta);
    this._etTexto = null;
    this.grupo.traverse((o) => (o.raycast = () => {}));
  }

  abrir(cabeza, yaw, actual) {
    this.abierta = true;
    this.actual = actual;
    this.inactiva = 0;
    this.grupo.visible = true;
    this.grupo.position.set(cabeza.x, cabeza.y - 0.28, cabeza.z);
    this.grupo.rotation.set(0, yaw, 0);
    this.grupo.updateMatrixWorld(true);
    const p = this.puntos[actual];
    this.anillo.position.copy(p.position);
    this.anillo.lookAt(this.grupo.position);
  }
  cerrar() {
    this.abierta = false;
  }

  _escribir(texto) {
    if (texto === this._etTexto) return;
    this._etTexto = texto;
    const c = this.cv.getContext('2d');
    c.clearRect(0, 0, 1536, 160);
    c.textAlign = 'center';
    c.font = '500 40px "IBM Plex Mono", monospace';
    c.fillStyle = 'rgba(214,232,200,0.95)';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 14;
    c.fillText(texto, 768, 96);
    this.etTex.needsUpdate = true;
  }

  /** rayos: lista de {origen, dir} (mirada + controles). Devuelve el índice señalado o -1. */
  actualizar(dt, rayos) {
    this.alfa = clamp(this.alfa + (this.abierta ? dt / 0.5 : -dt / 0.4));
    this.grupo.visible = this.alfa > 0.001;
    if (!this.grupo.visible) return -1;
    if (this.abierta) this.inactiva += dt;

    let mejor = -1;
    let mejorAng = 0.11;
    if (this.abierta) {
      for (let i = 0; i < N; i++) {
        this.puntos[i].getWorldPosition(T.v2);
        for (const r of rayos) {
          T.v3.copy(T.v2).sub(r.origen).normalize();
          const ang = Math.acos(clamp(T.v3.dot(r.dir), -1, 1));
          if (ang < mejorAng) {
            mejorAng = ang;
            mejor = i;
          }
        }
      }
    }
    if (mejor !== this.hover) {
      this.hover = mejor;
      if (mejor >= 0) this.inactiva = 0;
    }
    const t = performance.now() / 1000;
    for (let i = 0; i < N; i++) {
      const s = this.puntos[i];
      const hecho = i < this.actual;
      const base = i === this.actual ? 0.075 : hecho ? 0.05 : 0.04;
      const meta = i === this.hover ? base * 1.7 : base * (1 + 0.06 * Math.sin(t * 2 + i));
      s.scale.setScalar(lerp(s.scale.x || base, meta, clamp(dt * 10)));
      s.material.opacity = this.alfa * (i === this.hover ? 1 : hecho || i === this.actual ? 0.85 : 0.45);
      s.material.color.setHex(i === this.actual ? 0xe9b46a : 0xc8ffe6);
    }
    this.hilo.material.opacity = this.alfa * 0.28;
    this.anillo.material.opacity = this.alfa * 0.9;
    const idx = this.hover >= 0 ? this.hover : this.actual;
    const p = this.puntos[idx];
    this.etiqueta.position.set(p.position.x, 0.1, p.position.z);
    this.etiqueta.lookAt(T.v1.copy(this.grupo.position).setY(this.grupo.position.y + 0.1));
    this._escribir(`${idx + 1} · ${this.nombres[idx]}${this.hover < 0 ? '  ·  en pausa' : ''}`);
    this.etiqueta.material.opacity = this.alfa;
    return this.hover;
  }
}
