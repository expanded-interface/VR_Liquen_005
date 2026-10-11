/**
 * ESCENA 3 · Los ancestros: el encuentro entre el hongo y el alga (≈62 s)
 * En la niebla oscura aparecen dos organismos distintos y reconocibles:
 *   izquierda — red de hifas color crema que crece y explora (con voz grave, espacial)
 *   derecha   — racimo de células verdes con cloroplasto (con voz aguda, espacial)
 * Las hifas se extienden hacia el alga y las células se reparten entre ellas:
 * de dos entidades separadas a una organización compartida.
 * Nada se antropomorfiza: sólo crecimiento, pulsación y contacto.
 */
import {suave, lerp, T} from '../nucleo/utilidades.js';

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    const conSplat = ctx.splatListo;
    s.zoom = 70;
    s.splat = 0;
    s.procedural = conSplat ? 0 : 1;
    s.bosque = conSplat ? 0 : t < 8 ? 1 : 0;
    s.fauna = 0;
    s.talo.crece = 1;
    s.talo.detalle = 1;
    s.talo.brillo = 0;
    s.atmos.a = 'liquen';
    s.atmos.b = 'micro';
    s.atmos.t = lerp(0.35, 1, suave(0, 8, t));
    // con la niebla cerrada, el paisaje macro deja de dibujarse
    s.macro = t < 9 ? 1 : 0;
    if (t >= 9) {
      // el pasado se prepara fuera de la vista: roca desnuda para la escena 5
      s.roca.liquen = s.roca.musgo = s.roca.suelo = 0;
      s.entorno.liquen = s.entorno.musgo = s.entorno.suelo = 0;
    }
    s.esporas = lerp(0.55, 0.35, suave(0, 10, t));
    s.colorEsporas.setRGB(0.7, 0.85, 0.75);

    const m = s.micro;
    m.encuentro = suave(3, 8, t);
    m.hongo = suave(6, 22, t);
    m.alga = suave(14, 24, t);
    m.union = suave(30, 56, t);
    m.zoom = 1;
    m.intimo = 0;
    m.envolver = m.intercambio = m.retirada = 0;

    ctx.sonido.mezcla({
      bosque: lerp(0.5, 0.04, suave(0, 12, t)),
      claridad: 0.15,
      lentitud: 1,
      mineral: lerp(0.8, 0.3, suave(4, 20, t)),
      micro: lerp(0.2, 0.7, suave(4, 24, t)),
      crecimiento: suave(30, 56, t) * 0.25,
      red: 0,
    });
    // voces espaciales de cada organismo: gira la cabeza hacia cada una
    const mic = ctx.mundo.micro;
    mic.hongo.getWorldPosition(T.v1);
    ctx.sonido.situarVoz('hongo', T.v1);
    T.v2.copy(mic.posAlga);
    mic.encuentro.localToWorld(T.v2);
    ctx.sonido.situarVoz('alga', T.v2);
    const fundido = 1 - suave(52, 62, t) * 0.6;
    ctx.sonido.nivelVoz('hongo', m.hongo * 0.8 * fundido);
    ctx.sonido.nivelVoz('alga', m.alga * 0.45 * fundido);
    ctx.cada('pulso', lerp(2.2, 1.3, m.union), lerp(2.6, 1.6, m.union), () => ctx.sonido.pulso(0.5 + m.union * 0.4));
    ctx.cada('clic', 0.3, 1.2, () => ctx.sonido.clic(0.035));
    if (m.union > 0.05 && m.union < 0.98) ctx.cada('contacto', 2.5, 4, () => ctx.sonido.brote(0.05));
  },
};
