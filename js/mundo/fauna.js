/**
 * Fauna de la selva valdiviana, en formas simples y quietas (low-poly procedural).
 * Pensadas para descubrirse, no para exhibirse. Cada una puede reemplazarse por un GLB.
 *  · Chucao (Scelorchilus rubecula): pecho rufo, cola levantada, salta por el suelo.
 *  · Ranita de Darwin (Rhinoderma darwinii): ~3 cm, hocico puntiagudo, sobre el musgo.
 *  · Ciervo volante (Chiasognathus grantii): macho con mandíbulas largas, sobre un tronco.
 *  · Monito del monte (Dromiciops gliroides): marsupial nocturno; aparece en la escena 8.
 */
import * as THREE from 'three';
import {clamp, rnd, suave, T, sprite} from '../nucleo/utilidades.js';
import {alturaSuelo} from './bosque.js';

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({color: c, ...extra});

function esfera(r, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
  m.scale.set(sx, sy, sz);
  return m;
}

function chucao() {
  const g = new THREE.Group();
  const cuerpo = esfera(0.07, lam(0x4a3426), 1.25, 0.9, 1);
  const pecho = esfera(0.055, lam(0xb2552a), 0.9, 1, 0.9);
  pecho.position.set(0.04, -0.005, 0);
  const cabeza = esfera(0.042, lam(0x3e2c20));
  cabeza.position.set(0.075, 0.05, 0);
  const pico = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 6), lam(0x1a1410));
  pico.rotation.z = -Math.PI / 2;
  pico.position.set(0.12, 0.05, 0);
  const cola = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.04), lam(0x33241a));
  cola.position.set(-0.09, 0.06, 0);
  cola.rotation.z = 0.5;
  const patas = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), lam(0x2a1e16));
  patas.position.set(0.01, -0.07, 0);
  g.add(cuerpo, pecho, cabeza, pico, cola, patas);
  g.position.y = 0.1;
  const raiz = new THREE.Group();
  raiz.add(g);
  raiz.userData.cuerpo = g;
  return raiz;
}

function ranita() {
  const g = new THREE.Group();
  const cuerpo = esfera(0.016, lam(0x5f8a35), 1.3, 0.7, 1);
  const lomo = esfera(0.014, lam(0x6b4e2a), 1.2, 0.45, 0.8);
  lomo.position.y = 0.006;
  const hocico = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.014, 6), lam(0x5f8a35));
  hocico.rotation.z = -Math.PI / 2;
  hocico.position.set(0.024, 0.002, 0);
  [-1, 1].forEach((s) => {
    const ojo = esfera(0.004, lam(0x111111));
    ojo.position.set(0.013, 0.009, 0.008 * s);
    const pata = esfera(0.007, lam(0x557a30), 1.6, 0.5, 0.7);
    pata.position.set(-0.012, -0.006, 0.014 * s);
    g.add(ojo, pata);
  });
  g.add(cuerpo, lomo, hocico);
  g.position.y = 0.01;
  return g;
}

function ciervoVolante() {
  const g = new THREE.Group();
  const bronce = lam(0x4a3a20, {emissive: 0x120c04});
  const cuerpo = esfera(0.018, bronce, 1.7, 0.6, 1.1);
  const torax = esfera(0.012, bronce, 1, 0.7, 1);
  torax.position.x = 0.028;
  g.add(cuerpo, torax);
  [-1, 1].forEach((s) => {
    const curva = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.036, 0, 0.006 * s),
      new THREE.Vector3(0.08, 0.03, 0.035 * s),
      new THREE.Vector3(0.11, -0.005, 0.004 * s)
    );
    const mand = new THREE.Mesh(new THREE.TubeGeometry(curva, 10, 0.0025, 4), bronce);
    g.add(mand);
    for (let k = 0; k < 3; k++) {
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 3), bronce);
      pata.position.set(0.02 - k * 0.016, -0.006, 0.016 * s);
      pata.rotation.x = 0.9 * s;
      g.add(pata);
    }
  });
  return g;
}

function monito() {
  const g = new THREE.Group();
  const pelo = lam(0x7a6a5c);
  const cuerpo = esfera(0.045, pelo, 1.3, 0.9, 0.9);
  const cabeza = esfera(0.03, pelo);
  cabeza.position.set(0.055, 0.02, 0);
  const antifaz = esfera(0.031, lam(0x2a2018), 0.6, 0.55, 1.05);
  antifaz.position.set(0.064, 0.026, 0);
  const cola = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 12, Math.PI * 1.4), lam(0x5a4c40));
  cola.position.set(-0.06, -0.02, 0);
  g.add(cuerpo, cabeza, antifaz, cola);
  // brillo de los ojos (tapetum) que se ve en la oscuridad
  const ojos = new THREE.Group();
  [-1, 1].forEach((s) => {
    const o = sprite([255, 230, 170], 0.03, 0);
    o.position.set(0.085, 0.032, 0.012 * s);
    ojos.add(o);
  });
  g.add(ojos);
  g.userData.ojos = ojos;
  return g;
}

export class Fauna {
  constructor(bosque) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'fauna';
    const arbol = bosque.arboles[0]; // olivillo cercano con copihue
    const arrayan = bosque.arboles[1];

    this.chucao = chucao();
    this.chucaoBase = new THREE.Vector3(-1.9, alturaSuelo(-1.9, -2.4), -2.4);
    this.chucao.position.copy(this.chucaoBase);
    this.chucao.rotation.y = 0.6;

    this.ranita = ranita();
    this.ranita.position.set(0.38, 0, -0.72);
    this.ranita.rotation.y = 2.4;

    this.ciervo = ciervoVolante();
    // sobre la corteza, mirando hacia arriba
    const dx = -Math.sign(arbol.x) * 0.7;
    const dz = 0.7;
    const dl = Math.hypot(dx, dz);
    this.ciervo.position.set(arbol.x + (dx / dl) * (arbol.r * 0.92 + 0.012), arbol.y + 1.45, arbol.z + (dz / dl) * (arbol.r * 0.92 + 0.012));
    this.ciervo.rotation.set(0, Math.atan2(-dz, dx), Math.PI / 2);

    this.monito = monito();
    this.monito.position.set(arrayan.x + 0.5, arrayan.y + 2.3, arrayan.z + 0.4);
    this.monito.rotation.y = -0.9;

    this.grupo.add(this.chucao, this.ranita, this.ciervo, this.monito);
    this.grupo.traverse((o) => (o.raycast = () => {}));
    this.proximoSalto = 3;
    this.salto = -1;
    this.aparicion = -1;
  }

  /** aparicion 0-1 · noche 0-1 (monito y ojos) · devuelve la posición del chucao si canta */
  actualizar(dt, reloj, aparicion, noche) {
    this.grupo.visible = aparicion > 0.001;
    if (!this.grupo.visible) return null;
    const a = aparicion;
    const esc = (t0) => Math.max(0.001, suave(t0, t0 + 0.25, a));
    this.ranita.scale.setScalar(esc(0.0));
    this.chucao.scale.setScalar(esc(0.25));
    this.ciervo.scale.setScalar(esc(0.5));
    const m = Math.max(0.001, suave(0.2, 0.8, noche) * esc(0.6));
    this.monito.scale.setScalar(m);
    this.monito.userData.ojos.children.forEach((o) => (o.material.opacity = suave(0.4, 1, noche)));

    // el chucao da saltitos cortos
    let canto = null;
    if (reloj > this.proximoSalto && a > 0.4) {
      this.salto = 0;
      this.proximoSalto = reloj + 3 + rnd() * 6;
      this.chucaoDestino = this.chucaoBase.clone().add(T.v1.set((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8));
      if (rnd() < 0.6) canto = this.chucao.position;
    }
    if (this.salto >= 0) {
      this.salto += dt;
      const t = clamp(this.salto / 0.35);
      this.chucao.position.lerp(this.chucaoDestino, clamp(dt * 9));
      this.chucao.position.y = alturaSuelo(this.chucao.position.x, this.chucao.position.z) + Math.sin(t * Math.PI) * 0.06;
      if (t >= 1) this.salto = -1;
    }
    return canto;
  }
}
