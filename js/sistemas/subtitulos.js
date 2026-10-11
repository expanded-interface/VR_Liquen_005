/**
 * Voz narrativa como texto sutil. Dos franjas independientes:
 *  · voz  — primera persona del liquen, cursiva serif, centrada
 *  · nota — aclaración científica en mono pequeña (separa lo observado de lo artístico)
 *
 * Rendimiento: cada franja tiene su propio lienzo y se dibuja UNA vez por frase;
 * los fundidos se hacen con material.opacity (antes se redibujaba y resubía la textura
 * ~50 veces por frase, lo que en el Quest bloquea el hilo de render).
 *
 * Orientación: el panel no usa lookAt. Su giro se calcula a partir del rumbo de la mirada
 * (rotación Y) y de la inclinación hacia los ojos (rotación X), de modo que la cara frontal
 * del plano —y con ella el texto, legible y sin espejarse— siempre apunta al visitante.
 */
import * as THREE from 'three';
import {clamp, lerp} from '../nucleo/utilidades.js';

const DIST = 1.6; // m frente a los ojos
const BAJO = 0.42; // m bajo la línea de los ojos
const ANCHO = 1.5; // m

class Franja {
  constructor({w, h, alto, nota}) {
    this.W = w;
    this.H = h;
    this.nota = nota;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.flipY = true; // explícito: el lienzo se dibuja con el origen arriba
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ANCHO, (ANCHO * h) / w),
      new THREE.MeshBasicMaterial({map: this.tex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0, side: THREE.FrontSide})
    );
    this.mesh.renderOrder = 998;
    this.mesh.position.y = alto; // desplazamiento dentro del grupo
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
    this.alfa = 0;
    this.hasta = 0;
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

  /** Se dibuja una sola vez, a opacidad completa */
  escribir(texto) {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.88)';
    if (this.nota) {
      c.font = '400 26px "IBM Plex Mono", monospace';
      c.shadowBlur = 14;
      c.fillStyle = 'rgba(190,205,170,0.88)';
      const lineas = this._wrap(texto, this.W - 120).slice(0, 4);
      const y0 = this.H / 2 - ((lineas.length - 1) * 36) / 2;
      lineas.forEach((l, i) => c.fillText(l, this.W / 2, y0 + i * 36));
    } else {
      c.font = 'italic 500 56px "Cormorant Garamond", Georgia, serif';
      c.shadowBlur = 20;
      c.fillStyle = 'rgb(232,240,214)';
      const lineas = this._wrap(texto, this.W - 110).slice(0, 3);
      const y0 = this.H / 2 - ((lineas.length - 1) * 64) / 2;
      lineas.forEach((l, i) => c.fillText(l, this.W / 2, y0 + i * 64));
    }
    c.shadowBlur = 0;
    this.tex.needsUpdate = true; // única subida por frase
  }

  actualizar(dt, reloj, atenuado) {
    const meta = reloj < this.hasta ? 1 : 0;
    this.alfa = clamp(this.alfa + (meta ? dt / 1.4 : -dt / 1.8));
    this.mesh.material.opacity = this.alfa * atenuado;
    this.mesh.visible = this.alfa > 0.002;
    return this.mesh.visible;
  }
}

export class Subtitulos {
  constructor() {
    // grupo que se orienta hacia el visitante; las franjas son hijas sin rotación propia
    this.mesh = new THREE.Group();
    this.mesh.name = 'subtitulos';
    this.voz = new Franja({w: 1280, h: 230, alto: 0.06, nota: false});
    this.nota = new Franja({w: 1280, h: 170, alto: -0.15, nota: true});
    this.mesh.add(this.voz.mesh, this.nota.mesh);
    this.reloj = 0;
    this.yaw = null;
    this.atenuado = 1;
  }

  mostrar(texto, {nota = false, duracion} = {}) {
    const f = nota ? this.nota : this.voz;
    f.escribir(texto);
    f.alfa = 0;
    f.hasta = this.reloj + (duracion ?? 3.8 + texto.length * 0.055);
  }

  limpiar() {
    this.voz.hasta = this.nota.hasta = 0;
  }

  actualizar(dt, cabeza, yawCabeza) {
    this.reloj += dt;
    const a = this.voz.actualizar(dt, this.reloj, this.atenuado);
    const b = this.nota.actualizar(dt, this.reloj, this.atenuado);
    const visible = a || b;
    this.mesh.visible = visible;
    if (!visible) {
      this.yaw = yawCabeza; // reaparece donde se esté mirando
      this._init = false;
      return;
    }
    if (this.yaw === null) this.yaw = yawCabeza;
    // sólo se desplaza si la mirada se aleja mucho (comodidad)
    let d = yawCabeza - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > 0.55) this.moviendo = true;
    if (this.moviendo) {
      this.yaw += d * clamp(dt * 1.8);
      if (Math.abs(d) < 0.05) this.moviendo = false;
    }
    const px = cabeza.x - Math.sin(this.yaw) * DIST;
    const pz = cabeza.z - Math.cos(this.yaw) * DIST;
    const py = cabeza.y - BAJO;
    const m = this.mesh;
    if (!this._init) {
      m.position.set(px, py, pz);
      this._init = true;
    }
    const k = clamp(dt * 2.5);
    m.position.set(lerp(m.position.x, px, k), lerp(m.position.y, py, k), lerp(m.position.z, pz, k));
    // rumbo: la normal +Z del plano apunta de vuelta al visitante; inclinación: hacia los ojos
    const inclinacion = Math.atan2(cabeza.y - m.position.y, Math.hypot(cabeza.x - m.position.x, cabeza.z - m.position.z));
    m.rotation.set(-inclinacion, this.yaw, 0, 'YXZ');
  }
}
