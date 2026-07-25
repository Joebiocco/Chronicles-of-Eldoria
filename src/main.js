import { GameEngine } from './engine.js';
import { IndexedDbAccountRepository, PersistenceCoordinator } from './storage.js';
import { AppUI } from './ui.js';
import { AudioManager } from './audio.js';

const bootStatus = document.getElementById('boot-status');
const VALID_VIEWS = new Set(['dashboard', 'map', 'skills', 'combat', 'quests', 'town', 'bank', 'character', 'collections', 'settings']);

function setBootStatus(message) {
  if (bootStatus) bootStatus.textContent = message;
}



async function runOfflineSimulation(account, targetTime) {
  const slot = account.activeSlot;
  const character = Number.isInteger(slot) ? account.slots?.[slot] : null;
  if (!character || account.settings?.offlineProgress === false) return { account, report: null, simulated: false };
  const elapsed = Math.max(0, targetTime - (character.lastProcessedAt || targetTime));
  if (elapsed < 15_000 || !('Worker' in globalThis)) return { account, report: null, simulated: false };

  setBootStatus('Resolving offline progress…');
  return new Promise((resolve) => {
    let settled = false;
    let worker;
    let timeout = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      worker?.terminate();
      resolve(value);
    };
    try {
      worker = new Worker('./simulation-worker.js', { type: 'module' });
      worker.addEventListener('message', (event) => {
        const result = event.data || {};
        if (result.ok && result.account) finish({ account: result.account, report: result.report || null, simulated: true });
        else finish({ account, report: null, simulated: false, error: result.error || 'Offline worker failed.' });
      }, { once: true });
      worker.addEventListener('error', (event) => finish({ account, report: null, simulated: false, error: event.message }), { once: true });
      worker.postMessage({ type: 'simulate', account, targetTime });
    } catch (error) {
      finish({ account, report: null, simulated: false, error: error?.message || String(error) });
    }
    timeout = setTimeout(() => finish({ account, report: null, simulated: false, error: 'Offline worker timed out.' }), 12_000);
  });
}

async function registerServiceWorker(ui) {
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return null;
  try {
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });

    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    ui.setServiceWorkerRegistration(registration);
    if (registration.waiting && navigator.serviceWorker.controller) ui.showUpdateReady(registration);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) ui.showUpdateReady(registration);
      });
    });
    return registration;
  } catch (error) {
    console.warn('Service worker registration failed.', error);
    return null;
  }
}

async function boot() {
  setBootStatus('Opening the local chronicle…');
  const repository = new IndexedDbAccountRepository();
  let account = await repository.loadAccount();

  const targetTime = Date.now();
  const offline = await runOfflineSimulation(account, targetTime);
  account = offline.account;

  const hash = location.hash.replace(/^#/, '');
  const queryView = new URLSearchParams(location.search).get('view');
  const requestedView = VALID_VIEWS.has(queryView) ? queryView : hash;
  if (VALID_VIEWS.has(requestedView)) account.settings.lastView = requestedView;

  const engine = new GameEngine(account);
  const persistence = new PersistenceCoordinator({
    repository,
    getAccount: () => engine.account,
    autosaveSeconds: engine.account.settings.autosaveSeconds,
  });
  const ui = new AppUI({ engine, persistence });
  const audio = new AudioManager(() => engine.account.settings);
  ui.setAudioManager(audio);

  let deferredInstallPrompt = null;
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    ui.setInstallPrompt(event);
  });
  addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    ui.setInstallPrompt(null);
    ui.toast('Installed', 'Chronicles of Eldoria is now available from your home screen.', 'success');
  });

  await ui.initialize();
  persistence.start();

  if (offline.simulated) {
    persistence.markDirty('offline-worker', { urgent: true });
    if (offline.report && engine.character) queueMicrotask(() => ui.openOfflineReport(offline.report));
  } else if (engine.character) {
    await ui.processResume();
    if (offline.error) console.warn(offline.error);
  }

  if ((hash === 'activity' || queryView === 'activity') && engine.character) queueMicrotask(() => ui.openActivityPlanner());

  const simulationTimer = setInterval(() => {
    if (!document.hidden && engine.character) engine.advanceTo(Date.now(), { offline: false });
  }, 250);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistence.flush('background').catch(() => {});
      return;
    }
    if (engine.character) engine.advanceTo(Date.now(), { offline: true });
  });

  addEventListener('online', () => ui.toast('Online', 'Network access is available. Local play never depends on it.', 'success'));
  addEventListener('offline', () => ui.toast('Offline mode', 'The installed game and local saves remain playable.', ''));
  addEventListener('beforeunload', () => clearInterval(simulationTimer));

  const registration = await registerServiceWorker(ui);
  if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);

  // A small, explicit development surface. Simulation, UI, and persistence
  // remain independent so a future Supabase repository can be substituted.
  globalThis.eldoria = Object.freeze({ engine, ui, persistence, repository, registration, audio });
  setBootStatus('Ready');
}

boot().catch((error) => {
  console.error(error);
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.hidden = false;
    boot.innerHTML = `<div class="boot-emblem">!</div><h1>Could not open Eldoria</h1><p>${String(error?.message || error).replace(/[<>&]/g, '')}</p><button id="boot-retry" class="button primary">Try again</button>`;
    document.getElementById('boot-retry')?.addEventListener('click', () => location.reload());
  }
});
