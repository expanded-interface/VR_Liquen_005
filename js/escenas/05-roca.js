/**
 * ESCENA 5 · De la célula a la roca: preparar un territorio (≈64 s)
 * A · 0–26 s  La célula se contrae y se aleja; la niebla se abre mientras el mundo vuelve
 *             de ×70 a ×1. El tiempo retrocede: el talo se reduce a un comienzo pequeño
 *             sobre una roca desnuda, en un paisaje mineral sin bosque.
 * B · 26–64 s Tiempo condensado: el liquen crece, la roca se fisura y oscurece con materia
 *             orgánica, aparecen manchas en otras rocas y los primeros musgos.
 * La nota en pantalla aclara que el suelo se forma en siglos o milenios, con agua, clima y otros organismos.
 */
import {suave, lerp, easeInOut} from '../nucleo/utilidades.js';
import {LUGAR} from '../config.js';

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    s.splat = 0;
    s.procedural = 1;
    s.bosque = 0;
    s.fauna = 0;
    s.noche = 0;

    // A · retroceso
    const m = s.micro;
    m.encuentro = 0;
    m.intimo = 1 - suave(12, 18, t);
    m.retirada = suave(0, 16, t);
    m.intercambio = 1 - suave(0, 8, t);
    m.envolver = 1;
    m.zoom = 9;
    s.macro = t > 5 ? 1 : 0;
    const e = easeInOut(suave(6, 26, t));
    s.zoom = Math.pow(LUGAR.escalaMicro, 1 - e);
    s.atmos.a = 'micro';
    s.atmos.b = 'pasado';
    s.atmos.t = suave(6, 24, t);

    // el tiempo retrocede y luego avanza condensado
    const crecer = suave(28, 60, t);
    s.talo.crece = lerp(lerp(1, 0.12, suave(6, 22, t)), 0.75, crecer);
    s.talo.detalle = 1 - suave(6, 22, t);
    s.talo.brillo = 0;
    s.roca.liquen = crecer * 0.45;
    s.roca.suelo = suave(34, 62, t) * 0.5;
    s.roca.musgo = suave(46, 64, t) * 0.25;
    s.entorno.liquen = suave(32, 62, t) * 0.15;
    s.entorno.suelo = suave(36, 64, t) * 0.15;
    s.entorno.musgo = suave(50, 64, t) * 0.05;
    // el sol recorre el cielo varias veces (sin parpadeos de día y noche)
    s.solAngulo = t > 26 ? (t - 26) * 0.25 : 0;

    s.esporas = lerp(0.2, 0.12, suave(0, 20, t));
    s.colorEsporas.setRGB(0.85, 0.85, 0.8);
    s.red.alfa = 0;

    ctx.sonido.mezcla({
      bosque: lerp(0.03, 0.12, suave(10, 26, t)), // sólo viento: aún no hay bosque
      claridad: lerp(0.15, 0.4, suave(10, 26, t)),
      lentitud: lerp(1, 0.55, suave(10, 26, t)),
      mineral: lerp(0.25, 0.6, suave(6, 24, t)),
      micro: lerp(0.95, 0.15, suave(4, 24, t)),
      crecimiento: suave(28, 50, t) * 0.5,
      red: 0,
    });
    if (t < 16) ctx.cada('pulso', 2.6, 3.4, () => ctx.sonido.pulso(0.4 * (1 - t / 16)));
    if (t > 12 && t < 30) ctx.cada('retumbo', 6, 9, () => ctx.sonido.retumbo(0.3));
    if (t > 28) ctx.cada('brote', 1.6, 3.2, () => ctx.sonido.brote(0.05 + crecer * 0.04));
  },
};
