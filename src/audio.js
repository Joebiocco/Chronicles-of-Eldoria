const CUES = ['click', 'hit', 'hurt', 'miss', 'objective', 'quest', 'quest-complete', 'victory', 'rare', 'save'];

export class AudioManager {
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.cache = new Map();
    this.unlocked = false;
    this.unlock = () => { this.unlocked = true; };
    addEventListener('pointerdown', this.unlock, { once: true, passive: true });
    addEventListener('keydown', this.unlock, { once: true });
  }

  async play(cue, channel = 'effects') {
    const settings = this.getSettings?.() || {};
    if (!settings.sound || !this.unlocked) return;
    if (channel === 'combat' && settings.combatSounds === false) return;
    if (channel === 'interface' && settings.interfaceSounds === false) return;
    if (channel === 'notification' && settings.notificationSounds === false) return;
    const safeCue = CUES.includes(cue) ? cue : 'click';
    let audio = this.cache.get(safeCue);
    if (!audio) {
      audio = new Audio(`./assets/audio/${safeCue}.wav`);
      audio.preload = 'auto';
      this.cache.set(safeCue, audio);
    }
    const master = Number(settings.masterVolume ?? .75);
    const specific = Number(channel === 'interface' ? settings.interfaceVolume ?? .45 : channel === 'notification' ? settings.notificationVolume ?? .65 : settings.effectsVolume ?? .65);
    const instance = audio.cloneNode();
    instance.volume = Math.max(0, Math.min(1, master * specific));
    try { await instance.play(); } catch { /* Browser gesture policy or muted device. */ }
  }
}
