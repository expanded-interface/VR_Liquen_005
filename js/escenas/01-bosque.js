/**
 * ESCENA 1 · El bosque presente: habitar un paisaje (≈62 s)
 * Inicio: dentro del bosque (Gaussian Splat o bosque procedural). Roca con liquen a 1 m.
 * Interacción: ninguna. Sólo mirar y escuchar.
 * Final: la atención se concentra en el liquen (brillo tenue, niebla que se cierra,
 * el bosque baja de volumen). Pasa sin corte a la escena 2.
 */
import {suave, ventana, rr} from '../nucleo/utilidades.js';

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    const conSplat = ctx.splatListo;
    s.macro = 1;
    s.zoom = 1;
    s.splat = conSplat ? suave(0, 4, t) : 0;
    s.tinteSplat = 1;
    s.procedural = conSplat ? 0 : 1;
    s.bosque = conSplat ? 0 : 1;
    s.fauna = conSplat ? 0 : 0.45; // ranita y chucao en el bosque de respaldo
    s.noche = 0;
    s.talo.crece = 1;
    s.talo.detalle = 0;
    // la atención se dirige hacia el liquen en el último tercio
    s.talo.brillo = suave(36, 56, t) * 0.5 + ventana(36, 44, 44, 52, t) * 0.25;
    s.roca.liquen = 0.8;
    s.roca.musgo = 0.6;
    s.roca.suelo = 0.5;
    s.entorno.liquen = 0.7;
    s.entorno.musgo = 0.85;
    s.entorno.suelo = 0.6;
    s.atmos.a = 'bosque';
    s.atmos.b = 'liquen';
    s.atmos.t = suave(42, 62, t) * 0.25;
    s.esporas = 0.18 + suave(40, 60, t) * 0.12;
    s.colorEsporas.setRGB(0.85, 0.9, 0.75);
    s.red.alfa = 0;
    s.netBase = 0;
    s.micro.encuentro = s.micro.intimo = 0;
    // halos casi imperceptibles: relaciones invisibles
    s.red.alfa = 0.12 * suave(8, 20, t) * (1 - suave(44, 60, t));
    s.red.frente = 0.35;
    s.red.color.setRGB(0.6, 0.85, 0.75);
    s.red.troncos = conSplat ? 0 : 1;
    s.red.aire = 0;
    s.red.halos = 0.4;
    s.red.nube = 0.15;

    ctx.sonido.mezcla({
      bosque: (1 - suave(48, 62, t) * 0.3) * suave(0, 3, t),
      claridad: 1 - suave(48, 62, t) * 0.25,
      lentitud: 0,
      mineral: suave(50, 62, t) * 0.15,
      micro: 0,
      crecimiento: 0,
      red: 0,
    });
    // vida sonora alrededor
    ctx.cada('ave', 4, 9, () => ctx.sonido.ave(ctx.puntoAlrededor(rr(4, 12), rr(1, 6))));
    ctx.cada('gota', 0.7, 2.5, () => ctx.sonido.gota(ctx.puntoAlrededor(rr(1, 5), rr(0.5, 3))));
    if (t > 46) ctx.cada('nota-liquen', 5, 7, () => ctx.sonido.campana(293.66, 0.05, 5));
  },
};
