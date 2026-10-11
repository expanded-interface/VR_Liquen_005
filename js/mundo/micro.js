/**
 * Escala microscópica (escenas 3 y 4). Representación artística informada:
 *  · Micobionte: hifas ramificadas, tabicadas, de color crema.
 *  · Fotobionte: alga verde trebouxioide — células esféricas con un cloroplasto
 *    central lobulado y un pirenoide. (Muchos líquenes del bosque valdiviano usan
 *    cianobacterias como Nostoc; aquí se representa el caso del alga verde.)
 *  · Escena 4: hifas que envuelven la célula y forman apresorios (hifas apretadas
 *    contra la pared). Los flujos de luz representan polioles (p. ej. ribitol)
 *    pasando del alga al hongo; el intercambio real ocurre a escala molecular.
 */
import * as THREE from 'three';
import {U} from './materiales.js';
import {clamp, lerp, rnd, rr, suave, T, TAU, sprite} from '../nucleo/utilidades.js';

/* ---------------- hifas como líneas que crecen ---------------- */
function crearHifas({n = 600, radio = 0.4, sesgo = null, fuerzaSesgo = 0, dentro = null, color = 0xfff1d6, origen = new THREE.Vector3()}) {
  const pos = [];
  const orden = [];
  const puntas = [{p: origen.clone(), d: sesgo ? sesgo.clone() : new THREE.Vector3(0, 1, 0), o: 0}];
  let total = 0;
  let guardia = 0;
  while (total < n && puntas.length && guardia++ < n * 6) {
    const k = Math.floor(rnd() * puntas.length);
    const t = puntas[k];
    const d = t.d.clone().add(T.v1.set(rr(-0.6, 0.6), rr(-0.6, 0.6), rr(-0.6, 0.6)));
    if (sesgo) d.addScaledVector(sesgo, fuerzaSesgo);
    d.normalize();
    const q = t.p.clone().addScaledVector(d, rr(0.014, 0.032));
    const ok = dentro ? dentro(q) : q.distanceTo(origen) < radio;
    if (!ok) {
      puntas.splice(k, 1);
      continue;
    }
    pos.push(t.p.x, t.p.y, t.p.z, q.x, q.y, q.z);
    const o = t.o + 1;
    orden.push(t.o, o);
    t.p = q;
    t.d = d;
    t.o = o;
    if (rnd() < 0.13) puntas.push({p: q.clone(), d: d.clone().applyAxisAngle(T.v2.set(rnd(), rnd(), rnd()).normalize(), 1.0), o});
    total++;
  }
  const maxO = orden.reduce((m, v) => Math.max(m, v), 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aOrden', new THREE.Float32BufferAttribute(orden.map((v) => v / maxO), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: {uGrow: {value: 0}, uAlpha: {value: 1}, uColor: {value: new THREE.Color(color)}, uTime: U.uTime},
    vertexShader: `attribute float aOrden; varying float vO; void main(){ vO=aOrden; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `precision mediump float; uniform float uGrow,uAlpha,uTime; uniform vec3 uColor; varying float vO;
      void main(){ if(vO>uGrow) discard; float b = 0.55+0.45*sin(vO*40.0 - uTime*2.0);
        float punta = smoothstep(uGrow-0.04, uGrow, vO);
        gl_FragColor=vec4(uColor*(0.55+0.5*b) + punta*0.6, uAlpha*(1.0-vO*0.45)); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return l;
}

/* ---------------- material de célula (membrana translúcida + cloroplasto) ---------------- */
function materialCelula({conCloroplasto = true} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {uNoise: U.uNoise, uAlpha: {value: 1}, uTime: U.uTime, uLuz: {value: 0.6}},
    defines: conCloroplasto ? {CLORO: 1} : {},
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vNl; varying vec3 vWp; varying float vSemilla;
      void main(){
        vec4 lp = vec4(position, 1.0);
        vec3 nn = normal;
        vSemilla = 0.0;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          nn = mat3(instanceMatrix) * nn;
          vSemilla = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        vNl = normalize(normal);
        vec4 wp = modelMatrix * lp;
        vWp = wp.xyz;
        vN = normalize(mat3(modelMatrix) * nn);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform sampler2D uNoise; uniform float uAlpha, uTime, uLuz;
      varying vec3 vN; varying vec3 vNl; varying vec3 vWp; varying float vSemilla;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWp);
        float fres = pow(1.0 - abs(dot(N, V)), 2.2);
        vec3 membrana = vec3(0.55, 0.85, 0.6);
        vec3 col = membrana * fres * 0.9;
        float a = 0.18 + 0.7 * fres;
        #ifdef CLORO
          vec2 uv = vNl.xy * 0.35 + vec2(vSemilla, vSemilla * 1.7);
          float lob = texture2D(uNoise, uv).g;
          float cloro = smoothstep(0.42, 0.56, lob + 0.15 * vNl.z) * (1.0 - fres);
          vec3 verde = mix(vec3(0.16, 0.48, 0.16), vec3(0.34, 0.78, 0.28), lob);
          col += verde * cloro * (0.6 + 0.4 * uLuz);
          a += cloro * 0.55;
        #endif
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

export class Micro {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'micro';
    this.centro = new THREE.Vector3(0, 1.5, -1.6); // se recoloca a la altura de los ojos
    this._construirEncuentro();
    this._construirIntimo();
    this.grupo.traverse((o) => (o.raycast = () => {}));
  }

  /* ================= Escena 3: encuentro ================= */
  _construirEncuentro() {
    const e = (this.encuentro = new THREE.Group());
    this.grupo.add(e);
    this.posHongo = new THREE.Vector3(-0.62, 0, 0);
    this.posAlga = new THREE.Vector3(0.62, 0, 0);

    this.hongo = new THREE.Group();
    this.hongo.position.copy(this.posHongo);
    this.hifas = crearHifas({n: 700, radio: 0.42});
    this.hongo.add(this.hifas);
    this.halHongo = sprite([255, 236, 200], 0.9, 0);
    this.hongo.add(this.halHongo);
    e.add(this.hongo);

    // hifas que exploran hacia el alga (se revelan con la unión)
    const destino = this.posAlga.clone().sub(this.posHongo);
    this.puente = crearHifas({
      n: 520,
      sesgo: new THREE.Vector3(1, 0, 0),
      fuerzaSesgo: 0.55,
      dentro: (q) => q.x > -0.2 && q.x < destino.x + 0.25 && Math.abs(q.y) < 0.32 && Math.abs(q.z) < 0.32,
      origen: new THREE.Vector3(0.12, 0, 0),
    });
    this.hongo.add(this.puente);

    // células del alga
    const NC = 42;
    this.celulas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 18, 12), materialCelula(), NC);
    this.celulas.frustumCulled = false;
    this.datosCel = [];
    for (let i = 0; i < NC; i++) {
      const v = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize().multiplyScalar(Math.cbrt(rnd()) * 0.17);
      // posición final: repartidas entre las hifas, en una capa compartida
      const fin = new THREE.Vector3(rr(-0.75, 0.4), rr(-0.07, 0.07), rr(-0.28, 0.28));
      this.datosCel.push({ini: v, fin, s: rr(0.75, 1.3), f: rr(0, TAU), p: new THREE.Vector3()});
    }
    this.alga = new THREE.Group();
    this.alga.add(this.celulas);
    this.halAlga = sprite([120, 255, 140], 0.9, 0);
    this.halAlga.position.copy(this.posAlga);
    e.add(this.alga, this.halAlga);

    // punto de contacto que la escena 4 amplía
    this.contacto = new THREE.Vector3(0.18, 0.02, 0.05);
  }

  /* ================= Escena 4: intimidad celular ================= */
  _construirIntimo() {
    const g = (this.intimo = new THREE.Group());
    g.visible = false;
    this.grupo.add(g);
    const R = (this.R = 0.42);

    // pared celular
    this.pared = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), materialCelula({conCloroplasto: false}));
    this.pared.renderOrder = 5;
    g.add(this.pared);

    // cloroplasto central lobulado (forma de estrella, como en Trebouxia)
    const cg = new THREE.IcosahedronGeometry(R * 0.66, 4);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      T.v1.fromBufferAttribute(cp, i);
      const d = T.v1.clone().normalize();
      const lob = 0.72 + 0.22 * Math.pow(Math.abs(Math.sin(d.x * 4.1) * Math.cos(d.y * 3.3) * Math.sin(d.z * 3.7 + 1)), 0.6);
      cp.setXYZ(i, T.v1.x * lob, T.v1.y * lob, T.v1.z * lob);
    }
    cg.computeVertexNormals();
    this.cloroplasto = new THREE.Mesh(
      cg,
      new THREE.ShaderMaterial({
        uniforms: {uNoise: U.uNoise, uAlpha: {value: 1}, uTime: U.uTime, uLuz: {value: 0.6}},
        vertexShader: `varying vec3 vN; varying vec3 vWp; varying vec3 vLp; void main(){ vLp=position; vec4 wp=modelMatrix*vec4(position,1.0); vWp=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `precision mediump float; uniform sampler2D uNoise; uniform float uAlpha, uTime, uLuz; varying vec3 vN; varying vec3 vWp; varying vec3 vLp;
          void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vWp);
            float n = texture2D(uNoise, vLp.xy*3.0 + vLp.z).g;
            float tila = 1.0 - smoothstep(0.0, 0.06, texture2D(uNoise, vLp.xz*9.0).b); // tilacoides sugeridos
            vec3 col = mix(vec3(0.05,0.28,0.08), vec3(0.25,0.7,0.22), n) * (0.55 + 0.45*max(dot(N, normalize(vec3(0.3,0.8,0.4))),0.0));
            col += vec3(0.4,0.9,0.3) * tila * 0.15 * (0.5 + 0.5*sin(uTime*0.8 + vLp.y*10.0)) * uLuz;
            col += vec3(0.5,1.0,0.6) * pow(1.0-max(dot(N,V),0.0),3.0) * 0.35;
            gl_FragColor = vec4(col, 0.92*uAlpha); }`,
        transparent: true,
      })
    );
    this.cloroplasto.renderOrder = 4;
    g.add(this.cloroplasto);
    this.pirenoide = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.16, 20, 14),
      new THREE.MeshBasicMaterial({color: 0xd8f2b8, transparent: true, opacity: 0.85, fog: false})
    );
    this.pirenoide.position.set(R * 0.08, R * 0.05, R * 0.12);
    this.pirenoide.renderOrder = 4;
    g.add(this.pirenoide);

    // hifas tubulares que se acercan y envuelven la célula
    this.tubos = [];
    const dirs = [
      [-0.9, 0.35, 0.3],
      [0.85, 0.5, 0.15],
      [-0.4, -0.85, 0.35],
      [0.55, -0.6, -0.5],
      [0.1, 0.95, -0.35],
    ];
    dirs.forEach((dd, i) => {
      const d0 = new THREE.Vector3(...dd).normalize();
      const inicio = d0.clone().multiplyScalar(R * rr(4.2, 5.5)).add(T.v1.set(rr(-0.3, 0.3), rr(-0.3, 0.3), rr(-0.5, -0.1)));
      const contacto = d0.clone().multiplyScalar(R + 0.03);
      const eje = new THREE.Vector3().crossVectors(d0, new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize()).normalize();
      const pts = [inicio, inicio.clone().lerp(contacto, 0.55).addScaledVector(d0, 0.25), contacto];
      const arco = rr(0.9, 1.5) * (i % 2 ? 1 : -1);
      for (let k = 1; k <= 5; k++) pts.push(d0.clone().applyAxisAngle(eje, (arco * k) / 5).multiplyScalar(R + 0.028));
      const curva = new THREE.CatmullRomCurve3(pts);
      // fracción de la curva donde la hifa toca la célula
      const uContacto = 2 / (pts.length - 1);
      const geo = new THREE.TubeGeometry(curva, 140, 0.032, 8, false);
      const mat = new THREE.ShaderMaterial({
        uniforms: {uGrow: {value: 0}, uAlpha: {value: 1}, uTime: U.uTime, uNoise: U.uNoise},
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vWp; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWp=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `precision mediump float; uniform float uGrow, uAlpha, uTime; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
          void main(){ if (vUv.x > uGrow) discard;
            vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vWp);
            float tabique = smoothstep(0.92, 1.0, fract(vUv.x*26.0)); // septos de la hifa
            float fib = texture2D(uNoise, vec2(vUv.x*12.0, vUv.y*2.0)).r;
            vec3 col = vec3(0.86,0.8,0.66) * (0.45 + 0.4*fib) * (0.4 + 0.6*max(dot(N, normalize(vec3(0.3,0.8,0.5))),0.0));
            col *= 1.0 - tabique*0.35;
            col += vec3(1.0,0.95,0.8) * pow(1.0-max(dot(N,V),0.0),2.5) * 0.45;
            float punta = smoothstep(uGrow-0.02, uGrow, vUv.x);
            col += vec3(1.0,0.95,0.8)*punta*0.5;
            gl_FragColor = vec4(col, uAlpha); }`,
        transparent: true,
      });
      const tubo = new THREE.Mesh(geo, mat);
      tubo.renderOrder = 6;
      g.add(tubo);
      // apresorio: hifa ensanchada y aplanada contra la pared
      const apr = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 10),
        new THREE.MeshBasicMaterial({color: 0xf0e2c2, transparent: true, opacity: 0.9})
      );
      apr.position.copy(d0).multiplyScalar(R + 0.012);
      apr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d0);
      apr.scale.set(0.001, 0.001, 0.001);
      apr.renderOrder = 6;
      g.add(apr);
      // muestras de la curva para los flujos (CPU, baratas)
      const muestras = curva.getSpacedPoints(200);
      this.tubos.push({tubo, mat, apr, curva, muestras, uContacto, retraso: i * 0.08});
    });

    // flujos de polioles: del interior de la célula hacia cada hifa
    const POR_TUBO = 22;
    this.nFlujo = POR_TUBO * this.tubos.length;
    const fp = new Float32Array(this.nFlujo * 3);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.flujo = new THREE.Points(
      fg,
      new THREE.PointsMaterial({color: 0xffe2a0, size: 0.034, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false})
    );
    this.flujo.frustumCulled = false;
    this.flujo.renderOrder = 7;
    this.fases = Float32Array.from({length: this.nFlujo}, () => rnd());
    g.add(this.flujo);

    // otras células al fondo, desenfocadas por la niebla
    const NF = 14;
    this.fondo = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 20, 14), materialCelula(), NF);
    for (let i = 0; i < NF; i++) {
      const a = rr(0.25, Math.PI - 0.25);
      const d = rr(2.6, 6);
      T.m.compose(T.v1.set(Math.cos(a) * d, rr(-1.6, 1.8), -Math.sin(a) * d - 1.2), T.q.identity(), T.s.setScalar(rr(0.7, 1.2)));
      this.fondo.setMatrixAt(i, T.m);
    }
    this.fondo.material.uniforms.uAlpha.value = 0.5;
    g.add(this.fondo);
  }

  /** Coloca el microcosmos frente al visitante a la altura de sus ojos */
  situar(altOjos) {
    this.centro.set(0, altOjos - 0.02, -1.6);
  }

  /**
   * estado:
   *  encuentro 0-1 · hongo 0-1 · alga 0-1 · union 0-1 · zoom ≥1 (acercamiento al contacto)
   *  intimo 0-1 · envolver 0-1 · intercambio 0-1 · retirada 0-1 (escena 5: todo se contrae)
   */
  actualizar(dt, reloj, s) {
    /* ---------- encuentro ---------- */
    const e = this.encuentro;
    e.visible = s.encuentro > 0.002;
    if (e.visible) {
      // ampliar alrededor del punto de contacto
      const z = s.zoom;
      e.scale.setScalar(z);
      e.position.copy(this.centro).addScaledVector(this.contacto, -(z - 1));
      const a = s.encuentro;
      this.hifas.material.uniforms.uGrow.value = s.hongo * (0.8 + 0.2 * s.union);
      this.hifas.material.uniforms.uAlpha.value = a;
      this.puente.material.uniforms.uGrow.value = suave(0.05, 0.95, s.union);
      this.puente.material.uniforms.uAlpha.value = a;
      this.halHongo.material.opacity = s.hongo * a * 0.28;
      this.halAlga.material.opacity = s.alga * a * 0.3 * (1 - s.union * 0.6);
      this.hongo.rotation.y = Math.sin(reloj * 0.07) * 0.15;
      this.celulas.material.uniforms.uAlpha.value = s.alga * a;
      const u = suave(0.25, 1, s.union);
      for (let i = 0; i < this.datosCel.length; i++) {
        const c = this.datosCel[i];
        // movimiento lento de flotación hacia la capa compartida
        c.p.copy(c.ini).add(this.posAlga).lerp(c.fin, u);
        c.p.y += Math.sin(reloj * 0.6 + c.f) * 0.012;
        const k = c.s * Math.max(0.001, s.alga) * (0.92 + 0.08 * Math.sin(reloj * 1.6 + c.f));
        T.m.makeScale(k, k, k).setPosition(c.p);
        this.celulas.setMatrixAt(i, T.m);
      }
      this.celulas.instanceMatrix.needsUpdate = true;
    }

    /* ---------- íntimo ---------- */
    const g = this.intimo;
    g.visible = s.intimo > 0.002;
    if (g.visible) {
      const r = s.retirada; // 0 → 1: la célula se aleja y se contrae hacia el talo
      const esc = lerp(1, 0.02, suave(0, 1, r));
      g.scale.setScalar(esc);
      g.position.copy(this.centro);
      g.position.z -= 0.1;
      g.position.y -= r * 0.6;
      g.rotation.y = reloj * 0.02;
      const a = s.intimo;
      this.pared.material.uniforms.uAlpha.value = a;
      this.cloroplasto.material.uniforms.uAlpha.value = a;
      this.cloroplasto.material.uniforms.uLuz.value = 0.5 + 0.5 * s.intercambio;
      this.pirenoide.material.opacity = 0.85 * a;
      this.fondo.material.uniforms.uAlpha.value = 0.32 * a;
      const pulso = 1 + 0.012 * Math.sin(reloj * 1.3);
      this.pared.scale.setScalar(pulso);
      for (const t of this.tubos) {
        const crec = clamp((s.envolver - t.retraso) / (1 - t.retraso));
        t.mat.uniforms.uGrow.value = crec;
        t.mat.uniforms.uAlpha.value = a;
        const ap = suave(t.uContacto, t.uContacto + 0.15, crec);
        t.apr.scale.set(ap, ap * 0.35, ap);
        t.apr.material.opacity = 0.9 * a;
      }
      // flujos: del contacto hacia el interior de la hifa
      const fpos = this.flujo.geometry.attributes.position;
      const POR = this.nFlujo / this.tubos.length;
      for (let i = 0; i < this.nFlujo; i++) {
        const t = this.tubos[Math.floor(i / POR)];
        this.fases[i] = (this.fases[i] + dt * 0.09) % 1;
        const u = t.uContacto * (1 - this.fases[i]);
        const m = t.muestras[Math.min(200, Math.floor(u * 200))];
        fpos.setXYZ(i, m.x, m.y, m.z);
      }
      fpos.needsUpdate = true;
      this.flujo.material.opacity = s.intercambio * a * 0.9;
    }
  }
}
