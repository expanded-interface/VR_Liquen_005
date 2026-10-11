/**
 * ESCENA 7 · El bosque maduro: una vida entrelazada (≈66 s)
 * Sucesión legible: roca → líquenes → musgos → helechos y nalcas → arrayanes → dosel de olivillos
 * → copihue y barba de viejo. La fauna aparece integrada: ranita de Darwin junto a la roca,
 * chucao saltando entre las nalcas, ciervo volante en la corteza del olivillo.
 * Si existe el Gaussian Splat, al final una neblina costera cubre el claro y, al abrirse,
 * el bosque reconstruido ocupa el lugar del procedural (no se superponen nunca).
 */
import {suave, lerp, ventana, rr} from '../nucleo/utilidades.js';

const CAMBIO = 57; // segundo en que la niebla está en su punto más denso

export default {
  entrar() {},

  actualizar(ctx, t) {
    const s = ctx.estado;
    const conSplat = ctx.splatListo;
    s.macro = 1;
    s.zoom = 1;
    s.noche = 0;
    s.solAngulo = 9.5;
    s.micro.encuentro = s.micro.intimo = 0;

    const crec = lerp(0.08, 1, suave(3, 54, t));
    s.entorno.musgo = lerp(0.3, 0.85, suave(0, 30, t));
    s.entorno.liquen = lerp(0.6, 0.7, suave(0, 30, t));
    s.entorno.suelo = lerp(0.45, 0.6, suave(0, 30, t));
    s.roca.liquen = 0.8;
    s.roca.musgo = lerp(0.55, 0.6, suave(0, 20, t));
    s.roca.suelo = lerp(0.6, 0.5, suave(0, 20, t));
    s.talo.crece = 1;
    s.talo.brillo = 0;
    s.atmos.a = 'pasado';
    s.atmos.b = 'bosque';
    s.atmos.t = lerp(0.35, 1, suave(0, 42, t));
    // los filamentos de colonización se hunden en el suelo: ahora son raíces y micelio
    s.red.alfa = 1 - suave(0, 10, t);

    // neblina costera para cambiar al splat sin que se vea la costura
    const velo = conSplat ? ventana(49, 55, 59, 65, t) : 0;
    s.nieblaExtra = velo;
    const yaSplat = conSplat && t >= CAMBIO;
    s.splat = yaSplat ? 1 - velo : 0; // los splats no reciben la niebla de three: se funden con ella
    s.tinteSplat = 1;
    s.procedural = yaSplat ? 0 : 1;
    s.bosque = yaSplat ? 0 : crec;
    // con splat sólo queda la fauna del suelo (sus troncos procedurales desaparecen)
    const fauna = suave(28, 56, t);
    s.fauna = yaSplat ? Math.min(fauna, 0.49) : fauna;
    s.esporas = 0.18;
    s.colorEsporas.setRGB(0.75, 0.9, 0.65);

    ctx.sonido.mezcla({
      bosque: lerp(0.25, 1, suave(4, 46, t)),
      claridad: lerp(0.55, 1, suave(4, 46, t)),
      lentitud: lerp(0.35, 0, suave(0, 30, t)),
      mineral: lerp(0.3, 0, suave(0, 24, t)),
      micro: 0.1 * (1 - suave(20, 40, t)) + 0.08, // memoria celular
      crecimiento: lerp(0.8, 0.2, suave(20, 60, t)),
      red: 0.15 * (1 - suave(0, 10, t)),
    });
    if (t > 6) ctx.cada('brote', 1.4, 3.5, () => ctx.sonido.brote(0.04));
    if (t > 20) ctx.cada('ave', lerp(10, 4, suave(20, 60, t)), lerp(16, 8, suave(20, 60, t)), () => ctx.sonido.ave(ctx.puntoAlrededor(rr(4, 12), rr(1, 6))));
    if (t > 30) ctx.cada('gota', 0.8, 2.6, () => ctx.sonido.gota(ctx.puntoAlrededor(rr(1, 5), rr(0.5, 3))));
    const canto = ctx.mundo.cantoChucao(ctx.tmp);
    if (canto) ctx.sonido.ave(canto, 0.09);
  },
};
