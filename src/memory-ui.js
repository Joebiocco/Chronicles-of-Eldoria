import { APP_VERSION, DATA } from './data.js';
import { escapeHtml, formatDuration, formatNumber, levelProgress, titleCase } from './utils.js';

const STRUCTURAL_REASONS = new Set([
  'replace', 'character-selected', 'character-created', 'character-imported', 'character-deleted',
  'travel-started', 'waystone-travel', 'combat-started', 'encounter-started', 'combat-fled', 'combat-stopped',
  'skill-action-started', 'activity-stopped', 'active-interaction', 'quest-started', 'quest-claimed',
  'story-quest-started', 'story-objective-completed', 'story-stage-advanced', 'story-decision-gate',
  'story-combat-started', 'story-ending-combat-started', 'story-quest-completed',
  'dungeon-started', 'dungeon-path-chosen', 'dungeon-combat-started', 'dungeon-node-completed', 'dungeon-completed', 'dungeon-abandoned',
  'husbandry-stocked', 'husbandry-fed', 'husbandry-collected', 'husbandry-breeding-started',
  'ritual-performed', 'diplomacy-action-completed', 'specialization-selected',
  'activity-plan-started', 'item-favorite-changed', 'item-reserve-changed', 'item-note-changed', 'item-protection-changed',
  'content-pack-imported', 'offline-progress', 'setting-animationQuality',
]);

const NAV_ICONS = {
  dashboard: 'home', map: 'map', skills: 'skills', combat: 'combat', quests: 'quests', town: 'town', bank: 'bank', character: 'character', collections: 'collections', settings: 'settings',
};

export function installMemoryUI(AppUI) {
  if (!AppUI || AppUI.prototype.__memoryUiInstalled) return;
  const proto = AppUI.prototype;
  Object.defineProperty(proto, '__memoryUiInstalled', { value: true });

  const originalBindEvents = proto.bindEvents;
  const originalInitialize = proto.initialize;
  const originalRenderAll = proto.renderAll;
  const originalRenderHeader = proto.renderHeader;
  const originalRenderSidebar = proto.renderSidebar;
  const originalRenderView = proto.renderView;
  const originalRenderContext = proto.renderContext;
  const originalRenderDashboard = proto.renderDashboard;
  const originalRenderCombat = proto.renderCombat;
  const originalRenderTownTab = proto.renderTownTab;
  const originalRenderSettings = proto.renderSettings;
  const originalHandleAction = proto.handleAction;
  const originalHandleSettingChange = proto.handleSettingChange;
  const originalApplySettings = proto.applySettings;
  const originalOpenModal = proto.openModal;
  const originalCloseModal = proto.closeModal;
  const originalInspectInstance = proto.inspectInstance;
  const originalOpenActivityPlanner = proto.openActivityPlanner;

  proto.bindEvents = function bindMemoryEvents() {
    originalBindEvents.call(this);
    this.mapPointers = new Map();
    this.visualFrameHandle = null;
    this.lastVisualTimestamp = 0;
    this.lastStructuralSignature = '';
    this.lastMainRenderAt = 0;
    this.audioManager = null;
    this.serviceWorkerRegistration = null;
    this.updateWaitingWorker = null;
    this.previouslyFocused = null;

    document.addEventListener('keydown', (event) => {
      const mapViewport = event.target?.closest?.('[data-map-viewport]');
      if (mapViewport && !isTypingTarget(event.target)) {
        const state = this.mapState();
        const panStep = event.shiftKey ? 120 : 44;
        let handled = true;
        if (['+','='].includes(event.key)) this.zoomMap(1.18, mapViewport.clientWidth / 2, mapViewport.clientHeight / 2);
        else if (event.key === '-') this.zoomMap(.84, mapViewport.clientWidth / 2, mapViewport.clientHeight / 2);
        else if (['0','f','F'].includes(event.key)) this.fitMap();
        else if (['c','C'].includes(event.key)) this.centerMapOnRegion(this.engine.character.location);
        else if (event.key === 'ArrowLeft') state.panX += panStep;
        else if (event.key === 'ArrowRight') state.panX -= panStep;
        else if (event.key === 'ArrowUp') state.panY += panStep;
        else if (event.key === 'ArrowDown') state.panY -= panStep;
        else handled = false;
        if (handled) {
          event.preventDefault();
          if (event.key.startsWith('Arrow')) { this.clampMapState(); this.applyMapTransform(); this.persistMapState(); }
          return;
        }
      }
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        this.openGlobalSearch();
      }
      if (event.key === 'Escape' && !this.modalLayer.hidden) this.closeModal();
      if (event.key === 'Tab' && !this.modalLayer.hidden) this.trapModalFocus(event);
    });

    document.addEventListener('input', (event) => {
      if (event.target.matches('[data-global-search]')) this.updateGlobalSearchResults(event.target.value);
      if (event.target.matches('[data-item-note]')) this.engine.setItemNote(event.target.dataset.itemNote, event.target.value);
    });

    document.addEventListener('wheel', (event) => {
      const viewport = event.target.closest('[data-map-viewport]');
      if (!viewport) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      this.zoomMap(event.deltaY < 0 ? 1.12 : 0.89, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });

    document.addEventListener('pointerdown', (event) => {
      const viewport = event.target.closest('[data-map-viewport]');
      if (!viewport) return;
      viewport.setPointerCapture?.(event.pointerId);
      this.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.mapGestureStart = { x: event.clientX, y: event.clientY, panX: this.mapState().panX, panY: this.mapState().panY, zoom: this.mapState().zoom, distance: this.pointerDistance() };
    });
    document.addEventListener('pointermove', (event) => {
      if (!this.mapPointers.has(event.pointerId)) return;
      const previous = this.mapPointers.get(event.pointerId);
      this.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...this.mapPointers.values()];
      if (points.length === 1) {
        const state = this.mapState();
        state.panX += event.clientX - previous.x;
        state.panY += event.clientY - previous.y;
        this.clampMapState();
        this.applyMapTransform();
      } else if (points.length >= 2) {
        const distance = this.pointerDistance();
        const start = this.mapGestureStart?.distance || distance;
        if (start > 0) this.setMapZoom((this.mapGestureStart?.zoom || this.mapState().zoom) * distance / start);
      }
    });
    const endPointer = (event) => { this.mapPointers.delete(event.pointerId); this.persistMapState(); };
    document.addEventListener('pointerup', endPointer);
    document.addEventListener('pointercancel', endPointer);
  };

  proto.bindEngineEvents = function bindMemoryEngineEvents() {
    this.engine.addEventListener('change', (event) => {
      const detail = event.detail || {};
      this.persistence.markDirty(detail.reason, { urgent: detail.urgent });
      const signature = this.getStructuralSignature();
      const changedStructure = signature !== this.lastStructuralSignature;
      if (STRUCTURAL_REASONS.has(detail.reason) || changedStructure || detail.reason !== 'simulation') {
        this.lastStructuralSignature = signature;
        this.scheduleRender(true);
      } else {
        this.updateDynamic();
        this.updateVisibleQuantities();
      }
    });
    this.engine.addEventListener('tick', () => this.updateDynamic());
    this.engine.addEventListener('combat-fx', (event) => this.playCombatFx(event.detail));
    this.engine.addEventListener('audio', (event) => this.audioManager?.play(event.detail.cue, event.detail.cue === 'click' ? 'interface' : 'combat'));
    this.engine.addEventListener('notification', (event) => {
      const notification = event.detail.notification;
      if (!['achievement', 'level'].includes(notification.type)) this.toast(notification.title, notification.message, notification.type === 'danger' || notification.type === 'warning' ? 'danger' : 'success');
      this.audioManager?.play(notification.type === 'quest' ? 'objective' : notification.type === 'achievement' ? 'rare' : 'click', 'notification');
      if (this.engine.account.settings.notifications && document.hidden && Notification.permission === 'granted') new Notification(notification.title, { body: notification.message, icon: './assets/icons/icon-192.png' });
    });
    this.engine.addEventListener('level-up', (event) => {
      const skill = DATA.skills[event.detail.skillId];
      this.toast(`${skill.icon} ${skill.name} level ${event.detail.level}`, 'A new level has been reached.', 'success');
      this.audioManager?.play('rare', 'notification');
    });
    this.engine.addEventListener('achievement', (event) => {
      const achievement = DATA.achievements[event.detail.id];
      this.toast(`${achievement.icon} Achievement unlocked`, achievement.name, 'success');
      this.audioManager?.play('rare', 'notification');
    });
    this.engine.addEventListener('offline-report', (event) => {
      const report = event.detail.report;
      if (this.lastOfflineReportId !== report.id) { this.lastOfflineReportId = report.id; queueMicrotask(() => this.openOfflineReport(report)); }
    });

    this.persistence.addEventListener('status', (event) => {
      const { status, detail, at } = event.detail;
      const icon = document.getElementById('header-save-status');
      if (!icon) return;
      icon.dataset.status = status;
      icon.title = status === 'saving' ? 'Saving locally…' : status === 'saved' ? `Saved at ${new Date(at).toLocaleTimeString()}` : status === 'error' ? `Save error: ${detail}` : 'Unsaved changes';
      icon.setAttribute('aria-label', icon.title);
      icon.textContent = status === 'saving' ? '◌' : status === 'saved' ? '✓' : status === 'error' ? '!' : '•';
      const legacy = document.getElementById('save-status');
      if (legacy) legacy.hidden = true;
      if (status === 'saved') this.audioManager?.play('save', 'interface');
    });
  };

  proto.initialize = async function initializeMemoryUI() {
    await originalInitialize.call(this);
    this.lastStructuralSignature = this.getStructuralSignature();
    this.startVisualLoop();
  };

  proto.setAudioManager = function setAudioManager(manager) { this.audioManager = manager; };
  proto.setServiceWorkerRegistration = function setServiceWorkerRegistration(registration) { this.serviceWorkerRegistration = registration; };


  proto.applySettings = function applySettingsMemory() {
    originalApplySettings.call(this);
    const settings = this.engine.account.settings;
    const quality = settings.reducedMotion ? 'minimal' : (settings.animationQuality || 'full');
    document.body.dataset.animationQuality = quality;
    document.body.classList.toggle('animations-full', quality === 'full');
    document.body.classList.toggle('animations-reduced', quality === 'reduced');
    document.body.classList.toggle('animations-minimal', quality === 'minimal');
    document.body.classList.toggle('no-screen-shake', settings.screenShake === false);
    document.body.classList.toggle('hide-damage-splats', settings.damageSplats === false);
    document.body.classList.toggle('no-background-animation', settings.backgroundAnimations === false);
    document.documentElement.style.setProperty('--particle-density', String(clampNumber(settings.particleDensity ?? .75, 0, 1)));
  };

  proto.renderAll = function renderAllMemory() {
    originalRenderAll.call(this);
    this.lastStructuralSignature = this.getStructuralSignature();
    this.lastMainRenderAt = performance.now();
    this.enhanceRenderedView();
  };

  proto.renderHeader = function renderHeaderMemory() {
    originalRenderHeader.call(this);
    const save = document.getElementById('header-save-status');
    if (save && !save.textContent) save.textContent = '✓';
    const mobileSubtitle = document.getElementById('character-subtitle');
    if (mobileSubtitle) mobileSubtitle.dataset.fullText = mobileSubtitle.textContent;
  };

  proto.renderSidebar = function renderSidebarMemory() {
    originalRenderSidebar.call(this);
    for (const button of this.sidebar.querySelectorAll('[data-view]')) {
      const view = button.dataset.view;
      const iconHost = button.querySelector('.nav-icon, span:first-child');
      if (iconHost && NAV_ICONS[view]) iconHost.innerHTML = svgIcon(NAV_ICONS[view]);
    }
  };

  proto.renderView = function renderViewMemory(preserveScroll = false) {
    const scrollTop = preserveScroll ? this.mainView.scrollTop : 0;
    let html;
    if (this.state.view === 'map') html = this.renderMemoryMap();
    else if (this.state.view === 'quests') html = this.renderMemoryQuests();
    else if (this.state.view === 'combat') html = this.renderMemoryCombat();
    else if (this.state.view === 'town' && ['husbandry', 'ritualism', 'diplomacy'].includes(this.state.townTab)) html = this.renderMemoryTownSystem(this.state.townTab);
    else if (this.state.view === 'settings') html = this.renderMemorySettings();
    else if (this.state.view === 'dashboard') html = this.renderMemoryDashboard();
    else {
      originalRenderView.call(this, preserveScroll);
      this.enhanceRenderedView();
      return;
    }
    this.mainView.innerHTML = html;
    if (preserveScroll) this.mainView.scrollTop = scrollTop;
    this.lastMainRenderAt = performance.now();
    this.enhanceRenderedView();
  };

  proto.renderContext = function renderContextMemory() {
    originalRenderContext.call(this);
    const c = this.engine.character;
    if (!c) return;
    const story = Object.entries(c.quests).find(([id, state]) => DATA.quests[id]?.stages?.length && ['active', 'decision'].includes(state.status));
    const consequence = c.story?.consequences?.[0];
    if (story || consequence) {
      const section = document.createElement('section');
      section.className = 'context-section memory-context';
      section.innerHTML = `${story ? `<h2 class="context-title">Memory Beneath</h2><button class="context-item" data-action="open-story-quest" data-id="${story[0]}"><strong>${DATA.quests[story[0]].icon} ${escapeHtml(DATA.quests[story[0]].name)}</strong><small>${escapeHtml(story[1].status === 'decision' ? 'Your decision is required' : DATA.quests[story[0]].stages[story[1].stageIndex]?.title || 'In progress')}</small></button>` : ''}${consequence ? `<div class="context-item"><strong>World consequence</strong><small>${escapeHtml(consequence.title)}</small></div>` : ''}`;
      this.contextDrawer.prepend(section);
    }
    this.contextDrawer.querySelectorAll('.progress-fill').forEach((fill) => convertBarToTransform(fill));
  };

  proto.renderMemoryDashboard = function renderMemoryDashboard() {
    const base = originalRenderDashboard.call(this);
    const c = this.engine.character;
    const action = c.activity?.kind === 'skill' ? DATA.actions[c.activity.actionId] : null;
    const info = this.getInterpolatedActivityInfo();
    const currentYield = action ? estimateHourly(action, this.engine) : null;
    const plan = c.planner?.activePlan;
    const pending = c.story?.pendingDecision;
    const consequences = (c.story?.consequences || []).slice(0, 3);
    const insert = `<section class="memory-dashboard-grid">
      <article class="card card-pad dashboard-metric-card"><div class="card-header"><div><h2 class="card-title">Activity forecast</h2><p class="card-subtitle">Live estimate from your current equipment, mastery, region, and world effects.</p></div><button class="button small" data-action="open-activity">Plan</button></div>
        ${action ? `<div class="forecast-grid"><div><small>XP/hour</small><strong>${formatNumber(currentYield.xpPerHour)}</strong></div><div><small>Actions/hour</small><strong>${formatNumber(currentYield.actionsPerHour)}</strong></div><div><small>Progress</small><strong>${Math.floor(info.percent)}%</strong></div><div><small>Likely stop</small><strong>${escapeHtml(plan?.estimate?.likelyStop || 'Until stopped')}</strong></div></div>` : '<div class="empty-state">Choose a focused activity to see production and stop estimates.</div>'}
      </article>
      ${pending ? `<article class="card card-pad decision-alert"><p class="eyebrow">Decision gate</p><h2 class="card-title">${escapeHtml(DATA.quests[pending.questId]?.name || 'Quest decision')}</h2><p>Your Chronicle will not choose this outcome while you are away.</p><button class="button primary" data-action="open-story-quest" data-id="${pending.questId}">Make the decision</button></article>` : ''}
      ${consequences.length ? `<article class="card card-pad"><h2 class="card-title">Recent world consequences</h2><div class="timeline">${consequences.map((entry) => `<div class="timeline-entry"><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.text)}</small></div></div>`).join('')}</div></article>` : ''}
    </section>`;
    return base + insert;
  };

  /* ------------------------------ Map UI ------------------------------ */

  proto.mapState = function mapState() {
    const settings = this.engine.account.settings;
    this.state.map ||= { zoom: Number(settings.mapZoom) || 1, panX: Number(settings.mapPanX) || 0, panY: Number(settings.mapPanY) || 0 };
    return this.state.map;
  };

  proto.renderMemoryMap = function renderMemoryMap() {
    const c = this.engine.character;
    const requestedId = this.state.selectedRegion || c.location;
    const selectedId = DATA.regions[requestedId] ? requestedId : c.location;
    const selected = this.engine.getRegionDefinition(selectedId) || DATA.regions[selectedId];
    const overlays = new Set(this.engine.account.settings.mapOverlays || [this.engine.account.settings.mapOverlay || 'resources']);
    const markers = Object.entries(DATA.regions).map(([id, region]) => {
      const discovered = c.discoveredRegions.includes(id);
      const variant = this.engine.getRegionDefinition(id);
      const quests = Object.entries(DATA.quests).filter(([, quest]) => (quest.region === id || quest.startingRegionId === id) && ['available', 'active', 'decision', 'ready'].includes(c.quests[quest.id]?.status)).length;
      const dangerClass = overlays.has('danger') ? ` danger-${Math.min(9, region.danger || 0)}` : '';
      const badges = [
        overlays.has('quests') && quests ? `<b class="map-badge quest">${quests}</b>` : '',
        overlays.has('weather') ? `<b class="map-badge weather">${this.engine.getWeather(id).icon}</b>` : '',
        overlays.has('events') && this.engine.getWorldEvent().regions?.includes(id) ? `<b class="map-badge event">!</b>` : '',
        c.location === id ? '<b class="map-badge player">◆</b>' : '',
      ].join('');
      const label = discovered ? variant.name : 'Undiscovered';
      return `<button class="map-marker${selectedId === id ? ' selected' : ''}${c.location === id ? ' current' : ''}${quests ? ' has-quest' : ''}${Object.values(DATA.dungeons || {}).some((dungeon) => dungeon.region === id) ? ' has-dungeon' : ''}${discovered ? '' : ' undiscovered'}${dangerClass}" style="left:${region.x}%;top:${region.y}%" data-action="select-region" data-region="${id}" aria-label="${escapeHtml(label)}"><span>${discovered ? region.icon : '•'}</span><small>${escapeHtml(label)}</small>${badges}</button>`;
    }).join('');
    const routes = overlays.has('routes') ? this.renderMapRoutes() : '';
    const availableActions = Object.values(DATA.actions).filter((action) => action.regions?.includes(selectedId) && this.engine.getSkillLevel(action.skill) >= action.level).slice(0, 8);
    const variantId = this.engine.getRegionVariant(selectedId);
    const services = [...(DATA.regions[selectedId]?.services || []), ...(c.world.addedServices[selectedId] || [])];
    return `${pageHeaderMemory('map', 'World Map', 'Zoom, pan, inspect regional conditions, and see how your choices change Eldoria.', `<button class="button" data-action="map-fit">Fit</button><button class="button" data-action="map-center">Center player</button><button class="button" data-action="map-center-selected">Center selected</button>`)}
      <div class="map-layout-v2">
        <section class="map-panel-v2 card">
          <div class="map-toolbar" aria-label="Map controls"><button class="icon-button" data-action="map-zoom-out" aria-label="Zoom out">−</button><output data-map-zoom>${Math.round(this.mapState().zoom * 100)}%</output><button class="icon-button" data-action="map-zoom-in" aria-label="Zoom in">+</button><button class="button small" data-action="map-fit">Fit</button><span class="map-key-help" title="Keyboard: +/− zoom, arrows pan, F fit, C center player">Keyboard: +/− · arrows · F · C</span><div class="map-overlay-toggles">${['resources','quests','danger','factions','weather','events','trade','discoveries','routes','dungeons'].map((id) => `<label><input type="checkbox" data-map-overlay-multi="${id}" ${overlays.has(id) ? 'checked' : ''}>${titleCase(id)}</label>`).join('')}</div></div>
          <div class="map-viewport-v2" data-map-viewport tabindex="0" aria-label="Interactive map of Eldoria">
            <div class="map-transform-layer" data-map-transform><img src="./assets/eldoria-map.png" alt="Illustrated map of Eldoria" draggable="false">${routes}<div class="map-marker-layer">${markers}</div></div>
          </div>
        </section>
        <aside class="region-detail-panel card card-pad">
          <p class="eyebrow">${escapeHtml(DATA.factions[c.world.factionOverrides[selectedId] || selected.faction]?.name || 'Independent region')}</p>
          <h2>${selected.icon} ${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p>
          ${variantId !== 'normal' ? `<div class="world-variant-banner"><strong>World state: ${escapeHtml(titleCase(variantId))}</strong><span>This region changed because of a Chronicle decision.</span></div>` : ''}
          <div class="stat-grid compact">${statTileMemory('Danger', selected.danger ?? DATA.regions[selectedId].danger)}${statTileMemory('Recommended', selected.recommended ?? 1)}${statTileMemory('Weather', this.engine.getWeather(selectedId).name)}${statTileMemory('Discovered', c.discoveredRegions.includes(selectedId) ? 'Yes' : 'No')}</div>
          <div class="tag-list">${services.map((service) => `<span class="pill">${escapeHtml(titleCase(service))}</span>`).join('')}</div>
          <h3>Available activities</h3><div class="compact-list">${availableActions.map((action) => `<button class="context-item" data-action="select-skill" data-skill="${action.skill}"><strong>${action.icon} ${escapeHtml(action.name)}</strong><small>${escapeHtml(DATA.skills[action.skill].name)} · level ${action.level}</small></button>`).join('') || '<p class="muted">No known actions at your current levels.</p>'}</div>
          <div class="button-row">${selectedId !== c.location ? `<button class="button primary" data-action="travel-region" data-region="${selectedId}">Travel here</button>` : '<span class="pill gold">Current location</span>'}<button class="button" data-action="open-region-content" data-region="${selectedId}">Region details</button></div>
        </aside>
      </div>`;
  };

  proto.renderMapRoutes = function renderMapRoutes() {
    const character = this.engine.character;
    const selectedId = this.state.selectedRegion || character.location;
    let highlightedPath = character.activity?.kind === 'travel' ? character.activity.path : null;
    if (!highlightedPath && selectedId !== character.location) highlightedPath = this.engine.getTravelPlan(selectedId)?.path || null;
    const pathPairs = new Set();
    for (let index = 0; index < (highlightedPath?.length || 0) - 1; index += 1) pathPairs.add(routePairKey(highlightedPath[index], highlightedPath[index + 1]));
    const nextPair = highlightedPath?.length > 1 ? routePairKey(highlightedPath[0], highlightedPath[1]) : null;
    const lines = [];
    for (const route of DATA.routes || []) {
      const [fromId, toId] = Array.isArray(route) ? route : [route.from, route.to];
      const from = DATA.regions[fromId]; const to = DATA.regions[toId];
      if (!from || !to) continue;
      const x1 = from.x; const y1 = from.y; const x2 = to.x; const y2 = to.y;
      const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const key = routePairKey(fromId, toId);
      const active = pathPairs.has(key);
      lines.push(`<span class="map-route-line${active ? ' active' : ''}${key === nextPair ? ' next' : ''}" style="left:${x1}%;top:${y1}%;width:${length}%;transform:rotate(${angle}deg)" aria-hidden="true"></span>`);
    }
    return `<div class="map-route-layer">${lines.join('')}</div>`;
  };

  proto.applyMapTransform = function applyMapTransform() {
    const layer = document.querySelector('[data-map-transform]');
    const output = document.querySelector('[data-map-zoom]');
    if (!layer) return;
    const state = this.mapState();
    layer.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`;
    const viewport = document.querySelector('[data-map-viewport]');
    if (viewport) {
      viewport.dataset.zoomBucket = state.zoom < .55 ? 'low' : state.zoom < 1.1 ? 'medium' : 'high';
      viewport.setAttribute('aria-valuenow', String(Math.round(state.zoom * 100)));
    }
    if (output) output.textContent = `${Math.round(state.zoom * 100)}%`;
  };

  proto.setMapZoom = function setMapZoom(value, anchorX = null, anchorY = null) {
    const state = this.mapState();
    const old = state.zoom;
    const next = clampNumber(value, .2, 3.5);
    const viewport = document.querySelector('[data-map-viewport]');
    if (viewport && anchorX !== null && anchorY !== null) {
      state.panX = anchorX - (anchorX - state.panX) * next / old;
      state.panY = anchorY - (anchorY - state.panY) * next / old;
    }
    state.zoom = next;
    this.clampMapState(); this.applyMapTransform(); this.persistMapState();
  };
  proto.zoomMap = function zoomMap(factor, x, y) { this.setMapZoom(this.mapState().zoom * factor, x, y); };
  proto.pointerDistance = function pointerDistance() { const pts = [...this.mapPointers.values()]; return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); };
  proto.clampMapState = function clampMapState() {
    const viewport = document.querySelector('[data-map-viewport]'); const layer = document.querySelector('[data-map-transform]');
    if (!viewport || !layer) return;
    const state = this.mapState(); const vw = viewport.clientWidth; const vh = viewport.clientHeight; const lw = layer.offsetWidth * state.zoom; const lh = layer.offsetHeight * state.zoom;
    const margin = 70;
    state.panX = clampNumber(state.panX, Math.min(margin, vw - lw - margin), Math.max(-margin, (vw - lw) / 2 + margin));
    state.panY = clampNumber(state.panY, Math.min(margin, vh - lh - margin), Math.max(-margin, (vh - lh) / 2 + margin));
  };
  proto.fitMap = function fitMap() {
    const viewport = document.querySelector('[data-map-viewport]'); const layer = document.querySelector('[data-map-transform]');
    if (!viewport || !layer) return;
    const state = this.mapState();
    state.zoom = Math.min(viewport.clientWidth / Math.max(1, layer.offsetWidth), viewport.clientHeight / Math.max(1, layer.offsetHeight));
    state.zoom = clampNumber(state.zoom, .2, 1.2); state.panX = (viewport.clientWidth - layer.offsetWidth * state.zoom) / 2; state.panY = (viewport.clientHeight - layer.offsetHeight * state.zoom) / 2;
    this.applyMapTransform(); this.persistMapState();
  };
  proto.centerMapOnRegion = function centerMapOnRegion(regionId) {
    const viewport = document.querySelector('[data-map-viewport]'); const layer = document.querySelector('[data-map-transform]'); const region = DATA.regions[regionId];
    if (!viewport || !layer || !region) return;
    const state = this.mapState();
    state.panX = viewport.clientWidth / 2 - layer.offsetWidth * state.zoom * region.x / 100;
    state.panY = viewport.clientHeight / 2 - layer.offsetHeight * state.zoom * region.y / 100;
    this.clampMapState(); this.applyMapTransform(); this.persistMapState();
  };
  proto.persistMapState = function persistMapState() { const state = this.mapState(); const settings = this.engine.account.settings; settings.mapZoom = state.zoom; settings.mapPanX = state.panX; settings.mapPanY = state.panY; this.persistence.markDirty('map-state'); };

  /* ---------------------------- Quest UI ---------------------------- */

  proto.renderMemoryQuests = function renderMemoryQuests() {
    const c = this.engine.character;
    const tab = this.state.questTab || 'active';
    const tabs = ['active', 'available', 'completed'];
    const entries = Object.entries(DATA.quests).filter(([id, quest]) => {
      const state = c.quests[id];
      if (tab === 'active') return ['active', 'ready', 'decision'].includes(state.status);
      return state.status === tab;
    });
    return `${pageHeaderMemory('quests', 'Quest Journal', 'Investigations, dialogue, evidence, tactical choices, and permanent consequences are recorded here.', `<button class="button" data-action="open-search">Search Chronicle</button>`)}
      <div class="tabs">${tabs.map((id) => `<button class="tab ${tab === id ? 'active' : ''}" data-action="quest-tab" data-tab="${id}">${titleCase(id)}</button>`).join('')}</div>
      <div class="quest-list story-quest-list">${entries.map(([id, quest]) => quest.stages?.length ? this.storyQuestCard(id, quest, c.quests[id]) : this.questCard(id, quest, c.quests[id])).join('') || '<div class="empty-state">No quests in this section.</div>'}</div>`;
  };

  proto.storyQuestCard = function storyQuestCard(id, quest, state) {
    const stage = quest.stages[state.stageIndex] || quest.stages[0];
    const completed = stage.objectives.filter((objective) => state.completedObjectives[objective.id]).length;
    const status = state.status === 'decision' ? 'Decision required' : state.status === 'completed' ? quest.endings.find((ending) => ending.id === state.ending)?.title || 'Completed' : `${stage.title} · ${completed}/${stage.objectives.length}`;
    const recap = this.engine.character.story.recaps.find((entry) => entry.questId === id);
    return `<article class="quest-card flagship ${state.status}"><div class="quest-banner"><span class="quest-icon-large">${quest.icon}</span><div><p class="eyebrow">${escapeHtml(quest.category || 'Story quest')}</p><h2>${escapeHtml(quest.name)}</h2><p>${escapeHtml(quest.summary || quest.description)}</p></div><span class="pill gold">${escapeHtml(status)}</span></div>
      ${state.status === 'active' || state.status === 'decision' ? `<div class="quest-stage-preview"><strong>${escapeHtml(stage.title)}</strong><p>${escapeHtml(stage.journalText || stage.scene || '')}</p><div class="progress-track"><div class="progress-fill" style="--progress:${stage.objectives.length ? completed / stage.objectives.length : 0}"></div></div></div>` : ''}
      ${recap ? `<details class="recap"><summary>Previously…</summary><p>${escapeHtml(recap.text)}</p></details>` : ''}
      <div class="button-row">${state.status === 'available' ? `<button class="button primary" data-action="start-story-quest" data-id="${id}">Begin quest</button>` : state.status === 'completed' ? `<button class="button" data-action="open-story-quest" data-id="${id}">Review Chronicle</button>` : `<button class="button primary" data-action="open-story-quest" data-id="${id}">${state.status === 'decision' ? 'Make decision' : 'Continue quest'}</button>`}</div></article>`;
  };

  proto.openStoryQuest = function openStoryQuest(questId) {
    const quest = DATA.quests[questId]; const state = this.engine.getStoryQuestState(questId);
    if (!quest || !state) throw new Error('Story quest unavailable.');
    const stage = this.engine.getCurrentStoryStage(questId);
    if (state.status === 'completed') return this.openModal(`${quest.icon} ${quest.name}`, this.renderCompletedStoryQuest(quest, state), { wide: true });
    const objectives = stage.objectives.map((objective) => this.renderStoryObjective(questId, objective, state)).join('');
    const endings = state.status === 'decision' ? `<section class="story-endings"><h3>Choose what Eldoria remembers</h3><div class="choice-grid">${quest.endings.map((ending) => { const available = this.engine.getEndingAvailability(questId, ending.id); return `<article class="choice-card ${available.ok ? '' : 'locked'}"><strong>${escapeHtml(ending.label)}</strong><p>${escapeHtml(ending.description)}</p><small>${escapeHtml(rewardSummaryMemory(ending.rewards))}</small><button class="button primary" data-action="choose-story-ending" data-quest="${questId}" data-ending="${ending.id}" ${available.ok ? '' : 'disabled title="'+escapeHtml(available.reason)+'"'}>Choose this ending</button>${!available.ok ? `<small class="danger-text">${escapeHtml(available.reason)}</small>` : ''}</article>`; }).join('')}</div></section>` : '';
    const evidence = state.evidence.length ? `<section><h3>Evidence</h3><div class="evidence-grid">${state.evidence.map((id) => `<span class="evidence-chip">${escapeHtml(titleCase(id))}</span>`).join('')}</div></section>` : '';
    const campaign = state.campaign ? `<section><h3>Campaign state</h3><div class="stat-grid compact">${Object.entries(state.campaign).filter(([,v]) => typeof v === 'number').map(([key,value]) => statTileMemory(titleCase(key), Math.round(value))).join('')}</div></section>` : '';
    const body = `<article class="story-stage"><p class="eyebrow">Stage ${state.stageIndex + 1} of ${quest.stages.length}</p><h2>${escapeHtml(stage.title)}</h2><p class="story-scene">${escapeHtml(stage.scene || stage.journalText || '')}</p>${(stage.entryDialogue || []).map((line) => `<blockquote><strong>${escapeHtml(line.speaker)}</strong><p>${escapeHtml(line.text)}</p></blockquote>`).join('')}</article><div class="story-objectives">${objectives}</div>${campaign}${evidence}${endings}<details class="quest-journal-details"><summary>Quest journal (${state.journal.length})</summary><div class="timeline">${state.journal.map((entry) => `<div class="timeline-entry"><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.text)}</small></div></div>`).join('')}</div></details>`;
    this.openModal(`${quest.icon} ${quest.name}`, body, { wide: true });
  };

  proto.renderStoryObjective = function renderStoryObjective(questId, objective, state) {
    const done = state.completedObjectives[objective.id];
    const data = state.objectiveData[objective.id] || {};
    let control = '';
    if (!done) {
      if (objective.type === 'investigate') control = `<button class="button primary" data-action="open-story-investigation" data-quest="${questId}" data-objective="${objective.id}">Investigate</button>`;
      else if (objective.type === 'puzzle') control = `<button class="button primary" data-action="open-story-options" data-quest="${questId}" data-objective="${objective.id}">Solve</button>`;
      else if (['approach','choice'].includes(objective.type)) control = `<button class="button primary" data-action="open-story-options" data-quest="${questId}" data-objective="${objective.id}">Choose approach</button>`;
      else if (objective.type === 'command') control = `<button class="button primary" data-action="open-story-command" data-quest="${questId}" data-objective="${objective.id}">Assign personnel</button>`;
      else if (objective.type === 'combat') control = `<button class="button danger" data-action="story-objective" data-quest="${questId}" data-objective="${objective.id}">Enter encounter</button>`;
      else control = `<button class="button primary" data-action="story-objective" data-quest="${questId}" data-objective="${objective.id}">${objective.type === 'talk' ? 'Continue dialogue' : objective.type === 'inspect' ? 'Inspect' : 'Use available skill'}</button>`;
    }
    return `<article class="story-objective ${done ? 'complete' : ''}"><span class="objective-status">${done ? '✓' : objective.type === 'combat' ? '⚔' : '○'}</span><div><strong>${escapeHtml(objective.label)}</strong><p>${escapeHtml(objective.description)}</p>${data.method ? `<small>Method: ${escapeHtml(titleCase(data.method))}</small>` : ''}${data.optionId ? `<small>Choice: ${escapeHtml(titleCase(data.optionId))}</small>` : ''}</div><div>${control}</div></article>`;
  };

  proto.openStoryInvestigation = function openStoryInvestigation(questId, objectiveId) {
    const objective = this.engine.getStoryObjective(questId, objectiveId); const scene = DATA.investigationScenes[objective.sceneId]; const state = this.engine.getStoryQuestState(questId); const found = state.objectiveData[objectiveId]?.found || [];
    this.openModal(scene.title, `<p class="story-scene">${escapeHtml(scene.description)}</p><div class="evidence-grid detailed">${scene.evidence.map((evidence) => `<article class="evidence-card ${found.includes(evidence.id) ? 'found' : ''}"><strong>${escapeHtml(evidence.name)}</strong><p>${found.includes(evidence.id) ? escapeHtml(evidence.text) : 'Examine this part of the scene.'}</p><button class="button ${found.includes(evidence.id) ? '' : 'primary'}" data-action="story-evidence" data-quest="${questId}" data-objective="${objectiveId}" data-evidence="${evidence.id}" ${found.includes(evidence.id) ? 'disabled' : ''}>${found.includes(evidence.id) ? 'Recorded' : 'Inspect'}</button></article>`).join('')}</div><div class="modal-footer"><button class="button" data-action="open-story-quest" data-id="${questId}">Back to quest</button></div>`, { wide: true });
  };

  proto.openStoryOptions = function openStoryOptions(questId, objectiveId) {
    const objective = this.engine.getStoryObjective(questId, objectiveId);
    this.openModal(objective.label, `<p>${escapeHtml(objective.description)}</p><div class="choice-grid">${(objective.options || []).map((option) => { const checks = [option.skill ? {skill:option.skill,level:option.level}:null, option.item ? {item:option.item}:null, option.reputation ? {reputation:option.reputation}:null, option.requiresFlag ? {flag:option.requiresFlag}:null, option.requiresTag ? {tag:option.requiresTag}:null].filter(Boolean).map((req)=>this.engine.checkRequirement(req)); const failure=checks.find((r)=>!r.ok); return `<article class="choice-card ${failure ? 'locked' : ''}"><strong>${escapeHtml(option.label)}</strong>${option.detail ? `<p>${escapeHtml(option.detail)}</p>` : ''}${failure ? `<small class="danger-text">${escapeHtml(failure.reason)}</small>` : ''}<button class="button primary" data-action="story-option" data-quest="${questId}" data-objective="${objectiveId}" data-option="${option.id}" ${failure ? 'disabled' : ''}>Choose</button></article>`; }).join('')}</div>${objective.hint ? `<details><summary>Hint</summary><p>${escapeHtml(objective.hint)}</p></details>` : ''}`, { wide: true });
  };

  proto.openStoryCommand = function openStoryCommand(questId, objectiveId) {
    const objective = this.engine.getStoryObjective(questId, objectiveId); const campaign = this.engine.ensureQuestCampaign(questId); const points = objective.points ?? objective.personnel ?? campaign.availablePersonnel ?? 4;
    this.openModal(objective.label, `<p>${escapeHtml(objective.description)}</p><form id="story-command-form"><p class="pill gold">Available personnel: ${points}</p><div class="choice-grid">${objective.options.map((option) => `<label class="choice-card"><input type="checkbox" name="option" value="${option.id}" data-cost="${option.cost || 1}"><strong>${escapeHtml(option.label)}</strong><small>Cost ${option.cost || 1}</small></label>`).join('')}</div><div class="modal-footer"><button type="button" class="button" data-action="open-story-quest" data-id="${questId}">Cancel</button><button class="button primary">Confirm assignments</button></div></form>`, { wide: true });
    this.modalCard.querySelector('#story-command-form').addEventListener('submit', (event) => { event.preventDefault(); const ids = [...new FormData(event.currentTarget).getAll('option')]; this.engine.performStoryObjective(questId, objectiveId, { optionIds: ids }); this.openStoryQuest(questId); });
  };

  proto.renderCompletedStoryQuest = function renderCompletedStoryQuest(quest, state) {
    const ending = quest.endings.find((entry) => entry.id === state.ending);
    return `<article class="story-epilogue"><p class="eyebrow">Completed Chronicle</p><h2>${escapeHtml(ending?.title || 'Completed')}</h2><p>${escapeHtml(ending?.epilogue || '')}</p></article><section><h3>Evidence preserved</h3><div class="evidence-grid">${state.evidence.map((id) => `<span class="evidence-chip">${escapeHtml(titleCase(id))}</span>`).join('')}</div></section><section><h3>Journal</h3><div class="timeline">${state.journal.map((entry) => `<div class="timeline-entry"><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.text)}</small></div></div>`).join('')}</div></section>`;
  };

  /* --------------------------- Combat/dungeons -------------------------- */

  proto.renderMemoryCombat = function renderMemoryCombat() {
    const base = originalRenderCombat.call(this);
    const c = this.engine.character;
    const active = c.dungeons.activeRun;
    const local = Object.entries(DATA.dungeons).filter(([, dungeon]) => dungeon.region === c.location);
    const dungeonHtml = `<section class="dungeon-section"><div class="card-header"><div><h2>Branching dungeons</h2><p class="card-subtitle">Choose routes, configure supplies, discover lore, and stop safely between nodes.</p></div></div>${active ? this.renderActiveDungeon(active) : `<div class="action-grid">${local.map(([id,dungeon]) => `<article class="card card-pad"><div class="card-header"><div><h3>${dungeon.icon} ${escapeHtml(dungeon.name)}</h3><p class="card-subtitle">Recommended ${dungeon.recommended}</p></div><span class="pill">${c.dungeons.completed[id] || 0} clears</span></div><p>${escapeHtml(dungeon.description)}</p><small>Entry: ${escapeHtml(Object.entries(dungeon.entryCost || {}).map(([item,qty])=>`${qty} ${DATA.items[item]?.name || item}`).join(', ') || 'None')}</small><div class="button-row"><button class="button primary" data-action="start-dungeon" data-id="${id}" ${this.engine.isDungeonUnlocked(id) ? '' : 'disabled'}>Enter dungeon</button></div></article>`).join('') || '<div class="empty-state">No known dungeon entrance in this region.</div>'}</div>`}</section>`;
    return base + dungeonHtml;
  };

  proto.renderActiveDungeon = function renderActiveDungeon(run) {
    const dungeon = DATA.dungeons[run.dungeonId]; const node = this.engine.getActiveDungeonNode();
    return `<article class="card card-pad dungeon-active"><p class="eyebrow">Active dungeon run</p><h3>${dungeon.icon} ${escapeHtml(dungeon.name)}</h3><div class="dungeon-path">${run.history.map((entry) => `<span class="dungeon-node complete">${escapeHtml(DATA.dungeons[run.dungeonId].nodes.find((n)=>n.id===entry.nodeId)?.name || entry.nodeId)}</span>`).join('<span>→</span>')}<span class="dungeon-node current">${escapeHtml(node?.name || run.nodeId)}</span></div><p>${escapeHtml(node ? `${titleCase(node.type)} encounter.` : '')}</p>${node?.type === 'choice' || run.pendingChoice ? `<div class="choice-grid">${(node?.next || []).map((id) => { const next= dungeon.nodes.find((n)=>n.id===id); return `<button class="choice-card" data-action="choose-dungeon-path" data-id="${id}"><strong>${escapeHtml(next?.name || id)}</strong><small>${escapeHtml(titleCase(next?.type || 'path'))}</small></button>`; }).join('')}</div>` : `<button class="button primary" data-action="resolve-dungeon-node">${['combat','boss'].includes(node?.type) ? 'Begin encounter' : 'Resolve node'}</button>`}<button class="button danger" data-action="abandon-dungeon">Abandon run</button></article>`;
  };

  proto.playCombatFx = function playCombatFx(event, options = {}) {
    if (!event || this.state.view !== 'combat') return;
    const enemyLayer = document.querySelector('[data-combat-fx="enemy"]');
    const playerLayer = document.querySelector('[data-combat-fx="player"]');
    // Meaningful combat actions can schedule a structural render in the same
    // turn that emits their presentation event. Queue the effect until the
    // replacement combat DOM is ready so shield/heal/interrupt cues are not
    // created and immediately discarded. This also covers phase transitions
    // and slow devices where the effect layer has not been enhanced yet.
    if (!options.flushed && (this.renderQueued || !enemyLayer || !playerLayer)) {
      this.pendingCombatFx ||= [];
      if (!this.pendingCombatFx.some((queued) => queued.id && queued.id === event.id)) this.pendingCombatFx.push(event);
      if (!this.combatFxFlushQueued) {
        this.combatFxFlushQueued = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          this.combatFxFlushQueued = false;
          const pending = this.pendingCombatFx?.splice(0) || [];
          if (this.state.view !== 'combat') return;
          for (const queued of pending) this.playCombatFx(queued, { flushed: true });
        }));
      }
      return;
    }
    const enemySurface = enemyLayer?.closest('.combatant-card')?.querySelector('.combatant-surface');
    const playerSurface = playerLayer?.closest('.combatant-card')?.querySelector('.combatant-surface');
    const type = event.type || 'combat:round';

    if (type === 'combat:round') {
      restartAnimation(playerSurface, 'fx-attack');
      if (event.enemyDamage > 0) this.spawnCombatSplat(enemyLayer, `−${Math.round(event.enemyDamage)}`, event.result === 'critical' ? 'critical' : 'damage');
      else if (event.result === 'miss') this.spawnCombatSplat(enemyLayer, 'MISS', 'miss');
      if (event.playerDamage > 0) this.spawnCombatSplat(playerLayer, `−${Math.round(event.playerDamage)}`, 'hurt');
      else if (event.playerResult === 'miss') this.spawnCombatCue(playerLayer, 'DODGE', 'evade');
      if (event.playerHealing > 0) this.spawnCombatSplat(playerLayer, `+${Math.round(event.playerHealing)}`, 'healing');
      for (const status of event.appliedEnemyStatuses || []) this.spawnCombatCue(enemyLayer, titleCase(status), `status status-${status}`);
      for (const status of event.appliedPlayerStatuses || []) this.spawnCombatCue(playerLayer, titleCase(status), `status status-${status}`);
      if (event.telegraphStarted) this.spawnCombatCue(enemyLayer, `⚠ ${event.telegraphStarted}`, 'telegraph');
      if (event.specialResolved) this.spawnCombatCue(playerLayer, event.specialResolved, 'special');
      if (event.enemyDamage > 0) restartAnimation(enemySurface, event.result === 'critical' ? 'fx-critical' : 'fx-recoil');
      if (event.playerDamage > 0) restartAnimation(playerSurface, 'fx-recoil');
      if (event.enemyDefeated) { this.spawnCombatCue(enemyLayer, 'DEFEATED', 'defeat'); restartAnimation(enemySurface, 'fx-defeat'); }
      if (event.playerDefeated) { this.spawnCombatCue(playerLayer, 'FALLEN', 'defeat'); restartAnimation(playerSurface, 'fx-defeat'); }
      const arena = this.mainView.querySelector('.combat-arena');
      if (arena && event.playerDamage && this.engine.account.settings.screenShake && !this.engine.account.settings.reducedMotion) restartAnimation(arena, 'fx-shake');
      return;
    }

    if (type === 'combat:healing') { this.spawnCombatSplat(playerLayer, `+${Math.max(1, Math.round(event.healing || 0))}`, 'healing'); restartAnimation(playerSurface, 'fx-heal'); return; }
    if (type === 'combat:cleanse') { this.spawnCombatCue(playerLayer, event.removedStatuses?.length ? `CLEANSE · ${event.removedStatuses.map(titleCase).join(', ')}` : 'CLEANSE', 'cleanse'); restartAnimation(playerSurface, 'fx-heal'); return; }
    if (type === 'combat:interrupt') { this.spawnCombatCue(enemyLayer, event.interrupted ? 'INTERRUPTED' : 'INTERRUPT FAILED', event.interrupted ? 'interrupt' : 'miss'); restartAnimation(enemySurface, 'fx-interrupt'); return; }
    if (type === 'combat:shield') { this.spawnCombatCue(playerLayer, event.label || 'WARD', 'shield'); restartAnimation(playerSurface, 'fx-shield'); return; }
    if (type === 'combat:ability') { this.spawnCombatCue(playerLayer, event.label || 'ABILITY', 'ability'); restartAnimation(playerSurface, 'fx-ability'); return; }
    if (type === 'combat:rare-loot') { this.spawnCombatCue(playerLayer, event.label || 'RARE LOOT', 'rare-loot'); return; }
  };
  proto.spawnCombatSplat = function spawnCombatSplat(layer, text, kind) {
    if (!layer || this.engine.account.settings.damageSplats === false) return;
    const node=document.createElement('span'); node.className=`combat-splat ${kind}`; node.textContent=text; node.style.setProperty('--drift', `${Math.round((Math.random()-.5)*36)}px`); layer.append(node); node.addEventListener('animationend',()=>node.remove(),{once:true});
  };
  proto.spawnCombatCue = function spawnCombatCue(layer, text, kind='status') {
    if (!layer) return;
    const node=document.createElement('span'); node.className=`combat-cue ${kind}`; node.textContent=text; layer.append(node); node.addEventListener('animationend',()=>node.remove(),{once:true});
  };

  /* --------------------------- Town systems --------------------------- */

  proto.renderMemoryTownSystem = function renderMemoryTownSystem(tab) {
    const tabs = ['farming','buildings','projects','companions','research','trade','sailing','market','husbandry','ritualism','diplomacy'];
    let body = '';
    if (tab === 'husbandry') body = this.renderHusbandry();
    else if (tab === 'ritualism') body = this.renderRitualism();
    else body = this.renderDiplomacy();
    return `${pageHeaderMemory('town', 'Town & Estate', 'Manage long-running systems, infrastructure, animals, rites, and political relationships.')}
      <div class="tabs horizontal-scroll">${tabs.map((id)=>`<button class="tab ${tab===id?'active':''}" data-action="town-tab" data-tab="${id}">${titleCase(id)}</button>`).join('')}</div>${body}`;
  };

  proto.renderHusbandry = function renderHusbandry() {
    const c=this.engine.character; const breeding=c.husbandry.breeding;
    return `<section><div class="card-header"><div><h2>Animal Husbandry</h2><p class="card-subtitle">Feed, breed, heal, and collect products from animals that continue progressing while you are away.</p></div><span class="pill">Level ${this.engine.getSkillLevel('animal_husbandry')}</span></div><div class="action-grid">${c.husbandry.pens.map((pen)=>{const species=DATA.animals[pen.speciesId];const pending=Object.values(pen.pendingProducts||{}).reduce((a,b)=>a+b,0);return `<article class="card card-pad"><h3>${species?.icon || '▢'} ${escapeHtml(species?.name || `Empty Pen ${pen.slot+1}`)}</h3>${species?`<div class="resource-list"><div class="resource-row"><span>Animals</span><strong>${pen.count}</strong></div><div class="resource-row"><span>Feed</span><strong>${Math.floor(pen.feed)}</strong></div><div class="resource-row"><span>Health</span><strong>${Math.round(pen.health)}%</strong></div><div class="resource-row"><span>Happiness</span><strong>${Math.round(pen.happiness)}%</strong></div><div class="resource-row"><span>Products waiting</span><strong>${pending}</strong></div></div><div class="button-row"><button class="button" data-action="feed-animals" data-pen="${pen.id}">Feed</button><button class="button" data-action="collect-animal-products" data-pen="${pen.id}" ${pending?'':'disabled'}>Collect</button><button class="button primary" data-action="breed-animals" data-pen="${pen.id}" ${pen.count>=2&&!breeding?'':'disabled'}>Breed</button></div>`:`<div class="choice-grid">${Object.entries(DATA.animals).map(([id,a])=>`<button class="choice-card" data-action="stock-animal" data-pen="${pen.id}" data-id="${id}" ${this.engine.getSkillLevel('animal_husbandry')>=a.level?'':'disabled'}><strong>${a.icon} ${escapeHtml(a.name)}</strong><small>Level ${a.level}</small></button>`).join('')}</div>`}</article>`}).join('')}</div>${breeding?`<article class="card card-pad"><h3>Breeding cycle</h3><p>${escapeHtml(DATA.animals[breeding.speciesId]?.name || '')} · <span data-countdown="${breeding.endsAt}"></span></p></article>`:''}</section>`;
  };

  proto.renderRitualism = function renderRitualism() {
    const c=this.engine.character; return `<section><div class="card-header"><div><h2>Ritualism</h2><p class="card-subtitle">Perform bounded rites that alter local conditions without automating irreversible story choices.</p></div><span class="pill">Level ${this.engine.getSkillLevel('ritualism')}</span></div><div class="action-grid">${Object.entries(DATA.rituals).map(([id,ritual])=>{const active=c.ritualism.active.find((entry)=>entry.ritualId===id);const locked=this.engine.getSkillLevel('ritualism')<ritual.level||c.location!==ritual.region;return `<article class="card card-pad ${active?'active':''}"><h3>${ritual.icon} ${escapeHtml(ritual.name)}</h3><p>${escapeHtml(ritual.description)}</p><small>${escapeHtml(this.engine.getRegionDefinition(ritual.region)?.name||ritual.region)} · level ${ritual.level} · ${formatDuration(ritual.durationMs,true)}</small><div class="tag-list">${Object.entries(ritual.effects).map(([k,v])=>`<span class="pill">${escapeHtml(titleCase(k))} ${v>0?'+':''}${v}%</span>`).join('')}</div>${active?`<p class="success-text">Active for <span data-countdown="${active.expiresAt}"></span></p>`:`<button class="button primary" data-action="perform-ritual" data-id="${id}" ${locked?'disabled':''}>Perform ritual</button>`}</article>`}).join('')}</div></section>`;
  };

  proto.renderDiplomacy = function renderDiplomacy() {
    const c=this.engine.character; return `<section><div class="card-header"><div><h2>Diplomacy</h2><p class="card-subtitle">Resolve disputes and establish persistent treaties as a real noncombat progression route.</p></div><span class="pill">Level ${this.engine.getSkillLevel('diplomacy')}</span></div><div class="action-grid">${Object.entries(DATA.diplomacyActions).map(([id,action])=>{const signed=c.diplomacy.treaties.some((t)=>t.actionId===id);return `<article class="card card-pad ${signed?'active':''}"><h3>${action.icon} ${escapeHtml(action.name)}</h3><p>${escapeHtml(action.description)}</p><div class="tag-list">${action.factions.map((f)=>`<span class="pill">${escapeHtml(DATA.factions[f]?.name||f)}</span>`).join('')}</div>${signed?'<span class="pill success">Treaty active</span>':`<button class="button primary" data-action="perform-diplomacy" data-id="${id}" ${this.engine.getSkillLevel('diplomacy')>=action.level?'':'disabled'}>Negotiate treaty</button>`}</article>`}).join('')}</div></section>`;
  };

  /* ----------------------------- Settings ----------------------------- */

  proto.renderMemorySettings = function renderMemorySettings() {
    const base=originalRenderSettings.call(this);const s=this.engine.account.settings;
    return base+`<section class="settings-section card card-pad"><h2>Animation & audio</h2><div class="setting-list"><label class="setting-row"><span><strong>Animation quality</strong><small>Simulation remains deterministic; this changes presentation only.</small></span><select class="select" data-setting="animationQuality"><option value="full" ${s.animationQuality==='full'?'selected':''}>Full</option><option value="reduced" ${s.animationQuality==='reduced'?'selected':''}>Reduced</option><option value="minimal" ${s.animationQuality==='minimal'?'selected':''}>Minimal</option></select></label>${settingToggleMemory('damageSplats','Damage splats','Show floating combat results.',s.damageSplats)}${settingToggleMemory('screenShake','Screen shake','Use brief impact shake during combat.',s.screenShake)}${settingToggleMemory('backgroundAnimations','Background animation','Allow subtle ambient motion.',s.backgroundAnimations)}${settingToggleMemory('sound','Sound','Enable local generated audio cues.',s.sound)}${settingToggleMemory('combatSounds','Combat sounds','Play attacks, hits, misses, and victory cues.',s.combatSounds)}${settingToggleMemory('interfaceSounds','Interface sounds','Play save and interface feedback.',s.interfaceSounds)}<label class="setting-row"><span><strong>Master volume</strong><small>${Math.round((s.masterVolume??.75)*100)}%</small></span><input type="range" min="0" max="1" step=".05" value="${s.masterVolume??.75}" data-setting="masterVolume"></label><label class="setting-row"><span><strong>Effects volume</strong><small>${Math.round((s.effectsVolume??.65)*100)}%</small></span><input type="range" min="0" max="1" step=".05" value="${s.effectsVolume??.65}" data-setting="effectsVolume"></label></div></section><section class="settings-section card card-pad"><h2>Recovery snapshots</h2><p>Snapshots are created before migrations and app updates. They remain local to this browser.</p><div class="button-row"><button class="button" data-action="create-recovery-snapshot">Create snapshot</button><button class="button" data-action="open-recovery-snapshots">Manage snapshots</button></div><small>App ${APP_VERSION} · account schema ${this.engine.account.schemaVersion} · character schema ${this.engine.character?.schemaVersion||'—'}</small></section>`;
  };

  /* ------------------------ Search and item detail ------------------------ */

  proto.openGlobalSearch = function openGlobalSearch() {
    this.openModal('Search Eldoria', `<label class="form-field"><span>Search items, skills, actions, quests, regions, enemies, NPCs, factions, lore, and achievements</span><input class="input" data-global-search autofocus placeholder="Type to search…"></label><div data-global-search-results class="search-results"><div class="empty-state">Start typing to search the Chronicle.</div></div>`, { wide:true });
  };
  proto.updateGlobalSearchResults = function updateGlobalSearchResults(query) {
    const host=this.modalCard.querySelector('[data-global-search-results]');if(!host)return;const q=String(query||'').trim().toLowerCase();if(q.length<2){host.innerHTML='<div class="empty-state">Enter at least two characters.</div>';return;}
    const rows=[];const add=(type,id,name,description,icon,view,action='search-navigate')=>{const hay=`${name} ${description} ${id}`.toLowerCase();if(hay.includes(q))rows.push({type,id,name,description,icon,view,action});};
    for(const [id,v] of Object.entries(DATA.items))add('Item',id,v.name,v.description||v.lore||'',v.icon,'bank','search-item');
    for(const [id,v] of Object.entries(DATA.skills))add('Skill',id,v.name,v.description||'',v.icon,'skills','search-skill');
    for(const [id,v] of Object.entries(DATA.actions))add('Action',id,v.name,DATA.skills[v.skill]?.name||'',v.icon,'skills','search-action');
    for(const [id,v] of Object.entries(DATA.quests))add('Quest',id,v.name,v.summary||v.description||'',v.icon,'quests','search-quest');
    for(const [id,v] of Object.entries(DATA.regions))add('Region',id,this.engine.getRegionDefinition(id)?.name||v.name,v.description||'',v.icon,'map','search-region');
    for(const [id,v] of Object.entries(DATA.enemies))add('Enemy',id,v.name,DATA.regions[v.region]?.name||'',v.icon,'combat','search-enemy');
    for(const [id,v] of Object.entries(DATA.npcs||{}))add('NPC',id,v.name,v.description||v.role||'',v.icon,'quests','search-npc');
    for(const [id,v] of Object.entries(DATA.factions))add('Faction',id,v.name,v.description||'',v.icon,'character','search-faction');
    host.innerHTML=rows.slice(0,40).map((r)=>`<button class="search-result" data-action="${r.action}" data-id="${r.id}"><span>${r.icon||'•'}</span><span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.type)} · ${escapeHtml(r.description).slice(0,160)}</small></span></button>`).join('')||'<div class="empty-state">No matching Chronicle entries.</div>';
    this.enhanceContentIcons();
  };

  proto.inspectStack = function inspectStackMemory(itemId, location) {
    const item=DATA.items[itemId];const qty=location==='bank'?this.engine.stackQty(itemId,'bank'):this.engine.stackQty(itemId,'inventory');const prefs=this.engine.character.itemPreferences;const sources=Object.values(DATA.actions).filter((a)=>a.outputs?.[itemId]).map((a)=>a.name);const recipes=Object.values(DATA.actions).filter((a)=>a.inputs?.[itemId]).map((a)=>a.name);const markets=Object.keys(DATA.regions).map((region)=>({region,price:this.engine.getSellPrice(itemId,region)})).sort((a,b)=>b.price-a.price).slice(0,4);
    this.openModal(`${item.icon} ${item.name}`, `<div class="item-inspection"><section><p class="eyebrow">${escapeHtml(titleCase(item.rarity))} · ${escapeHtml((item.tags||[]).map(titleCase).join(' · '))}</p><p>${escapeHtml(item.description||'No description recorded.')}</p>${item.lore?`<blockquote>${escapeHtml(item.lore)}</blockquote>`:''}<div class="resource-list"><div class="resource-row"><span>Inventory</span><strong>${formatNumber(this.engine.stackQty(itemId,'inventory'))}</strong></div><div class="resource-row"><span>Bank</span><strong>${formatNumber(this.engine.stackQty(itemId,'bank'))}</strong></div><div class="resource-row"><span>Base value</span><strong>${formatNumber(item.value)}c</strong></div><div class="resource-row"><span>Reserved</span><strong>${formatNumber(prefs.reserved[itemId]||0)}</strong></div></div></section><section><h3>Known sources</h3><p>${escapeHtml(sources.join(', ')||'Not yet discovered.')}</p><h3>Used by</h3><p>${escapeHtml(recipes.join(', ')||'No known recipes.')}</p><h3>Best known markets</h3><div class="resource-list">${markets.map((m)=>`<div class="resource-row"><span>${escapeHtml(this.engine.getRegionDefinition(m.region)?.name||m.region)}</span><strong>${formatNumber(m.price)}c</strong></div>`).join('')}</div></section></div><label class="form-field"><span>Personal note</span><textarea class="textarea" data-item-note="${itemId}" maxlength="500">${escapeHtml(prefs.notes[itemId]||'')}</textarea></label><div class="modal-footer"><button class="button" data-action="toggle-item-favorite" data-id="${itemId}">${prefs.favorites.includes(itemId)?'Unfavorite':'Favorite'}</button><button class="button" data-action="set-item-reserve" data-id="${itemId}">Set reserve</button><button class="button" data-action="toggle-protected-stack" data-id="${itemId}">${prefs.protectedStacks.includes(itemId)?'Unprotect':'Protect'} stack</button>${location==='inventory'?`<button class="button" data-action="deposit-stack" data-id="${itemId}">Deposit all</button>`:`<button class="button primary" data-action="withdraw-stack" data-id="${itemId}">Withdraw all</button>`}<button class="button" data-action="close-modal">Close</button></div>`,{wide:true});
  };

  proto.inspectInstance = function inspectInstanceMemory(uid) { originalInspectInstance.call(this,uid); const body=this.modalCard.querySelector('.modal-body'); if(!body)return; const found=this.engine.findInstance(uid);const item=DATA.items[found.instance.itemId];const slot=item.equipSlot;let comparison='';if(slot){const equippedUid=this.engine.character.equipment[slot];const equipped=equippedUid?this.engine.findInstance(equippedUid):null;if(equipped&&equipped.instance.uid!==uid){const other=DATA.items[equipped.instance.itemId];comparison=`<section class="comparison-panel"><h3>Compared with equipped ${escapeHtml(other.name)}</h3>${compareStats(item.stats||{},other.stats||{})}</section>`;}}body.insertAdjacentHTML('beforeend',comparison+`<section><h3>Description</h3><p>${escapeHtml(item.description||'No description recorded.')}</p>${item.lore?`<blockquote>${escapeHtml(item.lore)}</blockquote>`:''}</section>`); };

  /* ------------------------ Advanced activity planner ------------------------ */

  proto.openActivityPlanner = function openActivityPlannerMemory() {
    const character = this.engine.character;
    const localActions = Object.values(DATA.actions)
      .filter((action) => action.regions?.includes(character.location) && this.engine.getSkillLevel(action.skill) >= action.level)
      .sort((a, b) => DATA.skills[a.skill].name.localeCompare(DATA.skills[b.skill].name) || a.level - b.level || a.name.localeCompare(b.name));
    if (!localActions.length) return originalOpenActivityPlanner.call(this);

    const active = character.planner?.activePlan || null;
    const pending = character.planner?.pendingPostActions || null;
    const initialActionId = active?.actionId || (character.activity?.kind === 'skill' ? character.activity.actionId : null) || localActions[0].id;
    const initialAction = DATA.actions[initialActionId] || localActions[0];
    const conditions = active?.conditions || {};
    const bankRegions = character.discoveredRegions
      .filter((regionId) => [...(DATA.regions[regionId]?.services || []), ...(character.world?.addedServices?.[regionId] || [])].includes('bank'))
      .sort((a, b) => (this.engine.getRegionDefinition(a)?.name || a).localeCompare(this.engine.getRegionDefinition(b)?.name || b));
    const relevantStopItems = [...new Set(localActions.flatMap((action) => [
      ...Object.keys(action.outputs || {}),
      ...(action.rare || []).map((entry) => entry.item),
    ]))].filter((itemId) => DATA.items[itemId]);
    const history = (character.planner?.history || []).slice(0, 6);

    const activeSummary = active ? `<article class="card card-pad planner-active-card">
      <div class="card-header"><div><p class="eyebrow">Active plan</p><h3 class="card-title">${escapeHtml(DATA.actions[active.actionId]?.name || active.actionId)}</h3></div><span class="pill gold">Running</span></div>
      <p class="card-subtitle">${escapeHtml(active.estimate?.likelyStop || 'Until a configured condition is reached.')}</p>
      <div class="forecast-grid planner-compact">
        <div><small>Started</small><strong>${new Date(active.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
        <div><small>Target actions</small><strong>${formatNumber(active.conditions?.actionCount || '∞')}</strong></div>
        <div><small>Rare-drop stop</small><strong>${active.conditions?.stopOnRareDrop ? 'On' : 'Off'}</strong></div>
        <div><small>Post action</small><strong>${active.conditions?.returnToTown ? 'Return' : active.conditions?.depositOutputs ? 'Deposit' : active.nextPlan ? 'Handoff' : 'None'}</strong></div>
      </div>
      <div class="button-row"><button class="button danger" data-action="cancel-activity-plan">Cancel active plan</button></div>
    </article>` : '';

    const pendingSummary = pending ? `<article class="card card-pad planner-post-card"><p class="eyebrow">Post-plan sequence</p><h3 class="card-title">Finishing plan logistics</h3><p class="card-subtitle">${pending.returnToTown ? `Returning to ${escapeHtml(this.engine.getRegionDefinition(pending.returnRegion)?.name || 'a bank settlement')}.` : pending.depositOutputs ? 'Depositing produced outputs.' : 'Starting the linked activity.'}</p></article>` : '';

    this.openModal('Activity planner', `${activeSummary}${pendingSummary}
      <div class="planner-layout">
        <form id="advanced-planner-form" class="card card-pad planner-form">
          <div class="card-header"><div><h3 class="card-title">Build a focused plan</h3><p class="card-subtitle">Set any combination of targets and safety reserves. Empty numeric fields are ignored.</p></div></div>
          <label class="form-field"><span>Activity</span><select class="select" name="actionId">${localActions.map((action) => `<option value="${action.id}" ${action.id === initialAction.id ? 'selected' : ''}>${escapeHtml(DATA.skills[action.skill].name)} · ${escapeHtml(action.name)}</option>`).join('')}</select></label>
          <div class="form-grid planner-target-grid">
            <label class="form-field"><span>Action completions</span><input class="input" type="number" name="actionCount" min="0" max="1000000" value="${Number(conditions.actionCount || 0) || ''}" placeholder="No limit"></label>
            <label class="form-field"><span>Duration in minutes</span><input class="input" type="number" name="durationMinutes" min="0" max="10080" step="1" value="${conditions.durationMs ? Math.round(conditions.durationMs / 60000) : ''}" placeholder="No limit"></label>
            <label class="form-field"><span>Stop at skill level</span><input class="input" type="number" name="targetSkillLevel" min="0" max="120" value="${Number(conditions.targetSkillLevel || 0) || ''}" placeholder="No target"></label>
            <label class="form-field"><span>Stop at action mastery</span><input class="input" type="number" name="targetMastery" min="0" max="120" value="${Number(conditions.targetMastery || 0) || ''}" placeholder="No target"></label>
            <label class="form-field"><span>Keep free inventory slots</span><input class="input" type="number" name="freeSlots" min="0" max="100" value="${Number(conditions.freeSlots || 0) || ''}" placeholder="0"></label>
            <label class="form-field"><span>Keep this much food</span><input class="input" type="number" name="foodReserve" min="0" max="100000" value="${Number(conditions.foodReserve || 0) || ''}" placeholder="0"></label>
          </div>
          <label class="form-field"><span>Stop after obtaining an item</span><select class="select" name="stopOnItem"><option value="">Do not stop on a specific item</option>${relevantStopItems.map((itemId) => `<option value="${itemId}" ${conditions.stopOnItem === itemId ? 'selected' : ''}>${escapeHtml(DATA.items[itemId].name)}</option>`).join('')}</select></label>
          <fieldset class="planner-fieldset"><legend>Input reserves for this plan</legend><div data-planner-input-reserves>${plannerInputReserveFields(initialAction, conditions.inputReserves || {})}</div><p class="card-subtitle">The planner will not consume an ingredient below its configured floor. Global protected reserves still apply.</p></fieldset>
          <fieldset class="planner-fieldset"><legend>Stop and post-plan rules</legend>
            ${plannerToggle('stopOnRareDrop', 'Stop on the first rare drop', Boolean(conditions.stopOnRareDrop))}
            ${plannerToggle('depositOutputs', 'Deposit only the outputs produced by this plan', Boolean(conditions.depositOutputs))}
            ${plannerToggle('returnToTown', 'Return to a bank settlement when the plan stops', Boolean(conditions.returnToTown))}
          </fieldset>
          <label class="form-field"><span>Preferred return settlement</span><select class="select" name="returnRegion"><option value="">Nearest discovered bank</option>${bankRegions.map((regionId) => `<option value="${regionId}" ${conditions.returnRegion === regionId ? 'selected' : ''}>${escapeHtml(this.engine.getRegionDefinition(regionId)?.name || regionId)}</option>`).join('')}</select></label>
          <fieldset class="planner-fieldset"><legend>Optional linked activity</legend><div class="form-grid"><label class="form-field"><span>Next activity</span><select class="select" name="nextAction"><option value="">No linked activity</option>${localActions.map((action) => `<option value="${action.id}">${escapeHtml(DATA.skills[action.skill].name)} · ${escapeHtml(action.name)}</option>`).join('')}</select></label><label class="form-field"><span>Next action completions</span><input class="input" type="number" name="nextActionCount" min="0" max="1000000" value="" placeholder="Until stopped"></label></div></fieldset>
          <div class="modal-footer"><button type="button" class="button" data-action="close-modal">Close</button><button class="button primary" type="submit" ${active ? 'disabled title="Cancel the active plan before starting another."' : ''}>Start plan</button></div>
        </form>
        <aside class="planner-side">
          <article class="card card-pad" data-planner-estimate>${renderPlannerEstimate(this.engine.estimateActivityPlan(initialAction.id, conditions))}</article>
          <article class="card card-pad"><h3 class="card-title">Recent plans</h3><div class="timeline planner-history">${history.map((plan) => `<div class="timeline-entry"><div><strong>${escapeHtml(DATA.actions[plan.actionId]?.name || plan.actionId)}</strong><small>${escapeHtml(plan.stopReason || 'Completed')} · ${plan.completedAt ? new Date(plan.completedAt).toLocaleString() : 'In progress'}</small></div></div>`).join('') || '<div class="empty-state">No completed plans yet.</div>'}</div></article>
        </aside>
      </div>`, { wide: true });

    const form = this.modalCard.querySelector('#advanced-planner-form');
    if (!form) return;
    const reserveHost = form.querySelector('[data-planner-input-reserves]');
    const estimateHost = this.modalCard.querySelector('[data-planner-estimate]');
    const readConditions = () => {
      const data = new FormData(form);
      const output = {};
      const numberField = (name) => { const value = Number(data.get(name)); if (Number.isFinite(value) && value > 0) output[name] = value; };
      numberField('actionCount'); numberField('targetSkillLevel'); numberField('targetMastery'); numberField('freeSlots'); numberField('foodReserve');
      const minutes = Number(data.get('durationMinutes')); if (Number.isFinite(minutes) && minutes > 0) output.durationMs = minutes * 60000;
      const stopOnItem = String(data.get('stopOnItem') || ''); if (stopOnItem) output.stopOnItem = stopOnItem;
      output.stopOnRareDrop = data.get('stopOnRareDrop') === 'on';
      output.depositOutputs = data.get('depositOutputs') === 'on';
      output.returnToTown = data.get('returnToTown') === 'on';
      const returnRegion = String(data.get('returnRegion') || ''); if (returnRegion) output.returnRegion = returnRegion;
      const inputReserves = {};
      for (const input of form.querySelectorAll('[data-planner-reserve-item]')) {
        const value = Number(input.value); if (Number.isFinite(value) && value > 0) inputReserves[input.dataset.plannerReserveItem] = Math.floor(value);
      }
      if (Object.keys(inputReserves).length) output.inputReserves = inputReserves;
      return output;
    };
    const updateEstimate = ({ rebuildReserves = false } = {}) => {
      const actionId = form.elements.actionId.value;
      const action = DATA.actions[actionId];
      if (rebuildReserves && reserveHost) reserveHost.innerHTML = plannerInputReserveFields(action, {});
      try { if (estimateHost) estimateHost.innerHTML = renderPlannerEstimate(this.engine.estimateActivityPlan(actionId, readConditions())); }
      catch (error) { if (estimateHost) estimateHost.innerHTML = `<div class="empty-state danger-text">${escapeHtml(error.message)}</div>`; }
    };
    form.elements.actionId.addEventListener('change', () => updateEstimate({ rebuildReserves: true }));
    form.addEventListener('input', () => updateEstimate());
    form.addEventListener('change', () => updateEstimate());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const actionId = form.elements.actionId.value;
      const nextActionId = form.elements.nextAction.value;
      const nextCount = Number(form.elements.nextActionCount.value);
      const nextPlan = nextActionId ? { actionId: nextActionId, conditions: nextCount > 0 ? { actionCount: Math.floor(nextCount) } : {} } : null;
      this.engine.startActivityPlan(actionId, readConditions(), nextPlan);
      this.closeModal();
    });
  };

  /* --------------------------- Modal behavior --------------------------- */

  proto.openModal = function openModalMemory(title, body, options={}) { this.previouslyFocused=document.activeElement;originalOpenModal.call(this,title,body,options); };
  proto.closeModal = function closeModalMemory() { originalCloseModal.call(this); if(this.previouslyFocused?.isConnected)this.previouslyFocused.focus({preventScroll:true});this.previouslyFocused=null; };
  proto.trapModalFocus = function trapModalFocus(event) { const focusable=[...this.modalCard.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();} };

  /* -------------------------- Action dispatcher -------------------------- */

  proto.handleAction = async function handleMemoryAction(action, target) {
    const e=this.engine;
    switch(action){
      case 'open-search': return this.openGlobalSearch();
      case 'cancel-activity-plan': e.stopActivity('Activity plan cancelled by player.'); return this.openActivityPlanner();
      case 'select-region': this.state.selectedRegion=target.dataset.region;this.renderView(true);return requestAnimationFrame(()=>this.centerMapOnRegion(target.dataset.region));
      case 'map-zoom-in': return this.zoomMap(1.2);
      case 'map-zoom-out': return this.zoomMap(.83);
      case 'map-fit': return this.fitMap();
      case 'map-center': return this.centerMapOnRegion(e.character.location);
      case 'map-center-selected': return this.centerMapOnRegion(this.state.selectedRegion || e.character.location);
      case 'start-story-quest': e.startStoryQuest(target.dataset.id); return this.openStoryQuest(target.dataset.id);
      case 'open-story-quest': return this.openStoryQuest(target.dataset.id);
      case 'story-objective': { const r=e.performStoryObjective(target.dataset.quest,target.dataset.objective,{}); if(!r.startedCombat)this.openStoryQuest(target.dataset.quest);else this.closeModal(); return; }
      case 'open-story-investigation': return this.openStoryInvestigation(target.dataset.quest,target.dataset.objective);
      case 'story-evidence': e.performStoryObjective(target.dataset.quest,target.dataset.objective,{evidenceId:target.dataset.evidence}); return this.openStoryInvestigation(target.dataset.quest,target.dataset.objective);
      case 'open-story-options': return this.openStoryOptions(target.dataset.quest,target.dataset.objective);
      case 'story-option': { const objective=e.getStoryObjective(target.dataset.quest,target.dataset.objective);e.performStoryObjective(target.dataset.quest,target.dataset.objective,{optionId:target.dataset.option}); if(objective.type==='puzzle'&&!e.getStoryQuestState(target.dataset.quest).completedObjectives[objective.id]) return this.openStoryOptions(target.dataset.quest,target.dataset.objective); return this.openStoryQuest(target.dataset.quest); }
      case 'open-story-command': return this.openStoryCommand(target.dataset.quest,target.dataset.objective);
      case 'choose-story-ending': { const result=e.chooseStoryEnding(target.dataset.quest,target.dataset.ending);if(result?.startedCombat){this.closeModal();this.state.view='combat';this.renderAll();}else this.openStoryQuest(target.dataset.quest);return; }
      case 'start-dungeon': e.startDungeon(target.dataset.id); return this.renderAll();
      case 'choose-dungeon-path': e.chooseDungeonPath(target.dataset.id); return this.renderAll();
      case 'resolve-dungeon-node': e.resolveDungeonNode(); return this.renderAll();
      case 'abandon-dungeon': e.abandonDungeon(); return this.renderAll();
      case 'stock-animal': e.stockAnimalPen(target.dataset.pen,target.dataset.id,2); return;
      case 'feed-animals': return this.openQuantityDialog('Feed animals','animal_feed',10,(qty)=>e.feedAnimalPen(target.dataset.pen,qty),{max:e.totalOwned('animal_feed')});
      case 'collect-animal-products': e.collectAnimalProducts(target.dataset.pen); return;
      case 'breed-animals': e.startAnimalBreeding(target.dataset.pen); return;
      case 'perform-ritual': e.performRitual(target.dataset.id); return;
      case 'perform-diplomacy': e.performDiplomacyAction(target.dataset.id); return;
      case 'toggle-item-favorite': e.toggleItemFavorite(target.dataset.id); return this.inspectStack(target.dataset.id,e.stackQty(target.dataset.id,'inventory')?'inventory':'bank');
      case 'set-item-reserve': return this.openQuantityDialog('Reserve item',target.dataset.id,e.character.itemPreferences.reserved[target.dataset.id]||1,(qty)=>{e.setItemReserve(target.dataset.id,qty);this.inspectStack(target.dataset.id,e.stackQty(target.dataset.id,'inventory')?'inventory':'bank');},{max:e.totalOwned(target.dataset.id)});
      case 'toggle-protected-stack': e.toggleProtectedStack(target.dataset.id); return this.inspectStack(target.dataset.id,e.stackQty(target.dataset.id,'inventory')?'inventory':'bank');
      case 'search-item': this.closeModal();this.state.view='bank';this.renderAll();return this.inspectStack(target.dataset.id,e.stackQty(target.dataset.id,'inventory')?'inventory':'bank');
      case 'search-skill': this.closeModal();this.state.view='skills';this.state.selectedSkill=target.dataset.id;return this.renderAll();
      case 'search-action': {const a=DATA.actions[target.dataset.id];this.closeModal();this.state.view='skills';this.state.selectedSkill=a.skill;return this.renderAll();}
      case 'search-quest': this.closeModal();this.state.view='quests';this.renderAll();return DATA.quests[target.dataset.id]?.stages?.length?this.openStoryQuest(target.dataset.id):undefined;
      case 'search-region': this.closeModal();this.state.view='map';this.state.selectedRegion=target.dataset.id;this.renderAll();return setTimeout(()=>this.centerMapOnRegion(target.dataset.id),0);
      case 'search-enemy': this.closeModal();this.state.view='combat';return this.renderAll();
      case 'search-npc': this.closeModal();this.state.view='quests';return this.renderAll();
      case 'search-faction': this.closeModal();this.state.view='character';return this.renderAll();
      case 'create-recovery-snapshot': await this.persistence.flush('pre-snapshot');await this.persistence.repository.createRecoverySnapshot(e.account,'manual');this.toast('Recovery snapshot created','A local recovery copy was stored.','success');return;
      case 'open-recovery-snapshots': return this.openRecoverySnapshots();
      case 'restore-recovery-snapshot': {const restored=await this.persistence.repository.restoreRecoverySnapshot(target.dataset.id);e.setAccount(restored);this.closeModal();return e.character?this.showGame():this.showCharacterGate();}
      case 'delete-recovery-snapshot': await this.persistence.repository.deleteRecoverySnapshot(target.dataset.id);return this.openRecoverySnapshots();
      case 'apply-update': return this.applyWaitingUpdate();
      default: this.audioManager?.play('click','interface');return originalHandleAction.call(this,action,target);
    }
  };

  proto.handleSettingChange = function handleSettingChangeMemory(target) { const key=target.dataset.setting;let value=target.type==='checkbox'?target.checked:target.value;if(['textScale','autosaveSeconds','masterVolume','musicVolume','effectsVolume','interfaceVolume','notificationVolume','particleDensity'].includes(key))value=Number(value);this.engine.account.settings[key]=value;if(key==='autosaveSeconds')this.persistence.setAutosaveSeconds(value);this.applySettings();this.persistence.markDirty(`setting-${key}`,{urgent:true});this.scheduleRender(true); };

  proto.openRecoverySnapshots = async function openRecoverySnapshots() { const list=await this.persistence.repository.listRecoverySnapshots();this.openModal('Recovery snapshots',`<div class="timeline">${list.map((entry)=>`<div class="timeline-entry"><div><strong>${escapeHtml(titleCase(entry.reason))}</strong><small>${new Date(entry.createdAt).toLocaleString()} · account schema ${entry.accountSchemaVersion}</small></div><div class="button-row"><button class="button small primary" data-action="restore-recovery-snapshot" data-id="${entry.id}">Restore</button><button class="button small danger" data-action="delete-recovery-snapshot" data-id="${entry.id}">Delete</button></div></div>`).join('')||'<div class="empty-state">No recovery snapshots.</div>'}</div>`,{wide:true}); };

  /* ------------------------ Update installation ------------------------ */

  proto.showUpdateReady = function showUpdateReady(registration) { this.serviceWorkerRegistration=registration;this.updateWaitingWorker=registration.waiting;const banner=document.getElementById('update-banner');if(banner)banner.hidden=false;this.toast('Update ready','Save and apply the new Chronicle build when convenient.','success'); };
  proto.applyWaitingUpdate = async function applyWaitingUpdate() { const registration=this.serviceWorkerRegistration||await navigator.serviceWorker.getRegistration();const worker=registration?.waiting||this.updateWaitingWorker;if(!worker)throw new Error('No update is waiting.');await this.persistence.flush('pre-update');await this.persistence.repository.createRecoverySnapshot(this.engine.account,'pre-update');const done=new Promise((resolve)=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));worker.postMessage({type:'SKIP_WAITING'});await done;location.reload(); };

  /* -------------------------- Visual update loop -------------------------- */

  proto.startVisualLoop = function startVisualLoop() { if(this.visualFrameHandle)cancelAnimationFrame(this.visualFrameHandle);const frame=(timestamp)=>{this.visualFrameHandle=requestAnimationFrame(frame);if(document.hidden||!this.engine.character||this.gameShell.hidden)return;if(timestamp-this.lastVisualTimestamp<12)return;this.lastVisualTimestamp=timestamp;this.updateDynamicSmooth(timestamp);};this.visualFrameHandle=requestAnimationFrame(frame); };
  proto.getInterpolatedActivityInfo = function getInterpolatedActivityInfo() { const c=this.engine.character;const a=c?.activity;if(!a)return{icon:'💤',label:'Idle',detail:`Resting in ${this.engine.getRegionDefinition(c.location)?.name||'Eldoria'}`,percent:0};const delta=Math.max(0,Math.min(1000,Date.now()-(c.lastProcessedAt||Date.now())));if(a.kind==='skill'){const action=DATA.actions[a.actionId];const duration=this.engine.getActionDuration(action);const progress=(a.progressMs||0)+delta;return{icon:action?.icon||'⚒️',label:action?.name||'Skill action',detail:`${DATA.skills[action?.skill]?.name||''} · ${formatNumber(a.completed||0)} completed`,percent:(progress%duration)/duration*100};}if(a.kind==='travel'){const remaining=Math.max(0,a.remainingMs-delta);return{icon:'🥾',label:`Traveling to ${this.engine.getRegionDefinition(a.targetRegionId)?.name||'destination'}`,detail:`${formatDuration(remaining,true)} remaining`,percent:100-remaining/Math.max(1,a.totalMs)*100};}if(a.kind==='combat'){const enemy=DATA.enemies[a.enemyId];return{icon:enemy?.icon||'⚔️',label:`Fighting ${enemy?.name||'enemy'}`,detail:`${a.killsThisSession||0} kills this session`,percent:100-a.enemyHp/Math.max(1,enemy?.hp||1)*100};}return{icon:'⚡',label:titleCase(a.kind),detail:'Active',percent:0}; };
  proto.updateDynamicSmooth = function updateDynamicSmooth() { const info=this.getInterpolatedActivityInfo();for(const fill of document.querySelectorAll('#activity-progress-mini span,[data-dashboard-activity-progress],[data-context-activity-progress]'))setBar(fill,info.percent);const a=this.engine.character.activity;if(a?.kind==='skill'){const fill=document.querySelector(`[data-action-progress="${a.actionId}"]`);if(fill)setBar(fill,info.percent);}const stats=this.engine.getCombatStats();const hp=(this.engine.character.currentHp/stats.maxHp)*100;setBar(document.querySelector('#top-hp-fill'),hp);setBar(document.querySelector('[data-player-hp-fill]'),hp);const hpText=document.querySelector('[data-player-hp-text]');if(hpText)hpText.textContent=`${Math.max(0,Math.floor(this.engine.character.currentHp))}/${stats.maxHp} HP`;if(a?.kind==='combat'){const enemy=DATA.enemies[a.enemyId];setBar(document.querySelector('[data-enemy-hp-fill]'),a.enemyHp/Math.max(1,enemy?.hp||1)*100);const txt=document.querySelector('[data-enemy-hp-text]');if(txt)txt.textContent=`${Math.max(0,Math.floor(a.enemyHp))}/${enemy?.hp||0} HP`;}this.updateCountdowns();const label=document.getElementById('activity-label');if(label)label.textContent=info.label; };
  proto.updateDynamic = function updateDynamicMemory() { this.updateDynamicSmooth(performance.now()); };

  proto.getStructuralSignature = function getStructuralSignature() { const c=this.engine.character;if(!c)return'gate';const a=c.activity;const questSig=Object.entries(c.quests).filter(([id])=>DATA.quests[id]?.stages?.length).map(([id,s])=>`${id}:${s.status}:${s.stageIndex}:${Object.keys(s.completedObjectives||{}).length}`).join('|');const dungeon=c.dungeons?.activeRun;return`${this.state.view}|${a?.kind||'idle'}:${a?.actionId||a?.enemyId||a?.targetRegionId||''}:${a?.encounterIndex||0}|${questSig}|${dungeon?.dungeonId||''}:${dungeon?.nodeId||''}|${this.state.townTab}|${this.state.bankTab}`; };
  proto.updateVisibleQuantities = function updateVisibleQuantities() { document.querySelectorAll('[data-stack-quantity]').forEach((node)=>{const location=node.dataset.location||'inventory';node.textContent=formatNumber(this.engine.stackQty(node.dataset.stackQuantity,location));}); };
  proto.enhanceContentIcons = function enhanceContentIcons() {
    const replace = (node, symbol, label) => {
      if (!node || node.querySelector?.('svg.content-icon')) return;
      node.innerHTML = contentIconSvg(symbol, label);
      node.classList.add('content-icon-host');
      if (label) node.setAttribute('aria-label', label);
    };
    for (const node of document.querySelectorAll('.skill-icon')) {
      const owner = node.closest('[data-skill]');
      const name = owner?.querySelector('.skill-name')?.textContent?.trim();
      const skillId = owner?.dataset.skill || Object.keys(DATA.skills).find((id) => DATA.skills[id].name === name);
      replace(node, semanticSkillIcon(skillId), DATA.skills[skillId]?.name || name || 'Skill');
    }
    for (const node of document.querySelectorAll('.item-card .item-icon')) {
      const card = node.closest('.item-card');
      const itemId = [...card.querySelectorAll('[data-id]')].map((entry) => entry.dataset.id).find((id) => DATA.items[id]);
      if (itemId) replace(node, semanticItemIcon(DATA.items[itemId]), DATA.items[itemId].name);
    }
    for (const node of document.querySelectorAll('.equipment-slot .item-icon')) {
      const name = node.closest('.equipment-slot')?.querySelector('strong')?.textContent?.trim();
      const item = Object.values(DATA.items).find((entry) => entry.name === name);
      replace(node, item ? semanticItemIcon(item) : 'item-generic', name || 'Equipment slot');
    }
    for (const node of document.querySelectorAll('.card-icon')) {
      const card = node.closest('.card');
      const inferred = inferCardIcon(card);
      replace(node, inferred.symbol, inferred.label);
    }
    const combatIcons = [...document.querySelectorAll('.combatant-icon')];
    if (combatIcons[0]) replace(combatIcons[0], 'character', this.engine.character?.name || 'Player');
    if (combatIcons[1]) replace(combatIcons[1], 'enemy', DATA.enemies[this.engine.character?.activity?.enemyId]?.name || 'Enemy');
    for (const marker of document.querySelectorAll('.map-marker[data-region] > span')) {
      const region = DATA.regions[marker.parentElement.dataset.region];
      replace(marker, semanticRegionIcon(marker.parentElement.dataset.region), region?.name || 'Region');
    }
    for (const node of document.querySelectorAll('.quest-icon-large')) replace(node, 'quest', 'Quest');
    for (const result of document.querySelectorAll('.search-result > span:first-child')) {
      const action = result.closest('.search-result')?.dataset.action || '';
      const symbol = action === 'search-item' ? semanticItemIcon(DATA.items[result.closest('.search-result').dataset.id])
        : action === 'search-skill' ? semanticSkillIcon(result.closest('.search-result').dataset.id)
          : action === 'search-region' ? semanticRegionIcon(result.closest('.search-result').dataset.id)
            : action === 'search-enemy' ? 'enemy' : action === 'search-quest' ? 'quest' : 'item-generic';
      replace(result, symbol, result.closest('.search-result')?.querySelector('strong')?.textContent || 'Search result');
    }
  };
  proto.enhanceRenderedView = function enhanceRenderedView() { document.querySelectorAll('.progress-fill,#top-hp-fill,.mini-progress>span').forEach(convertBarToTransform);this.enhanceContentIcons();if(this.state.view==='map')requestAnimationFrame(()=>{this.applyMapTransform();if(!this.mapState().initialized){this.fitMap();this.mapState().initialized=true;}});if(this.state.view==='combat')this.enhanceCombatCards();document.querySelectorAll('[data-map-overlay-multi]').forEach((input)=>input.addEventListener('change',()=>{const selected=[...document.querySelectorAll('[data-map-overlay-multi]:checked')].map((node)=>node.dataset.mapOverlayMulti);this.engine.account.settings.mapOverlays=selected;this.persistence.markDirty('map-overlays');this.renderView(true);})); };
  proto.enhanceCombatCards = function enhanceCombatCards() { const cards=[...this.mainView.querySelectorAll('.combatant-card')];for(const [index,card] of cards.entries()){if(card.querySelector('.combatant-surface'))continue;const children=[...card.childNodes];const surface=document.createElement('div');surface.className='combatant-surface';for(const child of children)surface.append(child);card.append(surface);const fx=document.createElement('div');fx.className='combat-effect-layer';fx.dataset.combatFx=index===0?'player':'enemy';card.append(fx);} };
}

function svgIcon(id){return `<svg class="ui-icon" aria-hidden="true"><use href="./assets/icons/ui/sprite.svg#${id}"></use></svg>`;}
function contentIconSvg(id,label=''){return `<svg class="content-icon" role="img"${label?` aria-label="${escapeHtml(label)}"`:' aria-hidden="true"'}><use href="./assets/icons/ui/sprite.svg#${id}"></use></svg>`;}
function semanticSkillIcon(skillId){const skill=DATA.skills[skillId];if(!skill)return'item-generic';const specific={woodcutting:'wood',mining:'ore',fishing:'fish',foraging:'herb',farming:'seed',cooking:'food',smithing:'tool',crafting:'tool',fletching:'weapon',tailoring:'textile',herblore:'potion',runecrafting:'rune',enchanting:'rune',construction:'tool',engineering:'tool',attack:'weapon',strength:'weapon',defence:'armor',vitality:'status-heal',ranged:'weapon',sorcery:'rune',faith:'status-heal',slayer:'enemy',animal_husbandry:'seed',ritualism:'rune',diplomacy:'quest'};return specific[skillId]||({'Gathering':'skill-gathering','Production':'skill-production','Combat':'skill-combat','Utility':'skill-utility','Advanced':'skill-advanced'}[skill.category]||'item-generic');}
function semanticItemIcon(item){if(!item)return'item-generic';const tags=new Set(item.tags||[]);if(item.equipSlot||tags.has('weapon'))return item.equipSlot&&['head','chest','legs','gloves','boots','offHand'].includes(item.equipSlot)?'armor':'weapon';if(tags.has('armor'))return'armor';if(tags.has('wood'))return'wood';if(tags.has('ore')||tags.has('stone')||tags.has('crystal')||tags.has('gem'))return'ore';if(tags.has('fish'))return'fish';if(tags.has('food')||item.heal)return'food';if(tags.has('herb'))return'herb';if(tags.has('bar')||tags.has('metal'))return'bar';if(tags.has('potion'))return'potion';if(tags.has('rune')||tags.has('magic'))return'rune';if(tags.has('artifact')||tags.has('relic'))return'artifact';if(tags.has('cargo')||tags.has('ship'))return'cargo';if(tags.has('seed')||tags.has('crop'))return'seed';if(tags.has('cloth')||tags.has('textile')||tags.has('hide')||tags.has('leather'))return'textile';if(tags.has('tool'))return'tool';return'item-generic';}
function semanticRegionIcon(regionId){if(['stonehaven','willowbrook','riverside','pineglade','watchpost','waveport'].includes(regionId))return'region-town';if(['mount_ember','obsidian_quarry','dwarven_mine','coal_pit','highpass_quarry','cave_mouth'].includes(regionId))return'region-mountain';if(['willow_grove','the_wilds'].includes(regionId))return'region-forest';if(regionId==='crystal_lake')return'region-lake';if(['harbor_dock','coastal_fishing'].includes(regionId))return'region-coast';return'map';}
function inferCardIcon(card){if(!card)return{symbol:'item-generic',label:'Content'};const find=(action)=>card.querySelector(`[data-action="${action}"]`);let target=find('start-skill-action');if(target){const item=DATA.actions[target.dataset.id];return{symbol:semanticSkillIcon(item?.skill),label:item?.name||'Skill activity'};}target=find('start-combat');if(target)return{symbol:'enemy',label:DATA.enemies[target.dataset.id]?.name||'Enemy'};if(find('start-encounter'))return{symbol:'dungeon',label:'Dungeon encounter'};if(find('start-quest')||find('claim-quest')||find('open-story-quest'))return{symbol:'quest',label:'Quest'};if(find('build-building')||find('start-research'))return{symbol:'tool',label:'Project'};if(find('contribute-project'))return{symbol:'region-town',label:'Settlement project'};if(find('recruit-companion')||find('start-expedition'))return{symbol:'character',label:'Companion'};if(find('start-voyage'))return{symbol:'region-coast',label:'Voyage'};return{symbol:'item-generic',label:'Chronicle content'};}
function routePairKey(a,b){return [a,b].sort().join('::');}
function pageHeaderMemory(icon,title,description,actions=''){return `<header class="page-header"><div class="page-title-wrap"><p class="eyebrow">${svgIcon(icon)} Chronicle of Eldoria</p><h1 class="page-title">${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></header>`;}
function statTileMemory(label,value){return `<div class="stat-tile"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong></div>`;}
function rewardSummaryMemory(rewards={}){const p=[];if(rewards.coins)p.push(`${formatNumber(rewards.coins)} coins`);for(const [id,q] of Object.entries(rewards.items||{}))p.push(`${q} ${DATA.items[id]?.name||id}`);for(const [id,xp] of Object.entries(rewards.xp||{}))p.push(`${formatNumber(xp)} ${DATA.skills[id]?.name||id} XP`);return p.join(' · ')||'Story and world changes';}
function settingToggleMemory(key,title,description,checked){return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${key}" ${checked?'checked':''}></label>`;}
function plannerToggle(name,label,checked){return `<label class="setting-row compact"><span><strong>${escapeHtml(label)}</strong></span><input type="checkbox" name="${name}" ${checked?'checked':''}></label>`;}
function plannerInputReserveFields(action,reserves={}){const inputs=Object.keys(action?.inputs||{});if(!inputs.length)return '<div class="empty-state compact">This activity consumes no ingredients.</div>';return `<div class="form-grid">${inputs.map((itemId)=>`<label class="form-field"><span>${escapeHtml(DATA.items[itemId]?.name||itemId)} reserve</span><input class="input" type="number" min="0" max="1000000" value="${Number(reserves[itemId]||0)||''}" placeholder="0" data-planner-reserve-item="${itemId}"></label>`).join('')}</div>`;}
function renderPlannerEstimate(estimate){const outputs=Object.entries(estimate.outputs||{});const inputs=Object.entries(estimate.inputs||{});return `<p class="eyebrow">Plan estimate</p><h3 class="card-title">${escapeHtml(DATA.actions[estimate.actionId]?.name||estimate.actionId)}</h3><div class="forecast-grid planner-estimate-grid"><div><small>Preview actions</small><strong>${formatNumber(estimate.count)}</strong></div><div><small>Duration</small><strong>${escapeHtml(estimate.durationText)}</strong></div><div><small>XP</small><strong>${formatNumber(estimate.xp)}</strong></div><div><small>XP/hour</small><strong>${formatNumber(estimate.xpPerHour)}</strong></div></div><h4>Expected output</h4><div class="resource-list">${outputs.map(([itemId,qty])=>`<div class="resource-row"><span>${escapeHtml(DATA.items[itemId]?.name||itemId)}</span><strong>≈ ${formatNumber(qty)}</strong></div>`).join('')||'<div class="resource-row"><span>No direct item output</span><strong>—</strong></div>'}</div>${inputs.length?`<h4>Estimated inputs</h4><div class="resource-list">${inputs.map(([itemId,qty])=>`<div class="resource-row"><span>${escapeHtml(DATA.items[itemId]?.name||itemId)}</span><strong>${formatNumber(qty)}</strong></div>`).join('')}</div>`:''}<div class="planner-stop-preview"><small>Likely stop condition</small><strong>${escapeHtml(estimate.likelyStop)}</strong></div><p class="card-subtitle">Estimates use current mastery, equipment, region, and world modifiers. Random yields and events can change the result.</p>`;}
function estimateHourly(action,engine){const duration=engine.getActionDuration(action);return{actionsPerHour:Math.floor(3600000/duration),xpPerHour:Math.floor(action.xp*3600000/duration)};}
function setBar(node,percent){if(!node)return;const value=clampNumber(Number(percent)||0,0,100);node.style.setProperty('--progress',String(value/100));node.style.transform=`scaleX(${value/100})`;node.dataset.progress=String(value);}
function convertBarToTransform(fill){if(!fill)return;let pct=Number(fill.dataset.progress);if(!Number.isFinite(pct)){const m=String(fill.getAttribute('style')||'').match(/width\s*:\s*([0-9.]+)%/);pct=m?Number(m[1]):0;}fill.style.width='100%';setBar(fill,pct);}
function clampNumber(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
function isTypingTarget(target){return target?.matches?.('input,textarea,select,[contenteditable="true"]');}
function restartAnimation(node,className){if(!node)return;node.classList.remove(className);void node.offsetWidth;node.classList.add(className);node.addEventListener('animationend',()=>node.classList.remove(className),{once:true});}
function compareStats(a,b){const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];return `<div class="resource-list">${keys.map((key)=>{const diff=(a[key]||0)-(b[key]||0);return `<div class="resource-row"><span>${escapeHtml(titleCase(key))}</span><strong class="${diff>0?'success-text':diff<0?'danger-text':''}">${diff>0?'+':''}${diff}</strong></div>`;}).join('')}</div>`;}
