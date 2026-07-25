import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA, EQUIPMENT_SLOTS } from '../src/data.js';

function assertItems(record = {}, label = 'record') {
  for (const id of Object.keys(record || {})) assert.ok(DATA.items[id], `${label} references missing item ${id}`);
}

function assertRewards(rewards = {}, label = 'rewards') {
  assertItems(rewards.items, label);
  for (const id of Object.keys(rewards.xp || {})) assert.ok(DATA.skills[id], `${label} references missing skill ${id}`);
  for (const id of Object.keys(rewards.reputation || {})) assert.ok(DATA.factions[id], `${label} references missing faction ${id}`);
}

test('content registry has the intended breadth', () => {
  assert.ok(Object.keys(DATA.skills).length >= 30);
  assert.ok(Object.keys(DATA.regions).length >= 15);
  assert.ok(Object.keys(DATA.actions).length >= 80);
  assert.ok(Object.keys(DATA.items).length >= 100);
  assert.ok(Object.keys(DATA.quests).length >= 10);
  assert.ok(Object.keys(DATA.worldEvents).length >= 8);
});

test('all skill actions reference valid content', () => {
  for (const [id, action] of Object.entries(DATA.actions)) {
    assert.equal(action.id, id);
    assert.ok(DATA.skills[action.skill], `${id} has missing skill ${action.skill}`);
    assert.ok(action.durationMs > 0, `${id} must take time`);
    assert.ok(action.level >= 1, `${id} must have a level`);
    assert.ok(action.regions?.length, `${id} must have at least one region`);
    for (const region of action.regions) assert.ok(DATA.regions[region], `${id} references missing region ${region}`);
    assertItems(action.inputs, `${id}.inputs`);
    assertItems(action.outputs, `${id}.outputs`);
    for (const drop of action.rare || []) assert.ok(DATA.items[drop.item], `${id} rare table references ${drop.item}`);
  }
});

test('items, enemies, encounters, and abilities are internally consistent', () => {
  for (const [id, item] of Object.entries(DATA.items)) {
    if (item.equipSlot) assert.ok(EQUIPMENT_SLOTS.includes(item.equipSlot), `${id} uses invalid equipment slot ${item.equipSlot}`);
    assert.ok(Number.isFinite(item.value), `${id} must have a value`);
  }
  for (const [id, enemy] of Object.entries(DATA.enemies)) {
    assert.equal(enemy.id, id);
    assert.ok(DATA.regions[enemy.region], `${id} references missing region ${enemy.region}`);
    for (const drop of enemy.drops || []) assert.ok(DATA.items[drop.item], `${id} drops missing item ${drop.item}`);
    for (const ability of enemy.abilities || []) assert.ok(ability.id || typeof ability === 'string', `${id} has malformed ability`);
  }
  for (const [id, encounter] of Object.entries(DATA.encounters)) {
    assert.ok(DATA.regions[encounter.region], `${id} references missing region`);
    for (const enemy of encounter.sequence) assert.ok(DATA.enemies[enemy], `${id} references missing enemy ${enemy}`);
    assertRewards(encounter.reward, `${id}.reward`);
  }
});

test('passive, economy, sailing, and estate content references valid ids', () => {
  for (const [id, crop] of Object.entries(DATA.crops)) {
    assert.ok(DATA.items[crop.seed], `${id} references missing seed`);
    assertItems(Object.fromEntries(Object.keys(crop.yield || {}).map((item) => [item, 1])), `${id}.yield`);
  }
  for (const [id, building] of Object.entries(DATA.buildings)) assertItems(Object.fromEntries(Object.keys(building.baseCost || {}).filter((key) => key !== 'coins').map((key) => [key, 1])), `${id}.baseCost`);
  for (const [id, companion] of Object.entries(DATA.companions)) assert.ok(DATA.regions[companion.region], `${id} references missing region`);
  for (const [id, expedition] of Object.entries(DATA.expeditions)) {
    for (const reward of expedition.rewards || []) assert.ok(DATA.items[reward.item], `${id} references missing reward ${reward.item}`);
    for (const skill of Object.keys(expedition.xp || {})) assert.ok(DATA.skills[skill], `${id} references missing skill ${skill}`);
  }
  for (const [id, research] of Object.entries(DATA.research)) assertItems(Object.fromEntries(Object.keys(research.cost || {}).filter((key) => key !== 'coins').map((key) => [key, 1])), `${id}.cost`);
  for (const [id, project] of Object.entries(DATA.settlementProjects)) {
    assert.ok(DATA.regions[project.region], `${id} references missing region`);
    assertItems(Object.fromEntries(Object.keys(project.requirements || {}).filter((key) => key !== 'coins').map((key) => [key, 1])), `${id}.requirements`);
  }
  for (const [id, voyage] of Object.entries(DATA.voyages)) for (const reward of voyage.rewards || []) assert.ok(DATA.items[reward.item], `${id} references missing voyage reward ${reward.item}`);
  for (const [id, template] of Object.entries(DATA.tradeContractTemplates)) {
    assert.ok(DATA.items[template.item], `${id} references missing trade item`);
    assert.ok(DATA.factions[template.faction], `${id} references missing faction`);
    for (const region of template.regions) assert.ok(DATA.regions[region], `${id} references missing region`);
  }
});

test('quests, backgrounds, achievements, and events are internally consistent', () => {
  for (const [id, quest] of Object.entries(DATA.quests)) {
    assert.ok(DATA.regions[quest.region], `${id} references missing region`);
    for (const objective of quest.objectives || []) {
      if (objective.region) assert.ok(DATA.regions[objective.region], `${id} objective references missing region`);
      if (objective.item) assert.ok(DATA.items[objective.item], `${id} objective references missing item`);
      if (objective.skill) assert.ok(DATA.skills[objective.skill], `${id} objective references missing skill`);
      if (objective.enemy) assert.ok(DATA.enemies[objective.enemy], `${id} objective references missing enemy`);
      if (objective.faction) assert.ok(DATA.factions[objective.faction], `${id} objective references missing faction`);
    }
    assertRewards(quest.rewards, `${id}.rewards`);
    for (const choice of quest.choices || []) assertRewards(choice.rewards, `${id}.${choice.id}.rewards`);
    for (const unlocked of quest.unlocks || []) assert.ok(DATA.quests[unlocked] || DATA.regions[unlocked] || DATA.actions[unlocked], `${id} unlock references unknown id ${unlocked}`);
  }
  for (const [id, background] of Object.entries(DATA.backgrounds)) {
    if (background.startRegion) assert.ok(DATA.regions[background.startRegion], `${id} references missing start region`);
    assertItems(background.items, `${id}.items`);
    for (const skill of Object.keys(background.startingXp || {})) assert.ok(DATA.skills[skill], `${id} references missing skill`);
    for (const faction of Object.keys(background.reputation || {})) assert.ok(DATA.factions[faction], `${id} references missing faction`);
  }
  for (const event of Object.values(DATA.worldEvents)) for (const region of event.regions || []) assert.ok(DATA.regions[region], `event ${event.name} references missing region ${region}`);
  for (const achievement of Object.values(DATA.achievements)) assertRewards(achievement.reward, `achievement ${achievement.name}`);
});
