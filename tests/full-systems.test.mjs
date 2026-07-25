import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from '../src/data.js';
import { GameEngine } from '../src/engine.js';
import { createEmptyAccount, normalizeAccount } from '../src/state.js';
import { xpForLevel } from '../src/utils.js';

function masteredEngine(options = {}) {
  const engine = new GameEngine(createEmptyAccount());
  engine.createCharacter(0, { name: 'System Tester', difficulty: options.difficulty || 'relaxed' });
  for (const skill of Object.keys(DATA.skills)) engine.character.xp[skill] = xpForLevel(99);
  engine.character.currentHp = engine.getMaxHp();
  engine.character.buildings.house.level = 5;
  engine.character.buildings.cellar.level = 5;
  return engine;
}

test('every defined skill action can complete at least once', () => {
  for (const [id, action] of Object.entries(DATA.actions)) {
    const engine = masteredEngine();
    const character = engine.character;
    character.location = action.regions[0];
    character.discoveredRegions = [...new Set([...character.discoveredRegions, character.location])];
    const attempts = action.failureChance ? 20 : 1;
    for (const [itemId, qty] of Object.entries(action.inputs || {})) {
      const result = engine.addItem(itemId, Math.max(10, qty * (attempts + 2)), { allowBankFallback: true });
      assert.equal(result.lost, 0, `${id} test inputs should fit`);
    }
    engine.startSkillAction(id);
    // Allow headroom for a world event that begins during advanceTo() and
    // changes the action duration after the initial estimate is calculated.
    engine.advanceTo(character.lastProcessedAt + engine.getActionDuration(action) * (attempts + 2) + 10, { offline: true });
    assert.ok((character.stats.actionCounts[id] || 0) >= 1, `${id} did not complete`);
  }
});

test('every enemy can resolve through the shared combat simulation', () => {
  for (const [id, enemy] of Object.entries(DATA.enemies)) {
    const engine = masteredEngine();
    const character = engine.character;
    character.location = enemy.region;
    character.discoveredRegions = [...new Set([...character.discoveredRegions, enemy.region])];
    character.combat.automation.allowOfflineCombat = true;
    character.combat.automation.autoEat = false;
    character.combat.automation.fleeBelowPercent = 0;
    engine.startCombat(id);
    // Give the harness an oversized health buffer after combat initialization.
    // This test validates every enemy definition and the shared round/loot
    // pipeline independently of consumable loadouts and stochastic endurance.
    character.currentHp = engine.getMaxHp() * 100;
    for (let tick = 0; tick < 40 && (character.collections.monsters[id] || 0) < 1; tick += 1) {
      engine.advanceTo(character.lastProcessedAt + 10_000, { offline: false });
      character.currentHp = Math.max(character.currentHp, engine.getMaxHp() * 100);
    }
    assert.ok((character.collections.monsters[id] || 0) >= 1, `${id} could not be defeated by a mastered test character`);
  }
});

test('stored data-only content packs are restored before character normalization', () => {
  const account = createEmptyAccount();
  account.mods.push({
    id: 'test-pack',
    name: 'Test Pack',
    pack: {
      id: 'test-pack',
      items: { test_relic: { name: 'Test Relic', icon: '✦', value: 1, stackable: true, rarity: 'common', tags: ['test'] } },
      actions: {}, enemies: {}, quests: {}, worldEvents: {},
    },
  });
  const normalized = normalizeAccount(account);
  assert.equal(normalized.mods[0].loadError, null);
  assert.equal(DATA.items.test_relic.name, 'Test Relic');
});
