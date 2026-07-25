import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from '../src/data.js';
import { GameEngine } from '../src/engine.js';
import { createEmptyAccount } from '../src/state.js';
import { xpForLevel } from '../src/utils.js';

function makeMasteredEngine() {
  const engine = new GameEngine(createEmptyAccount());
  engine.createCharacter(0, { name: 'Integration Tester', background: 'stonehaven_apprentice', difficulty: 'relaxed', seed: 778899 });
  for (const skillId of Object.keys(DATA.skills)) engine.character.xp[skillId] = xpForLevel(99);
  engine.character.currentHp = engine.getMaxHp();
  engine.character.coins = 1_000_000;
  engine.character.discoveredRegions = Object.keys(DATA.regions);
  return engine;
}

function addCost(engine, cost) {
  if (cost.coins) engine.character.coins = Math.max(engine.character.coins, cost.coins * 2);
  for (const [itemId, qty] of Object.entries(cost)) {
    if (itemId === 'coins') continue;
    const result = engine.addItem(itemId, qty, { location: 'bank' });
    assert.equal(result.lost, 0, `Could not add ${itemId} test cost`);
  }
}

function finishPassive(engine, mutate) {
  const now = Date.now();
  engine.character.lastProcessedAt = now - 2_000;
  mutate(now);
  engine.advanceTo(now, { offline: true });
}

test('farming grows and harvests persistent crops', () => {
  const engine = makeMasteredEngine();
  engine.addItem('seed_grain', 1);
  engine.addItem('compost', 1);
  const plot = engine.character.farming.plots[0];
  engine.plantCrop(plot.id, 'grain', true);
  plot.readyAt = Date.now() - 1;
  const before = engine.totalOwned('grain');
  const result = engine.harvestCrop(plot.id);
  assert.ok(result.grain >= 1);
  assert.ok(engine.totalOwned('grain') > before);
  assert.equal(plot.cropId, null);
});

test('construction and passive sawmill production share the simulation clock', () => {
  const engine = makeMasteredEngine();
  const character = engine.character;
  character.location = 'willowbrook';
  addCost(engine, engine.getBuildingCost('sawmill'));
  engine.buildBuilding('sawmill');
  engine.addItem('logs_normal', 12, { location: 'bank' });
  const before = engine.stackQty('plank_normal', 'bank');
  finishPassive(engine, (now) => { character.buildings.sawmill.lastProcessedAt = now - 3 * 3_600_000; });
  assert.ok(engine.stackQty('plank_normal', 'bank') >= before + 6);
  assert.ok(engine.stackQty('logs_normal', 'bank') <= 6);
});

test('settlement projects consume contributions and apply regional modifiers', () => {
  const engine = makeMasteredEngine();
  const projectId = 'stonehaven_road';
  const project = DATA.settlementProjects[projectId];
  engine.character.location = project.region;
  const travelBefore = engine.getCombinedModifiers('stonehaven').travelSpeed || 0;
  addCost(engine, project.requirements);
  for (const [resourceId, qty] of Object.entries(project.requirements)) engine.contributeProject(projectId, resourceId, qty);
  assert.equal(engine.character.projects[projectId].complete, true);
  const travelAfter = engine.getCombinedModifiers('stonehaven').travelSpeed || 0;
  assert.ok(travelAfter - travelBefore >= project.effects.travelSpeed);
});

test('companions, expeditions, and research complete through passive processing', () => {
  const engine = makeMasteredEngine();
  const character = engine.character;
  character.location = 'pineglade';
  engine.recruitCompanion('mira');
  engine.startExpedition('mira', 'forest_survey');
  finishPassive(engine, (now) => { character.companions.activeExpeditions[0].endsAt = now - 1; });
  assert.equal(character.companions.activeExpeditions.length, 0);
  assert.ok(character.companions.owned.mira.loyalty > 0);

  character.buildings.library.level = 1;
  addCost(engine, DATA.research.efficient_tools.cost);
  engine.startResearch('efficient_tools');
  finishPassive(engine, (now) => { character.research.active.endsAt = now - 1; });
  assert.ok(character.research.completed.includes('efficient_tools'));
  assert.equal(character.research.active, null);
});

test('trade routes and contracts use regional economy state', () => {
  const engine = makeMasteredEngine();
  const character = engine.character;
  character.location = 'stonehaven';
  engine.addItem('logs_normal', 20);
  const coinsBefore = character.coins;
  engine.startTradeRoute('riverside', 'logs_normal', 5);
  finishPassive(engine, (now) => { character.trade.activeRoutes[0].endsAt = now - 1; });
  assert.equal(character.trade.activeRoutes.length, 0);
  assert.ok(character.coins > coinsBefore);

  engine.ensureTradeContracts(Date.now());
  const contract = character.trade.contracts[0];
  character.location = contract.region;
  engine.addItem(contract.itemId, contract.qty, { location: 'bank' });
  const beforeFulfill = character.coins;
  engine.fulfillContract(contract.id);
  assert.equal(contract.status, 'fulfilled');
  assert.ok(character.coins > beforeFulfill);
});

test('ship construction and voyages resolve rewards and discoveries', () => {
  const engine = makeMasteredEngine();
  const character = engine.character;
  character.location = 'waveport';
  const shipCost = { coins: 3500, ship_timber: 12, ship_fittings: 6, cloth_sail: 5 };
  addCost(engine, shipCost);
  engine.buildShip();
  assert.ok(character.sailing.ship);
  engine.startVoyage('mistbank_isles');
  finishPassive(engine, (now) => { character.sailing.activeVoyage.endsAt = now - 1; });
  assert.equal(character.sailing.activeVoyage, null);
  assert.equal(character.sailing.voyagesCompleted, 1);
  assert.ok(character.discoveredSecrets.includes('mistbank_isles'));
});

test('quests, loadouts, and Chronicle prestige preserve intended state boundaries', () => {
  const engine = makeMasteredEngine();
  const character = engine.character;
  engine.addItem('ore_copper', 8);
  engine.refreshQuestStates();
  assert.equal(character.quests.main_smoke.status, 'ready');
  engine.claimQuest('main_smoke');
  assert.equal(character.quests.main_smoke.status, 'completed');
  assert.equal(character.quests.main_sealed_deep.status, 'available');

  const savedMainHand = character.equipment.mainHand;
  engine.setCombatStyle('ranged');
  engine.saveLoadout('Ranged test');
  const loadout = character.loadouts.at(-1);
  character.equipment.mainHand = null;
  character.combat.style = 'melee';
  character.location = 'stonehaven';
  engine.applyLoadout(loadout.id);
  assert.equal(character.equipment.mainHand, savedMainHand);
  assert.equal(character.combat.style, 'ranged');

  const oldId = character.id;
  engine.beginNewChronicle();
  assert.notEqual(engine.character.id, oldId);
  assert.equal(engine.character.legacy.chronicles, 1);
  assert.equal(engine.character.title, 'Chronicler');
});
