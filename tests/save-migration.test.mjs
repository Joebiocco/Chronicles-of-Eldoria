import test from 'node:test';
import assert from 'node:assert/strict';

import { parseImportPayload } from '../src/state.js';

test('SimpleScape V15 character JSON migrates into the Eldoria save schema', () => {
  const legacy = {
    version: 1,
    player: {
      name: 'Legacy Miner',
      xp: {
        woodcutting: 1234,
        mining: 5678,
        fishing: 321,
        cooking: 222,
        smithing: 444,
        attack: 333,
        strength: 222,
        defence: 111,
        hitpoints: 777,
      },
      currentHp: 74,
      coins: 9876,
      equipment: { weapon: 'sword_bronze', armor: 'armor_bronze' },
    },
    inventory: { logs_normal: 12, ore_copper: 8, fish_shrimp_cooked: 3 },
    bank: { ore_tin: 25, bones: 5 },
    activity: { type: 'combat', monsterId: 'goblin' },
    log: [],
  };

  const imported = parseImportPayload(JSON.stringify(legacy));
  assert.equal(imported.type, 'character');
  const character = imported.value;
  assert.equal(character.name, 'Legacy Miner');
  assert.equal(character.flags.importedFromSimpleScapeV15, true);
  assert.equal(character.coins, 9876);
  assert.equal(character.xp.woodcutting, 1234);
  assert.equal(character.xp.vitality, 777);
  assert.equal(character.inventory.stacks.logs_normal, 12);
  assert.equal(character.bank.stacks.ore_tin, 25);

  const mainHand = character.inventory.instances.find((item) => item.uid === character.equipment.mainHand);
  const chest = character.inventory.instances.find((item) => item.uid === character.equipment.chest);
  assert.equal(mainHand?.itemId, 'sword_bronze');
  assert.equal(chest?.itemId, 'chest_iron');
  assert.equal(character.activity, null, 'unsafe legacy combat should not resume automatically');
});
