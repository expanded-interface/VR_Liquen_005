/**
 * Voz narrativa como texto sutil. Dos franjas:
 *  · voz  — primera persona del liquen, cursiva serif, centrada
 *  · nota — aclaración científica en mono pequeña (separa lo observado de lo artístico)
 * El texto vive bajo la línea del horizonte, se desliza con la mirada sólo cuando
 * ésta se aleja mucho (comodidad), y se desvanece solo.
 */
import * as THREE from 'three';
import {clamp, lerp} from '../nucleo/utilidades.js';

const W = 1600;
const H = 420;

export class Subtitulos {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 336;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(1280 / W, 0, 0, 336 / H, 0, 0);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, (1.5 * H) / W),
      new THREE.MeshBasicMaterial({map: this.tex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0})
    );
    this.mesh.renderOrder = 998;
    this.mesh.name = 'subtitulos';
    this.mesh.raycast = () => {};
    this.franjas = {
      voz: {texto: '', alfa: 0, hasta: 0},
      nota: {texto: '', alfa: 0, hasta: 0},
    };
    this.reloj = 0;
    this.yaw = null;
    this.atenuado = 1;
    this._sucio = true;
  }

  mostrar(texto, {nota = false, duracion} = {}) {
    const f = this.franjas[nota ? 'nota' : 'voz'];
    f.texto = texto;
    f.alfa = 0;
    f.hasta = this.reloj + (duracion ?? 3.8 + texto.length * 0.055);
    this._sucio = true;
  }

  limpiar() {
    for (const k in this.franjas) this.franjas[k].hasta = 0;
  }

  _wrap(txt, maxW) {
    const c = this.ctx;
    const out = [];
    let line = '';
    txt.split(' ').forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = t;
    });
    out.push(line);
    return out;
  }

  _dibujar() {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    const voz = this.franjas.voz;
    const nota = this.franjas.nota;
    let y = 96;
    if (voz.alfa > 0.002) {
      c.font = 'italic 500 66px "Cormorant Garamond", Georgia, serif';
      const lineas = this._wrap(voz.texto, W - 140).slice(0, 3);
      c.shadowColor = 'rgba(0,0,0,0.85)';
      c.shadowBlur = 24;
      c.fillStyle = `rgba(232,240,214,${voz.alfa})`;
      lineas.forEach((l) => {
        c.fillText(l, W / 2, y);
        y += 74;
      });
    }
    if (nota.alfa > 0.002) {
      y = Math.max(y + 10, 250);
      c.font = '400 30px "IBM Plex Mono", monospace';
      c.shadowColor = 'rgba(0,0,0,0.9)';
      c.shadowBlur = 16;
      c.fillStyle = `rgba(190,205,170,${nota.alfa * 0.85})`;
      this._wrap(nota.texto, W - 260)
        .slice(0, 4)
        .forEach((l) => {
          c.fillText(l, W / 2, y);
          y += 40;
        });
    }
    c.shadowBlur = 0;
    this.tex.needsUpdate = true;
  }

  actualizar(dt, cabeza, yawCabeza) {
    this.reloj += dt;
    let cambia = this._sucio;
    for (const k in this.franjas) {
      const f = this.franjas[k];
      const meta = this.reloj < f.hasta ? 1 : 0;
      f.alfa = clamp(f.alfa + (meta ? dt / 1.6 : -dt / 2.2));
      // Redibujar sólo en saltos visibles: ahorra subir la textura en cada cuadro
      const dib = f._dib ?? -1;
      if (Math.abs(f.alfa - dib) > 0.04 || (f.alfa !== dib && (f.alfa === 0 || f.alfa === 1))) cambia = true;
    }
    if (cambia) {
      this._dibujar();
      for (const k in this.franjas) this.franjas[k]._dib = this.franjas[k].alfa;
      this._sucio = false;
    }
    const visible = this.franjas.voz.alfa > 0.002 || this.franjas.nota.alfa > 0.002;
    this.mesh.visible = visible;
    this.mesh.material.opacity = this.atenuado;
    if (!visible && this.yaw !== null) {
      this.yaw = yawCabeza; // reaparece donde estés mirando
      this._init = false;
      return;
    }
    if (this.yaw === null) this.yaw = yawCabeza;
    let d = yawCabeza - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > 0.55) this.moviendo = true;
    if (this.moviendo) {
      this.yaw += d * clamp(dt * 1.8);
      if (Math.abs(d) < 0.05) this.moviendo = false;
    }
    const dist = 1.6;
    const px = cabeza.x - Math.sin(this.yaw) * dist;
    const pz = cabeza.z - Math.cos(this.yaw) * dist;
    const py = cabeza.y - 0.42;
    const m = this.mesh;
    if (!this._init) {
      m.position.set(px, py, pz);
      this._init = true;
    }
    const k = clamp(dt * 2.5);
    m.position.set(lerp(m.position.x, px, k), lerp(m.position.y, py, k), lerp(m.position.z, pz, k));
    m.lookAt(cabeza.x, cabeza.y - 0.1, cabeza.z);
  }
}
