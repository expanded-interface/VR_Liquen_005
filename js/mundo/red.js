/**
 * La red invisible (escenas 6 y 8). Visualización artística de la interdependencia:
 *  · filamentos que recorren el suelo desde la roca hacia rocas, árboles y a través del visitante
 *  · espirales que suben por los troncos (sólo si el bosque procedural está visible)
 *  · halos que se expanden y contraen sobre el suelo
 *  · nubes de puntos que emergen de las superficies y atraviesan el campo visual
 * frente 0-1 controla hasta dónde llegó la red; los pulsos viajan por los filamentos.
 */
import * as THREE from 'three';
import {U, GLSL_ONDAS} from './materiales.js';
import {alturaSuelo} from './bosque.js';
import {rnd, rr, T, TAU} from '../nucleo/utilidades.js';

export class Red {
  constructor({rocaPos, nodosRoca, arboles}) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'red';
    const pos = [];
    const dist = [];
    const tipo = []; // 0 suelo · 1 tronco · 2 aire (atraviesa al visitante)

    const camino = (desde, hasta, d0, pasos, t = 0, alturaAire = 0) => {
      const prev = desde.clone();
      let acum = d0;
      const perp = new THREE.Vector3(-(hasta.z - desde.z), 0, hasta.x - desde.x).normalize();
      const fase = rr(0, TAU);
      const p = new THREE.Vector3();
      for (let i = 1; i <= pasos; i++) {
        const u = i / pasos;
        p.copy(desde).lerp(hasta, u).addScaledVector(perp, Math.sin(u * Math.PI * 3 + fase) * 0.3 * Math.sin(u * Math.PI));
        p.y = 0.03 + alturaSuelo(p.x, p.z) + alturaAire * Math.sin(u * Math.PI);
        const seg = p.distanceTo(prev);
        pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        dist.push(acum, acum + seg);
        tipo.push(t, t);
        acum += seg;
        prev.copy(p);
      }
      return acum;
    };

    const origen = new THREE.Vector3(rocaPos.x, 0.03, rocaPos.z);
    const nodos = [];
    nodosRoca.forEach((r) => nodos.push({n: new THREE.Vector3(r.x, 0.03, r.z)}));
    arboles.forEach((a) => nodos.push({n: new THREE.Vector3(a.x, 0.03, a.z), arbol: a}));
    nodos.forEach((o) => (o.d = camino(origen, o.n, 0, Math.max(8, Math.round(o.n.distanceTo(origen) * 2)))));
    // conexiones entre vecinos
    nodos.forEach((a, i) => {
      let mejor = null;
      let md = 1e9;
      nodos.forEach((b, j) => {
        if (i === j) return;
        const d = a.n.distanceTo(b.n);
        if (d < md) {
          md = d;
          mejor = b;
        }
      });
      if (mejor && md < 7) camino(a.n, mejor.n, a.d, Math.round(md * 2));
    });
    // filamentos que pasan por donde está el visitante (a la altura del pecho)
    for (let k = 0; k < 5; k++) {
      const a = rr(0, TAU);
      const hasta = new THREE.Vector3(Math.cos(a) * rr(5, 9), 0.03, Math.sin(a) * rr(5, 9));
      const desde = new THREE.Vector3(-hasta.x * 0.6, 0.03, -hasta.z * 0.6);
      camino(desde, hasta, origen.distanceTo(desde) + rr(0, 2), 40, 2, rr(0.9, 1.4));
    }
    // espirales por los troncos
    nodos
      .filter((o) => o.arbol)
      .forEach(({arbol: a, d: d0}) => {
        let d = d0;
        const prev = new THREE.Vector3(a.x, a.y + 0.05, a.z);
        const vueltas = rr(1.5, 3);
        const N = 28;
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const ang = t * vueltas * TAU;
          const rad = a.r * (1 - t * 0.4) + 0.03;
          T.v2.set(a.x + Math.cos(ang) * rad, a.y + t * a.alto * 0.85, a.z + Math.sin(ang) * rad);
          const seg = T.v2.distanceTo(prev);
          pos.push(prev.x, prev.y, prev.z, T.v2.x, T.v2.y, T.v2.z);
          dist.push(d, d + seg);
          tipo.push(1, 1);
          d += seg;
          prev.copy(T.v2);
        }
      });
    this.maxDist = dist.reduce((m, v) => Math.max(m, v), 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
    g.setAttribute('aTipo', new THREE.Float32BufferAttribute(tipo, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {...U, uFrente: {value: 0}, uAlpha: {value: 0}, uColor: {value: new THREE.Color(0x8ff5cf)}, uTroncos: {value: 1}, uAire: {value: 0}},
      vertexShader: /* glsl */ `attribute float aDist; attribute float aTipo; uniform float uFrente, uTroncos, uAire; uniform vec3 uColor;
        varying vec3 vC; varying float vB; ${GLSL_ONDAS}
        void main(){ vec4 wp=modelMatrix*vec4(position,1.0);
          float frente = smoothstep(uFrente, uFrente - 2.5, aDist);
          float w = waveAt(wp.xyz);
          float pulso = 0.5 + 0.5*sin(aDist*2.6 - uTime*3.2);
          float visible = aTipo < 0.5 ? 1.0 : (aTipo < 1.5 ? uTroncos : uAire);
          vB = visible * (frente*(0.22 + 0.3*pulso) + w*1.6*frente);
          vC = uColor*vB + vec3(w*0.25);
          gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `precision mediump float; uniform float uAlpha; varying vec3 vC; varying float vB;
        void main(){ if (vB < 0.01) discard; gl_FragColor = vec4(vC, uAlpha*clamp(vB,0.0,1.0)); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lineas = new THREE.LineSegments(g, this.mat);
    this.lineas.frustumCulled = false;
    this.grupo.add(this.lineas);

    // halos sobre el suelo
    this.halos = [];
    const centrosHalo = [origen, new THREE.Vector3(0, 0.03, 0), ...nodos.slice(0, 6).map((o) => o.n)];
    centrosHalo.forEach((c, i) => {
      const h = new THREE.Mesh(
        new THREE.RingGeometry(0.965, 1, 72),
        new THREE.MeshBasicMaterial({color: 0x8ff5cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false})
      );
      h.rotation.x = -Math.PI / 2;
      h.position.set(c.x, 0.04 + alturaSuelo(c.x, c.z), c.z);
      h.userData.fase = i * 0.37;
      this.grupo.add(h);
      this.halos.push(h);
    });

    // nubes de puntos que emergen de las superficies
    const NN = 700;
    const np = new Float32Array(NN * 3);
    const ns = new Float32Array(NN);
    for (let i = 0; i < NN; i++) {
      const base = nodos[Math.floor(rnd() * nodos.length)].n;
      const r = rr(0, 1.6);
      const a = rr(0, TAU);
      const x = (rnd() < 0.35 ? 0 : base.x) + Math.cos(a) * r;
      const z = (rnd() < 0.35 ? 0 : base.z) + Math.sin(a) * r;
      np.set([x, alturaSuelo(x, z), z], i * 3);
      ns[i] = rnd();
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    ng.setAttribute('aS', new THREE.BufferAttribute(ns, 1));
    this.matNube = new THREE.ShaderMaterial({
      uniforms: {uTime: U.uTime, uAlpha: {value: 0}, uColor: {value: new THREE.Color(0x8ff5cf)}},
      vertexShader: `attribute float aS; uniform float uTime; varying float vA;
        void main(){ float ciclo = fract(uTime*0.06 + aS); vec3 p = position; p.y += ciclo*3.2;
          p.x += sin(uTime*0.4 + aS*40.0)*0.15*ciclo; p.z += cos(uTime*0.35 + aS*30.0)*0.15*ciclo;
          vA = sin(ciclo*3.14159);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = clamp(14.0/(-mv.z), 1.0, 10.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `precision mediump float; uniform float uAlpha; uniform vec3 uColor; varying float vA;
        void main(){ vec2 c=gl_PointCoord-0.5; float a=smoothstep(0.5,0.0,length(c)); gl_FragColor=vec4(uColor, a*vA*uAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.nube = new THREE.Points(ng, this.matNube);
    this.nube.frustumCulled = false;
    this.grupo.add(this.nube);
    this.grupo.traverse((o) => (o.raycast = () => {}));
    this.grupo.visible = false;
  }

  /**
   * s: {alfa, frente 0-1, color THREE.Color, troncos 0-1, aire 0-1, halos 0-1, nube 0-1}
   */
  actualizar(reloj, s) {
    this.grupo.visible = s.alfa > 0.003;
    if (!this.grupo.visible) return;
    const u = this.mat.uniforms;
    u.uAlpha.value = s.alfa;
    u.uFrente.value = s.frente * (this.maxDist + 3);
    u.uColor.value.copy(s.color);
    u.uTroncos.value = s.troncos;
    u.uAire.value = s.aire;
    this.halos.forEach((h) => {
      const c = (reloj * 0.12 + h.userData.fase) % 1;
      const esc = 0.3 + c * 3.2 + Math.sin(reloj * 0.8 + h.userData.fase * 9) * 0.1;
      h.scale.setScalar(esc);
      h.material.opacity = s.halos * s.alfa * Math.sin(c * Math.PI) * 0.28;
      h.material.color.copy(s.color);
      h.visible = h.material.opacity > 0.003;
    });
    this.matNube.uniforms.uAlpha.value = s.nube * s.alfa;
    this.matNube.uniforms.uColor.value.copy(s.color);
    this.nube.visible = s.nube * s.alfa > 0.003;
  }
}
