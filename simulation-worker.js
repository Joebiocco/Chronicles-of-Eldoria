import { applyContentPack } from './src/data.js';
import { GameEngine } from './src/engine.js';

self.addEventListener('message', (event) => {
  const { type, account, targetTime } = event.data || {};
  if (type !== 'simulate') return;
  try {
    for (const descriptor of account?.mods || []) {
      if (descriptor?.pack) applyContentPack(descriptor.pack);
    }
    const engine = new GameEngine(account);
    const report = engine.character ? engine.advanceTo(Number(targetTime) || Date.now(), { offline: true }) : null;
    self.postMessage({ ok: true, account: engine.account, report });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.stack || error?.message || String(error) });
  }
});
