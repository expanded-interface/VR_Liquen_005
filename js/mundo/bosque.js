/**
 * Bosque procedural: selva valdiviana costera (Región de Los Ríos).
 * Composición elegida por distribución real: olivillo (Aextoxicon punctatum) como dosel,
 * arrayán (Luma apiculata) de corteza canela, helechos, nalca (Gunnera tinctoria) en el borde
 * húmedo, copihue (Lapageria rosea) trepando un tronco y barba de viejo (Usnea) colgando.
 * El alerce costero se dejó fuera: crece más alto en la cordillera de la Costa, no en este bosque bajo.
 *
 * crecimiento 0-1 sigue la sucesión: pioneras → helechos y nalca → sotobosque → dosel → epífitas.
 * Se usa también como respaldo del bosque presente si el Gaussian Splat no carga.
 */
import * as THREE from 'three';
import {materialMundo, U, GLSL_ONDAS} from './materiales.js';
import {clamp, lerp, rnd, rr, suave, T, TAU} from '../nucleo/utilidades.js';

export function alturaSuelo(x, z) {
  const d = Math.hypot(x, z);
  return (Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.3 + Math.sin(x * 0.11 + 1) * Math.cos(z * 0.13) * 1.2) * suave(3, 14, d);
}

export class Bosque {
  constructor({zonaLibre}) {
    // zonaLibre: punto (local) alrededor del cual no crece nada (la roca y el visitante)
    this.grupo = new THREE.Group();
    this.grupo.name = 'bosque-procedural';
    this.libre = zonaLibre;
    this.crecimiento = -1;
    this.arboles = [];
    this._plantarArboles();
    this._construirArboles();
    this._construirHelechos();
    this._construirNalcas();
    this._construirCopihue();
    this._construirUsnea();
    this.grupo.traverse((o) => (o.raycast = () => {}));
    this.aplicar(0);
  }

  _libre(x, z, r) {
    return Math.hypot(x, z) > r && Math.hypot(x - this.libre.x, z - this.libre.z) > r;
  }

  _plantarArboles() {
    // Un olivillo cercano, a la derecha, sostiene el copihue y el ciervo volante
    this.arboles.push({x: 2.3, z: -2.6, tipo: 'olivillo', alto: 19, r: 0.42, giro: 0.4, retraso: 0.05, cerca: true});
    // Un arrayán cercano a la izquierda (más bajo, multitallo)
    this.arboles.push({x: -2.6, z: -1.6, tipo: 'arrayan', alto: 10, r: 0.2, giro: 1.2, retraso: 0.12});
    let intentos = 0;
    while (this.arboles.length < 26 && intentos++ < 600) {
      const a = rr(0, TAU);
      const d = rr(3.8, 17);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!this._libre(x, z, 2.8)) continue;
      if (this.arboles.some((t) => Math.hypot(t.x - x, t.z - z) < 2.3)) continue;
      const olivillo = rnd() < 0.62;
      this.arboles.push({
        x,
        z,
        tipo: olivillo ? 'olivillo' : 'arrayan',
        alto: olivillo ? rr(15, 24) : rr(7, 12),
        r: olivillo ? rr(0.3, 0.55) : rr(0.14, 0.24),
        giro: rr(0, TAU),
        retraso: rr(0, 0.42),
      });
    }
    this.arboles.forEach((a) => {
      a.y = alturaSuelo(a.x, a.z);
      a.copas = [];
      const nC = a.tipo === 'olivillo' ? 6 : 4;
      for (let k = 0; k < nC; k++) {
        a.copas.push(
          a.tipo === 'olivillo'
            ? {x: rr(-2.2, 2.2), y: rr(-3, 1.2), z: rr(-2.2, 2.2), sx: rr(1.8, 3), sy: rr(1.2, 1.9), sz: rr(1.8, 3)}
            : {x: rr(-1.4, 1.4), y: rr(-1.8, 0.8), z: rr(-1.4, 1.4), sx: rr(1.1, 1.8), sy: rr(0.8, 1.2), sz: rr(1.1, 1.8)}
        );
      }
      // el arrayán crece en varios tallos inclinados
      a.tallos = a.tipo === 'arrayan' ? [0, 1, 2].map((k) => ({ang: (k / 3) * TAU + rr(-0.4, 0.4), incl: rr(0.06, 0.18)})) : [{ang: 0, incl: 0}];
      a.raices = a.tipo === 'olivillo' ? [0, 1, 2, 3].map((k) => (k / 4) * TAU + rr(-0.3, 0.3)) : [];
    });
  }

  _construirArboles() {
    const troncoGeo = new THREE.CylinderGeometry(0.6, 1, 1, 10, 3);
    troncoGeo.translate(0, 0.5, 0);
    this.matOlivillo = materialMundo({base: 0x6b6458, tipo: 2});
    this.matArrayan = materialMundo({base: 0xb0652e, tipo: 2});
    const nOl = this.arboles.filter((a) => a.tipo === 'olivillo').length;
    const nAr = this.arboles.filter((a) => a.tipo === 'arrayan').length;
    this.troncosOl = new THREE.InstancedMesh(troncoGeo, this.matOlivillo, nOl);
    this.troncosAr = new THREE.InstancedMesh(troncoGeo, this.matArrayan, nAr * 3);
    this.raices = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), this.matOlivillo, nOl * 4);
    this.matCopa = new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true});
    const nCopas = this.arboles.reduce((s, a) => s + a.copas.length, 0);
    this.copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.matCopa, nCopas);
    let ci = 0;
    this.arboles.forEach((a) => {
      a.copas.forEach(() => {
        const c = a.tipo === 'olivillo' ? (rnd() < 0.5 ? 0x1b3a1d : 0x24461f) : rnd() < 0.5 ? 0x2f5226 : 0x3a5f2a;
        this.copas.setColorAt(ci++, T.c.setHex(c));
      });
    });
    [this.troncosOl, this.troncosAr, this.raices, this.copas].forEach((im) => {
      im.frustumCulled = false;
      this.grupo.add(im);
    });
  }

  _construirHelechos() {
    const fronda = new THREE.PlaneGeometry(0.16, 0.85, 1, 5);
    fronda.translate(0, 0.425, 0);
    const fp = fronda.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i);
      fp.setZ(i, y * y * 0.45);
      fp.setX(i, fp.getX(i) * (1 - y / 1.1));
    }
    fronda.computeVertexNormals();
    this.datosHelecho = [];
    for (let h = 0; h < 140 && this.datosHelecho.length < 760; h++) {
      const a = rr(0, TAU);
      const d = rr(1.6, 15);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!this._libre(x, z, 1.0)) continue;
      const s = rr(0.6, 1.5);
      for (let k = 0; k < 6; k++)
        this.datosHelecho.push({x, z, y: alturaSuelo(x, z) - 0.02, rot: (k / 6) * TAU + rr(-0.2, 0.2), incl: rr(0.5, 0.95), s, retraso: rnd() * 0.6});
    }
    this.helechos = new THREE.InstancedMesh(fronda, new THREE.MeshLambertMaterial({color: 0x3f6b2a, side: THREE.DoubleSide}), this.datosHelecho.length);
    this.helechos.frustumCulled = false;
    this.grupo.add(this.helechos);
  }

  _construirNalcas() {
    // Hoja de nalca: disco grande, ahuecado, de borde lobulado
    const hoja = new THREE.CircleGeometry(0.55, 24, 0, TAU);
    const hp = hoja.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i);
      const y = hp.getY(i);
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const lob = 1 + 0.12 * Math.sin(a * 9);
      hp.setXYZ(i, x * lob, y * lob, r * r * 0.9 - 0.1 * Math.sin(a * 9) * r);
    }
    hoja.rotateX(-Math.PI / 2);
    hoja.computeVertexNormals();
    const tallo = new THREE.CylinderGeometry(0.025, 0.04, 1, 6);
    tallo.translate(0, 0.5, 0);
    this.datosNalca = [];
    const centros = [
      [-3.4, -3.2],
      [3.6, 0.8],
      [-1.2, 3.9],
    ];
    centros.forEach(([cx, cz]) => {
      for (let k = 0; k < 6; k++) {
        const a = rr(0, TAU);
        this.datosNalca.push({
          x: cx + Math.cos(a) * rr(0.1, 0.5),
          z: cz + Math.sin(a) * rr(0.1, 0.5),
          alto: rr(0.9, 1.7),
          incl: rr(0.2, 0.6),
          rot: a,
          s: rr(0.8, 1.3),
          retraso: rr(0, 0.4),
        });
      }
    });
    this.datosNalca.forEach((n) => (n.y = alturaSuelo(n.x, n.z)));
    const n = this.datosNalca.length;
    this.nalcaHojas = new THREE.InstancedMesh(hoja, new THREE.MeshLambertMaterial({color: 0x3f6f2a, side: THREE.DoubleSide}), n);
    this.nalcaTallos = new THREE.InstancedMesh(tallo, new THREE.MeshLambertMaterial({color: 0x6b4a3a}), n);
    [this.nalcaHojas, this.nalcaTallos].forEach((im) => {
      im.frustumCulled = false;
      this.grupo.add(im);
    });
  }

  _construirCopihue() {
    const a = this.arboles[0];
    this.copihue = new THREE.Group();
    // enredadera en espiral sobre el tronco
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const ang = t * TAU * 2.6;
      const rad = a.r * (1 - t * 0.2) + 0.03;
      pts.push(new THREE.Vector3(a.x + Math.cos(ang) * rad, a.y + t * 3.6, a.z + Math.sin(ang) * rad));
    }
    this.lianaGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.liana = new THREE.Line(this.lianaGeo, new THREE.LineBasicMaterial({color: 0x2e5a22}));
    this.copihue.add(this.liana);
    // flores: campanas rojas colgantes
    // campana alargada y colgante (perfil torneado)
    const perfil = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      perfil.push(new THREE.Vector2(0.006 + 0.03 * Math.pow(u, 1.6) + 0.006 * Math.sin(u * Math.PI), -u * 0.085));
    }
    const flor = new THREE.LatheGeometry(perfil, 10);
    this.flores = new THREE.InstancedMesh(
      flor,
      new THREE.MeshLambertMaterial({color: 0xc4122f, emissive: 0x2a0308, side: THREE.DoubleSide}),
      14
    );
    this.datosFlor = [];
    for (let i = 0; i < 14; i++) {
      const p = pts[Math.floor(rr(14, 78))];
      this.datosFlor.push({p: p.clone().add(T.v1.set(rr(-0.06, 0.06), -0.03, rr(-0.06, 0.06))), rot: rr(0, TAU), retraso: rnd() * 0.5});
    }
    this.flores.frustumCulled = false;
    this.copihue.add(this.flores);
    this.grupo.add(this.copihue);
  }

  _construirUsnea() {
    const pos = [];
    this.arboles.forEach((t) => {
      for (let k = 0; k < 12; k++) {
        const ua = rr(0, TAU);
        const ur = rr(t.r, t.tipo === 'olivillo' ? 2.4 : 1.4);
        let px = t.x + Math.cos(ua) * ur;
        let py = t.y + rr(t.alto * 0.4, t.alto - 2.4);
        let pz = t.z + Math.sin(ua) * ur;
        const largo = rr(0.25, 0.7);
        for (let s = 0; s < 5; s++) {
          const nx = px + rr(-0.04, 0.04);
          const ny = py - largo / 5;
          const nz = pz + rr(-0.04, 0.04);
          pos.push(px, py, pz, nx, ny, nz);
          px = nx;
          py = ny;
          pz = nz;
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.matUsnea = new THREE.ShaderMaterial({
      uniforms: {...U, uAlpha: {value: 0}},
      vertexShader: `uniform float uNet; uniform vec3 uNetColor; varying vec3 vC; ${GLSL_ONDAS}
        void main(){ vec4 wp=modelMatrix*vec4(position,1.0); float w = waveAt(wp.xyz)*1.4 + uNet*0.25;
          vC = vec3(0.55,0.66,0.48)*0.5 + uNetColor*w; gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `precision mediump float; uniform float uAlpha; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, uAlpha); }`,
      transparent: true,
      depthWrite: false,
    });
    this.usnea = new THREE.LineSegments(g, this.matUsnea);
    this.usnea.frustumCulled = false;
    this.grupo.add(this.usnea);
  }

  /** Sucesión: sólo recalcula matrices cuando el valor cambia de verdad */
  aplicar(c) {
    if (Math.abs(c - this.crecimiento) < 0.0015) return;
    this.crecimiento = c;
    this.grupo.visible = c > 0.001;
    if (!this.grupo.visible) return;

    const fHel = suave(0.06, 0.45, c);
    const fNal = suave(0.12, 0.5, c);
    const fArb = suave(0.3, 1.0, c);
    const fCop = suave(0.82, 0.97, c);
    const fUsn = suave(0.85, 1.0, c);

    // helechos
    this.helechos.visible = fHel > 0.001;
    if (this.helechos.visible) {
      this.datosHelecho.forEach((h, i) => {
        const k = suave(h.retraso, h.retraso + 0.4, fHel);
        T.q.setFromEuler(T.e.set(-h.incl * k, h.rot, 0, 'YXZ'));
        T.m.compose(T.v1.set(h.x, h.y, h.z), T.q, T.s.setScalar(Math.max(0.001, h.s * k)));
        this.helechos.setMatrixAt(i, T.m);
      });
      this.helechos.instanceMatrix.needsUpdate = true;
    }
    // nalcas
    const nv = fNal > 0.001;
    this.nalcaHojas.visible = this.nalcaTallos.visible = nv;
    if (nv) {
      this.datosNalca.forEach((n, i) => {
        const k = Math.max(0.001, suave(n.retraso, n.retraso + 0.6, fNal));
        const alto = n.alto * k;
        T.q.setFromEuler(T.e.set(n.incl * 0.4, n.rot, 0, 'YXZ'));
        T.m.compose(T.v1.set(n.x, n.y, n.z), T.q, T.s.set(k, alto, k));
        this.nalcaTallos.setMatrixAt(i, T.m);
        // la hoja en la punta del tallo inclinado
        T.v2.set(0, alto, 0).applyQuaternion(T.q).add(T.v1);
        T.q.setFromEuler(T.e.set(n.incl, n.rot, 0, 'YXZ'));
        T.m.compose(T.v2, T.q, T.s.setScalar(n.s * k));
        this.nalcaHojas.setMatrixAt(i, T.m);
      });
      this.nalcaHojas.instanceMatrix.needsUpdate = true;
      this.nalcaTallos.instanceMatrix.needsUpdate = true;
    }
    // árboles
    const av = fArb > 0.001;
    [this.troncosOl, this.troncosAr, this.raices, this.copas].forEach((m) => (m.visible = av));
    if (av) {
      let io = 0;
      let ia = 0;
      let ir = 0;
      let ic = 0;
      this.arboles.forEach((a) => {
        const k = suave(a.retraso, a.retraso + 0.58, fArb);
        const kk = Math.max(0.001, k);
        const sxz = lerp(0.25, 1, k);
        if (a.tipo === 'olivillo') {
          T.q.setFromEuler(T.e.set(0, a.giro, 0));
          T.m.compose(T.v1.set(a.x, a.y - 0.1, a.z), T.q, T.s.set(a.r * sxz, a.alto * kk, a.r * sxz));
          this.troncosOl.setMatrixAt(io++, T.m);
          a.raices.forEach((ra) => {
            T.q.setFromEuler(T.e.set(Math.sin(ra) * 0.5, 0, -Math.cos(ra) * 0.5));
            T.m.compose(
              T.v1.set(a.x + Math.cos(ra) * a.r * 0.7 * sxz, a.y + 0.3 * kk - 0.1, a.z + Math.sin(ra) * a.r * 0.7 * sxz),
              T.q,
              T.s.set(a.r * 0.8 * kk, 1.0 * kk, a.r * 0.8 * kk)
            );
            this.raices.setMatrixAt(ir++, T.m);
          });
        } else {
          a.tallos.forEach((tl) => {
            T.q.setFromEuler(T.e.set(Math.sin(tl.ang) * tl.incl, a.giro, -Math.cos(tl.ang) * tl.incl));
            T.m.compose(T.v1.set(a.x, a.y - 0.1, a.z), T.q, T.s.set(a.r * sxz, a.alto * kk, a.r * sxz));
            this.troncosAr.setMatrixAt(ia++, T.m);
          });
        }
        a.copas.forEach((c2) => {
          T.q.identity();
          T.m.compose(
            T.v1.set(a.x + c2.x * sxz, a.y + (a.alto + c2.y) * kk - 0.1, a.z + c2.z * sxz),
            T.q,
            T.s.set(c2.sx * sxz * kk, c2.sy * kk, c2.sz * sxz * kk)
          );
          this.copas.setMatrixAt(ic++, T.m);
        });
      });
      this.troncosOl.instanceMatrix.needsUpdate = true;
      this.troncosAr.instanceMatrix.needsUpdate = true;
      this.raices.instanceMatrix.needsUpdate = true;
      this.copas.instanceMatrix.needsUpdate = true;
    }
    // copihue y usnea
    this.copihue.visible = fCop > 0.001;
    if (this.copihue.visible) {
      this.lianaGeo.setDrawRange(0, Math.floor(81 * fCop));
      this.datosFlor.forEach((f, i) => {
        const k = Math.max(0.001, suave(f.retraso, f.retraso + 0.5, fCop));
        T.q.setFromEuler(T.e.set(0.2, f.rot, 0));
        T.m.compose(f.p, T.q, T.s.setScalar(k));
        this.flores.setMatrixAt(i, T.m);
      });
      this.flores.instanceMatrix.needsUpdate = true;
    }
    this.usnea.visible = fUsn > 0.001;
    this.matUsnea.uniforms.uAlpha.value = fUsn * 0.55;
  }

  /** Nodos para la red de la escena 8 */
  nodos() {
    return this.arboles.map((a) => ({x: a.x, z: a.z, alto: a.alto, r: a.r, y: a.y}));
  }

  /** Recorta lo decorativo si el visor no sostiene la tasa de cuadros */
  bajarCalidad() {
    this.helechos.count = Math.floor(this.datosHelecho.length / 2);
  }
}
