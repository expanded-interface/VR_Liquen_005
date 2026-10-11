/**
 * Memoria de un liquen · arranque.
 * 1. Configura XR Blocks sólo con lo indispensable (VR, manos, piso local; sin cámara ni micrófono).
 * 2. Carga primero el bosque inicial (Gaussian Splat) con progreso visible; si falla, usa el procedural.
 * 3. Habilita la entrada: "Entrar en VR" en el Quest, "Ver en el navegador" en computador.
 */
import * as xb from 'xrblocks';
import {Director} from './escenas/director.js';
import {BosqueSplat} from './sistemas/splats.js';
import {sonido} from './nucleo/sonido.js';
import {SPLAT_BOSQUE, ES_QUEST} from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // El mismo toque que abre la experiencia desbloquea el audio (requisito del navegador, sin permisos)
  window.addEventListener('pointerdown', () => sonido.iniciar(), {capture: true});

  const estado = document.getElementById('estado');
  const barra = document.getElementById('barraCarga');
  const btn = document.getElementById('btnNavegador');

  const options = new xb.Options();
  options.enableVR();
  options.enableHands(); // seguimiento de manos de Quest 3: pellizco = gatillo
  options.hands.visualization = true;
  options.hands.visualizeMeshes = true;
  options.reticles.enabled = false;
  options.webxrOptionalFeatures = ['local-floor'];
  options.permissions.camera = false;
  options.permissions.microphone = false;
  options.permissions.geolocation = false;
  options.referenceSpaceType = 'local-floor';
  options.setFramebufferScaleFactor(1.0);
  options.xrButton.enabled = true;
  options.xrButton.startText = 'Entrar en VR';
  options.xrButton.endText = 'Salir de VR';
  options.xrButton.invalidText = 'Este navegador no tiene VR';
  options.xrButton.showEnterSimulatorButton = false;
  options.xrButton.alwaysAutostartSimulator = false;
  // Simulador de escritorio: un claro vacío en vez de la sala de estar por defecto
  const claro = {name: 'Claro', locations: {start: {description: 'Centro', position: [0, 1.6, 0]}}};
  options.simulator.environments = [{name: 'Claro', manifestPath: 'data:application/json,' + encodeURIComponent(JSON.stringify(claro))}];
  options.simulator.activeEnvironmentIndex = 0;
  options.simulator.instructions.showAutomatically = false;
  options.camera.far = 220;

  const splat = new BosqueSplat(xb, SPLAT_BOSQUE);
  const director = new Director(splat);
  xb.add(director);

  // El botón de XR Blocks se reubica dentro de la ficha
  const mover = () => {
    const w = document.getElementById('XRButtonWrapper');
    const slot = document.getElementById('xrSlot');
    if (w && w.parentElement !== slot) slot.appendChild(w);
  };
  new MutationObserver(mover).observe(document.body, {childList: true});

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    director.introCerrada = true;
    document.getElementById('intro').hidden = true;
    try {
      if (!xb.core.simulatorRunning) await xb.core.startSimulator();
      director.comenzar();
    } catch (e) {
      console.error(e);
      document.getElementById('intro').hidden = false;
      estado.textContent = 'No se pudo abrir la vista de navegador.';
      btn.disabled = false;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !xb.core.renderer?.xr?.isPresenting) sonido.pausar();
  });

  try {
    await xb.init(options);
    mover();
  } catch (e) {
    console.error(e);
    estado.textContent = 'No se pudo iniciar la escena: ' + (e?.message || e);
    return;
  }

  // Bosque inicial primero; lo demás es procedural y no descarga nada
  estado.textContent = 'Cargando el bosque…';
  const ok = await splat.cargar((p) => {
    barra.style.width = Math.round(p * 100) + '%';
  });
  barra.style.width = '100%';
  btn.disabled = false;
  document.getElementById('xrSlot').hidden = false; // no se entra antes de tener el bosque inicial

  const vr = navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
  const fuente = ok ? `Bosque: ${splat.nombre}.` : 'Bosque procedural (no se encontró el Gaussian Splat).';
  if (vr && ES_QUEST) {
    btn.hidden = true;
    estado.textContent = `${fuente} Meta Quest listo: pulsa “Entrar en VR”.`;
  } else if (vr) {
    estado.textContent = `${fuente} Visor detectado: entra en VR o mira en el navegador.`;
  } else {
    estado.textContent = `${fuente} Este dispositivo no tiene VR; para la experiencia completa abre esta dirección en el Meta Quest 3.`;
  }
});
