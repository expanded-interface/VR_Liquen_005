/**
 * SISTEMA A · Paisaje Gaussian Splat (Spark 2.1 dentro de XR Blocks).
 *
 * Verificado en el repositorio de XR Blocks (v0.22): la muestra
 * samples/xr_realism/3dgs_walkthrough carga .spz con SplatMesh de Spark,
 * registra el SparkRenderer con xb.SparkRendererHolder y hace fundidos
 * con mesh.opacity. Aquí se usa exactamente ese patrón.
 *
 * Lo que NO se asume: que un splat pueda convertirse en malla ni deformarse
 * de forma arbitraria. La metamorfosis se simula con escala, opacidad,
 * recolor (tinte) y capas procedurales superpuestas.
 */
import * as THREE from 'three';
import {SplatMesh, SparkRenderer} from '@sparkjsdev/spark';

export class BosqueSplat {
  constructor(xb, config) {
    this.xb = xb;
    this.config = config;
    this.mesh = null;
    this.listo = false;
    this.nombre = '';
    this.contenedor = new THREE.Group(); // la escena lo escala para el viaje de escala
    this.contenedor.name = 'SistemaA-splat';
    this._opacidad = 1;
    this._enEscena = false;
    this.tinte = new THREE.Color(1, 1, 1);
  }

  /** Descarga con progreso y tiempo máximo; prueba las fuentes en orden. */
  async cargar(alProgresar = () => {}) {
    if (!this.config.activo) return false;
    for (const fuente of this.config.fuentes) {
      try {
        const bytes = await this._descargar(fuente.url, alProgresar);
        const mesh = new SplatMesh({fileBytes: bytes, fileName: fuente.url.split('/').pop()});
        await mesh.initialized;
        const c = this.config;
        mesh.scale.setScalar(c.escala);
        mesh.position.fromArray(c.posicion);
        mesh.quaternion.set(...c.cuaternion);
        this.mesh = mesh;
        this.nombre = fuente.nombre;
        this._crearRenderer();
        this.listo = true;
        console.info(`[Sistema A] Splat cargado: ${fuente.nombre}`);
        return true;
      } catch (e) {
        console.info(`[Sistema A] No se pudo usar ${fuente.url}: ${e.message || e}`);
      }
    }
    return false;
  }

  async _descargar(url, alProgresar) {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), this.config.tiempoMaximoCarga * 1000);
    try {
      const r = await fetch(url, {signal: ctrl.signal, cache: 'force-cache'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const total = Number(r.headers.get('content-length')) || 0;
      if (!r.body || !total) {
        const buf = await r.arrayBuffer();
        alProgresar(1);
        return new Uint8Array(buf);
      }
      const lector = r.body.getReader();
      const partes = [];
      let recibido = 0;
      for (;;) {
        const {done, value} = await lector.read();
        if (done) break;
        partes.push(value);
        recibido += value.length;
        alProgresar(Math.min(1, recibido / total));
      }
      const out = new Uint8Array(recibido);
      let o = 0;
      for (const p of partes) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    } finally {
      clearTimeout(reloj);
    }
  }

  _crearRenderer() {
    const xb = this.xb;
    const spark = new SparkRenderer({renderer: xb.core.renderer, maxStdDev: this.config.maxStdDev});
    xb.core.registry.register(new xb.SparkRendererHolder(spark));
    xb.add(spark);
    this.spark = spark;
  }

  /** Muestra u oculta. Fuera de escena el splat no cuesta GPU (no se ordena ni dibuja). */
  set visible(v) {
    if (!this.mesh) return;
    if (v && !this._enEscena) {
      this.contenedor.add(this.mesh);
      this._enEscena = true;
    } else if (!v && this._enEscena) {
      this.contenedor.remove(this.mesh);
      this._enEscena = false;
    }
  }
  get visible() {
    return this._enEscena;
  }

  /** 0 = invisible (y fuera de escena), 1 = opaco */
  set opacidad(o) {
    this._opacidad = o;
    if (!this.mesh) return;
    this.visible = o > 0.003;
    this.mesh.opacity = o;
  }
  get opacidad() {
    return this._opacidad;
  }

  /** Tinte multiplicativo (recolor de Spark): oscurecer al anochecer, teñir de niebla. */
  tintar(r, g, b) {
    if (!this.mesh) return;
    this.tinte.setRGB(r, g, b);
    this.mesh.recolor.copy(this.tinte);
  }
}
