/**
 * ESCENA 2 · La transformación: convertirse en liquen (≈46 s)
 * No se mueve la cámara (comodidad): el mundo crece alrededor del centro del talo hasta ×70.
 * El visitante queda flotando sobre el centro viejo del liquen, rodeado de lóbulos de varios metros.
 * El splat del bosque se desvanece y sale de escena en cuanto deja de verse (ahorro de GPU).
 * Sonido: el bosque se ralentiza y se filtra hasta volverse resonancia mineral.
 */
import {suave, easeInOut, lerp} from '../nucleo/utilidades.js';
import {LUGAR} from '../config.js';

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    const conSplat = ctx.splatListo;
    // progreso del viaje de escala (exponencial: cada segundo multiplica el tamaño por lo mismo)
    const e = easeInOut(suave(2, 34, t) * 1);
    const zoom = Math.pow(LUGAR.escalaMicro, e);
    s.macro = 1;
    s.zoom = zoom;
    s.splat = conSplat ? 1 - suave(1.6, 5, zoom) : 0;
    s.tinteSplat = lerp(1, 0.6, suave(1, 4, zoom));
    s.procedural = conSplat ? 0 : 1;
    s.bosque = conSplat ? 0 : 1;
    s.fauna = conSplat ? 0 : 0.45 * (1 - suave(1, 3, zoom));
    s.talo.crece = 1;
    s.talo.detalle = suave(3, 45, zoom);
    s.talo.brillo = 0.5 * (1 - suave(1, 6, zoom));
    s.roca.liquen = 0.8;
    s.roca.musgo = 0.6;
    s.roca.suelo = 0.5;
    if (t < 34) {
      s.atmos.a = 'bosque';
      s.atmos.b = 'liquen';
      s.atmos.t = lerp(0.25, 1, e);
    } else {
      // el paisaje del liquen se pierde en una niebla verde oscura: hacia las células
      s.atmos.a = 'liquen';
      s.atmos.b = 'micro';
      s.atmos.t = suave(34, 46, t) * 0.35;
    }
    s.esporas = 0.3 + suave(20, 40, t) * 0.25;
    s.colorEsporas.setRGB(0.85, 0.9, 0.75);
    s.red.alfa = 0;

    ctx.sonido.mezcla({
      bosque: lerp(0.7, 0.5, e),
      claridad: lerp(0.75, 0.15, e),
      lentitud: e,
      mineral: lerp(0.15, 0.8, e),
      micro: suave(34, 46, t) * 0.2,
      crecimiento: 0,
      red: 0,
    });
    if (t > 6 && t < 30) ctx.cada('retumbo', 7, 11, () => ctx.sonido.retumbo(0.25));
    if (t > 30) ctx.cada('clic', 0.4, 1.4, () => ctx.sonido.clic(0.03));
  },
};
