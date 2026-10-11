/**
 * SISTEMA D · Director: estado de la experiencia, progresión, pausas, línea de tiempo y gestos.
 *
 * Estados:
 *   espera ──(Entrar en VR / Ver en el navegador)──▶ escena 1 → 2 → … → 8 (abierta)
 *   cualquier escena ──(grip · pellizco largo · T · Espacio)──▶ línea de tiempo (pausa)
 *   línea de tiempo ──(mirar un punto + gatillo/pellizco)──▶ fundido ▶ escena elegida
 *   línea de tiempo ──(gatillo sin apuntar · 12 s sin actividad)──▶ reanudar
 *   menú del sistema del visor abierto ──▶ pausa automática
 *
 * Cada escena es una función del tiempo que escribe `mundo.estado`; el director decide
 * cuándo termina (duración de config o `terminada()` propia) y muestra los textos programados.
 */
import * as THREE from 'three';
import * as xb from 'xrblocks';
import {Mundo} from '../mundo/mundo.js';
import {U, NUM_ONDAS} from '../mundo/materiales.js';
import {texturaRuido} from '../nucleo/ruido.js';
import {sonido} from '../nucleo/sonido.js';
import {clamp, rnd, T, vibrar} from '../nucleo/utilidades.js';
import {Subtitulos} from '../sistemas/subtitulos.js';
import {LineaTiempo} from '../sistemas/lineaTiempo.js';
import {Soplido} from '../sistemas/soplido.js';
import {ESCENAS, VELOCIDAD, ESCENA_INICIAL, DEPURAR, CALIDAD, MODELOS} from '../config.js';
import {modeloOProcedural} from '../sistemas/modelos.js';

import e1 from './01-bosque.js';
import e2 from './02-transformacion.js';
import e3 from './03-encuentro.js';
import e4 from './04-intimidad.js';
import e5 from './05-roca.js';
import e6 from './06-soplar.js';
import e7 from './07-bosque-maduro.js';
import e8 from './08-red.js';

const MODULOS = [e1, e2, e3, e4, e5, e6, e7, e8];
const LARGA = 1.3; // s de pellizco/gatillo mantenido para abrir la línea de tiempo

export class Director extends xb.Script {
  constructor(splat) {
    super();
    this.splat = splat;
  }

  get splatListo() {
    return this.splat.listo;
  }

  async init() {
    U.uNoise.value = texturaRuido(256);
    this.sonido = sonido;
    this.mundo = new Mundo(xb, this.splat);
    this.estado = this.mundo.estado;
    this.add(this.mundo.raiz);
    this.add(this.mundo.cielo);
    xb.core.scene.fog = this.mundo.niebla;

    this.subtitulos = new Subtitulos();
    this.add(this.subtitulos.mesh);
    this.linea = new LineaTiempo(ESCENAS.map((e) => e.nombre));
    this.add(this.linea.grupo);
    this.soplido = new Soplido();

    // velo para los saltos entre capítulos (fundido a la niebla, sin cortes)
    this.velo = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 10),
      new THREE.MeshBasicMaterial({color: 0x050a08, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false})
    );
    this.velo.renderOrder = 990;
    this.velo.raycast = () => {};
    this.add(this.velo);

    this.fase = 'espera';
    this.indice = -1;
    this.t = 0;
    this.reloj = 0;
    this.pausado = false;
    this.pausaSistema = false;
    this.mantenido = 0;
    this.tMantenido = 0;
    this.toques = 0;
    this.soploTeclado = false;
    this.temporizadores = {};
    this.textosMostrados = new Set();
    this.ondaIdx = 0;
    this.salto = null;
    this.veloAlfa = 0;
    this.cabeza = new THREE.Vector3(0, 1.6, 0);
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.arriba = new THREE.Vector3(0, 1, 0);
    this.yaw = 0;
    this.tmp = new THREE.Vector3();
    this.calidadBaja = false;
    this.mundo.raiz.visible = false;

    window.addEventListener('keydown', (e) => this._tecla(e));
    if (DEPURAR) window.memoria = this;
    await this.mundo.cargarModelos(modeloOProcedural, MODELOS);
    this.listo = true;
  }

  /* ================= ciclo de vida ================= */
  onSimulatorStarted() {
    if (this.introCerrada) this.comenzar();
  }

  onXRSessionStarted(sesion) {
    const xr = xb.core.renderer?.xr;
    try {
      xr?.setFoveation?.(1); // foveación fija máxima: menos píxeles en la periferia
    } catch (e) {
      /* no todos los navegadores la exponen */
    }
    const s = sesion || xr?.getSession?.();
    if (s) {
      const tasas = s.supportedFrameRates ? Array.from(s.supportedFrameRates) : [];
      if (s.updateTargetFrameRate && tasas.includes(CALIDAD.frecuenciaPreferida)) s.updateTargetFrameRate(CALIDAD.frecuenciaPreferida).catch(() => {});
      s.addEventListener('visibilitychange', () => {
        this.pausaSistema = s.visibilityState !== 'visible';
        sonido.volumen(this.pausaSistema ? 0.12 : 0.9);
      });
    }
    this.medicion = {t: 0, n: 0};
    this.recentrar = true;
    this.comenzar();
  }

  onXRSessionEnded() {
    sonido.pausar();
    const intro = document.getElementById('intro');
    intro.hidden = false;
    document.getElementById('saludo').textContent = 'Saliste del bosque. Puedes volver a entrar y continuar donde estabas.';
  }

  comenzar() {
    document.getElementById('intro').hidden = true;
    let enXR = false;
    try {
      enXR = !!xb.core.renderer?.xr?.isPresenting;
    } catch (e) {
      /* simulador */
    }
    document.getElementById('hudEscritorio').hidden = enXR;
    sonido.iniciar();
    sonido.volumen(0.9);
    if (this.fase === 'espera') {
      this.fase = 'activa';
      this.recentrar = true;
      this.mundo.raiz.visible = true;
      this._entrar(ESCENA_INICIAL - 1);
    } else {
      sonido.reanudar();
    }
  }

  _centrar() {
    const cam = xb.core.camera;
    cam.getWorldPosition(this.cabeza);
    T.v1.set(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(T.q));
    const yaw = Math.atan2(-T.v1.x, -T.v1.z);
    const alt = this.cabeza.y > 0.6 ? this.cabeza.y : 1.6; // sentado o de pie
    this.mundo.centrar(this.cabeza, yaw, alt);
  }

  /* ================= escenas ================= */
  _entrar(i, {reiniciar = false} = {}) {
    if (reiniciar) {
      // salto: el estado vuelve a valores neutros y la escena lo reconstruye en t=0
      Object.assign(this.estado, this.mundo.estadoInicial());
      U.uWaves.value.forEach((w) => w.set(0, 0, -999, 0));
      this.mundo.dispersion.apagar();
      this.subtitulos.limpiar();
    }
    this.indice = i;
    this.t = 0;
    this.temporizadores = {};
    this.textosMostrados = new Set();
    MODULOS[i].entrar?.(this);
    MODULOS[i].actualizar(this, 0, 0);
    if (DEPURAR) console.info(`[Director] Escena ${i + 1}: ${ESCENAS[i].nombre}`);
  }

  irA(i) {
    if (i === this.indice || this.salto) return;
    this.salto = {destino: i, fase: 'cerrar'};
  }

  _avanzar() {
    if (this.indice < MODULOS.length - 1) this._entrar(this.indice + 1);
  }

  /* ================= utilidades para las escenas ================= */
  /** Ejecuta fn a intervalos aleatorios entre a y b segundos (por nombre). */
  cada(nombre, a, b, fn) {
    const prox = this.temporizadores[nombre];
    if (prox === undefined) {
      this.temporizadores[nombre] = this.t + a + rnd() * (b - a);
      return;
    }
    if (this.t >= prox) {
      this.temporizadores[nombre] = this.t + a + rnd() * (b - a);
      fn();
    }
  }

  /** Un punto alrededor del visitante (para sonidos espaciales) */
  puntoAlrededor(dist, altura) {
    const a = rnd() * Math.PI * 2;
    return T.v3.set(this.cabeza.x + Math.cos(a) * dist, altura, this.cabeza.z + Math.sin(a) * dist).clone();
  }

  emitirOnda(x, z, fuerza) {
    U.uWaves.value[this.ondaIdx].set(x, z, U.uTime.value, fuerza);
    this.ondaIdx = (this.ondaIdx + 1) % NUM_ONDAS;
  }

  controladores() {
    return xb.core.user?.controllers || [];
  }

  /** true una vez por cada toque (gatillo, pellizco o clic) */
  toque() {
    if (this.toques > 0) {
      this.toques = 0;
      return true;
    }
    return false;
  }

  consumirSoploTeclado() {
    if (!this.soploTeclado) return null;
    this.soploTeclado = false;
    return this.soplido.automatico(this.cabeza, this.fwd, 0.8);
  }

  get xb() {
    return xb;
  }

  /* ================= entrada ================= */
  onSelectStart() {
    this.mantenido++;
    sonido.reanudar();
  }

  onSelectEnd() {
    const largo = this.tMantenido;
    this.mantenido = Math.max(0, this.mantenido - 1);
    if (this.mantenido === 0) this.tMantenido = 0;
    if (this.fase !== 'activa') return;
    if (this.linea.abierta) {
      if (this._lineaRecienAbierta) {
        this._lineaRecienAbierta = false; // el mismo pellizco largo que la abrió
        return;
      }
      const h = this.linea.hover;
      this._cerrarLinea();
      if (h >= 0 && h !== this.indice) this.irA(h);
      return;
    }
    if (largo < LARGA) this.toques++;
  }

  onSqueezeStart() {
    if (this.fase !== 'activa') return;
    if (this.linea.abierta) this._cerrarLinea();
    else this._abrirLinea();
  }

  _tecla(e) {
    if (this.fase !== 'activa') return;
    if (e.repeat) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 8) {
      if (this.linea.abierta) this._cerrarLinea();
      this.irA(n - 1);
    } else if (e.key === 't' || e.key === 'T' || e.key === ' ') {
      e.preventDefault();
      if (this.linea.abierta) this._cerrarLinea();
      else this._abrirLinea();
    } else if (e.key === 'b' || e.key === 'B') {
      this.soploTeclado = true;
    }
  }

  _abrirLinea() {
    this.linea.abrir(this.cabeza, this.yaw, this.indice);
    this.pausado = true;
    sonido.volumen(0.35, 0.4);
    vibrar(xb, 0.2, 40);
  }

  _cerrarLinea() {
    this.linea.cerrar();
    this.pausado = false;
    sonido.volumen(0.9, 0.6);
  }

  /* ================= bucle ================= */
  update() {
    if (!this.listo) return;
    const ahora = performance.now() / 1000;
    const dtReal = this.ultimo ? Math.min(0.1, ahora - this.ultimo) : 0.016;
    this.ultimo = ahora;

    const cam = xb.core.camera;
    cam.getWorldPosition(this.cabeza);
    cam.getWorldQuaternion(T.q);
    this.fwd.set(0, 0, -1).applyQuaternion(T.q);
    this.arriba.set(0, 1, 0).applyQuaternion(T.q);
    this.yaw = Math.atan2(-this.fwd.x, -this.fwd.z);
    sonido.oyente(this.cabeza, this.fwd, this.arriba);
    if (this.fase === 'espera') return;
    if (this.recentrar) {
      this._centrar();
      this.recentrar = false;
    }

    // medir fluidez durante los primeros segundos en el visor
    if (this.medicion && !this.calidadBaja) {
      this.medicion.t += dtReal;
      this.medicion.n++;
      if (this.medicion.t > 6) {
        if (this.medicion.n / this.medicion.t < CALIDAD.fpsMinimo) this._bajarCalidad();
        this.medicion = null;
      }
    }

    // pellizco o gatillo largo: abre la línea de tiempo (no durante la invitación a soplar)
    if (this.mantenido > 0) {
      this.tMantenido += dtReal;
      if (this.tMantenido > LARGA && !this.linea.abierta && this.indice !== 5 && !this._largoUsado) {
        this._largoUsado = true;
        this._lineaRecienAbierta = true;
        this._abrirLinea();
      }
    } else {
      this._largoUsado = false;
    }

    const detenido = this.pausado || this.pausaSistema;
    const dt = detenido ? 0 : dtReal * VELOCIDAD;
    if (!detenido) this.reloj += dt;

    // línea de tiempo
    const rayos = [{origen: this.cabeza, dir: this.fwd}];
    for (const c of this.controladores()) {
      if (!c || !c.visible) continue;
      const o = new THREE.Vector3();
      c.getWorldPosition(o);
      const d = new THREE.Vector3();
      c.getWorldDirection(d).negate(); // el rayo de apuntar es -Z
      rayos.push({origen: o, dir: d});
    }
    this.linea.actualizar(dtReal, rayos);
    if (this.linea.abierta && this.linea.inactiva > 12) this._cerrarLinea();

    // saltos con fundido
    if (this.salto) {
      if (this.salto.fase === 'cerrar') {
        this.veloAlfa = Math.min(1, this.veloAlfa + dtReal / 0.8);
        if (this.veloAlfa >= 1) {
          this._entrar(this.salto.destino, {reiniciar: true});
          this.salto.fase = 'abrir';
        }
      } else {
        this.veloAlfa = Math.max(0, this.veloAlfa - dtReal / 1.4);
        if (this.veloAlfa <= 0) this.salto = null;
      }
    }
    this.velo.position.copy(this.cabeza);
    this.velo.material.opacity = this.veloAlfa;
    this.velo.visible = this.veloAlfa > 0.001;

    // escena actual
    if (!detenido && this.salto?.fase !== 'cerrar') {
      this.t += dt;
      const cfg = ESCENAS[this.indice];
      const mod = MODULOS[this.indice];
      mod.actualizar(this, this.t, dt);
      for (const [seg, texto, op] of cfg.textos) {
        const clave = seg + texto;
        if (this.t >= seg && !this.textosMostrados.has(clave)) {
          this.textosMostrados.add(clave);
          if (this.t - seg < 3) this.subtitulos.mostrar(texto, op || {});
        }
      }
      const fin = mod.terminada ? mod.terminada(this, this.t) : this.t >= cfg.duracion;
      if (fin) this._avanzar();
    }

    this.mundo.aplicar(dt, this.reloj, this.cabeza);
    this.subtitulos.atenuado = this.linea.abierta ? 0.25 : 1;
    this.subtitulos.actualizar(detenido ? 0 : dtReal, this.cabeza, this.yaw);
  }

  _bajarCalidad() {
    this.calidadBaja = true;
    this.mundo.bajarCalidad();
    if (this.splat.spark) this.splat.spark.maxStdDev = Math.sqrt(4);
    console.info('[Director] Calidad reducida para sostener la tasa de cuadros.');
  }

  /** Progreso de la escena actual 0-1 (para depurar o mostrar) */
  progreso() {
    const mod = MODULOS[this.indice];
    return mod?.progreso ? mod.progreso(this.t) : clamp(this.t / ESCENAS[this.indice].duracion);
  }
}
