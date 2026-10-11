/**
 * ESCENA 4 · Hiperclose-up: la intimidad celular (≈52 s)
 * El encuentro se amplía alrededor de un punto de contacto hasta que una sola célula del alga
 * mide casi un metro. Las hifas llegan, la envuelven y se aprietan contra su pared (apresorios).
 * Flujos de luz cálida salen del alga hacia el hongo: polioles producto de la fotosíntesis.
 * Sonido reducido a pulsaciones y microvibraciones. La escena deja tiempo para quedarse.
 */
import {suave, lerp} from '../nucleo/utilidades.js';

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    s.macro = 0;
    s.zoom = 70;
    s.splat = 0;
    s.bosque = 0;
    s.atmos.a = 'liquen';
    s.atmos.b = 'micro';
    s.atmos.t = 1;
    s.esporas = 0.35 - suave(0, 8, t) * 0.15;
    s.colorEsporas.setRGB(0.7, 0.85, 0.75);
    s.roca.liquen = s.roca.musgo = s.roca.suelo = 0;
    s.entorno.liquen = s.entorno.musgo = s.entorno.suelo = 0;

    const m = s.micro;
    m.hongo = 1;
    m.alga = 1;
    m.union = 1;
    m.zoom = lerp(1, 9, suave(0, 8, t));
    m.encuentro = 1 - suave(3, 8, t);
    m.intimo = suave(3, 9, t);
    m.envolver = suave(6, 30, t);
    m.intercambio = suave(22, 34, t);
    m.retirada = 0;

    ctx.sonido.mezcla({
      bosque: 0.03,
      claridad: 0.15,
      lentitud: 1,
      mineral: 0.25,
      micro: lerp(0.7, 0.95, suave(0, 20, t)),
      crecimiento: 0.25 * (1 - suave(0, 10, t)),
      red: 0,
    });
    ctx.sonido.nivelVoz('hongo', 0.32 * (1 - suave(0, 8, t)));
    ctx.sonido.nivelVoz('alga', 0.18 * (1 - suave(0, 8, t)));
    ctx.cada('pulso', 2.4, 3.2, () => ctx.sonido.pulso(0.45));
    ctx.cada('clic', 0.25, 0.9, () => ctx.sonido.clic(0.03 + m.intercambio * 0.02));
    if (m.intercambio > 0.3) ctx.cada('flujo', 3, 5, () => ctx.sonido.campana(587.33, 0.025, 3));
  },
};
