/**
 * ESCENA 8 · La red invisible: formar parte del ecosistema (≈70 s y luego abierta)
 * Anochece. Desde la roca nacen filamentos luminosos que recorren el suelo hacia rocas y árboles,
 * suben por los troncos y algunos cruzan a la altura del pecho por donde está el visitante.
 * Halos que respiran, nubes de puntos que emergen de las superficies y atraviesan el campo visual.
 * Con el splat, el bosque se oscurece con recolor de Spark y la red se dibuja encima.
 * Gestos opcionales: mover las manos o presionar el gatillo envía pulsos por la red.
 * Al terminar la narración, la escena queda abierta: el visitante se queda el tiempo que quiera.
 */
import * as THREE from 'three';
import {suave, lerp, rr, TAU, clamp} from '../nucleo/utilidades.js';

const _p = new THREE.Vector3();

export default {
  entrar(ctx) {
    this.manos = [];
    this.notaFinal = false;
  },

  terminada() {
    return false; // la escena final no se cierra sola
  },

  actualizar(ctx, t, dt) {
    const s = ctx.estado;
    const conSplat = ctx.splatListo;
    s.macro = 1;
    s.zoom = 1;
    s.solAngulo = 9.5;
    s.nieblaExtra = 0;
    s.micro.encuentro = s.micro.intimo = 0;
    s.noche = suave(0, 14, t) * 0.88;
    s.tinteSplat = lerp(1, 0.32, suave(0, 14, t));
    s.talo.brillo = suave(8, 20, t) * 0.3;

    s.red.alfa = suave(4, 12, t);
    s.red.frente = suave(6, 40, t);
    s.red.color.setRGB(0.56, 0.96, 0.81);
    s.red.troncos = conSplat ? 0 : 1;
    s.red.aire = suave(20, 34, t);
    s.red.halos = suave(10, 22, t);
    s.red.nube = suave(16, 30, t);
    s.netBase = suave(10, 40, t) * 0.8;
    s.esporas = 0.18 + suave(10, 30, t) * 0.25;
    s.colorEsporas.setRGB(0.6, 0.95, 0.85);
    s.fauna = conSplat ? 0.49 : 1;

    // pulsos periódicos desde la roca y desde el visitante
    if (t > 8) {
      ctx.cada('onda-roca', 2.4, 3.6, () => {
        ctx.mundo.rocaMundo(_p);
        ctx.emitirOnda(_p.x, _p.z, 0.7);
        ctx.sonido.brote(0.05);
      });
    }
    if (t > 22) {
      ctx.cada('onda-cuerpo', 5, 8, () => ctx.emitirOnda(ctx.cabeza.x, ctx.cabeza.z, 0.6));
      ctx.cada('onda-lejos', 1.5, 3, () => {
        const a = rr(0, TAU);
        const d = rr(2, 10);
        ctx.emitirOnda(ctx.cabeza.x + Math.cos(a) * d, ctx.cabeza.z + Math.sin(a) * d, 0.5);
      });
    }
    // gestos opcionales: un movimiento rápido de mano envía luz por la red
    const ctrls = ctx.controladores();
    for (let i = 0; i < ctrls.length; i++) {
      const c = ctrls[i];
      if (!c || !c.visible) {
        this.manos[i] = null;
        continue;
      }
      c.getWorldPosition(_p);
      const m = this.manos[i];
      if (!m) {
        this.manos[i] = {p: _p.clone(), t: 0};
        continue;
      }
      const vel = _p.distanceTo(m.p) / Math.max(dt, 1e-3);
      m.p.copy(_p);
      if (t > 10 && vel > 1.0 && vel < 8 && ctx.reloj - m.t > 0.45) {
        m.t = ctx.reloj;
        ctx.emitirOnda(_p.x, _p.z, clamp(vel / 3, 0.4, 0.9));
        ctx.sonido.brote(0.05);
      }
    }
    if (t > 10 && ctx.toque()) {
      ctx.emitirOnda(ctx.cabeza.x, ctx.cabeza.z, 0.9);
      ctx.sonido.acorde(146.83, 0.06);
    }

    ctx.sonido.mezcla({
      bosque: lerp(1, 0.55, suave(0, 16, t)),
      claridad: lerp(1, 0.65, suave(0, 16, t)),
      lentitud: 0,
      mineral: 0.08,
      micro: 0.08 + suave(10, 30, t) * 0.15, // las texturas celulares vuelven, como memoria
      crecimiento: lerp(0.2, 0.12, suave(0, 20, t)),
      red: suave(4, 22, t),
    });
    if (t < 20) ctx.cada('ave', 6, 12, () => ctx.sonido.ave(ctx.puntoAlrededor(rr(5, 12), rr(1, 6)), 0.05));
    ctx.cada('gota', 1.2, 3, () => ctx.sonido.gota(ctx.puntoAlrededor(rr(1, 5), rr(0.5, 3))));

    if (t > 74 && !this.notaFinal) {
      this.notaFinal = true;
      ctx.subtitulos.mostrar('Puedes quedarte el tiempo que quieras. Con la línea de tiempo vuelves a cualquier momento.', {nota: true, duracion: 9});
    }
  },
};
