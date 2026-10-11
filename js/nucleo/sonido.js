/**
 * SISTEMA E · Sonido procedural con Web Audio (sin archivos, sin micrófono).
 *
 * Cinco capas que se mezclan de forma continua:
 *  1 bosque        viento, hojas, gotas, insectos, aves (eventos espaciales HRTF)
 *  2 transformación el bosque se ralentiza y se filtra; aparece un dron mineral
 *  3 microscópico  pulsaciones, microclics, resonancias
 *  4 crecimiento   campanas pentatónicas y un colchón que se abre
 *  5 interconexión el bosque regresa mezclado con todo lo anterior
 *
 * Las escenas sólo fijan niveles objetivo (mezcla()) y disparan eventos sueltos.
 * El AudioContext se crea con el primer gesto del usuario (requisito del navegador).
 */
import {clamp, rnd, rr, lerp} from './utilidades.js';

export const ESCALA = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0]; // re menor pentatónica

export class Sonido {
  constructor() {
    this.ctx = null;
    this._ult = {};
    this.mezclaActual = {bosque: 0, claridad: 1, lentitud: 0, mineral: 0, micro: 0, crecimiento: 0, red: 0};
  }

  iniciar() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({latencyHint: 'playback'});
      this._construir();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  pausar() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  reanudar() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  volumen(v, tau = 0.5) {
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, tau);
  }

  /* ---------------- construcción ---------------- */
  _ruido(tipo = 'brown', seg = 4) {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * seg, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (tipo === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }
  _gain(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  _filtro(tipo, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = tipo;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }
  _loop(buf, rate = 1, arrancar = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    if (arrancar) s.start(0, Math.random() * buf.duration);
    return s;
  }

  _construir() {
    const c = this.ctx;
    this.master = this._gain(0.9);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);

    // Reverb (IR generada una vez)
    this.reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.2); // IR más corta: la convolución es el nodo más caro del grafo
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    this.reverb.buffer = ir;
    this.reverbGain = this._gain(0.45);
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.bufMarron = this._ruido('brown', 4);
    this.bufBlanco = this._ruido('white', 3);

    /* Capa 1 · bosque (todo pasa por un filtro común que la capa 2 cierra) */
    this.bosqueFiltro = this._filtro('lowpass', 9000, 0.5);
    this.bosque = this._gain(0);
    this.bosqueFiltro.connect(this.bosque).connect(this.master);
    this.bosque.connect(this.reverb);
    this.fuentesBosque = [];

    const viento = this._loop(this.bufMarron);
    const vf = this._filtro('lowpass', 520);
    const vg = this._gain(0.55);
    viento.connect(vf).connect(vg).connect(this.bosqueFiltro);
    // ráfagas lentas
    const lfoV = c.createOscillator();
    lfoV.frequency.value = 0.07;
    const lfoVg = this._gain(0.25);
    lfoV.connect(lfoVg).connect(vg.gain);
    lfoV.start();

    const hojas = this._loop(this.bufBlanco);
    const hf = this._filtro('bandpass', 3200, 0.6);
    const hg = this._gain(0.05);
    hojas.connect(hf).connect(hg).connect(this.bosqueFiltro);
    const lfoH = c.createOscillator();
    lfoH.frequency.value = 0.11;
    const lfoHg = this._gain(0.035);
    lfoH.connect(lfoHg).connect(hg.gain);
    lfoH.start();

    const insectos = this._loop(this.bufBlanco, 0.9);
    const inf = this._filtro('bandpass', 6200, 8);
    const ing = this._gain(0.0);
    const am = c.createOscillator();
    am.frequency.value = 23;
    const amg = this._gain(0.012);
    am.connect(amg).connect(ing.gain);
    am.start();
    insectos.connect(inf).connect(ing).connect(this.bosqueFiltro);
    this.fuentesBosque.push(viento, hojas, insectos);

    /*
     * Capas 2–5 y voces: PEREZOSAS. Sus filtros y ganancias existen siempre, pero los osciladores
     * y fuentes sólo se crean cuando la capa suena, y se detienen tras 5 s en silencio.
     * Antes había ~40 osciladores corriendo durante toda la experiencia aunque su volumen fuera 0.
     */
    this.capas = {};

    /* Capa 2 · dron mineral */
    this.mineral = this._gain(0);
    this.mineralFiltro = this._filtro('lowpass', 240);
    this.mineralFiltro.connect(this.mineral).connect(this.master);
    this.mineral.connect(this.reverb);
    this._capa('mineral', () => {
      const fuentes = [];
      [41.2, 55, 82.41, 110.3].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = i === 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 5;
        const g = this._gain([0.4, 0.5, 0.2, 0.1][i]);
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.027;
        const lg = this._gain(0.09);
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(this.mineralFiltro);
        fuentes.push(o, lfo);
      });
      // resonancia de piedra: ruido grave muy filtrado
      const piedra = this._loop(this.bufMarron, 0.5, false);
      const pf = this._filtro('bandpass', 140, 6);
      const pg = this._gain(0.6);
      piedra.connect(pf).connect(pg).connect(this.mineralFiltro);
      fuentes.push(piedra);
      return fuentes;
    });

    /* Capa 3 · microscópico: resonancias tenues continuas + eventos */
    this.micro = this._gain(0);
    const microF = this._filtro('lowpass', 2400);
    microF.connect(this.micro).connect(this.master);
    this.micro.connect(this.reverb);
    this._capa('micro', () => {
      const fuentes = [];
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = c.createOscillator();
        o.frequency.value = f;
        o.detune.value = rr(-8, 8);
        const g = this._gain(0.025 / (i + 1));
        const l = c.createOscillator();
        l.frequency.value = 0.13 + i * 0.07;
        const lg = this._gain(0.02 / (i + 1));
        l.connect(lg).connect(g.gain);
        o.connect(g).connect(microF);
        fuentes.push(o, l);
      });
      return fuentes;
    });
    this.microEventos = this._gain(1);
    this.microEventos.connect(this.master);
    this.microEventos.connect(this.reverb);

    /* Capa 4 · crecimiento: colchón que se abre */
    this.crecimiento = this._gain(0);
    this.crecFiltro = this._filtro('lowpass', 400, 1.2);
    this.crecFiltro.connect(this.crecimiento).connect(this.master);
    this.crecimiento.connect(this.reverb);
    this._capa('crecimiento', () =>
      [146.83, 220, 293.66, 349.23].map((f, i) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = rr(-7, 7);
        const g = this._gain(0.028 / (1 + i * 0.4));
        o.connect(g).connect(this.crecFiltro);
        return o;
      })
    );

    /* Capa 5 · red: un acorde suave que respira (el bosque regresa por la capa 1) */
    this.red = this._gain(0);
    const redF = this._filtro('lowpass', 1200);
    redF.connect(this.red).connect(this.master);
    this.red.connect(this.reverb);
    this._capa('red', () => {
      const fuentes = [];
      [73.42, 146.83, 220, 277.18, 329.63].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = this._gain(0.06 / (1 + i * 0.6));
        const l = c.createOscillator();
        l.frequency.value = 0.05 + i * 0.013;
        const lg = this._gain(0.03 / (1 + i * 0.6));
        l.connect(lg).connect(g.gain);
        o.connect(g).connect(redF);
        fuentes.push(o, l);
      });
      return fuentes;
    });

    /* Voces espaciales de los dos organismos (escenas 3 y 4) */
    this.voces = {
      hongo: this._voz('hongo', [73.42, 110.0, 146.8], 'triangle', 380),
      alga: this._voz('alga', [587.3, 880, 1174.7], 'sine', 2600, true),
    };
  }

  /** Registra una capa perezosa: construir() crea, conecta y devuelve sus fuentes (sin arrancar). */
  _capa(nombre, construir) {
    this.capas[nombre] = {construir, fuentes: [], on: false, silencioDesde: this.ctx.currentTime};
  }

  /** Enciende la capa si debe sonar; la apaga tras 5 s de silencio sostenido. */
  _gestionarCapa(nombre, objetivo) {
    const k = this.capas[nombre];
    if (!k) return;
    const ahora = this.ctx.currentTime;
    if (objetivo > 0.001) {
      k.silencioDesde = -1;
      if (!k.on) {
        k.fuentes = k.construir();
        k.fuentes.forEach((f) => f.start());
        k.on = true;
      }
    } else if (k.silencioDesde < 0) {
      k.silencioDesde = ahora;
    } else if (k.on && ahora - k.silencioDesde > 5) {
      k.fuentes.forEach((f) => {
        try {
          f.stop();
          f.disconnect();
        } catch (e) {
          /* ya detenida */
        }
      });
      k.fuentes = [];
      k.on = false;
    }
  }

  _voz(nombre, freqs, tipo, corte, tremolo = false) {
    const c = this.ctx;
    const panner = this._panner();
    const g = this._gain(0);
    const f = this._filtro('lowpass', corte);
    f.connect(g).connect(panner);
    panner.connect(this.master);
    panner.connect(this.reverb);
    this._capa('voz' + nombre, () => {
      const fuentes = [];
      freqs.forEach((fr, i) => {
        const o = c.createOscillator();
        o.type = tipo;
        o.frequency.value = fr;
        o.detune.value = rr(-6, 6);
        const og = this._gain(0.15 / (i + 1));
        if (tremolo) {
          const l = c.createOscillator();
          l.frequency.value = 3 + i * 1.7;
          const lg = this._gain(0.05 / (i + 1));
          l.connect(lg).connect(og.gain);
          fuentes.push(l);
        }
        o.connect(og).connect(f);
        fuentes.push(o);
      });
      return fuentes;
    });
    return {panner, gain: g};
  }
  _panner() {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.8;
    p.rolloffFactor = 1;
    return p;
  }
  _situarPanner(p, x, y, z) {
    if (p.positionX) {
      const t = this.ctx.currentTime;
      p.positionX.setTargetAtTime(x, t, 0.05);
      p.positionY.setTargetAtTime(y, t, 0.05);
      p.positionZ.setTargetAtTime(z, t, 0.05);
    } else p.setPosition(x, y, z);
  }

  /* ---------------- control por cuadro ---------------- */
  /** Ajusta un parámetro sólo si cambió de forma apreciable. */
  nivel(nombre, param, v, tau = 0.8) {
    if (!this.ctx || !param) return;
    if (Math.abs((this._ult[nombre] ?? -999) - v) < 0.004 * Math.max(1, Math.abs(v))) return;
    this._ult[nombre] = v;
    param.setTargetAtTime(v, this.ctx.currentTime, tau);
  }

  /**
   * Mezcla objetivo de las capas.
   * bosque 0-1 · claridad 0-1 (filtro del bosque) · lentitud 0-1 (ralentiza el bosque)
   * mineral, micro, crecimiento, red 0-1
   */
  mezcla(m, tau = 1.5) {
    if (!this.ctx) return;
    Object.assign(this.mezclaActual, m);
    const k = this.mezclaActual;
    this.nivel('bosque', this.bosque.gain, k.bosque * 0.9, tau);
    this.nivel('claridad', this.bosqueFiltro.frequency, Math.round(lerp(220, 9000, Math.pow(k.claridad, 2)) / 10) * 10, tau);
    const rate = Math.round(lerp(1, 0.32, k.lentitud) * 100) / 100;
    this.fuentesBosque.forEach((s, i) => this.nivel('rate' + i, s.playbackRate, rate, tau));
    this.nivel('mineral', this.mineral.gain, k.mineral * 0.42, tau);
    this.nivel('micro', this.micro.gain, k.micro, tau);
    this.nivel('crec', this.crecimiento.gain, k.crecimiento * 0.8, tau);
    this.nivel('crecF', this.crecFiltro.frequency, Math.round(lerp(300, 2200, k.crecimiento) / 10) * 10, tau);
    this.nivel('red', this.red.gain, k.red * 0.5, tau);
    this._gestionarCapa('mineral', k.mineral);
    this._gestionarCapa('micro', k.micro);
    this._gestionarCapa('crecimiento', k.crecimiento);
    this._gestionarCapa('red', k.red);
    // voces: si ninguna escena las pidió en el último cuadro, se apagan
    this._vozPedida = this._vozPedida || {};
    for (const n of ['hongo', 'alga']) {
      if (!this._vozPedida[n]) {
        this.nivel('voz' + n, this.voces[n].gain.gain, 0, 1);
        this._gestionarCapa('voz' + n, 0);
      }
      this._vozPedida[n] = false;
    }
  }

  oyente(pos, fwd, up) {
    if (!this.ctx) return;
    this._oyX = pos.x;
    this._oyZ = pos.z;
    const L = this.ctx.listener;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.03);
      L.positionY.setTargetAtTime(pos.y, t, 0.03);
      L.positionZ.setTargetAtTime(pos.z, t, 0.03);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.03);
      L.forwardY.setTargetAtTime(fwd.y, t, 0.03);
      L.forwardZ.setTargetAtTime(fwd.z, t, 0.03);
      L.upX.setTargetAtTime(up.x, t, 0.03);
      L.upY.setTargetAtTime(up.y, t, 0.03);
      L.upZ.setTargetAtTime(up.z, t, 0.03);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }
  situarVoz(nombre, v) {
    if (this.ctx) this._situarPanner(this.voces[nombre].panner, v.x, v.y, v.z);
  }
  nivelVoz(nombre, v, tau = 1) {
    if (!this.ctx) return;
    this.nivel('voz' + nombre, this.voces[nombre].gain.gain, v, tau);
    this._gestionarCapa('voz' + nombre, v);
    (this._vozPedida = this._vozPedida || {})[nombre] = true;
  }

  /* ---------------- eventos ---------------- */
  /** Canto breve, descendente, inspirado en el chucao; se ubica en el espacio. */
  ave(pos, vol = 0.07) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const p = this._panner();
    p.refDistance = 2;
    this._situarPanner(p, pos.x, pos.y, pos.z);
    const salida = this._gain(1);
    salida.connect(p);
    p.connect(this.bosqueFiltro);
    const notas = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < notas; i++) {
      const t = t0 + i * 0.17;
      const o = c.createOscillator();
      const f0 = 950 + rnd() * 250 - i * 70;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.13);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(salida);
      o.start(t);
      o.stop(t + 0.17);
    }
    setTimeout(() => p.disconnect(), (notas * 0.17 + 0.5) * 1000);
  }

  /** Gota de agua sobre hojas */
  gota(pos) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const p = this._panner();
    this._situarPanner(p, pos.x, pos.y, pos.z);
    p.connect(this.bosqueFiltro);
    const o = c.createOscillator();
    const f = rr(1800, 3400);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(p);
    o.start(t);
    o.stop(t + 0.1);
    setTimeout(() => p.disconnect(), 400);
  }

  /** Pulsación orgánica grave (mundo microscópico) */
  pulso(fuerza = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(64, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * fuerza, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.microEventos);
    o.start(t);
    o.stop(t + 0.55);
  }

  /** Microclic: un grano de ruido muy corto y filtrado */
  clic(vol = 0.05) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.bufBlanco;
    const f = this._filtro('bandpass', rr(2500, 7000), 6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const st = this._panner();
    this._situarPanner(st, rr(-1, 1) + (this._oyX || 0), rr(0.5, 2), rr(-1.5, 0.5) + (this._oyZ || 0));
    s.connect(f).connect(g).connect(st).connect(this.microEventos);
    s.start(t, rnd() * 2);
    s.stop(t + 0.04);
    setTimeout(() => st.disconnect(), 300);
  }

  campana(freq, vol = 0.2, dur = 3.5) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [1, 2.01, 3.98].forEach((m, i) => {
      const o = c.createOscillator();
      o.frequency.value = freq * m;
      const og = this._gain([1, 0.4, 0.18][i]);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
    g.connect(this.master);
    g.connect(this.reverb);
  }
  acorde(base = 146.83, vol = 0.12) {
    [1, 1.5, 2, 2.4, 3].forEach((m, i) => setTimeout(() => this.campana(base * m, vol, 6), i * 150));
  }
  /** Nota de crecimiento al azar en la escala */
  brote(vol = 0.08) {
    this.campana(ESCALA[Math.floor(rnd() * ESCALA.length)] * (rnd() < 0.3 ? 2 : 1), vol, 4);
  }

  /** Soplo: ráfaga de ruido que se abre y se apaga (acompaña la exhalación) */
  soplo(fuerza = 0.7) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.bufMarron;
    const f = this._filtro('bandpass', 1100, 0.6);
    f.frequency.setValueAtTime(1300, t);
    f.frequency.exponentialRampToValueAtTime(380, t + 2.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * clamp(fuerza, 0.3, 1), t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    s.connect(f).connect(g).connect(this.master);
    g.connect(this.reverb);
    s.start(t, rnd() * 1.2);
    s.stop(t + 2.5);
  }

  /** Retumbo geológico */
  retumbo(vol = 0.4) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.bufMarron;
    const f = this._filtro('lowpass', 85);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 3.1);
  }
}

export const sonido = new Sonido();
