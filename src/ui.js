import { APP_VERSION, DATA, EQUIPMENT_SLOTS, SKILL_CATEGORIES, applyContentPack } from './data.js';
import { exportAccountPayload, exportCharacterPayload, parseImportPayload } from './state.js';
import { installMemoryUI } from './memory-ui.js';
import {
  downloadText,
  escapeHtml,
  formatDuration,
  formatNumber,
  levelProgress,
  readFileText,
  titleCase,
} from './utils.js';

const NAVIGATION = [
  { group: 'Chronicle', entries: [
    ['dashboard', '🏠', 'Dashboard'], ['map', '🗺️', 'World Map'], ['skills', '⚒️', 'Skills'], ['combat', '⚔️', 'Combat'], ['quests', '📜', 'Quests'],
  ] },
  { group: 'Guild & Estate', entries: [
    ['town', '🏰', 'Town & Estate'], ['bank', '🏦', 'Inventory & Bank'], ['character', '🧑‍⚔️', 'Character'], ['collections', '🏺', 'Collections'],
  ] },
  { group: 'System', entries: [['settings', '⚙️', 'Settings']] },
];

export class AppUI {
  constructor({ engine, persistence }) {
    this.engine = engine;
    this.persistence = persistence;
    this.installPrompt = null;
    this.renderQueued = false;
    this.lastOfflineReportId = null;
    this.state = {
      view: engine.account.settings.lastView || 'dashboard',
      selectedSkill: 'woodcutting',
      skillCategory: 'Gathering',
      selectedRegion: engine.character?.location || 'stonehaven',
      mapOverlay: engine.account.settings.mapOverlay || 'resources',
      questTab: 'active',
      townTab: 'farming',
      bankTab: 'inventory',
      bankSearch: '',
      bankFilter: 'all',
      collectionTab: 'achievements',
    };

    this.bootScreen = document.getElementById('boot-screen');
    this.bootStatus = document.getElementById('boot-status');
    this.characterGate = document.getElementById('character-gate');
    this.characterSlots = document.getElementById('character-slots');
    this.gameShell = document.getElementById('game-shell');
    this.sidebar = document.getElementById('sidebar');
    this.mainView = document.getElementById('main-view');
    this.contextDrawer = document.getElementById('context-drawer');
    this.mobileNav = document.getElementById('mobile-nav');
    this.modalLayer = document.getElementById('modal-layer');
    this.modalCard = document.getElementById('modal-card');
    this.toastRegion = document.getElementById('toast-region');
    this.saveStatus = document.getElementById('save-status');

    this.bindEvents();
    this.bindEngineEvents();
    this.applySettings();
  }

  bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action], [data-view]');
      if (!target) return;
      if (target.dataset.view) {
        event.preventDefault();
        if (!this.modalLayer.hidden) this.closeModal();
        this.setView(target.dataset.view);
        return;
      }
      event.preventDefault();
      this.handleAction(target.dataset.action, target).catch((error) => this.toast('Action failed', error.message || String(error), 'danger'));
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target.matches('[data-setting]')) this.handleSettingChange(target);
      if (target.matches('[data-map-overlay]')) {
        this.state.mapOverlay = target.value;
        this.engine.account.settings.mapOverlay = target.value;
        this.persistence.markDirty('map-overlay');
        this.renderView(true);
      }
      if (target.matches('[data-bank-search]')) {
        this.state.bankSearch = target.value;
        this.renderView(true);
      }
      if (target.matches('[data-bank-filter]')) {
        this.state.bankFilter = target.value;
        this.renderView(true);
      }
      if (target.matches('[data-combat-style]')) {
        try { this.engine.setCombatStyle(target.value); } catch (error) { this.toast('Combat style', error.message, 'danger'); }
      }
    });

    this.modalLayer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeModal();
    });
  }

  bindEngineEvents() {
    this.engine.addEventListener('change', (event) => {
      this.persistence.markDirty(event.detail.reason, { urgent: event.detail.urgent });
      this.scheduleRender(true);
    });
    this.engine.addEventListener('tick', () => this.updateDynamic());
    this.engine.addEventListener('notification', (event) => {
      const notification = event.detail.notification;
      if (!['achievement', 'level'].includes(notification.type)) this.toast(notification.title, notification.message, notification.type === 'danger' ? 'danger' : notification.type === 'warning' ? 'danger' : 'success');
      if (this.engine.account.settings.notifications && document.hidden && Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message, icon: './assets/icons/icon-192.png' });
      }
    });
    this.engine.addEventListener('level-up', (event) => {
      const skill = DATA.skills[event.detail.skillId];
      this.toast(`${skill.icon} ${skill.name} level ${event.detail.level}`, 'A new level has been reached.', 'success');
    });
    this.engine.addEventListener('achievement', (event) => {
      const achievement = DATA.achievements[event.detail.id];
      this.toast(`${achievement.icon} Achievement unlocked`, achievement.name, 'success');
    });
    this.engine.addEventListener('offline-report', (event) => {
      const report = event.detail.report;
      if (this.lastOfflineReportId !== report.id) {
        this.lastOfflineReportId = report.id;
        queueMicrotask(() => this.openOfflineReport(report));
      }
    });

    this.persistence.addEventListener('status', (event) => {
      const { status, detail, at } = event.detail;
      if (status === 'saving') this.saveStatus.textContent = 'Saving locally…';
      else if (status === 'saved') this.saveStatus.textContent = `Saved locally at ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      else if (status === 'dirty') this.saveStatus.textContent = 'Unsaved changes';
      else if (status === 'error') this.saveStatus.textContent = `Save error: ${detail}`;
    });
  }

  async initialize() {
    this.bootStatus.textContent = 'Restoring local characters…';
    // requestAnimationFrame can be indefinitely throttled in a restored,
    // background, or headless tab. The timeout keeps startup reliable while
    // still allowing one painted boot frame on normal launches.
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(finish, 250);
      requestAnimationFrame(finish);
    });
    this.bootScreen.hidden = true;
    if (this.engine.character) this.showGame();
    else this.showCharacterGate();
  }

  applySettings() {
    const settings = this.engine.account.settings;
    document.documentElement.style.setProperty('--text-scale', String(settings.textScale || 1));
    document.body.classList.toggle('large-text', Number(settings.textScale) >= 1.14);
    document.body.classList.toggle('reduced-motion', Boolean(settings.reducedMotion));
    document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));
  }

  setInstallPrompt(prompt) {
    this.installPrompt = prompt;
    document.querySelectorAll('[data-action="install-app"]').forEach((button) => { button.hidden = !prompt; });
  }

  showCharacterGate() {
    this.gameShell.hidden = true;
    this.characterGate.hidden = false;
    this.renderCharacterGate();
  }

  showGame() {
    this.characterGate.hidden = true;
    this.gameShell.hidden = false;
    this.state.selectedRegion = this.engine.character.location;
    this.renderAll();
    this.mainView.focus({ preventScroll: true });
  }

  renderCharacterGate() {
    this.characterSlots.innerHTML = this.engine.account.slots.map((character, slot) => {
      if (!character) {
        return `<article class="character-slot empty">
          <div class="slot-portrait">🧑</div>
          <h2 class="slot-name">Empty Chronicle ${slot + 1}</h2>
          <p class="card-subtitle">Choose a background, difficulty, and starting region.</p>
          <div class="slot-actions">
            <button class="button primary" data-action="create-character" data-slot="${slot}">Create character</button>
            <button class="button" data-action="import-character" data-slot="${slot}">Import character</button>
          </div>
        </article>`;
      }
      const totalLevel = Object.keys(DATA.skills).reduce((sum, skillId) => sum + levelProgress(character.xp[skillId] || 0).level, 0);
      const completed = Object.values(character.quests || {}).filter((state) => state.status === 'completed').length;
      return `<article class="character-slot">
        <div class="slot-portrait">${escapeHtml(character.portrait || '🧑‍⚔️')}</div>
        <h2 class="slot-name">${escapeHtml(character.name)}</h2>
        <div class="slot-meta">
          <span>${escapeHtml(character.title || 'Wayfarer')} · ${escapeHtml(DATA.difficulties[character.difficulty]?.name || character.difficulty)}</span>
          <span>Total level ${formatNumber(totalLevel)} · ${formatNumber(character.coins)} coins</span>
          <span>${escapeHtml(DATA.regions[character.location]?.name || character.location)} · ${completed} quests complete</span>
          ${character.flags?.deceased ? '<span class="danger-text">Hardcore Chronicle ended</span>' : ''}
        </div>
        <div class="slot-actions">
          <button class="button primary" data-action="play-character" data-slot="${slot}">Play</button>
          <div class="button-row">
            <button class="button small" data-action="export-character-slot" data-slot="${slot}">Export</button>
            <button class="button small" data-action="rename-character-slot" data-slot="${slot}">Rename</button>
            <button class="button small danger" data-action="delete-character" data-slot="${slot}">Delete</button>
          </div>
        </div>
      </article>`;
    }).join('');
    document.querySelectorAll('[data-action="install-app"]').forEach((button) => { button.hidden = !this.installPrompt; });
  }

  renderAll() {
    if (!this.engine.character) return;
    this.renderHeader();
    this.renderSidebar();
    this.renderView(false);
    this.renderContext();
    this.updateMobileNav();
    this.updateDynamic();
  }

  scheduleRender(preserveScroll = true) {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (!this.engine.character || this.gameShell.hidden) {
        this.renderCharacterGate();
        return;
      }
      this.renderHeader();
      this.renderSidebar();
      this.renderView(preserveScroll);
      this.renderContext();
      this.updateMobileNav();
    });
  }

  renderHeader() {
    const character = this.engine.character;
    if (!character) return;
    document.getElementById('character-subtitle').textContent = `${character.name} · ${character.title}`;
    document.getElementById('top-coins').textContent = formatNumber(character.coins);
    document.getElementById('top-location').textContent = DATA.regions[character.location]?.name || character.location;
    const maxHp = this.engine.getMaxHp();
    document.getElementById('top-hp').textContent = `${Math.max(0, Math.floor(character.currentHp))}/${maxHp}`;
    document.getElementById('top-hp-fill').style.width = `${clampedPercent(character.currentHp, maxHp)}%`;
    const unread = character.inbox.filter((entry) => !entry.read).length;
    const badge = document.getElementById('inbox-badge');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    const info = this.getActivityInfo();
    document.getElementById('activity-icon').textContent = info.icon;
    document.getElementById('activity-label').textContent = info.label;
    document.querySelector('#activity-progress-mini span').style.width = `${info.percent}%`;
  }

  renderSidebar() {
    this.sidebar.innerHTML = NAVIGATION.map((group) => `<div class="nav-group">
      <div class="nav-label">${escapeHtml(group.group)}</div>
      ${group.entries.map(([view, icon, label]) => `<button type="button" class="nav-button ${this.state.view === view ? 'active' : ''}" data-view="${view}">
        <span class="nav-icon">${icon}</span><span>${escapeHtml(label)}</span>${this.navMeta(view)}
      </button>`).join('')}
    </div>`).join('');
  }

  navMeta(view) {
    const character = this.engine.character;
    if (view === 'quests') {
      const ready = Object.values(character.quests).filter((state) => state.status === 'ready').length;
      return ready ? `<small>${ready} ready</small>` : '<small></small>';
    }
    if (view === 'bank') return `<small>${this.engine.getContainerSlots(character.inventory)}/${this.engine.getInventoryCapacity()}</small>`;
    if (view === 'skills') return `<small>${formatNumber(this.engine.getTotalLevel())}</small>`;
    if (view === 'combat') return `<small>Lvl ${this.engine.getCharacterLevel()}</small>`;
    return '<small></small>';
  }

  updateMobileNav() {
    this.mobileNav.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === this.state.view));
  }

  setView(view, options = {}) {
    const valid = NAVIGATION.flatMap((group) => group.entries.map((entry) => entry[0]));
    if (!valid.includes(view)) view = 'dashboard';
    this.state.view = view;
    if (options.skill) this.state.selectedSkill = options.skill;
    if (options.townTab) this.state.townTab = options.townTab;
    if (options.bankTab) this.state.bankTab = options.bankTab;
    this.engine.account.settings.lastView = view;
    if (globalThis.history && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    this.persistence.markDirty('view');
    this.renderAll();
    this.mainView.scrollTop = 0;
    this.mainView.focus({ preventScroll: true });
  }

  renderView(preserveScroll = false) {
    const scrollTop = preserveScroll ? this.mainView.scrollTop : 0;
    const renderer = {
      dashboard: () => this.renderDashboard(),
      map: () => this.renderMap(),
      skills: () => this.renderSkills(),
      combat: () => this.renderCombat(),
      quests: () => this.renderQuests(),
      town: () => this.renderTown(),
      bank: () => this.renderBank(),
      character: () => this.renderCharacter(),
      collections: () => this.renderCollections(),
      settings: () => this.renderSettings(),
    }[this.state.view] || (() => this.renderDashboard());
    this.mainView.innerHTML = renderer();
    if (preserveScroll) this.mainView.scrollTop = scrollTop;
  }

  renderContext() {
    const character = this.engine.character;
    const event = this.engine.getWorldEvent();
    const weather = this.engine.getWeather(character.location);
    const activity = this.getActivityInfo();
    const readyCrops = character.farming.plots.filter((plot) => plot.cropId && plot.readyAt <= Date.now()).length;
    const activeQuest = Object.entries(character.quests).find(([id, state]) => !DATA.quests[id]?.stages?.length && ['active', 'ready'].includes(state.status));
    const quest = activeQuest ? DATA.quests[activeQuest[0]] : null;
    const timers = [];
    if (character.research.active) timers.push({ icon: '📚', label: DATA.research[character.research.active.researchId]?.name, end: character.research.active.endsAt });
    for (const expedition of character.companions.activeExpeditions) timers.push({ icon: '🎒', label: DATA.expeditions[expedition.expeditionId]?.name, end: expedition.endsAt });
    for (const route of character.trade.activeRoutes) timers.push({ icon: '📦', label: `Trade to ${DATA.regions[route.to]?.name}`, end: route.endsAt });
    if (character.sailing.activeVoyage) timers.push({ icon: '⛵', label: DATA.voyages[character.sailing.activeVoyage.voyageId]?.name, end: character.sailing.activeVoyage.endsAt });

    this.contextDrawer.innerHTML = `
      <section class="context-section">
        <h2 class="context-title">Current activity</h2>
        <div class="context-item"><strong>${activity.icon} ${escapeHtml(activity.label)}</strong><small>${escapeHtml(activity.detail)}</small>
          <div class="progress-track" style="margin-top:7px"><div class="progress-fill" data-context-activity-progress style="width:${activity.percent}%"></div></div>
        </div>
        ${character.activity ? `<div class="button-row" style="margin-top:8px"><button class="button small" data-action="open-activity">Details</button><button class="button small danger" data-action="stop-activity">Stop</button></div>` : ''}
      </section>
      <section class="context-section">
        <h2 class="context-title">World conditions</h2>
        <div class="context-list">
          <div class="context-item"><strong>${event.icon} ${escapeHtml(event.name)}</strong><small>${escapeHtml(event.description)}</small><small data-countdown="${event.endsAt}"></small></div>
          <div class="context-item"><strong>${weather.icon} ${escapeHtml(weather.name)}</strong><small>${escapeHtml(DATA.regions[character.location].name)}</small></div>
        </div>
      </section>
      ${quest ? `<section class="context-section"><h2 class="context-title">Pinned quest</h2><div class="context-item"><strong>${quest.icon} ${escapeHtml(quest.name)}</strong><small>${activeQuest[1].status === 'ready' ? 'Ready to claim' : `${quest.objectives.filter((objective) => this.engine.getObjectiveProgress(objective) >= objective.count).length}/${quest.objectives.length} objectives`}</small></div></section>` : ''}
      <section class="context-section">
        <h2 class="context-title">Passive systems</h2>
        <div class="context-list">
          ${readyCrops ? `<button class="context-item" data-action="town-tab" data-tab="farming"><strong>🌱 ${readyCrops} crop${readyCrops === 1 ? '' : 's'} ready</strong><small>Open Farming</small></button>` : ''}
          ${timers.length ? timers.map((timer) => `<div class="context-item"><strong>${timer.icon} ${escapeHtml(timer.label)}</strong><small data-countdown="${timer.end}"></small></div>`).join('') : '<div class="context-item"><small>No passive projects are currently active.</small></div>'}
        </div>
      </section>
      ${character.activityQueue?.length ? `<section class="context-section"><h2 class="context-title">Activity queue</h2><div class="context-list">${character.activityQueue.slice(0, 4).map((entry) => `<div class="context-item"><strong>${DATA.actions[entry.actionId]?.icon || '⚡'} ${escapeHtml(DATA.actions[entry.actionId]?.name || entry.actionId)}</strong><small>${entry.repetitions ? `${entry.repetitions} completions` : 'Until stopped'}</small></div>`).join('')}</div></section>` : ''}
    `;
    this.updateCountdowns();
  }

  renderDashboard() {
    const character = this.engine.character;
    const region = DATA.regions[character.location];
    const event = this.engine.getWorldEvent();
    const activity = this.getActivityInfo();
    const readyQuestEntries = Object.entries(character.quests).filter(([id, state]) => !DATA.quests[id]?.stages?.length && state.status === 'ready').slice(0, 3);
    const activeQuestEntries = Object.entries(character.quests).filter(([id, state]) => !DATA.quests[id]?.stages?.length && state.status === 'active').slice(0, 3);
    const latestReport = character.offlineReports.at(-1);
    const suggestion = this.getNextSuggestion();
    const readyCrops = character.farming.plots.filter((plot) => plot.cropId && plot.readyAt <= Date.now()).length;
    const buildingCount = Object.values(character.buildings).filter((state) => state.level > 0).length;

    return `${pageHeader('🏠', `Welcome back, ${character.name}`, 'Plan a focused activity, manage passive systems, and respond to Eldoria’s changing world.', `
      <button class="button" data-view="map">Open map</button>
      <button class="button primary" data-action="open-activity">Choose activity</button>`)}
      <section class="dashboard-hero">
        <div class="hero-content">
          <p class="eyebrow">${escapeHtml(region.name)} · Danger ${region.danger}</p>
          <h2>${event.icon} ${escapeHtml(event.name)}</h2>
          <p>${escapeHtml(event.description)}</p>
          <div class="button-row"><button class="button primary" data-view="map">Explore ${escapeHtml(region.name)}</button><button class="button" data-view="quests">Open quest journal</button></div>
        </div>
      </section>

      <div class="stat-grid" style="margin:14px 0">
        ${statTile('Total level', formatNumber(this.engine.getTotalLevel()), '⚑')}
        ${statTile('Combat level', formatNumber(this.engine.getCharacterLevel()), '⚔️')}
        ${statTile('Regions found', `${character.discoveredRegions.length}/${Object.keys(DATA.regions).length}`, '🗺️')}
        ${statTile('Quests complete', character.stats.questsCompleted, '📜')}
        ${statTile('Lifetime kills', formatNumber(character.stats.kills), '☠️')}
        ${statTile('Legacy points', character.legacy.points, '✦')}
      </div>

      <div class="two-column">
        <div class="stack">
          <article class="card card-pad active">
            <div class="card-header"><div><h2 class="card-title">${activity.icon} ${escapeHtml(activity.label)}</h2><p class="card-subtitle">${escapeHtml(activity.detail)}</p></div><span class="pill gold">Focused activity</span></div>
            <div class="progress-track large" style="margin-top:13px"><div class="progress-fill" data-dashboard-activity-progress style="width:${activity.percent}%"></div></div>
            <div class="button-row" style="margin-top:12px">
              ${character.activity ? `<button class="button primary" data-action="open-activity">Manage activity</button><button class="button danger" data-action="stop-activity">Stop</button>${this.activeInteractionButton()}` : '<button class="button primary" data-action="open-activity">Choose an activity</button>'}
            </div>
          </article>

          <article class="card card-pad">
            <div class="card-header"><div><h2 class="card-title">📜 Quest priorities</h2><p class="card-subtitle">Objectives update automatically as you train, explore, craft, and fight.</p></div><button class="button small" data-view="quests">Journal</button></div>
            <div class="quest-list" style="margin-top:10px">
              ${(readyQuestEntries.length ? readyQuestEntries : activeQuestEntries).map(([id, state]) => this.questSummaryCard(id, state)).join('') || '<div class="empty-state">No active quest. Open the journal to begin one.</div>'}
            </div>
          </article>

          <article class="card card-pad">
            <div class="card-header"><div><h2 class="card-title">🧭 Suggested next step</h2><p class="card-subtitle">A recommendation based on current progression and location.</p></div></div>
            <p>${escapeHtml(suggestion.text)}</p>
            <button class="button primary" ${suggestion.view ? `data-view="${suggestion.view}"` : `data-action="${suggestion.action}"`}>${escapeHtml(suggestion.label)}</button>
          </article>
        </div>

        <div class="stack">
          <article class="card card-pad">
            <h2 class="card-title">⏳ Passive systems</h2>
            <div class="context-list" style="margin-top:10px">
              <button class="context-item" data-action="town-tab" data-tab="farming"><strong>🌱 Farming</strong><small>${readyCrops} ready · ${character.farming.plots.filter((plot) => plot.cropId).length}/${character.farming.plots.length} planted</small></button>
              <button class="context-item" data-action="town-tab" data-tab="buildings"><strong>🏗️ Estate</strong><small>${buildingCount} structures built</small></button>
              <button class="context-item" data-action="town-tab" data-tab="companions"><strong>🎒 Companions</strong><small>${Object.keys(character.companions.owned).length} recruited · ${character.companions.activeExpeditions.length} away</small></button>
              <button class="context-item" data-action="town-tab" data-tab="trade"><strong>📦 Trade</strong><small>${character.trade.activeRoutes.length} route${character.trade.activeRoutes.length === 1 ? '' : 's'} active</small></button>
              <button class="context-item" data-action="town-tab" data-tab="sailing"><strong>⛵ Sailing</strong><small>${character.sailing.ship ? character.sailing.ship.name : 'No ship built'}</small></button>
            </div>
          </article>
          ${latestReport ? `<article class="card card-pad"><div class="card-header"><div><h2 class="card-title">🌙 Last offline report</h2><p class="card-subtitle">${formatDuration(latestReport.rawElapsed)} away</p></div><button class="button small" data-action="show-latest-report">Review</button></div>${this.reportMiniSummary(latestReport)}</article>` : ''}
          <article class="card card-pad"><h2 class="card-title">🔔 Recent discoveries</h2><div class="context-list" style="margin-top:10px">${character.inbox.slice(-5).reverse().map((entry) => `<div class="context-item"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.message)}</small></div>`).join('') || '<div class="context-item"><small>No recent entries.</small></div>'}</div></article>
        </div>
      </div>`;
  }

  renderMap() {
    const character = this.engine.character;
    const selectedId = DATA.regions[this.state.selectedRegion] ? this.state.selectedRegion : character.location;
    const selected = DATA.regions[selectedId];
    const event = this.engine.getWorldEvent();
    const weather = this.engine.getWeather(selectedId);
    const plan = selectedId !== character.location ? this.engine.getTravelPlan(selectedId) : null;
    const activeQuestRegions = new Set(Object.entries(character.quests).filter(([, state]) => ['active', 'ready'].includes(state.status)).map(([id]) => DATA.quests[id]?.region).filter(Boolean));
    const routesSvg = DATA.routes.map(([a, b]) => {
      const from = DATA.regions[a]; const to = DATA.regions[b];
      return `<line class="map-route" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
    }).join('');
    const markers = Object.entries(DATA.regions).map(([id, region]) => {
      const discovered = character.discoveredRegions.includes(id);
      const current = character.location === id;
      const eventHere = event.regions?.includes(id);
      const questHere = activeQuestRegions.has(id);
      const overlayText = this.mapMarkerOverlay(id, region);
      return `<button class="map-marker ${current ? 'current' : ''} ${selectedId === id ? 'selected' : ''} ${!discovered ? 'locked' : ''} ${questHere ? 'quest' : eventHere ? 'event' : ''}" style="left:${region.x}%;top:${region.y}%" data-action="select-region" data-region="${id}" aria-label="${escapeHtml(region.name)}${current ? ', current location' : ''}" title="${escapeHtml(region.name)} — ${escapeHtml(overlayText)}">${discovered || current ? region.icon : '？'}</button>`;
    }).join('');

    return `${pageHeader('🗺️', 'World Map', 'Travel routes, resources, weather, faction influence, quests, and danger are all grounded in Eldoria’s geography.', `
      <select class="select" data-map-overlay aria-label="Map overlay">
        ${['resources', 'danger', 'quests', 'weather', 'factions', 'trade'].map((id) => `<option value="${id}" ${this.state.mapOverlay === id ? 'selected' : ''}>${titleCase(id)} overlay</option>`).join('')}
      </select>`)}
      <div class="map-legend">
        <span class="pill gold">📍 Current location</span><span class="pill">❓ Undiscovered</span><span class="pill danger">! Active quest</span><span class="pill">✦ World event</span>
      </div>
      <div class="map-layout">
        <div class="map-frame" aria-label="Interactive map of Eldoria">
          <div class="map-canvas">
            <img class="map-image" src="./assets/eldoria-map.png" alt="Painted map of Eldoria showing mountains, forests, Crystal Lake, Mount Ember, the Wilds, towns, and coastal locations.">
            <svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${routesSvg}</svg>
            ${markers}
          </div>
        </div>
        <aside class="card card-pad region-panel">
          <div class="region-art">${selected.icon}</div>
          <p class="eyebrow" style="margin-top:12px">${escapeHtml(DATA.factions[selected.faction]?.name || 'Unclaimed')}</p>
          <h2 class="page-title" style="font-size:1.65rem">${escapeHtml(selected.name)}</h2>
          <p class="card-subtitle">${escapeHtml(selected.description)}</p>
          <div class="action-meta">
            <span class="pill danger">Danger ${selected.danger}/10</span>
            <span class="pill">Recommended ${selected.recommended}+</span>
            <span class="pill">${weather.icon} ${escapeHtml(weather.name)}</span>
            ${event.regions.includes(selectedId) ? `<span class="pill gold">${event.icon} Event active</span>` : ''}
          </div>
          <div class="region-service-list">${selected.services.map((service) => `<span class="pill">${escapeHtml(titleCase(service))}</span>`).join('')}</div>
          <div class="resource-list">
            <div class="resource-row"><span>Resources</span><strong>${escapeHtml(selected.resources.map(titleCase).join(', '))}</strong></div>
            <div class="resource-row"><span>Local enemies</span><strong>${Object.values(DATA.enemies).filter((enemy) => enemy.region === selectedId).length}</strong></div>
            <div class="resource-row"><span>Available actions</span><strong>${Object.values(DATA.actions).filter((action) => action.regions?.includes(selectedId)).length}</strong></div>
          </div>
          ${selectedId === character.location ? `<button class="button success" disabled>Current location</button>` : `<div class="button-row"><button class="button primary" data-action="travel-region" data-region="${selectedId}">Travel · ${plan ? formatDuration(plan.seconds * 1000, true) : 'unreachable'}</button>${character.discoveredRegions.includes(selectedId) && character.buildings.portal_chamber?.level ? `<button class="button" data-action="waystone-region" data-region="${selectedId}">Waystone</button>` : ''}</div>`}
          <div class="divider"></div>
          <button class="button" data-action="open-region-content" data-region="${selectedId}">View local content</button>
        </aside>
      </div>`;
  }

  mapMarkerOverlay(id, region) {
    const character = this.engine.character;
    if (this.state.mapOverlay === 'danger') return `Danger ${region.danger}/10`;
    if (this.state.mapOverlay === 'weather') return this.engine.getWeather(id).name;
    if (this.state.mapOverlay === 'factions') return DATA.factions[region.faction]?.name || 'Unclaimed';
    if (this.state.mapOverlay === 'quests') return Object.entries(character.quests).filter(([, state]) => ['active', 'ready'].includes(state.status)).some(([questId]) => DATA.quests[questId]?.region === id) ? 'Active quest' : 'No active quest';
    if (this.state.mapOverlay === 'trade') return REGION_TRADE_SUMMARY[id] || 'Regional market';
    return region.resources.map(titleCase).join(', ');
  }

  renderSkills() {
    const skillId = this.state.selectedSkill;
    const skill = DATA.skills[skillId];
    if (!skill) return this.renderSkillOverview();
    const progress = levelProgress(this.engine.character.xp[skillId] || 0);
    const allActions = Object.values(DATA.actions).filter((action) => action.skill === skillId).sort((a, b) => a.level - b.level);
    const active = this.engine.character.activity?.kind === 'skill' ? this.engine.character.activity : null;
    const isPassive = skill.passive;
    const isCombat = skill.combat;

    return `${pageHeader(skill.icon, skill.name, skill.description, `<button class="button" data-action="skill-overview">All skills</button>${isPassive ? '<button class="button primary" data-action="town-tab" data-tab="farming">Open Farming</button>' : isCombat ? '<button class="button primary" data-view="combat">Open Combat</button>' : ''}`)}
      <article class="card card-pad" style="margin-bottom:14px">
        <div class="split"><div><strong class="gold">Level ${progress.level}${progress.next ? '' : ' · Maximum'}</strong><div class="muted">${formatNumber(this.engine.character.xp[skillId] || 0)} total XP · Mastery pool ${formatNumber(this.engine.getMasteryPool(skillId))}</div></div><span class="card-icon">${skill.icon}</span></div>
        <div class="progress-track large" style="margin-top:11px"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
        <div class="progress-meta"><span>${progress.next ? `${formatNumber(progress.current)} XP this level` : 'Maximum level'}</span><span>${progress.next ? `${formatNumber(progress.remaining)} remaining` : ''}</span></div>
      </article>
      ${isPassive || isCombat ? this.renderSpecialSkillInfo(skillId) : `
        <div class="card-grid">
          ${allActions.map((action) => this.actionCard(action, active)).join('') || '<div class="empty-state">No actions have been defined for this skill yet.</div>'}
        </div>`}`;
  }

  renderSkillOverview() {
    const character = this.engine.character;
    const skills = Object.entries(DATA.skills).filter(([, skill]) => skill.category === this.state.skillCategory);
    return `${pageHeader('⚒️', 'Skills', 'Train thirty interconnected gathering, production, combat, utility, and advanced disciplines.', '')}
      <div class="category-tabs">${SKILL_CATEGORIES.map((category) => `<button class="button ${this.state.skillCategory === category ? 'primary' : ''}" data-action="skill-category" data-category="${category}">${escapeHtml(category)}</button>`).join('')}</div>
      <div class="skill-overview-grid">
        ${skills.map(([id, skill]) => {
          const progress = levelProgress(character.xp[id] || 0);
          return `<button class="card skill-overview-card" data-action="select-skill" data-skill="${id}">
            <span class="skill-head"><span class="skill-icon">${skill.icon}</span><span class="skill-name">${escapeHtml(skill.name)}</span><span class="skill-level">${progress.level}</span></span>
            <span class="progress-track"><span class="progress-fill" style="width:${progress.percent}%"></span></span>
            <small class="muted">${escapeHtml(skill.description)}</small>
          </button>`;
        }).join('')}
      </div>`;
  }

  renderSpecialSkillInfo(skillId) {
    const skill = DATA.skills[skillId];
    if (skillId === 'farming') return `<article class="card card-pad"><h2 class="card-title">Persistent farming plots</h2><p class="card-subtitle">Crops continue growing while the app is closed. Gardens, compost, research, weather, and world events change yield and timing.</p><button class="button primary" data-action="town-tab" data-tab="farming" style="margin-top:12px">Manage plots</button></article>`;
    if (skill.combat) return `<article class="card card-pad"><h2 class="card-title">Trained through combat</h2><p class="card-subtitle">${escapeHtml(skill.name)} gains XP from combat styles, abilities, damage taken, healing, and Slayer assignments. Configure automation so the same combat system works actively or in the background.</p><button class="button primary" data-view="combat" style="margin-top:12px">Open combat</button></article>`;
    return '';
  }

  actionCard(action, active) {
    const character = this.engine.character;
    const skillLevel = this.engine.getSkillLevel(action.skill);
    const mastery = this.engine.getActionMastery(action.id);
    const here = action.regions.includes(character.location);
    const locked = skillLevel < action.level;
    const activeHere = active?.actionId === action.id;
    const duration = this.engine.getActionDuration(action);
    const xpHour = Math.round(action.xp * 3600000 / duration);
    const output = Object.entries(action.outputs || {}).map(([id, qty]) => `${qty}× ${DATA.items[id]?.name || id}`).join(', ') || (action.coins ? `${action.coins[0]}–${action.coins[1]} coins` : action.familiar ? 'Familiar bond' : 'Progress');
    const inputs = Object.entries(action.inputs || {}).map(([id, qty]) => `${qty}× ${DATA.items[id]?.name || id} (${formatNumber(this.engine.stackQty(id))})`).join(', ');
    const progress = activeHere ? clampedPercent(active.progressMs || 0, duration) : 0;
    return `<article class="card activity-card ${locked ? 'locked' : ''} ${activeHere ? 'active' : ''}">
      <div class="card-header"><div class="cluster"><span class="card-icon">${action.icon}</span><div><h2 class="card-title">${escapeHtml(action.name)}</h2><p class="card-subtitle">Level ${action.level} · ${formatDuration(duration, true)} · ${formatNumber(xpHour)} XP/hour</p></div></div><span class="pill gold">Mastery ${mastery}</span></div>
      <div class="action-meta"><span class="pill">${here ? `📍 ${DATA.regions[character.location].name}` : `🗺️ ${action.regions.map((id) => DATA.regions[id]?.name).join(', ')}`}</span>${action.danger ? `<span class="pill danger">Danger ${action.danger}</span>` : ''}</div>
      ${inputs ? `<div class="resource-list"><div class="resource-row"><span>Requires</span><strong>${escapeHtml(inputs)}</strong></div></div>` : ''}
      <div class="resource-list"><div class="resource-row"><span>Produces</span><strong>${escapeHtml(output)}</strong></div></div>
      <div class="progress-track"><div class="progress-fill" data-action-progress="${action.id}" style="width:${progress}%"></div></div>
      <div class="button-row" style="margin-top:10px">
        ${activeHere ? `<button class="button danger" data-action="stop-activity">Stop</button>${this.activeInteractionButton()}` : `<button class="button primary" data-action="start-skill-action" data-id="${action.id}" ${locked || !here ? 'disabled' : ''}>${locked ? 'Locked' : here ? 'Start' : 'Travel required'}</button><button class="button" data-action="queue-skill-action" data-id="${action.id}" ${locked ? 'disabled' : ''}>Queue</button>`}
      </div>
    </article>`;
  }

  renderCombat() {
    const character = this.engine.character;
    const activity = character.activity?.kind === 'combat' ? character.activity : null;
    const stats = this.engine.getCombatStats();
    const enemies = Object.values(DATA.enemies).filter((enemy) => enemy.region === character.location);
    const encounters = Object.entries(DATA.encounters).filter(([, encounter]) => encounter.region === character.location);
    if (activity) return this.renderActiveCombat(activity, stats);

    return `${pageHeader('⚔️', 'Combat', 'Build a loadout, choose a style, configure conditional automation, and engage enemies with active abilities or safe idle rules.', `<button class="button" data-action="open-automation">Automation</button><button class="button" data-action="open-loadouts">Loadouts</button>`)}
      <div class="two-column">
        <div class="stack">
          <article class="card card-pad">
            <div class="card-header"><div><h2 class="card-title">Combat style</h2><p class="card-subtitle">Each style trains different skills and consumes different supplies.</p></div><span class="pill gold">Combat level ${this.engine.getCharacterLevel()}</span></div>
            <div class="choice-grid" style="margin-top:12px">
              ${['melee', 'ranged', 'sorcery', 'faith'].map((style) => `<label class="choice-card ${character.combat.style === style ? 'selected' : ''}"><input type="radio" name="combat-style" value="${style}" data-combat-style ${character.combat.style === style ? 'checked' : ''}><strong>${COMBAT_STYLE_ICONS[style]} ${titleCase(style)}</strong><p class="card-subtitle">${escapeHtml(COMBAT_STYLE_DESCRIPTIONS[style])}</p></label>`).join('')}
            </div>
          </article>
          <article class="card card-pad"><h2 class="card-title">Local enemies · ${escapeHtml(DATA.regions[character.location].name)}</h2><div class="card-grid" style="margin-top:12px">${enemies.map((enemy) => this.enemyCard(enemy)).join('') || '<div class="empty-state">No ordinary enemies are present here. Travel to a dangerous region or enter an encounter.</div>'}</div></article>
          ${encounters.length ? `<article class="card card-pad"><h2 class="card-title">Dungeons and challenges</h2><div class="card-grid" style="margin-top:12px">${encounters.map(([id, encounter]) => `<div class="card card-pad"><div class="card-header"><span class="card-icon">${encounter.icon}</span><div><h3 class="card-title">${escapeHtml(encounter.name)}</h3><p class="card-subtitle">Recommended ${encounter.recommended} · ${encounter.sequence.length} stages</p></div></div><button class="button primary" data-action="start-encounter" data-id="${id}" style="margin-top:12px">Enter</button></div>`).join('')}</div></article>` : ''}
        </div>
        <aside class="stack">
          <article class="card card-pad"><h2 class="card-title">Derived combat stats</h2>${this.combatStatGrid(stats)}</article>
          <article class="card card-pad"><div class="card-header"><div><h2 class="card-title">Slayer assignment</h2><p class="card-subtitle">Assignments reward extra Slayer XP and completion bonuses.</p></div></div>${character.slayer.assignment ? `<p><strong>${DATA.enemies[character.slayer.assignment.enemyId]?.name}</strong><br><span class="muted">${character.slayer.assignment.remaining}/${character.slayer.assignment.total} remaining</span></p>` : '<p class="muted">No assignment active.</p>'}<button class="button" data-action="request-slayer">${character.slayer.assignment ? 'Replace assignment' : 'Request assignment'}</button></article>
          <article class="card card-pad"><h2 class="card-title">Automation safety</h2>${automationSummary(character.combat.automation)}<button class="button" data-action="open-automation">Configure rules</button></article>
        </aside>
      </div>`;
  }

  renderActiveCombat(activity, stats) {
    const character = this.engine.character;
    const enemy = DATA.enemies[activity.enemyId];
    const difficulty = DATA.difficulties[character.difficulty];
    const enemyPower = difficulty.enemyPower || 1;
    const abilities = character.combat.abilityLoadouts[character.combat.style] || [];
    return `${pageHeader('⚔️', enemy.name, `${DATA.regions[enemy.region].name} · ${character.combat.style} style · Combat continues according to your automation rules.`, `<button class="button" data-action="open-automation">Automation</button><button class="button danger" data-action="flee-combat">Flee</button>`)}
      <div class="combat-arena">
        <article class="card combatant-card">
          <h2 class="card-title">${escapeHtml(character.name)}</h2><p class="card-subtitle">${titleCase(character.combat.style)} · Level ${this.engine.getCharacterLevel()}</p>
          <div class="combatant-icon">${character.portrait || '🧑‍⚔️'}</div>
          <div class="progress-track large"><div class="progress-fill hp" data-player-hp-fill style="width:${clampedPercent(character.currentHp, stats.maxHp)}%"></div></div><div class="progress-meta"><span data-player-hp-text>${Math.max(0, Math.floor(character.currentHp))}/${stats.maxHp} HP</span><span>${Math.round(stats.armor)} armor</span></div>
          <div class="status-row">${statusChips(activity.playerStatuses)}</div>
        </article>
        <div class="combat-versus">VS</div>
        <article class="card combatant-card">
          <h2 class="card-title">${escapeHtml(enemy.name)}</h2><p class="card-subtitle">Level ${enemy.level} · ${titleCase(enemy.damageType)}</p>
          <div class="combatant-icon">${enemy.icon}</div>
          <div class="progress-track large"><div class="progress-fill hp" data-enemy-hp-fill style="width:${clampedPercent(activity.enemyHp, enemy.hp)}%"></div></div><div class="progress-meta"><span data-enemy-hp-text>${Math.max(0, Math.floor(activity.enemyHp))}/${enemy.hp} HP</span><span>${Math.round(enemy.armor * enemyPower)} armor</span></div>
          <div class="status-row">${statusChips(activity.enemyStatuses)}</div>
          ${activity.telegraph ? `<div class="telegraph">⚠ ${escapeHtml(activity.telegraph.name)} is being prepared. Interrupt it before the next round.</div>` : ''}
        </article>
      </div>
      <div class="ability-bar">${abilities.map((id) => this.abilityButton(id)).join('')}</div>
      <div class="two-column" style="margin-top:14px">
        <article class="card card-pad"><h2 class="card-title">Combat log</h2><div class="combat-log" style="margin-top:10px">${character.combat.log.slice(0, 40).map((entry) => `<div>${escapeHtml(entry.message)}</div>`).join('') || '<div>Combat has just begun.</div>'}</div></article>
        <aside class="stack"><article class="card card-pad"><h2 class="card-title">Session</h2><div class="resource-list"><div class="resource-row"><span>Kills</span><strong>${activity.killsThisSession}</strong></div><div class="resource-row"><span>Food remaining</span><strong>${this.engine.totalFoodCount()}</strong></div><div class="resource-row"><span>Round</span><strong>${activity.round}</strong></div></div></article><article class="card card-pad"><h2 class="card-title">Automation</h2>${automationSummary(character.combat.automation)}</article></aside>
      </div>`;
  }

  abilityButton(id) {
    const ability = DATA.abilities[id];
    const readyAt = this.engine.character.combat.cooldowns[id] || 0;
    const remaining = Math.max(0, readyAt - Date.now());
    return `<button class="button ability-button ${remaining ? '' : 'primary'}" data-action="combat-ability" data-id="${id}" ${remaining ? 'disabled' : ''}><strong>${ability.icon} ${escapeHtml(ability.name)}</strong><small>${remaining ? `Ready in ${formatDuration(remaining, true)}` : escapeHtml(ability.description)}</small></button>`;
  }

  enemyCard(enemy) {
    const style = this.engine.character.combat.style;
    const resistance = enemy.resistances?.[style === 'melee' ? 'slash' : style === 'ranged' ? 'pierce' : style === 'sorcery' ? 'arcane' : 'radiant'] || 0;
    return `<article class="card card-pad">
      <div class="card-header"><span class="card-icon">${enemy.icon}</span><div><h3 class="card-title">${escapeHtml(enemy.name)}</h3><p class="card-subtitle">Level ${enemy.level} · ${enemy.hp} HP · Max hit ${enemy.maxHit}</p></div></div>
      <div class="action-meta"><span class="pill">${titleCase(enemy.damageType)} damage</span><span class="pill ${resistance < 0 ? 'success' : resistance > 20 ? 'danger' : ''}">${resistance ? `${resistance > 0 ? '+' : ''}${resistance}% style resistance` : 'Neutral resistance'}</span>${enemy.boss ? '<span class="pill danger">Boss</span>' : ''}</div>
      <div class="resource-list"><div class="resource-row"><span>Reward</span><strong>${enemy.coins[0]}–${enemy.coins[1]} coins · ${enemy.xp} combat XP</strong></div></div>
      <button class="button primary" data-action="start-combat" data-id="${enemy.id}">Engage</button>
    </article>`;
  }

  combatStatGrid(stats) {
    return `<div class="stat-grid" style="margin-top:10px">${[
      ['Accuracy', Math.round(stats.accuracy)], ['Damage', Math.round(stats.damage)], ['Armor', Math.round(stats.armor)], ['Evasion', Math.round(stats.evasion)], ['Block', `${Math.round(stats.block)}%`], ['Critical', `${Math.round(stats.critChance)}%`], ['Attack speed', formatDuration(stats.attackSpeedMs, true)], ['Max HP', stats.maxHp],
    ].map(([label, value]) => statTile(label, value)).join('')}</div>`;
  }

  renderQuests() {
    const character = this.engine.character;
    const tabMap = {
      active: ['active', 'ready'],
      available: ['available'],
      completed: ['completed'],
      locked: ['locked'],
    };
    const statuses = tabMap[this.state.questTab] || tabMap.active;
    const entries = Object.entries(DATA.quests).filter(([id]) => statuses.includes(character.quests[id]?.status));
    return `${pageHeader('📜', 'Quest Journal', 'Main chapters, settlement stories, faction decisions, skill trials, collections, and repeatable objectives share one data-driven quest engine.', '')}
      <div class="category-tabs">${Object.keys(tabMap).map((tab) => `<button class="button ${this.state.questTab === tab ? 'primary' : ''}" data-action="quest-tab" data-tab="${tab}">${titleCase(tab)} <span class="faint">${Object.values(character.quests).filter((state) => tabMap[tab].includes(state.status)).length}</span></button>`).join('')}</div>
      <div class="quest-list">${entries.map(([id, quest]) => this.questCard(id, quest, character.quests[id])).join('') || '<div class="empty-state">No quests in this section.</div>'}</div>`;
  }

  questCard(id, quest, state) {
    const complete = this.engine.isQuestComplete(id);
    return `<article class="card quest-card ${state.status === 'ready' ? 'active' : ''}">
      <div class="card-header"><div class="cluster"><span class="card-icon">${quest.icon}</span><div><p class="eyebrow">${escapeHtml(quest.category)}${quest.chapter ? ` · Chapter ${quest.chapter}` : ''}</p><h2 class="card-title">${escapeHtml(quest.name)}</h2><p class="card-subtitle">${escapeHtml(quest.giver || 'Eldoria')} · ${escapeHtml(DATA.regions[quest.region]?.name || '')}</p></div></div><span class="pill ${state.status === 'ready' ? 'success' : state.status === 'locked' ? 'danger' : 'gold'}">${titleCase(state.status)}</span></div>
      <p>${escapeHtml(quest.description)}</p>
      <div class="objective-list">${(quest.objectives || []).map((objective) => {
        const progress = this.engine.getObjectiveProgress(objective);
        const done = progress >= objective.count;
        return `<div class="objective ${done ? 'complete' : ''}"><span class="check">${done ? '✓' : '○'}</span><span>${escapeHtml(objective.label)}</span><strong>${formatNumber(Math.min(progress, objective.count))}/${formatNumber(objective.count)}</strong></div>`;
      }).join('')}</div>
      ${quest.rewards ? `<div class="resource-list"><div class="resource-row"><span>Rewards</span><strong>${escapeHtml(rewardSummary(quest.rewards))}</strong></div></div>` : ''}
      <div class="button-row">
        ${state.status === 'available' ? `<button class="button primary" data-action="start-quest" data-id="${id}">Begin quest</button>` : ''}
        ${['active', 'ready'].includes(state.status) && complete ? `<button class="button success" data-action="claim-quest" data-id="${id}">${quest.choices ? 'Choose outcome' : 'Claim rewards'}</button>` : ''}
        ${quest.region && state.status !== 'locked' && this.engine.character.location !== quest.region ? `<button class="button" data-action="select-and-open-region" data-region="${quest.region}">Show on map</button>` : ''}
      </div>
    </article>`;
  }

  questSummaryCard(id, state) {
    const quest = DATA.quests[id];
    if (quest.stages?.length) {
      const stage = quest.stages[state.stageIndex || 0];
      const completed = stage?.objectives?.filter((objective) => state.completedObjectives?.[objective.id]).length || 0;
      const total = stage?.objectives?.length || 0;
      return `<button class="context-item" data-action="open-story-quest" data-id="${id}"><strong>${quest.icon} ${escapeHtml(quest.name)}</strong><small>${state.status === 'decision' ? 'Decision required' : `${escapeHtml(stage?.title || 'In progress')} · ${completed}/${total}`}</small></button>`;
    }
    const objectives = quest.objectives || [];
    const completeCount = objectives.filter((objective) => this.engine.getObjectiveProgress(objective) >= objective.count).length;
    return `<button class="context-item" data-view="quests"><strong>${quest.icon} ${escapeHtml(quest.name)}</strong><small>${state.status === 'ready' ? 'Ready to claim' : `${completeCount}/${objectives.length} objectives complete`}</small></button>`;
  }

  renderTown() {
    const tabs = [
      ['farming', '🌱', 'Farming'], ['buildings', '🏗️', 'Estate'], ['projects', '🏰', 'Projects'], ['companions', '🎒', 'Companions'],
      ['research', '📚', 'Research'], ['trade', '📦', 'Trade'], ['sailing', '⛵', 'Sailing'], ['market', '⚖️', 'Market'],
    ];
    return `${pageHeader('🏰', 'Town, Estate & Guilds', 'Manage systems that continue independently of your focused activity: farming, buildings, research, expeditions, caravans, projects, and voyages.', '')}
      <div class="category-tabs">${tabs.map(([id, icon, label]) => `<button class="button ${this.state.townTab === id ? 'primary' : ''}" data-action="town-tab" data-tab="${id}">${icon} ${label}</button>`).join('')}</div>
      ${this.renderTownTab(this.state.townTab)}`;
  }

  renderTownTab(tab) {
    if (tab === 'farming') return this.renderFarming();
    if (tab === 'buildings') return this.renderBuildings();
    if (tab === 'projects') return this.renderProjects();
    if (tab === 'companions') return this.renderCompanions();
    if (tab === 'research') return this.renderResearch();
    if (tab === 'trade') return this.renderTrade();
    if (tab === 'sailing') return this.renderSailing();
    if (tab === 'market') return this.renderMarket();
    return this.renderFarming();
  }

  renderFarming() {
    const character = this.engine.character;
    const level = this.engine.getSkillLevel('farming');
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Persistent farming</h2><p class="page-description">Plots mature according to timestamps, so growth continues after the app closes. Compost and Garden levels improve yield.</p></div><span class="pill gold">Farming ${level}</span></div>
      <div class="farm-grid">${character.farming.plots.map((plot) => {
        if (!plot.cropId) return `<article class="card farm-plot"><div class="crop-icon">🟫</div><h3 class="card-title">Empty plot ${plot.index + 1}</h3><p class="card-subtitle">Choose any unlocked crop whose seeds are in your inventory.</p><div class="button-row"><button class="button primary" data-action="plant-crop" data-plot="${plot.id}">Plant</button></div></article>`;
        const crop = DATA.crops[plot.cropId];
        const ready = plot.readyAt <= Date.now();
        const percent = ready ? 100 : clampedPercent(Date.now() - plot.plantedAt, plot.readyAt - plot.plantedAt);
        return `<article class="card farm-plot ${ready ? 'active' : ''}"><div class="crop-icon">${crop.icon}</div><h3 class="card-title">${escapeHtml(crop.name)}</h3><p class="card-subtitle">${plot.composted ? 'Composted · ' : ''}${ready ? 'Ready to harvest' : `Ready in ${formatDuration(plot.readyAt - Date.now(), true)}`}</p><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="button-row">${ready ? `<button class="button success" data-action="harvest-crop" data-plot="${plot.id}">Harvest</button>` : '<button class="button" disabled>Growing</button>'}</div></article>`;
      }).join('')}</div>`;
  }

  renderBuildings() {
    const character = this.engine.character;
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Willowbrook estate</h2><p class="page-description">Personal buildings unlock storage, loadouts, farming plots, research, salvage, automation, waystones, and passive production.</p></div><span class="pill ${character.location === 'willowbrook' ? 'success' : 'danger'}">${character.location === 'willowbrook' ? 'Construction available' : 'Travel to Willowbrook'}</span></div>
      <div class="building-grid">${Object.entries(DATA.buildings).map(([id, building]) => {
        const state = character.buildings[id];
        const cost = state.level < building.maxLevel ? this.engine.getBuildingCost(id) : null;
        return `<article class="card card-pad"><div class="card-header"><div class="cluster"><span class="card-icon">${building.icon}</span><div><h3 class="card-title">${escapeHtml(building.name)}</h3><p class="card-subtitle">Level ${state.level}/${building.maxLevel}</p></div></div></div><p class="card-subtitle">${escapeHtml(building.description)}</p>${cost ? `<div class="resource-list">${Object.entries(cost).map(([itemId, qty]) => `<div class="resource-row"><span>${itemId === 'coins' ? '🪙 Coins' : `${DATA.items[itemId]?.icon || '•'} ${escapeHtml(DATA.items[itemId]?.name || itemId)}`}</span><strong>${formatNumber(qty)} / ${formatNumber(itemId === 'coins' ? character.coins : this.engine.totalOwned(itemId))}</strong></div>`).join('')}</div><button class="button primary" data-action="build-building" data-id="${id}" ${character.location !== 'willowbrook' ? 'disabled' : ''}>Build level ${state.level + 1}</button>` : '<span class="pill success">Maximum level</span>'}</article>`;
      }).join('')}</div>`;
  }

  renderProjects() {
    const character = this.engine.character;
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Settlement projects</h2><p class="page-description">Large public works permanently change travel, production, combat safety, and trade across the world.</p></div></div>
      <div class="building-grid">${Object.entries(DATA.settlementProjects).map(([id, project]) => {
        const state = character.projects[id];
        const currentRegion = character.location === project.region;
        const totalRequired = Object.values(project.requirements).reduce((sum, qty) => sum + Math.max(0, qty), 0);
        const totalGiven = Object.entries(project.requirements).reduce((sum, [resourceId]) => sum + (resourceId === 'coins' ? state.coins || 0 : state.contributions[resourceId] || 0), 0);
        return `<article class="card card-pad ${state.complete ? 'active' : ''}"><div class="card-header"><div class="cluster"><span class="card-icon">${project.icon}</span><div><h3 class="card-title">${escapeHtml(project.name)}</h3><p class="card-subtitle">${escapeHtml(DATA.regions[project.region].name)}</p></div></div>${state.complete ? '<span class="pill success">Complete</span>' : ''}</div><p class="card-subtitle">${escapeHtml(project.description)}</p><div class="progress-track" style="margin:10px 0"><div class="progress-fill" style="width:${clampedPercent(totalGiven, totalRequired)}%"></div></div>${Object.entries(project.requirements).filter(([, qty]) => qty > 0).map(([resourceId, qty]) => { const given = resourceId === 'coins' ? state.coins || 0 : state.contributions[resourceId] || 0; return `<div class="project-resource"><span>${resourceId === 'coins' ? '🪙 Coins' : `${DATA.items[resourceId]?.icon || '•'} ${escapeHtml(DATA.items[resourceId]?.name || resourceId)}`} · ${formatNumber(given)}/${formatNumber(qty)}</span>${!state.complete ? `<button class="button small" data-action="contribute-project" data-id="${id}" data-resource="${resourceId}" ${!currentRegion ? 'disabled' : ''}>Contribute</button>` : ''}</div>`; }).join('')}${!currentRegion && !state.complete ? `<p class="danger-text">Travel to ${escapeHtml(DATA.regions[project.region].name)} to contribute.</p>` : ''}</article>`;
      }).join('')}</div>`;
  }

  renderCompanions() {
    const character = this.engine.character;
    const activeByCompanion = new Map(character.companions.activeExpeditions.map((entry) => [entry.companionId, entry]));
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Companions and expeditions</h2><p class="page-description">Recruit specialists, build loyalty, and send them on independent expeditions that return while you train elsewhere.</p></div><span class="pill gold">Leadership ${this.engine.getSkillLevel('leadership')}</span></div>
      <div class="building-grid">${Object.entries(DATA.companions).map(([id, companion]) => {
        const owned = character.companions.owned[id];
        const active = activeByCompanion.get(id);
        return `<article class="card card-pad ${owned ? 'active' : ''}"><div class="card-header"><div class="cluster"><span class="card-icon">${companion.icon}</span><div><h3 class="card-title">${escapeHtml(companion.name)}</h3><p class="card-subtitle">${escapeHtml(companion.role)} · ${escapeHtml(DATA.regions[companion.region].name)}</p></div></div>${owned ? `<span class="pill gold">Lvl ${owned.level}</span>` : ''}</div><p class="card-subtitle">${escapeHtml(companion.description)}</p>${owned ? `<div class="resource-list"><div class="resource-row"><span>Loyalty</span><strong>${owned.loyalty}</strong></div><div class="resource-row"><span>Status</span><strong>${active ? `${DATA.expeditions[active.expeditionId]?.name} · ${formatDuration(active.endsAt - Date.now(), true)}` : 'Available'}</strong></div></div>${active ? '<button class="button" disabled>On expedition</button>' : `<button class="button primary" data-action="start-expedition" data-companion="${id}">Choose expedition</button>`}` : `<div class="resource-list"><div class="resource-row"><span>Recruitment</span><strong>${formatNumber(companion.cost)} coins</strong></div></div><button class="button primary" data-action="recruit-companion" data-id="${id}" ${character.location !== companion.region ? 'disabled' : ''}>${character.location === companion.region ? 'Recruit' : `Meet in ${DATA.regions[companion.region].name}`}</button>`}</article>`;
      }).join('')}</div>`;
  }

  renderResearch() {
    const character = this.engine.character;
    const active = character.research.active;
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Library research</h2><p class="page-description">Long-running studies unlock permanent mechanics and global modifiers.</p></div><span class="pill ${(character.buildings.library?.level || 0) ? 'success' : 'danger'}">Library ${character.buildings.library?.level || 0}</span></div>
      ${active ? `<article class="card card-pad active" style="margin-bottom:12px"><h3 class="card-title">${DATA.research[active.researchId].icon} ${escapeHtml(DATA.research[active.researchId].name)}</h3><p class="card-subtitle">Completes in <span data-countdown="${active.endsAt}">${formatDuration(active.endsAt - Date.now(), true)}</span></p><div class="progress-track"><div class="progress-fill" style="width:${clampedPercent(Date.now() - active.startedAt, active.endsAt - active.startedAt)}%"></div></div></article>` : ''}
      <div class="building-grid">${Object.entries(DATA.research).map(([id, research]) => {
        const complete = character.research.completed.includes(id);
        const disabled = complete || Boolean(active) || (character.buildings.library?.level || 0) < 1;
        return `<article class="card card-pad ${complete ? 'active' : ''}"><div class="card-header"><div class="cluster"><span class="card-icon">${research.icon}</span><div><h3 class="card-title">${escapeHtml(research.name)}</h3><p class="card-subtitle">${formatDuration(research.durationMs, true)}</p></div></div>${complete ? '<span class="pill success">Complete</span>' : ''}</div><p class="card-subtitle">${escapeHtml(research.description)}</p><div class="resource-list">${Object.entries(research.cost).map(([itemId, qty]) => `<div class="resource-row"><span>${itemId === 'coins' ? 'Coins' : escapeHtml(DATA.items[itemId]?.name || itemId)}</span><strong>${formatNumber(qty)}/${formatNumber(itemId === 'coins' ? character.coins : this.engine.totalOwned(itemId))}</strong></div>`).join('')}</div>${!complete ? `<button class="button primary" data-action="start-research" data-id="${id}" ${disabled ? 'disabled' : ''}>Begin research</button>` : ''}</article>`;
      }).join('')}</div>`;
  }

  renderTrade() {
    const character = this.engine.character;
    this.engine.ensureTradeContracts();
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Contracts and caravan routes</h2><p class="page-description">Regional prices vary by location, weather, world events, reputation, and Mercantile level.</p></div><button class="button primary" data-action="new-trade-route">Create route</button></div>
      <div class="two-column">
        <div class="stack"><article class="card card-pad"><h3 class="card-title">Daily contracts</h3><div class="quest-list" style="margin-top:10px">${character.trade.contracts.map((contract) => `<div class="context-item"><div class="split"><div><strong>${DATA.items[contract.itemId].icon} ${contract.qty}× ${escapeHtml(DATA.items[contract.itemId].name)}</strong><small>Deliver to ${escapeHtml(DATA.regions[contract.region].name)} · ${formatNumber(contract.reward)} coins</small></div><button class="button small ${contract.status === 'open' ? 'primary' : ''}" data-action="fulfill-contract" data-id="${contract.id}" ${contract.status !== 'open' || character.location !== contract.region || this.engine.totalOwned(contract.itemId) < contract.qty ? 'disabled' : ''}>${contract.status === 'fulfilled' ? 'Fulfilled' : 'Deliver'}</button></div></div>`).join('')}</div></article></div>
        <aside class="stack"><article class="card card-pad"><h3 class="card-title">Active routes</h3><div class="context-list" style="margin-top:10px">${character.trade.activeRoutes.map((route) => `<div class="context-item"><strong>📦 ${escapeHtml(DATA.regions[route.from].name)} → ${escapeHtml(DATA.regions[route.to].name)}</strong><small>${route.qty}× ${escapeHtml(DATA.items[route.itemId].name)} · ${formatNumber(route.payout)} expected</small><small data-countdown="${route.endsAt}"></small></div>`).join('') || '<div class="context-item"><small>No caravans are currently traveling.</small></div>'}</div></article><article class="card card-pad"><h3 class="card-title">Regional prices</h3><p class="card-subtitle">Selling here favors local scarcity. Use the Market tab to inspect exact prices.</p><div class="resource-list"><div class="resource-row"><span>Contracts fulfilled</span><strong>${character.trade.fulfilled}</strong></div><div class="resource-row"><span>Mercantile level</span><strong>${this.engine.getSkillLevel('mercantile')}</strong></div></div></article></aside>
      </div>`;
  }

  renderSailing() {
    const character = this.engine.character;
    const ship = character.sailing.ship;
    const active = character.sailing.activeVoyage;
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">Ships and voyages</h2><p class="page-description">Build a vessel, recruit specialists, chart islands, and send long voyages that resolve independently.</p></div><span class="pill gold">Sailing ${this.engine.getSkillLevel('sailing')}</span></div>
      ${ship ? `<article class="card card-pad active" style="margin-bottom:12px"><div class="card-header"><div><h3 class="card-title">⛵ ${escapeHtml(ship.name)}</h3><p class="card-subtitle">Level ${ship.level} · Condition ${ship.condition}% · ${ship.cargoSlots} cargo slots</p></div><span class="pill ${active ? 'gold' : 'success'}">${active ? 'At sea' : 'In port'}</span></div>${active ? `<div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:${clampedPercent(Date.now() - active.startedAt, active.endsAt - active.startedAt)}%"></div></div><p class="card-subtitle">${escapeHtml(DATA.voyages[active.voyageId].name)} · <span data-countdown="${active.endsAt}"></span></p>` : ''}</article>` : `<article class="card card-pad"><h3 class="card-title">No ship owned</h3><p class="card-subtitle">Construction requires 3,500 coins, 12 Ship Timber, 6 Ship Fittings, and 5 Sailcloth. Build at Waveport or Harbor Dock.</p><button class="button primary" data-action="build-ship" ${!['waveport', 'harbor_dock'].includes(character.location) ? 'disabled' : ''}>Build ship</button></article>`}
      ${ship ? `<div class="building-grid">${Object.entries(DATA.voyages).map(([id, voyage]) => `<article class="card card-pad"><div class="card-header"><span class="card-icon">${voyage.icon}</span><div><h3 class="card-title">${escapeHtml(voyage.name)}</h3><p class="card-subtitle">Sailing ${voyage.sailingLevel} · Danger ${voyage.danger} · ${formatDuration(voyage.durationMs, true)}</p></div></div><div class="resource-list"><div class="resource-row"><span>Potential finds</span><strong>${escapeHtml(voyage.rewards.map((reward) => DATA.items[reward.item]?.name).join(', '))}</strong></div></div><button class="button primary" data-action="start-voyage" data-id="${id}" ${active || !['waveport', 'harbor_dock'].includes(character.location) || this.engine.getSkillLevel('sailing') < voyage.sailingLevel ? 'disabled' : ''}>Set sail</button></article>`).join('')}</div>` : ''}`;
  }

  renderMarket() {
    const character = this.engine.character;
    const stock = this.engine.getMarketStock();
    const stacks = Object.entries(character.inventory.stacks).filter(([id, qty]) => qty > 0 && DATA.items[id]?.value > 0 && !DATA.items[id]?.currency);
    return `<div class="card-header" style="margin-bottom:12px"><div><h2 class="page-title" style="font-size:1.45rem">${escapeHtml(DATA.regions[character.location].name)} market</h2><p class="page-description">Buy and sell prices respond to regional supply, current events, weather, and Mercantile progression.</p></div><span class="pill gold">${formatNumber(character.coins)} coins</span></div>
      ${stock.length ? `<div class="two-column"><article class="card card-pad"><h3 class="card-title">For sale</h3><div class="item-grid" style="margin-top:10px">${stock.map((id) => { const item = DATA.items[id]; return `<div class="card item-card"><div class="item-icon">${item.icon}</div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-quality gold">${formatNumber(this.engine.getBuyPrice(id))} coins</div><div class="item-actions"><button class="button small primary" data-action="buy-item" data-id="${id}">Buy</button></div></div>`; }).join('')}</div></article><article class="card card-pad"><h3 class="card-title">Sell from inventory</h3><div class="item-grid" style="margin-top:10px">${stacks.map(([id, qty]) => { const item = DATA.items[id]; return `<div class="card item-card"><span class="item-qty">${formatNumber(qty)}</span><div class="item-icon">${item.icon}</div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-quality gold">${formatNumber(this.engine.getSellPrice(id))} each</div><div class="item-actions"><button class="button small" data-action="sell-stack-one" data-id="${id}">Sell 1</button><button class="button small" data-action="sell-stack-all" data-id="${id}">Sell all</button></div></div>`; }).join('') || '<div class="empty-state">No sellable stacks in your inventory.</div>'}</div></article></div>` : '<div class="empty-state">There is no public market at this location.</div>'}`;
  }

  renderBank() {
    const character = this.engine.character;
    const tabs = [['inventory', '🎒 Inventory'], ['bank', '🏦 Bank'], ['equipment', '🛡️ Equipment'], ['loadouts', '📋 Loadouts']];
    const selected = tabs.some(([id]) => id === this.state.bankTab) ? this.state.bankTab : 'inventory';
    const header = `${pageHeader('🏦', 'Inventory, Bank & Equipment', 'Carry supplies for the road, keep long-term resources in the bank, compare equipment, and save complete loadouts.', `
      <button class="button" data-action="deposit-all">Deposit all stacks</button>
      <button class="button" data-action="save-loadout">Save loadout</button>`)}
      <div class="category-tabs">${tabs.map(([id, label]) => `<button class="button ${selected === id ? 'primary' : ''}" data-action="bank-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
    if (selected === 'equipment') return `${header}${this.renderEquipmentPanel()}`;
    if (selected === 'loadouts') return `${header}${this.renderLoadoutsPanel()}`;

    const container = selected === 'inventory' ? character.inventory : character.bank;
    const capacity = selected === 'inventory' ? this.engine.getInventoryCapacity() : this.engine.getBankCapacity();
    const used = this.engine.getContainerSlots(container);
    const query = this.state.bankSearch.trim().toLowerCase();
    const filter = this.state.bankFilter;
    const itemMatches = (item) => {
      if (query && !`${item.name} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query)) return false;
      if (filter !== 'all' && !(item.tags || []).includes(filter) && item.rarity !== filter) return false;
      return true;
    };
    const stacks = Object.entries(container.stacks).filter(([id, qty]) => qty > 0 && DATA.items[id] && itemMatches(DATA.items[id])).sort((a, b) => DATA.items[a[0]].name.localeCompare(DATA.items[b[0]].name));
    const instances = container.instances.filter((entry) => DATA.items[entry.itemId] && itemMatches(DATA.items[entry.itemId])).sort((a, b) => DATA.items[a.itemId].name.localeCompare(DATA.items[b.itemId].name));
    const filters = ['all', 'food', 'ore', 'wood', 'bar', 'potion', 'weapon', 'armor', 'tool', 'artifact', 'rare', 'epic', 'legendary'];
    return `${header}
      <div class="inventory-toolbar">
        <input class="input" data-bank-search type="search" value="${escapeHtml(this.state.bankSearch)}" placeholder="Search items" aria-label="Search items">
        <select class="select" data-bank-filter aria-label="Filter items">${filters.map((id) => `<option value="${id}" ${filter === id ? 'selected' : ''}>${titleCase(id)}</option>`).join('')}</select>
        <span class="pill ${used >= capacity ? 'danger' : 'gold'}">${used}/${capacity} slots</span>
        ${selected === 'inventory' ? '<button class="button" data-action="deposit-all">Deposit all</button>' : ''}
      </div>
      <div class="item-grid">
        ${stacks.map(([id, qty]) => this.stackItemCard(id, qty, selected)).join('')}
        ${instances.map((instance) => this.instanceItemCard(instance, selected)).join('')}
        ${!stacks.length && !instances.length ? '<div class="empty-state">No matching items in this container.</div>' : ''}
      </div>`;
  }

  stackItemCard(itemId, qty, location) {
    const item = DATA.items[itemId];
    const canUse = Boolean(item.heal || item.buff || item.cleanse);
    const marketHere = DATA.regions[this.engine.character.location]?.services?.includes('market');
    return `<article class="card item-card rarity-${escapeHtml(item.rarity || 'common')}">
      <span class="item-qty">${formatNumber(qty)}</span>
      <div class="item-icon">${item.icon}</div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-quality">${escapeHtml((item.tags || []).slice(0, 2).map(titleCase).join(' · ') || titleCase(item.rarity))}</div>
      <div class="item-actions">
        ${location === 'inventory' ? `<button class="button small" data-action="deposit-stack" data-id="${itemId}">Deposit</button>${canUse ? `<button class="button small primary" data-action="use-item" data-id="${itemId}">Use</button>` : ''}${marketHere && item.value > 0 && !item.currency ? `<button class="button small" data-action="sell-stack-one" data-id="${itemId}">Sell</button>` : ''}` : `<button class="button small primary" data-action="withdraw-stack" data-id="${itemId}">Withdraw</button>`}
        <button class="button small" data-action="inspect-stack" data-id="${itemId}" data-location="${location}">Details</button>
      </div>
    </article>`;
  }

  instanceItemCard(instance, location) {
    const item = DATA.items[instance.itemId];
    const equipped = this.engine.isEquipped(instance.uid);
    const quality = instance.quality || 'standard';
    return `<article class="card item-card rarity-${escapeHtml(item.rarity || 'common')}">
      ${equipped ? '<span class="pill success" style="position:absolute;left:7px;top:7px">Equipped</span>' : ''}
      ${instance.locked ? '<span class="item-qty" title="Locked">🔒</span>' : ''}
      <div class="item-icon">${item.icon}</div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-quality quality-${escapeHtml(quality)}">${escapeHtml(titleCase(quality))} · ${Math.round(instance.durability ?? 100)}%</div>
      <div class="item-actions">
        ${location === 'inventory' ? `${item.equipSlot ? `<button class="button small primary" data-action="equip-instance" data-uid="${instance.uid}">Equip</button>` : ''}${!equipped ? `<button class="button small" data-action="deposit-instance" data-uid="${instance.uid}">Deposit</button>` : ''}` : `<button class="button small primary" data-action="withdraw-instance" data-uid="${instance.uid}">Withdraw</button>`}
        <button class="button small" data-action="inspect-instance" data-uid="${instance.uid}">Details</button>
      </div>
    </article>`;
  }

  renderEquipmentPanel() {
    const character = this.engine.character;
    const stats = this.engine.getEquipmentStats();
    return `<div class="two-column">
      <div class="stack">
        <article class="card card-pad">
          <div class="card-header"><div><h2 class="card-title">Equipped gear</h2><p class="card-subtitle">Quality, affixes, durability, combat style, tools, relics, ammunition, and familiars all contribute to your build.</p></div></div>
          <div class="equipment-grid" style="margin-top:12px">${EQUIPMENT_SLOTS.map((slot) => {
            if (slot === 'familiar') {
              const familiar = character.equipment.familiar;
              return `<div class="equipment-slot"><small>${titleCase(slot)}</small><div class="item-icon">${familiar === 'forager_wisp' ? '✨' : familiar === 'emberling' ? '🔥' : '◇'}</div><strong>${familiar ? titleCase(familiar) : 'Empty'}</strong>${familiar ? `<button class="button tiny" data-action="unequip-slot" data-slot="familiar">Remove</button>` : ''}</div>`;
            }
            const uid = character.equipment[slot];
            const found = uid ? this.engine.findInstance(uid) : null;
            const item = found ? DATA.items[found.instance.itemId] : null;
            return `<div class="equipment-slot"><small>${titleCase(slot)}</small><div class="item-icon">${item?.icon || '◇'}</div><strong>${escapeHtml(item?.name || 'Empty')}</strong>${item ? `<span class="item-quality quality-${found.instance.quality}">${titleCase(found.instance.quality)}</span><button class="button tiny" data-action="unequip-slot" data-slot="${slot}">Unequip</button>` : ''}</div>`;
          }).join('')}</div>
        </article>
        <article class="card card-pad"><h2 class="card-title">Available gear</h2><div class="item-grid" style="margin-top:10px">${character.inventory.instances.filter((entry) => DATA.items[entry.itemId]?.equipSlot && !this.engine.isEquipped(entry.uid)).map((entry) => this.instanceItemCard(entry, 'inventory')).join('') || '<div class="empty-state">No unequipped gear is in your inventory.</div>'}</div></article>
      </div>
      <aside class="stack">
        <article class="card card-pad"><h2 class="card-title">Equipment bonuses</h2><div class="resource-list">${Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([key, value]) => `<div class="resource-row"><span>${escapeHtml(titleCase(key))}</span><strong>${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}</strong></div>`).join('') || '<p class="muted">No equipment bonuses.</p>'}</div></article>
        <article class="card card-pad"><h2 class="card-title">Derived combat</h2>${this.combatStatGrid(this.engine.getCombatStats())}</article>
      </aside>
    </div>`;
  }

  renderLoadoutsPanel() {
    const character = this.engine.character;
    const atBank = DATA.regions[character.location]?.services?.includes('bank');
    return `<div class="two-column"><article class="card card-pad"><div class="card-header"><div><h2 class="card-title">Saved loadouts</h2><p class="card-subtitle">Presets remember every equipment slot and combat style. Applying one requires a bank service.</p></div><button class="button primary" data-action="save-loadout">Save current</button></div><div class="quest-list" style="margin-top:12px">${character.loadouts.map((loadout) => `<div class="context-item"><div class="split"><div><strong>📋 ${escapeHtml(loadout.name)}</strong><small>${titleCase(loadout.style)} · ${Object.values(loadout.equipment).filter(Boolean).length} slots</small></div><button class="button small primary" data-action="apply-loadout" data-id="${loadout.id}" ${!atBank ? 'disabled' : ''}>Apply</button></div></div>`).join('') || '<div class="empty-state">No loadouts saved.</div>'}</div></article><aside class="card card-pad"><h2 class="card-title">Loadout rules</h2><p class="card-subtitle">Items remain individual persistent instances. If an item was sold or salvaged, that slot is skipped when the preset is applied.</p><p class="card-subtitle">Current location: <strong>${escapeHtml(DATA.regions[character.location].name)}</strong>${atBank ? ' · bank service available' : ' · travel to a bank to change full presets'}</p></aside></div>`;
  }

  renderCharacter() {
    const character = this.engine.character;
    const background = DATA.backgrounds[character.background];
    const difficulty = DATA.difficulties[character.difficulty];
    const combat = this.engine.getCombatStats();
    const skillEntries = Object.entries(DATA.skills).sort((a, b) => this.engine.getSkillLevel(b[0]) - this.engine.getSkillLevel(a[0]));
    const reputationEntries = Object.entries(DATA.factions).filter(([id, faction]) => !faction.hidden || (character.reputations[id] || 0) !== 0);
    return `${pageHeader('🧑‍⚔️', character.name, `${character.title} · ${background?.name || titleCase(character.background)} · ${difficulty?.name || titleCase(character.difficulty)}`, `<button class="button" data-action="rename-active-character">Rename</button><button class="button" data-action="export-active-character">Export</button><button class="button" data-action="open-character-gate">Switch character</button>`)}
      <section class="card card-pad character-hero">
        <div class="character-portrait">${escapeHtml(character.portrait || '🧑‍⚔️')}</div>
        <div><p class="eyebrow">Chronicle ${character.legacy.chronicles + 1}</p><h2 class="page-title" style="font-size:1.8rem">${escapeHtml(character.name)}</h2><p class="card-subtitle">${escapeHtml(background?.description || '')}</p><div class="action-meta"><span class="pill gold">Total level ${formatNumber(this.engine.getTotalLevel())}</span><span class="pill">Combat ${this.engine.getCharacterLevel()}</span><span class="pill">${escapeHtml(DATA.regions[character.location].name)}</span>${character.modded ? '<span class="pill danger">Modded</span>' : ''}${character.flags.deceased ? '<span class="pill danger">Chronicle ended</span>' : ''}</div></div>
        <div class="character-actions"><button class="button primary" data-view="skills">Train skills</button><button class="button" data-view="combat">Combat</button><button class="button" data-action="rest-character">Rest</button></div>
      </section>
      <div class="resource-bars">
        ${resourceBar('Health', character.currentHp, combat.maxHp, 'hp')}
        ${resourceBar('Stamina', character.stamina, combat.staminaMax, 'stamina')}
        ${resourceBar('Mana', character.mana, combat.manaMax, 'mana')}
      </div>
      <div class="two-column" style="margin-top:14px">
        <div class="stack">
          <article class="card card-pad"><div class="card-header"><h2 class="card-title">Skill profile</h2><button class="button small" data-view="skills">All skills</button></div><div class="skill-overview-grid" style="margin-top:10px">${skillEntries.slice(0, 12).map(([id, skill]) => { const progress = levelProgress(character.xp[id] || 0); return `<button class="card skill-overview-card" data-action="select-skill" data-skill="${id}"><span class="skill-head"><span class="skill-icon">${skill.icon}</span><span class="skill-name">${escapeHtml(skill.name)}</span><span class="skill-level">${progress.level}</span></span><span class="progress-track"><span class="progress-fill" style="width:${progress.percent}%"></span></span></button>`; }).join('')}</div></article>
          <article class="card card-pad"><h2 class="card-title">Lifetime record</h2><div class="stat-grid" style="margin-top:10px">${statTile('Actions', formatNumber(character.stats.actionsCompleted), '⚒️')}${statTile('Kills', formatNumber(character.stats.kills), '☠️')}${statTile('Crafted', formatNumber(character.stats.crafted), '🔨')}${statTile('Gathered', formatNumber(character.stats.gathered), '🪵')}${statTile('Distance', formatNumber(character.stats.distanceTraveled), '🥾')}${statTile('Play time', formatDuration(character.stats.playTimeMs), '⌛')}</div></article>
        </div>
        <aside class="stack">
          <article class="card card-pad"><h2 class="card-title">Faction standing</h2><div class="quest-list" style="margin-top:10px">${reputationEntries.map(([id, faction]) => { const value = character.reputations[id] || 0; const rank = reputationLabel(value); return `<div class="context-item"><div class="split"><div><strong>${faction.icon || '⚑'} ${escapeHtml(faction.name)}</strong><small>${escapeHtml(faction.description)}</small></div><span class="pill ${value < 0 ? 'danger' : value >= 500 ? 'success' : 'gold'}">${rank} · ${formatNumber(value)}</span></div><div class="progress-track" style="margin-top:7px"><div class="progress-fill" style="width:${clampedPercent(value + 1000, 3000)}%"></div></div></div>`; }).join('')}</div></article>
          <article class="card card-pad"><h2 class="card-title">Legacy</h2><div class="resource-list"><div class="resource-row"><span>Chronicles completed</span><strong>${character.legacy.chronicles}</strong></div><div class="resource-row"><span>Legacy points</span><strong>${character.legacy.points}</strong></div><div class="resource-row"><span>Inherited titles</span><strong>${character.legacy.inheritedTitles.length}</strong></div></div><button class="button primary" data-action="begin-chronicle" ${!this.engine.canStartChronicle() ? 'disabled' : ''}>Begin a new Chronicle</button><p class="fine-print">Unlock by completing The Ember Crown or reaching total level 1,800.</p></article>
        </aside>
      </div>`;
  }

  renderCollections() {
    const character = this.engine.character;
    const tabs = [['achievements', '🏆 Achievements'], ['items', '🎒 Items'], ['monsters', '☠️ Bestiary'], ['artifacts', '🏺 Museum'], ['discoveries', '🗺️ Discoveries'], ['lore', '📚 Lore'], ['familiars', '✨ Familiars'], ['records', '📊 Records']];
    const tab = tabs.some(([id]) => id === this.state.collectionTab) ? this.state.collectionTab : 'achievements';
    let content = '';
    if (tab === 'achievements') {
      content = `<div class="collection-grid">${Object.entries(DATA.achievements).map(([id, achievement]) => { const unlocked = character.collections.achievements.includes(id); return `<article class="card collection-entry ${unlocked ? 'active' : 'unknown'}"><div class="collection-icon">${achievement.icon}</div><h3 class="card-title">${escapeHtml(achievement.name)}</h3><p class="card-subtitle">${escapeHtml(achievement.description)}</p><span class="pill ${unlocked ? 'success' : ''}">${unlocked ? 'Unlocked' : 'Locked'}</span></article>`; }).join('')}</div>`;
    } else if (tab === 'items') {
      content = this.collectionGrid(Object.entries(DATA.items), (id) => character.collections.items.includes(id), ([, item]) => item.icon, ([, item]) => item.name, ([, item]) => `${titleCase(item.rarity)} · ${(item.tags || []).map(titleCase).join(', ')}`);
    } else if (tab === 'monsters') {
      content = this.collectionGrid(Object.entries(DATA.enemies), (id) => (character.collections.monsters[id] || 0) > 0, ([, enemy]) => enemy.icon, ([, enemy]) => enemy.name, ([id, enemy]) => `${character.collections.monsters[id] || 0} defeated · ${DATA.regions[enemy.region].name}`);
    } else if (tab === 'artifacts') {
      const entries = Object.entries(DATA.items).filter(([, item]) => item.tags?.includes('artifact'));
      content = this.collectionGrid(entries, (id) => character.collections.artifacts.includes(id) || character.collections.items.includes(id), ([, item]) => item.icon, ([, item]) => item.name, ([, item]) => `${titleCase(item.rarity)} museum piece`);
    } else if (tab === 'discoveries') {
      content = this.collectionGrid(Object.entries(DATA.regions), (id) => character.discoveredRegions.includes(id), ([, region]) => region.icon, ([, region]) => region.name, ([, region]) => `${DATA.factions[region.faction]?.name || 'Unclaimed'} · danger ${region.danger}`);
    } else if (tab === 'lore') {
      const lore = ['heartglass_origin', 'deepforge_seal', 'green_water_rite', 'watchpost_roll', 'ember_covenant', 'free_captain_charter', 'lake_memory', 'wilds_root'];
      content = this.collectionGrid(lore.map((id) => [id, { name: titleCase(id), icon: '📖' }]), (id) => character.collections.lore.includes(id), ([, entry]) => entry.icon, ([, entry]) => entry.name, () => 'A recovered page from Eldoria’s history.');
    } else if (tab === 'familiars') {
      const familiarDefs = { forager_wisp: { name: 'Forager Wisp', icon: '✨', description: 'Improves Foraging speed and rare finds.' }, emberling: { name: 'Emberling', icon: '🔥', description: 'Improves fire damage and resistance.' } };
      content = this.collectionGrid(Object.entries(familiarDefs), (id) => character.collections.familiars.includes(id), ([, entry]) => entry.icon, ([, entry]) => entry.name, ([, entry]) => entry.description, true);
    } else {
      content = `<div class="stat-grid">${Object.entries(character.stats).filter(([, value]) => typeof value === 'number').map(([key, value]) => statTile(titleCase(key), key.endsWith('Ms') ? formatDuration(value) : formatNumber(value))).join('')}</div><article class="card card-pad" style="margin-top:14px"><h2 class="card-title">Most completed actions</h2><div class="resource-list">${Object.entries(character.stats.actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, value]) => `<div class="resource-row"><span>${escapeHtml(DATA.actions[id]?.name || id)}</span><strong>${formatNumber(value)}</strong></div>`).join('') || '<p class="muted">No action records yet.</p>'}</div></article>`;
    }
    return `${pageHeader('🏺', 'Collections & Records', 'Track achievements, items, enemies, artifacts, world discoveries, lore, familiars, and lifetime statistics.', '')}<div class="category-tabs">${tabs.map(([id, label]) => `<button class="button ${tab === id ? 'primary' : ''}" data-action="collection-tab" data-tab="${id}">${label}</button>`).join('')}</div>${content}`;
  }

  collectionGrid(entries, knownFn, iconFn, nameFn, descriptionFn, allowEquip = false) {
    return `<div class="collection-grid">${entries.map((entry) => { const [id] = entry; const known = knownFn(id); return `<article class="card collection-entry ${known ? '' : 'unknown'}"><div class="collection-icon">${known ? iconFn(entry) : '？'}</div><h3 class="card-title">${escapeHtml(known ? nameFn(entry) : 'Unknown')}</h3><p class="card-subtitle">${escapeHtml(known ? descriptionFn(entry) : 'Discover this entry in Eldoria.')}</p>${known && allowEquip ? `<button class="button small ${this.engine.character.equipment.familiar === id ? 'success' : ''}" data-action="equip-familiar" data-id="${id}">${this.engine.character.equipment.familiar === id ? 'Active' : 'Summon'}</button>` : ''}</article>`; }).join('')}</div>`;
  }

  renderSettings() {
    const settings = this.engine.account.settings;
    return `${pageHeader('⚙️', 'Settings, Saves & Integration', 'Configure accessibility, offline behavior, notifications, backups, PWA installation, mods, and future cloud synchronization.', `<button class="button primary" data-action="manual-save">Save now</button>`)}
      <div class="settings-grid">
        <section class="card card-pad"><h2 class="card-title">Gameplay & accessibility</h2>
          ${settingToggle('reducedMotion', 'Reduce motion', 'Disable nonessential animation and rapid transitions.', settings.reducedMotion)}
          ${settingToggle('highContrast', 'High contrast', 'Increase line, label, and muted-text contrast.', settings.highContrast)}
          ${settingToggle('compactCards', 'Compact action cards', 'Use denser lists on large screens.', settings.compactCards)}
          ${settingToggle('offlineProgress', 'Offline progress', 'Process timestamp-based progress when the app resumes.', settings.offlineProgress)}
          ${settingToggle('sound', 'Sound effects', 'Enable interface and combat sounds when audio is added.', settings.sound)}
          <label class="setting-row"><span><strong>Text size</strong><small>Scale all game text without browser zoom restrictions.</small></span><select class="select" data-setting="textScale"><option value="0.9" ${settings.textScale === .9 ? 'selected' : ''}>Small</option><option value="1" ${settings.textScale === 1 ? 'selected' : ''}>Standard</option><option value="1.15" ${settings.textScale >= 1.14 ? 'selected' : ''}>Large</option><option value="1.3" ${settings.textScale >= 1.29 ? 'selected' : ''}>Extra large</option></select></label>
          <label class="setting-row"><span><strong>Autosave interval</strong><small>IndexedDB remains the local source of truth.</small></span><select class="select" data-setting="autosaveSeconds">${[10,20,30,60].map((value) => `<option value="${value}" ${Number(settings.autosaveSeconds) === value ? 'selected' : ''}>${value} seconds</option>`).join('')}</select></label>
        </section>
        <section class="card card-pad"><h2 class="card-title">PWA & notifications</h2><p class="card-subtitle">Install the game from a secure web host for a home-screen icon, standalone window, cached assets, and offline launch.</p><div class="button-row"><button class="button primary" data-action="install-app">Install app</button><button class="button" data-action="request-notifications">Enable alerts</button><button class="button" data-action="check-update">Check for update</button></div><div class="resource-list" style="margin-top:12px"><div class="resource-row"><span>Display mode</span><strong>${matchMedia('(display-mode: standalone)').matches ? 'Installed / standalone' : 'Browser'}</strong></div><div class="resource-row"><span>Notification permission</span><strong>${'Notification' in globalThis ? Notification.permission : 'Unsupported'}</strong></div><div class="resource-row"><span>Service worker</span><strong>${navigator.serviceWorker?.controller ? 'Controlling this page' : 'Pending / unavailable'}</strong></div></div></section>
        <section class="card card-pad"><h2 class="card-title">Backups</h2><p class="card-subtitle">Local autosaves are convenient; exported JSON files are portable and independent of browser storage.</p><div class="button-row"><button class="button primary" data-action="export-active-character">Export character</button><button class="button" data-action="import-character-active">Import character</button><button class="button" data-action="export-account">Export account</button><button class="button" data-action="import-account">Import account</button></div><button class="button danger" style="margin-top:12px" data-action="clear-local-account">Erase local account</button></section>
        <section class="card card-pad"><h2 class="card-title">Supabase-ready cloud boundary</h2><p class="card-subtitle">The game uses an AccountRepository interface. IndexedDB is the default adapter; a Supabase adapter and SQL schema are included without coupling simulation or UI code to a backend.</p><div class="resource-list"><div class="resource-row"><span>Provider</span><strong>${escapeHtml(this.engine.account.sync.provider)}</strong></div><div class="resource-row"><span>Status</span><strong>${escapeHtml(this.engine.account.sync.status)}</strong></div><div class="resource-row"><span>Last sync</span><strong>${this.engine.account.sync.lastSyncedAt ? new Date(this.engine.account.sync.lastSyncedAt).toLocaleString() : 'Never'}</strong></div></div><p class="fine-print">To add cloud sync later, initialize a Supabase client after authentication and replace the repository in main.js with SupabaseAccountRepository or a local-first composite adapter.</p></section>
        <section class="card card-pad"><h2 class="card-title">Content packs</h2><p class="card-subtitle">Import data-only items, actions, enemies, quests, and world events. Modded Chronicles are marked so competitive systems can exclude them later.</p><div class="button-row"><button class="button" data-action="import-content-pack">Import content pack</button><button class="button" data-action="export-content-template">Export template</button></div><p class="fine-print">No arbitrary JavaScript is executed by content packs.</p></section>
        <section class="card card-pad"><h2 class="card-title">About</h2><div class="resource-list"><div class="resource-row"><span>Version</span><strong>${APP_VERSION}</strong></div><div class="resource-row"><span>Save schema</span><strong>${this.engine.character.schemaVersion}</strong></div><div class="resource-row"><span>Character revision</span><strong>${this.engine.character.revision}</strong></div><div class="resource-row"><span>Content</span><strong>${Object.keys(DATA.skills).length} skills · ${Object.keys(DATA.actions).length} actions · ${Object.keys(DATA.items).length} items</strong></div></div></section>
      </div>`;
  }

  async handleAction(action, target) {
    const engine = this.engine;
    const character = engine.character;
    const fromModal = Boolean(target.closest?.('#modal-card'));
    switch (action) {
      case 'close-modal': return this.closeModal();
      case 'open-character-gate': this.showCharacterGate(); return;
      case 'play-character': engine.selectSlot(Number(target.dataset.slot)); this.state.selectedRegion = engine.character.location; this.showGame(); this.persistence.markDirty('select-character', { urgent: true }); this.processResume(); return;
      case 'create-character': return this.openCreateCharacter(Number(target.dataset.slot));
      case 'delete-character': return this.confirm('Delete Chronicle', 'This permanently removes the local character from this browser. Export first if it should be recoverable.', () => { engine.deleteCharacter(Number(target.dataset.slot)); this.renderCharacterGate(); });
      case 'rename-character-slot': return this.promptText('Rename character', 'New character name', engine.account.slots[Number(target.dataset.slot)]?.name || '', (value) => { const slot = Number(target.dataset.slot); const old = engine.activeSlot; engine.selectSlot(slot); engine.renameCharacter(value); if (old !== null && engine.account.slots[old]) engine.selectSlot(old); else { engine.activeSlot = null; engine.account.activeSlot = null; } this.renderCharacterGate(); });
      case 'rename-active-character': return this.promptText('Rename character', 'New character name', character.name, (value) => engine.renameCharacter(value));
      case 'import-character': return this.pickFile(async (file) => this.importCharacter(await readFileText(file), Number(target.dataset.slot)));
      case 'import-character-active': return this.pickFile(async (file) => this.importCharacter(await readFileText(file), engine.activeSlot));
      case 'export-character-slot': return this.exportCharacter(Number(target.dataset.slot));
      case 'export-active-character': return this.exportCharacter(engine.activeSlot);
      case 'export-account': return this.exportAccount();
      case 'import-account': return this.pickFile(async (file) => this.importAccount(await readFileText(file)));
      case 'manual-save': this.persistence.markDirty('manual-save'); await this.persistence.flush('manual'); this.toast('Saved', 'Local account saved successfully.', 'success'); return;
      case 'open-inbox': return this.openInbox();
      case 'open-mobile-menu': return this.openMobileMenu();
      case 'install-app': return this.installApp();
      case 'open-activity': return this.openActivityPlanner();
      case 'stop-activity': engine.stopActivity(); if (fromModal) this.closeModal(); return;
      case 'active-interaction': engine.performActiveInteraction(); return;
      case 'start-skill-action': engine.startSkillAction(target.dataset.id); if (fromModal) this.closeModal(); return;
      case 'queue-skill-action': return this.openQueueDialog(target.dataset.id);
      case 'remove-queued': engine.removeQueuedActivity(target.dataset.id); return this.openActivityPlanner();
      case 'clear-queue': engine.clearActivityQueue(); return this.openActivityPlanner();
      case 'skill-overview': this.state.selectedSkill = null; this.renderView(); return;
      case 'select-skill': this.state.selectedSkill = target.dataset.skill; this.state.view = 'skills'; this.renderAll(); return;
      case 'skill-category': this.state.selectedSkill = null; this.state.skillCategory = target.dataset.category; this.renderView(); return;
      case 'select-region': this.state.selectedRegion = target.dataset.region; this.renderView(true); return;
      case 'select-and-open-region': this.state.selectedRegion = target.dataset.region; this.setView('map'); return;
      case 'travel-region': engine.startTravel(target.dataset.region); return;
      case 'waystone-region': engine.waystoneTravel(target.dataset.region); return;
      case 'open-region-content': return this.openRegionContent(target.dataset.region);
      case 'start-combat': engine.startCombat(target.dataset.id); return;
      case 'start-encounter': engine.startEncounter(target.dataset.id); return;
      case 'flee-combat': engine.fleeCombat(); return;
      case 'combat-ability': engine.useCombatAbility(target.dataset.id); return;
      case 'request-slayer': engine.requestSlayerAssignment(); return;
      case 'open-automation': return this.openAutomation();
      case 'open-loadouts': this.state.view = 'bank'; this.state.bankTab = 'loadouts'; this.renderAll(); return;
      case 'start-quest': engine.startQuest(target.dataset.id); return;
      case 'claim-quest': return this.claimQuest(target.dataset.id);
      case 'quest-tab': this.state.questTab = target.dataset.tab; this.renderView(true); return;
      case 'town-tab': this.state.view = 'town'; this.state.townTab = target.dataset.tab || 'farming'; this.renderAll(); return;
      case 'open-farming': this.setView('town', { townTab: 'farming' }); return;
      case 'plant-crop': return this.openPlantCrop(target.dataset.plot);
      case 'harvest-crop': engine.harvestCrop(target.dataset.plot); return;
      case 'build-building': engine.buildBuilding(target.dataset.id); return;
      case 'contribute-project': return this.openProjectContribution(target.dataset.id, target.dataset.resource);
      case 'recruit-companion': engine.recruitCompanion(target.dataset.id); return;
      case 'start-expedition': return this.openExpedition(target.dataset.companion || target.dataset.id);
      case 'start-research': engine.startResearch(target.dataset.id); return;
      case 'fulfill-contract': engine.fulfillContract(target.dataset.id); return;
      case 'new-trade-route': return this.openTradeRoute();
      case 'build-ship': engine.buildShip(); return;
      case 'start-voyage': engine.startVoyage(target.dataset.id); return;
      case 'buy-item': return this.openQuantityDialog('Buy item', target.dataset.id, 1, (qty) => engine.buyItem(target.dataset.id, qty));
      case 'sell-stack-one': engine.sellItem(target.dataset.id, 1); return;
      case 'sell-stack-all': engine.sellItem(target.dataset.id, engine.stackQty(target.dataset.id), 'inventory'); return;
      case 'bank-tab': this.state.bankTab = target.dataset.tab; this.renderView(); return;
      case 'deposit-stack': engine.depositStack(target.dataset.id); if (fromModal) this.closeModal(); return;
      case 'withdraw-stack': engine.withdrawStack(target.dataset.id); if (fromModal) this.closeModal(); return;
      case 'deposit-instance': engine.depositInstance(target.dataset.uid); if (fromModal) this.closeModal(); return;
      case 'withdraw-instance': engine.withdrawInstance(target.dataset.uid); if (fromModal) this.closeModal(); return;
      case 'deposit-all': engine.depositAll(); return;
      case 'equip-instance': engine.equipInstance(target.dataset.uid); if (fromModal) this.closeModal(); return;
      case 'unequip-slot': engine.unequipSlot(target.dataset.slot); return;
      case 'inspect-stack': return this.inspectStack(target.dataset.id, target.dataset.location);
      case 'inspect-instance': return this.inspectInstance(target.dataset.uid);
      case 'use-item': engine.useConsumable(target.dataset.id); if (fromModal) this.closeModal(); return;
      case 'toggle-lock-instance': engine.toggleItemLock(target.dataset.uid); return this.inspectInstance(target.dataset.uid);
      case 'salvage-instance': return this.confirm('Salvage item', 'Destroy this item and recover part of its materials?', () => engine.salvageInstance(target.dataset.uid));
      case 'sell-instance': engine.sellInstance(target.dataset.uid); this.closeModal(); return;
      case 'save-loadout': return this.promptText('Save loadout', 'Loadout name', `Loadout ${character.loadouts.length + 1}`, (value) => engine.saveLoadout(value));
      case 'apply-loadout': engine.applyLoadout(target.dataset.id); return;
      case 'equip-familiar': character.equipment.familiar = target.dataset.id; engine.touch('familiar-equipped', { familiar: target.dataset.id }, true); return;
      case 'collection-tab': this.state.collectionTab = target.dataset.tab; this.renderView(); return;
      case 'rest-character': character.currentHp = engine.getMaxHp(); character.stamina = engine.getCombatStats().staminaMax; character.mana = engine.getCombatStats().manaMax; engine.touch('rested', {}, true); return;
      case 'begin-chronicle': return this.confirm('Begin a new Chronicle', 'This starts the character again while preserving Legacy progress, inherited titles, and Chronicle count. Export first for a complete archival copy.', () => engine.beginNewChronicle());
      case 'show-latest-report': return this.openOfflineReport(character.offlineReports.at(-1));
      case 'request-notifications': return this.requestNotifications();
      case 'check-update': return this.checkForUpdate();
      case 'clear-local-account': return this.confirm('Erase local account', 'This deletes all three local character slots. Export the account first. This cannot be undone.', async () => { await this.persistence.repository.clearAccount(); location.reload(); });
      case 'import-content-pack': return this.pickFile(async (file) => this.importContentPack(await readFileText(file)));
      case 'export-content-template': return this.exportContentTemplate();
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  handleSettingChange(target) {
    const key = target.dataset.setting;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    if (['textScale', 'autosaveSeconds'].includes(key)) value = Number(value);
    this.engine.account.settings[key] = value;
    if (key === 'autosaveSeconds') this.persistence.setAutosaveSeconds(value);
    this.applySettings();
    this.persistence.markDirty(`setting-${key}`, { urgent: true });
    this.scheduleRender(true);
  }

  updateDynamic() {
    if (!this.engine.character || this.gameShell.hidden) return;
    const info = this.getActivityInfo();
    const mini = document.querySelector('#activity-progress-mini span');
    if (mini) mini.style.width = `${info.percent}%`;
    const dashboard = document.querySelector('[data-dashboard-activity-progress]');
    if (dashboard) dashboard.style.width = `${info.percent}%`;
    const context = document.querySelector('[data-context-activity-progress]');
    if (context) context.style.width = `${info.percent}%`;
    const activity = this.engine.character.activity;
    if (activity?.kind === 'skill') {
      const fill = document.querySelector(`[data-action-progress="${activity.actionId}"]`);
      if (fill) fill.style.width = `${info.percent}%`;
    }
    const stats = this.engine.getCombatStats();
    const hpFill = document.querySelector('[data-player-hp-fill]');
    const hpText = document.querySelector('[data-player-hp-text]');
    if (hpFill) hpFill.style.width = `${clampedPercent(this.engine.character.currentHp, stats.maxHp)}%`;
    if (hpText) hpText.textContent = `${Math.max(0, Math.floor(this.engine.character.currentHp))}/${stats.maxHp} HP`;
    if (activity?.kind === 'combat') {
      const enemy = DATA.enemies[activity.enemyId];
      const enemyFill = document.querySelector('[data-enemy-hp-fill]');
      const enemyText = document.querySelector('[data-enemy-hp-text]');
      if (enemyFill) enemyFill.style.width = `${clampedPercent(activity.enemyHp, enemy?.hp || 1)}%`;
      if (enemyText) enemyText.textContent = `${Math.max(0, Math.floor(activity.enemyHp))}/${enemy?.hp || 0} HP`;
    }
    this.updateCountdowns();
    this.renderHeader();
  }

  updateCountdowns() {
    document.querySelectorAll('[data-countdown]').forEach((node) => {
      const end = Number(node.dataset.countdown);
      node.textContent = end > Date.now() ? formatDuration(end - Date.now(), true) : 'Complete';
    });
  }

  getActivityInfo() {
    const character = this.engine.character;
    const activity = character?.activity;
    if (!activity) return { icon: '💤', label: 'Idle', detail: `Resting in ${DATA.regions[character.location]?.name || 'Eldoria'}`, percent: 0 };
    if (activity.kind === 'skill') {
      const action = DATA.actions[activity.actionId];
      const duration = this.engine.getActionDuration(action);
      return { icon: action?.icon || '⚒️', label: action?.name || 'Skill action', detail: `${DATA.skills[action?.skill]?.name || ''} · ${formatNumber(activity.completed || 0)} completed`, percent: clampedPercent(activity.progressMs || 0, duration) };
    }
    if (activity.kind === 'travel') return { icon: '🥾', label: `Traveling to ${DATA.regions[activity.targetRegionId]?.name || 'destination'}`, detail: `${formatDuration(activity.remainingMs, true)} remaining`, percent: 100 - clampedPercent(activity.remainingMs, activity.totalMs) };
    if (activity.kind === 'combat') {
      const enemy = DATA.enemies[activity.enemyId];
      return { icon: enemy?.icon || '⚔️', label: `Fighting ${enemy?.name || 'enemy'}`, detail: `${activity.killsThisSession || 0} kills this session`, percent: 100 - clampedPercent(activity.enemyHp, enemy?.hp || 1) };
    }
    return { icon: '⚡', label: titleCase(activity.kind), detail: 'Active', percent: 0 };
  }

  activeInteractionButton() {
    const activity = this.engine.character?.activity;
    if (!activity || activity.kind === 'combat') return '';
    const ready = !activity.activePromptAt || activity.activePromptAt <= Date.now();
    return `<button class="button ${ready ? 'success' : ''}" data-action="active-interaction" ${ready ? '' : 'disabled'}>${ready ? '✨ Focus opportunity' : `Focus in ${formatDuration(activity.activePromptAt - Date.now(), true)}`}</button>`;
  }

  getNextSuggestion() {
    const c = this.engine.character;
    const ready = Object.entries(c.quests).find(([, state]) => state.status === 'ready');
    if (ready) return { text: `${DATA.quests[ready[0]].name} is ready to claim.`, label: 'Claim quest', view: 'quests' };
    if (!c.activity) {
      const action = Object.values(DATA.actions).find((entry) => entry.regions.includes(c.location) && this.engine.getSkillLevel(entry.skill) >= entry.level);
      if (action) return { text: `Train ${DATA.skills[action.skill].name} with ${action.name}.`, label: 'Browse local skills', view: 'skills' };
    }
    if (c.farming.plots.some((plot) => plot.cropId && plot.readyAt <= Date.now())) return { text: 'One or more farming plots are ready to harvest.', label: 'Open Farming', action: 'open-farming' };
    return { text: 'Inspect the world map for regional resources, events, and quest destinations.', label: 'Open map', view: 'map' };
  }

  reportMiniSummary(report) {
    const itemTotal = Object.values(report.items || {}).reduce((sum, qty) => sum + qty, 0);
    const xpTotal = Object.values(report.xp || {}).reduce((sum, qty) => sum + qty, 0);
    return `<div class="resource-list" style="margin-top:10px"><div class="resource-row"><span>Progress simulated</span><strong>${formatDuration(report.elapsed)}</strong></div><div class="resource-row"><span>Items</span><strong>${formatNumber(itemTotal)}</strong></div><div class="resource-row"><span>XP</span><strong>${formatNumber(xpTotal)}</strong></div><div class="resource-row"><span>Coins</span><strong>${formatNumber(report.coins || 0)}</strong></div></div>`;
  }

  openActivityPlanner() {
    const c = this.engine.character;
    const info = this.getActivityInfo();
    const localActions = Object.values(DATA.actions).filter((action) => action.regions.includes(c.location) && this.engine.getSkillLevel(action.skill) >= action.level).slice(0, 12);
    this.openModal(`${info.icon} Activity planner`, `<p class="card-subtitle">Run one focused activity while farming, research, buildings, expeditions, trade routes, and voyages continue independently.</p>
      <article class="card card-pad ${c.activity ? 'active' : ''}"><h3 class="card-title">${escapeHtml(info.label)}</h3><p class="card-subtitle">${escapeHtml(info.detail)}</p><div class="progress-track"><div class="progress-fill" style="width:${info.percent}%"></div></div><div class="button-row" style="margin-top:10px">${c.activity ? `<button class="button danger" data-action="stop-activity">Stop activity</button>${this.activeInteractionButton()}` : '<span class="pill">No focused activity</span>'}</div></article>
      <div class="two-column" style="margin-top:14px"><section><h3 class="card-title">Queue</h3><div class="quest-list" style="margin-top:8px">${c.activityQueue.map((entry, index) => `<div class="context-item"><div class="split"><div><strong>${index + 1}. ${escapeHtml(DATA.actions[entry.actionId]?.name || entry.actionId)}</strong><small>${entry.repetitions ? `${entry.repetitions} completions` : 'Until stopped'}</small></div><button class="button tiny danger" data-action="remove-queued" data-id="${entry.id}">Remove</button></div></div>`).join('') || '<div class="empty-state">Queue actions from skill pages.</div>'}</div>${c.activityQueue.length ? '<button class="button small danger" data-action="clear-queue" style="margin-top:8px">Clear queue</button>' : ''}</section><section><h3 class="card-title">Available here</h3><div class="quest-list" style="margin-top:8px">${localActions.map((action) => `<div class="context-item"><div class="split"><div><strong>${action.icon} ${escapeHtml(action.name)}</strong><small>${escapeHtml(DATA.skills[action.skill].name)} · level ${action.level}</small></div><button class="button tiny primary" data-action="start-skill-action" data-id="${action.id}">Start</button></div></div>`).join('') || '<div class="empty-state">No unlocked action here.</div>'}</div></section></div>`, { wide: true });
  }

  openCreateCharacter(slot) {
    const backgrounds = Object.entries(DATA.backgrounds);
    const difficulties = Object.entries(DATA.difficulties);
    this.openModal('Begin a Chronicle', `<form id="create-character-form"><div class="form-grid"><label class="form-field"><span>Character name</span><input class="input" name="name" maxlength="24" required value="Adventurer ${slot + 1}"></label><label class="form-field"><span>Difficulty</span><select class="select" name="difficulty">${difficulties.map(([id, entry]) => `<option value="${id}">${entry.icon} ${escapeHtml(entry.name)}</option>`).join('')}</select></label></div><h3>Background</h3><div class="choice-grid">${backgrounds.map(([id, entry], index) => `<label class="choice-card ${index === 0 ? 'selected' : ''}"><input type="radio" name="background" value="${id}" ${index === 0 ? 'checked' : ''}><strong>${entry.icon} ${escapeHtml(entry.name)}</strong><p class="card-subtitle">${escapeHtml(entry.description)}</p></label>`).join('')}</div><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button type="submit" class="button primary">Create character</button></div></form>`);
    const form = this.modalCard.querySelector('#create-character-form');
    form.addEventListener('change', () => form.querySelectorAll('.choice-card').forEach((label) => label.classList.toggle('selected', label.querySelector('input').checked)));
    form.addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(form); this.engine.createCharacter(slot, { name: data.get('name'), background: data.get('background'), difficulty: data.get('difficulty') }); this.closeModal(); this.showGame(); this.processResume(); });
  }

  openQueueDialog(actionId) {
    const action = DATA.actions[actionId];
    this.openModal(`Queue ${action.name}`, `<form id="queue-form"><p class="card-subtitle">Set a completion target. Use 0 to continue until supplies, inventory space, location, or another stop condition ends the task.</p><label class="form-field"><span>Completions</span><input class="input" type="number" name="repetitions" min="0" max="1000000" value="100"></label><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary">Add to queue</button></div></form>`);
    this.modalCard.querySelector('#queue-form').addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); this.engine.queueSkillAction(actionId, Number(data.get('repetitions'))); this.closeModal(); });
  }

  openRegionContent(regionId) {
    const region = DATA.regions[regionId];
    const actions = Object.values(DATA.actions).filter((entry) => entry.regions.includes(regionId));
    const enemies = Object.values(DATA.enemies).filter((entry) => entry.region === regionId);
    const quests = Object.entries(DATA.quests).filter(([, entry]) => entry.region === regionId);
    this.openModal(`${region.icon} ${region.name}`, `<p>${escapeHtml(region.description)}</p><div class="action-meta"><span class="pill danger">Danger ${region.danger}</span>${region.services.map((entry) => `<span class="pill">${escapeHtml(titleCase(entry))}</span>`).join('')}</div><div class="two-column" style="margin-top:14px"><section><h3>Skill actions</h3><div class="quest-list">${actions.slice(0, 30).map((entry) => `<div class="context-item"><strong>${entry.icon} ${escapeHtml(entry.name)}</strong><small>${DATA.skills[entry.skill].name} ${entry.level}</small></div>`).join('') || '<p class="muted">None.</p>'}</div></section><section><h3>Enemies and quests</h3><div class="quest-list">${enemies.map((entry) => `<div class="context-item"><strong>${entry.icon} ${escapeHtml(entry.name)}</strong><small>Level ${entry.level}</small></div>`).join('')}${quests.map(([id, entry]) => `<div class="context-item"><strong>${entry.icon} ${escapeHtml(entry.name)}</strong><small>${titleCase(this.engine.character.quests[id]?.status)}</small></div>`).join('') || '<p class="muted">None.</p>'}</div></section></div>`, { wide: true });
  }

  openAutomation() {
    const automation = this.engine.character.combat.automation;
    this.openModal('Combat automation', `<form id="automation-form"><p class="card-subtitle">These rules let the same combat system support active play and safe idle sessions.</p>
      ${automationToggle('autoEat', 'Automatically eat food', automation.autoEat)}
      ${automationRange('eatBelowPercent', 'Eat below HP percentage', automation.eatBelowPercent, 10, 90)}
      ${automationToggle('autoPotion', 'Automatically use potions and antidotes', automation.autoPotion)}
      ${automationRange('antidoteAtStacks', 'Antidote at poison stacks', automation.antidoteAtStacks, 1, 10)}
      ${automationRange('fleeBelowPercent', 'Flee below HP percentage', automation.fleeBelowPercent, 1, 70)}
      ${automationToggle('interruptSpecial', 'Interrupt telegraphed special attacks', automation.interruptSpecial)}
      ${automationToggle('useAbilities', 'Use abilities automatically', automation.useAbilities)}
      ${automationToggle('stopOnRareDrop', 'Stop after a rare drop', automation.stopOnRareDrop)}
      ${automationToggle('allowOfflineCombat', 'Allow combat during offline progress', automation.allowOfflineCombat)}
      ${automationRange('stopAfterKills', 'Stop after kills (0 = no limit)', automation.stopAfterKills, 0, 500)}
      ${automationRange('stopWhenFoodBelow', 'Stop when food count falls below', automation.stopWhenFoodBelow, 0, 100)}
      <div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary">Save rules</button></div></form>`);
    this.modalCard.querySelector('#automation-form').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const patch = {}; for (const input of form.elements) { if (!input.name) continue; patch[input.name] = input.type === 'checkbox' ? input.checked : Number(input.value); } this.engine.updateAutomation(patch); this.closeModal(); });
  }

  claimQuest(questId) {
    const quest = DATA.quests[questId];
    if (!quest.choices) { this.engine.claimQuest(questId); return; }
    this.openModal(`Choose: ${quest.name}`, `<p>${escapeHtml(quest.description)}</p><div class="choice-grid">${quest.choices.map((choice) => `<article class="choice-card"><strong>${escapeHtml(choice.label)}</strong><p class="card-subtitle">${escapeHtml(rewardSummary(choice.rewards))}</p><button class="button primary" data-quest-choice="${choice.id}">Choose</button></article>`).join('')}</div>`);
    this.modalCard.querySelectorAll('[data-quest-choice]').forEach((button) => button.addEventListener('click', () => { this.engine.claimQuest(questId, button.dataset.questChoice); this.closeModal(); }));
  }

  openPlantCrop(plotId) {
    const level = this.engine.getSkillLevel('farming');
    this.openModal('Plant a crop', `<div class="choice-grid">${Object.entries(DATA.crops).map(([id, crop]) => { const seeds = this.engine.stackQty(crop.seed); const locked = level < crop.level || seeds < 1; return `<article class="choice-card ${locked ? 'locked' : ''}"><strong>${crop.icon} ${escapeHtml(crop.name)}</strong><p class="card-subtitle">Farming ${crop.level} · ${formatDuration(crop.growMs, true)} · ${seeds} seed${seeds === 1 ? '' : 's'}</p><button class="button primary" data-plant-choice="${id}" ${locked ? 'disabled' : ''}>Plant</button><button class="button small" data-plant-compost="${id}" ${locked || this.engine.stackQty('compost') < 1 ? 'disabled' : ''}>Plant + compost</button></article>`; }).join('')}</div>`);
    this.modalCard.querySelectorAll('[data-plant-choice]').forEach((button) => button.addEventListener('click', () => { this.engine.plantCrop(plotId, button.dataset.plantChoice, false); this.closeModal(); }));
    this.modalCard.querySelectorAll('[data-plant-compost]').forEach((button) => button.addEventListener('click', () => { this.engine.plantCrop(plotId, button.dataset.plantCompost, true); this.closeModal(); }));
  }

  openProjectContribution(projectId, resourceId) {
    const project = DATA.settlementProjects[projectId];
    const state = this.engine.character.projects[projectId];
    const required = project.requirements[resourceId];
    const given = resourceId === 'coins' ? state.coins || 0 : state.contributions[resourceId] || 0;
    const owned = resourceId === 'coins' ? this.engine.character.coins : this.engine.totalOwned(resourceId);
    const maximum = Math.max(0, Math.min(owned, required - given));
    if (maximum <= 0) {
      this.toast('Nothing available', resourceId === 'coins' ? 'You do not have enough uncommitted coins.' : `You do not own any available ${DATA.items[resourceId]?.name || resourceId}.`, 'danger');
      return;
    }
    this.openQuantityDialog(`Contribute ${resourceId === 'coins' ? 'coins' : DATA.items[resourceId].name}`, resourceId, maximum, (qty) => this.engine.contributeProject(projectId, resourceId, qty), { max: maximum });
  }

  openExpedition(companionId) {
    const companion = DATA.companions[companionId];
    this.openModal(`Send ${companion.name}`, `<div class="choice-grid">${Object.entries(DATA.expeditions).map(([id, expedition]) => `<article class="choice-card"><strong>${expedition.icon} ${escapeHtml(expedition.name)}</strong><p class="card-subtitle">${formatDuration(expedition.durationMs, true)} · recommended ${escapeHtml(expedition.recommendedRole)}</p><p class="card-subtitle">Finds: ${escapeHtml(expedition.rewards.map((entry) => DATA.items[entry.item]?.name).join(', '))}</p><button class="button primary" data-expedition="${id}">Depart</button></article>`).join('')}</div>`);
    this.modalCard.querySelectorAll('[data-expedition]').forEach((button) => button.addEventListener('click', () => { this.engine.startExpedition(companionId, button.dataset.expedition); this.closeModal(); }));
  }

  openTradeRoute() {
    const c = this.engine.character;
    const destinations = Object.entries(DATA.regions).filter(([id]) => id !== c.location && c.discoveredRegions.includes(id));
    const stacks = Object.entries(c.inventory.stacks).filter(([id, qty]) => qty > 0 && DATA.items[id]?.value > 0 && !DATA.items[id]?.currency);
    this.openModal('Create trade route', `<form id="trade-route-form"><div class="form-grid"><label class="form-field"><span>Destination</span><select class="select" name="destination">${destinations.map(([id, region]) => `<option value="${id}">${escapeHtml(region.name)}</option>`).join('')}</select></label><label class="form-field"><span>Cargo</span><select class="select" name="itemId">${stacks.map(([id, qty]) => `<option value="${id}">${escapeHtml(DATA.items[id].name)} (${qty})</option>`).join('')}</select></label><label class="form-field"><span>Quantity</span><input class="input" type="number" name="qty" min="1" value="1"></label></div><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary" ${!destinations.length || !stacks.length ? 'disabled' : ''}>Dispatch caravan</button></div></form>`);
    this.modalCard.querySelector('#trade-route-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); this.engine.startTradeRoute(form.get('destination'), form.get('itemId'), Number(form.get('qty'))); this.closeModal(); });
  }

  inspectStack(itemId, location) {
    const item = DATA.items[itemId];
    const qty = location === 'bank' ? this.engine.stackQty(itemId, 'bank') : this.engine.stackQty(itemId, 'inventory');
    this.openModal(`${item.icon} ${item.name}`, `<p class="card-subtitle">${escapeHtml((item.tags || []).map(titleCase).join(' · '))}</p><div class="resource-list"><div class="resource-row"><span>Quantity here</span><strong>${formatNumber(qty)}</strong></div><div class="resource-row"><span>Base value</span><strong>${formatNumber(item.value)} coins</strong></div><div class="resource-row"><span>Rarity</span><strong>${escapeHtml(titleCase(item.rarity))}</strong></div>${item.heal ? `<div class="resource-row"><span>Healing</span><strong>${item.heal} HP</strong></div>` : ''}</div><div class="modal-footer">${location === 'inventory' ? `<button class="button" data-action="deposit-stack" data-id="${itemId}">Deposit all</button>${item.heal || item.buff || item.cleanse ? `<button class="button primary" data-action="use-item" data-id="${itemId}">Use</button>` : ''}` : `<button class="button primary" data-action="withdraw-stack" data-id="${itemId}">Withdraw all</button>`}<button class="button" data-action="close-modal">Close</button></div>`);
  }

  inspectInstance(uid) {
    const found = this.engine.findInstance(uid);
    if (!found) throw new Error('That item no longer exists.');
    const instance = found.instance;
    const item = DATA.items[instance.itemId];
    const equipped = this.engine.isEquipped(uid);
    this.openModal(`${item.icon} ${item.name}`, `<div class="two-column"><section><p class="eyebrow">${escapeHtml(titleCase(instance.quality))} · ${Math.round(instance.durability)}% durability</p><p>${escapeHtml((item.tags || []).map(titleCase).join(' · '))}</p><div class="resource-list">${Object.entries(item.stats || {}).map(([key, value]) => `<div class="resource-row"><span>${escapeHtml(titleCase(key))}</span><strong>+${value}</strong></div>`).join('') || '<p class="muted">No base statistics.</p>'}</div></section><section><h3>Affixes</h3><div class="resource-list">${instance.affixes.map((affix) => `<div class="resource-row"><span>${escapeHtml(titleCase(affix.stat))}</span><strong>+${affix.value}</strong></div>`).join('') || '<p class="muted">No affixes.</p>'}</div></section></div><div class="modal-footer">${found.location === 'inventory' && item.equipSlot ? `<button class="button primary" data-action="equip-instance" data-uid="${uid}">Equip</button>` : ''}${!equipped ? `<button class="button" data-action="toggle-lock-instance" data-uid="${uid}">${instance.locked ? 'Unlock' : 'Lock'}</button><button class="button" data-action="salvage-instance" data-uid="${uid}" ${instance.locked ? 'disabled' : ''}>Salvage</button>${DATA.regions[this.engine.character.location]?.services?.includes('market') && found.location === 'inventory' ? `<button class="button danger" data-action="sell-instance" data-uid="${uid}" ${instance.locked ? 'disabled' : ''}>Sell for ${formatNumber(Math.round(this.engine.getSellPrice(item.id) * qualityMultiplier(instance.quality)))}c</button>` : ''}` : ''}<button class="button" data-action="close-modal">Close</button></div>`);
  }

  openInbox() {
    const c = this.engine.character;
    const entries = [...c.inbox].reverse();
    this.openModal('🔔 Chronicle inbox', `<div class="timeline">${entries.map((entry) => `<div class="timeline-entry"><div><strong>${escapeHtml(entry.title)}</strong><small>${new Date(entry.time).toLocaleString()} · ${escapeHtml(entry.message)}</small></div></div>`).join('') || '<div class="empty-state">No notifications.</div>'}</div><div class="modal-footer"><button class="button" data-action="close-modal">Close</button></div>`, { wide: true });
    this.engine.markInboxRead();
  }

  openMobileMenu() {
    this.openModal('More', `<div class="choice-grid">${NAVIGATION.flatMap((group) => group.entries).filter(([view]) => !['dashboard', 'map', 'character'].includes(view)).map(([view, icon, label]) => `<button class="choice-card" data-view="${view}"><strong>${icon} ${escapeHtml(label)}</strong></button>`).join('')}</div>`);
  }

  openOfflineReport(report) {
    if (!report) return;
    const itemEntries = Object.entries(report.items || {}).sort((a, b) => b[1] - a[1]);
    const xpEntries = Object.entries(report.xp || {}).sort((a, b) => b[1] - a[1]);
    this.openModal('🌙 Welcome back', `<p>You were away for <strong>${formatDuration(report.rawElapsed)}</strong>. The simulation processed <strong>${formatDuration(report.elapsed)}</strong> under your difficulty’s offline cap.</p><div class="two-column"><section class="card card-pad"><h3 class="card-title">Items and coins</h3><div class="resource-list">${itemEntries.map(([id, qty]) => `<div class="resource-row"><span>${DATA.items[id]?.icon || '•'} ${escapeHtml(DATA.items[id]?.name || id)}</span><strong>+${formatNumber(qty)}</strong></div>`).join('') || '<p class="muted">No items acquired.</p>'}<div class="resource-row"><span>Coins</span><strong>+${formatNumber(report.coins || 0)}</strong></div></div></section><section class="card card-pad"><h3 class="card-title">Experience</h3><div class="resource-list">${xpEntries.map(([id, qty]) => `<div class="resource-row"><span>${DATA.skills[id]?.icon || '•'} ${escapeHtml(DATA.skills[id]?.name || id)}</span><strong>+${formatNumber(qty)} XP</strong></div>`).join('') || '<p class="muted">No XP gained.</p>'}</div></section></div>${report.messages?.length ? `<article class="card card-pad" style="margin-top:12px"><h3 class="card-title">Chronicle summary</h3><ul>${report.messages.slice(0, 30).map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul></article>` : ''}<div class="modal-footer"><button class="button primary" data-action="close-modal">Continue</button></div>`, { wide: true });
  }

  async processResume() {
    if (!this.engine.character) return;
    if (!this.engine.account.settings.offlineProgress) { this.engine.character.lastProcessedAt = Date.now(); return; }
    this.engine.advanceTo(Date.now(), { offline: true });
  }

  openQuantityDialog(title, itemId, initial, callback, options = {}) {
    const max = Number.isFinite(options.max) ? Math.max(0, Math.floor(options.max)) : 1000000;
    this.openModal(title, `<form id="quantity-form"><label class="form-field"><span>Quantity</span><input class="input" type="number" name="qty" min="1" max="${max}" value="${Math.max(1, Math.min(max || 1, Math.floor(initial) || 1))}"></label><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary">Confirm</button></div></form>`);
    this.modalCard.querySelector('#quantity-form').addEventListener('submit', (event) => { event.preventDefault(); const qty = Number(new FormData(event.currentTarget).get('qty')); callback(qty); this.closeModal(); });
  }

  promptText(title, label, value, callback) {
    this.openModal(title, `<form id="text-prompt-form"><label class="form-field"><span>${escapeHtml(label)}</span><input class="input" name="value" maxlength="40" value="${escapeHtml(value)}" required></label><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary">Confirm</button></div></form>`);
    const form = this.modalCard.querySelector('#text-prompt-form');
    form.addEventListener('submit', (event) => { event.preventDefault(); callback(new FormData(form).get('value')); this.closeModal(); });
    form.elements.value.focus(); form.elements.value.select();
  }

  confirm(title, message, callback) {
    this.openModal(title, `<p>${escapeHtml(message)}</p><div class="modal-footer"><button class="button" data-action="close-modal">Cancel</button><button class="button danger" id="confirm-modal-button">Confirm</button></div>`);
    this.modalCard.querySelector('#confirm-modal-button').addEventListener('click', async () => { await callback(); this.closeModal(); });
  }

  openModal(title, body, { wide = false } = {}) {
    this.modalCard.classList.toggle('wide', wide);
    this.modalCard.innerHTML = `<div class="modal-header"><h2 id="modal-title">${escapeHtml(title)}</h2><button class="button small" data-action="close-modal" aria-label="Close dialog">Close</button></div><div class="modal-body">${body}</div>`;
    this.modalLayer.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => this.modalCard.querySelector('button, input, select, textarea')?.focus());
  }

  closeModal() {
    this.modalLayer.hidden = true;
    this.modalCard.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  toast(title, message, type = '') {
    const mobile = window.matchMedia?.('(max-width: 900px)').matches;
    if (mobile) this.toastRegion.replaceChildren();
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small>`;
    this.toastRegion.append(node);
    setTimeout(() => node.remove(), mobile ? 2600 : 4200);
  }

  pickFile(callback, accept = '.json,application/json,text/plain') {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.addEventListener('change', async () => { const file = input.files?.[0]; if (file) await callback(file); }, { once: true });
    input.click();
  }

  exportCharacter(slot) {
    const character = this.engine.account.slots[slot];
    if (!character) throw new Error('That slot is empty.');
    const safe = character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character';
    downloadText(`eldoria-${safe}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportCharacterPayload(character), null, 2));
    this.toast('Character exported', `${character.name} was downloaded as JSON.`, 'success');
  }

  exportAccount() {
    downloadText(`eldoria-account-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAccountPayload(this.engine.account), null, 2));
    this.toast('Account exported', 'All three slots and account settings were downloaded.', 'success');
  }

  importCharacter(text, slot) {
    const parsed = parseImportPayload(text);
    if (parsed.type !== 'character') throw new Error('That file contains an account. Use Import account instead.');
    if (this.engine.account.slots[slot]) return this.confirm('Replace character', 'Importing replaces the character currently in this slot.', () => { this.engine.replaceCharacter(slot, parsed.value); this.closeModal(); this.showGame(); this.processResume(); });
    this.engine.replaceCharacter(slot, parsed.value); this.showGame(); this.processResume();
  }

  importAccount(text) {
    const parsed = parseImportPayload(text);
    if (parsed.type !== 'account') throw new Error('That file contains one character. Import it into a character slot instead.');
    this.confirm('Replace local account', 'This replaces all local character slots and settings with the imported account.', () => { this.engine.setAccount(parsed.value); this.persistence.setAutosaveSeconds(this.engine.account.settings.autosaveSeconds); this.applySettings(); this.persistence.markDirty('account-imported', { urgent: true }); if (this.engine.character) this.showGame(); else this.showCharacterGate(); });
  }

  importContentPack(text) {
    const pack = JSON.parse(text);
    applyContentPack(pack);
    this.engine.character.modded = true;
    const descriptor = { id: pack.id || `pack-${Date.now()}`, name: pack.name || 'Unnamed pack', version: pack.version || 1, importedAt: Date.now(), pack };
    this.engine.account.mods = this.engine.account.mods.filter((entry) => entry.id !== descriptor.id);
    this.engine.account.mods.push(descriptor);
    this.engine.touch('content-pack-imported', { id: descriptor.id }, true);
    this.toast('Content pack installed', `${pack.name || 'Pack'} added to this session and save.`, 'success');
  }

  exportContentTemplate() {
    const template = { id: 'my_content_pack', name: 'My Eldoria Content Pack', version: 1, items: { example_item: { name: 'Example Item', icon: '✦', value: 10, stackable: true, rarity: 'uncommon', tags: ['example'] } }, actions: {}, enemies: {}, quests: {}, worldEvents: {} };
    downloadText('eldoria-content-pack-template.json', JSON.stringify(template, null, 2));
  }

  async installApp() {
    if (this.installPrompt) {
      await this.installPrompt.prompt();
      await this.installPrompt.userChoice;
      this.installPrompt = null;
      this.setInstallPrompt(null);
      return;
    }
    this.openModal('Install on your device', `<h3>Android / Chrome</h3><p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p><h3>iPhone / iPad</h3><p>Open this site in Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>. The PWA uses standalone display mode and offline-cached assets.</p><p class="fine-print">Installation prompts only appear on secure HTTPS hosts or localhost.</p>`);
  }

  async requestNotifications() {
    if (!('Notification' in globalThis)) throw new Error('This browser does not support notifications.');
    const permission = await Notification.requestPermission();
    this.engine.account.settings.notifications = permission === 'granted';
    this.persistence.markDirty('notification-setting', { urgent: true });
    this.toast('Notifications', permission === 'granted' ? 'Alerts enabled.' : `Permission is ${permission}.`, permission === 'granted' ? 'success' : 'danger');
  }

  async checkForUpdate() {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) throw new Error('No service worker registration is active.');
    await registration.update();
    this.toast('Update check complete', registration.waiting ? 'A new version is ready. Reload to apply it.' : 'You are using the newest cached version.', 'success');
  }
}

installMemoryUI(AppUI);

const COMBAT_STYLE_ICONS = { melee: '⚔️', ranged: '🏹', sorcery: '🪄', faith: '☀️' };
const COMBAT_STYLE_DESCRIPTIONS = {
  melee: 'Reliable physical combat using Attack and Strength.',
  ranged: 'Precision attacks that consume arrows and train Ranged.',
  sorcery: 'Arcane damage, elemental weaknesses, runes, and wards.',
  faith: 'Radiant attacks, healing, cleansing, and defensive support.',
};
const REGION_TRADE_SUMMARY = {
  stonehaven: 'Ore is cheap; timber and food are valuable.', pineglade: 'Wood and hides are abundant.', riverside: 'Food and crops are inexpensive.', willowbrook: 'Artifacts and luxury goods sell well.', crystal_lake: 'Magic materials are locally available.', watchpost: 'Food, potions, and armor command premiums.', waveport: 'Cargo and fish move quickly.', mount_ember: 'Volcanic goods are common; supplies are costly.',
};
const QUALITY_MULTIPLIERS = { crude: .72, standard: 1, fine: 1.18, superior: 1.42, masterwork: 1.85, legendary: 2.7 };
function qualityMultiplier(quality) { return QUALITY_MULTIPLIERS[quality] || 1; }
function clampedPercent(value, maximum) { return Math.max(0, Math.min(100, (Number(value) || 0) / Math.max(1, Number(maximum) || 1) * 100)); }
function pageHeader(icon, title, description, actions = '') { return `<header class="page-header"><div class="page-title-wrap"><p class="eyebrow">${icon} Chronicle of Eldoria</p><h1 class="page-title">${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></header>`; }
function statTile(label, value, icon = '') { return `<div class="stat-tile"><span>${icon}</span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`; }
function resourceBar(label, current, max, type) { return `<div class="resource-bar"><div class="progress-meta"><span>${escapeHtml(label)}</span><strong>${Math.floor(current)}/${Math.floor(max)}</strong></div><div class="progress-track large"><div class="progress-fill ${type}" style="width:${clampedPercent(current, max)}%"></div></div></div>`; }
function statusChips(statuses = []) { return statuses.length ? statuses.map((status) => `<span class="pill danger">${escapeHtml(titleCase(status.id))} ${status.stacks || status.turns || ''}</span>`).join('') : '<span class="pill">No status effects</span>'; }
function automationSummary(a) { return `<div class="resource-list"><div class="resource-row"><span>Auto-eat</span><strong>${a.autoEat ? `Below ${a.eatBelowPercent}%` : 'Off'}</strong></div><div class="resource-row"><span>Flee</span><strong>Below ${a.fleeBelowPercent}%</strong></div><div class="resource-row"><span>Abilities</span><strong>${a.useAbilities ? 'Automatic' : 'Manual'}</strong></div><div class="resource-row"><span>Offline combat</span><strong>${a.allowOfflineCombat ? 'Allowed' : 'Paused'}</strong></div></div>`; }
function rewardSummary(rewards = {}) { const parts = []; if (rewards.coins) parts.push(`${formatNumber(rewards.coins)} coins`); for (const [id, qty] of Object.entries(rewards.items || {})) parts.push(`${qty}× ${DATA.items[id]?.name || id}`); for (const [id, xp] of Object.entries(rewards.xp || {})) parts.push(`${formatNumber(xp)} ${DATA.skills[id]?.name || id} XP`); for (const [id, rep] of Object.entries(rewards.reputation || {})) parts.push(`${rep > 0 ? '+' : ''}${rep} ${DATA.factions[id]?.name || id} reputation`); if (rewards.legacyPoints) parts.push(`${rewards.legacyPoints} Legacy point${rewards.legacyPoints === 1 ? '' : 's'}`); return parts.join(' · ') || 'Progress and story unlocks'; }
function reputationLabel(value) { if (value < -500) return 'Hostile'; if (value < 0) return 'Distrusted'; if (value < 250) return 'Neutral'; if (value < 500) return 'Known'; if (value < 1000) return 'Friendly'; if (value < 2000) return 'Honored'; return 'Exalted'; }
function settingToggle(key, title, description, checked) { return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}></label>`; }
function automationToggle(key, title, checked) { return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong></span><input type="checkbox" name="${key}" ${checked ? 'checked' : ''}></label>`; }
function automationRange(key, title, value, min, max) { return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong><small>${value}</small></span><input type="number" class="input" name="${key}" value="${Number(value) || 0}" min="${min}" max="${max}"></label>`; }
