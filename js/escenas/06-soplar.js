/**
 * ESCENA 6 · Soplar para expandir la vida (espera ≤28 s + respuesta ≈30 s)
 * Frente al visitante: la roca parcialmente colonizada. Una pregunta discreta invita a soplar.
 * Soplo sin micrófono (js/sistemas/soplido.js): mano a la boca y abrirla hacia la roca,
 * o mantener el gatillo / pellizco, o tecla B. Si nadie actúa, la secuencia sigue sola.
 * Respuesta: esporas que salen de la boca hacia la roca y se posan, filamentos que se
 * ramifican por el suelo, colonias nuevas en otras rocas, primeros musgos y helechos.
 * Una exhalación contribuye; no crea un bosque por sí sola.
 */
import * as THREE from 'three';
import {suave, lerp, clamp, vibrar} from '../nucleo/utilidades.js';
import {ESCENAS} from '../config.js';

const CFG = ESCENAS[5];
const _q = new THREE.Quaternion();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

export default {
  entrar(ctx) {
    this.tSoplo = null;
    this.ultimaRafaga = -99;
    this.ayudaMostrada = false;
    ctx.soplido.reiniciar();
    ctx.mundo.dispersion.apagar();
  },

  terminada(ctx, t) {
    return this.tSoplo !== null && t - this.tSoplo >= CFG.duracion;
  },

  /** Progreso global 0-1 para la línea de tiempo */
  progreso(t) {
    return this.tSoplo === null ? clamp(t / CFG.esperaMaxima) * 0.3 : 0.3 + 0.7 * clamp((t - this.tSoplo) / CFG.duracion);
  },

  _rafaga(ctx, t, s) {
    const m = ctx.mundo;
    m.zoom.worldToLocal(_o.copy(s.origen));
    _q.copy(m.raiz.quaternion).invert();
    _d.copy(s.dir).applyQuaternion(_q);
    m.dispersion.disparar(_o, _d, s.fuerza, ctx.reloj, 0);
    ctx.sonido.soplo(s.fuerza);
    vibrar(ctx.xb, 0.25 + s.fuerza * 0.4, 220);
    // una onda de luz sale desde la boca
    ctx.emitirOnda(s.origen.x, s.origen.z, 0.5 + s.fuerza * 0.5);
    this.ultimaRafaga = t;
  },

  actualizar(ctx, t, dt) {
    const st = ctx.estado;
    st.macro = 1;
    st.zoom = 1;
    st.splat = 0;
    st.procedural = 1;
    st.fauna = 0;
    st.noche = 0;
    st.solAngulo = 9.5;
    st.micro.encuentro = st.micro.intimo = 0;

    // detección del soplo
    const s = ctx.soplido.actualizar(dt, ctx.cabeza, ctx.fwd, ctx.controladores(), ctx.mantenido > 0) || ctx.consumirSoploTeclado();
    if (this.tSoplo === null) {
      if (t > 7 && !this.ayudaMostrada) {
        this.ayudaMostrada = true;
        ctx.subtitulos.mostrar(CFG.ayuda, {nota: true, duracion: 14});
      }
      if (s && t > 2.5) {
        this.tSoplo = t;
        this._rafaga(ctx, t, s);
        ctx.sonido.acorde(146.83, 0.08);
      } else if (t > CFG.esperaMaxima) {
        // la vida se dispersa igual: el viento también sopla
        this.tSoplo = t;
        this._rafaga(ctx, t, ctx.soplido.automatico(ctx.cabeza, ctx.fwd, 0.6));
      }
    } else if (s && t - this.ultimaRafaga > 3) {
      this._rafaga(ctx, t, s); // soplos extra: más esporas, misma ecología
    }

    const r = this.tSoplo === null ? 0 : t - this.tSoplo;
    const h = this.tSoplo === null ? 0 : 1;
    // invitación: el talo respira y responde a la mano cerca de la boca
    const cerca = ctx.soplido.cercania;
    st.talo.brillo = (1 - h) * (0.12 + 0.1 * Math.sin(t * 1.6) + cerca * 0.35) + h * 0.2 * (1 - suave(0, 6, r));
    st.talo.crece = lerp(0.75, 1, suave(2, 24, r) * h);
    st.talo.detalle = 0;
    st.roca.liquen = lerp(0.45, 0.8, suave(3, 22, r) * h);
    st.roca.musgo = lerp(0.25, 0.55, suave(8, 28, r) * h);
    st.roca.suelo = lerp(0.5, 0.6, suave(8, 28, r) * h);
    st.entorno.liquen = lerp(0.15, 0.6, suave(4, 24, r) * h);
    st.entorno.musgo = lerp(0.05, 0.3, suave(10, 30, r) * h);
    st.entorno.suelo = lerp(0.15, 0.45, suave(6, 30, r) * h);
    st.bosque = 0.08 * suave(16, 30, r) * h;
    st.atmos.a = 'pasado';
    st.atmos.b = 'bosque';
    st.atmos.t = 0.35 * suave(6, 30, r) * h;
    st.esporas = 0.12 + cerca * 0.2 * (1 - h);
    st.colorEsporas.setRGB(0.85, 0.9, 0.78);
    // filamentos de colonización que se ramifican desde la roca
    st.red.alfa = suave(1, 4, r) * h;
    st.red.frente = suave(1, 24, r) * h;
    st.red.color.setRGB(0.72, 0.96, 0.6);
    st.red.troncos = 0;
    st.red.aire = 0;
    st.red.halos = 0.3;
    st.red.nube = 0;
    st.netBase = 0;

    ctx.sonido.mezcla({
      bosque: lerp(0.12, 0.25, suave(4, 30, r) * h),
      claridad: lerp(0.4, 0.55, suave(4, 30, r) * h),
      lentitud: lerp(0.55, 0.35, suave(4, 30, r) * h),
      mineral: lerp(0.6, 0.3, suave(0, 20, r) * h),
      micro: 0.15 * (1 - h) + 0.1 * h,
      crecimiento: 0.5 + 0.3 * suave(0, 10, r) * h,
      red: 0.15 * h * (1 - suave(20, 30, r)),
    });
    if (h) ctx.cada('brote', 0.7, 1.8, () => ctx.sonido.brote(0.06));
    else ctx.cada('respira', 4, 4.5, () => ctx.sonido.campana(220, 0.03, 4));
  },
};
