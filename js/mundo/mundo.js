/**
 * El mundo completo y su estado visual.
 * Las escenas sólo escriben valores en `mundo.estado`; aquí se traducen a objetos, uniforms y luces.
 * Así cada escena es una función del tiempo y los saltos de la línea de tiempo son seguros.
 *
 * Jerarquía:
 *  raiz (centrada en el visitante y orientada hacia donde miraba al comenzar)
 *   ├─ zoom (se escala alrededor del talo: el viaje de escala)
 *   │   ├─ splat (Sistema A) · paisaje · talo · bosque · fauna · red · dispersión
 *   ├─ micro (escala celular, siempre a escala humana de presentación)
 *   └─ esporas
 */
import * as THREE from 'three';
import {U, materialCielo} from './materiales.js';
import {Paisaje} from './paisaje.js';
import {crearTalo} from './liquen.js';
import {Bosque} from './bosque.js';
import {Fauna} from './fauna.js';
import {Red} from './red.js';
import {Micro} from './micro.js';
import {Esporas, Dispersion} from './particulas.js';
import {lerp} from '../nucleo/utilidades.js';
import {LUGAR, CALIDAD} from '../config.js';

const C = (h) => new THREE.Color(h);
const NEBLINA = new THREE.Color(0x8a968c);

/** Atmósferas de referencia; las escenas mezclan entre ellas. */
export const ATMOS = {
  bosque: {top: C(0x5b6e60), bot: C(0x2a352c), niebla: C(0x4a5a4e), dens: 0.05, luz: new THREE.Color(0.78, 0.82, 0.66), amb: new THREE.Color(0.17, 0.22, 0.16), hemi: 1.1, sol: 1.0},
  liquen: {top: C(0x2b3a26), bot: C(0x121a10), niebla: C(0x26331f), dens: 0.035, luz: new THREE.Color(0.85, 0.85, 0.7), amb: new THREE.Color(0.16, 0.2, 0.13), hemi: 1.0, sol: 0.9},
  micro: {top: C(0x07130f), bot: C(0x050e0b), niebla: C(0x05100d), dens: 0.22, luz: new THREE.Color(0.35, 0.45, 0.4), amb: new THREE.Color(0.06, 0.09, 0.08), hemi: 0.3, sol: 0.2},
  pasado: {top: C(0x4a4d50), bot: C(0x26282a), niebla: C(0x404346), dens: 0.045, luz: new THREE.Color(0.95, 0.92, 0.85), amb: new THREE.Color(0.14, 0.14, 0.14), hemi: 0.9, sol: 1.3},
  noche: {top: C(0x0a1418), bot: C(0x03070a), niebla: C(0x050b0c), dens: 0.06, luz: new THREE.Color(0.1, 0.13, 0.14), amb: new THREE.Color(0.05, 0.07, 0.06), hemi: 0.18, sol: 0.05},
};

export class Mundo {
  constructor(xb, splat) {
    this.xb = xb;
    this.splat = splat;
    this.raiz = new THREE.Group();
    this.raiz.name = 'mundo';
    this.zoom = new THREE.Group();
    this.raiz.add(this.zoom);

    this.rocaPos = new THREE.Vector3(0, 0, -LUGAR.rocaDistancia);
    this.pivote = new THREE.Vector3(0, LUGAR.rocaAltura, -LUGAR.rocaDistancia);

    // Luces para los materiales estándar de three (fauna, copas, helechos)
    this.hemi = new THREE.HemisphereLight(0x9fb7a0, 0x0d0d08, 1);
    this.sol = new THREE.DirectionalLight(0xfff1dc, 1);
    this.sol.position.set(4, 10, 3);
    this.raiz.add(this.hemi, this.sol);

    this.cielo = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), materialCielo());
    this.cielo.renderOrder = -10;
    this.cielo.frustumCulled = false;
    this.cielo.raycast = () => {};

    this.zoom.add(splat.contenedor);
    this.paisaje = new Paisaje({rocaPos: this.rocaPos, rocaRadio: LUGAR.rocaRadio, rocaAltura: LUGAR.rocaAltura});
    this.zoom.add(this.paisaje.grupo);
    this.talo = crearTalo();
    this.talo.position.copy(this.pivote);
    this.talo.raycast = () => {};
    this.zoom.add(this.talo);
    this.bosque = new Bosque({zonaLibre: this.rocaPos});
    this.zoom.add(this.bosque.grupo);
    this.fauna = new Fauna(this.bosque);
    this.zoom.add(this.fauna.grupo);
    this.red = new Red({rocaPos: this.rocaPos, nodosRoca: this.paisaje.nodosRoca, arboles: this.bosque.nodos()});
    this.zoom.add(this.red.grupo);
    this.dispersion = new Dispersion();
    this.zoom.add(this.dispersion.puntos);

    this.micro = new Micro();
    this.raiz.add(this.micro.grupo);
    this.esporas = new Esporas(CALIDAD.particulas);
    this.raiz.add(this.esporas.puntos);

    this.niebla = new THREE.FogExp2(0x000000, 0.05);
    this.altOjos = 1.6;
    this.estado = this.estadoInicial();
  }

  estadoInicial() {
    return {
      macro: 1, // 0 oculta todo el paisaje macro (cuando la niebla del microcosmos lo cubre)
      splat: 0,
      tinteSplat: 1,
      nieblaExtra: 0, // neblina costera para cambiar de bosque sin costuras
      solAngulo: 0,
      procedural: 1, // suelo y rocas del entorno (se ocultan cuando el splat ocupa el lugar)
      zoom: 1,
      talo: {crece: 1, detalle: 0, brillo: 0},
      roca: {liquen: 0.8, musgo: 0.6, suelo: 0.5},
      entorno: {liquen: 0.7, musgo: 0.8, suelo: 0.6},
      bosque: 1,
      fauna: 0,
      noche: 0,
      atmos: {a: 'bosque', b: 'bosque', t: 0},
      esporas: 0.2,
      colorEsporas: C(0xd9e6c0),
      red: {alfa: 0, frente: 0, color: C(0x8ff5cf), troncos: 1, aire: 0, halos: 0, nube: 0},
      micro: {encuentro: 0, hongo: 0, alga: 0, union: 0, zoom: 1, intimo: 0, envolver: 0, intercambio: 0, retirada: 0},
      netBase: 0,
    };
  }

  /**
   * Sistema B: si config.js apunta a un GLB del liquen o de la roca, reemplaza la versión procedural.
   * El GLB del liquen crece por escala (no tiene el shader de crecimiento radial).
   */
  async cargarModelos(modeloOProcedural, MODELOS) {
    const talo = await modeloOProcedural(MODELOS.liquen, () => null);
    if (talo) {
      talo.position.copy(this.pivote);
      talo.traverse((o) => (o.raycast = () => {}));
      this.zoom.add(talo);
      this.taloGLB = talo;
      this.escalaGLB = talo.scale.x;
    }
    const roca = await modeloOProcedural(MODELOS.roca, () => null);
    if (roca) {
      roca.position.set(this.rocaPos.x, 0, this.rocaPos.z);
      roca.traverse((o) => (o.raycast = () => {}));
      this.paisaje.grupo.add(roca);
      this.paisaje.roca.visible = false;
    }
  }

  /** Centra el mundo en el visitante (al entrar en VR o al abrir el simulador) */
  centrar(cabeza, yaw, altOjos) {
    this.raiz.position.set(cabeza.x, 0, cabeza.z);
    this.raiz.rotation.y = yaw;
    this.altOjos = altOjos;
    this.micro.situar(altOjos);
    this.raiz.updateMatrixWorld(true);
  }

  /** Convierte un punto del mundo al espacio local del grupo zoom */
  aLocalZoom(v, out) {
    return this.zoom.worldToLocal(out.copy(v));
  }

  aplicar(dt, reloj, cabeza) {
    const s = this.estado;
    U.uTime.value = reloj;

    // Viaje de escala alrededor del pivote (el centro del talo)
    const z = s.zoom;
    this.zoom.scale.setScalar(z);
    this.zoom.position.copy(this.pivote).multiplyScalar(1 - z);
    this.zoom.visible = s.macro > 0.5;
    // el sol gira alrededor del eje vertical (tiempo condensado de la escena 5)
    U.uLightDir.value.set(Math.cos(s.solAngulo + 0.6) * 0.45, 0.8, Math.sin(s.solAngulo + 0.6) * 0.45).normalize();
    this.sol.position.copy(U.uLightDir.value).multiplyScalar(10);

    // Atmósfera
    const A = ATMOS[s.atmos.a];
    const B = ATMOS[s.atmos.b];
    const t = s.atmos.t;
    const cu = this.cielo.material.uniforms;
    cu.uTop.value.copy(A.top).lerp(B.top, t);
    cu.uBot.value.copy(A.bot).lerp(B.bot, t);
    U.uFogColor.value.copy(A.niebla).lerp(B.niebla, t);
    U.uFogDensity.value = lerp(A.dens, B.dens, t);
    U.uLight.value.copy(A.luz).lerp(B.luz, t);
    U.uAmbient.value.copy(A.amb).lerp(B.amb, t);
    this.hemi.intensity = lerp(A.hemi, B.hemi, t);
    this.sol.intensity = lerp(A.sol, B.sol, t);
    // la noche se superpone a cualquier atmósfera
    if (s.noche > 0) {
      const N = ATMOS.noche;
      const n = s.noche;
      cu.uTop.value.lerp(N.top, n);
      cu.uBot.value.lerp(N.bot, n);
      U.uFogColor.value.lerp(N.niebla, n);
      U.uLight.value.lerp(N.luz, n);
      U.uAmbient.value.lerp(N.amb, n);
      this.hemi.intensity = lerp(this.hemi.intensity, N.hemi, n);
      this.sol.intensity = lerp(this.sol.intensity, N.sol, n);
    }
    if (s.nieblaExtra > 0) {
      U.uFogDensity.value += s.nieblaExtra * 0.7;
      U.uFogColor.value.lerp(NEBLINA, s.nieblaExtra * 0.8);
      cu.uTop.value.lerp(NEBLINA, s.nieblaExtra);
      cu.uBot.value.lerp(NEBLINA, s.nieblaExtra);
    }
    this.niebla.color.copy(U.uFogColor.value);
    this.niebla.density = U.uFogDensity.value * 0.9;
    this.cielo.position.copy(cabeza);

    // Sistema A
    this.splat.opacidad = s.splat;
    if (this.splat.listo) {
      const k = s.tinteSplat;
      this.splat.tintar(k, k, k);
    }
    const proc = s.procedural > 0.5;
    this.paisaje.suelo.visible = proc;
    this.paisaje.rocas.visible = proc;

    // Roca, talo y entorno
    this.paisaje.liquenRoca = s.roca.liquen;
    this.paisaje.musgoRoca = s.roca.musgo;
    this.paisaje.sueloRoca = s.roca.suelo;
    U.uLichen.value = s.entorno.liquen;
    U.uMoss.value = s.entorno.musgo;
    U.uSoil.value = s.entorno.suelo;
    U.uNet.value = s.netBase;
    U.uNetColor.value.copy(s.red.color); // ondas y venas comparten el color de la red de cada escena
    const tu = this.talo.material.uniforms;
    tu.uCrece.value = s.talo.crece;
    tu.uDetalle.value = s.talo.detalle;
    tu.uBrillo.value = s.talo.brillo;
    this.talo.visible = !this.taloGLB && s.talo.crece > 0.005;
    if (this.taloGLB) {
      this.taloGLB.visible = s.talo.crece > 0.005;
      this.taloGLB.scale.setScalar(this.escalaGLB * Math.max(0.001, s.talo.crece));
    }

    // Bosque, fauna y red
    this.bosque.aplicar(s.bosque);
    this.ultimoCanto = this.fauna.actualizar(dt, reloj, s.fauna, s.noche);
    this.red.actualizar(reloj, s.red);

    // Microcosmos
    this.micro.actualizar(dt, reloj, s.micro);

    // Esporas
    this.esporas.alfa = s.esporas;
    this.esporas.mat.uniforms.uColor.value.copy(s.colorEsporas);
  }

  /** Posición del chucao (si acaba de cantar) en coordenadas de mundo, para el audio espacial */
  cantoChucao(out) {
    if (!this.ultimoCanto) return null;
    return this.fauna.chucao.getWorldPosition(out);
  }

  bajarCalidad() {
    this.bosque.bajarCalidad();
    this.esporas.recortar(CALIDAD.particulasBaja);
  }

  /** Punto de la roca madre en coordenadas de mundo */
  rocaMundo(out) {
    return this.zoom.localToWorld(out.copy(this.pivote));
  }
}
