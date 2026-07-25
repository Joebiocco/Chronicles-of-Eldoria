import { DATA, DEFAULT_AUTOMATION, EQUIPMENT_SLOTS, SAVE_SCHEMA_VERSION, applyContentPack } from './data.js';
import { deepClone, safeUUID, xpForLevel } from './utils.js';

export const ACCOUNT_SCHEMA_VERSION = 3;

export function createItemInstance(itemId, options = {}) {
  const quality = options.quality || 'standard';
  return {
    uid: options.uid || safeUUID(),
    itemId,
    quality,
    affixes: Array.isArray(options.affixes) ? deepClone(options.affixes) : [],
    durability: Number.isFinite(options.durability) ? options.durability : 100,
    locked: Boolean(options.locked),
    createdAt: options.createdAt || Date.now(),
  };
}

function createContainer() {
  return { stacks: {}, instances: [] };
}

function createEquipment() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null]));
}

function createQuestState() {
  const state = {};
  for (const [id, quest] of Object.entries(DATA.quests)) {
    const staged = Array.isArray(quest.stages) && quest.stages.length > 0;
    state[id] = {
      status: quest.autoStart ? 'active' : quest.locked ? 'locked' : 'available',
      choice: null,
      claimedAt: null,
      ...(staged ? {
        stageIndex: 0,
        stageId: quest.stages[0].id,
        completedObjectives: {},
        objectiveData: {},
        evidence: [],
        journal: [],
        decisions: {},
        attempts: {},
        pendingDecision: false,
        ending: null,
        startedAt: null,
        updatedAt: null,
      } : {}),
    };
  }
  return state;
}

function createReputations() {
  return Object.fromEntries(Object.keys(DATA.factions).map((id) => [id, 0]));
}

function createSkillXp() {
  const xp = {};
  for (const [id, skill] of Object.entries(DATA.skills)) {
    xp[id] = skill.startsAt ? xpForLevel(skill.startsAt) : 0;
  }
  return xp;
}

function createFarmingState() {
  return {
    plots: [0, 1].map((index) => ({ id: safeUUID(), index, cropId: null, plantedAt: null, readyAt: null, composted: false })),
    harvests: 0,
  };
}

function createBuildingsState() {
  const entries = {};
  for (const id of Object.keys(DATA.buildings)) entries[id] = { level: 0, store: {}, lastProcessedAt: Date.now() };
  return entries;
}

function createCompanionState() {
  return {
    owned: {},
    activeExpeditions: [],
  };
}

function createWorldState() {
  return {
    regionVariants: {},
    npcStates: {},
    unlockedDungeons: [],
    unlockedProjects: [],
    unlockedActivities: [],
    unlockedRoutes: [],
    addedServices: {},
    removedActivityTags: {},
    worldPressure: {},
    productionModifiers: {},
    factionOverrides: {},
    appliedChanges: [],
  };
}

function createStoryState() {
  return {
    decisionTags: [],
    journal: [],
    consequences: [],
    recaps: [],
    pendingDecision: null,
  };
}

function createHusbandryState(now = Date.now()) {
  return {
    pens: [
      { id: safeUUID(), slot: 0, speciesId: null, count: 0, feed: 0, health: 100, happiness: 70, traits: [], lastProducedAt: now },
      { id: safeUUID(), slot: 1, speciesId: null, count: 0, feed: 0, health: 100, happiness: 70, traits: [], lastProducedAt: now },
    ],
    breeding: null,
    productsCollected: 0,
    births: 0,
    mounts: [],
    lastProcessedAt: now,
  };
}

function createRitualismState() {
  return { active: [], completed: {}, circles: ['willow_grove'], history: [] };
}

function createDiplomacyState() {
  return { treaties: [], favors: {}, leverage: 0, disputesResolved: 0, history: [] };
}

function createDungeonState() {
  return { activeRun: null, completed: {}, unlocked: [], discoveries: [], history: [] };
}

function createItemPreferences() {
  return { favorites: [], reserved: {}, notes: {}, protectedStacks: [] };
}

function createPlannerState() {
  return { activePlan: null, pendingPostActions: null, queue: [], history: [] };
}

export function createNewCharacter({ name = 'Adventurer', background = 'stonehaven_apprentice', difficulty = 'standard', seed } = {}) {
  const now = Date.now();
  const backgroundDef = DATA.backgrounds[background] || DATA.backgrounds.stonehaven_apprentice;
  const startRegion = backgroundDef.startRegion || 'stonehaven';
  const character = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: safeUUID(),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    lastProcessedAt: now,
    name: String(name || 'Adventurer').trim().slice(0, 24) || 'Adventurer',
    portrait: backgroundDef.icon || '🧑‍⚔️',
    title: 'Wayfarer',
    background,
    difficulty,
    worldSeed: Number.isFinite(seed) ? seed >>> 0 : Math.floor(Math.random() * 0xffffffff) >>> 0,
    modded: false,
    location: startRegion,
    discoveredRegions: [startRegion],
    discoveredSecrets: [],
    coins: 125,
    xp: createSkillXp(),
    mastery: { actions: {}, pools: Object.fromEntries(Object.keys(DATA.skills).map((id) => [id, 0])) },
    inventory: createContainer(),
    bank: createContainer(),
    equipment: createEquipment(),
    loadouts: [],
    currentHp: 100,
    stamina: 100,
    mana: 100,
    buffs: [],
    activity: null,
    activityQueue: [],
    combat: {
      style: 'melee',
      abilityLoadouts: {
        melee: ['power_strike', 'guard', 'interrupt'],
        ranged: ['venom_shot', 'guard', 'interrupt'],
        sorcery: ['firebolt', 'frost_ward', 'interrupt'],
        faith: ['mend', 'cleanse', 'guard'],
      },
      cooldowns: {},
      automation: deepClone(DEFAULT_AUTOMATION),
      log: [],
      lastEnemyId: null,
      reserveFood: 3,
    },
    slayer: { assignment: null, completed: 0 },
    reputations: createReputations(),
    quests: createQuestState(),
    farming: createFarmingState(),
    buildings: createBuildingsState(),
    projects: Object.fromEntries(Object.keys(DATA.settlementProjects || {}).map((id) => [id, { contributions: {}, coins: 0, complete: false, completedAt: null }])),
    companions: createCompanionState(),
    research: { completed: [], active: null },
    trade: { contractsDay: null, contracts: [], activeRoutes: [], fulfilled: 0 },
    sailing: { ship: null, activeVoyage: null, voyagesCompleted: 0 },
    collections: {
      items: [],
      monsters: {},
      artifacts: [],
      discoveries: [startRegion],
      lore: [],
      achievements: [],
      pets: [],
      familiars: [],
    },
    stats: {
      playTimeMs: 0,
      actionsCompleted: 0,
      crafted: 0,
      gathered: 0,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      coinsEarned: 0,
      coinsSpent: 0,
      distanceTraveled: 0,
      rareDrops: 0,
      actionCounts: {},
      enemyKills: {},
      itemsFound: {},
      itemsCrafted: {},
      activeInteractions: 0,
      questsCompleted: 0,
    },
    goals: [],
    inbox: [],
    offlineReports: [],
    legacy: { chronicles: 0, points: 0, perks: [], inheritedTitles: [] },
    world: createWorldState(),
    story: createStoryState(),
    husbandry: createHusbandryState(now),
    ritualism: createRitualismState(),
    diplomacy: createDiplomacyState(),
    dungeons: createDungeonState(),
    specializations: {},
    skillMilestones: {},
    itemPreferences: createItemPreferences(),
    planner: createPlannerState(),
    flags: {},
  };

  applyBackground(character, backgroundDef);
  addInitialEquipment(character);
  character.currentHp = 100;
  return character;
}

function addInitialEquipment(character) {
  const sword = createItemInstance('sword_bronze');
  const shield = createItemInstance('shield_bronze');
  const axe = createItemInstance('axe_bronze');
  character.inventory.instances.push(sword, shield, axe);
  character.equipment.mainHand = sword.uid;
  character.equipment.offHand = shield.uid;
  character.equipment.tool = axe.uid;
  addStack(character.inventory.stacks, 'fish_shrimp_cooked', 8);
  addStack(character.inventory.stacks, 'potion_healing', 2);
  addStack(character.inventory.stacks, 'seed_grain', 4);
}

function applyBackground(character, backgroundDef) {
  for (const [skill, amount] of Object.entries(backgroundDef.startingXp || {})) {
    character.xp[skill] = (character.xp[skill] || 0) + amount;
  }
  for (const [itemId, quantity] of Object.entries(backgroundDef.items || {})) {
    const item = DATA.items[itemId];
    if (!item) continue;
    if (item.stackable === false) {
      for (let i = 0; i < quantity; i += 1) character.inventory.instances.push(createItemInstance(itemId));
    } else addStack(character.inventory.stacks, itemId, quantity);
  }
  for (const [faction, amount] of Object.entries(backgroundDef.reputation || {})) {
    character.reputations[faction] = (character.reputations[faction] || 0) + amount;
  }
}

function addStack(stacks, itemId, quantity) {
  stacks[itemId] = Math.max(0, (Number(stacks[itemId]) || 0) + (Number(quantity) || 0));
  if (!stacks[itemId]) delete stacks[itemId];
}

export function createEmptyAccount() {
  const now = Date.now();
  return {
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    id: safeUUID(),
    createdAt: now,
    updatedAt: now,
    activeSlot: null,
    slots: [null, null, null],
    settings: {
      theme: 'ember',
      textScale: 1,
      reducedMotion: false,
      highContrast: false,
      sound: true,
      masterVolume: 0.75,
      musicVolume: 0.35,
      effectsVolume: 0.65,
      interfaceVolume: 0.45,
      notificationVolume: 0.65,
      musicEnabled: true,
      combatSounds: true,
      interfaceSounds: true,
      notificationSounds: true,
      animationQuality: 'full',
      damageSplats: true,
      screenShake: true,
      particleDensity: 0.75,
      backgroundAnimations: true,
      notifications: false,
      offlineProgress: true,
      autosaveSeconds: 20,
      compactCards: false,
      mapOverlay: 'resources',
      mapZoom: 1,
      mapPanX: 0,
      mapPanY: 0,
      mapOverlays: ['resources'],
      sidebarCollapsed: false,
      allowAnalytics: false,
      installedHintDismissed: false,
      lastView: 'dashboard',
    },
    mods: [],
    sync: {
      provider: 'local',
      userId: null,
      lastSyncedAt: null,
      status: 'local-only',
    },
  };
}


export function migrateAccountSave(raw) {
  const account = raw && typeof raw === 'object' ? deepClone(raw) : createEmptyAccount();
  let version = Math.max(1, Number(account.schemaVersion) || 1);
  account.migrationHistory = Array.isArray(account.migrationHistory) ? account.migrationHistory : [];
  while (version < ACCOUNT_SCHEMA_VERSION) {
    const from = version;
    if (version === 1) {
      account.sync ||= { provider: 'local', userId: null, lastSyncedAt: null, status: 'local-only' };
      version = 2;
    } else if (version === 2) {
      account.settings = { ...createEmptyAccount().settings, ...(account.settings || {}) };
      version = 3;
    } else throw new Error(`No account migration exists for schema ${version}.`);
    account.migrationHistory.push({ from, to: version, at: Date.now() });
  }
  account.schemaVersion = ACCOUNT_SCHEMA_VERSION;
  return account;
}

export function migrateCharacterSave(raw) {
  const character = deepClone(raw);
  let version = Math.max(1, Number(character.schemaVersion) || 1);
  character.migrationHistory = Array.isArray(character.migrationHistory) ? character.migrationHistory : [];
  while (version < SAVE_SCHEMA_VERSION) {
    const from = version;
    if (version < 4) {
      // Earlier Chronicles builds are normalized through the existing broad
      // compatibility layer; schema 4 is the stable modular-PWA baseline.
      version = 4;
    } else if (version === 4) {
      character.world ||= createWorldState();
      character.story ||= createStoryState();
      version = 5;
    } else if (version === 5) {
      character.husbandry ||= createHusbandryState(character.updatedAt || Date.now());
      character.ritualism ||= createRitualismState();
      character.diplomacy ||= createDiplomacyState();
      character.dungeons ||= createDungeonState();
      character.specializations ||= {};
      character.skillMilestones ||= {};
      version = 6;
    } else if (version === 6) {
      character.itemPreferences ||= createItemPreferences();
      character.planner ||= createPlannerState();
      character.quests ||= {};
      for (const [questId, quest] of Object.entries(DATA.quests)) {
        if (!quest.stages?.length) continue;
        const existing = character.quests[questId] || {};
        character.quests[questId] = {
          ...createQuestState()[questId],
          ...existing,
          completedObjectives: { ...(existing.completedObjectives || {}) },
          objectiveData: { ...(existing.objectiveData || {}) },
          evidence: unique(existing.evidence || []),
          journal: Array.isArray(existing.journal) ? existing.journal : [],
          decisions: { ...(existing.decisions || {}) },
          attempts: { ...(existing.attempts || {}) },
        };
      }
      version = 7;
    } else throw new Error(`No character migration exists for schema ${version}.`);
    character.migrationHistory.push({ from, to: version, at: Date.now() });
  }
  character.schemaVersion = SAVE_SCHEMA_VERSION;
  return character;
}

export function normalizeAccount(raw) {
  const account = migrateAccountSave(raw);
  account.schemaVersion = ACCOUNT_SCHEMA_VERSION;
  account.id ||= safeUUID();
  account.createdAt ||= Date.now();
  account.updatedAt ||= Date.now();
  account.activeSlot = Number.isInteger(account.activeSlot) && account.activeSlot >= 0 && account.activeSlot < 3 ? account.activeSlot : null;
  account.mods = Array.isArray(account.mods) ? account.mods : [];
  // Data-only content packs are restored before characters are normalized so
  // their custom items, actions, enemies, and quests remain valid after reload.
  account.mods = account.mods.map((entry) => {
    if (!entry?.pack) return entry;
    try {
      applyContentPack(entry.pack);
      return { ...entry, loadError: null };
    } catch (error) {
      return { ...entry, loadError: error?.message || String(error) };
    }
  });
  account.slots = Array.isArray(account.slots) ? account.slots.slice(0, 3) : [];
  while (account.slots.length < 3) account.slots.push(null);
  account.slots = account.slots.map((character) => (character ? normalizeCharacter(character) : null));
  account.settings = { ...createEmptyAccount().settings, ...(account.settings || {}) };
  account.sync = { ...createEmptyAccount().sync, ...(account.sync || {}) };
  if (account.activeSlot !== null && !account.slots[account.activeSlot]) account.activeSlot = null;
  return account;
}

export function normalizeCharacter(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Character save is not a valid object.');
  if (raw.player && raw.inventory && !raw.schemaVersion) return importLegacySimpleScape(raw);

  const migrated = migrateCharacterSave(raw);
  const base = createNewCharacter({
    name: migrated.name || migrated.player?.name || 'Adventurer',
    background: migrated.background || 'stonehaven_apprentice',
    difficulty: migrated.difficulty || 'standard',
    seed: migrated.worldSeed,
  });

  const character = deepClone(migrated);
  character.schemaVersion = SAVE_SCHEMA_VERSION;
  character.id ||= base.id;
  character.revision = Math.max(1, Number(character.revision) || 1);
  character.createdAt ||= base.createdAt;
  character.updatedAt ||= Date.now();
  character.lastProcessedAt ||= character.updatedAt;
  character.name = String(character.name || 'Adventurer').trim().slice(0, 24) || 'Adventurer';
  character.portrait ||= base.portrait;
  character.title ||= 'Wayfarer';
  character.background = DATA.backgrounds[character.background] ? character.background : 'stonehaven_apprentice';
  character.difficulty = DATA.difficulties[character.difficulty] ? character.difficulty : 'standard';
  character.worldSeed = Number(character.worldSeed) >>> 0;
  character.modded = Boolean(character.modded);
  character.location = DATA.regions[character.location] ? character.location : 'stonehaven';
  character.discoveredRegions = unique((character.discoveredRegions || []).filter((id) => DATA.regions[id]));
  if (!character.discoveredRegions.includes(character.location)) character.discoveredRegions.push(character.location);
  character.discoveredSecrets = unique(character.discoveredSecrets || []);
  character.coins = Math.max(0, Number(character.coins) || 0);
  character.xp = { ...base.xp, ...(character.xp || {}) };
  character.mastery = {
    actions: { ...(character.mastery?.actions || {}) },
    pools: { ...base.mastery.pools, ...(character.mastery?.pools || {}) },
  };
  character.inventory = normalizeContainer(character.inventory);
  character.bank = normalizeContainer(character.bank);
  character.equipment = { ...base.equipment, ...(character.equipment || {}) };
  character.loadouts = Array.isArray(character.loadouts) ? character.loadouts.slice(0, 12) : [];
  character.currentHp = Math.max(0, Number(character.currentHp) || base.currentHp);
  character.stamina = Math.max(0, Number(character.stamina) || 100);
  character.mana = Math.max(0, Number(character.mana) || 100);
  character.buffs = Array.isArray(character.buffs) ? character.buffs : [];
  character.activity = normalizeActivity(character.activity);
  character.activityQueue = Array.isArray(character.activityQueue) ? character.activityQueue.slice(0, 20) : [];
  character.combat = {
    ...base.combat,
    ...(character.combat || {}),
    abilityLoadouts: { ...base.combat.abilityLoadouts, ...(character.combat?.abilityLoadouts || {}) },
    cooldowns: { ...(character.combat?.cooldowns || {}) },
    automation: { ...base.combat.automation, ...(character.combat?.automation || {}) },
    log: Array.isArray(character.combat?.log) ? character.combat.log.slice(0, 120) : [],
  };
  character.slayer = { ...base.slayer, ...(character.slayer || {}) };
  character.reputations = { ...base.reputations, ...(character.reputations || {}) };
  character.quests = normalizeQuestStates(character.quests, base.quests);
  character.farming = normalizeFarming(character.farming, base.farming);
  character.buildings = normalizeBuildings(character.buildings, base.buildings);
  character.projects = { ...base.projects, ...(character.projects || {}) };
  character.companions = {
    owned: { ...(character.companions?.owned || {}) },
    activeExpeditions: Array.isArray(character.companions?.activeExpeditions) ? character.companions.activeExpeditions : [],
  };
  character.research = {
    completed: unique(character.research?.completed || []),
    active: character.research?.active || null,
  };
  character.trade = {
    contractsDay: character.trade?.contractsDay || null,
    contracts: Array.isArray(character.trade?.contracts) ? character.trade.contracts : [],
    activeRoutes: Array.isArray(character.trade?.activeRoutes) ? character.trade.activeRoutes : [],
    fulfilled: Math.max(0, Number(character.trade?.fulfilled) || 0),
  };
  character.sailing = {
    ship: character.sailing?.ship || null,
    activeVoyage: character.sailing?.activeVoyage || null,
    voyagesCompleted: Math.max(0, Number(character.sailing?.voyagesCompleted) || 0),
  };
  character.collections = {
    ...base.collections,
    ...(character.collections || {}),
    items: unique(character.collections?.items || []),
    monsters: { ...(character.collections?.monsters || {}) },
    artifacts: unique(character.collections?.artifacts || []),
    discoveries: unique(character.collections?.discoveries || character.discoveredRegions),
    lore: unique(character.collections?.lore || []),
    achievements: unique(character.collections?.achievements || []),
    pets: unique(character.collections?.pets || []),
    familiars: unique(character.collections?.familiars || []),
  };
  character.stats = {
    ...base.stats,
    ...(character.stats || {}),
    actionCounts: { ...(character.stats?.actionCounts || {}) },
    enemyKills: { ...(character.stats?.enemyKills || {}) },
    itemsFound: { ...(character.stats?.itemsFound || {}) },
    itemsCrafted: { ...(character.stats?.itemsCrafted || {}) },
  };
  character.goals = Array.isArray(character.goals) ? character.goals.slice(0, 8) : [];
  character.inbox = Array.isArray(character.inbox) ? character.inbox.slice(-100) : [];
  character.offlineReports = Array.isArray(character.offlineReports) ? character.offlineReports.slice(-20) : [];
  character.legacy = { ...base.legacy, ...(character.legacy || {}) };
  character.world = normalizeWorldState(character.world, base.world);
  character.story = normalizeStoryState(character.story, base.story);
  character.husbandry = normalizeHusbandry(character.husbandry, base.husbandry);
  character.ritualism = normalizeRitualism(character.ritualism, base.ritualism);
  character.diplomacy = normalizeDiplomacy(character.diplomacy, base.diplomacy);
  character.dungeons = normalizeDungeons(character.dungeons, base.dungeons);
  character.specializations = { ...(character.specializations || {}) };
  character.skillMilestones = { ...(character.skillMilestones || {}) };
  character.itemPreferences = normalizeItemPreferences(character.itemPreferences, base.itemPreferences);
  character.planner = normalizePlanner(character.planner, base.planner);
  character.flags = { ...(character.flags || {}) };

  repairEquipmentReferences(character);
  discoverExistingItems(character);
  return character;
}


function normalizeQuestStates(source, base) {
  const result = {};
  for (const [questId, quest] of Object.entries(DATA.quests)) {
    const existing = source?.[questId] || {};
    const defaults = base[questId] || {};
    if (!quest.stages?.length) {
      result[questId] = { ...defaults, ...existing };
      continue;
    }
    const stageIndex = Math.max(0, Math.min(quest.stages.length - 1, Number(existing.stageIndex) || 0));
    result[questId] = {
      ...defaults,
      ...existing,
      stageIndex,
      stageId: quest.stages[stageIndex]?.id || quest.stages[0].id,
      completedObjectives: { ...(existing.completedObjectives || {}) },
      objectiveData: { ...(existing.objectiveData || {}) },
      evidence: unique(existing.evidence || []),
      journal: Array.isArray(existing.journal) ? existing.journal.slice(-160) : [],
      decisions: { ...(existing.decisions || {}) },
      attempts: { ...(existing.attempts || {}) },
      pendingDecision: Boolean(existing.pendingDecision),
      ending: existing.ending || null,
      startedAt: existing.startedAt || null,
      updatedAt: existing.updatedAt || null,
    };
  }
  return result;
}

function normalizeWorldState(source, base) {
  const world = { ...base, ...(source || {}) };
  world.regionVariants = { ...(source?.regionVariants || {}) };
  world.npcStates = { ...(source?.npcStates || {}) };
  world.unlockedDungeons = unique(source?.unlockedDungeons || []);
  world.unlockedProjects = unique(source?.unlockedProjects || []);
  world.unlockedActivities = unique(source?.unlockedActivities || []);
  world.unlockedRoutes = unique(source?.unlockedRoutes || []);
  world.addedServices = Object.fromEntries(Object.entries(source?.addedServices || {}).map(([id, values]) => [id, unique(values)]));
  world.removedActivityTags = Object.fromEntries(Object.entries(source?.removedActivityTags || {}).map(([id, values]) => [id, unique(values)]));
  world.worldPressure = { ...(source?.worldPressure || {}) };
  world.productionModifiers = { ...(source?.productionModifiers || {}) };
  world.factionOverrides = { ...(source?.factionOverrides || {}) };
  world.appliedChanges = unique(source?.appliedChanges || []);
  return world;
}

function normalizeStoryState(source, base) {
  return {
    ...base,
    ...(source || {}),
    decisionTags: unique(source?.decisionTags || []),
    journal: Array.isArray(source?.journal) ? source.journal.slice(-300) : [],
    consequences: Array.isArray(source?.consequences) ? source.consequences.slice(-120) : [],
    recaps: Array.isArray(source?.recaps) ? source.recaps.slice(-40) : [],
    pendingDecision: source?.pendingDecision || null,
  };
}

function normalizeHusbandry(source, base) {
  const pens = Array.isArray(source?.pens) ? source.pens : base.pens;
  return {
    ...base,
    ...(source || {}),
    pens: pens.map((pen, slot) => ({
      id: pen.id || safeUUID(), slot,
      speciesId: DATA.animals?.[pen.speciesId] ? pen.speciesId : null,
      count: Math.max(0, Math.floor(Number(pen.count) || 0)),
      feed: Math.max(0, Math.floor(Number(pen.feed) || 0)),
      health: Math.max(0, Math.min(100, Number(pen.health) || 100)),
      happiness: Math.max(0, Math.min(100, Number(pen.happiness) || 70)),
      traits: unique(pen.traits || []),
      pendingProducts: { ...(pen.pendingProducts || {}) },
      lastProducedAt: pen.lastProducedAt || Date.now(),
    })),
    mounts: unique(source?.mounts || []),
    productsCollected: Math.max(0, Number(source?.productsCollected) || 0),
    births: Math.max(0, Number(source?.births) || 0),
    lastProcessedAt: source?.lastProcessedAt || Date.now(),
  };
}

function normalizeRitualism(source, base) {
  return { ...base, ...(source || {}), active: Array.isArray(source?.active) ? source.active : [], completed: { ...(source?.completed || {}) }, circles: unique(source?.circles || base.circles), history: Array.isArray(source?.history) ? source.history.slice(-80) : [] };
}

function normalizeDiplomacy(source, base) {
  return { ...base, ...(source || {}), treaties: unique(source?.treaties || []), favors: { ...(source?.favors || {}) }, leverage: Math.max(0, Number(source?.leverage) || 0), disputesResolved: Math.max(0, Number(source?.disputesResolved) || 0), history: Array.isArray(source?.history) ? source.history.slice(-80) : [] };
}

function normalizeDungeons(source, base) {
  return { ...base, ...(source || {}), activeRun: source?.activeRun || null, completed: { ...(source?.completed || {}) }, unlocked: unique(source?.unlocked || []), discoveries: unique(source?.discoveries || []), history: Array.isArray(source?.history) ? source.history.slice(-80) : [] };
}

function normalizeItemPreferences(source, base) {
  return { ...base, ...(source || {}), favorites: unique(source?.favorites || []), reserved: Object.fromEntries(Object.entries(source?.reserved || {}).map(([id, qty]) => [id, Math.max(0, Math.floor(Number(qty) || 0))])), notes: { ...(source?.notes || {}) }, protectedStacks: unique(source?.protectedStacks || []) };
}

function normalizePlanner(source, base) {
  return {
    ...base,
    ...(source || {}),
    activePlan: source?.activePlan || null,
    pendingPostActions: source?.pendingPostActions || null,
    queue: Array.isArray(source?.queue) ? source.queue.slice(0, 20) : [],
    history: Array.isArray(source?.history) ? source.history.slice(-80) : [],
  };
}

function normalizeActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;
  const kind = activity.kind || activity.type;
  if (!['skill', 'combat', 'travel'].includes(kind)) return null;
  return { ...activity, kind };
}

function normalizeContainer(container) {
  if (!container) return createContainer();
  if (container.stacks || container.instances) {
    return {
      stacks: Object.fromEntries(Object.entries(container.stacks || {}).filter(([id, qty]) => DATA.items[id] && Number(qty) > 0).map(([id, qty]) => [id, Math.floor(Number(qty))])),
      instances: Array.isArray(container.instances)
        ? container.instances.filter((instance) => instance && DATA.items[instance.itemId]).map((instance) => createItemInstance(instance.itemId, instance))
        : [],
    };
  }
  const normalized = createContainer();
  for (const [itemId, quantity] of Object.entries(container || {})) {
    const item = DATA.items[itemId];
    if (!item || Number(quantity) <= 0) continue;
    if (item.stackable === false) {
      for (let i = 0; i < Math.floor(quantity); i += 1) normalized.instances.push(createItemInstance(itemId));
    } else normalized.stacks[itemId] = Math.floor(quantity);
  }
  return normalized;
}

function normalizeFarming(farming, base) {
  const source = farming || {};
  const plots = Array.isArray(source.plots) ? source.plots : base.plots;
  return {
    plots: plots.map((plot, index) => ({
      id: plot.id || safeUUID(),
      index,
      cropId: DATA.crops[plot.cropId] ? plot.cropId : null,
      plantedAt: plot.plantedAt || null,
      readyAt: plot.readyAt || null,
      composted: Boolean(plot.composted),
    })),
    harvests: Math.max(0, Number(source.harvests) || 0),
  };
}

function normalizeBuildings(buildings, base) {
  const result = {};
  for (const id of Object.keys(DATA.buildings)) {
    result[id] = {
      ...base[id],
      ...(buildings?.[id] || {}),
      level: Math.max(0, Math.min(DATA.buildings[id].maxLevel, Number(buildings?.[id]?.level) || 0)),
      store: { ...(buildings?.[id]?.store || {}) },
    };
  }
  return result;
}

function repairEquipmentReferences(character) {
  const valid = new Set(character.inventory.instances.map((instance) => instance.uid).concat(character.bank.instances.map((instance) => instance.uid)));
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === 'familiar') {
      if (character.equipment[slot] && !character.collections.familiars.includes(character.equipment[slot])) character.equipment[slot] = null;
      continue;
    }
    if (character.equipment[slot] && !valid.has(character.equipment[slot])) character.equipment[slot] = null;
  }
}

function discoverExistingItems(character) {
  const ids = new Set(character.collections.items);
  for (const [id, qty] of Object.entries(character.inventory.stacks)) if (qty > 0) ids.add(id);
  for (const [id, qty] of Object.entries(character.bank.stacks)) if (qty > 0) ids.add(id);
  for (const instance of [...character.inventory.instances, ...character.bank.instances]) ids.add(instance.itemId);
  character.collections.items = [...ids];
}

function unique(values) {
  return [...new Set(Array.isArray(values) ? values : [])];
}

export function importLegacySimpleScape(raw) {
  const name = raw.player?.name || 'Legacy Adventurer';
  const character = createNewCharacter({ name, background: 'stonehaven_apprentice', difficulty: 'standard' });
  const xpMap = { ...(raw.player?.xp || {}) };
  if (xpMap.hitpoints !== undefined) {
    xpMap.vitality = xpMap.hitpoints;
    delete xpMap.hitpoints;
  }
  character.xp = { ...character.xp, ...xpMap };
  character.coins = Math.max(0, Number(raw.player?.coins) || 0);
  character.inventory = normalizeContainer(raw.inventory || {});
  character.bank = normalizeContainer(raw.bank || {});
  character.inventory.instances = character.inventory.instances.filter((instance) => !['sword_bronze', 'shield_bronze', 'axe_bronze'].includes(instance.itemId));
  character.equipment = createEquipment();

  const legacyEquipment = raw.player?.equipment || {};
  const weaponId = legacyEquipment.weapon;
  const armorId = legacyEquipment.armor;
  const equipmentMap = { armor_bronze: 'chest_iron', armor_iron: 'chest_iron' };
  if (weaponId && DATA.items[weaponId]) {
    const instance = createItemInstance(weaponId);
    character.inventory.instances.push(instance);
    character.equipment.mainHand = instance.uid;
  }
  const mappedArmor = equipmentMap[armorId] || armorId;
  if (mappedArmor && DATA.items[mappedArmor]) {
    const instance = createItemInstance(mappedArmor);
    character.inventory.instances.push(instance);
    character.equipment.chest = instance.uid;
  }

  character.currentHp = Math.max(1, Number(raw.player?.currentHp) || 100);
  character.location = 'stonehaven';
  character.discoveredRegions = ['stonehaven'];
  character.collections.discoveries = ['stonehaven'];
  character.flags.importedFromSimpleScapeV15 = true;
  character.inbox.push({
    id: safeUUID(),
    time: Date.now(),
    type: 'system',
    title: 'Legacy save imported',
    message: 'Your SimpleScape V15 skills, coins, inventory, bank, and core equipment were migrated into Chronicles of Eldoria.',
  });
  discoverExistingItems(character);
  return character;
}

export function exportCharacterPayload(character) {
  const normalized = normalizeCharacter(character);
  return {
    type: 'eldoria-character',
    formatVersion: 1,
    exportedAt: Date.now(),
    character: normalized,
  };
}

export function exportAccountPayload(account) {
  return {
    type: 'eldoria-account',
    formatVersion: 1,
    exportedAt: Date.now(),
    account: normalizeAccount(account),
  };
}

export function parseImportPayload(text) {
  let decoded;
  try {
    decoded = JSON.parse(String(text).trim());
  } catch {
    try {
      const raw = atob(String(text).trim());
      decoded = JSON.parse(decodeURIComponent(escape(raw)));
    } catch {
      throw new Error('The selected file is not valid Eldoria JSON or a compatible legacy save.');
    }
  }
  if (decoded?.type === 'eldoria-account' && decoded.account) return { type: 'account', value: normalizeAccount(decoded.account) };
  if (decoded?.type === 'eldoria-character' && decoded.character) return { type: 'character', value: normalizeCharacter(decoded.character) };
  if (decoded?.slots) return { type: 'account', value: normalizeAccount(decoded) };
  if (decoded?.characters && Array.isArray(decoded.characters)) {
    return { type: 'account', value: normalizeAccount({ ...createEmptyAccount(), slots: decoded.characters }) };
  }
  return { type: 'character', value: normalizeCharacter(decoded) };
}
