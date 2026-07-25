import {
  MEMORY_SKILLS,
  MEMORY_FACTIONS,
  MEMORY_ITEMS,
  MEMORY_ACTIONS,
  MEMORY_ENEMIES,
  STORY_QUESTS,
  NPCS,
  INVESTIGATION_SCENES,
  ANIMALS,
  RITUALS,
  DIPLOMACY_ACTIONS,
  DUNGEONS,
  REGION_VARIANTS,
  SPECIALIZATIONS,
  SKILL_MILESTONES,
  MEMORY_SETTLEMENT_PROJECTS,
  MEMORY_RESEARCH,
} from './memory-content.js';

export const APP_VERSION = '1.1.1';
export const SAVE_SCHEMA_VERSION = 7;

const skills = {
  woodcutting: { name: 'Woodcutting', icon: '🪓', category: 'Gathering', description: 'Harvest timber, bark, sap, nests, and rare heartwood from Eldoria’s forests.' },
  mining: { name: 'Mining', icon: '⛏️', category: 'Gathering', description: 'Extract ore, gemstones, crystal, and volcanic materials from dangerous seams.' },
  fishing: { name: 'Fishing', icon: '🎣', category: 'Gathering', description: 'Catch river, lake, coastal, and deep-sea creatures with specialized methods.' },
  foraging: { name: 'Foraging', icon: '🌿', category: 'Gathering', description: 'Gather herbs, mushrooms, resins, fibers, and wild ingredients.' },
  farming: { name: 'Farming', icon: '🌱', category: 'Gathering', description: 'Cultivate crops and trees in persistent plots that mature while you are away.', passive: true },
  hunting: { name: 'Hunting', icon: '🏹', category: 'Gathering', description: 'Track, trap, and hunt creatures for hides, meat, trophies, and companions.' },
  archaeology: { name: 'Archaeology', icon: '🏺', category: 'Gathering', description: 'Survey sites, restore artifacts, and uncover Eldoria’s buried history.' },

  cooking: { name: 'Cooking', icon: '🍳', category: 'Production', description: 'Prepare food with healing, combat, travel, and skill bonuses.' },
  smithing: { name: 'Smithing', icon: '🔨', category: 'Production', description: 'Smelt metals and forge tools, weapons, armor, and ship fittings.' },
  crafting: { name: 'Crafting', icon: '🧰', category: 'Production', description: 'Work leather, gems, pottery, components, and utility equipment.' },
  fletching: { name: 'Fletching', icon: '🏹', category: 'Production', description: 'Create bows, arrows, crossbows, and specialized ammunition.' },
  tailoring: { name: 'Tailoring', icon: '🧵', category: 'Production', description: 'Weave fibers and sew robes, bags, sails, and protective garments.' },
  herblore: { name: 'Herblore', icon: '⚗️', category: 'Production', description: 'Brew potions, salves, tonics, oils, and corruption resistance.' },
  runecrafting: { name: 'Runecrafting', icon: '🔷', category: 'Production', description: 'Shape crystal and essence into runes that power magic and travel.' },
  enchanting: { name: 'Enchanting', icon: '✨', category: 'Production', description: 'Imbue equipment with controlled magical properties.' },
  construction: { name: 'Construction', icon: '🏗️', category: 'Production', description: 'Build and improve housing, workshops, roads, and settlement projects.' },

  attack: { name: 'Attack', icon: '⚔️', category: 'Combat', description: 'Improves melee accuracy and access to martial abilities.', combat: true },
  strength: { name: 'Strength', icon: '💪', category: 'Combat', description: 'Improves melee damage and heavy-weapon efficiency.', combat: true },
  defence: { name: 'Defence', icon: '🛡️', category: 'Combat', description: 'Improves armor use, block, and resistance to physical attacks.', combat: true },
  vitality: { name: 'Vitality', icon: '❤', category: 'Combat', description: 'Improves maximum health, recovery, and survival.', combat: true, startsAt: 10 },
  ranged: { name: 'Ranged', icon: '🏹', category: 'Combat', description: 'Improves ranged accuracy, damage, and ammunition preservation.', combat: true },
  sorcery: { name: 'Sorcery', icon: '🪄', category: 'Combat', description: 'Improves elemental and arcane spellcasting.', combat: true },
  faith: { name: 'Faith', icon: '☀️', category: 'Combat', description: 'Improves healing, wards, cleansing, and radiant attacks.', combat: true },
  slayer: { name: 'Slayer', icon: '☠️', category: 'Combat', description: 'Improves performance against assigned and corrupted creatures.', combat: true },

  agility: { name: 'Agility', icon: '🥾', category: 'Utility', description: 'Reduces travel time and unlocks shortcuts and obstacle courses.' },
  thieving: { name: 'Thieving', icon: '🗝️', category: 'Utility', description: 'Pick pockets, infiltrate sites, and obtain illicit information.' },
  sailing: { name: 'Sailing', icon: '⛵', category: 'Utility', description: 'Build ships, command crews, and explore waters beyond Eldoria.' },
  mercantile: { name: 'Mercantile', icon: '⚖️', category: 'Utility', description: 'Improves regional trade, contracts, cargo, and negotiation.' },
  leadership: { name: 'Leadership', icon: '🎖️', category: 'Utility', description: 'Improves companions, crews, workers, and combat automation.' },

  summoning: { name: 'Summoning', icon: '🐾', category: 'Advanced', description: 'Bind familiars that support gathering, travel, and combat.' },
  engineering: { name: 'Engineering', icon: '⚙️', category: 'Advanced', description: 'Construct machinery, traps, pumps, siege devices, and automation.' },
  cartography: { name: 'Cartography', icon: '🗺️', category: 'Advanced', description: 'Survey routes, reveal secrets, improve expeditions, and master the world map.' },
};

const factions = {
  willowbrook_crown: { name: 'Willowbrook Crown', icon: '♛', description: 'The central government, focused on roads, taxes, and military stability.' },
  prospectors_compact: { name: 'Stonehaven Prospectors’ Compact', icon: '⛏️', description: 'Miners, engineers, and merchants seeking access to the Greyspine range.' },
  deepforge_clans: { name: 'Deepforge Clans', icon: '⚒️', description: 'Dwarven clans guarding sealed knowledge beneath their ancestral mine.' },
  pineglade_wardens: { name: 'Pineglade Wardens', icon: '🌲', description: 'Hunters and foresters defending western Eldoria’s ecology.' },
  willow_circle: { name: 'Circle of Willow Grove', icon: '☘️', description: 'Druids studying Heartglass corruption and natural restoration.' },
  riverside_league: { name: 'Riverside League', icon: '🌾', description: 'Farmers, traders, millers, and riverboat operators controlling food supply.' },
  free_captains: { name: 'Free Captains of Waveport', icon: '⚓', description: 'Independent sailors and merchants who resist Crown control.' },
  watchpost_sentinels: { name: 'Watchpost Sentinels', icon: '🏰', description: 'An isolated military order holding the eastern frontier.' },
  ashen_covenant: { name: 'Ashen Covenant', icon: '🔥', description: 'A secretive sect that believes Mount Ember must fully awaken.', hidden: true },
};

const regions = {
  stonehaven: {
    name: 'Stonehaven', icon: '🏘️', x: 21.8, y: 13.5, faction: 'prospectors_compact', danger: 1, recommended: 1,
    description: 'A mountain settlement built around ore caravans, forges, and the Greyspine trade road.',
    services: ['market', 'forge', 'bank', 'contracts'], resources: ['copper', 'tin', 'stone'], weatherProfile: 'mountain',
  },
  coal_pit: {
    name: 'Coal Pit', icon: '⚫', x: 22.2, y: 22.2, faction: 'prospectors_compact', danger: 2, recommended: 8,
    description: 'An exposed seam of coal, sulfur, and unstable mineral pockets above Stonehaven.',
    services: ['mine'], resources: ['coal', 'sulfur', 'gem'], weatherProfile: 'mountain',
  },
  highpass_quarry: {
    name: 'Highpass Quarry', icon: '🪨', x: 27.2, y: 34.2, faction: 'prospectors_compact', danger: 3, recommended: 15,
    description: 'A wind-scoured quarry extracting iron and masonry stone from the high pass.',
    services: ['mine', 'contracts'], resources: ['iron', 'stone', 'silver'], weatherProfile: 'mountain',
  },
  dwarven_mine: {
    name: 'Dwarven Mine', icon: '⛏️', x: 8.5, y: 45.7, faction: 'deepforge_clans', danger: 5, recommended: 22,
    description: 'A multi-level complex of ancient machines, sealed galleries, and deep mineral veins.',
    services: ['mine', 'dungeon', 'forge'], resources: ['iron', 'coal', 'crystal', 'relics'], weatherProfile: 'underground',
  },
  pineglade: {
    name: 'Pineglade', icon: '🌲', x: 15.1, y: 66.2, faction: 'pineglade_wardens', danger: 2, recommended: 5,
    description: 'A fortified forest town of wardens, fletchers, trappers, and timber workers.',
    services: ['market', 'lodge', 'bank'], resources: ['oak', 'willow', 'hides', 'herbs'], weatherProfile: 'forest',
  },
  willow_grove: {
    name: 'Willow Grove', icon: '☘️', x: 25.8, y: 86.6, faction: 'willow_circle', danger: 2, recommended: 10,
    description: 'A druidic sanctuary where rare plants grow around a surviving Heartglass root.',
    services: ['herblore', 'grove', 'farming'], resources: ['willow', 'herbs', 'essence'], weatherProfile: 'forest',
  },
  willowbrook: {
    name: 'Willowbrook', icon: '🏰', x: 43.1, y: 74.8, faction: 'willowbrook_crown', danger: 1, recommended: 1,
    description: 'The capital of Eldoria and its main center for banking, guilds, housing, and politics.',
    services: ['bank', 'market', 'guilds', 'housing', 'museum', 'contracts'], resources: ['trade'], weatherProfile: 'temperate',
  },
  riverside: {
    name: 'Riverside', icon: '🌾', x: 43.0, y: 34.0, faction: 'riverside_league', danger: 1, recommended: 3,
    description: 'A prosperous river settlement of farms, mills, kitchens, and inland fishers.',
    services: ['market', 'farming', 'mill', 'bank'], resources: ['crops', 'fish', 'fiber'], weatherProfile: 'river',
  },
  crystal_lake: {
    name: 'Crystal Lake', icon: '💎', x: 56.0, y: 54.1, faction: 'willow_circle', danger: 4, recommended: 18,
    description: 'A vast magical lake hiding submerged ruins and unstable crystalline currents.',
    services: ['fishing', 'archaeology', 'runecrafting'], resources: ['fish', 'crystal', 'relics'], weatherProfile: 'lake',
  },
  mount_ember: {
    name: 'Mount Ember', icon: '🌋', x: 64.1, y: 30.4, faction: 'ashen_covenant', danger: 9, recommended: 55,
    description: 'An awakened volcano whose lava chambers feed corruption throughout eastern Eldoria.',
    services: ['dungeon', 'boss'], resources: ['emberite', 'obsidian', 'ashbloom'], weatherProfile: 'volcanic',
  },
  obsidian_quarry: {
    name: 'Obsidian Quarry', icon: '🖤', x: 64.0, y: 42.0, faction: 'prospectors_compact', danger: 7, recommended: 40,
    description: 'A brutal volcanic quarry where heat, gas, and unstable glass make every shift dangerous.',
    services: ['mine', 'forge'], resources: ['obsidian', 'emberite', 'gems'], weatherProfile: 'volcanic',
  },
  the_wilds: {
    name: 'The Wilds', icon: '☠️', x: 83.5, y: 51.5, faction: 'watchpost_sentinels', danger: 8, recommended: 45,
    description: 'A corrupted forest of shifting monster territories, dead trees, and Heartglass scars.',
    services: ['slayer', 'hunting', 'elite'], resources: ['rare_hides', 'venom', 'corrupted_wood'], weatherProfile: 'corrupted',
  },
  watchpost: {
    name: 'Watchpost', icon: '🏯', x: 90.2, y: 69.6, faction: 'watchpost_sentinels', danger: 6, recommended: 35,
    description: 'The last secure eastern fortress, supplied through dangerous roads and constant patrols.',
    services: ['bank', 'contracts', 'defence', 'market'], resources: ['military'], weatherProfile: 'corrupted',
  },
  waveport: {
    name: 'Waveport', icon: '⚓', x: 73.2, y: 79.7, faction: 'free_captains', danger: 2, recommended: 20,
    description: 'A free port of sailors, smugglers, shipwrights, traders, and foreign crews.',
    services: ['market', 'shipyard', 'bank', 'tavern'], resources: ['trade', 'fish', 'sails'], weatherProfile: 'coast',
  },
  harbor_dock: {
    name: 'Harbor Dock', icon: '🛶', x: 89.1, y: 87.2, faction: 'free_captains', danger: 2, recommended: 20,
    description: 'Waveport’s ship construction and cargo district, connected to coastal routes.',
    services: ['shipyard', 'cargo', 'voyages'], resources: ['ships', 'cargo'], weatherProfile: 'coast',
  },
  coastal_fishing: {
    name: 'Coastal Fishing', icon: '🐟', x: 90.2, y: 95.7, faction: 'free_captains', danger: 3, recommended: 25,
    description: 'Rich coastal waters whose catches change with wind, tide, and migration.',
    services: ['fishing'], resources: ['fish', 'shellfish'], weatherProfile: 'coast',
  },
  cave_mouth: {
    name: 'Cave Mouth', icon: '🕳️', x: 73.4, y: 95.4, faction: 'free_captains', danger: 5, recommended: 32,
    description: 'A tidal cavern connecting smuggler tunnels, buried waterways, and forgotten chambers.',
    services: ['dungeon', 'archaeology'], resources: ['relics', 'crystal', 'smuggled_goods'], weatherProfile: 'underground',
  },
};

const routes = [
  ['stonehaven', 'coal_pit', 22], ['stonehaven', 'highpass_quarry', 35], ['stonehaven', 'riverside', 48],
  ['coal_pit', 'highpass_quarry', 26], ['highpass_quarry', 'dwarven_mine', 52], ['highpass_quarry', 'riverside', 38],
  ['dwarven_mine', 'pineglade', 42], ['pineglade', 'willow_grove', 35], ['pineglade', 'willowbrook', 38],
  ['willow_grove', 'willowbrook', 28], ['riverside', 'willowbrook', 40], ['riverside', 'crystal_lake', 30],
  ['crystal_lake', 'willowbrook', 35], ['crystal_lake', 'obsidian_quarry', 32], ['obsidian_quarry', 'mount_ember', 40],
  ['obsidian_quarry', 'the_wilds', 45], ['the_wilds', 'watchpost', 34], ['the_wilds', 'waveport', 42],
  ['willowbrook', 'waveport', 48], ['waveport', 'watchpost', 35], ['waveport', 'harbor_dock', 24],
  ['harbor_dock', 'coastal_fishing', 16], ['waveport', 'cave_mouth', 27], ['cave_mouth', 'coastal_fishing', 25],
];

const items = {};
function addItem(id, name, icon, value, extra = {}) {
  items[id] = { id, name, icon, value, stackable: extra.stackable ?? true, rarity: extra.rarity || 'common', tags: extra.tags || [], ...extra };
}

// Raw resources and processed materials.
addItem('logs_normal', 'Normal Logs', '🪵', 2, { tags: ['wood', 'pineglade'] });
addItem('logs_oak', 'Oak Logs', '🪵', 7, { tags: ['wood', 'pineglade'] });
addItem('logs_willow', 'Willow Logs', '🪵', 14, { tags: ['wood', 'willow_grove'] });
addItem('logs_maple', 'Maple Logs', '🪵', 28, { tags: ['wood'] });
addItem('logs_yew', 'Yew Logs', '🪵', 65, { tags: ['wood'] });
addItem('logs_ironwood', 'Ironwood Logs', '🪵', 140, { tags: ['wood', 'rare'], rarity: 'rare' });
addItem('logs_emberwood', 'Emberwood Logs', '🔥', 260, { tags: ['wood', 'volcanic'], rarity: 'epic' });
addItem('bark', 'Tough Bark', '🟫', 8, { tags: ['wood', 'crafting'] });
addItem('resin', 'Tree Resin', '🟠', 16, { tags: ['wood', 'herblore'] });
addItem('bird_nest', 'Bird Nest', '🪺', 40, { tags: ['seed', 'rare'], rarity: 'uncommon' });

addItem('stone', 'Masonry Stone', '🪨', 2, { tags: ['stone', 'construction'] });
addItem('ore_copper', 'Copper Ore', '🟤', 3, { tags: ['ore', 'stonehaven'] });
addItem('ore_tin', 'Tin Ore', '⚪', 3, { tags: ['ore', 'stonehaven'] });
addItem('ore_iron', 'Iron Ore', '🔘', 11, { tags: ['ore'] });
addItem('ore_coal', 'Coal', '⚫', 8, { tags: ['ore', 'fuel'] });
addItem('ore_silver', 'Silver Ore', '◻️', 30, { tags: ['ore', 'precious'] });
addItem('ore_gold', 'Gold Ore', '🟡', 65, { tags: ['ore', 'precious'] });
addItem('ore_obsidian', 'Obsidian Shard', '🖤', 110, { tags: ['ore', 'volcanic'], rarity: 'rare' });
addItem('ore_crystal', 'Heartglass Fragment', '💎', 150, { tags: ['crystal', 'magic'], rarity: 'rare' });
addItem('ore_emberite', 'Emberite Ore', '🔶', 310, { tags: ['ore', 'volcanic'], rarity: 'epic' });
addItem('sulfur', 'Sulfur', '🟨', 15, { tags: ['alchemy', 'engineering'] });
addItem('gem_sapphire', 'Sapphire', '🔷', 90, { tags: ['gem'], rarity: 'uncommon' });
addItem('gem_ruby', 'Ruby', '♦️', 165, { tags: ['gem'], rarity: 'rare' });
addItem('gem_emerald', 'Emerald', '🟢', 190, { tags: ['gem'], rarity: 'rare' });

addItem('bar_bronze', 'Bronze Bar', '🟧', 11, { tags: ['bar'] });
addItem('bar_iron', 'Iron Bar', '⬛', 28, { tags: ['bar'] });
addItem('bar_steel', 'Steel Bar', '🔩', 70, { tags: ['bar'] });
addItem('bar_silver', 'Silver Bar', '⬜', 82, { tags: ['bar', 'precious'] });
addItem('bar_gold', 'Gold Bar', '🟨', 150, { tags: ['bar', 'precious'] });
addItem('bar_obsidian', 'Obsidian Plate', '◼️', 250, { tags: ['bar', 'volcanic'], rarity: 'rare' });
addItem('bar_emberite', 'Emberite Ingot', '🧱', 660, { tags: ['bar', 'volcanic'], rarity: 'epic' });
addItem('plank_normal', 'Pine Plank', '🟫', 8, { tags: ['plank', 'construction'] });
addItem('plank_oak', 'Oak Plank', '🟫', 22, { tags: ['plank', 'construction'] });
addItem('plank_willow', 'Willow Plank', '🟫', 45, { tags: ['plank', 'construction'] });
addItem('plank_ironwood', 'Ironwood Plank', '🟫', 280, { tags: ['plank', 'construction', 'rare'], rarity: 'rare' });

// Food, plants, and creature products.
addItem('fish_shrimp_raw', 'Raw Shrimp', '🦐', 2, { tags: ['fish', 'raw'] });
addItem('fish_sardine_raw', 'Raw Sardine', '🐟', 5, { tags: ['fish', 'raw'] });
addItem('fish_trout_raw', 'Raw Trout', '🐟', 12, { tags: ['fish', 'raw'] });
addItem('fish_salmon_raw', 'Raw Salmon', '🐟', 24, { tags: ['fish', 'raw'] });
addItem('fish_crystal_carp_raw', 'Raw Crystal Carp', '💠', 80, { tags: ['fish', 'raw', 'magic'], rarity: 'rare' });
addItem('fish_ember_eel_raw', 'Raw Ember Eel', '🔥', 180, { tags: ['fish', 'raw', 'volcanic'], rarity: 'epic' });
addItem('fish_shrimp_cooked', 'Cooked Shrimp', '🍤', 5, { tags: ['food'], heal: 8 });
addItem('fish_sardine_cooked', 'Cooked Sardine', '🍢', 10, { tags: ['food'], heal: 14 });
addItem('fish_trout_cooked', 'Cooked Trout', '🐠', 24, { tags: ['food'], heal: 28 });
addItem('fish_salmon_cooked', 'Cooked Salmon', '🍣', 46, { tags: ['food'], heal: 48 });
addItem('fish_crystal_carp_cooked', 'Glazed Crystal Carp', '💠', 170, { tags: ['food', 'magic'], heal: 90, buff: { sorcery: 6, durationMs: 900000 }, rarity: 'rare' });
addItem('fish_ember_eel_cooked', 'Charred Ember Eel', '🔥', 380, { tags: ['food', 'volcanic'], heal: 150, buff: { fireResist: 18, durationMs: 900000 }, rarity: 'epic' });
addItem('meat_raw', 'Raw Game Meat', '🥩', 14, { tags: ['meat', 'raw'] });
addItem('meat_roasted', 'Roasted Game', '🍖', 36, { tags: ['food'], heal: 38 });
addItem('grain', 'Grain', '🌾', 3, { tags: ['crop'] });
addItem('vegetable', 'Root Vegetables', '🥕', 6, { tags: ['crop'] });
addItem('berry', 'Wild Berries', '🫐', 5, { tags: ['crop', 'forage'] });
addItem('mushroom', 'Cave Mushroom', '🍄', 12, { tags: ['forage', 'herblore'] });
addItem('herb_redleaf', 'Redleaf', '🍁', 16, { tags: ['herb'] });
addItem('herb_moonmint', 'Moonmint', '🌿', 32, { tags: ['herb', 'magic'] });
addItem('herb_ashbloom', 'Ashbloom', '🌺', 95, { tags: ['herb', 'volcanic'], rarity: 'rare' });
addItem('fiber_flax', 'Flax Fiber', '🪡', 7, { tags: ['fiber'] });
addItem('cloth_linen', 'Linen Cloth', '🧻', 24, { tags: ['cloth'] });
addItem('cloth_sail', 'Sailcloth', '⛵', 70, { tags: ['cloth', 'ship'] });
addItem('hide_small', 'Small Hide', '🟫', 12, { tags: ['hide'] });
addItem('hide_tough', 'Tough Hide', '🟫', 42, { tags: ['hide'], rarity: 'uncommon' });
addItem('leather', 'Leather', '🟤', 28, { tags: ['leather'] });
addItem('bones', 'Bones', '🦴', 7, { tags: ['bone', 'faith'] });
addItem('venom_gland', 'Venom Gland', '🧪', 65, { tags: ['venom', 'herblore'], rarity: 'uncommon' });
addItem('corrupted_heart', 'Corrupted Heart', '🫀', 240, { tags: ['corruption', 'quest'], rarity: 'epic' });

// Seeds and farm inputs.
addItem('seed_grain', 'Grain Seeds', '🌱', 4, { tags: ['seed'] });
addItem('seed_vegetable', 'Vegetable Seeds', '🌱', 8, { tags: ['seed'] });
addItem('seed_redleaf', 'Redleaf Seeds', '🌱', 20, { tags: ['seed'] });
addItem('seed_moonmint', 'Moonmint Seeds', '🌱', 44, { tags: ['seed'], rarity: 'uncommon' });
addItem('seed_ashbloom', 'Ashbloom Seeds', '🌱', 130, { tags: ['seed'], rarity: 'rare' });
addItem('compost', 'Compost', '🪴', 10, { tags: ['farming'] });

// Runes, potions, and crafted utility items.
addItem('rune_blank', 'Blank Rune', '🔹', 25, { tags: ['rune'] });
addItem('rune_fire', 'Fire Rune', '🔥', 36, { tags: ['rune', 'ammo'] });
addItem('rune_frost', 'Frost Rune', '❄️', 42, { tags: ['rune', 'ammo'] });
addItem('rune_light', 'Radiant Rune', '☀️', 55, { tags: ['rune', 'ammo'] });
addItem('rune_way', 'Waystone Rune', '🌀', 180, { tags: ['rune', 'travel'], rarity: 'rare' });
addItem('potion_healing', 'Healing Potion', '🧪', 45, { tags: ['potion'], heal: 65 });
addItem('potion_antidote', 'Antidote', '🧪', 42, { tags: ['potion'], cleanse: ['poison'] });
addItem('potion_focus', 'Focus Tonic', '🧪', 70, { tags: ['potion'], buff: { accuracy: 8, durationMs: 600000 } });
addItem('potion_emberward', 'Emberward Draught', '🧪', 160, { tags: ['potion', 'volcanic'], buff: { fireResist: 30, durationMs: 900000 }, rarity: 'rare' });
addItem('oil_sharpening', 'Sharpening Oil', '🧴', 85, { tags: ['consumable'], buff: { physicalDamage: 8, durationMs: 600000 } });
addItem('arrow_bronze', 'Bronze Arrows', '🏹', 1, { tags: ['ammo'] });
addItem('arrow_steel', 'Steel Arrows', '🏹', 4, { tags: ['ammo'] });
addItem('trap_simple', 'Simple Trap', '🪤', 20, { tags: ['hunting', 'tool'] });
addItem('trap_reinforced', 'Reinforced Trap', '🪤', 85, { tags: ['hunting', 'tool'] });
addItem('artifact_shard', 'Artifact Fragment', '🏺', 60, { tags: ['artifact'], rarity: 'uncommon' });
addItem('artifact_crown_seal', 'Crown Seal Fragment', '♛', 340, { tags: ['artifact', 'museum'], rarity: 'epic' });
addItem('ancient_gear', 'Ancient Gear', '⚙️', 220, { tags: ['artifact', 'engineering'], rarity: 'rare' });
addItem('heartglass_core', 'Heartglass Core', '💎', 1200, { tags: ['quest', 'crystal'], rarity: 'legendary' });
addItem('ship_timber', 'Ship Timber', '🪵', 90, { tags: ['ship', 'construction'] });
addItem('ship_fittings', 'Ship Fittings', '⚓', 150, { tags: ['ship', 'smithing'] });
addItem('cargo_spices', 'Imported Spices', '🧂', 135, { tags: ['trade', 'cargo'] });
addItem('cargo_wine', 'Riverside Vintage', '🍷', 105, { tags: ['trade', 'cargo'] });
addItem('sentinel_mark', 'Sentinel Mark', '🎖️', 0, { tags: ['currency'], currency: true });
addItem('captain_token', 'Captain’s Token', '⚓', 0, { tags: ['currency'], currency: true });
addItem('ancient_fragment', 'Ancient Fragment', '🔸', 0, { tags: ['currency'], currency: true, rarity: 'rare' });

// Tools and equipment.
addItem('axe_bronze', 'Bronze Axe', '🪓', 35, { stackable: false, equipSlot: 'tool', tags: ['tool', 'woodcutting'], stats: { woodcuttingSpeed: 4 } });
addItem('axe_iron', 'Iron Axe', '🪓', 110, { stackable: false, equipSlot: 'tool', tags: ['tool', 'woodcutting'], stats: { woodcuttingSpeed: 9 } });
addItem('pick_bronze', 'Bronze Pickaxe', '⛏️', 35, { stackable: false, equipSlot: 'tool', tags: ['tool', 'mining'], stats: { miningSpeed: 4 } });
addItem('pick_iron', 'Iron Pickaxe', '⛏️', 110, { stackable: false, equipSlot: 'tool', tags: ['tool', 'mining'], stats: { miningSpeed: 9 } });
addItem('rod_river', 'River Rod', '🎣', 55, { stackable: false, equipSlot: 'tool', tags: ['tool', 'fishing'], stats: { fishingSpeed: 6 } });
addItem('hammer_smith', 'Smith’s Hammer', '🔨', 70, { stackable: false, equipSlot: 'tool', tags: ['tool', 'smithing'], stats: { smithingPreserve: 4 } });
addItem('sword_bronze', 'Bronze Sword', '🗡️', 75, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'melee'], stats: { accuracy: 6, physicalDamage: 5, attackSpeed: 2 }, damageType: 'slash' });
addItem('sword_iron', 'Iron Longsword', '⚔️', 210, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'melee'], stats: { accuracy: 13, physicalDamage: 12 }, damageType: 'slash' });
addItem('axe_steel_battle', 'Steel Battleaxe', '🪓', 520, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'melee', 'heavy'], stats: { accuracy: 10, physicalDamage: 25, attackSpeed: -8, critDamage: 20 }, damageType: 'slash', rarity: 'uncommon' });
addItem('shield_bronze', 'Bronze Shield', '🛡️', 80, { stackable: false, equipSlot: 'offHand', tags: ['armor', 'shield'], stats: { armor: 7, block: 6 } });
addItem('shield_iron', 'Iron Shield', '🛡️', 230, { stackable: false, equipSlot: 'offHand', tags: ['armor', 'shield'], stats: { armor: 15, block: 12 } });
addItem('bow_oak', 'Oak Shortbow', '🏹', 150, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'ranged'], stats: { rangedAccuracy: 12, rangedDamage: 10, attackSpeed: 6 }, damageType: 'pierce' });
addItem('bow_yew', 'Yew Longbow', '🏹', 680, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'ranged'], stats: { rangedAccuracy: 24, rangedDamage: 26, attackSpeed: -2, critChance: 5 }, damageType: 'pierce', rarity: 'rare' });
addItem('staff_crystal', 'Crystal Channeling Staff', '🪄', 850, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'sorcery'], stats: { sorceryAccuracy: 26, magicDamage: 28, mana: 40 }, damageType: 'arcane', rarity: 'rare' });
addItem('holy_symbol', 'Sunlit Holy Symbol', '☀️', 410, { stackable: false, equipSlot: 'offHand', tags: ['weapon', 'faith'], stats: { faithPower: 20, healingPower: 16, radiantResist: 10 }, damageType: 'radiant', rarity: 'uncommon' });
addItem('helm_iron', 'Iron Helm', '🪖', 180, { stackable: false, equipSlot: 'head', tags: ['armor'], stats: { armor: 12, health: 15 } });
addItem('chest_iron', 'Iron Cuirass', '🥋', 310, { stackable: false, equipSlot: 'chest', tags: ['armor'], stats: { armor: 22, health: 25 } });
addItem('legs_iron', 'Iron Greaves', '🦿', 260, { stackable: false, equipSlot: 'legs', tags: ['armor'], stats: { armor: 17, health: 20 } });
addItem('gloves_leather', 'Leather Gloves', '🧤', 95, { stackable: false, equipSlot: 'gloves', tags: ['armor'], stats: { evasion: 4, craftingSpeed: 3 } });
addItem('boots_traveler', 'Traveler’s Boots', '🥾', 130, { stackable: false, equipSlot: 'boots', tags: ['armor', 'travel'], stats: { evasion: 5, travelSpeed: 8 } });
addItem('cape_warden', 'Warden’s Cape', '🧥', 620, { stackable: false, equipSlot: 'cape', tags: ['armor', 'hunting'], stats: { rangedDamage: 8, poisonResist: 15, huntingSpeed: 8 }, rarity: 'rare' });
addItem('amulet_crystal', 'Heartglass Amulet', '📿', 920, { stackable: false, equipSlot: 'amulet', tags: ['jewelry', 'magic'], stats: { magicDamage: 12, allResist: 6, rareFind: 3 }, rarity: 'epic' });
addItem('ring_prospector', 'Prospector’s Ring', '💍', 540, { stackable: false, equipSlot: 'ring', tags: ['jewelry', 'mining'], stats: { miningSpeed: 8, rareFind: 4 }, rarity: 'rare' });
addItem('relic_compass', 'Ancient Surveyor’s Compass', '🧭', 0, { stackable: false, equipSlot: 'relic', tags: ['relic', 'cartography'], stats: { travelSpeed: 12, discoveryChance: 12 }, rarity: 'legendary' });
addItem('armor_emberward', 'Emberward Plate', '🛡️', 2200, { stackable: false, equipSlot: 'chest', tags: ['armor', 'volcanic'], stats: { armor: 48, health: 70, fireResist: 42 }, rarity: 'epic' });
addItem('blade_ember', 'Ember Crown Blade', '🔥', 3600, { stackable: false, equipSlot: 'mainHand', tags: ['weapon', 'melee', 'volcanic'], stats: { accuracy: 38, physicalDamage: 44, fireDamage: 34, critChance: 7 }, damageType: 'fire', rarity: 'legendary' });

const actions = {};
function addAction(id, action) {
  actions[id] = { id, durationMs: 3000, xp: 10, level: 1, outputs: {}, inputs: {}, rare: [], masteryWeight: 1, ...action };
}

// Gathering.
addAction('wc_normal', { skill: 'woodcutting', name: 'Cut Normal Trees', icon: '🌳', regions: ['stonehaven', 'pineglade', 'riverside'], durationMs: 2600, xp: 22, outputs: { logs_normal: 1 }, rare: [{ item: 'bird_nest', chance: 0.008 }, { item: 'bark', chance: 0.05 }] });
addAction('wc_oak', { skill: 'woodcutting', name: 'Cut Oak Trees', icon: '🌲', regions: ['pineglade'], level: 12, durationMs: 3400, xp: 38, outputs: { logs_oak: 1 }, rare: [{ item: 'resin', chance: 0.035 }, { item: 'bird_nest', chance: 0.012 }] });
addAction('wc_willow', { skill: 'woodcutting', name: 'Cut Willow Trees', icon: '🌿', regions: ['willow_grove', 'riverside'], level: 24, durationMs: 3900, xp: 62, outputs: { logs_willow: 1 }, rare: [{ item: 'herb_moonmint', chance: 0.012 }, { item: 'resin', chance: 0.08 }] });
addAction('wc_maple', { skill: 'woodcutting', name: 'Cut Maple Trees', icon: '🍁', regions: ['pineglade', 'the_wilds'], level: 38, durationMs: 4700, xp: 95, outputs: { logs_maple: 1 }, rare: [{ item: 'bird_nest', chance: 0.02 }] });
addAction('wc_yew', { skill: 'woodcutting', name: 'Cut Yew Trees', icon: '🌲', regions: ['the_wilds'], level: 55, durationMs: 5900, xp: 155, outputs: { logs_yew: 1 }, rare: [{ item: 'logs_ironwood', chance: 0.015 }] });
addAction('wc_ironwood', { skill: 'woodcutting', name: 'Harvest Ironwood', icon: '🌳', regions: ['the_wilds'], level: 72, durationMs: 7600, xp: 260, outputs: { logs_ironwood: 1 }, rare: [{ item: 'corrupted_heart', chance: 0.003 }], danger: 4 });
addAction('wc_emberwood', { skill: 'woodcutting', name: 'Harvest Emberwood', icon: '🔥', regions: ['mount_ember'], level: 88, durationMs: 9200, xp: 430, outputs: { logs_emberwood: 1 }, rare: [{ item: 'ore_emberite', chance: 0.01 }], danger: 8 });

addAction('mine_stone', { skill: 'mining', name: 'Quarry Stone', icon: '🪨', regions: ['stonehaven', 'highpass_quarry'], durationMs: 2300, xp: 18, outputs: { stone: 1 } });
addAction('mine_copper', { skill: 'mining', name: 'Mine Copper', icon: '🟤', regions: ['stonehaven'], durationMs: 2700, xp: 24, outputs: { ore_copper: 1 }, rare: [{ item: 'gem_sapphire', chance: 0.002 }] });
addAction('mine_tin', { skill: 'mining', name: 'Mine Tin', icon: '⚪', regions: ['stonehaven'], durationMs: 2700, xp: 24, outputs: { ore_tin: 1 } });
addAction('mine_coal', { skill: 'mining', name: 'Mine Coal', icon: '⚫', regions: ['coal_pit', 'dwarven_mine'], level: 12, durationMs: 3300, xp: 44, outputs: { ore_coal: 1 }, rare: [{ item: 'sulfur', chance: 0.06 }] });
addAction('mine_iron', { skill: 'mining', name: 'Mine Iron', icon: '🔘', regions: ['highpass_quarry', 'dwarven_mine'], level: 18, durationMs: 3900, xp: 58, outputs: { ore_iron: 1 }, rare: [{ item: 'gem_sapphire', chance: 0.005 }] });
addAction('mine_silver', { skill: 'mining', name: 'Mine Silver', icon: '◻️', regions: ['highpass_quarry', 'dwarven_mine'], level: 36, durationMs: 5200, xp: 105, outputs: { ore_silver: 1 }, rare: [{ item: 'gem_emerald', chance: 0.003 }] });
addAction('mine_crystal', { skill: 'mining', name: 'Extract Heartglass', icon: '💎', regions: ['dwarven_mine', 'crystal_lake'], level: 55, durationMs: 6900, xp: 195, outputs: { ore_crystal: 1 }, rare: [{ item: 'ancient_fragment', chance: 0.02 }], danger: 4 });
addAction('mine_obsidian', { skill: 'mining', name: 'Cut Obsidian', icon: '🖤', regions: ['obsidian_quarry'], level: 68, durationMs: 7800, xp: 280, outputs: { ore_obsidian: 1 }, rare: [{ item: 'gem_ruby', chance: 0.012 }], danger: 7 });
addAction('mine_emberite', { skill: 'mining', name: 'Mine Emberite', icon: '🔶', regions: ['mount_ember'], level: 86, durationMs: 9800, xp: 470, outputs: { ore_emberite: 1 }, rare: [{ item: 'heartglass_core', chance: 0.0005 }], danger: 9 });

addAction('fish_shrimp', { skill: 'fishing', name: 'Net Shrimp', icon: '🦐', regions: ['riverside', 'coastal_fishing'], durationMs: 2200, xp: 16, outputs: { fish_shrimp_raw: 1 } });
addAction('fish_sardine', { skill: 'fishing', name: 'Bait Sardine', icon: '🐟', regions: ['riverside', 'coastal_fishing'], level: 7, durationMs: 2800, xp: 27, outputs: { fish_sardine_raw: 1 } });
addAction('fish_trout', { skill: 'fishing', name: 'Lure Trout', icon: '🐠', regions: ['riverside', 'crystal_lake'], level: 18, durationMs: 3500, xp: 55, outputs: { fish_trout_raw: 1 } });
addAction('fish_salmon', { skill: 'fishing', name: 'Lure Salmon', icon: '🐟', regions: ['crystal_lake', 'coastal_fishing'], level: 32, durationMs: 4300, xp: 90, outputs: { fish_salmon_raw: 1 } });
addAction('fish_crystal_carp', { skill: 'fishing', name: 'Angle for Crystal Carp', icon: '💠', regions: ['crystal_lake'], level: 56, durationMs: 6500, xp: 185, outputs: { fish_crystal_carp_raw: 1 }, rare: [{ item: 'ore_crystal', chance: 0.03 }] });
addAction('fish_ember_eel', { skill: 'fishing', name: 'Harpoon Ember Eels', icon: '🔥', regions: ['mount_ember'], level: 82, durationMs: 8800, xp: 390, outputs: { fish_ember_eel_raw: 1 }, danger: 8 });

addAction('forage_berries', { skill: 'foraging', name: 'Gather Wild Berries', icon: '🫐', regions: ['pineglade', 'riverside', 'willow_grove'], durationMs: 2100, xp: 18, outputs: { berry: 1 }, rare: [{ item: 'seed_redleaf', chance: 0.04 }] });
addAction('forage_redleaf', { skill: 'foraging', name: 'Gather Redleaf', icon: '🍁', regions: ['willow_grove', 'pineglade'], level: 10, durationMs: 3200, xp: 38, outputs: { herb_redleaf: 1 }, rare: [{ item: 'seed_redleaf', chance: 0.08 }] });
addAction('forage_moonmint', { skill: 'foraging', name: 'Gather Moonmint', icon: '🌿', regions: ['willow_grove', 'crystal_lake'], level: 32, durationMs: 4700, xp: 88, outputs: { herb_moonmint: 1 }, rare: [{ item: 'seed_moonmint', chance: 0.06 }] });
addAction('forage_mushroom', { skill: 'foraging', name: 'Search Cave Mushrooms', icon: '🍄', regions: ['dwarven_mine', 'cave_mouth'], level: 22, durationMs: 4100, xp: 66, outputs: { mushroom: 1 }, rare: [{ item: 'ancient_gear', chance: 0.003 }] });
addAction('forage_ashbloom', { skill: 'foraging', name: 'Gather Ashbloom', icon: '🌺', regions: ['obsidian_quarry', 'mount_ember'], level: 65, durationMs: 7200, xp: 230, outputs: { herb_ashbloom: 1 }, rare: [{ item: 'seed_ashbloom', chance: 0.045 }], danger: 7 });

addAction('hunt_rabbits', { skill: 'hunting', name: 'Set Rabbit Traps', icon: '🐇', regions: ['pineglade', 'riverside'], durationMs: 4200, xp: 34, inputs: { trap_simple: 1 }, outputs: { meat_raw: 1, hide_small: 1 }, preserveInputs: ['trap_simple'] });
addAction('hunt_boar', { skill: 'hunting', name: 'Track Wild Boar', icon: '🐗', regions: ['pineglade', 'the_wilds'], level: 20, durationMs: 5600, xp: 75, outputs: { meat_raw: 2, hide_tough: 1 }, rare: [{ item: 'bones', chance: 0.7 }], danger: 2 });
addAction('hunt_venomspider', { skill: 'hunting', name: 'Trap Venom Spiders', icon: '🕷️', regions: ['the_wilds', 'cave_mouth'], level: 42, durationMs: 6800, xp: 140, inputs: { trap_reinforced: 1 }, outputs: { venom_gland: 1 }, preserveInputs: ['trap_reinforced'], danger: 5 });
addAction('hunt_corrupted_stag', { skill: 'hunting', name: 'Track Corrupted Stag', icon: '🦌', regions: ['the_wilds'], level: 70, durationMs: 9500, xp: 320, outputs: { hide_tough: 2, corrupted_heart: 1 }, danger: 8 });

addAction('arch_surface', { skill: 'archaeology', name: 'Survey Surface Ruins', icon: '🏺', regions: ['willowbrook', 'stonehaven'], durationMs: 4300, xp: 38, outputs: { artifact_shard: 1 }, rare: [{ item: 'ancient_fragment', chance: 0.018 }] });
addAction('arch_dwarven', { skill: 'archaeology', name: 'Excavate Dwarven Gallery', icon: '⚙️', regions: ['dwarven_mine'], level: 28, durationMs: 6500, xp: 105, outputs: { artifact_shard: 1 }, rare: [{ item: 'ancient_gear', chance: 0.12 }, { item: 'artifact_crown_seal', chance: 0.008 }] });
addAction('arch_lake', { skill: 'archaeology', name: 'Dive Crystal Ruins', icon: '💎', regions: ['crystal_lake'], level: 50, durationMs: 8400, xp: 210, outputs: { artifact_shard: 2 }, rare: [{ item: 'ore_crystal', chance: 0.08 }, { item: 'heartglass_core', chance: 0.001 }], danger: 4 });
addAction('arch_tidal', { skill: 'archaeology', name: 'Map Tidal Chambers', icon: '🕳️', regions: ['cave_mouth'], level: 66, durationMs: 9800, xp: 310, outputs: { artifact_shard: 2 }, rare: [{ item: 'relic_compass', chance: 0.0008 }], danger: 5 });

// Production.
addAction('cook_shrimp', { skill: 'cooking', name: 'Cook Shrimp', icon: '🍤', regions: ['stonehaven', 'riverside', 'willowbrook', 'waveport'], durationMs: 1900, xp: 20, inputs: { fish_shrimp_raw: 1 }, outputs: { fish_shrimp_cooked: 1 } });
addAction('cook_sardine', { skill: 'cooking', name: 'Cook Sardine', icon: '🍢', regions: ['riverside', 'willowbrook', 'waveport'], level: 6, durationMs: 2100, xp: 28, inputs: { fish_sardine_raw: 1 }, outputs: { fish_sardine_cooked: 1 } });
addAction('cook_trout', { skill: 'cooking', name: 'Cook Trout', icon: '🐠', regions: ['riverside', 'willowbrook', 'waveport'], level: 18, durationMs: 2500, xp: 52, inputs: { fish_trout_raw: 1 }, outputs: { fish_trout_cooked: 1 } });
addAction('cook_salmon', { skill: 'cooking', name: 'Cook Salmon', icon: '🍣', regions: ['riverside', 'willowbrook', 'waveport'], level: 31, durationMs: 2900, xp: 86, inputs: { fish_salmon_raw: 1 }, outputs: { fish_salmon_cooked: 1 } });
addAction('cook_game', { skill: 'cooking', name: 'Roast Game Meat', icon: '🍖', regions: ['pineglade', 'willowbrook', 'watchpost'], level: 15, durationMs: 2700, xp: 48, inputs: { meat_raw: 1 }, outputs: { meat_roasted: 1 } });
addAction('cook_crystal_carp', { skill: 'cooking', name: 'Glaze Crystal Carp', icon: '💠', regions: ['willowbrook', 'crystal_lake'], level: 55, durationMs: 4100, xp: 190, inputs: { fish_crystal_carp_raw: 1, berry: 2 }, outputs: { fish_crystal_carp_cooked: 1 } });
addAction('cook_ember_eel', { skill: 'cooking', name: 'Char Ember Eel', icon: '🔥', regions: ['watchpost', 'mount_ember'], level: 80, durationMs: 5200, xp: 380, inputs: { fish_ember_eel_raw: 1, herb_ashbloom: 1 }, outputs: { fish_ember_eel_cooked: 1 } });

addAction('smelt_bronze', { skill: 'smithing', name: 'Smelt Bronze Bar', icon: '🟧', regions: ['stonehaven', 'willowbrook'], durationMs: 2200, xp: 22, inputs: { ore_copper: 1, ore_tin: 1 }, outputs: { bar_bronze: 1 } });
addAction('smelt_iron', { skill: 'smithing', name: 'Smelt Iron Bar', icon: '⬛', regions: ['stonehaven', 'dwarven_mine', 'willowbrook'], level: 15, durationMs: 2800, xp: 46, inputs: { ore_iron: 1 }, outputs: { bar_iron: 1 } });
addAction('smelt_steel', { skill: 'smithing', name: 'Smelt Steel Bar', icon: '🔩', regions: ['stonehaven', 'dwarven_mine', 'willowbrook'], level: 30, durationMs: 3600, xp: 82, inputs: { ore_iron: 1, ore_coal: 2 }, outputs: { bar_steel: 1 } });
addAction('smelt_silver', { skill: 'smithing', name: 'Smelt Silver Bar', icon: '⬜', regions: ['stonehaven', 'dwarven_mine'], level: 38, durationMs: 4100, xp: 108, inputs: { ore_silver: 1, ore_coal: 1 }, outputs: { bar_silver: 1 } });
addAction('smelt_obsidian', { skill: 'smithing', name: 'Press Obsidian Plate', icon: '◼️', regions: ['obsidian_quarry'], level: 68, durationMs: 6200, xp: 260, inputs: { ore_obsidian: 2, ore_coal: 2 }, outputs: { bar_obsidian: 1 }, danger: 5 });
addAction('smelt_emberite', { skill: 'smithing', name: 'Smelt Emberite Ingot', icon: '🧱', regions: ['mount_ember'], level: 86, durationMs: 8500, xp: 470, inputs: { ore_emberite: 2, ore_obsidian: 1 }, outputs: { bar_emberite: 1 }, danger: 8 });
addAction('forge_bronze_sword', { skill: 'smithing', name: 'Forge Bronze Sword', icon: '🗡️', regions: ['stonehaven', 'willowbrook'], level: 5, durationMs: 3300, xp: 38, inputs: { bar_bronze: 2 }, outputs: { sword_bronze: 1 } });
addAction('forge_iron_set', { skill: 'smithing', name: 'Forge Iron Cuirass', icon: '🥋', regions: ['stonehaven', 'dwarven_mine', 'willowbrook'], level: 28, durationMs: 4900, xp: 105, inputs: { bar_iron: 4 }, outputs: { chest_iron: 1 } });
addAction('forge_emberward', { skill: 'smithing', name: 'Forge Emberward Plate', icon: '🛡️', regions: ['mount_ember'], level: 90, durationMs: 12000, xp: 720, inputs: { bar_emberite: 3, bar_obsidian: 2, ore_crystal: 1 }, outputs: { armor_emberward: 1 }, danger: 9 });

addAction('saw_pine', { skill: 'construction', name: 'Saw Pine Planks', icon: '🪚', regions: ['pineglade', 'willowbrook'], durationMs: 2400, xp: 22, inputs: { logs_normal: 1 }, outputs: { plank_normal: 1 } });
addAction('saw_oak', { skill: 'construction', name: 'Saw Oak Planks', icon: '🪚', regions: ['pineglade', 'willowbrook'], level: 15, durationMs: 3000, xp: 44, inputs: { logs_oak: 1 }, outputs: { plank_oak: 1 } });
addAction('saw_willow', { skill: 'construction', name: 'Saw Willow Planks', icon: '🪚', regions: ['willow_grove', 'willowbrook'], level: 28, durationMs: 3700, xp: 72, inputs: { logs_willow: 1 }, outputs: { plank_willow: 1 } });
addAction('saw_ironwood', { skill: 'construction', name: 'Saw Ironwood Planks', icon: '🪚', regions: ['willowbrook', 'watchpost'], level: 70, durationMs: 6800, xp: 245, inputs: { logs_ironwood: 1 }, outputs: { plank_ironwood: 1 }, rare: [{ item: 'resin', chance: 0.08 }] });
addAction('make_ship_timber', { skill: 'construction', name: 'Laminate Ship Timber', icon: '🪵', regions: ['waveport', 'harbor_dock'], level: 45, durationMs: 5600, xp: 150, inputs: { plank_oak: 3, resin: 1 }, outputs: { ship_timber: 1 } });

addAction('craft_leather', { skill: 'crafting', name: 'Tan Leather', icon: '🟤', regions: ['pineglade', 'willowbrook'], durationMs: 2600, xp: 26, inputs: { hide_small: 2 }, outputs: { leather: 1 } });
addAction('craft_trap', { skill: 'crafting', name: 'Make Simple Trap', icon: '🪤', regions: ['pineglade', 'willowbrook'], level: 6, durationMs: 2500, xp: 30, inputs: { logs_normal: 1, bar_bronze: 1 }, outputs: { trap_simple: 1 } });
addAction('craft_reinforced_trap', { skill: 'crafting', name: 'Make Reinforced Trap', icon: '🪤', regions: ['pineglade', 'willowbrook'], level: 35, durationMs: 4400, xp: 102, inputs: { plank_oak: 1, bar_steel: 1 }, outputs: { trap_reinforced: 1 } });
addAction('craft_gloves', { skill: 'crafting', name: 'Craft Leather Gloves', icon: '🧤', regions: ['pineglade', 'willowbrook'], level: 20, durationMs: 3800, xp: 70, inputs: { leather: 2 }, outputs: { gloves_leather: 1 } });
addAction('craft_ring', { skill: 'crafting', name: 'Set Prospector’s Ring', icon: '💍', regions: ['stonehaven', 'willowbrook'], level: 52, durationMs: 6700, xp: 205, inputs: { bar_gold: 1, gem_sapphire: 1 }, outputs: { ring_prospector: 1 } });

addAction('fletch_arrows_bronze', { skill: 'fletching', name: 'Fletch Bronze Arrows', icon: '🏹', regions: ['pineglade', 'willowbrook'], durationMs: 2300, xp: 24, inputs: { logs_normal: 1, bar_bronze: 1 }, outputs: { arrow_bronze: 30 } });
addAction('fletch_oak_bow', { skill: 'fletching', name: 'String Oak Shortbow', icon: '🏹', regions: ['pineglade'], level: 18, durationMs: 3900, xp: 68, inputs: { logs_oak: 2, fiber_flax: 2 }, outputs: { bow_oak: 1 } });
addAction('fletch_steel_arrows', { skill: 'fletching', name: 'Fletch Steel Arrows', icon: '🏹', regions: ['pineglade', 'willowbrook'], level: 35, durationMs: 3600, xp: 105, inputs: { logs_oak: 1, bar_steel: 1 }, outputs: { arrow_steel: 30 } });
addAction('fletch_yew_bow', { skill: 'fletching', name: 'Craft Yew Longbow', icon: '🏹', regions: ['pineglade'], level: 62, durationMs: 6800, xp: 235, inputs: { logs_yew: 2, cloth_linen: 1 }, outputs: { bow_yew: 1 } });

addAction('tailor_linen', { skill: 'tailoring', name: 'Weave Linen Cloth', icon: '🧵', regions: ['riverside', 'willowbrook'], durationMs: 2700, xp: 28, inputs: { fiber_flax: 3 }, outputs: { cloth_linen: 1 } });
addAction('tailor_sailcloth', { skill: 'tailoring', name: 'Weave Sailcloth', icon: '⛵', regions: ['riverside', 'waveport'], level: 28, durationMs: 4400, xp: 92, inputs: { fiber_flax: 6, resin: 1 }, outputs: { cloth_sail: 1 } });
addAction('tailor_travel_boots', { skill: 'tailoring', name: 'Sew Traveler’s Boots', icon: '🥾', regions: ['willowbrook', 'waveport'], level: 32, durationMs: 4800, xp: 115, inputs: { leather: 2, cloth_linen: 1 }, outputs: { boots_traveler: 1 } });

addAction('brew_healing', { skill: 'herblore', name: 'Brew Healing Potion', icon: '🧪', regions: ['willow_grove', 'willowbrook'], durationMs: 2500, xp: 28, inputs: { herb_redleaf: 1, berry: 1 }, outputs: { potion_healing: 1 } });
addAction('brew_antidote', { skill: 'herblore', name: 'Brew Antidote', icon: '🧪', regions: ['willow_grove', 'willowbrook'], level: 14, durationMs: 2900, xp: 48, inputs: { herb_redleaf: 1, mushroom: 1 }, outputs: { potion_antidote: 1 } });
addAction('brew_focus', { skill: 'herblore', name: 'Brew Focus Tonic', icon: '🧪', regions: ['willow_grove'], level: 35, durationMs: 4100, xp: 110, inputs: { herb_moonmint: 2, ore_crystal: 1 }, outputs: { potion_focus: 1 } });
addAction('brew_emberward', { skill: 'herblore', name: 'Brew Emberward Draught', icon: '🧪', regions: ['willow_grove', 'watchpost'], level: 65, durationMs: 5900, xp: 250, inputs: { herb_ashbloom: 1, ore_obsidian: 1, mushroom: 1 }, outputs: { potion_emberward: 1 } });

addAction('rune_blank', { skill: 'runecrafting', name: 'Shape Blank Runes', icon: '🔹', regions: ['crystal_lake', 'willowbrook'], durationMs: 3300, xp: 42, inputs: { ore_crystal: 1 }, outputs: { rune_blank: 3 } });
addAction('rune_fire', { skill: 'runecrafting', name: 'Charge Fire Runes', icon: '🔥', regions: ['obsidian_quarry', 'mount_ember'], level: 28, durationMs: 3900, xp: 86, inputs: { rune_blank: 1, sulfur: 1 }, outputs: { rune_fire: 4 } });
addAction('rune_frost', { skill: 'runecrafting', name: 'Charge Frost Runes', icon: '❄️', regions: ['crystal_lake'], level: 34, durationMs: 4200, xp: 102, inputs: { rune_blank: 1, fish_crystal_carp_raw: 1 }, outputs: { rune_frost: 4 } });
addAction('rune_way', { skill: 'runecrafting', name: 'Inscribe Waystone Rune', icon: '🌀', regions: ['crystal_lake'], level: 72, durationMs: 8200, xp: 340, inputs: { rune_blank: 3, ore_crystal: 2, ancient_fragment: 1 }, outputs: { rune_way: 1 } });

addAction('enchant_sharpen', { skill: 'enchanting', name: 'Distill Sharpening Oil', icon: '🧴', regions: ['willowbrook'], durationMs: 3600, xp: 66, inputs: { resin: 1, bar_silver: 1 }, outputs: { oil_sharpening: 1 } });
addAction('enchant_amulet', { skill: 'enchanting', name: 'Enchant Heartglass Amulet', icon: '📿', regions: ['crystal_lake', 'willowbrook'], level: 58, durationMs: 8500, xp: 280, inputs: { bar_gold: 1, ore_crystal: 3, gem_emerald: 1 }, outputs: { amulet_crystal: 1 } });
addAction('enchant_staff', { skill: 'enchanting', name: 'Bind Crystal Staff', icon: '🪄', regions: ['crystal_lake'], level: 65, durationMs: 9200, xp: 325, inputs: { logs_yew: 1, ore_crystal: 4, rune_blank: 2 }, outputs: { staff_crystal: 1 } });

// Utility and advanced fieldwork.
addAction('agility_stone_steps', { skill: 'agility', name: 'Run Stonehaven Steps', icon: '🥾', regions: ['stonehaven'], durationMs: 3200, xp: 34, outputs: {}, activePrompt: 'stride' });
addAction('agility_forest_course', { skill: 'agility', name: 'Pineglade Canopy Course', icon: '🌲', regions: ['pineglade'], level: 25, durationMs: 4900, xp: 95, outputs: {}, activePrompt: 'balance' });
addAction('agility_wilds_route', { skill: 'agility', name: 'Cross the Wilds Ravine', icon: '🌉', regions: ['the_wilds'], level: 62, durationMs: 7800, xp: 260, outputs: {}, danger: 7, activePrompt: 'leap' });

addAction('thieve_stalls', { skill: 'thieving', name: 'Lift Market Purses', icon: '🪙', regions: ['willowbrook', 'waveport'], durationMs: 3600, xp: 38, coins: [3, 10], failureChance: 0.08 });
addAction('thieve_warehouse', { skill: 'thieving', name: 'Infiltrate Cargo Warehouse', icon: '📦', regions: ['waveport', 'harbor_dock'], level: 32, durationMs: 6200, xp: 125, outputs: { cargo_spices: 1 }, failureChance: 0.18, danger: 3 });
addAction('thieve_covenant', { skill: 'thieving', name: 'Steal Covenant Correspondence', icon: '📜', regions: ['watchpost', 'the_wilds'], level: 65, durationMs: 9200, xp: 310, outputs: { ancient_fragment: 1 }, failureChance: 0.28, danger: 7 });

addAction('merchant_appraise', { skill: 'mercantile', name: 'Appraise Market Lots', icon: '⚖️', regions: ['willowbrook', 'stonehaven', 'waveport'], durationMs: 4200, xp: 45, coins: [8, 20] });
addAction('merchant_broker', { skill: 'mercantile', name: 'Broker Regional Cargo', icon: '📦', regions: ['willowbrook', 'waveport'], level: 35, durationMs: 7200, xp: 150, inputs: { cargo_spices: 1 }, coins: [190, 260] });

addAction('engineer_fittings', { skill: 'engineering', name: 'Forge Ship Fittings', icon: '⚓', regions: ['stonehaven', 'harbor_dock'], level: 20, durationMs: 5200, xp: 95, inputs: { bar_steel: 2, plank_oak: 1 }, outputs: { ship_fittings: 1 } });
addAction('engineer_restore_gear', { skill: 'engineering', name: 'Restore Ancient Machinery', icon: '⚙️', regions: ['dwarven_mine'], level: 48, durationMs: 8500, xp: 245, inputs: { ancient_gear: 1, bar_steel: 2 }, outputs: { ancient_fragment: 1 }, rare: [{ item: 'relic_compass', chance: 0.0015 }] });

addAction('cartography_local', { skill: 'cartography', name: 'Survey Local Roads', icon: '🗺️', regions: Object.keys(regions), durationMs: 4600, xp: 55, outputs: {}, discoveryChance: 0.08 });
addAction('cartography_ruins', { skill: 'cartography', name: 'Map Hidden Ruins', icon: '🧭', regions: ['dwarven_mine', 'crystal_lake', 'cave_mouth', 'the_wilds'], level: 38, durationMs: 7800, xp: 170, outputs: { artifact_shard: 1 }, discoveryChance: 0.22, danger: 4 });

addAction('summon_wisp', { skill: 'summoning', name: 'Bind Forager Wisp', icon: '✨', regions: ['willow_grove'], level: 20, durationMs: 6500, xp: 110, inputs: { rune_blank: 1, herb_moonmint: 1 }, outputs: {}, familiar: 'forager_wisp' });
addAction('summon_emberling', { skill: 'summoning', name: 'Bind Emberling', icon: '🔥', regions: ['mount_ember'], level: 70, durationMs: 11000, xp: 360, inputs: { rune_fire: 10, bar_emberite: 1 }, outputs: {}, familiar: 'emberling', danger: 8 });

const abilities = {
  power_strike: { name: 'Power Strike', icon: '💥', style: 'melee', cooldownMs: 7000, staminaCost: 20, description: 'A heavy hit with increased damage and armor penetration.' },
  guard: { name: 'Guard', icon: '🛡️', style: 'any', cooldownMs: 10000, staminaCost: 15, description: 'Gain a large block bonus against the next enemy attack.' },
  interrupt: { name: 'Interrupt', icon: '⚡', style: 'any', cooldownMs: 12000, staminaCost: 25, description: 'Cancel a telegraphed enemy special attack.' },
  venom_shot: { name: 'Venom Shot', icon: '🏹', style: 'ranged', cooldownMs: 9000, ammo: 'arrow_steel', description: 'Deals ranged damage and applies poison.' },
  firebolt: { name: 'Firebolt', icon: '🔥', style: 'sorcery', cooldownMs: 6000, ammo: 'rune_fire', description: 'Deals fire damage and applies burn.' },
  frost_ward: { name: 'Frost Ward', icon: '❄️', style: 'sorcery', cooldownMs: 14000, ammo: 'rune_frost', description: 'Grants armor and fire resistance for several turns.' },
  mend: { name: 'Mend', icon: '☀️', style: 'faith', cooldownMs: 10000, ammo: 'rune_light', description: 'Restore health using Faith power.' },
  cleanse: { name: 'Cleanse', icon: '✨', style: 'faith', cooldownMs: 12000, ammo: 'rune_light', description: 'Remove poison, burn, and bleed.' },
};

const enemies = {};
function addEnemy(id, enemy) {
  enemies[id] = {
    id, speedMs: 2600, accuracy: 5, evasion: 2, armor: 0, maxHit: 3, hp: 15, level: 1,
    damageType: 'crush', resistances: {}, coins: [1, 5], xp: 12, drops: [], abilities: [], ...enemy,
  };
}
addEnemy('sewer_rat', { name: 'Sewer Rat', icon: '🐀', region: 'willowbrook', hp: 14, maxHit: 3, xp: 12, drops: [{ item: 'bones', chance: 0.25 }] });
addEnemy('hill_goblin', { name: 'Hill Goblin', icon: '👺', region: 'stonehaven', level: 5, hp: 28, accuracy: 9, evasion: 5, armor: 2, maxHit: 6, coins: [4, 12], xp: 28, drops: [{ item: 'bones', chance: 0.6 }, { item: 'ore_copper', chance: 0.18 }] });
addEnemy('coal_crawler', { name: 'Coal Crawler', icon: '🕷️', region: 'coal_pit', level: 10, hp: 42, accuracy: 13, evasion: 8, armor: 4, maxHit: 8, damageType: 'venom', coins: [6, 18], xp: 45, drops: [{ item: 'venom_gland', chance: 0.16 }, { item: 'sulfur', chance: 0.25 }], abilities: [{ id: 'poison_bite', every: 4, status: 'poison', power: 3 }] });
addEnemy('forest_boar', { name: 'Forest Boar', icon: '🐗', region: 'pineglade', level: 12, hp: 58, accuracy: 15, armor: 6, maxHit: 10, coins: [8, 20], xp: 58, drops: [{ item: 'meat_raw', chance: 1, qty: [1, 2] }, { item: 'hide_tough', chance: 0.45 }] });
addEnemy('river_bandit', { name: 'River Bandit', icon: '🥷', region: 'riverside', level: 18, hp: 72, accuracy: 21, evasion: 12, armor: 8, maxHit: 13, damageType: 'slash', coins: [15, 38], xp: 82, drops: [{ item: 'cargo_wine', chance: 0.08 }, { item: 'sword_bronze', chance: 0.015 }], abilities: [{ id: 'bleeding_cut', every: 5, status: 'bleed', power: 4 }] });
addEnemy('dwarven_skeleton', { name: 'Dwarven Skeleton', icon: '💀', region: 'dwarven_mine', level: 24, hp: 105, accuracy: 27, armor: 15, maxHit: 17, damageType: 'pierce', resistances: { shadow: 20 }, coins: [20, 48], xp: 120, drops: [{ item: 'bones', chance: 1 }, { item: 'ore_silver', chance: 0.12 }, { item: 'ancient_gear', chance: 0.025 }], abilities: [{ id: 'shield_bash', every: 6, status: 'stun', power: 1 }] });
addEnemy('crystal_wisp', { name: 'Crystal Wisp', icon: '✨', region: 'crystal_lake', level: 30, hp: 92, accuracy: 34, evasion: 28, armor: 3, maxHit: 20, damageType: 'arcane', resistances: { arcane: 45, crush: -15 }, coins: [18, 50], xp: 135, drops: [{ item: 'ore_crystal', chance: 0.2 }, { item: 'rune_blank', chance: 0.45, qty: [1, 3] }], abilities: [{ id: 'crystal_burst', every: 5, telegraph: true, multiplier: 1.8 }] });
addEnemy('tidal_smuggler', { name: 'Tidal Smuggler', icon: '🗡️', region: 'cave_mouth', level: 34, hp: 130, accuracy: 38, evasion: 24, armor: 12, maxHit: 23, damageType: 'slash', coins: [35, 80], xp: 165, drops: [{ item: 'cargo_spices', chance: 0.12 }, { item: 'artifact_shard', chance: 0.08 }], abilities: [{ id: 'smoke_bomb', every: 5, status: 'blind', power: 8 }] });
addEnemy('wilds_shambler', { name: 'Wilds Shambler', icon: '🧟', region: 'the_wilds', level: 42, hp: 175, accuracy: 44, armor: 22, maxHit: 28, damageType: 'shadow', resistances: { poison: 100, shadow: 30, radiant: -25 }, coins: [45, 95], xp: 220, drops: [{ item: 'corrupted_heart', chance: 0.08 }, { item: 'logs_ironwood', chance: 0.12 }], abilities: [{ id: 'corrupting_grasp', every: 4, status: 'corruption', power: 5 }] });
addEnemy('venom_matriarch', { name: 'Venom Matriarch', icon: '🕷️', region: 'the_wilds', level: 48, hp: 210, accuracy: 50, evasion: 20, armor: 18, maxHit: 31, damageType: 'venom', resistances: { poison: 100, fire: -15 }, coins: [55, 120], xp: 275, drops: [{ item: 'venom_gland', chance: 0.8, qty: [1, 3] }, { item: 'cape_warden', chance: 0.006 }], abilities: [{ id: 'venom_surge', every: 4, telegraph: true, status: 'poison', power: 8 }] });
addEnemy('sentinel_deserter', { name: 'Sentinel Deserter', icon: '🗡️', region: 'watchpost', level: 45, hp: 225, accuracy: 51, evasion: 22, armor: 30, maxHit: 29, damageType: 'slash', coins: [60, 130], xp: 285, drops: [{ item: 'bar_steel', chance: 0.18 }, { item: 'sentinel_mark', chance: 0.22 }], abilities: [{ id: 'crushing_blow', every: 6, telegraph: true, multiplier: 2.1 }] });
addEnemy('obsidian_golem', { name: 'Obsidian Golem', icon: '🗿', region: 'obsidian_quarry', level: 58, hp: 340, accuracy: 56, evasion: 6, armor: 55, maxHit: 39, damageType: 'crush', resistances: { slash: 40, fire: 60, crush: -20 }, coins: [90, 180], xp: 420, drops: [{ item: 'ore_obsidian', chance: 0.7, qty: [1, 2] }, { item: 'gem_ruby', chance: 0.06 }], abilities: [{ id: 'earthquake', every: 5, telegraph: true, multiplier: 2.3 }] });
addEnemy('ash_drake', { name: 'Ash Drake', icon: '🐉', region: 'mount_ember', level: 67, hp: 460, accuracy: 70, evasion: 30, armor: 38, maxHit: 48, damageType: 'fire', resistances: { fire: 80, frost: -35 }, coins: [130, 260], xp: 620, drops: [{ item: 'ore_emberite', chance: 0.28 }, { item: 'herb_ashbloom', chance: 0.2 }], abilities: [{ id: 'flame_breath', every: 4, telegraph: true, multiplier: 2.2, status: 'burn', power: 8 }] });
addEnemy('ember_cultist', { name: 'Ember Cultist', icon: '🧙', region: 'mount_ember', level: 72, hp: 390, accuracy: 78, evasion: 36, armor: 26, maxHit: 52, damageType: 'fire', resistances: { fire: 55, radiant: -20 }, coins: [150, 300], xp: 680, drops: [{ item: 'rune_fire', chance: 0.75, qty: [3, 12] }, { item: 'ancient_fragment', chance: 0.09 }], abilities: [{ id: 'ember_ward', every: 5, buffArmor: 30 }, { id: 'eruption', every: 7, telegraph: true, multiplier: 2.6 }] });
addEnemy('heartglass_abomination', { name: 'Heartglass Abomination', icon: '👹', region: 'crystal_lake', level: 78, hp: 820, accuracy: 88, evasion: 34, armor: 45, maxHit: 63, damageType: 'arcane', resistances: { arcane: 55, radiant: -20, crush: -10 }, coins: [300, 600], xp: 1400, boss: true, drops: [{ item: 'heartglass_core', chance: 0.22 }, { item: 'amulet_crystal', chance: 0.025 }], abilities: [{ id: 'fracture', every: 4, status: 'bleed', power: 10 }, { id: 'prismatic_nova', every: 6, telegraph: true, multiplier: 2.8 }] });
addEnemy('ember_crowned_dragon', { name: 'Ember-Crowned Dragon', icon: '🐲', region: 'mount_ember', level: 95, hp: 1800, accuracy: 112, evasion: 46, armor: 72, maxHit: 88, damageType: 'fire', resistances: { fire: 90, frost: -30, radiant: -10 }, coins: [900, 1600], xp: 3800, boss: true, drops: [{ item: 'blade_ember', chance: 0.02 }, { item: 'heartglass_core', chance: 0.45 }, { item: 'bar_emberite', chance: 0.7, qty: [1, 3] }], abilities: [{ id: 'wing_buffet', every: 3, status: 'stun', power: 1 }, { id: 'crown_eruption', every: 5, telegraph: true, multiplier: 3.4, status: 'burn', power: 12 }] });

const crops = {
  grain: { name: 'Grain', icon: '🌾', seed: 'seed_grain', level: 1, growMs: 120000, yield: { grain: [5, 9] }, xp: 45 },
  vegetable: { name: 'Root Vegetables', icon: '🥕', seed: 'seed_vegetable', level: 8, growMs: 240000, yield: { vegetable: [4, 7] }, xp: 90 },
  redleaf: { name: 'Redleaf', icon: '🍁', seed: 'seed_redleaf', level: 18, growMs: 420000, yield: { herb_redleaf: [3, 6] }, xp: 165 },
  flax: { name: 'Flax', icon: '🪡', seed: 'seed_grain', level: 22, growMs: 480000, yield: { fiber_flax: [5, 10] }, xp: 190 },
  moonmint: { name: 'Moonmint', icon: '🌿', seed: 'seed_moonmint', level: 38, growMs: 720000, yield: { herb_moonmint: [3, 5] }, xp: 330 },
  ashbloom: { name: 'Ashbloom', icon: '🌺', seed: 'seed_ashbloom', level: 68, growMs: 1200000, yield: { herb_ashbloom: [2, 4] }, xp: 720 },
};

const buildings = {
  house: { name: 'Adventurer’s House', icon: '🏠', maxLevel: 5, baseCost: { coins: 150, plank_normal: 10, stone: 8 }, description: 'Unlocks rooms, loadouts, storage, and resting bonuses.', effects: { bankSlots: 20 } },
  workshop: { name: 'Workshop', icon: '🔨', maxLevel: 5, baseCost: { coins: 250, plank_oak: 8, bar_bronze: 8 }, description: 'Improves crafting and smithing speed and unlocks salvage.', effects: { productionSpeed: 3 } },
  garden: { name: 'Garden', icon: '🌱', maxLevel: 5, baseCost: { coins: 180, plank_normal: 8, compost: 6 }, description: 'Adds farming plots and improves crop yield.', effects: { farmPlots: 1, farmYield: 4 } },
  library: { name: 'Library', icon: '📚', maxLevel: 5, baseCost: { coins: 320, plank_oak: 12, artifact_shard: 2 }, description: 'Unlocks research and increases mastery gain.', effects: { masteryGain: 2 } },
  stable: { name: 'Stable', icon: '🐎', maxLevel: 4, baseCost: { coins: 400, plank_oak: 14, grain: 20 }, description: 'Reduces land travel time and improves caravan safety.', effects: { travelSpeed: 5 } },
  cellar: { name: 'Storage Cellar', icon: '🧺', maxLevel: 5, baseCost: { coins: 220, stone: 18, plank_normal: 8 }, description: 'Expands inventory supply capacity and protects food.', effects: { inventorySlots: 3 } },
  alchemy_lab: { name: 'Alchemy Laboratory', icon: '⚗️', maxLevel: 4, baseCost: { coins: 500, bar_silver: 4, plank_willow: 8 }, description: 'Improves potion yield and duration.', effects: { potionYield: 5 } },
  training_yard: { name: 'Training Yard', icon: '⚔️', maxLevel: 5, baseCost: { coins: 480, stone: 20, bar_iron: 10 }, description: 'Improves recovery and unlocks combat automation rules.', effects: { recovery: 4 } },
  portal_chamber: { name: 'Waystone Chamber', icon: '🌀', maxLevel: 3, baseCost: { coins: 1200, ore_crystal: 10, bar_gold: 4 }, description: 'Consumes Waystone Runes for instant travel between attuned settlements.', effects: { fastTravel: 1 } },
  dock: { name: 'Private Dock', icon: '⚓', maxLevel: 4, baseCost: { coins: 900, ship_timber: 8, ship_fittings: 4 }, description: 'Unlocks personal ships, voyages, and expanded cargo.', effects: { cargoSlots: 4 } },
  sawmill: { name: 'Pineglade Sawmill', icon: '🪚', maxLevel: 5, baseCost: { coins: 360, plank_oak: 10, bar_iron: 6 }, description: 'Passively processes stored logs into planks.', effects: { passivePlanksPerHour: 2 } },
};

const companions = {
  mira: { name: 'Mira Greenstep', icon: '🧝', role: 'Forager', region: 'pineglade', cost: 350, description: 'Finds herbs, seeds, and forest discoveries.', bonus: { foraging: 5, farming: 3 } },
  borin: { name: 'Borin Deepforge', icon: '🧔', role: 'Engineer', region: 'dwarven_mine', cost: 800, description: 'Improves Mining, Engineering, and ruin expeditions.', bonus: { mining: 5, engineering: 5 } },
  sera: { name: 'Sera Tideborn', icon: '🧜', role: 'Navigator', region: 'waveport', cost: 900, description: 'Improves Sailing, cargo safety, and coastal discoveries.', bonus: { sailing: 7, cartography: 3 } },
  cassian: { name: 'Cassian Vale', icon: '🛡️', role: 'Sentinel', region: 'watchpost', cost: 1100, description: 'Improves combat expeditions and Watchpost reputation.', bonus: { leadership: 6, slayer: 5 } },
  nyx: { name: 'Nyx Ashveil', icon: '🧙', role: 'Arcanist', region: 'crystal_lake', cost: 1600, description: 'Improves Runecrafting, Sorcery, and Heartglass research.', bonus: { runecrafting: 7, sorcery: 5 } },
};

const expeditions = {
  forest_survey: { name: 'Pineglade Survey', icon: '🌲', durationMs: 300000, recommendedRole: 'Forager', rewards: [{ item: 'herb_redleaf', qty: [3, 8] }, { item: 'seed_redleaf', qty: [1, 3] }], xp: { leadership: 70, foraging: 40 } },
  deep_gallery: { name: 'Deep Gallery Inspection', icon: '⚙️', durationMs: 540000, recommendedRole: 'Engineer', rewards: [{ item: 'ore_iron', qty: [6, 14] }, { item: 'ancient_gear', qty: [0, 1] }], xp: { leadership: 130, engineering: 80 } },
  lake_ruins: { name: 'Crystal Lake Dive', icon: '💎', durationMs: 720000, recommendedRole: 'Arcanist', rewards: [{ item: 'artifact_shard', qty: [2, 6] }, { item: 'ore_crystal', qty: [0, 2] }], xp: { leadership: 180, archaeology: 120 } },
  wilds_patrol: { name: 'Wilds Patrol', icon: '☠️', durationMs: 900000, recommendedRole: 'Sentinel', rewards: [{ item: 'corrupted_heart', qty: [0, 2] }, { item: 'sentinel_mark', qty: [2, 6] }], xp: { leadership: 240, slayer: 160 }, danger: 7 },
  coast_charting: { name: 'Coastal Charting', icon: '⛵', durationMs: 660000, recommendedRole: 'Navigator', rewards: [{ item: 'cargo_spices', qty: [1, 3] }, { item: 'captain_token', qty: [1, 4] }], xp: { leadership: 170, sailing: 130 } },
};

const research = {
  efficient_tools: { name: 'Balanced Tool Geometry', icon: '🛠️', durationMs: 300000, cost: { coins: 400, bar_iron: 4 }, description: 'All gathering actions are 3% faster.', effect: { gatheringSpeed: 3 } },
  preserving_methods: { name: 'Preserving Methods', icon: '♻️', durationMs: 420000, cost: { coins: 600, artifact_shard: 2 }, description: 'Production has a 4% chance to preserve ingredients.', effect: { preserveChance: 4 } },
  field_medicine: { name: 'Field Medicine', icon: '🩹', durationMs: 480000, cost: { coins: 700, potion_healing: 6 }, description: 'Food and potions heal 8% more.', effect: { healingPower: 8 } },
  route_ledger: { name: 'Regional Route Ledger', icon: '🗺️', durationMs: 540000, cost: { coins: 900, artifact_shard: 4 }, description: 'Travel and trade routes are 5% faster.', effect: { travelSpeed: 5, tradeSpeed: 5 } },
  combat_doctrine: { name: 'Sentinel Combat Doctrine', icon: '⚔️', durationMs: 720000, cost: { coins: 1200, sentinel_mark: 8 }, description: 'Unlocks advanced interrupt and reserve automation.', effect: { advancedAutomation: 1 } },
  heartglass_resonance: { name: 'Heartglass Resonance', icon: '💎', durationMs: 900000, cost: { coins: 1800, ore_crystal: 8, ancient_fragment: 3 }, description: 'Runecrafting and Enchanting yield 7% more XP.', effect: { magicCraftXp: 7 } },
  caravan_insurance: { name: 'Caravan Insurance', icon: '📜', durationMs: 660000, cost: { coins: 1500, cargo_spices: 2 }, description: 'Trade routes no longer lose cargo on ordinary failures.', effect: { insuredTrade: 1 } },
  volcanic_metallurgy: { name: 'Volcanic Metallurgy', icon: '🌋', durationMs: 1200000, cost: { coins: 3000, bar_obsidian: 4, herb_ashbloom: 3 }, description: 'Unlocks Emberite equipment and improves fire resistance.', effect: { emberSmithing: 1, fireResist: 5 } },
};

const worldEvents = {
  ash_storm: { name: 'Ash Storm', icon: '🌋', durationMs: 21600000, regions: ['mount_ember', 'obsidian_quarry', 'the_wilds'], description: 'Volcanic gathering is richer, but travel and fire combat are more dangerous.', modifiers: { volcanicYield: 20, travelSpeed: -12, enemyFireDamage: 15 } },
  river_flood: { name: 'Riverside Flood', icon: '🌊', durationMs: 21600000, regions: ['riverside', 'crystal_lake'], description: 'River fishing improves while roads slow and crop disease risk rises.', modifiers: { fishingSpeed: 18, travelSpeed: -8, cropYield: -5 } },
  fish_migration: { name: 'Great Fish Migration', icon: '🐟', durationMs: 21600000, regions: ['crystal_lake', 'coastal_fishing'], description: 'Fishing yields and rare catch rates are greatly increased.', modifiers: { fishingYield: 25, rareFind: 5 } },
  goblin_incursion: { name: 'Goblin Incursion', icon: '👺', durationMs: 21600000, regions: ['stonehaven', 'pineglade'], description: 'Combat contracts multiply and roads become less safe.', modifiers: { combatCoins: 20, travelDanger: 10 } },
  willow_fair: { name: 'Willowbrook Merchant Fair', icon: '🎪', durationMs: 21600000, regions: ['willowbrook'], description: 'Regional prices improve and rare shop stock appears.', modifiers: { buyDiscount: 10, sellBonus: 12 } },
  mine_collapse: { name: 'Deep Mine Collapse', icon: '⛏️', durationMs: 21600000, regions: ['dwarven_mine'], description: 'Mining slows, but exposed relic layers improve Archaeology.', modifiers: { miningSpeed: -15, archaeologyYield: 30 } },
  corruption_surge: { name: 'Corruption Surge', icon: '☠️', durationMs: 21600000, regions: ['the_wilds', 'watchpost'], description: 'Corrupted enemies are stronger and drop more rare materials.', modifiers: { enemyDamage: 18, rareFind: 8, slayerXp: 20 } },
  pirate_blockade: { name: 'Pirate Blockade', icon: '🏴‍☠️', durationMs: 21600000, regions: ['waveport', 'harbor_dock', 'coastal_fishing'], description: 'Trade routes pay more but sea voyages face elevated danger.', modifiers: { tradeProfit: 30, sailingDanger: 15 } },
  celestial_alignment: { name: 'Celestial Alignment', icon: '🌠', durationMs: 21600000, regions: ['crystal_lake', 'willow_grove'], description: 'Runecrafting, Enchanting, and Summoning are empowered.', modifiers: { magicCraftXp: 25, summoningSpeed: 20 } },
  druid_festival: { name: 'Festival of Roots', icon: '☘️', durationMs: 21600000, regions: ['willow_grove', 'pineglade'], description: 'Foraging, Farming, and Herblore receive broad bonuses.', modifiers: { foragingYield: 20, cropYield: 15, potionYield: 10 } },
};

const quests = {
  main_smoke: {
    name: 'Smoke Over Stonehaven', icon: '🌫️', category: 'Main Story', chapter: 1, giver: 'Foreman Ada', region: 'stonehaven', autoStart: true,
    description: 'Investigate strange smoke and unstable seams above Stonehaven.',
    objectives: [
      { type: 'visit', region: 'stonehaven', count: 1, label: 'Reach Stonehaven' },
      { type: 'item', item: 'ore_copper', count: 8, label: 'Carry 8 Copper Ore' },
      { type: 'skillLevel', skill: 'mining', count: 5, label: 'Reach Mining level 5' },
    ],
    rewards: { coins: 180, xp: { mining: 120, cartography: 40 }, reputation: { prospectors_compact: 60 }, items: { pick_bronze: 1, seed_grain: 3 } }, unlocks: ['main_sealed_deep'],
  },
  main_sealed_deep: {
    name: 'The Sealed Deep', icon: '⚙️', category: 'Main Story', chapter: 2, giver: 'Borin Deepforge', region: 'dwarven_mine', locked: true,
    description: 'Gain access to the abandoned lower galleries of the Dwarven Mine.',
    objectives: [
      { type: 'discover', region: 'dwarven_mine', count: 1, label: 'Discover the Dwarven Mine' },
      { type: 'skillLevel', skill: 'mining', count: 18, label: 'Reach Mining level 18' },
      { type: 'kill', enemy: 'dwarven_skeleton', count: 5, label: 'Defeat 5 Dwarven Skeletons' },
      { type: 'item', item: 'ancient_gear', count: 1, label: 'Recover an Ancient Gear' },
    ],
    rewards: { coins: 600, xp: { mining: 450, engineering: 220 }, reputation: { deepforge_clans: 120 }, items: { hammer_smith: 1 } }, unlocks: ['main_roots_corruption'],
  },
  main_roots_corruption: {
    name: 'Roots of Corruption', icon: '☘️', category: 'Main Story', chapter: 3, giver: 'Elder Liora', region: 'willow_grove', locked: true,
    description: 'Help the Circle trace corruption through plants, beasts, and damaged Heartglass.',
    objectives: [
      { type: 'discover', region: 'willow_grove', count: 1, label: 'Discover Willow Grove' },
      { type: 'item', item: 'herb_moonmint', count: 8, label: 'Carry 8 Moonmint' },
      { type: 'item', item: 'corrupted_heart', count: 2, label: 'Carry 2 Corrupted Hearts' },
      { type: 'skillLevel', skill: 'herblore', count: 25, label: 'Reach Herblore level 25' },
    ],
    rewards: { coins: 1000, xp: { herblore: 650, foraging: 500 }, reputation: { willow_circle: 180 }, items: { seed_moonmint: 4, potion_emberward: 2 } }, unlocks: ['main_broken_watch'],
  },
  main_broken_watch: {
    name: 'The Broken Watch', icon: '🏯', category: 'Main Story', chapter: 4, giver: 'Commander Vale', region: 'watchpost', locked: true,
    description: 'Supply and reinforce Watchpost before the Wilds overrun its eastern wall.',
    objectives: [
      { type: 'discover', region: 'watchpost', count: 1, label: 'Discover Watchpost' },
      { type: 'item', item: 'bar_steel', count: 12, label: 'Carry 12 Steel Bars' },
      { type: 'kill', enemy: 'wilds_shambler', count: 12, label: 'Defeat 12 Wilds Shamblers' },
      { type: 'reputation', faction: 'watchpost_sentinels', count: 150, label: 'Reach 150 Sentinel reputation' },
    ],
    rewards: { coins: 1800, xp: { construction: 900, slayer: 750, leadership: 450 }, reputation: { watchpost_sentinels: 250 }, items: { sentinel_mark: 12, shield_iron: 1 } }, unlocks: ['main_beneath_lake'],
  },
  main_beneath_lake: {
    name: 'Beneath Crystal Lake', icon: '💎', category: 'Main Story', chapter: 5, giver: 'Archivist Renn', region: 'crystal_lake', locked: true,
    description: 'Recover a Heartglass Core from the submerged ruins below Crystal Lake.',
    objectives: [
      { type: 'discover', region: 'crystal_lake', count: 1, label: 'Discover Crystal Lake' },
      { type: 'skillLevel', skill: 'archaeology', count: 50, label: 'Reach Archaeology level 50' },
      { type: 'kill', enemy: 'heartglass_abomination', count: 1, label: 'Defeat the Heartglass Abomination' },
      { type: 'item', item: 'heartglass_core', count: 1, label: 'Possess a Heartglass Core' },
    ],
    rewards: { coins: 3500, xp: { archaeology: 1800, runecrafting: 1200, sorcery: 900 }, reputation: { willow_circle: 300, willowbrook_crown: 180 }, items: { amulet_crystal: 1, rune_way: 2 } }, unlocks: ['main_ember_crown'],
  },
  main_ember_crown: {
    name: 'The Ember Crown', icon: '🔥', category: 'Main Story', chapter: 6, giver: 'Council of Eldoria', region: 'mount_ember', locked: true,
    description: 'Enter Mount Ember, confront the Ashen Covenant, and decide the fate of the Heartglass network.',
    objectives: [
      { type: 'discover', region: 'mount_ember', count: 1, label: 'Discover Mount Ember' },
      { type: 'kill', enemy: 'ember_crowned_dragon', count: 1, label: 'Defeat the Ember-Crowned Dragon' },
      { type: 'item', item: 'heartglass_core', count: 2, label: 'Possess 2 Heartglass Cores' },
      { type: 'skillLevel', skill: 'slayer', count: 70, label: 'Reach Slayer level 70' },
    ],
    rewards: { coins: 10000, xp: { slayer: 5000, leadership: 3000, enchanting: 2500 }, reputation: { willowbrook_crown: 500 }, items: { blade_ember: 1 }, legacyPoints: 3 }, final: true,
  },

  side_pineglade_supplies: {
    name: 'Fletchers in Need', icon: '🏹', category: 'Settlement', giver: 'Warden Elin', region: 'pineglade',
    description: 'Supply Pineglade with materials for new hunting equipment.',
    objectives: [{ type: 'item', item: 'logs_oak', count: 20, label: 'Carry 20 Oak Logs' }, { type: 'item', item: 'fiber_flax', count: 10, label: 'Carry 10 Flax Fiber' }],
    rewards: { coins: 450, xp: { fletching: 260 }, reputation: { pineglade_wardens: 90 }, items: { bow_oak: 1, arrow_bronze: 120 } },
  },
  side_riverside_harvest: {
    name: 'A Flooded Harvest', icon: '🌾', category: 'Settlement', giver: 'Miller Sana', region: 'riverside',
    description: 'Replace food stores damaged by flooding.',
    objectives: [{ type: 'item', item: 'grain', count: 30, label: 'Carry 30 Grain' }, { type: 'item', item: 'fish_trout_cooked', count: 10, label: 'Carry 10 Cooked Trout' }],
    rewards: { coins: 520, xp: { farming: 300, cooking: 220 }, reputation: { riverside_league: 100 }, items: { seed_vegetable: 8, compost: 10 } },
  },
  side_museum_collection: {
    name: 'Fragments of a Crown', icon: '🏺', category: 'Collection', giver: 'Archivist Renn', region: 'willowbrook',
    description: 'Donate rare fragments to the Willowbrook archive.',
    objectives: [{ type: 'item', item: 'artifact_shard', count: 15, label: 'Carry 15 Artifact Fragments' }, { type: 'item', item: 'artifact_crown_seal', count: 1, label: 'Find a Crown Seal Fragment' }],
    rewards: { coins: 1600, xp: { archaeology: 900, cartography: 450 }, reputation: { willowbrook_crown: 140 }, items: { ancient_fragment: 5 } },
  },
  side_captains_choice: {
    name: 'Flags Over Waveport', icon: '⚓', category: 'Faction', giver: 'Captain Sera', region: 'waveport',
    description: 'Choose whether Waveport’s next charter favors the Free Captains or the Willowbrook Crown.',
    objectives: [{ type: 'discover', region: 'waveport', count: 1, label: 'Reach Waveport' }, { type: 'item', item: 'cargo_spices', count: 3, label: 'Secure 3 Imported Spices' }],
    choices: [
      { id: 'captains', label: 'Support the Free Captains', rewards: { reputation: { free_captains: 220, willowbrook_crown: -80 }, items: { captain_token: 10 } } },
      { id: 'crown', label: 'Support the Crown Charter', rewards: { reputation: { willowbrook_crown: 220, free_captains: -80 }, coins: 1300 } },
    ],
    rewards: { xp: { mercantile: 650, sailing: 450 } },
  },
  skill_master_smith: {
    name: 'Steel and Temper', icon: '🔨', category: 'Skill', giver: 'Master Hark', region: 'stonehaven',
    description: 'Prove mastery of steel production and disciplined forging.',
    objectives: [{ type: 'skillLevel', skill: 'smithing', count: 40, label: 'Reach Smithing level 40' }, { type: 'craft', action: 'smelt_steel', count: 30, label: 'Smelt 30 Steel Bars' }],
    rewards: { coins: 1000, xp: { smithing: 900 }, reputation: { prospectors_compact: 100 }, items: { hammer_smith: 1, bar_steel: 10 } },
  },
  skill_cartographer: {
    name: 'The Roads Between', icon: '🗺️', category: 'Skill', giver: 'Royal Surveyor Pell', region: 'willowbrook',
    description: 'Discover ten regions and document Eldoria’s major roads.',
    objectives: [{ type: 'discoverCount', count: 10, label: 'Discover 10 regions' }, { type: 'skillLevel', skill: 'cartography', count: 25, label: 'Reach Cartography level 25' }],
    rewards: { coins: 900, xp: { cartography: 850, agility: 300 }, items: { relic_compass: 1 } },
  },
};

const achievements = {
  first_steps: { name: 'First Steps', icon: '🥾', description: 'Complete your first action.', check: { stat: 'actionsCompleted', count: 1 }, reward: { coins: 25 } },
  skilled_hand: { name: 'Skilled Hand', icon: '🛠️', description: 'Reach level 20 in any skill.', check: { anySkillLevel: 20 }, reward: { coins: 150 } },
  master_of_one: { name: 'Master of One', icon: '🏆', description: 'Reach level 99 in any skill.', check: { anySkillLevel: 99 }, reward: { legacyPoints: 1 } },
  cartographer: { name: 'Known World', icon: '🗺️', description: 'Discover every region shown on the map.', check: { discoveredRegions: Object.keys(regions).length }, reward: { coins: 2500 } },
  monster_hunter: { name: 'Monster Hunter', icon: '☠️', description: 'Defeat 250 enemies.', check: { stat: 'kills', count: 250 }, reward: { coins: 1200 } },
  collector: { name: 'Collector', icon: '🎒', description: 'Discover 75 distinct items.', check: { discoveredItems: 75 }, reward: { coins: 1000 } },
  builder: { name: 'Home and Hearth', icon: '🏠', description: 'Build five different structures.', check: { buildingCount: 5 }, reward: { coins: 850 } },
  faction_friend: { name: 'Trusted Ally', icon: '🤝', description: 'Reach 500 reputation with any faction.', check: { anyReputation: 500 }, reward: { coins: 1100 } },
  dragonfall: { name: 'Dragonfall', icon: '🐲', description: 'Defeat the Ember-Crowned Dragon.', check: { killEnemy: 'ember_crowned_dragon', count: 1 }, reward: { legacyPoints: 2 } },
  idle_week: { name: 'A Life in Eldoria', icon: '⌛', description: 'Accumulate seven days of total play time.', check: { stat: 'playTimeMs', count: 604800000 }, reward: { legacyPoints: 1 } },
};

const backgrounds = {
  stonehaven_apprentice: { name: 'Stonehaven Apprentice', icon: '⛏️', description: 'Begin with Mining and Smithing experience, a pickaxe, and Prospectors’ reputation.', startingXp: { mining: 220, smithing: 150 }, items: { pick_bronze: 1, ore_copper: 8, ore_tin: 8 }, reputation: { prospectors_compact: 60 } },
  pineglade_hunter: { name: 'Pineglade Hunter', icon: '🏹', description: 'Begin with Hunting and Fletching experience, a bow, and Warden reputation.', startingXp: { hunting: 220, fletching: 160, ranged: 120 }, items: { bow_oak: 1, arrow_bronze: 100, trap_simple: 2 }, reputation: { pineglade_wardens: 60 }, startRegion: 'pineglade' },
  riverside_cook: { name: 'Riverside Cook', icon: '🍳', description: 'Begin with Cooking and Farming experience and a strong supply of food and seeds.', startingXp: { cooking: 240, farming: 180 }, items: { fish_trout_cooked: 10, seed_grain: 8, seed_vegetable: 4 }, reputation: { riverside_league: 60 }, startRegion: 'riverside' },
  willowbrook_scribe: { name: 'Willowbrook Scribe', icon: '📚', description: 'Begin with Archaeology, Cartography, and Crown reputation.', startingXp: { archaeology: 180, cartography: 220 }, items: { artifact_shard: 3, rune_blank: 2 }, reputation: { willowbrook_crown: 60 }, startRegion: 'willowbrook' },
  waveport_deckhand: { name: 'Waveport Deckhand', icon: '⚓', description: 'Begin with Sailing and Mercantile experience, cargo, and Captain reputation.', startingXp: { sailing: 220, mercantile: 180 }, items: { cargo_spices: 1, cloth_sail: 1 }, reputation: { free_captains: 60 }, startRegion: 'waveport' },
};

const difficulties = {
  relaxed: { name: 'Relaxed', icon: '🌤️', description: 'No coin loss on defeat, faster recovery, and generous offline safety.', deathCoinLoss: 0, xpMultiplier: 0.9, offlineHours: 48, recoveryMultiplier: 1.5 },
  standard: { name: 'Standard', icon: '⚖️', description: 'Balanced progression and modest defeat penalties.', deathCoinLoss: 0.05, xpMultiplier: 1, offlineHours: 24, recoveryMultiplier: 1 },
  veteran: { name: 'Veteran', icon: '⚔️', description: 'Stronger enemies, greater rewards, and meaningful defeat penalties.', deathCoinLoss: 0.12, xpMultiplier: 1.15, enemyPower: 1.18, offlineHours: 18, recoveryMultiplier: 0.8 },
  hardcore: { name: 'Hardcore', icon: '💀', description: 'A single defeat ends the Chronicle. Export backups are marked noncompetitive.', deathCoinLoss: 1, xpMultiplier: 1.25, enemyPower: 1.25, offlineHours: 12, permadeath: true },
  iron: { name: 'Iron Chronicle', icon: '⛓️', description: 'No buying from markets and no future player trading; every item must be earned.', deathCoinLoss: 0.08, xpMultiplier: 1.08, offlineHours: 24, noMarketBuy: true, iron: true },
};

const weather = {
  clear: { name: 'Clear', icon: '☀️', modifiers: {} },
  rain: { name: 'Rain', icon: '🌧️', modifiers: { fishingSpeed: 8, woodcuttingSpeed: -3 } },
  storm: { name: 'Storm', icon: '⛈️', modifiers: { fishingYield: 12, travelSpeed: -10, sailingDanger: 12 } },
  fog: { name: 'Fog', icon: '🌫️', modifiers: { travelSpeed: -6, rareFind: 3 } },
  snow: { name: 'Snow', icon: '🌨️', modifiers: { travelSpeed: -8, miningSpeed: 5 } },
  ash: { name: 'Ashfall', icon: '🌋', modifiers: { fireResist: -8, volcanicYield: 10 } },
  corruption: { name: 'Corruption Haze', icon: '☠️', modifiers: { enemyDamage: 8, slayerXp: 8 } },
};


const settlementProjects = {
  stonehaven_road: { name: 'Repair the Greyspine Road', icon: '🛣️', region: 'stonehaven', description: 'Rebuild the damaged road between Stonehaven and Riverside.', requirements: { stone: 120, plank_oak: 40, bar_iron: 24, coins: 5000 }, effects: { route: ['stonehaven', 'riverside'], travelSpeed: 18 } },
  riverside_mill: { name: 'Expand the Riverside Mill', icon: '🌾', region: 'riverside', description: 'Increase food processing and regional crop yields.', requirements: { plank_oak: 80, bar_steel: 16, grain: 180, coins: 6500 }, effects: { cropYield: 12, cookingSpeed: 8 } },
  crystal_cleanup: { name: 'Cleanse Crystal Lake', icon: '💎', region: 'crystal_lake', description: 'Remove corrupted growth from the lake’s Heartglass channels.', requirements: { potion_emberward: 24, herb_moonmint: 80, ore_crystal: 20, coins: 9000 }, effects: { fishingYield: 10, magicCraftXp: 10 } },
  watchpost_walls: { name: 'Reinforce Watchpost', icon: '🏯', region: 'watchpost', description: 'Strengthen the eastern wall and reopen safe supply lanes.', requirements: { stone: 220, bar_steel: 60, plank_ironwood: 24, coins: 12000 }, effects: { enemyDamage: -8, tradeProfit: 12 } },
  waveport_lighthouse: { name: 'Raise the Waveport Lighthouse', icon: '🗼', region: 'waveport', description: 'Guide voyages through storms and improve coastal trade.', requirements: { stone: 160, bar_silver: 24, cloth_sail: 30, coins: 11000 }, effects: { sailingDanger: -15, tradeSpeed: 10 } },
};

const voyages = {
  mistbank_isles: { name: 'Mistbank Isles', icon: '🌫️', durationMs: 900000, sailingLevel: 15, danger: 2, rewards: [{ item: 'cargo_spices', qty: [2, 5] }, { item: 'fish_salmon_raw', qty: [8, 18] }], discovery: 'mistbank_isles' },
  shattered_isle: { name: 'Shattered Isle', icon: '🏝️', durationMs: 1500000, sailingLevel: 35, danger: 5, rewards: [{ item: 'ore_obsidian', qty: [2, 6] }, { item: 'artifact_shard', qty: [2, 5] }], discovery: 'shattered_isle' },
  sunken_observatory: { name: 'Sunken Observatory', icon: '🔭', durationMs: 2400000, sailingLevel: 60, danger: 8, rewards: [{ item: 'ore_crystal', qty: [3, 8] }, { item: 'ancient_fragment', qty: [1, 4] }, { item: 'heartglass_core', qty: [0, 1] }], discovery: 'sunken_observatory' },
};

const encounters = {
  dwarven_depths: { name: 'The Dwarven Depths', icon: '⚙️', region: 'dwarven_mine', recommended: 28, sequence: ['dwarven_skeleton', 'dwarven_skeleton', 'crystal_wisp'], reward: { coins: 650, items: { ancient_gear: 1 }, xp: { slayer: 260 } } },
  crystal_ruins: { name: 'Submerged Crystal Ruins', icon: '💎', region: 'crystal_lake', recommended: 62, sequence: ['crystal_wisp', 'tidal_smuggler', 'heartglass_abomination'], reward: { coins: 2200, items: { ore_crystal: 5, ancient_fragment: 2 }, xp: { archaeology: 900, slayer: 700 } } },
  ember_citadel: { name: 'Ember Citadel', icon: '🌋', region: 'mount_ember', recommended: 88, sequence: ['ember_cultist', 'ash_drake', 'ember_cultist', 'ember_crowned_dragon'], reward: { coins: 6000, items: { bar_emberite: 2 }, xp: { slayer: 2200, leadership: 800 } } },
  watchpost_defense: { name: 'Watchpost Defense', icon: '🏯', region: 'watchpost', recommended: 45, sequence: ['wilds_shambler', 'venom_matriarch', 'sentinel_deserter', 'wilds_shambler', 'obsidian_golem'], reward: { coins: 1800, items: { sentinel_mark: 12 }, xp: { slayer: 900, leadership: 650 } }, repeatable: true },
};

const tradeContractTemplates = [
  { item: 'logs_oak', qty: [12, 30], regions: ['stonehaven', 'willowbrook', 'watchpost'], multiplier: 1.45, faction: 'willowbrook_crown' },
  { item: 'ore_iron', qty: [10, 24], regions: ['pineglade', 'riverside', 'watchpost'], multiplier: 1.5, faction: 'prospectors_compact' },
  { item: 'fish_salmon_cooked', qty: [6, 16], regions: ['willowbrook', 'watchpost'], multiplier: 1.6, faction: 'riverside_league' },
  { item: 'potion_healing', qty: [5, 12], regions: ['watchpost', 'waveport'], multiplier: 1.7, faction: 'willow_circle' },
  { item: 'bar_steel', qty: [6, 14], regions: ['watchpost', 'harbor_dock'], multiplier: 1.65, faction: 'watchpost_sentinels' },
  { item: 'cloth_sail', qty: [3, 8], regions: ['waveport', 'harbor_dock'], multiplier: 1.75, faction: 'free_captains' },
  { item: 'artifact_shard', qty: [3, 9], regions: ['willowbrook', 'crystal_lake'], multiplier: 1.85, faction: 'willowbrook_crown' },
  { item: 'ore_obsidian', qty: [3, 8], regions: ['stonehaven', 'watchpost'], multiplier: 1.9, faction: 'prospectors_compact' },
];


// The Memory Beneath is a first-party, data-only content layer. The same
// registries can later be hydrated from Supabase without coupling gameplay to
// the persistence provider.
Object.assign(skills, MEMORY_SKILLS);
Object.assign(factions, MEMORY_FACTIONS);
Object.assign(items, MEMORY_ITEMS);
Object.assign(actions, MEMORY_ACTIONS);
Object.assign(enemies, MEMORY_ENEMIES);
Object.assign(quests, STORY_QUESTS);
Object.assign(settlementProjects, MEMORY_SETTLEMENT_PROJECTS);
Object.assign(research, MEMORY_RESEARCH);

// World-state consequences operate on semantic activity tags. These tags are
// deliberately attached after all content packs have merged so both legacy
// and authored actions respond to permanent regional changes consistently.
for (const actionId of ['wc_maple', 'wc_yew', 'wc_ironwood', 'hunt_boar', 'hunt_venomspider', 'hunt_corrupted_stag', 'commune_ancient_tree']) {
  if (!actions[actionId]) continue;
  actions[actionId].tags = [...new Set([...(actions[actionId].tags || []), 'forest'])];
}

export const DATA = {
  skills,
  factions,
  regions,
  routes,
  items,
  actions,
  abilities,
  enemies,
  crops,
  buildings,
  companions,
  expeditions,
  research,
  worldEvents,
  quests,
  achievements,
  backgrounds,
  difficulties,
  weather,
  tradeContractTemplates,
  settlementProjects,
  voyages,
  encounters,
  npcs: NPCS,
  investigationScenes: INVESTIGATION_SCENES,
  animals: ANIMALS,
  rituals: RITUALS,
  diplomacyActions: DIPLOMACY_ACTIONS,
  dungeons: DUNGEONS,
  regionVariants: REGION_VARIANTS,
  specializations: SPECIALIZATIONS,
  skillMilestones: SKILL_MILESTONES,
};

export const EQUIPMENT_SLOTS = [
  'mainHand', 'offHand', 'head', 'chest', 'legs', 'gloves', 'boots', 'cape', 'amulet', 'ring', 'ammo', 'relic', 'tool', 'familiar',
];

export const SKILL_CATEGORIES = ['Gathering', 'Production', 'Combat', 'Utility', 'Advanced'];

export const REGION_PRICE_PROFILES = {
  stonehaven: { ore: 0.82, bar: 0.9, wood: 1.18, food: 1.12, trade: 1.05 },
  pineglade: { wood: 0.78, hide: 0.86, ore: 1.2, food: 1.05 },
  riverside: { crop: 0.76, food: 0.82, fish: 0.9, ore: 1.18 },
  willowbrook: { trade: 1.02, artifact: 1.2, precious: 1.15 },
  crystal_lake: { crystal: 0.88, magic: 0.94, food: 1.15 },
  watchpost: { food: 1.28, potion: 1.32, armor: 1.2, military: 0.9 },
  waveport: { trade: 0.88, cargo: 0.82, fish: 0.9, ore: 1.15 },
  harbor_dock: { ship: 0.88, cargo: 0.95 },
  coastal_fishing: { fish: 0.72, food: 1.12 },
  mount_ember: { volcanic: 0.82, food: 1.5, potion: 1.45 },
  obsidian_quarry: { volcanic: 0.9, food: 1.35 },
  the_wilds: { food: 1.4, potion: 1.4, rare: 0.95 },
};

export const DEFAULT_AUTOMATION = {
  autoEat: true,
  eatBelowPercent: 45,
  preferredFood: 'best',
  autoPotion: true,
  antidoteAtStacks: 3,
  fleeBelowPercent: 18,
  interruptSpecial: true,
  useAbilities: true,
  stopAfterKills: 0,
  stopWhenFoodBelow: 3,
  stopOnRareDrop: false,
  allowOfflineCombat: false,
};

export function applyContentPack(pack) {
  if (!pack || typeof pack !== 'object') throw new Error('Content pack must be a JSON object.');
  const allowed = ['items', 'actions', 'enemies', 'quests', 'worldEvents'];
  for (const key of allowed) {
    if (!pack[key]) continue;
    if (typeof pack[key] !== 'object' || Array.isArray(pack[key])) throw new Error(`${key} must be an object keyed by id.`);
    for (const [id, value] of Object.entries(pack[key])) {
      if (!/^[a-z0-9_\-]{2,80}$/i.test(id)) throw new Error(`Invalid content id: ${id}`);
      DATA[key][id] = { id, ...value };
    }
  }
  return true;
}
