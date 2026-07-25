import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyAccount } from '../src/state.js';
import { GameEngine } from '../src/engine.js';

function makeEngine() {
  const account = createEmptyAccount();
  const engine = new GameEngine(account);
  engine.createCharacter(0, { name: 'Tester', background: 'stonehaven_apprentice', difficulty: 'standard', seed: 12345 });
  return engine;
}

test('creates a playable character with persistent systems', () => {
  const engine = makeEngine();
  assert.equal(engine.character.name, 'Tester');
  assert.ok(engine.character.inventory.instances.length >= 3);
  assert.equal(engine.character.location, 'stonehaven');
  assert.equal(engine.character.farming.plots.length, 2);
});

test('skill actions progress in batches and grant mastery', () => {
  const engine = makeEngine();
  engine.startSkillAction('mine_copper');
  const started = engine.character.lastProcessedAt;
  engine.advanceTo(started + 30_000, { offline: false });
  assert.ok(engine.stackQty('ore_copper') > 8);
  assert.ok(engine.character.mastery.actions.mine_copper > 0);
  assert.ok(engine.character.stats.actionsCompleted > 0);
});

test('travel discovers a region', () => {
  const engine = makeEngine();
  engine.startTravel('riverside');
  const duration = engine.character.activity.totalMs;
  engine.advanceTo(engine.character.lastProcessedAt + duration + 1, { offline: true });
  assert.equal(engine.character.location, 'riverside');
  assert.ok(engine.character.discoveredRegions.includes('riverside'));
});

test('inventory transactions remain atomic when full', () => {
  const engine = makeEngine();
  const character = engine.character;
  character.inventory.stacks = {};
  character.inventory.instances = [];
  for (let i = 0; i < engine.getInventoryCapacity(); i += 1) {
    character.inventory.stacks[`fake_${i}`] = 1;
  }
  // Fake ids still occupy slots in raw state; a new real stack should fail without mutation.
  const before = JSON.stringify(character.inventory.stacks);
  const result = engine.addItem('ore_copper', 1);
  assert.equal(result.added, 0);
  assert.equal(JSON.stringify(character.inventory.stacks), before);
});

test('combat can resolve repeated rounds without corrupting state', () => {
  const engine = makeEngine();
  engine.startCombat('hill_goblin');
  const start = engine.character.lastProcessedAt;
  engine.advanceTo(start + 120_000, { offline: false });
  assert.ok(engine.character.stats.kills >= 0);
  assert.ok(Number.isFinite(engine.character.currentHp));
});
