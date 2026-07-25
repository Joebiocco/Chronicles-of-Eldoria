import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA, APP_VERSION, SAVE_SCHEMA_VERSION } from '../src/data.js';
import { ACCOUNT_SCHEMA_VERSION, createEmptyAccount, normalizeAccount } from '../src/state.js';
import { IndexedDbAccountRepository } from '../src/storage.js';
import {
  makeMasterEngine,
  driveStoryToDecision,
  completeStoryEnding,
  driveDungeonToCompletion,
  resolveCurrentCombat,
} from './memory-helpers.mjs';

const FLAGSHIP_QUESTS = ['memory_bell', 'memory_wall', 'memory_ash'];
const EXPECTED_VARIANTS = {
  'memory_bell:silence': ['crystal_lake', 'purified'],
  'memory_bell:preserve': ['crystal_lake', 'memory_nexus'],
  'memory_bell:break_seal': ['crystal_lake', 'emerged_ruins'],
  'memory_wall:thorne_sacrifice': ['watchpost', 'memorial_stronghold'],
  'memory_wall:nera_path': ['watchpost', 'eastern_gateway'],
  'memory_wall:open_gates': ['watchpost', 'frontier_town'],
  'memory_wall:burn_wilds': ['watchpost', 'scorched_frontier'],
  'memory_ash:separate_dead': ['stonehaven', 'memorial_reform'],
  'memory_ash:give_body': ['stonehaven', 'choir_embassy'],
  'memory_ash:destroy_foundry': ['stonehaven', 'compact_restored'],
  'memory_ash:collect_debt': ['stonehaven', 'worker_council'],
};

test('The Memory Beneath content pack has the promised production breadth', () => {
  assert.equal(APP_VERSION, '1.1.1');
  assert.equal(ACCOUNT_SCHEMA_VERSION, 3);
  assert.equal(SAVE_SCHEMA_VERSION, 7);
  assert.equal(Object.keys(DATA.skills).length, 35);
  assert.equal(Object.keys(DATA.items).length, 171);
  assert.equal(Object.keys(DATA.actions).length, 152);
  assert.equal(Object.keys(DATA.enemies).length, 40);
  assert.equal(Object.keys(DATA.quests).length, 15);
  assert.equal(Object.keys(DATA.dungeons).length, 8);
  assert.equal(Object.keys(DATA.npcs).length, 15);
});

test('all staged quest references, endings, NPCs, scenes, enemies, and world changes are valid', () => {
  const worldTypes = new Set(['regionVariant', 'unlockProject', 'unlockActivity', 'unlockDungeon', 'npcState', 'addService', 'unlockRoute', 'removeActivitiesByTag', 'worldPressure', 'replaceFaction', 'productionModifier']);
  for (const questId of FLAGSHIP_QUESTS) {
    const quest = DATA.quests[questId];
    assert.ok(DATA.npcs[quest.startingNpcId]);
    const objectiveIds = new Set();
    for (const stage of quest.stages) {
      assert.ok(stage.id && stage.title && stage.journalText);
      for (const objective of stage.objectives) {
        assert.ok(!objectiveIds.has(objective.id), `${questId} repeats objective ${objective.id}`);
        objectiveIds.add(objective.id);
        if (objective.sceneId) assert.ok(DATA.investigationScenes[objective.sceneId]);
        if (objective.enemyId) assert.ok(DATA.enemies[objective.enemyId]);
        if (objective.npcId) assert.ok(DATA.npcs[objective.npcId]);
      }
    }
    assert.ok(quest.endings.length >= 3);
    for (const ending of quest.endings) {
      if (ending.encounter) assert.ok(DATA.encounters[ending.encounter] || DATA.enemies[ending.encounter]);
      for (const change of ending.worldChanges || []) assert.ok(worldTypes.has(change.type), `${questId}:${ending.id} uses unknown ${change.type}`);
    }
  }
});

for (const questId of FLAGSHIP_QUESTS) {
  test(`${DATA.quests[questId].name} reaches a genuine irreversible decision gate`, () => {
    const engine = makeMasterEngine();
    const state = driveStoryToDecision(engine, questId);
    assert.equal(state.status, 'decision');
    assert.equal(state.pendingDecision, true);
    assert.equal(engine.character.story.pendingDecision.questId, questId);
    assert.ok(state.journal.length >= DATA.quests[questId].stages.length);
    assert.ok(engine.character.story.recaps.some((entry) => entry.questId === questId));
  });
}

for (const questId of FLAGSHIP_QUESTS) {
  for (const ending of DATA.quests[questId].endings) {
    test(`${DATA.quests[questId].name}: ending “${ending.title}” completes once and changes the world`, () => {
      const engine = makeMasterEngine({ seed: 777 });
      driveStoryToDecision(engine, questId);
      const beforeQuests = engine.character.stats.questsCompleted;
      const state = completeStoryEnding(engine, questId, ending.id);
      const [regionId, variantId] = EXPECTED_VARIANTS[`${questId}:${ending.id}`];
      assert.equal(state.status, 'completed');
      assert.equal(state.ending, ending.id);
      assert.equal(engine.character.world.regionVariants[regionId], variantId);
      assert.equal(engine.character.stats.questsCompleted, beforeQuests + 1);
      assert.equal(engine.character.story.pendingDecision, null);
      assert.ok(engine.character.story.consequences.some((entry) => entry.id === `${questId}:${ending.id}`));
      const applied = engine.character.world.appliedChanges.length;
      const completed = engine.finalizeStoryEnding(questId, ending.id);
      assert.equal(completed.alreadyComplete, true);
      assert.equal(engine.character.world.appliedChanges.length, applied);
      assert.equal(engine.character.stats.questsCompleted, beforeQuests + 1);
    });
  }
}

test('offline simulation pauses at a story decision instead of selecting an ending', () => {
  const engine = makeMasterEngine();
  driveStoryToDecision(engine, 'memory_bell');
  const before = engine.character.lastProcessedAt;
  const report = engine.advanceTo(before + 8 * 60 * 60 * 1000, { offline: true });
  assert.equal(engine.getStoryQuestState('memory_bell').status, 'decision');
  assert.equal(engine.getStoryQuestState('memory_bell').ending, null);
  assert.ok(report.messages.some((message) => message.includes('waiting for your decision')));
});

test('world changes are source-idempotent and burned Wilds activities are actually removed', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'the_wilds';
  const before = engine.getAvailableActions('woodcutting', 'the_wilds').map((action) => action.id);
  assert.ok(before.includes('wc_ironwood'));
  assert.equal(engine.applyWorldChange({ type: 'removeActivitiesByTag', region: 'the_wilds', tag: 'forest' }, 'test:burn'), true);
  assert.equal(engine.applyWorldChange({ type: 'removeActivitiesByTag', region: 'the_wilds', tag: 'forest' }, 'test:burn'), false);
  const after = engine.getAvailableActions('woodcutting', 'the_wilds').map((action) => action.id);
  assert.ok(!after.includes('wc_ironwood'));
});

for (const dungeonId of Object.keys(DATA.dungeons)) {
  test(`${DATA.dungeons[dungeonId].name} supports a complete branching run`, () => {
    const engine = makeMasterEngine({ seed: 91 });
    assert.equal(driveDungeonToCompletion(engine, dungeonId), 1);
    assert.equal(engine.character.dungeons.activeRun, null);
    assert.ok(engine.character.dungeons.history.some((entry) => entry.dungeonId === dungeonId && entry.status === 'completed'));
  });
}

test('Animal Husbandry produces offline goods, supports collection, and completes breeding', () => {
  const engine = makeMasterEngine();
  const pen = engine.character.husbandry.pens[0];
  engine.stockAnimalPen(pen.id, 'hens', 2);
  engine.feedAnimalPen(pen.id, 100);
  engine.startAnimalBreeding(pen.id);
  const breedingEnds = engine.character.husbandry.breeding.endsAt;
  pen.lastProducedAt = breedingEnds - DATA.animals.hens.cycleMs * 2;
  engine.character.husbandry.lastProcessedAt = breedingEnds - DATA.animals.hens.cycleMs * 2;
  engine.advanceTo(breedingEnds + 1, { offline: true });
  assert.ok(pen.count >= 3);
  assert.ok((pen.pendingProducts.hen_egg || 0) > 0);
  const before = engine.totalOwned('hen_egg');
  const products = engine.collectAnimalProducts(pen.id);
  assert.ok(products.hen_egg > 0);
  assert.ok(engine.totalOwned('hen_egg') > before);
});

test('Ritualism applies regional modifiers and expires cleanly', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'willow_grove';
  const baseline = engine.getCombinedModifiers('willow_grove').foragingYield || 0;
  const entry = engine.performRitual('grove_purification');
  assert.ok((engine.getCombinedModifiers('willow_grove').foragingYield || 0) > baseline);
  engine.advanceTo(entry.expiresAt + 1, { offline: true });
  assert.ok(!engine.character.ritualism.active.some((ritual) => ritual.id === entry.id));
});

test('Diplomacy signs each treaty once and changes faction relationships and modifiers', () => {
  const engine = makeMasterEngine();
  const before = engine.character.reputations.riverside_league;
  engine.performDiplomacyAction('riverside_watchpost_supply');
  assert.ok(engine.character.reputations.riverside_league > before);
  assert.ok(engine.character.diplomacy.treaties.some((entry) => entry.actionId === 'riverside_watchpost_supply'));
  assert.throws(() => engine.performDiplomacyAction('riverside_watchpost_supply'), /already active/);
});

test('skill specializations are permanent and milestone rewards are awarded once', () => {
  const engine = makeMasterEngine();
  engine.selectSpecialization('mining', 'prospector');
  assert.equal(engine.character.specializations.mining, 'prospector');
  assert.throws(() => engine.selectSpecialization('mining', 'deep_miner'), /already has a specialization/);
  const before = engine.character.legacy.points;
  engine.updateSkillMilestones();
  const first = engine.character.skillMilestones.mining.length;
  assert.equal(first, 5);
  assert.ok(engine.character.legacy.points > before);
  engine.updateSkillMilestones();
  assert.equal(engine.character.skillMilestones.mining.length, first);
});

test('the activity planner estimates output, respects reserves, and hands off to a linked plan', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'stonehaven';
  const estimate = engine.estimateActivityPlan('mine_copper', { actionCount: 10 });
  assert.equal(estimate.count, 10);
  assert.ok(estimate.xp > 0);
  assert.ok(estimate.outputs.ore_copper >= 10);
  engine.startActivityPlan('mine_copper', { actionCount: 1 }, { actionId: 'mine_tin', conditions: { actionCount: 1 } });
  const firstDuration = engine.getActionDuration(DATA.actions.mine_copper);
  engine.advanceTo(engine.character.lastProcessedAt + firstDuration + 50, { offline: false });
  assert.equal(engine.character.planner.activePlan?.actionId, 'mine_tin');
  assert.ok(engine.character.planner.history.some((plan) => plan.actionId === 'mine_copper'));
});

test('activity planner supports rare-drop stops and per-plan material reserves', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'stonehaven';

  engine.startActivityPlan('mine_copper', { actionCount: 100, stopOnRareDrop: true });
  engine.character.planner.activePlan.rareDropTriggered = true;
  engine.evaluateActivityPlan(null, Date.now());
  assert.equal(engine.character.planner.activePlan, null);
  assert.match(engine.character.planner.history[0].stopReason, /rare drop/i);

  const action = DATA.actions.smelt_bronze;
  engine.character.inventory.stacks.ore_copper = 5;
  engine.character.inventory.stacks.ore_tin = 5;
  engine.character.bank.stacks.ore_copper = 0;
  engine.character.bank.stacks.ore_tin = 0;
  engine.startActivityPlan(action.id, { actionCount: 20, inputReserves: { ore_copper: 3, ore_tin: 3 } });
  engine.advanceTo(engine.character.lastProcessedAt + engine.getActionDuration(action) * 20 + 50, { offline: false });
  assert.ok(engine.totalOwned('ore_copper') >= 3);
  assert.ok(engine.totalOwned('ore_tin') >= 3);
  assert.match(engine.character.planner.history[0].stopReason, /reserve|ended/i);
});

test('activity planner can return to a bank, deposit produced outputs, and retain post-action state through normalization', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'crystal_lake';
  engine.character.discoveredRegions = [...Object.keys(DATA.regions)];
  engine.character.inventory.stacks.ore_crystal = 0;
  engine.character.bank.stacks = {};
  engine.character.bank.instances = [];

  engine.startActivityPlan('mine_crystal', {
    actionCount: 1,
    returnToTown: true,
    returnRegion: 'willowbrook',
    depositOutputs: true,
  });
  engine.advanceTo(engine.character.lastProcessedAt + engine.getActionDuration(DATA.actions.mine_crystal) + 50, { offline: false });
  assert.equal(engine.character.activity?.kind, 'travel');
  assert.equal(engine.character.activity?.targetRegionId, 'willowbrook');
  assert.ok(engine.character.planner.pendingPostActions);

  const arrivalAt = engine.character.lastProcessedAt + engine.character.activity.remainingMs + 100;
  engine.advanceTo(arrivalAt, { offline: true });
  assert.equal(engine.character.location, 'willowbrook');
  assert.equal(engine.character.planner.pendingPostActions, null);
  assert.equal(engine.stackQty('ore_crystal', 'inventory'), 0);
  assert.ok(engine.stackQty('ore_crystal', 'bank') >= 1);

  const normalized = normalizeAccount(engine.account);
  assert.equal(normalized.slots[0].planner.pendingPostActions, null);
});

test('protected material reserves prevent crafting below the configured floor', () => {
  const engine = makeMasterEngine();
  engine.character.location = 'stonehaven';
  engine.character.bank.stacks.ore_copper = 5;
  engine.character.inventory.stacks.ore_copper = 0;
  engine.setItemReserve('ore_copper', 5);
  const action = Object.values(DATA.actions).find((entry) => entry.inputs?.ore_copper);
  assert.ok(action);
  engine.character.location = action.regions[0];
  engine.startSkillAction(action.id);
  const before = engine.totalOwned('ore_copper');
  engine.advanceTo(engine.character.lastProcessedAt + engine.getActionDuration(action) * 3 + 10, { offline: false });
  assert.equal(engine.totalOwned('ore_copper'), before);
  assert.equal(engine.character.activity, null);
});

test('item favorites, notes, reserves, and protection survive account normalization', () => {
  const engine = makeMasterEngine();
  engine.toggleItemFavorite('ore_heartiron');
  engine.setItemReserve('ore_heartiron', 17);
  engine.setItemNote('ore_heartiron', 'Reserve for the Memorial Forge.');
  engine.toggleProtectedStack('ore_heartiron');
  const normalized = normalizeAccount(engine.account);
  const prefs = normalized.slots[0].itemPreferences;
  assert.ok(prefs.favorites.includes('ore_heartiron'));
  assert.equal(prefs.reserved.ore_heartiron, 17);
  assert.equal(prefs.notes.ore_heartiron, 'Reserve for the Memorial Forge.');
  assert.ok(prefs.protectedStacks.includes('ore_heartiron'));
});

test('combat emits explicit presentation events without coupling outcomes to animation', () => {
  const engine = makeMasterEngine();
  const effects = [];
  engine.addEventListener('combat-fx', (event) => effects.push(event.detail));
  engine.character.location = DATA.enemies.hill_goblin.region;
  engine.character.combat.automation.stopAfterKills = 1;
  engine.startCombat('hill_goblin');
  engine.character.activity.enemyHp = 1;
  resolveCurrentCombat(engine);
  assert.ok(effects.length >= 1);
  assert.ok(effects.every((effect) => effect.type === 'combat:round'));
  assert.ok(effects.some((effect) => effect.enemyDefeated));
});

test('fallback recovery snapshots preserve and restore pre-migration accounts', async () => {
  const memory = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  try {
    const repository = new IndexedDbAccountRepository();
    repository.fallback = true;
    const account = createEmptyAccount();
    account.slots[0] = makeMasterEngine().character;
    const snapshot = await repository.createRecoverySnapshot(account, 'test-snapshot');
    const listed = await repository.listRecoverySnapshots();
    assert.equal(listed[0].id, snapshot.id);
    account.slots[0].name = 'Changed after snapshot';
    await repository.saveAccount(account);
    const restored = await repository.restoreRecoverySnapshot(snapshot.id);
    assert.equal(restored.slots[0].name, 'Memory Tester');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
