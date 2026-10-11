/**
 * Suelo, rocas del entorno y la roca madre donde vive el liquen.
 * La roca madre tiene sus propios valores de liquen, musgo y meteorización
 * para poder contar su historia aparte del resto del paisaje.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {materialMundo} from './materiales.js';
import {alturaSuelo} from './bosque.js';
import {rr, T, TAU} from '../nucleo/utilidades.js';

export function geoRoca(radio, achatar = 0.62, detalle = 2) {
  const geo = new THREE.IcosahedronGeometry(radio, detalle);
  const p = geo.attributes.position;
  const off = rr(0, 100);
  for (let i = 0; i < p.count; i++) {
    T.v1.fromBufferAttribute(p, i);
    const n = 0.78 + 0.3 * Math.sin(T.v1.x * 3.1 / radio + off) * Math.cos(T.v1.z * 2.7 / radio + off) + 0.08 * Math.sin(T.v1.y * 9 / radio + off);
    p.setXYZ(i, T.v1.x * n, T.v1.y * n * achatar, T.v1.z * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Paisaje {
  constructor({rocaPos, rocaRadio, rocaAltura}) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'paisaje';

    // Suelo (96×96)
    const sueloGeo = new THREE.PlaneGeometry(90, 90, 96, 96);
    sueloGeo.rotateX(-Math.PI / 2);
    const sp = sueloGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setY(i, alturaSuelo(sp.getX(i), sp.getZ(i)));
    sueloGeo.computeVertexNormals();
    this.suelo = new THREE.Mesh(sueloGeo, materialMundo({base: 0x24201c, tipo: 0}));
    this.grupo.add(this.suelo);

    // Roca madre: la cara superior queda a rocaAltura; el talo se apoya ahí
    this.propiosRoca = {uLichen: {value: 0}, uMoss: {value: 0}, uSoil: {value: 0}};
    const geo = geoRoca(rocaRadio, 1, 3);
    geo.computeBoundingBox();
    // aplanar la parte superior para que el talo se asiente
    const p = geo.attributes.position;
    const techo = geo.boundingBox.max.y * 0.82;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > techo) p.setY(i, techo + (p.getY(i) - techo) * 0.15);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    this.roca = new THREE.Mesh(geo, materialMundo({base: 0x45433f, tipo: 1, propios: this.propiosRoca}));
    this.roca.position.set(rocaPos.x, rocaAltura - geo.boundingBox.max.y, rocaPos.z);
    this.grupo.add(this.roca);

    // Rocas del entorno (una sola malla)
    const rocas = [];
    this.nodosRoca = [];
    for (let i = 0; i < 18; i++) {
      const a = rr(0, TAU);
      const d = rr(2.2, 12);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.hypot(x - rocaPos.x, z - rocaPos.z) < 1.4 || Math.hypot(x, z) < 1.6) continue;
      const r = rr(0.25, 1.1) * (d > 6 ? 1.5 : 1);
      const g = geoRoca(r);
      T.m.compose(T.v1.set(x, r * 0.12 + alturaSuelo(x, z), z), T.q.setFromEuler(T.e.set(0, rr(0, TAU), 0)), T.s.set(1, 1, 1));
      g.applyMatrix4(T.m);
      rocas.push(g);
      this.nodosRoca.push(new THREE.Vector3(x, 0, z));
    }
    this.rocas = new THREE.Mesh(mergeGeometries(rocas), materialMundo({base: 0x2c2b2a, tipo: 1}));
    this.grupo.add(this.rocas);
    this.grupo.traverse((o) => (o.raycast = () => {}));
  }

  set liquenRoca(v) {
    this.propiosRoca.uLichen.value = v;
  }
  set musgoRoca(v) {
    this.propiosRoca.uMoss.value = v;
  }
  set sueloRoca(v) {
    this.propiosRoca.uSoil.value = v;
  }
}
