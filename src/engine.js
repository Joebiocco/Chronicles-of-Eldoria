import { DATA, EQUIPMENT_SLOTS, REGION_PRICE_PROFILES } from './data.js';
import { createItemInstance, createNewCharacter, normalizeAccount, normalizeCharacter } from './state.js';
import { installMemorySystems } from './memory-systems.js';
import {
  clamp,
  deepClone,
  formatDuration,
  hashString,
  levelFromXp,
  masteryLevelFromXp,
  mergeQuantities,
  mulberry32,
  randomInt,
  rollBinomial,
  safeUUID,
  seededRandom,
  shortestPath,
  xpForLevel,
} from './utils.js';

const QUALITY_MULTIPLIER = {
  crude: 0.86,
  standard: 1,
  fine: 1.08,
  superior: 1.18,
  masterwork: 1.32,
  legendary: 1.5,
};

const QUALITY_ORDER = ['crude', 'standard', 'fine', 'superior', 'masterwork', 'legendary'];
const OFFLINE_REPORT_THRESHOLD = 12_000;
const MAX_ACTIVITY_BATCH = 100_000;
const MAX_COMBAT_ROUNDS_PER_ADVANCE = 50_000;

export class GameEngine extends EventTarget {
  constructor(account) {
    super();
    this.account = normalizeAccount(account);
    this.activeSlot = this.account.activeSlot;
    this._lastMeaningfulChange = Date.now();
  }

  get character() {
    if (this.activeSlot === null || !this.account.slots[this.activeSlot]) return null;
    return this.account.slots[this.activeSlot];
  }

  setAccount(account) {
    this.account = normalizeAccount(account);
    this.activeSlot = this.account.activeSlot;
    this.emit('account-changed', { reason: 'replace' });
  }

  selectSlot(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2 || !this.account.slots[slot]) throw new Error('That character slot is empty.');
    this.activeSlot = slot;
    this.account.activeSlot = slot;
    this.account.updatedAt = Date.now();
    this.emit('character-selected', { slot });
  }

  createCharacter(slot, options) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Invalid character slot.');
    if (this.account.slots[slot]) throw new Error('That character slot is already occupied.');
    this.account.slots[slot] = createNewCharacter(options);
    this.selectSlot(slot);
    this.touch('character-created', { slot }, true);
    return this.character;
  }

  replaceCharacter(slot, character) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Invalid character slot.');
    this.account.slots[slot] = normalizeCharacter(character);
    this.selectSlot(slot);
    this.touch('character-imported', { slot }, true);
  }

  deleteCharacter(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) return;
    this.account.slots[slot] = null;
    if (this.activeSlot === slot) this.activeSlot = null;
    this.account.activeSlot = this.activeSlot;
    this.touch('character-deleted', { slot }, true);
  }

  renameCharacter(name) {
    const character = this.requireCharacter();
    const clean = String(name || '').trim().slice(0, 24);
    if (!clean) throw new Error('Enter a character name.');
    character.name = clean;
    this.touch('character-renamed', { name: clean }, true);
  }

  requireCharacter() {
    const character = this.character;
    if (!character) throw new Error('Choose or create a character first.');
    return character;
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  touch(reason, detail = {}, urgent = false) {
    const character = this.character;
    if (character) {
      character.revision = Math.max(1, Number(character.revision) || 1) + 1;
      character.updatedAt = Date.now();
    }
    this.account.updatedAt = Date.now();
    this._lastMeaningfulChange = Date.now();
    this.emit('change', { reason, urgent, ...detail });
  }

  getSkillLevel(skillId) {
    return levelFromXp(this.character?.xp?.[skillId] || 0, 99);
  }

  getTotalLevel() {
    const character = this.character;
    if (!character) return 0;
    return Object.keys(DATA.skills).reduce((sum, id) => sum + levelFromXp(character.xp[id] || 0, 99), 0);
  }

  getCharacterLevel() {
    const character = this.character;
    if (!character) return 1;
    const combatSkills = ['attack', 'strength', 'defence', 'vitality', 'ranged', 'sorcery', 'faith', 'slayer'];
    const xp = combatSkills.reduce((sum, id) => sum + (character.xp[id] || 0), 0) / 4;
    return levelFromXp(xp, 99);
  }

  getActionMastery(actionId) {
    return masteryLevelFromXp(this.character?.mastery?.actions?.[actionId] || 0);
  }

  getMasteryPool(skillId) {
    return this.character?.mastery?.pools?.[skillId] || 0;
  }

  getWorldEvent(at = Date.now()) {
    const character = this.character;
    if (!character) return null;
    const eventIds = Object.keys(DATA.worldEvents);
    const epochMs = 6 * 60 * 60 * 1000;
    const epoch = Math.floor(at / epochMs);
    const index = hashString(`${character.worldSeed}:event:${epoch}`) % eventIds.length;
    const id = eventIds[index];
    return { id, ...DATA.worldEvents[id], startsAt: epoch * epochMs, endsAt: (epoch + 1) * epochMs };
  }

  getWeather(regionId = this.character?.location, at = Date.now()) {
    const character = this.character;
    const region = DATA.regions[regionId];
    if (!character || !region) return { id: 'clear', ...DATA.weather.clear };
    const profile = {
      mountain: ['clear', 'fog', 'snow', 'rain'],
      underground: ['clear', 'fog', 'clear', 'clear'],
      forest: ['clear', 'rain', 'fog', 'clear'],
      river: ['clear', 'rain', 'storm', 'fog'],
      lake: ['clear', 'rain', 'storm', 'fog'],
      volcanic: ['ash', 'clear', 'ash', 'storm'],
      corrupted: ['corruption', 'fog', 'corruption', 'storm'],
      coast: ['clear', 'rain', 'storm', 'fog'],
      temperate: ['clear', 'rain', 'clear', 'fog'],
    }[region.weatherProfile] || ['clear'];
    const epoch = Math.floor(at / 3600000);
    const id = profile[hashString(`${character.worldSeed}:weather:${regionId}:${epoch}`) % profile.length];
    return { id, ...DATA.weather[id] };
  }

  getCombinedModifiers(regionId = this.character?.location, at = Date.now()) {
    const character = this.character;
    const modifiers = {};
    if (!character) return modifiers;
    const add = (source) => {
      for (const [key, value] of Object.entries(source || {})) modifiers[key] = (modifiers[key] || 0) + Number(value || 0);
    };
    const event = this.getWorldEvent(at);
    if (event?.regions?.includes(regionId)) add(event.modifiers);
    add(this.getWeather(regionId, at).modifiers);
    for (const researchId of character.research.completed) add(DATA.research[researchId]?.effect);
    for (const [projectId, state] of Object.entries(character.projects || {})) if (state.complete) add(DATA.settlementProjects[projectId]?.effects);
    const buildings = character.buildings || {};
    for (const [buildingId, state] of Object.entries(buildings)) {
      const effect = DATA.buildings[buildingId]?.effects;
      if (!effect || !state.level) continue;
      for (const [key, value] of Object.entries(effect)) modifiers[key] = (modifiers[key] || 0) + Number(value || 0) * state.level;
    }
    for (const perk of character.legacy.perks || []) add(perk.modifiers);
    return modifiers;
  }

  getCurrentRegion() {
    return DATA.regions[this.character?.location] || null;
  }

  getAvailableActions(skillId, regionId = this.character?.location) {
    return Object.values(DATA.actions).filter((action) => action.skill === skillId && (!action.regions?.length || action.regions.includes(regionId)));
  }

  getActionDuration(actionOrId, at = Date.now()) {
    const character = this.requireCharacter();
    const action = typeof actionOrId === 'string' ? DATA.actions[actionOrId] : actionOrId;
    if (!action) return 0;
    const skillLevel = this.getSkillLevel(action.skill);
    const mastery = this.getActionMastery(action.id);
    const modifiers = this.getCombinedModifiers(character.location, at);
    let speed = skillLevel * 0.08 + mastery * 0.14;
    const skillSpeedKey = `${action.skill}Speed`;
    speed += modifiers[skillSpeedKey] || 0;
    if (['woodcutting', 'mining', 'fishing', 'foraging', 'hunting', 'archaeology'].includes(action.skill)) speed += modifiers.gatheringSpeed || 0;
    if (['cooking', 'smithing', 'crafting', 'fletching', 'tailoring', 'herblore', 'runecrafting', 'enchanting', 'construction'].includes(action.skill)) speed += modifiers.productionSpeed || 0;
    const equipmentStats = this.getEquipmentStats();
    speed += equipmentStats[skillSpeedKey] || 0;
    if (action.skill === 'summoning') speed += modifiers.summoningSpeed || 0;
    return Math.max(500, Math.round(action.durationMs / (1 + speed / 100)));
  }

  getEquipmentStats() {
    const character = this.character;
    const totals = {};
    if (!character) return totals;
    for (const slot of EQUIPMENT_SLOTS) {
      if (slot === 'familiar') continue;
      const uid = character.equipment[slot];
      if (!uid) continue;
      const found = this.findInstance(uid);
      if (!found) continue;
      const item = DATA.items[found.instance.itemId];
      if (!item) continue;
      const quality = QUALITY_MULTIPLIER[found.instance.quality] || 1;
      const durability = clamp((found.instance.durability ?? 100) / 100, 0.35, 1);
      for (const [stat, value] of Object.entries(item.stats || {})) totals[stat] = (totals[stat] || 0) + Number(value) * quality * durability;
      for (const affix of found.instance.affixes || []) if (affix?.stat) totals[affix.stat] = (totals[affix.stat] || 0) + Number(affix.value || 0);
    }
    const familiar = character.equipment.familiar;
    if (familiar === 'forager_wisp') {
      totals.foragingSpeed = (totals.foragingSpeed || 0) + 6;
      totals.rareFind = (totals.rareFind || 0) + 2;
    }
    if (familiar === 'emberling') {
      totals.fireDamage = (totals.fireDamage || 0) + 14;
      totals.fireResist = (totals.fireResist || 0) + 12;
    }
    return totals;
  }

  getMaxHp() {
    const character = this.character;
    if (!character) return 100;
    const vitality = this.getSkillLevel('vitality');
    const equipment = this.getEquipmentStats();
    const research = this.getCombinedModifiers(character.location).health || 0;
    return Math.round(75 + vitality * 8 + (equipment.health || 0) + research);
  }

  getCombatStats() {
    const character = this.requireCharacter();
    const style = character.combat.style;
    const equipment = this.getEquipmentStats();
    const levels = Object.fromEntries(['attack', 'strength', 'defence', 'vitality', 'ranged', 'sorcery', 'faith', 'slayer'].map((id) => [id, this.getSkillLevel(id)]));
    const base = {
      style,
      maxHp: this.getMaxHp(),
      armor: levels.defence * 1.05 + (equipment.armor || 0),
      evasion: levels.defence * 0.65 + (equipment.evasion || 0),
      block: equipment.block || 0,
      critChance: 4 + (equipment.critChance || 0),
      critDamage: 50 + (equipment.critDamage || 0),
      attackSpeedMs: clamp(2500 - (equipment.attackSpeed || 0) * 18, 900, 4000),
      staminaMax: 100 + Math.floor(levels.strength * 0.5),
      manaMax: 100 + (equipment.mana || 0) + levels.sorcery,
      healingPower: levels.faith * 0.7 + (equipment.healingPower || 0),
      resistances: {
        slash: equipment.slashResist || 0,
        pierce: equipment.pierceResist || 0,
        crush: equipment.crushResist || 0,
        fire: (equipment.fireResist || 0) + (this.getCombinedModifiers(character.location).fireResist || 0),
        frost: equipment.frostResist || 0,
        storm: equipment.stormResist || 0,
        venom: equipment.poisonResist || 0,
        radiant: equipment.radiantResist || 0,
        shadow: equipment.shadowResist || 0,
        arcane: equipment.arcaneResist || 0,
      },
    };
    const allResist = equipment.allResist || 0;
    for (const key of Object.keys(base.resistances)) base.resistances[key] += allResist;

    if (style === 'ranged') {
      base.accuracy = levels.ranged * 2.15 + (equipment.rangedAccuracy || 0) + (equipment.accuracy || 0);
      base.damage = 5 + levels.ranged * 0.72 + (equipment.rangedDamage || 0);
      base.damageType = 'pierce';
    } else if (style === 'sorcery') {
      base.accuracy = levels.sorcery * 2.2 + (equipment.sorceryAccuracy || 0) + (equipment.accuracy || 0);
      base.damage = 6 + levels.sorcery * 0.78 + (equipment.magicDamage || 0);
      base.damageType = this.hasStack('rune_fire', 1) ? 'fire' : 'arcane';
    } else if (style === 'faith') {
      base.accuracy = levels.faith * 2.05 + (equipment.faithPower || 0) + (equipment.accuracy || 0);
      base.damage = 4 + levels.faith * 0.68 + (equipment.faithPower || 0);
      base.damageType = 'radiant';
    } else {
      base.accuracy = levels.attack * 2.1 + (equipment.accuracy || 0);
      base.damage = 5 + levels.strength * 0.75 + (equipment.physicalDamage || 0);
      base.damageType = this.getEquippedWeapon()?.damageType || 'slash';
    }
    base.damage += equipment[`${base.damageType}Damage`] || 0;
    return base;
  }

  getEquippedWeapon() {
    const uid = this.character?.equipment?.mainHand;
    const found = uid ? this.findInstance(uid) : null;
    return found ? DATA.items[found.instance.itemId] : null;
  }

  getInventoryCapacity() {
    const character = this.character;
    if (!character) return 28;
    return 28 + (character.buildings.cellar?.level || 0) * 3 + Math.floor((this.getSkillLevel('construction') - 1) / 20);
  }

  getBankCapacity() {
    const character = this.character;
    if (!character) return 120;
    return 120 + (character.buildings.house?.level || 0) * 25;
  }

  getContainerSlots(container) {
    return Object.values(container.stacks || {}).filter((qty) => qty > 0).length + (container.instances?.length || 0);
  }

  stackQty(itemId, location = 'inventory') {
    const character = this.character;
    if (!character) return 0;
    return Number(character[location]?.stacks?.[itemId]) || 0;
  }

  totalOwned(itemId) {
    const character = this.character;
    if (!character) return 0;
    const item = DATA.items[itemId];
    if (!item) return 0;
    if (item.stackable === false) {
      return [...character.inventory.instances, ...character.bank.instances].filter((instance) => instance.itemId === itemId).length;
    }
    return this.stackQty(itemId, 'inventory') + this.stackQty(itemId, 'bank');
  }

  hasStack(itemId, qty = 1, includeBank = false) {
    return (includeBank ? this.totalOwned(itemId) : this.stackQty(itemId)) >= qty;
  }

  findInstance(uid) {
    const character = this.character;
    if (!character || !uid) return null;
    for (const location of ['inventory', 'bank']) {
      const index = character[location].instances.findIndex((instance) => instance.uid === uid);
      if (index >= 0) return { location, index, instance: character[location].instances[index] };
    }
    return null;
  }

  isEquipped(uid) {
    return Object.values(this.character?.equipment || {}).includes(uid);
  }

  canFit(containerName, consume = {}, produce = {}, instanceCount = 0) {
    const character = this.requireCharacter();
    const source = character[containerName];
    const stacks = { ...source.stacks };
    for (const [id, qty] of Object.entries(consume || {})) {
      stacks[id] = (stacks[id] || 0) - qty;
      if (stacks[id] <= 0) delete stacks[id];
    }
    for (const [id, qty] of Object.entries(produce || {})) {
      if (qty <= 0) continue;
      stacks[id] = (stacks[id] || 0) + qty;
    }
    const used = Object.keys(stacks).length + source.instances.length + instanceCount;
    const capacity = containerName === 'inventory' ? this.getInventoryCapacity() : this.getBankCapacity();
    return used <= capacity;
  }

  applyStackTransaction(containerName, consume = {}, produce = {}) {
    const character = this.requireCharacter();
    const container = character[containerName];
    for (const [id, qty] of Object.entries(consume || {})) if ((container.stacks[id] || 0) < qty) return false;
    if (!this.canFit(containerName, consume, produce, 0)) return false;
    for (const [id, qty] of Object.entries(consume || {})) {
      container.stacks[id] -= qty;
      if (container.stacks[id] <= 0) delete container.stacks[id];
    }
    for (const [id, qty] of Object.entries(produce || {})) {
      if (qty <= 0) continue;
      container.stacks[id] = (container.stacks[id] || 0) + qty;
      this.recordItemFound(id, qty);
    }
    return true;
  }

  addItem(itemId, qty = 1, { location = 'inventory', quality, affixes, allowBankFallback = false } = {}) {
    const character = this.requireCharacter();
    const item = DATA.items[itemId];
    if (!item || qty <= 0) return { added: 0, lost: qty };
    let added = 0;
    if (item.stackable !== false) {
      const target = character[location];
      if (this.canFit(location, {}, { [itemId]: qty }, 0)) {
        target.stacks[itemId] = (target.stacks[itemId] || 0) + qty;
        added = qty;
      } else if (allowBankFallback && location !== 'bank' && this.canFit('bank', {}, { [itemId]: qty }, 0)) {
        character.bank.stacks[itemId] = (character.bank.stacks[itemId] || 0) + qty;
        added = qty;
      }
    } else {
      for (let i = 0; i < qty; i += 1) {
        let targetName = location;
        if (!this.canFit(targetName, {}, {}, 1) && allowBankFallback && targetName !== 'bank' && this.canFit('bank', {}, {}, 1)) targetName = 'bank';
        if (!this.canFit(targetName, {}, {}, 1)) break;
        character[targetName].instances.push(createItemInstance(itemId, { quality, affixes }));
        added += 1;
      }
    }
    if (added) this.recordItemFound(itemId, added);
    return { added, lost: Math.max(0, qty - added) };
  }

  removeStack(itemId, qty, location = 'inventory') {
    const character = this.requireCharacter();
    const container = character[location];
    const amount = Math.min(Math.max(0, qty), container.stacks[itemId] || 0);
    if (!amount) return 0;
    container.stacks[itemId] -= amount;
    if (container.stacks[itemId] <= 0) delete container.stacks[itemId];
    return amount;
  }

  consumeAcrossStorage(cost) {
    const character = this.requireCharacter();
    for (const [itemId, qty] of Object.entries(cost || {})) {
      if (itemId === 'coins' || qty <= 0) continue;
      if (this.totalOwned(itemId) < qty) return false;
    }
    if ((cost.coins || 0) > character.coins) return false;
    for (const [itemId, qtyRaw] of Object.entries(cost || {})) {
      const qty = Number(qtyRaw) || 0;
      if (qty <= 0) continue;
      if (itemId === 'coins') {
        character.coins -= qty;
        character.stats.coinsSpent += qty;
        continue;
      }
      const item = DATA.items[itemId];
      if (item?.stackable === false) {
        let remaining = qty;
        for (const location of ['inventory', 'bank']) {
          for (let index = character[location].instances.length - 1; index >= 0 && remaining > 0; index -= 1) {
            const instance = character[location].instances[index];
            if (instance.itemId === itemId && !this.isEquipped(instance.uid) && !instance.locked) {
              character[location].instances.splice(index, 1);
              remaining -= 1;
            }
          }
        }
        if (remaining > 0) return false;
      } else {
        let remaining = qty;
        const fromInventory = this.removeStack(itemId, remaining, 'inventory');
        remaining -= fromInventory;
        if (remaining > 0) this.removeStack(itemId, remaining, 'bank');
      }
    }
    return true;
  }

  recordItemFound(itemId, qty = 1) {
    const character = this.character;
    if (!character || !DATA.items[itemId] || qty <= 0) return;
    if (!character.collections.items.includes(itemId)) character.collections.items.push(itemId);
    if (DATA.items[itemId].tags?.includes('artifact') && !character.collections.artifacts.includes(itemId)) character.collections.artifacts.push(itemId);
    character.stats.itemsFound[itemId] = (character.stats.itemsFound[itemId] || 0) + qty;
  }

  depositStack(itemId, qty = Infinity) {
    const character = this.requireCharacter();
    const amount = Math.min(this.stackQty(itemId), Number.isFinite(qty) ? qty : this.stackQty(itemId));
    if (!amount) return 0;
    if (!this.canFit('bank', {}, { [itemId]: amount }, 0)) throw new Error('The bank is full.');
    this.removeStack(itemId, amount, 'inventory');
    character.bank.stacks[itemId] = (character.bank.stacks[itemId] || 0) + amount;
    this.touch('bank-deposit', { itemId, amount });
    return amount;
  }

  withdrawStack(itemId, qty = Infinity) {
    const character = this.requireCharacter();
    const available = this.stackQty(itemId, 'bank');
    const amount = Math.min(available, Number.isFinite(qty) ? qty : available);
    if (!amount) return 0;
    if (!this.canFit('inventory', {}, { [itemId]: amount }, 0)) throw new Error('The inventory is full.');
    this.removeStack(itemId, amount, 'bank');
    character.inventory.stacks[itemId] = (character.inventory.stacks[itemId] || 0) + amount;
    this.touch('bank-withdraw', { itemId, amount });
    return amount;
  }

  depositInstance(uid) {
    const character = this.requireCharacter();
    const found = this.findInstance(uid);
    if (!found || found.location !== 'inventory') throw new Error('That item is not in your inventory.');
    if (this.isEquipped(uid)) throw new Error('Unequip the item before depositing it.');
    if (!this.canFit('bank', {}, {}, 1)) throw new Error('The bank is full.');
    character.inventory.instances.splice(found.index, 1);
    character.bank.instances.push(found.instance);
    this.touch('bank-deposit-instance', { uid });
  }

  withdrawInstance(uid) {
    const character = this.requireCharacter();
    const found = this.findInstance(uid);
    if (!found || found.location !== 'bank') throw new Error('That item is not in the bank.');
    if (!this.canFit('inventory', {}, {}, 1)) throw new Error('The inventory is full.');
    character.bank.instances.splice(found.index, 1);
    character.inventory.instances.push(found.instance);
    this.touch('bank-withdraw-instance', { uid });
  }

  depositAll() {
    const character = this.requireCharacter();
    for (const [itemId, qty] of Object.entries({ ...character.inventory.stacks })) {
      if (this.canFit('bank', {}, { [itemId]: qty }, 0)) {
        character.bank.stacks[itemId] = (character.bank.stacks[itemId] || 0) + qty;
        delete character.inventory.stacks[itemId];
      }
    }
    for (let index = character.inventory.instances.length - 1; index >= 0; index -= 1) {
      const instance = character.inventory.instances[index];
      if (this.isEquipped(instance.uid) || instance.locked || !this.canFit('bank', {}, {}, 1)) continue;
      character.inventory.instances.splice(index, 1);
      character.bank.instances.push(instance);
    }
    this.touch('bank-deposit-all');
  }

  equipInstance(uid) {
    const character = this.requireCharacter();
    const found = this.findInstance(uid);
    if (!found || found.location !== 'inventory') throw new Error('Withdraw that item before equipping it.');
    const item = DATA.items[found.instance.itemId];
    if (!item?.equipSlot) throw new Error('That item cannot be equipped.');
    character.equipment[item.equipSlot] = uid;
    this.touch('equipment-changed', { slot: item.equipSlot, uid });
  }

  unequipSlot(slot) {
    const character = this.requireCharacter();
    if (!EQUIPMENT_SLOTS.includes(slot)) return;
    character.equipment[slot] = null;
    this.touch('equipment-changed', { slot, uid: null });
  }

  toggleItemLock(uid) {
    const found = this.findInstance(uid);
    if (!found) return;
    found.instance.locked = !found.instance.locked;
    this.touch('item-lock', { uid, locked: found.instance.locked });
  }

  salvageInstance(uid) {
    const character = this.requireCharacter();
    if ((character.buildings.workshop?.level || 0) < 1) throw new Error('Build a Workshop before salvaging equipment.');
    const found = this.findInstance(uid);
    if (!found || found.location !== 'inventory') throw new Error('The item must be in your inventory.');
    if (this.isEquipped(uid)) throw new Error('Unequip the item before salvaging it.');
    if (found.instance.locked) throw new Error('Unlock the item before salvaging it.');
    const item = DATA.items[found.instance.itemId];
    const value = item?.value || 0;
    const materials = {};
    if (item?.tags?.includes('weapon') || item?.tags?.includes('armor')) materials.bar_iron = Math.max(1, Math.floor(value / 160));
    if (item?.tags?.includes('leather')) materials.leather = Math.max(1, Math.floor(value / 80));
    if (item?.tags?.includes('magic')) materials.rune_blank = Math.max(1, Math.floor(value / 260));
    if (!Object.keys(materials).length) materials.stone = Math.max(1, Math.floor(value / 100));
    if (!this.canFit('inventory', {}, materials, 0)) throw new Error('Free an inventory slot before salvaging.');
    character.inventory.instances.splice(found.index, 1);
    this.applyStackTransaction('inventory', {}, materials);
    this.addXp('crafting', Math.max(10, value * 0.15));
    this.touch('item-salvaged', { uid, materials }, true);
    return materials;
  }

  useConsumable(itemId) {
    const character = this.requireCharacter();
    const item = DATA.items[itemId];
    if (!item || !this.hasStack(itemId, 1)) throw new Error('You do not have that item.');
    if (!item.heal && !item.buff && !item.cleanse) throw new Error('That item cannot be used directly.');
    this.removeStack(itemId, 1);
    if (item.heal) {
      const healingBonus = this.getCombinedModifiers(character.location).healingPower || 0;
      const amount = Math.round(item.heal * (1 + healingBonus / 100));
      const before = character.currentHp;
      character.currentHp = Math.min(this.getMaxHp(), character.currentHp + amount);
      character.stats.healingDone += character.currentHp - before;
    }
    if (item.cleanse && character.activity?.kind === 'combat') {
      character.activity.playerStatuses = (character.activity.playerStatuses || []).filter((status) => !item.cleanse.includes(status.id));
    }
    if (item.buff) {
      character.buffs = character.buffs.filter((buff) => buff.source !== itemId);
      character.buffs.push({ source: itemId, modifiers: deepClone(item.buff), expiresAt: Date.now() + (item.buff.durationMs || 600000) });
    }
    this.touch('consumable-used', { itemId }, true);
  }

  setCombatStyle(style) {
    const character = this.requireCharacter();
    if (!['melee', 'ranged', 'sorcery', 'faith'].includes(style)) throw new Error('Unknown combat style.');
    character.combat.style = style;
    this.touch('combat-style', { style });
  }

  updateAutomation(patch) {
    const character = this.requireCharacter();
    character.combat.automation = { ...character.combat.automation, ...patch };
    this.touch('automation-updated', { patch }, true);
  }

  setAbilityLoadout(style, abilityIds) {
    const character = this.requireCharacter();
    if (!['melee', 'ranged', 'sorcery', 'faith'].includes(style)) return;
    character.combat.abilityLoadouts[style] = [...new Set(abilityIds.filter((id) => DATA.abilities[id]))].slice(0, 4);
    this.touch('ability-loadout', { style }, true);
  }

  startSkillAction(actionId) {
    const character = this.requireCharacter();
    const action = DATA.actions[actionId];
    if (!action) throw new Error('Unknown action.');
    if (!action.regions?.includes(character.location)) throw new Error(`Travel to a location where ${action.name} is available.`);
    if (this.getSkillLevel(action.skill) < action.level) throw new Error(`Requires ${DATA.skills[action.skill].name} level ${action.level}.`);
    if (character.flags.deceased) throw new Error('This Hardcore Chronicle has ended.');
    character.activity = {
      kind: 'skill',
      actionId,
      startedAt: Date.now(),
      progressMs: 0,
      completed: 0,
      rareBoost: 0,
      activePromptAt: Date.now() + randomInt(seededRandom(character.worldSeed, actionId, Date.now()), 10000, 25000),
    };
    this.log(`Started ${action.name}.`);
    this.touch('activity-started', { kind: 'skill', actionId }, true);
  }

  queueSkillAction(actionId, repetitions = 0) {
    const character = this.requireCharacter();
    const action = DATA.actions[actionId];
    if (!action) throw new Error('Unknown action.');
    character.activityQueue ||= [];
    character.activityQueue.push({ id: safeUUID(), kind: 'skill', actionId, repetitions: Math.max(0, Number(repetitions) || 0) });
    character.activityQueue = character.activityQueue.slice(0, 20);
    this.touch('activity-queued', { actionId });
  }

  removeQueuedActivity(queueId) {
    const character = this.requireCharacter();
    character.activityQueue = (character.activityQueue || []).filter((entry) => entry.id !== queueId);
    this.touch('queue-updated');
  }

  clearActivityQueue() {
    const character = this.requireCharacter();
    character.activityQueue = [];
    this.touch('queue-cleared');
  }

  stopActivity(reason = 'Stopped by player.') {
    const character = this.requireCharacter();
    if (!character.activity) return;
    character.activity = null;
    this.log(reason);
    this.touch('activity-stopped', { reason }, true);
  }

  startNextQueuedActivity() {
    const character = this.requireCharacter();
    const next = character.activityQueue?.shift();
    if (!next) return false;
    try {
      if (next.kind === 'skill') this.startSkillAction(next.actionId);
      return true;
    } catch (error) {
      this.notify('Queued activity skipped', error.message, 'warning');
      return this.startNextQueuedActivity();
    }
  }

  performActiveInteraction() {
    const character = this.requireCharacter();
    const activity = character.activity;
    if (!activity) throw new Error('There is no active task.');
    const now = Date.now();
    if (activity.activePromptAt && now < activity.activePromptAt) throw new Error('No active opportunity is available yet.');
    if (activity.kind === 'skill') {
      const action = DATA.actions[activity.actionId];
      const duration = this.getActionDuration(action, now);
      activity.progressMs += duration * 0.32;
      activity.rareBoost = Math.min(0.25, (activity.rareBoost || 0) + 0.05);
      activity.activePromptAt = now + randomInt(seededRandom(character.worldSeed, activity.completed, now), 14000, 32000);
      character.stats.activeInteractions += 1;
      this.addXp(action.skill, Math.max(2, action.xp * 0.08));
    } else if (activity.kind === 'travel') {
      activity.remainingMs = Math.max(0, activity.remainingMs - Math.min(12000, activity.totalMs * 0.12));
      activity.activePromptAt = now + 20000;
      character.stats.activeInteractions += 1;
    } else throw new Error('Use combat abilities for active combat interaction.');
    this.touch('active-interaction', { kind: activity.kind }, true);
  }

  getTravelPlan(targetRegionId) {
    const character = this.requireCharacter();
    if (!DATA.regions[targetRegionId]) return null;
    const modifiers = this.getCombinedModifiers(character.location);
    const equipment = this.getEquipmentStats();
    const agility = this.getSkillLevel('agility');
    const cartography = this.getSkillLevel('cartography');
    const stable = character.buildings.stable?.level || 0;
    const speed = agility * 0.12 + cartography * 0.05 + stable * 5 + (equipment.travelSpeed || 0) + (modifiers.travelSpeed || 0);
    return shortestPath(DATA.regions, DATA.routes, character.location, targetRegionId, () => 1 / Math.max(0.3, 1 + speed / 100));
  }

  startTravel(targetRegionId) {
    const character = this.requireCharacter();
    if (targetRegionId === character.location) throw new Error('You are already there.');
    const plan = this.getTravelPlan(targetRegionId);
    if (!plan) throw new Error('No known route reaches that location.');
    const totalMs = Math.max(3000, plan.seconds * 1000);
    character.activity = {
      kind: 'travel',
      targetRegionId,
      path: plan.path,
      totalMs,
      remainingMs: totalMs,
      startedAt: Date.now(),
      activePromptAt: Date.now() + 12000,
    };
    this.log(`Departed for ${DATA.regions[targetRegionId].name}.`);
    this.touch('travel-started', { targetRegionId, plan }, true);
  }

  waystoneTravel(targetRegionId) {
    const character = this.requireCharacter();
    if ((character.buildings.portal_chamber?.level || 0) < 1) throw new Error('Build a Waystone Chamber first.');
    if (!character.discoveredRegions.includes(targetRegionId)) throw new Error('The destination must be discovered first.');
    if (!this.hasStack('rune_way', 1, true)) throw new Error('A Waystone Rune is required.');
    this.consumeAcrossStorage({ rune_way: 1 });
    character.location = targetRegionId;
    character.activity = null;
    this.addXp('runecrafting', 20);
    this.log(`Used a Waystone Rune to reach ${DATA.regions[targetRegionId].name}.`);
    this.touch('waystone-travel', { targetRegionId }, true);
  }

  startCombat(enemyId) {
    const character = this.requireCharacter();
    const enemy = DATA.enemies[enemyId];
    if (!enemy) throw new Error('Unknown enemy.');
    if (enemy.region !== character.location) throw new Error(`Travel to ${DATA.regions[enemy.region]?.name || enemy.region} to fight this enemy.`);
    if (character.flags.deceased) throw new Error('This Hardcore Chronicle has ended.');
    character.currentHp = Math.min(this.getMaxHp(), Math.max(1, character.currentHp));
    character.activity = this.createCombatActivity(enemyId);
    character.combat.lastEnemyId = enemyId;
    this.combatLog(`Engaged ${enemy.name}.`);
    this.touch('combat-started', { enemyId }, true);
  }

  startEncounter(encounterId) {
    const character = this.requireCharacter();
    const encounter = DATA.encounters[encounterId];
    if (!encounter) throw new Error('Unknown encounter.');
    if (encounter.region !== character.location) throw new Error(`Travel to ${DATA.regions[encounter.region]?.name || encounter.region} first.`);
    const first = encounter.sequence[0];
    character.activity = this.createCombatActivity(first, { encounterId, encounterIndex: 0 });
    this.combatLog(`Entered ${encounter.name}.`);
    this.touch('encounter-started', { encounterId }, true);
  }

  createCombatActivity(enemyId, extra = {}) {
    const enemy = DATA.enemies[enemyId];
    return {
      kind: 'combat',
      enemyId,
      enemyHp: enemy.hp,
      progressMs: 0,
      round: 0,
      killsThisSession: 0,
      startedAt: Date.now(),
      playerStatuses: [],
      enemyStatuses: [],
      telegraph: null,
      guard: false,
      frostWardTurns: 0,
      queuedAbility: null,
      ...extra,
    };
  }

  fleeCombat() {
    const character = this.requireCharacter();
    if (character.activity?.kind !== 'combat') return;
    this.combatLog('You fled from combat.');
    character.activity = null;
    this.touch('combat-fled', {}, true);
  }

  useCombatAbility(abilityId) {
    const character = this.requireCharacter();
    const activity = character.activity;
    if (activity?.kind !== 'combat') throw new Error('You are not in combat.');
    const ability = DATA.abilities[abilityId];
    if (!ability) throw new Error('Unknown ability.');
    const style = character.combat.style;
    if (ability.style !== 'any' && ability.style !== style) throw new Error(`${ability.name} is not available for ${style}.`);
    const now = Date.now();
    if ((character.combat.cooldowns[abilityId] || 0) > now) throw new Error('That ability is still cooling down.');
    if (ability.staminaCost && character.stamina < ability.staminaCost) throw new Error('Not enough stamina.');
    if (ability.ammo && !this.hasStack(ability.ammo, 1)) throw new Error(`Requires ${DATA.items[ability.ammo].name}.`);

    if (['guard', 'interrupt', 'frost_ward', 'mend', 'cleanse'].includes(abilityId)) {
      this.executeSupportAbility(abilityId, activity, now);
    } else activity.queuedAbility = abilityId;
    character.combat.cooldowns[abilityId] = now + ability.cooldownMs;
    if (ability.staminaCost) character.stamina -= ability.staminaCost;
    if (ability.ammo) this.removeStack(ability.ammo, 1);
    this.combatLog(`Prepared ${ability.name}.`);
    this.touch('combat-ability', { abilityId });
  }

  executeSupportAbility(abilityId, activity, now) {
    const character = this.requireCharacter();
    const stats = this.getCombatStats();
    if (abilityId === 'guard') activity.guard = true;
    else if (abilityId === 'interrupt') {
      if (!activity.telegraph) throw new Error('There is no special attack to interrupt.');
      this.combatLog(`Interrupted ${activity.telegraph.name}.`);
      activity.telegraph = null;
    } else if (abilityId === 'frost_ward') activity.frostWardTurns = 3;
    else if (abilityId === 'mend') {
      const amount = Math.round(22 + stats.healingPower * 1.1);
      const before = character.currentHp;
      character.currentHp = Math.min(stats.maxHp, character.currentHp + amount);
      character.stats.healingDone += character.currentHp - before;
      this.combatLog(`Mend restored ${character.currentHp - before} HP.`);
    } else if (abilityId === 'cleanse') {
      const before = activity.playerStatuses.length;
      activity.playerStatuses = activity.playerStatuses.filter((status) => !['poison', 'burn', 'bleed', 'corruption', 'blind'].includes(status.id));
      this.combatLog(`Cleansed ${before - activity.playerStatuses.length} harmful effect${before - activity.playerStatuses.length === 1 ? '' : 's'}.`);
    }
    character.combat.cooldowns[abilityId] = now + DATA.abilities[abilityId].cooldownMs;
  }

  requestSlayerAssignment() {
    const character = this.requireCharacter();
    const level = this.getCharacterLevel();
    const eligible = Object.values(DATA.enemies).filter((enemy) => !enemy.boss && enemy.level <= level + 18 && enemy.level >= Math.max(1, level - 20));
    const rng = seededRandom(character.worldSeed, 'slayer', character.slayer.completed, Date.now());
    const enemy = eligible[Math.floor(rng() * eligible.length)] || Object.values(DATA.enemies)[0];
    const count = randomInt(rng, 10, 28);
    character.slayer.assignment = { enemyId: enemy.id, remaining: count, total: count, assignedAt: Date.now() };
    this.notify('New Slayer assignment', `Defeat ${count} ${enemy.name}${count === 1 ? '' : 's'}.`, 'quest');
    this.touch('slayer-assignment', { enemyId: enemy.id, count }, true);
  }

  advanceTo(now = Date.now(), { offline = false } = {}) {
    const character = this.character;
    if (!character) return null;
    const rawElapsed = Math.max(0, now - (character.lastProcessedAt || now));
    if (!rawElapsed) return null;
    const difficulty = DATA.difficulties[character.difficulty] || DATA.difficulties.standard;
    const maxOffline = (difficulty.offlineHours || 24) * 3600000;
    const elapsed = offline ? Math.min(rawElapsed, maxOffline) : Math.min(rawElapsed, 10_000);
    const report = createReport(character.lastProcessedAt || now - elapsed, now, rawElapsed, elapsed, offline);
    const rng = mulberry32(hashString(`${character.worldSeed}:${character.revision}:${character.lastProcessedAt}:${now}`));

    character.stats.playTimeMs += elapsed;
    this.cleanupBuffs(now);
    this.processWorldState(now, report);
    this.processPassive(now, report, rng);
    this.processActivity(elapsed, now, report, rng, offline);
    character.currentHp = clamp(character.currentHp, 0, this.getMaxHp());
    character.stamina = clamp(character.stamina + elapsed / 1000 * 1.5, 0, this.getCombatStats().staminaMax);
    character.mana = clamp(character.mana + elapsed / 1000 * 1.2, 0, this.getCombatStats().manaMax);
    character.lastProcessedAt = now;
    character.updatedAt = now;
    this.refreshQuestStates();
    this.checkAchievements();

    if (offline && rawElapsed >= OFFLINE_REPORT_THRESHOLD) {
      if (rawElapsed > elapsed) report.messages.push(`Offline progress was capped at ${formatDuration(elapsed)} for this difficulty.`);
      character.offlineReports.push(report);
      character.offlineReports = character.offlineReports.slice(-20);
      this.emit('offline-report', { report });
    }
    if (report.changed) this.touch(offline ? 'offline-progress' : 'simulation', { report }, offline);
    else this.emit('tick', { now, elapsed, activity: character.activity });
    return report;
  }

  cleanupBuffs(now) {
    const character = this.character;
    character.buffs = (character.buffs || []).filter((buff) => !buff.expiresAt || buff.expiresAt > now);
  }

  processWorldState(now, report) {
    const character = this.character;
    const event = this.getWorldEvent(now);
    if (character.flags.lastWorldEventId !== event.id) {
      character.flags.lastWorldEventId = event.id;
      this.notify(event.name, event.description, 'event');
      report.messages.push(`World event: ${event.name}.`);
      report.changed = true;
    }
    this.ensureTradeContracts(now);
  }

  processPassive(now, report, rng) {
    const character = this.character;
    this.ensureFarmPlots();
    for (const plot of character.farming.plots) {
      if (plot.cropId && plot.readyAt && plot.readyAt <= now && !plot.notifiedReady) {
        plot.notifiedReady = true;
        const crop = DATA.crops[plot.cropId];
        this.notify('Crop ready', `${crop.name} is ready to harvest.`, 'farming');
        report.messages.push(`${crop.name} finished growing.`);
        report.changed = true;
      }
    }

    const sawmill = character.buildings.sawmill;
    if (sawmill?.level > 0) {
      const last = sawmill.lastProcessedAt || character.lastProcessedAt;
      const hours = Math.floor((now - last) / 3600000);
      if (hours > 0) {
        const capacity = hours * sawmill.level * 2;
        const available = character.bank.stacks.logs_normal || 0;
        const count = Math.min(capacity, available);
        if (count > 0) {
          character.bank.stacks.logs_normal -= count;
          if (character.bank.stacks.logs_normal <= 0) delete character.bank.stacks.logs_normal;
          character.bank.stacks.plank_normal = (character.bank.stacks.plank_normal || 0) + count;
          this.recordItemFound('plank_normal', count);
          addReportItems(report, { plank_normal: count });
          report.messages.push(`The sawmill processed ${count} Pine Planks.`);
          report.changed = true;
        }
        sawmill.lastProcessedAt += hours * 3600000;
      }
    }

    for (const expedition of [...character.companions.activeExpeditions]) {
      if (expedition.endsAt > now) continue;
      this.completeExpedition(expedition, report, rng);
      character.companions.activeExpeditions = character.companions.activeExpeditions.filter((entry) => entry.id !== expedition.id);
      report.changed = true;
    }

    if (character.research.active && character.research.active.endsAt <= now) {
      const id = character.research.active.researchId;
      if (!character.research.completed.includes(id)) character.research.completed.push(id);
      character.research.active = null;
      this.notify('Research complete', DATA.research[id]?.name || id, 'research');
      report.messages.push(`Research completed: ${DATA.research[id]?.name || id}.`);
      report.changed = true;
    }

    for (const route of [...character.trade.activeRoutes]) {
      if (route.endsAt > now) continue;
      this.completeTradeRoute(route, report, rng);
      character.trade.activeRoutes = character.trade.activeRoutes.filter((entry) => entry.id !== route.id);
      report.changed = true;
    }

    if (character.sailing.activeVoyage && character.sailing.activeVoyage.endsAt <= now) {
      this.completeVoyage(character.sailing.activeVoyage, report, rng);
      character.sailing.activeVoyage = null;
      report.changed = true;
    }
  }

  processActivity(elapsed, now, report, rng, offline) {
    const activity = this.character.activity;
    if (!activity || elapsed <= 0) return;
    if (activity.kind === 'skill') this.processSkillActivity(activity, elapsed, now, report, rng);
    else if (activity.kind === 'travel') this.processTravel(activity, elapsed, now, report, rng);
    else if (activity.kind === 'combat') this.processCombat(activity, elapsed, now, report, rng, offline);
  }

  processSkillActivity(activity, elapsed, now, report, rng) {
    const character = this.character;
    const action = DATA.actions[activity.actionId];
    if (!action || !action.regions.includes(character.location)) {
      character.activity = null;
      report.messages.push('The previous skill action is no longer available here.');
      report.changed = true;
      return;
    }
    const duration = this.getActionDuration(action, now);
    activity.progressMs = (activity.progressMs || 0) + elapsed;
    let requested = Math.min(MAX_ACTIVITY_BATCH, Math.floor(activity.progressMs / duration));
    if (!requested) return;
    const remainingStop = activity.stopAfter ? Math.max(0, activity.stopAfter - activity.completed) : requested;
    requested = Math.min(requested, remainingStop || requested);
    const result = this.completeActionBatch(action, requested, rng, report, activity);
    if (result.completed > 0) {
      activity.progressMs -= result.completed * duration;
      activity.completed += result.completed;
      activity.progressMs = Math.max(0, activity.progressMs);
      report.changed = true;
    }
    if (result.completed < requested || (activity.stopAfter && activity.completed >= activity.stopAfter)) {
      const reason = result.stopReason || 'Action target reached.';
      this.log(`${action.name} stopped: ${reason}`);
      character.activity = null;
      report.messages.push(`${action.name} stopped: ${reason}`);
      this.startNextQueuedActivity();
      report.changed = true;
    }
  }

  completeActionBatch(action, requested, rng, report, activity) {
    const character = this.character;
    const itemOutputs = Object.entries(action.outputs || {});
    const hasInstanceOutput = itemOutputs.some(([id]) => DATA.items[id]?.stackable === false);
    if (hasInstanceOutput) return this.completeInstanceActionBatch(action, requested, rng, report, activity);

    let maxByInputs = requested;
    for (const [itemId, qty] of Object.entries(action.inputs || {})) {
      if (action.preserveInputs?.includes(itemId)) {
        if (this.stackQty(itemId) < qty) maxByInputs = 0;
      } else maxByInputs = Math.min(maxByInputs, Math.floor(this.stackQty(itemId) / qty));
    }
    let completions = Math.max(0, maxByInputs);
    if (!completions) return { completed: 0, stopReason: 'required materials are unavailable' };

    const failureChance = clamp(Number(action.failureChance) || 0, 0, 0.95);
    const failures = failureChance ? rollBinomial(rng, completions, failureChance) : 0;
    const successes = Math.max(0, completions - failures);
    const preserveChance = this.getPreserveChance(action.skill);
    const consume = {};
    for (const [itemId, qty] of Object.entries(action.inputs || {})) {
      if (action.preserveInputs?.includes(itemId)) continue;
      const preserved = rollBinomial(rng, completions, preserveChance);
      consume[itemId] = Math.max(0, (completions - preserved) * qty);
    }

    const produce = {};
    const yieldBonus = this.getYieldChance(action.skill, action.id);
    const bonusCompletions = successes ? rollBinomial(rng, successes, yieldBonus) : 0;
    for (const [itemId, qty] of itemOutputs) produce[itemId] = qty * (successes + bonusCompletions);

    if (!this.applyStackTransaction('inventory', consume, produce)) {
      return { completed: 0, stopReason: 'inventory is full' };
    }

    const rareFind = this.getRareFind(action.skill) + (activity.rareBoost || 0);
    activity.rareBoost = 0;
    const rareDrops = {};
    for (const drop of action.rare || []) {
      const chance = clamp(drop.chance * (1 + rareFind), 0, 1);
      const hits = rollBinomial(rng, successes, chance);
      if (hits > 0) rareDrops[drop.item] = (rareDrops[drop.item] || 0) + hits;
    }
    for (const [itemId, qty] of Object.entries(rareDrops)) {
      const added = this.addItem(itemId, qty, { allowBankFallback: false });
      if (added.added) {
        addReportItems(report, { [itemId]: added.added });
        character.stats.rareDrops += added.added;
      }
      if (added.lost) report.losses.push(`${added.lost} ${DATA.items[itemId].name} lost because the inventory was full.`);
    }

    let coins = 0;
    if (action.coins && successes > 0) coins = sumRandomRange(rng, successes, action.coins[0], action.coins[1]);
    if (coins) {
      character.coins += coins;
      character.stats.coinsEarned += coins;
      report.coins += coins;
    }

    if (failures) {
      const damage = failures * Math.max(1, Math.floor((action.danger || 1) * 1.5));
      character.currentHp -= damage;
      character.stats.damageTaken += damage;
      report.messages.push(`${failures} attempts failed, causing ${damage} damage.`);
      if (character.currentHp <= 0) this.handleDefeat(report, 'A failed field action proved fatal.');
    }

    if (action.danger && successes > 0) {
      const injuries = rollBinomial(rng, successes, Math.min(0.025, action.danger * 0.0008));
      if (injuries) {
        const damage = injuries * action.danger * 2;
        character.currentHp -= damage;
        character.stats.damageTaken += damage;
        report.messages.push(`Environmental hazards caused ${damage} damage.`);
        if (character.currentHp <= 0) this.handleDefeat(report, 'Environmental hazards forced a retreat.');
      }
    }

    if (action.familiar && successes > 0 && !character.collections.familiars.includes(action.familiar)) {
      character.collections.familiars.push(action.familiar);
      this.notify('Familiar bound', action.familiar === 'forager_wisp' ? 'Forager Wisp' : 'Emberling', 'collection');
    }
    if (action.discoveryChance && successes > 0 && rng() < 1 - Math.pow(1 - action.discoveryChance, successes)) {
      const secret = `${character.location}:${action.id}`;
      if (!character.discoveredSecrets.includes(secret)) {
        character.discoveredSecrets.push(secret);
        character.collections.discoveries.push(secret);
        report.messages.push('A hidden landmark was discovered.');
      }
    }

    const effective = Math.max(0, successes);
    this.rewardAction(action, effective, report);
    addReportItems(report, produce);
    return { completed: completions, stopReason: failures === completions ? 'every attempt failed' : null };
  }

  completeInstanceActionBatch(action, requested, rng, report, activity) {
    const character = this.character;
    let completed = 0;
    let stopReason = null;
    for (let index = 0; index < requested; index += 1) {
      const consume = {};
      let missing = false;
      for (const [itemId, qty] of Object.entries(action.inputs || {})) {
        if (this.stackQty(itemId) < qty) {
          missing = true;
          break;
        }
        if (!action.preserveInputs?.includes(itemId)) consume[itemId] = qty;
      }
      if (missing) {
        stopReason = 'required materials are unavailable';
        break;
      }
      const outputs = Object.entries(action.outputs || {});
      const stackProduce = {};
      let instanceCount = 0;
      for (const [itemId, qty] of outputs) {
        if (DATA.items[itemId]?.stackable === false) instanceCount += qty;
        else stackProduce[itemId] = qty;
      }
      if (!this.canFit('inventory', consume, stackProduce, instanceCount)) {
        stopReason = 'inventory is full';
        break;
      }
      this.applyStackTransaction('inventory', consume, stackProduce);
      for (const [itemId, qty] of outputs) {
        if (DATA.items[itemId]?.stackable !== false) continue;
        for (let n = 0; n < qty; n += 1) {
          const quality = this.rollCraftQuality(action.skill, action.id, rng);
          const affixes = this.rollAffixes(itemId, quality, rng);
          const instance = createItemInstance(itemId, { quality, affixes });
          character.inventory.instances.push(instance);
          this.recordItemFound(itemId, 1);
          addReportItems(report, { [itemId]: 1 });
          character.stats.itemsCrafted[itemId] = (character.stats.itemsCrafted[itemId] || 0) + 1;
        }
      }
      completed += 1;
    }
    if (completed) this.rewardAction(action, completed, report);
    activity.rareBoost = 0;
    return { completed, stopReason };
  }

  rewardAction(action, completions, report) {
    if (completions <= 0) return;
    const character = this.character;
    const difficulty = DATA.difficulties[character.difficulty] || DATA.difficulties.standard;
    const modifiers = this.getCombinedModifiers(character.location);
    let xpMultiplier = difficulty.xpMultiplier || 1;
    if (['runecrafting', 'enchanting'].includes(action.skill)) xpMultiplier *= 1 + (modifiers.magicCraftXp || 0) / 100;
    const xp = action.xp * completions * xpMultiplier;
    this.addXp(action.skill, xp, report);
    const masteryXp = action.xp * completions * 0.62 * (1 + (modifiers.masteryGain || 0) / 100);
    character.mastery.actions[action.id] = (character.mastery.actions[action.id] || 0) + masteryXp;
    character.mastery.pools[action.skill] = (character.mastery.pools[action.skill] || 0) + masteryXp * 0.2;
    character.stats.actionsCompleted += completions;
    character.stats.actionCounts[action.id] = (character.stats.actionCounts[action.id] || 0) + completions;
    if (['woodcutting', 'mining', 'fishing', 'foraging', 'hunting', 'archaeology'].includes(action.skill)) character.stats.gathered += completions;
    else if (!['agility', 'thieving', 'mercantile', 'cartography', 'summoning'].includes(action.skill)) character.stats.crafted += completions;
    const faction = DATA.regions[character.location]?.faction;
    if (faction && faction !== 'ashen_covenant') character.reputations[faction] = (character.reputations[faction] || 0) + Math.floor(completions / 20);
  }

  addXp(skillId, amount, report = null) {
    const character = this.character;
    if (!character || !DATA.skills[skillId] || amount <= 0) return;
    const before = levelFromXp(character.xp[skillId] || 0, 99);
    character.xp[skillId] = (character.xp[skillId] || 0) + amount;
    const after = levelFromXp(character.xp[skillId], 99);
    if (report) report.xp[skillId] = (report.xp[skillId] || 0) + amount;
    if (after > before) {
      this.notify(`${DATA.skills[skillId].name} level ${after}`, `Reached level ${after}.`, 'level');
      this.emit('level-up', { skillId, level: after });
    }
  }

  getPreserveChance(skillId) {
    const character = this.character;
    const modifiers = this.getCombinedModifiers(character.location);
    const equipment = this.getEquipmentStats();
    let chance = (modifiers.preserveChance || 0) / 100;
    if (skillId === 'smithing') chance += (equipment.smithingPreserve || 0) / 100;
    return clamp(chance, 0, 0.45);
  }

  getYieldChance(skillId, actionId) {
    const character = this.character;
    const mastery = this.getActionMastery(actionId);
    const level = this.getSkillLevel(skillId);
    const modifiers = this.getCombinedModifiers(character.location);
    let chance = mastery * 0.0014 + level * 0.00045;
    const key = `${skillId}Yield`;
    chance += (modifiers[key] || 0) / 100;
    if (skillId === 'farming') chance += (modifiers.cropYield || 0) / 100;
    if (skillId === 'fishing') chance += (modifiers.fishingYield || 0) / 100;
    if (skillId === 'foraging') chance += (modifiers.foragingYield || 0) / 100;
    if (skillId === 'herblore') chance += (modifiers.potionYield || 0) / 100;
    return clamp(chance, 0, 0.55);
  }

  getRareFind(skillId) {
    const character = this.character;
    const modifiers = this.getCombinedModifiers(character.location);
    const equipment = this.getEquipmentStats();
    const skill = this.getSkillLevel(skillId);
    return clamp(((modifiers.rareFind || 0) + (equipment.rareFind || 0)) / 100 + skill * 0.00015, 0, 0.35);
  }

  rollCraftQuality(skillId, actionId, rng) {
    const level = this.getSkillLevel(skillId);
    const mastery = this.getActionMastery(actionId);
    const score = level * 0.55 + mastery * 0.45;
    const roll = rng();
    const legendary = Math.max(0, (score - 85) * 0.0007);
    const masterwork = Math.max(0, (score - 60) * 0.0025);
    const superior = Math.max(0, (score - 35) * 0.0045);
    const fine = Math.max(0.08, score * 0.005);
    if (roll < legendary) return 'legendary';
    if (roll < legendary + masterwork) return 'masterwork';
    if (roll < legendary + masterwork + superior) return 'superior';
    if (roll < legendary + masterwork + superior + fine) return 'fine';
    if (score < 10 && roll > 0.85) return 'crude';
    return 'standard';
  }

  rollAffixes(itemId, quality, rng) {
    const item = DATA.items[itemId];
    const qualityIndex = QUALITY_ORDER.indexOf(quality);
    const count = qualityIndex >= 5 ? 2 : qualityIndex >= 3 ? 1 : 0;
    if (!count || !item) return [];
    const pool = [];
    if (item.tags?.includes('weapon')) pool.push(['accuracy', 4, 12, 'Precise'], ['critChance', 2, 6, 'Keen'], ['physicalDamage', 4, 14, 'Mighty']);
    if (item.tags?.includes('armor')) pool.push(['health', 12, 42, 'Warden’s'], ['armor', 4, 18, 'Fortified'], ['allResist', 2, 7, 'Runed']);
    if (item.tags?.includes('mining')) pool.push(['miningSpeed', 4, 10, 'Prospector’s']);
    if (item.tags?.includes('travel')) pool.push(['travelSpeed', 4, 10, 'Swift']);
    if (item.tags?.includes('magic')) pool.push(['magicDamage', 5, 15, 'Resonant']);
    if (!pool.length) pool.push(['rareFind', 1, 4, 'Fortunate']);
    const selected = [];
    for (let i = 0; i < count; i += 1) {
      const candidate = pool[Math.floor(rng() * pool.length)];
      if (!candidate || selected.some((affix) => affix.stat === candidate[0])) continue;
      selected.push({ stat: candidate[0], value: randomInt(rng, candidate[1], candidate[2]), name: candidate[3] });
    }
    return selected;
  }

  processTravel(activity, elapsed, now, report, rng) {
    activity.remainingMs -= elapsed;
    if (activity.remainingMs > 0) return;
    const character = this.character;
    const target = activity.targetRegionId;
    const previous = character.location;
    character.location = target;
    character.activity = null;
    const firstVisit = !character.discoveredRegions.includes(target);
    if (firstVisit) {
      character.discoveredRegions.push(target);
      if (!character.collections.discoveries.includes(target)) character.collections.discoveries.push(target);
      this.notify('Region discovered', DATA.regions[target].name, 'discovery');
      this.addXp('cartography', 80 + DATA.regions[target].danger * 18, report);
    }
    const distance = Math.max(1, Math.round(activity.totalMs / 1000));
    character.stats.distanceTraveled += distance;
    this.addXp('agility', distance * 0.6, report);
    this.addXp('cartography', distance * 0.25, report);
    const danger = DATA.regions[target].danger || 1;
    const modifiers = this.getCombinedModifiers(target, now);
    const encounterChance = clamp(0.02 + danger * 0.012 + (modifiers.travelDanger || 0) / 100, 0, 0.4);
    if (rng() < encounterChance) {
      if (rng() < 0.55) {
        const coins = randomInt(rng, 8, 20 + danger * 8);
        character.coins += coins;
        character.stats.coinsEarned += coins;
        report.coins += coins;
        report.messages.push(`A roadside opportunity earned ${coins} coins.`);
      } else {
        const damage = randomInt(rng, danger, danger * 5);
        character.currentHp = Math.max(1, character.currentHp - damage);
        character.stats.damageTaken += damage;
        report.messages.push(`A dangerous encounter caused ${damage} damage.`);
      }
    }
    report.messages.push(`Arrived at ${DATA.regions[target].name}${firstVisit ? ' and discovered the region' : ''}.`);
    this.log(`Arrived at ${DATA.regions[target].name} from ${DATA.regions[previous].name}.`);
    report.changed = true;
    this.startNextQueuedActivity();
  }

  processCombat(activity, elapsed, now, report, rng, offline) {
    const character = this.character;
    const enemy = DATA.enemies[activity.enemyId];
    if (!enemy) {
      character.activity = null;
      report.messages.push('Combat stopped because the enemy definition is unavailable.');
      report.changed = true;
      return;
    }
    const stats = this.getCombatStats();
    const difficulty = DATA.difficulties[character.difficulty] || DATA.difficulties.standard;
    const roundMs = Math.max(900, Math.round((stats.attackSpeedMs + enemy.speedMs) / 2));
    activity.progressMs = (activity.progressMs || 0) + elapsed;
    let rounds = Math.min(MAX_COMBAT_ROUNDS_PER_ADVANCE, Math.floor(activity.progressMs / roundMs));
    if (!rounds) return;
    for (let round = 0; round < rounds; round += 1) {
      if (character.activity !== activity || character.currentHp <= 0) break;
      const simNow = now - (rounds - round - 1) * roundMs;
      this.resolveCombatRound(activity, enemy, stats, difficulty, rng, report, simNow, offline);
      activity.progressMs -= roundMs;
      report.changed = true;
    }
  }

  resolveCombatRound(activity, enemy, stats, difficulty, rng, report, simNow, offline) {
    const character = this.character;
    activity.round += 1;
    this.processStatuses(activity, report, offline);
    if (activity.enemyHp <= 0) {
      this.handleEnemyDefeat(activity, enemy, rng, report, offline);
      return;
    }
    if (character.currentHp <= 0) {
      this.handleDefeat(report, `${enemy.name} defeated you.`);
      return;
    }

    this.autoCombatDecisions(activity, stats, simNow, report);
    if (character.activity !== activity) return;

    const queuedAbility = activity.queuedAbility;
    activity.queuedAbility = null;
    let multiplier = 1;
    let penetration = 0;
    let damageType = stats.damageType;
    if (queuedAbility === 'power_strike') {
      multiplier = 1.75;
      penetration = 0.3;
    } else if (queuedAbility === 'venom_shot') {
      multiplier = 1.12;
      damageType = 'pierce';
    } else if (queuedAbility === 'firebolt') {
      multiplier = 1.28;
      damageType = 'fire';
    }

    const blindPenalty = getStatusStacks(activity.playerStatuses, 'blind') * 4;
    const hitChance = clamp(0.08 + ((stats.accuracy - blindPenalty) / Math.max(1, stats.accuracy - blindPenalty + enemy.evasion * 1.25)) * 0.88, 0.08, 0.96);
    if (rng() < hitChance) {
      const raw = stats.damage * multiplier * (0.65 + rng() * 0.45);
      const crit = rng() < stats.critChance / 100;
      const critMultiplier = crit ? 1 + stats.critDamage / 100 : 1;
      const armor = Math.max(0, enemy.armor * (1 - penetration));
      const mitigation = 100 / (100 + armor);
      const resistance = clamp(enemy.resistances?.[damageType] || 0, -50, 90);
      const damage = Math.max(1, Math.round(raw * critMultiplier * mitigation * (1 - resistance / 100)));
      activity.enemyHp -= damage;
      character.stats.damageDealt += damage;
      if (!offline) this.combatLog(`${queuedAbility ? DATA.abilities[queuedAbility].name : 'Attack'} dealt ${damage}${crit ? ' critical' : ''} damage.`);
      if (queuedAbility === 'venom_shot') applyStatus(activity.enemyStatuses, { id: 'poison', stacks: 3, power: 3, turns: 6 });
      if (queuedAbility === 'firebolt') applyStatus(activity.enemyStatuses, { id: 'burn', stacks: 2, power: 4, turns: 5 });
    } else if (!offline) this.combatLog('Your attack missed.');

    if (activity.enemyHp <= 0) {
      this.handleEnemyDefeat(activity, enemy, rng, report, offline);
      return;
    }

    this.prepareOrResolveEnemyAbility(activity, enemy, rng, report, offline);
    if (character.activity !== activity || activity.enemyHp <= 0) return;

    const enemyPower = difficulty.enemyPower || 1;
    const enemyAccuracy = enemy.accuracy * enemyPower;
    const hitChanceEnemy = clamp(0.07 + (enemyAccuracy / Math.max(1, enemyAccuracy + stats.evasion * 1.2)) * 0.88, 0.07, 0.94);
    if (rng() < hitChanceEnemy) {
      let multiplierEnemy = activity.resolvingSpecial?.multiplier || 1;
      const type = enemy.damageType || 'crush';
      let armor = stats.armor;
      if (activity.guard) armor *= 1.9;
      let mitigation = 100 / (100 + armor);
      if (rng() < stats.block / 100) mitigation *= 0.45;
      let resistance = stats.resistances[type] || 0;
      if (activity.frostWardTurns > 0 && type === 'fire') resistance += 40;
      const damage = Math.max(1, Math.round(enemy.maxHit * enemyPower * multiplierEnemy * (0.55 + rng() * 0.55) * mitigation * (1 - clamp(resistance, -50, 90) / 100)));
      character.currentHp -= damage;
      character.stats.damageTaken += damage;
      if (!offline) this.combatLog(`${enemy.name} hit you for ${damage}.`);
      const special = activity.resolvingSpecial;
      if (special?.status) applyStatus(activity.playerStatuses, { id: special.status, stacks: special.power || 1, power: special.power || 2, turns: 6 });
    } else if (!offline) this.combatLog(`${enemy.name} missed.`);
    activity.guard = false;
    activity.resolvingSpecial = null;
    if (activity.frostWardTurns > 0) activity.frostWardTurns -= 1;
    character.stamina = Math.min(stats.staminaMax, character.stamina + 8);
    character.mana = Math.min(stats.manaMax, character.mana + 5);
    if (character.currentHp <= 0) this.handleDefeat(report, `${enemy.name} defeated you.`);
  }

  processStatuses(activity, report, offline) {
    const character = this.character;
    const tick = (statuses, target) => {
      for (const status of statuses) {
        if (['poison', 'burn', 'bleed', 'corruption'].includes(status.id)) {
          const damage = Math.max(1, Math.round(status.power * Math.max(1, status.stacks * 0.5)));
          if (target === 'player') {
            character.currentHp -= damage;
            character.stats.damageTaken += damage;
          } else {
            activity.enemyHp -= damage;
            character.stats.damageDealt += damage;
          }
          if (!offline) this.combatLog(`${status.id} dealt ${damage} damage to ${target === 'player' ? 'you' : 'the enemy'}.`);
        }
        status.turns -= 1;
        if (status.stacks > 1 && ['poison', 'burn', 'bleed'].includes(status.id)) status.stacks -= 1;
      }
      return statuses.filter((status) => status.turns > 0 && status.stacks > 0);
    };
    activity.playerStatuses = tick(activity.playerStatuses || [], 'player');
    activity.enemyStatuses = tick(activity.enemyStatuses || [], 'enemy');
  }

  autoCombatDecisions(activity, stats, simNow, report) {
    const character = this.character;
    const automation = character.combat.automation;
    const hpPercent = (character.currentHp / stats.maxHp) * 100;
    if (automation.autoEat && hpPercent <= automation.eatBelowPercent) this.autoEat(report);
    if (character.currentHp <= 0) return;
    const poisonStacks = getStatusStacks(activity.playerStatuses, 'poison');
    if (automation.autoPotion && poisonStacks >= automation.antidoteAtStacks && this.hasStack('potion_antidote', 1)) {
      this.removeStack('potion_antidote', 1);
      activity.playerStatuses = activity.playerStatuses.filter((status) => status.id !== 'poison');
      if (report) report.messages.push('An Antidote was used automatically.');
    }
    if (automation.fleeBelowPercent && hpPercent <= automation.fleeBelowPercent) {
      this.combatLog('Automation fled from combat at low health.');
      character.activity = null;
      return;
    }
    if (automation.stopWhenFoodBelow > 0 && this.totalFoodCount() < automation.stopWhenFoodBelow) {
      this.combatLog('Combat stopped to preserve the food reserve.');
      character.activity = null;
      return;
    }
    if (!automation.useAbilities) return;
    const loadout = character.combat.abilityLoadouts[character.combat.style] || [];
    if (activity.telegraph && automation.interruptSpecial && loadout.includes('interrupt') && this.abilityReady('interrupt', simNow) && character.stamina >= (DATA.abilities.interrupt.staminaCost || 0)) {
      character.stamina -= DATA.abilities.interrupt.staminaCost || 0;
      character.combat.cooldowns.interrupt = simNow + DATA.abilities.interrupt.cooldownMs;
      activity.telegraph = null;
      if (report) report.messages.push('A special attack was interrupted automatically.');
      return;
    }
    if (character.combat.style === 'faith' && hpPercent < 55 && loadout.includes('mend') && this.abilityReady('mend', simNow) && this.hasStack('rune_light', 1)) {
      this.removeStack('rune_light', 1);
      character.combat.cooldowns.mend = simNow + DATA.abilities.mend.cooldownMs;
      const amount = Math.round(22 + stats.healingPower * 1.1);
      const before = character.currentHp;
      character.currentHp = Math.min(stats.maxHp, character.currentHp + amount);
      character.stats.healingDone += character.currentHp - before;
      return;
    }
    for (const id of loadout) {
      if (!['power_strike', 'venom_shot', 'firebolt'].includes(id) || !this.abilityReady(id, simNow)) continue;
      const ability = DATA.abilities[id];
      if (ability.staminaCost && character.stamina < ability.staminaCost) continue;
      if (ability.ammo && !this.hasStack(ability.ammo, 1)) continue;
      if (ability.staminaCost) character.stamina -= ability.staminaCost;
      if (ability.ammo) this.removeStack(ability.ammo, 1);
      character.combat.cooldowns[id] = simNow + ability.cooldownMs;
      activity.queuedAbility = id;
      break;
    }
  }

  abilityReady(abilityId, at = Date.now()) {
    return (this.character?.combat?.cooldowns?.[abilityId] || 0) <= at;
  }

  autoEat(report) {
    const character = this.character;
    const automation = character.combat.automation;
    const food = Object.keys(character.inventory.stacks)
      .map((id) => DATA.items[id])
      .filter((item) => item?.heal && item.tags?.includes('food') && character.inventory.stacks[item.id] > 0)
      .sort((a, b) => automation.preferredFood === 'cheapest' ? a.value - b.value : b.heal - a.heal)[0];
    if (!food) return false;
    this.removeStack(food.id, 1);
    const before = character.currentHp;
    const modifiers = this.getCombinedModifiers(character.location);
    character.currentHp = Math.min(this.getMaxHp(), character.currentHp + Math.round(food.heal * (1 + (modifiers.healingPower || 0) / 100)));
    character.stats.healingDone += character.currentHp - before;
    if (report) report.messages.push(`Ate ${food.name} automatically.`);
    return true;
  }

  totalFoodCount() {
    const character = this.character;
    return Object.entries(character.inventory.stacks).reduce((sum, [id, qty]) => sum + (DATA.items[id]?.tags?.includes('food') ? qty : 0), 0);
  }

  prepareOrResolveEnemyAbility(activity, enemy, rng, report, offline) {
    if (activity.telegraph) {
      activity.resolvingSpecial = activity.telegraph;
      if (!offline) this.combatLog(`${enemy.name} unleashes ${activity.telegraph.name}!`);
      activity.telegraph = null;
      return;
    }
    for (const ability of enemy.abilities || []) {
      if (!ability.every || activity.round % ability.every !== ability.every - 1) continue;
      if (ability.telegraph) {
        activity.telegraph = { ...ability, name: titleFromId(ability.id) };
        if (!offline) this.combatLog(`${enemy.name} prepares ${activity.telegraph.name}.`);
      } else if (ability.buffArmor) {
        enemy._temporaryArmor = ability.buffArmor;
        if (!offline) this.combatLog(`${enemy.name} raises a protective ward.`);
      } else if (ability.status) {
        activity.resolvingSpecial = { ...ability, name: titleFromId(ability.id), multiplier: ability.multiplier || 1.15 };
      }
      break;
    }
  }

  handleEnemyDefeat(activity, enemy, rng, report, offline) {
    const character = this.character;
    activity.enemyHp = 0;
    activity.killsThisSession += 1;
    character.stats.kills += 1;
    character.stats.enemyKills[enemy.id] = (character.stats.enemyKills[enemy.id] || 0) + 1;
    character.collections.monsters[enemy.id] = (character.collections.monsters[enemy.id] || 0) + 1;
    const modifiers = this.getCombinedModifiers(character.location);
    const coins = Math.round(randomInt(rng, enemy.coins[0], enemy.coins[1]) * (1 + (modifiers.combatCoins || 0) / 100));
    character.coins += coins;
    character.stats.coinsEarned += coins;
    report.coins += coins;
    report.combatKills[enemy.id] = (report.combatKills[enemy.id] || 0) + 1;

    const style = character.combat.style;
    if (style === 'melee') {
      this.addXp('attack', enemy.xp * 0.42, report);
      this.addXp('strength', enemy.xp * 0.42, report);
    } else this.addXp(style, enemy.xp * 0.85, report);
    this.addXp('defence', enemy.xp * 0.24, report);
    this.addXp('vitality', enemy.xp * 0.32, report);
    if (character.slayer.assignment?.enemyId === enemy.id) {
      this.addXp('slayer', enemy.xp * 0.65 * (1 + (modifiers.slayerXp || 0) / 100), report);
      character.slayer.assignment.remaining -= 1;
      if (character.slayer.assignment.remaining <= 0) {
        const reward = 250 + character.slayer.assignment.total * 18;
        character.coins += reward;
        character.stats.coinsEarned += reward;
        report.coins += reward;
        character.slayer.completed += 1;
        character.slayer.assignment = null;
        this.notify('Slayer assignment complete', `Earned ${reward} coins.`, 'quest');
      }
    } else if (enemy.region === 'the_wilds' || enemy.id.includes('ember') || enemy.id.includes('corrupt')) this.addXp('slayer', enemy.xp * 0.18, report);

    let rareDropped = false;
    for (const drop of enemy.drops || []) {
      const chance = clamp(drop.chance * (1 + this.getRareFind('slayer')), 0, 1);
      if (rng() >= chance) continue;
      const qty = Array.isArray(drop.qty) ? randomInt(rng, drop.qty[0], drop.qty[1]) : Number(drop.qty) || 1;
      if (qty <= 0) continue;
      const quality = DATA.items[drop.item]?.stackable === false ? this.rollLootQuality(enemy, rng) : undefined;
      const affixes = quality ? this.rollAffixes(drop.item, quality, rng) : undefined;
      const result = this.addItem(drop.item, qty, { quality, affixes, allowBankFallback: false });
      if (result.added) {
        addReportItems(report, { [drop.item]: result.added });
        if ((DATA.items[drop.item]?.rarity === 'rare' || DATA.items[drop.item]?.rarity === 'epic' || DATA.items[drop.item]?.rarity === 'legendary')) {
          rareDropped = true;
          character.stats.rareDrops += result.added;
        }
      }
      if (result.lost) report.losses.push(`${result.lost} ${DATA.items[drop.item]?.name || drop.item} lost because the inventory was full.`);
    }
    if (!offline) this.combatLog(`Defeated ${enemy.name} and earned ${coins} coins.`);

    if (activity.encounterId) {
      const encounter = DATA.encounters[activity.encounterId];
      activity.encounterIndex += 1;
      if (activity.encounterIndex >= encounter.sequence.length) {
        this.grantRewards(encounter.reward, report);
        this.notify('Encounter complete', encounter.name, 'combat');
        character.activity = null;
        report.messages.push(`Completed ${encounter.name}.`);
        return;
      }
      const nextId = encounter.sequence[activity.encounterIndex];
      activity.enemyId = nextId;
      activity.enemyHp = DATA.enemies[nextId].hp;
      activity.enemyStatuses = [];
      activity.telegraph = null;
      if (!offline) this.combatLog(`${DATA.enemies[nextId].name} enters the fight.`);
      return;
    }

    const automation = character.combat.automation;
    if (automation.stopAfterKills > 0 && activity.killsThisSession >= automation.stopAfterKills) {
      character.activity = null;
      report.messages.push('Combat stopped after reaching the kill target.');
      return;
    }
    if (automation.stopOnRareDrop && rareDropped) {
      character.activity = null;
      report.messages.push('Combat stopped after a rare drop.');
      return;
    }
    activity.enemyHp = enemy.hp;
    activity.enemyStatuses = [];
    activity.telegraph = null;
    activity.round = 0;
  }

  rollLootQuality(enemy, rng) {
    const roll = rng();
    const tier = enemy.level / 100;
    if (roll < 0.002 + tier * 0.006) return 'legendary';
    if (roll < 0.02 + tier * 0.04) return 'masterwork';
    if (roll < 0.1 + tier * 0.12) return 'superior';
    if (roll < 0.34 + tier * 0.2) return 'fine';
    return 'standard';
  }

  handleDefeat(report, message) {
    const character = this.character;
    const difficulty = DATA.difficulties[character.difficulty] || DATA.difficulties.standard;
    character.stats.deaths += 1;
    if (difficulty.permadeath) {
      character.flags.deceased = true;
      character.currentHp = 0;
      character.activity = null;
      report.messages.push('The Hardcore Chronicle has ended.');
      this.notify('Chronicle ended', 'Your Hardcore character was defeated.', 'danger');
      return;
    }
    const loss = Math.floor(character.coins * (difficulty.deathCoinLoss || 0));
    character.coins -= loss;
    for (const uid of Object.values(character.equipment)) {
      const found = this.findInstance(uid);
      if (found) found.instance.durability = Math.max(0, (found.instance.durability ?? 100) - 5);
    }
    character.currentHp = Math.round(this.getMaxHp() * 0.55);
    character.location = character.discoveredRegions.includes('willowbrook') ? 'willowbrook' : 'stonehaven';
    character.activity = null;
    report.messages.push(`${message} Lost ${loss} coins and returned to ${DATA.regions[character.location].name}.`);
    this.notify('Defeated', `Lost ${loss} coins and returned to safety.`, 'danger');
  }

  ensureFarmPlots() {
    const character = this.character;
    const desired = 2 + (character.buildings.garden?.level || 0);
    while (character.farming.plots.length < desired) {
      character.farming.plots.push({ id: safeUUID(), index: character.farming.plots.length, cropId: null, plantedAt: null, readyAt: null, composted: false });
    }
  }

  plantCrop(plotId, cropId, compost = false) {
    const character = this.requireCharacter();
    const crop = DATA.crops[cropId];
    const plot = character.farming.plots.find((entry) => entry.id === plotId);
    if (!plot || !crop) throw new Error('Unknown crop or plot.');
    if (plot.cropId) throw new Error('That plot is already planted.');
    if (this.getSkillLevel('farming') < crop.level) throw new Error(`Requires Farming level ${crop.level}.`);
    if (!this.hasStack(crop.seed, 1)) throw new Error(`Requires ${DATA.items[crop.seed].name}.`);
    if (compost && !this.hasStack('compost', 1)) throw new Error('Requires Compost.');
    this.removeStack(crop.seed, 1);
    if (compost) this.removeStack('compost', 1);
    const modifiers = this.getCombinedModifiers(character.location);
    const growMs = Math.round(crop.growMs / (1 + ((modifiers.farmingSpeed || 0) + this.getSkillLevel('farming') * 0.08) / 100));
    plot.cropId = cropId;
    plot.plantedAt = Date.now();
    plot.readyAt = Date.now() + growMs;
    plot.composted = compost;
    plot.notifiedReady = false;
    this.touch('crop-planted', { plotId, cropId }, true);
  }

  harvestCrop(plotId) {
    const character = this.requireCharacter();
    const plot = character.farming.plots.find((entry) => entry.id === plotId);
    if (!plot?.cropId) throw new Error('That plot is empty.');
    if (plot.readyAt > Date.now()) throw new Error('The crop is not ready yet.');
    const crop = DATA.crops[plot.cropId];
    const rng = seededRandom(character.worldSeed, plot.id, plot.plantedAt);
    const modifiers = this.getCombinedModifiers(character.location);
    const results = {};
    for (const [itemId, range] of Object.entries(crop.yield)) {
      let qty = randomInt(rng, range[0], range[1]);
      qty = Math.round(qty * (1 + ((modifiers.cropYield || 0) + (plot.composted ? 20 : 0) + (character.buildings.garden?.level || 0) * 4) / 100));
      results[itemId] = Math.max(1, qty);
    }
    for (const [itemId, qty] of Object.entries(results)) this.addItem(itemId, qty, { allowBankFallback: true });
    this.addXp('farming', crop.xp * (plot.composted ? 1.15 : 1));
    character.farming.harvests += 1;
    Object.assign(plot, { cropId: null, plantedAt: null, readyAt: null, composted: false, notifiedReady: false });
    this.touch('crop-harvested', { plotId, results }, true);
    return results;
  }

  buildBuilding(buildingId) {
    const character = this.requireCharacter();
    const building = DATA.buildings[buildingId];
    const state = character.buildings[buildingId];
    if (!building || !state) throw new Error('Unknown building.');
    if (character.location !== 'willowbrook') throw new Error('Personal construction is managed from Willowbrook.');
    if (state.level >= building.maxLevel) throw new Error('This building is already at maximum level.');
    const cost = scaleCost(building.baseCost, state.level, 1.65);
    if (!this.consumeAcrossStorage(cost)) throw new Error('You do not have the required construction materials.');
    state.level += 1;
    state.lastProcessedAt = Date.now();
    this.addXp('construction', 120 * state.level ** 1.7);
    this.ensureFarmPlots();
    this.notify('Construction complete', `${building.name} reached level ${state.level}.`, 'building');
    this.touch('building-upgraded', { buildingId, level: state.level, cost }, true);
  }

  getBuildingCost(buildingId) {
    const character = this.requireCharacter();
    const building = DATA.buildings[buildingId];
    const level = character.buildings[buildingId]?.level || 0;
    return scaleCost(building.baseCost, level, 1.65);
  }

  contributeProject(projectId, resourceId, amount) {
    const character = this.requireCharacter();
    const project = DATA.settlementProjects[projectId];
    const state = character.projects[projectId];
    if (!project || !state) throw new Error('Unknown settlement project.');
    if (character.location !== project.region) throw new Error(`Travel to ${DATA.regions[project.region].name} to contribute.`);
    if (state.complete) throw new Error('This project is already complete.');
    const required = Number(project.requirements[resourceId]) || 0;
    if (required <= 0) throw new Error('That resource is not required.');
    const current = resourceId === 'coins' ? state.coins || 0 : state.contributions[resourceId] || 0;
    const contribution = Math.max(0, Math.min(Math.floor(amount), required - current));
    if (!contribution) return;
    if (resourceId === 'coins') {
      if (character.coins < contribution) throw new Error('Not enough coins.');
      character.coins -= contribution;
      character.stats.coinsSpent += contribution;
      state.coins = current + contribution;
    } else {
      if (this.totalOwned(resourceId) < contribution) throw new Error(`Not enough ${DATA.items[resourceId]?.name || resourceId}.`);
      this.consumeAcrossStorage({ [resourceId]: contribution });
      state.contributions[resourceId] = current + contribution;
    }
    const complete = Object.entries(project.requirements).every(([id, qty]) => qty <= 0 || (id === 'coins' ? state.coins : state.contributions[id]) >= qty);
    if (complete) {
      state.complete = true;
      state.completedAt = Date.now();
      this.addXp('construction', 1200);
      this.addXp('leadership', 650);
      this.notify('Settlement project complete', project.name, 'building');
    }
    this.touch('project-contribution', { projectId, resourceId, contribution, complete }, true);
  }

  recruitCompanion(companionId) {
    const character = this.requireCharacter();
    const companion = DATA.companions[companionId];
    if (!companion) throw new Error('Unknown companion.');
    if (character.location !== companion.region) throw new Error(`Meet ${companion.name} in ${DATA.regions[companion.region].name}.`);
    if (character.companions.owned[companionId]) throw new Error('This companion is already recruited.');
    if (character.coins < companion.cost) throw new Error('Not enough coins.');
    character.coins -= companion.cost;
    character.stats.coinsSpent += companion.cost;
    character.companions.owned[companionId] = { level: 1, loyalty: 0, recruitedAt: Date.now() };
    this.addXp('leadership', 120);
    this.notify('Companion recruited', companion.name, 'companion');
    this.touch('companion-recruited', { companionId }, true);
  }

  startExpedition(companionId, expeditionId) {
    const character = this.requireCharacter();
    const owned = character.companions.owned[companionId];
    const expedition = DATA.expeditions[expeditionId];
    if (!owned || !expedition) throw new Error('Unknown companion or expedition.');
    if (character.companions.activeExpeditions.some((entry) => entry.companionId === companionId)) throw new Error('That companion is already away.');
    const maxActive = 1 + Math.floor(this.getSkillLevel('leadership') / 30);
    if (character.companions.activeExpeditions.length >= maxActive) throw new Error('Leadership is too low to manage another expedition.');
    const companion = DATA.companions[companionId];
    const roleBonus = companion.role === expedition.recommendedRole ? 0.85 : 1;
    const durationMs = Math.round(expedition.durationMs * roleBonus / (1 + this.getSkillLevel('leadership') * 0.002));
    character.companions.activeExpeditions.push({ id: safeUUID(), companionId, expeditionId, startedAt: Date.now(), endsAt: Date.now() + durationMs });
    this.touch('expedition-started', { companionId, expeditionId }, true);
  }

  completeExpedition(active, report, rng) {
    const character = this.character;
    const expedition = DATA.expeditions[active.expeditionId];
    const companion = DATA.companions[active.companionId];
    if (!expedition || !companion) return;
    const rewards = {};
    for (const reward of expedition.rewards) {
      const qty = randomInt(rng, reward.qty[0], reward.qty[1]);
      if (qty > 0) {
        rewards[reward.item] = qty;
        this.addItem(reward.item, qty, { location: 'bank', allowBankFallback: false });
      }
    }
    for (const [skill, xp] of Object.entries(expedition.xp || {})) this.addXp(skill, xp, report);
    const owned = character.companions.owned[active.companionId];
    owned.loyalty += companion.role === expedition.recommendedRole ? 8 : 4;
    owned.level = 1 + Math.floor(owned.loyalty / 100);
    addReportItems(report, rewards);
    report.messages.push(`${companion.name} returned from ${expedition.name}.`);
    this.notify('Expedition returned', `${companion.name} completed ${expedition.name}.`, 'companion');
  }

  startResearch(researchId) {
    const character = this.requireCharacter();
    const research = DATA.research[researchId];
    if (!research) throw new Error('Unknown research project.');
    if ((character.buildings.library?.level || 0) < 1) throw new Error('Build a Library first.');
    if (character.research.active) throw new Error('Another research project is already active.');
    if (character.research.completed.includes(researchId)) throw new Error('That research is already complete.');
    if (!this.consumeAcrossStorage(research.cost)) throw new Error('Missing research materials.');
    const duration = Math.round(research.durationMs / (1 + (character.buildings.library.level - 1) * 0.08));
    character.research.active = { researchId, startedAt: Date.now(), endsAt: Date.now() + duration };
    this.touch('research-started', { researchId }, true);
  }

  ensureTradeContracts(now = Date.now()) {
    const character = this.character;
    const day = new Date(now).toISOString().slice(0, 10);
    if (character.trade.contractsDay === day && character.trade.contracts.length) return;
    const rng = seededRandom(character.worldSeed, 'contracts', day);
    const templates = [...DATA.tradeContractTemplates].sort(() => rng() - 0.5).slice(0, 5);
    character.trade.contracts = templates.map((template, index) => {
      const qty = randomInt(rng, template.qty[0], template.qty[1]);
      const region = template.regions[Math.floor(rng() * template.regions.length)];
      const baseValue = DATA.items[template.item]?.value || 1;
      return {
        id: `${day}:${index}:${template.item}`,
        itemId: template.item,
        qty,
        region,
        faction: template.faction,
        reward: Math.round(baseValue * qty * template.multiplier),
        expiresAt: new Date(`${day}T23:59:59.999Z`).getTime(),
        status: 'open',
      };
    });
    character.trade.contractsDay = day;
  }

  fulfillContract(contractId) {
    const character = this.requireCharacter();
    const contract = character.trade.contracts.find((entry) => entry.id === contractId);
    if (!contract || contract.status !== 'open') throw new Error('That contract is no longer available.');
    if (contract.region !== character.location) throw new Error(`Deliver the goods in ${DATA.regions[contract.region].name}.`);
    if (this.totalOwned(contract.itemId) < contract.qty) throw new Error('You do not own enough of the requested item.');
    this.consumeAcrossStorage({ [contract.itemId]: contract.qty });
    character.coins += contract.reward;
    character.stats.coinsEarned += contract.reward;
    character.reputations[contract.faction] = (character.reputations[contract.faction] || 0) + 35;
    character.trade.fulfilled += 1;
    contract.status = 'fulfilled';
    this.addXp('mercantile', Math.round(contract.reward * 0.35));
    this.touch('contract-fulfilled', { contractId, reward: contract.reward }, true);
  }

  startTradeRoute(targetRegionId, itemId, qty) {
    const character = this.requireCharacter();
    if (!DATA.regions[targetRegionId] || targetRegionId === character.location) throw new Error('Choose another known settlement.');
    qty = Math.max(1, Math.floor(qty));
    if (this.totalOwned(itemId) < qty) throw new Error('Not enough cargo.');
    const plan = this.getTravelPlan(targetRegionId);
    if (!plan) throw new Error('No trade route reaches that destination.');
    const maxRoutes = 1 + Math.floor(this.getSkillLevel('mercantile') / 35);
    if (character.trade.activeRoutes.length >= maxRoutes) throw new Error('Mercantile is too low to manage another route.');
    this.consumeAcrossStorage({ [itemId]: qty });
    const sourcePrice = this.getSellPrice(itemId, character.location);
    const targetPrice = this.getSellPrice(itemId, targetRegionId);
    const profitFactor = 1.25 + Math.max(0, targetPrice - sourcePrice) / Math.max(1, sourcePrice);
    const modifiers = this.getCombinedModifiers(character.location);
    const payout = Math.round(targetPrice * qty * profitFactor * (1 + (modifiers.tradeProfit || 0) / 100));
    const durationMs = Math.round(plan.seconds * 5000 / (1 + (modifiers.tradeSpeed || 0) / 100));
    character.trade.activeRoutes.push({ id: safeUUID(), from: character.location, to: targetRegionId, itemId, qty, payout, startedAt: Date.now(), endsAt: Date.now() + durationMs });
    this.touch('trade-route-started', { targetRegionId, itemId, qty }, true);
  }

  completeTradeRoute(route, report, rng) {
    const character = this.character;
    const danger = DATA.regions[route.to]?.danger || 1;
    const modifiers = this.getCombinedModifiers(route.to);
    const insured = Boolean(modifiers.insuredTrade);
    const failureChance = clamp(0.03 + danger * 0.012 - this.getSkillLevel('mercantile') * 0.0005, 0.01, 0.3);
    if (rng() < failureChance && !insured) {
      const payout = Math.round(route.payout * 0.45);
      character.coins += payout;
      character.stats.coinsEarned += payout;
      report.coins += payout;
      report.messages.push(`A trade route to ${DATA.regions[route.to].name} was raided but recovered ${payout} coins.`);
    } else {
      character.coins += route.payout;
      character.stats.coinsEarned += route.payout;
      report.coins += route.payout;
      report.messages.push(`A trade route to ${DATA.regions[route.to].name} earned ${route.payout} coins.`);
    }
    this.addXp('mercantile', route.payout * 0.18, report);
    this.addXp('leadership', route.payout * 0.06, report);
  }

  buildShip() {
    const character = this.requireCharacter();
    if (!['waveport', 'harbor_dock'].includes(character.location)) throw new Error('Ships are built at Waveport or Harbor Dock.');
    if (character.sailing.ship) throw new Error('You already own a ship.');
    const cost = { coins: 3500, ship_timber: 12, ship_fittings: 6, cloth_sail: 5 };
    if (!this.consumeAcrossStorage(cost)) throw new Error('Missing ship construction materials.');
    character.sailing.ship = { id: safeUUID(), name: `${character.name}'s Venture`, level: 1, condition: 100, cargoSlots: 12, crew: [] };
    this.addXp('sailing', 800);
    this.addXp('construction', 500);
    this.notify('Ship launched', character.sailing.ship.name, 'sailing');
    this.touch('ship-built', {}, true);
  }

  startVoyage(voyageId) {
    const character = this.requireCharacter();
    const voyage = DATA.voyages[voyageId];
    if (!voyage) throw new Error('Unknown voyage.');
    if (!character.sailing.ship) throw new Error('Build a ship first.');
    if (!['waveport', 'harbor_dock'].includes(character.location)) throw new Error('Voyages depart from Waveport or Harbor Dock.');
    if (character.sailing.activeVoyage) throw new Error('Your ship is already at sea.');
    if (this.getSkillLevel('sailing') < voyage.sailingLevel) throw new Error(`Requires Sailing level ${voyage.sailingLevel}.`);
    const modifiers = this.getCombinedModifiers(character.location);
    const durationMs = Math.round(voyage.durationMs / (1 + (this.getSkillLevel('sailing') * 0.12 + (modifiers.tradeSpeed || 0)) / 100));
    character.sailing.activeVoyage = { id: safeUUID(), voyageId, startedAt: Date.now(), endsAt: Date.now() + durationMs };
    this.touch('voyage-started', { voyageId }, true);
  }

  completeVoyage(active, report, rng) {
    const character = this.character;
    const voyage = DATA.voyages[active.voyageId];
    if (!voyage) return;
    const modifiers = this.getCombinedModifiers('waveport');
    const dangerChance = clamp(voyage.danger * 0.025 + (modifiers.sailingDanger || 0) / 100 - this.getSkillLevel('sailing') * 0.0008, 0.01, 0.45);
    const damaged = rng() < dangerChance;
    if (damaged) {
      character.sailing.ship.condition = Math.max(10, character.sailing.ship.condition - randomInt(rng, 8, 22));
      report.messages.push(`The voyage to ${voyage.name} encountered severe danger.`);
    }
    const rewards = {};
    for (const reward of voyage.rewards) {
      let qty = randomInt(rng, reward.qty[0], reward.qty[1]);
      if (damaged) qty = Math.floor(qty * 0.65);
      if (qty > 0) {
        rewards[reward.item] = qty;
        this.addItem(reward.item, qty, { location: 'bank' });
      }
    }
    if (voyage.discovery && !character.discoveredSecrets.includes(voyage.discovery)) {
      character.discoveredSecrets.push(voyage.discovery);
      character.collections.discoveries.push(voyage.discovery);
    }
    character.sailing.voyagesCompleted += 1;
    this.addXp('sailing', 300 + voyage.sailingLevel * 12, report);
    this.addXp('cartography', 150 + voyage.sailingLevel * 6, report);
    addReportItems(report, rewards);
    report.messages.push(`The ship returned from ${voyage.name}.`);
    this.notify('Voyage returned', voyage.name, 'sailing');
  }

  getSellPrice(itemId, regionId = this.character?.location) {
    const item = DATA.items[itemId];
    if (!item) return 0;
    const profile = REGION_PRICE_PROFILES[regionId] || {};
    let multiplier = 1;
    for (const tag of item.tags || []) if (profile[tag] !== undefined) multiplier *= profile[tag];
    const modifiers = this.getCombinedModifiers(regionId);
    multiplier *= 1 + (modifiers.sellBonus || 0) / 100;
    multiplier *= 1 + this.getSkillLevel('mercantile') * 0.0015;
    return Math.max(1, Math.round(item.value * 0.7 * multiplier));
  }

  getBuyPrice(itemId, regionId = this.character?.location) {
    const item = DATA.items[itemId];
    if (!item) return 0;
    const profile = REGION_PRICE_PROFILES[regionId] || {};
    let multiplier = 1;
    for (const tag of item.tags || []) if (profile[tag] !== undefined) multiplier *= profile[tag];
    const modifiers = this.getCombinedModifiers(regionId);
    multiplier *= 1 - (modifiers.buyDiscount || 0) / 100;
    multiplier *= 1 - this.getSkillLevel('mercantile') * 0.001;
    return Math.max(1, Math.round(item.value * 1.18 * multiplier));
  }

  getMarketStock(regionId = this.character?.location) {
    const region = DATA.regions[regionId];
    if (!region?.services.includes('market')) return [];
    const base = ['fish_shrimp_cooked', 'potion_healing', 'seed_grain', 'seed_vegetable', 'compost', 'trap_simple', 'rune_blank'];
    if (regionId === 'stonehaven') base.push('ore_copper', 'ore_tin', 'axe_bronze', 'pick_bronze');
    if (regionId === 'pineglade') base.push('logs_normal', 'arrow_bronze', 'fiber_flax');
    if (regionId === 'riverside') base.push('grain', 'vegetable', 'fish_trout_raw');
    if (regionId === 'willowbrook') base.push('bar_bronze', 'cloth_linen', 'potion_antidote');
    if (regionId === 'waveport') base.push('cargo_spices', 'cloth_sail', 'fish_salmon_raw');
    if (regionId === 'watchpost') base.push('potion_emberward', 'fish_salmon_cooked', 'bar_steel');
    return [...new Set(base)].filter((id) => DATA.items[id]);
  }

  buyItem(itemId, qty = 1) {
    const character = this.requireCharacter();
    const difficulty = DATA.difficulties[character.difficulty];
    if (difficulty.noMarketBuy) throw new Error('Iron Chronicles cannot buy market goods.');
    if (!this.getMarketStock().includes(itemId)) throw new Error('That item is not sold here.');
    qty = Math.max(1, Math.floor(qty));
    const cost = this.getBuyPrice(itemId) * qty;
    if (character.coins < cost) throw new Error('Not enough coins.');
    const result = this.addItem(itemId, qty);
    if (result.added !== qty) throw new Error('The inventory is full.');
    character.coins -= cost;
    character.stats.coinsSpent += cost;
    this.addXp('mercantile', cost * 0.04);
    this.touch('market-buy', { itemId, qty, cost }, true);
  }

  sellItem(itemId, qty = 1, location = 'inventory') {
    const character = this.requireCharacter();
    const item = DATA.items[itemId];
    if (!item || item.currency || item.value <= 0) throw new Error('That item cannot be sold.');
    qty = Math.max(1, Math.floor(qty));
    if (item.stackable === false) throw new Error('Use the equipment item menu to sell individual gear.');
    const available = this.stackQty(itemId, location);
    const amount = Math.min(available, qty);
    if (!amount) throw new Error('You do not have that item there.');
    this.removeStack(itemId, amount, location);
    const coins = this.getSellPrice(itemId) * amount;
    character.coins += coins;
    character.stats.coinsEarned += coins;
    this.addXp('mercantile', coins * 0.025);
    this.touch('market-sell', { itemId, amount, coins }, true);
    return coins;
  }

  sellInstance(uid) {
    const character = this.requireCharacter();
    const found = this.findInstance(uid);
    if (!found || found.location !== 'inventory') throw new Error('The item must be in your inventory.');
    if (this.isEquipped(uid)) throw new Error('Unequip the item before selling it.');
    if (found.instance.locked) throw new Error('Unlock the item before selling it.');
    const item = DATA.items[found.instance.itemId];
    const multiplier = QUALITY_MULTIPLIER[found.instance.quality] || 1;
    const coins = Math.round(this.getSellPrice(item.id) * multiplier * (1 + found.instance.affixes.length * 0.12));
    character.inventory.instances.splice(found.index, 1);
    character.coins += coins;
    character.stats.coinsEarned += coins;
    this.touch('market-sell-instance', { uid, coins }, true);
    return coins;
  }

  startQuest(questId) {
    const character = this.requireCharacter();
    const state = character.quests[questId];
    if (!state || state.status !== 'available') throw new Error('That quest is not available.');
    state.status = 'active';
    this.touch('quest-started', { questId }, true);
  }

  getObjectiveProgress(objective) {
    const character = this.character;
    if (!character) return 0;
    switch (objective.type) {
      case 'visit':
      case 'discover': return character.discoveredRegions.includes(objective.region) ? 1 : 0;
      case 'item': return this.totalOwned(objective.item);
      case 'skillLevel': return this.getSkillLevel(objective.skill);
      case 'kill': return character.stats.enemyKills[objective.enemy] || 0;
      case 'craft': return character.stats.actionCounts[objective.action] || 0;
      case 'build': return character.buildings[objective.building]?.level || 0;
      case 'reputation': return character.reputations[objective.faction] || 0;
      case 'discoverCount': return character.discoveredRegions.length;
      case 'project': return character.projects[objective.project]?.complete ? 1 : 0;
      case 'voyage': return character.sailing.voyagesCompleted;
      default: return 0;
    }
  }

  isQuestComplete(questId) {
    const quest = DATA.quests[questId];
    if (!quest) return false;
    // Authored staged quests are advanced by the narrative runtime. Treat
    // their explicit story state as the source of truth instead of trying to
    // evaluate the legacy flat-objective schema.
    if (quest.stages?.length) return this.character?.quests?.[questId]?.status === 'completed';
    return (quest.objectives || []).every((objective) => this.getObjectiveProgress(objective) >= objective.count);
  }

  refreshQuestStates() {
    const character = this.character;
    for (const [questId, quest] of Object.entries(DATA.quests)) {
      // Staged quests have investigations, decision gates, and authored world
      // consequences that cannot be represented by the legacy ready/claim
      // loop. The Memory Beneath runtime owns those transitions.
      if (quest.stages?.length) continue;
      const state = character.quests[questId];
      if (!state || ['completed', 'locked'].includes(state.status)) continue;
      if (state.status === 'active' && this.isQuestComplete(questId)) state.status = 'ready';
      else if (state.status === 'ready' && !this.isQuestComplete(questId)) state.status = 'active';
    }
  }

  claimQuest(questId, choiceId = null) {
    const character = this.requireCharacter();
    const quest = DATA.quests[questId];
    const state = character.quests[questId];
    if (!quest || !state || !['active', 'ready'].includes(state.status) || !this.isQuestComplete(questId)) throw new Error('Quest objectives are not complete.');
    if (quest.choices && !quest.choices.some((choice) => choice.id === choiceId)) throw new Error('Choose a quest outcome.');
    for (const objective of quest.objectives || []) if (objective.type === 'item' && !objective.keepItems) this.consumeAcrossStorage({ [objective.item]: objective.count });
    this.grantRewards(quest.rewards);
    const choice = quest.choices?.find((entry) => entry.id === choiceId);
    if (choice) {
      state.choice = choice.id;
      this.grantRewards(choice.rewards);
    }
    state.status = 'completed';
    state.claimedAt = Date.now();
    character.stats.questsCompleted += 1;
    for (const unlock of quest.unlocks || []) if (character.quests[unlock]) character.quests[unlock].status = 'available';
    this.notify('Quest complete', quest.name, 'quest');
    this.touch('quest-claimed', { questId, choiceId }, true);
  }

  grantRewards(rewards = {}, report = null) {
    const character = this.character;
    if (rewards.coins) {
      character.coins += rewards.coins;
      character.stats.coinsEarned += rewards.coins;
      if (report) report.coins += rewards.coins;
    }
    for (const [skill, xp] of Object.entries(rewards.xp || {})) this.addXp(skill, xp, report);
    for (const [faction, reputation] of Object.entries(rewards.reputation || {})) character.reputations[faction] = (character.reputations[faction] || 0) + reputation;
    for (const [itemId, qty] of Object.entries(rewards.items || {})) {
      const result = this.addItem(itemId, qty, { allowBankFallback: true });
      if (report && result.added) addReportItems(report, { [itemId]: result.added });
    }
    if (rewards.legacyPoints) character.legacy.points += rewards.legacyPoints;
  }

  checkAchievements() {
    const character = this.character;
    for (const [id, achievement] of Object.entries(DATA.achievements)) {
      if (character.collections.achievements.includes(id) || !this.isAchievementComplete(achievement.check)) continue;
      character.collections.achievements.push(id);
      this.grantRewards(achievement.reward);
      this.notify('Achievement unlocked', achievement.name, 'achievement');
      this.emit('achievement', { id });
    }
  }

  isAchievementComplete(check) {
    const character = this.character;
    if (check.stat) return (character.stats[check.stat] || 0) >= check.count;
    if (check.anySkillLevel) return Object.keys(DATA.skills).some((id) => this.getSkillLevel(id) >= check.anySkillLevel);
    if (check.discoveredRegions) return character.discoveredRegions.length >= check.discoveredRegions;
    if (check.discoveredItems) return character.collections.items.length >= check.discoveredItems;
    if (check.buildingCount) return Object.values(character.buildings).filter((state) => state.level > 0).length >= check.buildingCount;
    if (check.anyReputation) return Object.values(character.reputations).some((value) => value >= check.anyReputation);
    if (check.killEnemy) return (character.stats.enemyKills[check.killEnemy] || 0) >= check.count;
    return false;
  }

  saveLoadout(name) {
    const character = this.requireCharacter();
    const clean = String(name || '').trim().slice(0, 24) || `Loadout ${character.loadouts.length + 1}`;
    const loadout = { id: safeUUID(), name: clean, equipment: deepClone(character.equipment), style: character.combat.style };
    character.loadouts.push(loadout);
    character.loadouts = character.loadouts.slice(-12);
    this.touch('loadout-saved', { id: loadout.id }, true);
  }

  applyLoadout(loadoutId) {
    const character = this.requireCharacter();
    if (!DATA.regions[character.location]?.services?.includes('bank')) throw new Error('Loadouts can only be changed at a bank.');
    const loadout = character.loadouts.find((entry) => entry.id === loadoutId);
    if (!loadout) throw new Error('Unknown loadout.');
    const valid = {};
    for (const [slot, uid] of Object.entries(loadout.equipment)) {
      if (!uid || slot === 'familiar') valid[slot] = uid;
      else if (this.findInstance(uid)) valid[slot] = uid;
    }
    character.equipment = { ...character.equipment, ...valid };
    character.combat.style = loadout.style || character.combat.style;
    this.touch('loadout-applied', { loadoutId }, true);
  }

  canStartChronicle() {
    const character = this.character;
    return character?.quests?.main_ember_crown?.status === 'completed' || this.getTotalLevel() >= 1800;
  }

  beginNewChronicle() {
    const old = this.requireCharacter();
    if (!this.canStartChronicle()) throw new Error('Complete The Ember Crown or reach total level 1,800 first.');
    const legacy = deepClone(old.legacy);
    legacy.chronicles += 1;
    legacy.points += 1;
    const fresh = createNewCharacter({ name: old.name, background: old.background, difficulty: old.difficulty, seed: old.worldSeed + legacy.chronicles });
    fresh.legacy = legacy;
    fresh.title = 'Chronicler';
    this.account.slots[this.activeSlot] = fresh;
    this.notify('New Chronicle begun', 'Legacy progress has been preserved.', 'legacy');
    this.touch('chronicle-started', {}, true);
  }

  notify(title, message, type = 'info') {
    const character = this.character;
    if (!character) return;
    const notification = { id: safeUUID(), time: Date.now(), title, message, type, read: false };
    character.inbox.push(notification);
    character.inbox = character.inbox.slice(-100);
    this.emit('notification', { notification });
  }

  markInboxRead() {
    const character = this.requireCharacter();
    for (const entry of character.inbox) entry.read = true;
    this.touch('inbox-read');
  }

  log(message) {
    const character = this.character;
    if (!character) return;
    character.inbox.push({ id: safeUUID(), time: Date.now(), title: 'Activity', message, type: 'log', read: true });
    character.inbox = character.inbox.slice(-100);
  }

  combatLog(message) {
    const character = this.character;
    if (!character) return;
    character.combat.log.unshift({ time: Date.now(), message });
    character.combat.log = character.combat.log.slice(0, 120);
  }
}

installMemorySystems(GameEngine);

function createReport(startedAt, endedAt, rawElapsed, elapsed, offline) {
  return {
    id: safeUUID(),
    startedAt,
    endedAt,
    rawElapsed,
    elapsed,
    offline,
    changed: false,
    items: {},
    xp: {},
    coins: 0,
    combatKills: {},
    losses: [],
    messages: [],
  };
}

function addReportItems(report, items) {
  if (!report) return;
  mergeQuantities(report.items, items);
}

function scaleCost(baseCost, currentLevel, factor) {
  const cost = {};
  for (const [id, qty] of Object.entries(baseCost || {})) cost[id] = Math.ceil(qty * factor ** currentLevel);
  return cost;
}

function sumRandomRange(rng, count, min, max) {
  if (count <= 2500) {
    let total = 0;
    for (let i = 0; i < count; i += 1) total += randomInt(rng, min, max);
    return total;
  }
  const mean = (min + max) / 2;
  const spread = (max - min) / Math.sqrt(12);
  const noise = (rng() + rng() + rng() + rng() - 2) * spread * Math.sqrt(count);
  return Math.max(0, Math.round(mean * count + noise));
}

function applyStatus(statuses, incoming) {
  const existing = statuses.find((status) => status.id === incoming.id);
  if (existing) {
    existing.stacks = clamp(existing.stacks + incoming.stacks, 1, 20);
    existing.power = Math.max(existing.power, incoming.power);
    existing.turns = Math.max(existing.turns, incoming.turns);
  } else statuses.push({ ...incoming });
}

function getStatusStacks(statuses, id) {
  return statuses.find((status) => status.id === id)?.stacks || 0;
}

function titleFromId(id) {
  return String(id || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
