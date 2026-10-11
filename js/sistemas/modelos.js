/**
 * SISTEMA B · Modelos GLB/GLTF opcionales.
 * Si config.url existe se carga con GLTFLoader (three/addons, el mismo que usa XR Blocks);
 * si no existe o falla, se devuelve la versión procedural. La experiencia nunca depende de un archivo.
 */
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const cargador = new GLTFLoader();

export async function modeloOProcedural(config, crearProcedural) {
  if (config?.url) {
    try {
      const gltf = await cargador.loadAsync(config.url);
      const raiz = gltf.scene;
      raiz.scale.multiplyScalar(config.escala || 1);
      raiz.userData.animaciones = gltf.animations || [];
      raiz.userData.esGLB = true;
      console.info('[Sistema B] Modelo cargado:', config.url);
      return raiz;
    } catch (e) {
      console.info('[Sistema B] Se usa la versión procedural de', config.url, '·', e.message || e);
    }
  }
  return crearProcedural();
}
