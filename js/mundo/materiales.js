/**
 * Uniforms compartidos y material del mundo (suelo, rocas, cortezas).
 * Un solo shader barato con variantes por #define; muestrea la textura de ruido horneada.
 */
import * as THREE from 'three';

export const NUM_ONDAS = 8;

export const U = {
  uTime: {value: 0},
  uNoise: {value: null},
  uWaves: {value: Array.from({length: NUM_ONDAS}, () => new THREE.Vector4(0, 0, -999, 0))},
  uFogColor: {value: new THREE.Color(0x000000)},
  uFogDensity: {value: 0.06},
  uLightDir: {value: new THREE.Vector3(0.4, 0.8, 0.3).normalize()},
  uLight: {value: new THREE.Color(0x000000)},
  uAmbient: {value: new THREE.Color(0x020302)},
  uLichen: {value: 0}, // líquenes sobre las rocas del entorno
  uMoss: {value: 0}, // musgo y hepáticas
  uSoil: {value: 0}, // meteorización y materia orgánica
  uNet: {value: 0}, // brillo basal de la red (escena 8)
  uNetColor: {value: new THREE.Color(0x8ff5cf)},
  uWet: {value: 0.4}, // humedad: oscurece y da brillo
};

// Ondas de luz que recorren superficies (un exp por onda, sin ramas)
export const GLSL_ONDAS = /* glsl */ `
  uniform vec4 uWaves[${NUM_ONDAS}];
  uniform float uTime;
  float waveAt(vec3 wp){
    float s = 0.0;
    for(int i=0;i<${NUM_ONDAS};i++){
      vec4 w = uWaves[i];
      float age = uTime - w.z;
      float x = (length(wp.xz - w.xy) - age * 2.4) * 1.6;
      float vivo = step(0.0, age) * step(age, 10.0);
      s += vivo * w.w * exp(-x*x - age*0.3);
    }
    return s;
  }
`;

/**
 * tipo: 0 suelo · 1 roca · 2 corteza
 * propios: uniforms que este material NO comparte (p. ej. la roca madre tiene su propio liquen)
 */
export function materialMundo({base = 0x1a1714, tipo = 0, propios = {}} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {...U, uBase: {value: new THREE.Color(base)}, ...propios},
    defines: {KIND: tipo},
    vertexShader: /* glsl */ `
      varying vec3 vWp; varying vec3 vN; varying vec3 vLp;
      void main(){
        vec4 lp = vec4(position, 1.0);
        vec3 nn = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          nn = mat3(instanceMatrix) * nn;
        #endif
        vLp = lp.xyz;
        vec4 wp = modelMatrix * lp;
        vWp = wp.xyz; vN = normalize(mat3(modelMatrix) * nn);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform vec3 uBase, uFogColor, uLight, uAmbient, uLightDir, uNetColor;
      uniform float uFogDensity, uLichen, uMoss, uSoil, uNet, uWet;
      varying vec3 vWp; varying vec3 vN; varying vec3 vLp;
      ${GLSL_ONDAS}
      // Proyección por coordenadas locales: la textura crece con el objeto en el viaje de escala
      vec4 Tx(vec3 p, vec3 N, float esc){
        #if KIND == 0
          return texture2D(uNoise, p.xz * esc);
        #else
          vec3 a = abs(N);
          vec2 uv = a.y > max(a.x, a.z) ? p.xz : (a.x > a.z ? p.zy : p.xy);
          return texture2D(uNoise, uv * esc);
        #endif
      }
      void main(){
        vec3 N = normalize(vN);
        vec3 p = vLp;
        vec4 n0 = Tx(p, N, 0.25);
        vec4 n1 = Tx(p, N, 1.7);
        vec3 col = uBase * (0.55 + 0.55 * n0.r + 0.25 * n1.r);
        #if KIND == 2
          float sur = texture2D(uNoise, vec2((p.x + p.z) * 1.4, p.y * 0.06)).r;
          col *= 0.55 + 0.75 * sur;
        #endif
        // Meteorización: microfisuras y materia orgánica oscura que se acumula
        float fis = 1.0 - smoothstep(0.0, 0.06, Tx(p, N, 0.9).b);
        col *= 1.0 - fis * uSoil * 0.55;
        col = mix(col, vec3(0.09,0.07,0.05), uSoil * 0.35 * smoothstep(0.45, 0.8, n0.a));
        // Musgo en caras superiores
        #if KIND == 0
          float up = 1.0;
        #else
          float up = smoothstep(0.1, 0.7, N.y);
        #endif
        float mossN = Tx(p, N, 0.11).a;
        float moss = smoothstep(1.0 - uMoss * 1.1, 1.2 - uMoss * 1.1, mossN + 0.12) * up * uMoss;
        #if KIND == 2
          moss = uMoss * smoothstep(1.8, 0.1, vWp.y) * 0.75;
        #endif
        vec3 mossCol = mix(vec3(0.06,0.16,0.04), vec3(0.19,0.32,0.09), n1.g);
        col = mix(col, mossCol, clamp(moss, 0.0, 1.0));
        // Líquenes costrosos y foliosos: manchas que se expanden desde núcleos
        vec4 nl = Tx(p, N, 1.05);
        float th = 1.02 - uLichen * 0.52;
        float mancha = smoothstep(th, th + 0.035, nl.g);
        float tono = nl.a;
        vec3 lichCol = tono < 0.42 ? vec3(0.8,0.5,0.18) : (tono < 0.6 ? vec3(0.55,0.64,0.48) : vec3(0.64,0.68,0.58));
        #if KIND == 0
          mancha *= 0.12; // sobre el suelo casi no hay líquenes
        #elif KIND == 2
          mancha *= 0.5; // en la corteza: costrosos gris verdosos
          lichCol = mix(lichCol, vec3(0.5,0.58,0.46), 0.6);
        #endif
        lichCol *= 0.75 + 0.35 * smoothstep(th + 0.035, th + 0.11, nl.g);
        col = mix(col, lichCol, mancha);
        // Luz
        float dif = max(dot(N, uLightDir), 0.0);
        col *= uAmbient + uLight * dif;
        col *= 1.0 - uWet * 0.25;
        // Red: venas + ondas
        float wave = waveAt(vWp);
        #if KIND == 2
          float vena = 1.0 - smoothstep(0.0, 0.08, texture2D(uNoise, vec2((p.x - p.z) * 0.9, p.y * 0.05)).b);
        #else
          float vena = 1.0 - smoothstep(0.0, 0.05, Tx(p + 20.0, N, 0.18).b);
        #endif
        float glow = vena * (uNet * 0.35 + wave * 1.5) + mancha * wave * 0.6;
        #if KIND == 0
          glow += wave * 0.12;
        #endif
        col += uNetColor * glow;
        // Niebla exponencial cuadrática
        vec3 dv = vWp - cameraPosition;
        float k = uFogDensity * uFogDensity * dot(dv, dv);
        col = mix(col, uFogColor, clamp(1.0 - exp(-k), 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Material de la cúpula del cielo */
export function materialCielo() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {uTop: {value: new THREE.Color(0)}, uBot: {value: new THREE.Color(0)}},
    vertexShader: `varying float vH; void main(){ vH=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `precision mediump float; uniform vec3 uTop,uBot; varying float vH; void main(){ gl_FragColor=vec4(mix(uBot,uTop,clamp(vH*1.4+0.25,0.0,1.0)),1.0);}`,
  });
}
