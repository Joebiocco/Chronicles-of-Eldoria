/*
 * Chronicles of Eldoria — The Memory Beneath content pack.
 *
 * This module contains only declarative content. The engine, quest runtime,
 * persistence adapters, and UI consume these registries without embedding
 * authored quest logic in presentation code. That keeps the project ready for
 * a later Supabase-backed content service while remaining fully local-first.
 */

const item = (id, name, icon, value, tags = [], extra = {}) => ({
  id, name, icon, value, stackable: true, rarity: 'common', tags, description: extra.description || '', lore: extra.lore || '', ...extra,
});

const action = (id, skill, name, icon, level, durationMs, regions, outputs = {}, inputs = {}, extra = {}) => ({
  id, skill, name, icon, level, durationMs, regions, outputs, inputs, xp: extra.xp ?? Math.max(10, Math.round(level * 3.2 + durationMs / 130)), masteryWeight: extra.masteryWeight ?? 1, ...extra,
});

const enemy = (id, name, icon, region, level, hp, maxHit, extra = {}) => ({
  id, name, icon, region, level, hp, maxHit,
  speedMs: extra.speedMs ?? 2500,
  accuracy: extra.accuracy ?? Math.round(level * 1.35 + 5),
  evasion: extra.evasion ?? Math.round(level * 0.82 + 2),
  armor: extra.armor ?? Math.round(level * 0.45),
  damageType: extra.damageType || 'slash',
  resistances: extra.resistances || {},
  coins: extra.coins || [Math.max(1, level * 2), Math.max(4, level * 4)],
  xp: extra.xp ?? Math.round(level * 5.2 + hp * 0.45),
  drops: extra.drops || [],
  abilities: extra.abilities || [],
  ...extra,
});


export const MEMORY_FACTIONS = {
  stonehaven_worker_council: { name: 'Stonehaven Worker Council', icon: '⚒️', description: 'A cooperative government formed by miners, smiths, and descendants of the Lost Shift.' },
};

export const MEMORY_SKILLS = {
  animal_husbandry: {
    name: 'Animal Husbandry', icon: '🐑', category: 'Gathering',
    description: 'Raise, feed, breed, heal, and train animals for food, materials, mounts, and companionship.', passive: true,
  },
  ritualism: {
    name: 'Ritualism', icon: '🕯️', category: 'Advanced',
    description: 'Shape Heartglass, offerings, spirits, weather, waystones, and corruption through deliberate rites.',
  },
  diplomacy: {
    name: 'Diplomacy', icon: '🤝', category: 'Utility',
    description: 'Negotiate treaties, mediate disputes, build leverage, and resolve political problems without violence.',
  },
};

export const MEMORY_ITEMS = {
  timber_support_beam: item('timber_support_beam', 'Mine Support Beam', '🪵', 48, ['wood', 'engineering', 'quest'], { rarity: 'uncommon', description: 'A pressure-braced beam used to stabilize dangerous galleries.' }),
  lantern_oil: item('lantern_oil', 'Lantern Oil', '🪔', 18, ['fuel', 'mining'], { description: 'Low-smoke oil for underground lanterns and survey lamps.' }),
  blasting_powder: item('blasting_powder', 'Blasting Powder', '💥', 85, ['engineering', 'mining', 'hazard'], { rarity: 'uncommon', description: 'A measured charge for controlled excavation.' }),
  ore_heartiron: item('ore_heartiron', 'Heartiron Ore', '🫀', 92, ['ore', 'heartglass', 'deepforge'], { rarity: 'rare', description: 'Dark ore that warms when spoken names are nearby.' }),
  bar_heartiron: item('bar_heartiron', 'Heartiron Bar', '▰', 235, ['bar', 'heartglass', 'deepforge'], { rarity: 'rare', description: 'Refined Heartiron carrying a faint harmonic resonance.' }),
  gem_heartglass: item('gem_heartglass', 'Heartglass Gem', '💠', 420, ['gem', 'heartglass', 'magic'], { rarity: 'epic', description: 'A coherent crystal that stores impressions, voices, and intent.' }),
  air_canister: item('air_canister', 'Compressed Air Canister', '🫧', 120, ['engineering', 'diving'], { rarity: 'uncommon', description: 'A reinforced canister for sustained underwater work.' }),
  diving_harness: item('diving_harness', 'Weighted Diving Harness', '🤿', 380, ['engineering', 'diving', 'quest'], { stackable: false, rarity: 'rare', equipSlot: 'chest', stats: { armor: 7, frostResist: 8 }, description: 'A deliberate, stable diving rig built for ruins rather than speed.' }),
  water_breathing_rune: item('water_breathing_rune', 'Rune of Water-Breathing', '🜄', 260, ['rune', 'diving', 'quest'], { rarity: 'rare', description: 'A charged rune that exchanges air with surrounding water.' }),
  bellkeeper_token: item('bellkeeper_token', 'Bellkeeper’s Token', '🔔', 0, ['quest', 'artifact'], { rarity: 'legendary', description: 'A small crystal bell that rings only near remembered grief.' }),
  veyra_memory: item('veyra_memory', 'Veyran Memory Prism', '🔹', 0, ['quest', 'memory', 'artifact'], { rarity: 'epic', description: 'A preserved final memory recovered from Veyra’s Rest.' }),
  drowned_hymn_fragment: item('drowned_hymn_fragment', 'Drowned Hymn Fragment', '🎼', 75, ['quest', 'lore'], { rarity: 'uncommon', description: 'A waterlogged verse from the funeral rite of Veyra’s Rest.' }),
  lake_compass: item('lake_compass', 'Lakeward Compass', '🧭', 190, ['tool', 'cartography', 'quest'], { stackable: false, rarity: 'rare', equipSlot: 'relic', stats: { evasion: 2, rareFind: 3 }, description: 'Its needle points toward the deepest remembered place, not north.' }),
  refugee_ration: item('refugee_ration', 'Frontier Refugee Ration', '🥣', 22, ['food', 'watchpost', 'quest'], { heal: 20, description: 'A simple ration stretched to feed people the Crown has abandoned.' }),
  beacon_fuel: item('beacon_fuel', 'Beacon Fuel', '🔥', 42, ['fuel', 'watchpost', 'quest'], { description: 'A resin-rich fuel that burns bright through Wilds fog.' }),
  wall_repair_kit: item('wall_repair_kit', 'Wall Repair Kit', '🧱', 95, ['construction', 'watchpost', 'quest'], { rarity: 'uncommon', description: 'Braces, fasteners, wedges, and treated planks for emergency repairs.' }),
  green_lantern: item('green_lantern', 'Green Signal Lantern', '🏮', 0, ['quest', 'watchpost'], { rarity: 'rare', description: 'Nera Voss’s lantern, fitted with lenses visible to corrupted creatures.' }),
  corruption_salve: item('corruption_salve', 'Corruption Salve', '🧴', 110, ['potion', 'herblore', 'corruption'], { rarity: 'uncommon', cleanse: ['corruption'], description: 'A cooling salve that slows crystalline spread without pretending to cure it.' }),
  heartglass_lantern: item('heartglass_lantern', 'Heartglass Lantern', '🏮', 600, ['heartglass', 'quest', 'ritual'], { rarity: 'legendary', description: 'A lantern capable of drawing and igniting memory-bearing corruption.' }),
  rootless_fragment: item('rootless_fragment', 'Rootless Fragment', '🕳️', 320, ['artifact', 'wilds', 'corruption'], { rarity: 'epic', description: 'A piece of absence that refuses to cast a shadow.' }),
  deepforge_ledger: item('deepforge_ledger', 'Deepforge Shift Ledger', '📒', 0, ['quest', 'lore'], { rarity: 'rare', description: 'A payroll ledger bearing overwritten names and impossible totals.' }),
  miner_memory: item('miner_memory', 'Miner’s Memory Shard', '🗿', 0, ['quest', 'memory'], { rarity: 'rare', description: 'A fragment of a worker’s identity carried through forged metal.' }),
  rhun_core: item('rhun_core', 'Keeper Rhun Memory Core', '⚙️', 0, ['quest', 'engineering', 'artifact'], { rarity: 'legendary', description: 'The damaged but defiant record core of Deepforge’s ancient keeper.' }),
  choir_vessel_frame: item('choir_vessel_frame', 'Choir Vessel Frame', '🦾', 900, ['engineering', 'quest', 'heartglass'], { rarity: 'legendary', description: 'A body designed to hold a consciousness made of many names.' }),
  choir_voice_shard: item('choir_voice_shard', 'Choir Voice Shard', '🎙️', 180, ['memory', 'deepforge', 'artifact'], { rarity: 'rare', description: 'A resonant fragment containing overlapping voices.' }),
  memorial_ingot: item('memorial_ingot', 'Memorial Ingot', '▰', 260, ['bar', 'deepforge', 'memorial'], { rarity: 'rare', description: 'Metal refined without erasing the identity held within it.' }),
  cooperative_token: item('cooperative_token', 'Stonehaven Cooperative Token', '⚒️', 0, ['currency', 'faction'], { rarity: 'uncommon', description: 'A worker-council share recognized by Stonehaven cooperative workshops.' }),
  animal_feed: item('animal_feed', 'Balanced Animal Feed', '🌾', 8, ['husbandry', 'feed'], { description: 'Grain, greens, minerals, and herbs mixed for healthy stock.' }),
  sheep_wool: item('sheep_wool', 'Sheep Wool', '🧶', 14, ['husbandry', 'fiber'], { description: 'Soft fleece suitable for cloth, padding, and trade.' }),
  cow_milk: item('cow_milk', 'Fresh Milk', '🥛', 9, ['husbandry', 'food'], { heal: 4, description: 'Fresh milk from a well-cared-for Riverside cow.' }),
  hen_egg: item('hen_egg', 'Hen Egg', '🥚', 5, ['husbandry', 'food'], { heal: 2, description: 'A common cooking ingredient and sign of a healthy flock.' }),
  stable_harness: item('stable_harness', 'Travel Harness', '🪢', 90, ['husbandry', 'mount', 'leather'], { rarity: 'uncommon', description: 'A fitted harness that turns a trained animal into a reliable mount.' }),
  mooncalf_hide: item('mooncalf_hide', 'Mooncalf Hide', '🌙', 180, ['husbandry', 'hide', 'magic'], { rarity: 'rare', description: 'A luminous hide shed naturally by a rare magical breed.' }),
  ritual_chalk: item('ritual_chalk', 'Ritual Chalk', '◯', 22, ['ritual', 'crafting'], { description: 'Mineral chalk mixed with ash, salt, and powdered crystal.' }),
  ritual_candle: item('ritual_candle', 'Ritual Candle', '🕯️', 28, ['ritual', 'crafting'], { description: 'A slow-burning candle marked with names rather than numbers.' }),
  spirit_essence: item('spirit_essence', 'Spirit Essence', '👻', 140, ['ritual', 'spirit', 'magic'], { rarity: 'rare', description: 'Condensed resonance left after a stable spirit-binding rite.' }),
  purified_heartglass: item('purified_heartglass', 'Purified Heartglass', '🔶', 540, ['heartglass', 'ritual', 'magic'], { rarity: 'epic', description: 'Heartglass cleansed of hostile resonance without erasing its memory.' }),
  treaty_seal: item('treaty_seal', 'Treaty Seal', '📜', 0, ['diplomacy', 'quest'], { rarity: 'rare', description: 'A seal recognized by multiple Eldorian factions.' }),
  leverage_dossier: item('leverage_dossier', 'Leverage Dossier', '🗂️', 115, ['diplomacy', 'thieving'], { rarity: 'uncommon', description: 'Verified information useful in negotiation, blackmail, or protection.' }),
  diplomatic_letter: item('diplomatic_letter', 'Diplomatic Letter', '✉️', 35, ['diplomacy', 'trade'], { description: 'A formally witnessed letter carrying reputation beyond one settlement.' }),
  worker_charter: item('worker_charter', 'Worker Council Charter', '📜', 0, ['quest', 'faction', 'stonehaven'], { rarity: 'legendary', description: 'The founding charter of Stonehaven’s worker council.' }),
  warded_rope: item('warded_rope', 'Warded Diving Rope', '🪢', 65, ['diving', 'faith', 'engineering'], { rarity: 'uncommon', description: 'A marked rope that remains visible through memory distortion.' }),
  diving_bell_parts: item('diving_bell_parts', 'Diving Bell Components', '🔩', 210, ['engineering', 'sailing', 'diving'], { rarity: 'uncommon', description: 'Valves, plates, seals, and chain for a serviceable diving bell.' }),
  stormglass: item('stormglass', 'Stormglass', '🌩️', 260, ['sailing', 'magic', 'gem'], { rarity: 'rare', description: 'Glass formed when lightning strikes Heartglass-rich sand.' }),
  dungeon_ration: item('dungeon_ration', 'Expedition Ration', '🥖', 26, ['food', 'dungeon'], { heal: 24, description: 'Dense food designed to survive heat, water, and long expeditions.' }),
  lockpick_set: item('lockpick_set', 'Master Lockpick Set', '🗝️', 175, ['thieving', 'tool'], { stackable: false, rarity: 'rare', equipSlot: 'tool', stats: { evasion: 1, rareFind: 2 }, description: 'A precise set for archives, vaults, and old Dwarven locks.' }),
  mine_support: item('mine_support', 'Adjustable Mine Support', '🏗️', 130, ['engineering', 'mining'], { rarity: 'uncommon', description: 'A reusable screw support for temporary stabilization.' }),
  ventilation_kit: item('ventilation_kit', 'Mine Ventilation Kit', '🌀', 165, ['engineering', 'mining'], { rarity: 'uncommon', description: 'Bellows, ducts, and filters for gas-heavy galleries.' }),
  map_fragment_memory: item('map_fragment_memory', 'Remembered Map Fragment', '🗺️', 0, ['cartography', 'memory', 'quest'], { rarity: 'epic', description: 'A route remembered by someone who no longer exists in official history.' }),
};

export const MEMORY_ACTIONS = {
  // Mining depth and hazard preparation.
  prospect_copper: action('prospect_copper', 'mining', 'Prospect Copper Veins', '🔎', 4, 3000, ['stonehaven', 'coal_pit'], { ore_copper: 1 }, {}, { xp: 28, rare: [{ item: 'gem_sapphire', chance: 0.015 }, { item: 'lantern_oil', chance: 0.04 }] }),
  brace_gallery: action('brace_gallery', 'mining', 'Brace an Unstable Gallery', '🏗️', 18, 5200, ['coal_pit', 'dwarven_mine'], { ore_iron: 2 }, { timber_support_beam: 1 }, { xp: 105, rare: [{ item: 'ancient_gear', chance: 0.025 }], active: { type: 'stability', bonus: 0.2 } }),
  ventilate_depths: action('ventilate_depths', 'mining', 'Ventilate Toxic Depths', '🌀', 28, 6000, ['dwarven_mine'], { ore_coal: 2, sulfur: 1 }, { ventilation_kit: 1 }, { preserveInputs: ['ventilation_kit'], xp: 150, rare: [{ item: 'ore_heartiron', chance: 0.04 }] }),
  blast_rich_vein: action('blast_rich_vein', 'mining', 'Blast a Rich Iron Vein', '💥', 34, 6800, ['highpass_quarry', 'dwarven_mine'], { ore_iron: 5, stone: 3 }, { blasting_powder: 1 }, { xp: 215, rare: [{ item: 'gem_ruby', chance: 0.035 }], active: { type: 'timing', bonus: 0.25 } }),
  mine_heartiron: action('mine_heartiron', 'mining', 'Mine Heartiron', '🫀', 58, 9000, ['dwarven_mine'], { ore_heartiron: 1 }, { lantern_oil: 1 }, { xp: 420, rare: [{ item: 'choir_voice_shard', chance: 0.018 }] }),
  survey_memory_seam: action('survey_memory_seam', 'mining', 'Survey a Memory-Bearing Seam', '〽️', 68, 10500, ['dwarven_mine', 'mount_ember'], { ore_heartiron: 1, ore_crystal: 1 }, {}, { xp: 570, rare: [{ item: 'miner_memory', chance: 0.03 }, { item: 'gem_heartglass', chance: 0.008 }] }),
  recover_deepforge_names: action('recover_deepforge_names', 'mining', 'Recover Names from the Stone', '📝', 82, 12500, ['dwarven_mine'], { miner_memory: 1 }, { ritual_chalk: 1 }, { xp: 820, rare: [{ item: 'rhun_core', chance: 0.001 }] }),

  // Forestry depth.
  tap_resin: action('tap_resin', 'woodcutting', 'Tap Pineglade Resin', '🫙', 10, 4200, ['pineglade'], { resin: 2, bark: 1 }, {}, { xp: 58 }),
  coppice_willow: action('coppice_willow', 'woodcutting', 'Coppice Willow Stands', '🌿', 26, 5200, ['willow_grove', 'riverside'], { logs_willow: 2 }, {}, { xp: 125, rare: [{ item: 'seed_moonmint', chance: 0.04 }] }),
  restore_grove: action('restore_grove', 'woodcutting', 'Restore a Damaged Grove', '🌱', 42, 7400, ['pineglade', 'willow_grove'], { logs_oak: 1, resin: 1 }, { compost: 1 }, { xp: 260, rare: [{ item: 'bird_nest', chance: 0.12 }], active: { type: 'prune', bonus: 0.22 } }),
  hew_support_beams: action('hew_support_beams', 'woodcutting', 'Hew Mine Support Beams', '🪵', 48, 7200, ['pineglade', 'stonehaven'], { timber_support_beam: 1 }, { logs_ironwood: 1 }, { xp: 295 }),
  commune_ancient_tree: action('commune_ancient_tree', 'woodcutting', 'Commune with an Ancient Tree', '🌳', 78, 13000, ['willow_grove', 'the_wilds'], { spirit_essence: 1 }, { ritual_candle: 1 }, { xp: 760, rare: [{ item: 'purified_heartglass', chance: 0.012 }] }),

  // Fishing depth.
  set_river_nets: action('set_river_nets', 'fishing', 'Set Riverside Nets', '🥅', 8, 4800, ['riverside'], { fish_sardine_raw: 2 }, {}, { xp: 58, rare: [{ item: 'hen_egg', chance: 0.02 }] }),
  pot_crystal_crabs: action('pot_crystal_crabs', 'fishing', 'Pot Crystal Crabs', '🦀', 24, 6200, ['crystal_lake'], { fish_trout_raw: 1, artifact_shard: 1 }, {}, { xp: 150, rare: [{ item: 'drowned_hymn_fragment', chance: 0.025 }] }),
  spear_glassfin: action('spear_glassfin', 'fishing', 'Spear Glassfin', '🔱', 38, 6800, ['crystal_lake'], { fish_crystal_carp_raw: 1 }, {}, { xp: 235, rare: [{ item: 'stormglass', chance: 0.01 }], active: { type: 'hook', bonus: 0.25 } }),
  dive_veyra_channels: action('dive_veyra_channels', 'fishing', 'Dive Veyra’s Channels', '🤿', 52, 8800, ['crystal_lake'], { fish_crystal_carp_raw: 2 }, { air_canister: 1 }, { xp: 390, rare: [{ item: 'veyra_memory', chance: 0.015 }, { item: 'map_fragment_memory', chance: 0.012 }] }),
  harpoon_reef_reaver: action('harpoon_reef_reaver', 'fishing', 'Harpoon Reef Reavers', '🪝', 63, 9600, ['coastal_fishing'], { meat_raw: 2 }, { trap_reinforced: 1 }, { preserveInputs: ['trap_reinforced'], xp: 515, rare: [{ item: 'stormglass', chance: 0.025 }] }),
  deep_sea_memory_fishing: action('deep_sea_memory_fishing', 'fishing', 'Fish the Memory Current', '🌌', 82, 14000, ['coastal_fishing', 'crystal_lake'], { fish_ember_eel_raw: 1, ancient_fragment: 1 }, { water_breathing_rune: 1 }, { xp: 890, rare: [{ item: 'gem_heartglass', chance: 0.012 }] }),

  // Archaeology additions.
  excavate_veyra_school: action('excavate_veyra_school', 'archaeology', 'Excavate Veyra’s Schoolhouse', '🏫', 45, 9000, ['crystal_lake'], { drowned_hymn_fragment: 1, artifact_shard: 2 }, {}, { xp: 390, rare: [{ item: 'veyra_memory', chance: 0.035 }] }),
  restore_deepforge_ledger: action('restore_deepforge_ledger', 'archaeology', 'Restore Deepforge Ledgers', '📒', 55, 9800, ['dwarven_mine'], { deepforge_ledger: 1 }, { artifact_shard: 2 }, { xp: 485, rare: [{ item: 'miner_memory', chance: 0.05 }] }),
  map_erased_roads: action('map_erased_roads', 'archaeology', 'Map Erased Roads', '🗺️', 72, 12000, ['crystal_lake', 'dwarven_mine', 'the_wilds'], { map_fragment_memory: 1 }, { rune_way: 1 }, { xp: 710, rare: [{ item: 'gem_heartglass', chance: 0.006 }] }),

  // Engineering additions.
  craft_air_canister: action('craft_air_canister', 'engineering', 'Build Air Canisters', '🫧', 18, 5200, ['stonehaven', 'willowbrook', 'harbor_dock'], { air_canister: 1 }, { bar_iron: 1, leather: 1 }, { xp: 105 }),
  craft_diving_harness: action('craft_diving_harness', 'engineering', 'Build a Diving Harness', '🤿', 35, 9000, ['harbor_dock', 'willowbrook'], { diving_harness: 1 }, { bar_steel: 4, leather: 3, air_canister: 2 }, { xp: 310 }),
  assemble_diving_bell: action('assemble_diving_bell', 'engineering', 'Assemble Diving Bell Parts', '🔩', 42, 9800, ['harbor_dock'], { diving_bell_parts: 1 }, { bar_steel: 5, cloth_sail: 2, ship_fittings: 1 }, { xp: 390 }),
  build_ventilation_kit: action('build_ventilation_kit', 'engineering', 'Build a Ventilation Kit', '🌀', 28, 6800, ['stonehaven', 'dwarven_mine'], { ventilation_kit: 1 }, { plank_oak: 2, bar_iron: 2, cloth_linen: 1 }, { xp: 205 }),
  make_heartglass_lantern: action('make_heartglass_lantern', 'engineering', 'Construct a Heartglass Lantern', '🏮', 68, 14000, ['watchpost', 'willowbrook'], { heartglass_lantern: 1 }, { gem_heartglass: 1, bar_silver: 3, lantern_oil: 4 }, { xp: 900 }),
  frame_choir_vessel: action('frame_choir_vessel', 'engineering', 'Frame a Vessel for the Choir', '🦾', 82, 18000, ['dwarven_mine', 'stonehaven'], { choir_vessel_frame: 1 }, { bar_heartiron: 8, ancient_gear: 4, purified_heartglass: 2 }, { xp: 1380 }),

  // Leadership additions.
  drill_watch_squad: action('drill_watch_squad', 'leadership', 'Drill a Watchpost Squad', '🛡️', 20, 7000, ['watchpost'], { sentinel_mark: 2 }, { refugee_ration: 1 }, { xp: 170, active: { type: 'command', bonus: 0.18 } }),
  coordinate_relief: action('coordinate_relief', 'leadership', 'Coordinate Frontier Relief', '🚚', 32, 9000, ['watchpost', 'riverside'], { diplomatic_letter: 1 }, { refugee_ration: 3, potion_healing: 1 }, { xp: 300 }),
  command_siege_shift: action('command_siege_shift', 'leadership', 'Command a Siege Shift', '🏯', 52, 12000, ['watchpost'], { sentinel_mark: 4 }, { wall_repair_kit: 1, beacon_fuel: 1 }, { xp: 610, rare: [{ item: 'rootless_fragment', chance: 0.012 }] }),
  lead_memory_expedition: action('lead_memory_expedition', 'leadership', 'Lead a Memory Expedition', '🧭', 72, 14500, ['crystal_lake', 'dwarven_mine'], { ancient_fragment: 2 }, { dungeon_ration: 2, warded_rope: 1 }, { xp: 980, rare: [{ item: 'gem_heartglass', chance: 0.01 }] }),

  // Animal Husbandry.
  mix_animal_feed: action('mix_animal_feed', 'animal_husbandry', 'Mix Balanced Feed', '🌾', 1, 2800, ['riverside', 'willowbrook'], { animal_feed: 3 }, { grain: 2, vegetable: 1 }, { xp: 18 }),
  tend_hens: action('tend_hens', 'animal_husbandry', 'Tend Riverside Hens', '🐔', 1, 3600, ['riverside'], { hen_egg: 2 }, { animal_feed: 1 }, { xp: 26 }),
  milk_cows: action('milk_cows', 'animal_husbandry', 'Milk Riverside Cows', '🐄', 8, 4800, ['riverside'], { cow_milk: 2 }, { animal_feed: 1 }, { xp: 52 }),
  shear_sheep: action('shear_sheep', 'animal_husbandry', 'Shear Pineglade Sheep', '🐑', 14, 5600, ['pineglade', 'riverside'], { sheep_wool: 2 }, { animal_feed: 1 }, { xp: 82 }),
  treat_livestock: action('treat_livestock', 'animal_husbandry', 'Treat Sick Livestock', '🩺', 22, 6500, ['riverside', 'willowbrook'], { compost: 2 }, { herb_redleaf: 1, animal_feed: 1 }, { xp: 132 }),
  breed_hardy_sheep: action('breed_hardy_sheep', 'animal_husbandry', 'Breed Hardy Sheep', '🐏', 30, 8000, ['riverside'], { sheep_wool: 3 }, { animal_feed: 3 }, { xp: 220, rare: [{ item: 'mooncalf_hide', chance: 0.006 }] }),
  train_pack_goat: action('train_pack_goat', 'animal_husbandry', 'Train a Pack Goat', '🐐', 38, 9200, ['stonehaven', 'riverside'], { stable_harness: 1 }, { leather: 2, animal_feed: 3 }, { xp: 315 }),
  raise_warden_hound: action('raise_warden_hound', 'animal_husbandry', 'Raise a Warden Hound', '🐕', 46, 10800, ['pineglade'], { hide_tough: 1 }, { meat_roasted: 2, animal_feed: 3 }, { xp: 430, rare: [{ item: 'captain_token', chance: 0.01 }] }),
  breed_mooncalf: action('breed_mooncalf', 'animal_husbandry', 'Breed a Mooncalf', '🦌', 58, 13000, ['willow_grove'], { mooncalf_hide: 1 }, { herb_moonmint: 3, animal_feed: 4 }, { xp: 650, rare: [{ item: 'spirit_essence', chance: 0.04 }] }),
  train_frontier_mount: action('train_frontier_mount', 'animal_husbandry', 'Train a Frontier Mount', '🐎', 66, 14500, ['watchpost', 'riverside'], { stable_harness: 1, sentinel_mark: 1 }, { animal_feed: 6, leather: 2 }, { xp: 820 }),
  tend_heartglass_beast: action('tend_heartglass_beast', 'animal_husbandry', 'Tend a Heartglass Beast', '🦄', 78, 16500, ['crystal_lake', 'willow_grove'], { purified_heartglass: 1 }, { spirit_essence: 1, animal_feed: 5 }, { xp: 1120, rare: [{ item: 'gem_heartglass', chance: 0.018 }] }),
  breed_ember_ram: action('breed_ember_ram', 'animal_husbandry', 'Breed an Ember Ram', '🐏', 88, 18500, ['mount_ember'], { mooncalf_hide: 1, ore_emberite: 1 }, { potion_emberward: 2, animal_feed: 6 }, { xp: 1480 }),

  // Ritualism.
  prepare_ritual_chalk: action('prepare_ritual_chalk', 'ritualism', 'Prepare Ritual Chalk', '◯', 1, 3000, ['willow_grove', 'willowbrook'], { ritual_chalk: 2 }, { stone: 1, sulfur: 1 }, { xp: 22 }),
  pour_ritual_candles: action('pour_ritual_candles', 'ritualism', 'Pour Ritual Candles', '🕯️', 8, 4000, ['willow_grove', 'riverside'], { ritual_candle: 2 }, { resin: 1, fiber_flax: 1 }, { xp: 48 }),
  cleanse_minor_corruption: action('cleanse_minor_corruption', 'ritualism', 'Cleanse Minor Corruption', '✨', 18, 6200, ['willow_grove', 'the_wilds'], { spirit_essence: 1 }, { ritual_chalk: 1, ritual_candle: 1 }, { xp: 125, active: { type: 'alignment', bonus: 0.2 } }),
  bind_waystone_echo: action('bind_waystone_echo', 'ritualism', 'Bind a Waystone Echo', '🌀', 30, 8000, ['willowbrook', 'crystal_lake'], { rune_way: 1 }, { spirit_essence: 1, ritual_chalk: 1 }, { xp: 245 }),
  calm_memory_storm: action('calm_memory_storm', 'ritualism', 'Calm a Memory Storm', '🌫️', 44, 10000, ['crystal_lake'], { purified_heartglass: 1 }, { veyra_memory: 1, ritual_candle: 2 }, { preserveInputs: ['veyra_memory'], xp: 430 }),
  ward_the_watchpost: action('ward_the_watchpost', 'ritualism', 'Ward the Watchpost', '🛡️', 56, 12000, ['watchpost'], { corruption_salve: 2 }, { ritual_chalk: 2, spirit_essence: 1 }, { xp: 650 }),
  separate_memory_shards: action('separate_memory_shards', 'ritualism', 'Separate Memory Shards', '💠', 70, 14500, ['dwarven_mine'], { purified_heartglass: 1, miner_memory: 1 }, { choir_voice_shard: 2, ritual_candle: 2 }, { xp: 960 }),
  commune_heartglass_network: action('commune_heartglass_network', 'ritualism', 'Commune with the Heartglass Network', '🕸️', 90, 20000, ['mount_ember', 'crystal_lake'], { gem_heartglass: 1 }, { purified_heartglass: 2, spirit_essence: 2 }, { xp: 1750, rare: [{ item: 'heartglass_core', chance: 0.025 }] }),

  // Diplomacy.
  draft_letters: action('draft_letters', 'diplomacy', 'Draft Diplomatic Letters', '✉️', 1, 3200, ['willowbrook', 'riverside'], { diplomatic_letter: 2 }, { fiber_flax: 1 }, { xp: 24 }),
  mediate_market_dispute: action('mediate_market_dispute', 'diplomacy', 'Mediate a Market Dispute', '⚖️', 8, 4700, ['willowbrook', 'riverside', 'stonehaven'], { leverage_dossier: 1 }, { diplomatic_letter: 1 }, { xp: 58, active: { type: 'dialogue', bonus: 0.18 } }),
  negotiate_supply_treaty: action('negotiate_supply_treaty', 'diplomacy', 'Negotiate a Supply Treaty', '🤝', 20, 7000, ['riverside', 'watchpost'], { treaty_seal: 1 }, { diplomatic_letter: 3, refugee_ration: 2 }, { xp: 150 }),
  broker_captains_charter: action('broker_captains_charter', 'diplomacy', 'Broker a Captains’ Charter', '⚓', 32, 8500, ['waveport'], { captain_token: 3 }, { leverage_dossier: 1, diplomatic_letter: 2 }, { xp: 285 }),
  mediate_crown_wardens: action('mediate_crown_wardens', 'diplomacy', 'Mediate Crown and Wardens', '🌲', 44, 10200, ['pineglade', 'willowbrook'], { treaty_seal: 1 }, { leverage_dossier: 2 }, { xp: 470 }),
  negotiate_refugee_status: action('negotiate_refugee_status', 'diplomacy', 'Negotiate Refugee Status', '🏯', 56, 12000, ['watchpost'], { treaty_seal: 1, sentinel_mark: 2 }, { diplomatic_letter: 4, corruption_salve: 1 }, { xp: 690 }),
  arbitrate_deepforge_debt: action('arbitrate_deepforge_debt', 'diplomacy', 'Arbitrate Deepforge Debt', '⚒️', 70, 15000, ['stonehaven', 'dwarven_mine'], { cooperative_token: 4 }, { deepforge_ledger: 1, treaty_seal: 1 }, { preserveInputs: ['deepforge_ledger'], xp: 1030 }),
  convene_eldorian_council: action('convene_eldorian_council', 'diplomacy', 'Convene the Eldorian Council', '🏛️', 90, 21000, ['willowbrook'], { treaty_seal: 2 }, { diplomatic_letter: 8, leverage_dossier: 3 }, { xp: 1900, rare: [{ item: 'gem_heartglass', chance: 0.01 }] }),
};

export const MEMORY_ENEMIES = {
  hollow_wolf: enemy('hollow_wolf', 'Hollow Wolf', '🐺', 'pineglade', 14, 54, 9, { damageType: 'slash', drops: [{ item: 'hide_small', chance: 0.7 }, { item: 'corrupted_heart', chance: 0.08 }] }),
  barkbound_raider: enemy('barkbound_raider', 'Barkbound Raider', '🪓', 'pineglade', 22, 82, 13, { armor: 9, drops: [{ item: 'logs_oak', chance: 0.5, qty: [1, 3] }, { item: 'resin', chance: 0.18 }] }),
  corrupted_stag: enemy('corrupted_stag', 'Corrupted Stag', '🦌', 'pineglade', 31, 118, 17, { damageType: 'pierce', resistances: { slash: 12, radiant: -15 }, drops: [{ item: 'hide_tough', chance: 0.8 }, { item: 'corrupted_heart', chance: 0.28 }] }),
  hollow_stag: enemy('hollow_stag', 'The Hollow Stag', '🦌', 'pineglade', 46, 260, 25, { boss: true, armor: 18, abilities: [{ id: 'root_charge', every: 4, power: 18, status: 'bleed' }, { id: 'hollow_call', every: 6, status: 'corruption', power: 4 }], drops: [{ item: 'mooncalf_hide', chance: 0.4 }, { item: 'spirit_essence', chance: 0.7 }] }),
  blight_spore: enemy('blight_spore', 'Blight Spore', '🍄', 'willow_grove', 16, 48, 8, { damageType: 'venom', drops: [{ item: 'mushroom', chance: 0.8 }, { item: 'herb_redleaf', chance: 0.3 }] }),
  rootbound_keeper: enemy('rootbound_keeper', 'Rootbound Keeper', '🌳', 'willow_grove', 27, 105, 14, { armor: 14, resistances: { crush: -20, venom: 40 }, drops: [{ item: 'bark', chance: 0.7 }, { item: 'spirit_essence', chance: 0.15 }] }),
  grove_revenant: enemy('grove_revenant', 'Grove Revenant', '👻', 'willow_grove', 39, 150, 20, { damageType: 'shadow', resistances: { radiant: -25, slash: 25 }, abilities: [{ id: 'memory_drain', every: 5, power: 12, status: 'weakened' }], drops: [{ item: 'spirit_essence', chance: 0.65 }, { item: 'purified_heartglass', chance: 0.06 }] }),
  rootbound_heart: enemy('rootbound_heart', 'Heart of the Rootbound', '🌲', 'willow_grove', 58, 410, 31, { boss: true, armor: 28, resistances: { fire: -20, venom: 60 }, abilities: [{ id: 'root_prison', every: 4, power: 20, status: 'stun' }, { id: 'blight_bloom', every: 6, power: 8, status: 'poison' }], drops: [{ item: 'purified_heartglass', chance: 0.5 }, { item: 'heartglass_core', chance: 0.06 }] }),
  drowned_villager: enemy('drowned_villager', 'Drowned Villager Echo', '🫧', 'crystal_lake', 34, 108, 16, { damageType: 'frost', resistances: { frost: 55, radiant: -18 }, drops: [{ item: 'veyra_memory', chance: 0.08 }, { item: 'drowned_hymn_fragment', chance: 0.2 }] }),
  glassfin_hunter: enemy('glassfin_hunter', 'Glassfin Hunter', '🦈', 'crystal_lake', 42, 160, 23, { damageType: 'pierce', evasion: 42, drops: [{ item: 'fish_crystal_carp_raw', chance: 0.7, qty: [1, 3] }, { item: 'stormglass', chance: 0.08 }] }),
  memory_echo: enemy('memory_echo', 'Memory Echo', '🪞', 'crystal_lake', 52, 190, 27, { damageType: 'arcane', resistances: { arcane: 35, crush: -15 }, abilities: [{ id: 'repeated_grief', every: 4, power: 18, status: 'weakened' }], drops: [{ item: 'veyra_memory', chance: 0.35 }, { item: 'gem_heartglass', chance: 0.03 }] }),
  bell_sorrow: enemy('bell_sorrow', 'Manifest Sorrow', '🔔', 'crystal_lake', 64, 330, 34, { elite: true, damageType: 'shadow', abilities: [{ id: 'toll_of_grief', every: 3, power: 21, status: 'stun' }], drops: [{ item: 'bellkeeper_token', chance: 0.05 }, { item: 'spirit_essence', chance: 0.8 }] }),
  bellkeeper_manifest: enemy('bellkeeper_manifest', 'The Bellkeeper’s Burden', '🔔', 'crystal_lake', 72, 610, 42, { boss: true, evasion: 42, damageType: 'arcane', resistances: { arcane: 45, radiant: -20 }, abilities: [{ id: 'ninth_toll', every: 5, power: 5, status: 'corruption' }, { id: 'memory_flood', every: 7, power: 4, status: 'weakened' }], drops: [{ item: 'gem_heartglass', chance: 0.5 }, { item: 'bellkeeper_token', chance: 1 }] }),
  rootless_spawn: enemy('rootless_spawn', 'Rootless Spawn', '🕳️', 'the_wilds', 38, 132, 20, { damageType: 'shadow', drops: [{ item: 'rootless_fragment', chance: 0.06 }, { item: 'corrupted_heart', chance: 0.45 }] }),
  memory_husk: enemy('memory_husk', 'Memory Husk', '🧍', 'the_wilds', 47, 175, 25, { damageType: 'crush', abilities: [{ id: 'stolen_name', every: 5, power: 15, status: 'weakened' }], drops: [{ item: 'spirit_essence', chance: 0.32 }, { item: 'map_fragment_memory', chance: 0.06 }] }),
  thornmaw: enemy('thornmaw', 'Thornmaw', '🌿', 'the_wilds', 56, 230, 31, { damageType: 'pierce', armor: 24, abilities: [{ id: 'thorn_burst', every: 4, power: 22, status: 'bleed' }], drops: [{ item: 'herb_ashbloom', chance: 0.3 }, { item: 'hide_tough', chance: 0.5 }] }),
  rootless_fragment_elite: enemy('rootless_fragment_elite', 'Rootless Fragment', '◼️', 'watchpost', 68, 390, 38, { elite: true, damageType: 'shadow', resistances: { shadow: 55, radiant: -30 }, abilities: [{ id: 'erase', every: 5, power: 29, status: 'corruption' }], drops: [{ item: 'rootless_fragment', chance: 0.8 }, { item: 'gem_heartglass', chance: 0.06 }] }),
  rootless_one: enemy('rootless_one', 'The Rootless One', '⬛', 'watchpost', 82, 900, 52, { boss: true, damageType: 'shadow', armor: 35, resistances: { shadow: 70, radiant: -25, fire: -10 }, abilities: [{ id: 'devour_memory', every: 4, power: 36, status: 'weakened' }, { id: 'hollow_ground', every: 6, power: 30, status: 'stun' }], drops: [{ item: 'rootless_fragment', chance: 1, qty: [2, 4] }, { item: 'heartglass_core', chance: 0.18 }] }),
  deepforge_automaton: enemy('deepforge_automaton', 'Deepforge Automaton', '🤖', 'dwarven_mine', 34, 145, 20, { armor: 25, damageType: 'crush', resistances: { crush: 25, storm: -20 }, drops: [{ item: 'ancient_gear', chance: 0.35 }, { item: 'ore_heartiron', chance: 0.08 }] }),
  ashbound_miner: enemy('ashbound_miner', 'Ashbound Miner', '⛏️', 'dwarven_mine', 48, 182, 26, { damageType: 'slash', abilities: [{ id: 'remembered_shift', every: 5, power: 18, status: 'bleed' }], drops: [{ item: 'miner_memory', chance: 0.18 }, { item: 'deepforge_ledger', chance: 0.04 }] }),
  forged_armor: enemy('forged_armor', 'Living Forged Armor', '🛡️', 'dwarven_mine', 61, 300, 34, { armor: 42, damageType: 'crush', resistances: { slash: 45, arcane: -20 }, abilities: [{ id: 'magnetic_pull', every: 4, power: 24, status: 'stun' }], drops: [{ item: 'bar_heartiron', chance: 0.22 }, { item: 'choir_voice_shard', chance: 0.35 }] }),
  forged_choir: enemy('forged_choir', 'The Forged Choir', '🎭', 'dwarven_mine', 84, 980, 54, { boss: true, armor: 38, evasion: 48, damageType: 'arcane', resistances: { arcane: 35, radiant: -18 }, abilities: [{ id: 'hundred_hammers', every: 4, power: 6, status: 'bleed' }, { id: 'chorus_of_names', every: 6, power: 5, status: 'weakened' }], drops: [{ item: 'choir_voice_shard', chance: 1, qty: [3, 6] }, { item: 'rhun_core', chance: 0.15 }] }),
  storm_wraith: enemy('storm_wraith', 'Storm Wraith', '🌩️', 'coastal_fishing', 57, 240, 30, { damageType: 'storm', resistances: { storm: 60, earth: -20 }, drops: [{ item: 'stormglass', chance: 0.45 }, { item: 'spirit_essence', chance: 0.25 }] }),
  reef_reaver: enemy('reef_reaver', 'Reef Reaver', '🦈', 'coastal_fishing', 67, 360, 39, { damageType: 'pierce', evasion: 55, abilities: [{ id: 'rending_bite', every: 4, power: 28, status: 'bleed' }], drops: [{ item: 'meat_raw', chance: 1, qty: [2, 5] }, { item: 'stormglass', chance: 0.18 }] }),
};

export const NPCS = {
  mara_vale: { name: 'Mara Vale', icon: '🧑‍✈️', region: 'crystal_lake', role: 'Ferrymaster', description: 'Lysa’s practical, exhausted mother. She wants her daughter back, not a lecture about ancient magic.' },
  lysa_vale: { name: 'Lysa Vale', icon: '👧', region: 'crystal_lake', role: 'Missing child', description: 'A sharp, curious girl who hears a song no one remembers teaching her.' },
  corven_hale: { name: 'Archivist Corven Hale', icon: '📚', region: 'willowbrook', role: 'Royal archivist', description: 'Keeper of altered records who believes buried truths can still protect the living.' },
  sister_aveline: { name: 'Sister Aveline', icon: '☀️', region: 'willow_grove', role: 'Ritual healer', description: 'A calm scholar of funeral rites and memory-bearing Heartglass.' },
  bellkeeper: { name: 'The Bellkeeper', icon: '🔔', region: 'crystal_lake', role: 'Preserved consciousness', description: 'A keeper fused to the mechanism that has held Veyra’s Rest together for generations.' },
  maelin_thorne: { name: 'Commander Maelin Thorne', icon: '🛡️', region: 'watchpost', role: 'Commander', description: 'A disciplined frontier officer hiding the corruption beneath her skin.' },
  jorren_pike: { name: 'Quartermaster Jorren Pike', icon: '📦', region: 'watchpost', role: 'Quartermaster', description: 'An abrasive veteran whose missing provisions feed people the Crown refuses to recognize.' },
  nera_voss: { name: 'Scout Nera Voss', icon: '🏮', region: 'watchpost', role: 'Scout', description: 'The sole survivor of the eastern patrol and the true Lantern Bearer.' },
  brother_cael: { name: 'Brother Cael', icon: '🩹', region: 'watchpost', role: 'Healer', description: 'A quiet healer who treats soldiers and corrupted refugees as equally human.' },
  brunna_coalvein: { name: 'Brunna Coalvein', icon: '🦾', region: 'stonehaven', role: 'Former mine engineer', description: 'A survivor who remembers workers that official history insists never existed.' },
  dain_coalvein: { name: 'Dain Coalvein', icon: '⛏️', region: 'stonehaven', role: 'Night-shift miner', description: 'Brunna’s brother, speaking in the voices of dead miners while asleep.' },
  odrik_vane: { name: 'Master Foreman Odrik Vane', icon: '🎩', region: 'stonehaven', role: 'Compact master', description: 'A pragmatic industrial leader who believes living families cannot survive on old guilt.' },
  keeper_rhun: { name: 'Keeper Rhun', icon: '⚙️', region: 'dwarven_mine', role: 'Record intelligence', description: 'An ancient machine intelligence built to remember every worker who entered Deepforge.' },
  forged_choir_npc: { name: 'The Forged Choir', icon: '🎭', region: 'dwarven_mine', role: 'Merged consciousness', description: 'The erased workers, scattered through ore and forged objects, attempting to remember themselves.' },
  crown_messenger: { name: 'Crown Messenger Arel', icon: '📜', region: 'watchpost', role: 'Royal courier', description: 'A frightened official carrying orders that would abandon the entire frontier.' },
};

export const INVESTIGATION_SCENES = {
  lake_boat: {
    title: 'The Abandoned Fishing Boat', region: 'crystal_lake',
    description: 'The boat rocks against the current. Its lantern is still burning, though the morning wind should have killed it hours ago.',
    evidence: [
      { id: 'burning_lantern', name: 'The burning lantern', text: 'The oil is ordinary, but the flame leans toward the center of the lake.', interpretations: { fishing: 'The boat drifted against the current.', ritualism: 'The flame is answering a resonance rather than wind.' } },
      { id: 'cut_line', name: 'The cut fishing line', text: 'The line was severed from inside the boat. No teeth or rough stone made this edge.', interpretations: { fishing: 'Whoever cut it was calm enough to use a knife.', thieving: 'The cut resembles deliberate evidence removal, but nothing was stolen.' } },
      { id: 'water_footprints', name: 'Footprints made of water', text: 'Bare footprints cross dry boards, each one a shallow pool that does not spread.', interpretations: { faith: 'The spacing mirrors a processional funeral step.', archaeology: 'The pattern appears in old Veyran memorial carvings.' } },
      { id: 'child_carving', name: 'A child’s carving', text: 'Houses, a square, and a bell tower appear beneath a scratched waterline.', interpretations: { cartography: 'The street pattern aligns with an erased depression on official charts.' } },
      { id: 'false_compass', name: 'The false compass', text: 'Its needle points to the deepest part of Crystal Lake instead of north.', interpretations: { cartography: 'The deviation is too exact to be ordinary magnetic ore.', runecrafting: 'The needle is following a Heartglass current.' } },
    ],
  },
  lake_village: {
    title: 'The Sleepless Village', region: 'crystal_lake',
    description: 'Four witnesses remember different pieces of one song. None can hum the entire melody without crying.',
    evidence: [
      { id: 'verse_ferryman', name: 'Ferryman’s verse', text: '“Carry no candle where the water remembers…”' },
      { id: 'verse_child', name: 'Child’s verse', text: '“…name every doorway, though none will return…”' },
      { id: 'verse_healer', name: 'Healer’s verse', text: '“…ring once for leaving, twice for the lost…”' },
      { id: 'verse_miller', name: 'Miller’s verse', text: '“…and nine for the hands that keep us below.”' },
    ],
  },
  deepforge_memorial: {
    title: 'The Vanishing Memorial', region: 'stonehaven',
    description: 'The stone has not been scratched. Where names disappeared, the mineral grain flows as though they were never carved.',
    evidence: [
      { id: 'powdered_heartglass', name: 'Powdered Heartglass', text: 'The memorial stone contains a deliberate admixture of Heartglass.', interpretations: { runecrafting: 'The stone is connected to a recording network.', archaeology: 'This was built as an index, not merely a monument.' } },
      { id: 'living_name', name: 'Dain’s missing name', text: 'Dain Coalvein is alive, but his name has already vanished.', interpretations: { ritualism: 'The network believes his identity has moved elsewhere.' } },
      { id: 'shift_total', name: 'Impossible shift total', text: 'Official reports count forty-six dead. The numbering leaves room for one hundred and twelve.', interpretations: { diplomacy: 'The missing workers were erased to avoid legal obligations.', engineering: 'Keeper Rhun’s index was altered after the collapse.' } },
    ],
  },
  watchpost_beacon: {
    title: 'The Empty Beacon', region: 'watchpost',
    description: 'The eastern beacon is intact. Its fuel line was cut neatly behind the service panel.',
    evidence: [
      { id: 'clean_cut', name: 'Clean fuel-line cut', text: 'The cut required access to the tower and knowledge of the mechanism.', interpretations: { engineering: 'This was sabotage, not battle damage.', leadership: 'Only three duty rosters had unsupervised access.' } },
      { id: 'green_soot', name: 'Green soot', text: 'A second signal fuel was burned recently.', interpretations: { herblore: 'Moonmint and corrupted resin create this color.', hunting: 'The color remains visible through Wilds fog.' } },
    ],
  },
  deepforge_payroll: {
    title: 'The Sealed Payroll Room', region: 'dwarven_mine',
    description: 'Contracts, family claims, and housing records were rewritten together. This was not panic. It was administration.',
    evidence: [
      { id: 'voided_contracts', name: 'Voided contracts', text: 'The lost shift’s contracts were cancelled retroactively, minutes before the collapse.' },
      { id: 'unpaid_families', name: 'Unpaid family claims', text: 'Compensation petitions were rejected because the workers “were not present.”' },
      { id: 'rhun_damage', name: 'Keeper Rhun’s damage', text: 'Tool marks show the memory core was attacked from the record console, not during the cave-in.' },
    ],
  },
};

const dialogue = (speaker, text, options = []) => ({ speaker, text, options });
const objective = (id, type, label, description, extra = {}) => ({ id, type, label, description, ...extra });

export const STORY_QUESTS = {
  memory_bell: {
    id: 'memory_bell', name: 'The Bell Beneath Crystal Lake', icon: '🔔', category: 'Memory Beneath', flagship: true,
    giver: 'Mara Vale', startingNpcId: 'mara_vale', region: 'crystal_lake', recommendedLevel: 28,
    description: 'A bell rings below Crystal Lake, a child follows a forbidden song, and Willowbrook’s cleanest historical record begins to bleed through the page.',
    summary: 'Investigate Lysa Vale’s disappearance and decide the fate of the drowned memories beneath Crystal Lake.',
    prerequisites: [{ type: 'discover', region: 'crystal_lake', count: 1 }],
    stages: [
      {
        id: 'mara_plea', title: 'Footprints to the Water', journalText: 'Mara Vale says Lysa followed a song into Crystal Lake. The Crown refused a search.',
        scene: 'Mara waits beside an empty ferry berth. She has tied Lysa’s red scarf around the post so the wind cannot carry away the last familiar thing.',
        entryDialogue: [dialogue('Mara Vale', 'Do not tell me the lake is dangerous. I have crossed it since before Lysa could walk. Tell me why it knows my father’s song.')],
        objectives: [
          objective('speak_mara', 'talk', 'Hear Mara’s account', 'Ask what Lysa heard and why Mara believes she entered willingly.', { npcId: 'mara_vale', completionText: 'Mara describes a final verse no surviving book contains.' }),
          objective('inspect_boat', 'investigate', 'Examine the abandoned fishing boat', 'Inspect evidence without assuming the lake behaved naturally.', { sceneId: 'lake_boat', evidenceRequired: 3 }),
        ],
      },
      {
        id: 'voices_water', title: 'Voices on the Water', journalText: 'The physical evidence points toward the deepest part of the lake. The villagers remember fragments of one funeral song.',
        scene: 'The sleepless villagers speak in turns. Each insists the others have the melody wrong, yet their hands shake at the same notes.',
        objectives: [
          objective('interview_villagers', 'investigate', 'Interview the sleepless villagers', 'Collect the four remembered fragments of the hymn.', { sceneId: 'lake_village', evidenceRequired: 4 }),
          objective('reconstruct_hymn', 'puzzle', 'Reconstruct the forbidden verse', 'Arrange the remembered lines in the order of the old funeral rite.', {
            options: [
              { id: 'wrong_tower', label: 'Ring first, name the doors, carry the candle, then keep the hands below.' },
              { id: 'correct', label: 'Carry no candle; name every doorway; ring for leaving and the lost; ring nine for the keepers below.', correct: true },
              { id: 'wrong_water', label: 'Name no doorway; ring twice; carry the candle; leave the hands unnamed.' },
            ], hint: 'Sister Aveline says the rite begins by refusing light, then preserves names before counting the dead.', rewardEvidence: 'complete_hymn',
          }),
        ],
      },
      {
        id: 'altered_archive', title: 'The Altered Archive', journalText: 'The full hymn names “the hands that keep us below.” Willowbrook’s official map omits a settlement beneath the lake.',
        scene: 'Archivist Hale keeps the lake records behind a lock newer than every document inside. His fear is not that you will steal them, but that you will read them correctly.',
        entryDialogue: [dialogue('Corven Hale', 'History is not a tomb you open for curiosity. Sometimes the stones are still holding up the house.')],
        objectives: [
          objective('gain_archive_access', 'approach', 'Gain access to the restricted archive', 'Choose a credible way into the restricted collection.', {
            options: [
              { id: 'cooperation', label: 'Persuade Hale to cooperate', skill: 'diplomacy', level: 12, decisionTag: 'trusted_hale' },
              { id: 'crown_influence', label: 'Invoke Crown reputation', reputation: ['willowbrook_crown', 120], decisionTag: 'used_crown_authority' },
              { id: 'stealth', label: 'Enter after closing', skill: 'thieving', level: 20, decisionTag: 'stole_archive_access' },
              { id: 'aveline', label: 'Ask Sister Aveline to challenge the seal', skill: 'faith', level: 18, decisionTag: 'trusted_aveline' },
            ],
          }),
          objective('inspect_altered_map', 'inspect', 'Reveal Veyra’s Rest beneath the ink', 'Compare the official chart with the erased street grid.', { evidenceId: 'veyra_map', interpretations: { cartography: 'The deepest lake basin follows a man-made street plan.', archaeology: 'The newer ink was chosen to obscure older mineral pigment.' } }),
          objective('confront_hale', 'talk', 'Confront Hale with the flood orders', 'Ask why the promised evacuation never happened.', { npcId: 'corven_hale', completionText: 'Hale admits that Veyra’s Rest was deliberately flooded to stabilize a failing Heartglass conduit.' }),
        ],
      },
      {
        id: 'choose_descent', title: 'Preparing the Descent', journalText: 'Lysa is somewhere inside Veyra’s Rest. The descent method will change the routes and dangers below.',
        scene: 'Four plans lie across Mara’s kitchen table. None is perfect. Every person present understands that choosing one means accepting its specific failure.',
        objectives: [
          objective('select_descent', 'approach', 'Choose how to enter Veyra’s Rest', 'Select an underwater expedition method.', {
            options: [
              { id: 'engineering', label: 'Weighted diving harness', skill: 'engineering', level: 25, item: ['diving_harness', 1], decisionTag: 'lake_descent_engineering', detail: 'Safe and methodical; opens industrial routes but limits mobility.' },
              { id: 'runecrafting', label: 'Water-breathing rune', skill: 'runecrafting', level: 28, item: ['water_breathing_rune', 1], decisionTag: 'lake_descent_rune', detail: 'Free movement; unstable near damaged Heartglass.' },
              { id: 'faith', label: 'Aveline’s breath blessing', skill: 'faith', level: 24, decisionTag: 'lake_descent_faith', detail: 'Breath holds while calm; reveals more memory dialogue.' },
              { id: 'sailing', label: 'Diving bell and crew', skill: 'sailing', level: 20, item: ['diving_bell_parts', 1], decisionTag: 'lake_descent_bell', detail: 'A safe checkpoint; narrow structures remain inaccessible.' },
            ],
          }),
          objective('prepare_safety_line', 'skill', 'Prepare a warded return line', 'Create a route back through memory distortion.', { alternatives: [{ skill: 'engineering', level: 18 }, { skill: 'faith', level: 18 }, { item: 'warded_rope', count: 1 }] }),
        ],
      },
      {
        id: 'veyra_rest', title: 'Veyra’s Rest', journalText: 'The settlement was not abandoned. Doors were barred from the outside, and evacuation bags remain beside them.',
        scene: 'Silt moves like smoke between houses. In the schoolhouse, chalk still clings to the final lesson. Somewhere below, the bell rings without moving water.',
        objectives: [
          objective('schoolhouse', 'inspect', 'Search the frozen schoolhouse', 'Recover the last lesson and Lysa’s path through the square.', { evidenceId: 'school_final_lesson', reward: { items: { drowned_hymn_fragment: 1 } } }),
          objective('chapel_wall', 'inspect', 'Read the chapel’s missing names', 'Trace the names removed from the memorial wall.', { evidenceId: 'veyra_names', skillInsights: ['archaeology', 'ritualism'] }),
          objective('council_orders', 'inspect', 'Open the council chamber', 'Recover the sealed Willowbrook flood orders.', { evidenceId: 'flood_orders', skillInsights: ['thieving', 'diplomacy'] }),
          objective('memory_echo_encounter', 'combat', 'Cross the memory storm', 'Defeat the manifestation blocking the bell chamber.', { enemyId: 'bell_sorrow' }),
        ],
      },
      {
        id: 'bellkeeper_chamber', title: 'The Bellkeeper', journalText: 'Lysa is alive beside the Bellkeeper. The conduit is failing, and the dead can no longer hold it together without help.',
        scene: 'Lysa sits inside an air pocket, one hand on a crystal woman’s arm. The Bellkeeper’s other hand pulls a rope that passes through solid stone.',
        entryDialogue: [
          dialogue('Lysa Vale', 'She is not calling people down here. She is warning them. Everyone heard the warning and blamed her for the sound.'),
          dialogue('The Bellkeeper', 'We were promised morning. We were given water. I kept their final names because no one above would.'),
        ],
        objectives: [
          objective('hear_bellkeeper', 'talk', 'Hear the Bellkeeper’s testimony', 'Learn what the memory nexus has preserved and what its failure will release.', { npcId: 'bellkeeper' }),
          objective('assess_conduit', 'skill', 'Assess the failing conduit', 'Use any relevant discipline to understand the three possible interventions.', { alternatives: [{ skill: 'runecrafting', level: 32 }, { skill: 'engineering', level: 32 }, { skill: 'ritualism', level: 25 }, { skill: 'archaeology', level: 35 }] }),
        ],
        decisionGate: true,
      },
    ],
    endings: [
      {
        id: 'silence', label: 'Silence the Bell', title: 'Final Repose', description: 'Destroy the memory nexus, defend Lysa, and release the trapped dead.',
        encounter: 'bellkeeper_manifest', decisionTags: ['released_veyra_dead', 'memory_destroyed_for_mercy'],
        rewards: { coins: 3200, xp: { faith: 1300, slayer: 900, ritualism: 700 }, reputation: { willow_circle: 260, willowbrook_crown: -80 }, items: { bellkeeper_token: 1 } },
        worldChanges: [{ type: 'regionVariant', region: 'crystal_lake', variant: 'purified' }, { type: 'unlockProject', project: 'veyra_memorial' }, { type: 'unlockActivity', action: 'cleanse_minor_corruption' }, { type: 'npcState', npc: 'lysa_vale', state: 'returned_home' }],
        epilogue: 'The bell rings once, clearly, and then never again. Mara holds Lysa while the lake exhales names as bubbles. Willowbrook cannot deny the memorials that appear across its own stone overnight.',
      },
      {
        id: 'preserve', label: 'Preserve the Nexus', title: 'The Living Archive', description: 'Repair the Heartglass system and accept that the dead will remain present.',
        requirements: [{ skill: 'runecrafting', level: 38 }, { skill: 'ritualism', level: 28 }], decisionTags: ['preserved_veyra_memory', 'accepted_living_archive'],
        rewards: { coins: 2800, xp: { runecrafting: 1500, archaeology: 1200, ritualism: 900 }, reputation: { willow_circle: 220, willowbrook_crown: 40 }, items: { veyra_memory: 3, purified_heartglass: 1 } },
        worldChanges: [{ type: 'regionVariant', region: 'crystal_lake', variant: 'memory_nexus' }, { type: 'unlockDungeon', dungeon: 'drowned_archive' }, { type: 'npcState', npc: 'bellkeeper', state: 'archive_keeper' }, { type: 'npcState', npc: 'lysa_vale', state: 'memory_apprentice' }],
        epilogue: 'The lake keeps dreaming, but the dreams gain names, dates, and consent. Lysa returns to the surface carrying stories Willowbrook cannot edit without being corrected by the dead themselves.',
      },
      {
        id: 'break_seal', label: 'Break the Heartglass Seal', title: 'The Emerged Ruins', description: 'Disconnect the conduit and escape as Veyra’s Rest rises from the draining lake.',
        requirements: [{ skill: 'engineering', level: 36 }], decisionTags: ['broke_veyra_seal', 'exposed_crown_history'],
        rewards: { coins: 3600, xp: { engineering: 1400, cartography: 1300, agility: 700 }, reputation: { willowbrook_crown: -220, free_captains: 120, willow_circle: 100 }, items: { map_fragment_memory: 2, gem_heartglass: 1 } },
        worldChanges: [{ type: 'regionVariant', region: 'crystal_lake', variant: 'emerged_ruins' }, { type: 'unlockDungeon', dungeon: 'drowned_archive' }, { type: 'addService', region: 'crystal_lake', service: 'emerged_ruins' }, { type: 'worldPressure', key: 'mount_ember_instability', amount: 1 }],
        epilogue: 'Roofs break the surface before dawn. By noon, everyone can see the barred doors. Willowbrook’s denial ends not with a confession, but with a street rising where the map said there was only water.',
      },
    ],
  },

  memory_wall: {
    id: 'memory_wall', name: 'Seven Nights at the Wall', icon: '🏯', category: 'Memory Beneath', flagship: true,
    giver: 'Commander Maelin Thorne', startingNpcId: 'maelin_thorne', region: 'watchpost', recommendedLevel: 42,
    description: 'Command an abandoned frontier through seven nights of siege while deciding who the wall is truly meant to protect.',
    summary: 'Investigate sabotage, manage limited personnel, protect or reject corrupted refugees, and face the Rootless One.',
    prerequisites: [{ type: 'discover', region: 'watchpost', count: 1 }],
    campaign: { initial: { wall: 70, supplies: 60, morale: 55, wounded: 8, personnel: 5, refugeeTrust: 0, crownLoyalty: 40 } },
    stages: [
      {
        id: 'night_1', title: 'Night One — The Empty Beacon', journalText: 'The beacon was sabotaged from inside. There is time for only a few preparations before the first attack.',
        scene: 'The eastern wall bows inward where old mortar has become powder. Beyond it, shapes gather beneath a beacon that should be burning.',
        objectives: [
          objective('inspect_beacon', 'investigate', 'Investigate the eastern beacon', 'Find out why it went dark.', { sceneId: 'watchpost_beacon', evidenceRequired: 2 }),
          objective('night1_assignment', 'command', 'Assign the first defensive shift', 'Spend five personnel among repairs, medicine, scouting, investigation, and refugee protection.', {
            budget: 5, minChoices: 2, options: [
              { id: 'repair_beacon', label: 'Repair the beacon', cost: 2, effects: { beacon: 1, morale: 4 } },
              { id: 'brace_wall', label: 'Brace the eastern wall', cost: 2, effects: { wall: 15 } },
              { id: 'treat_wounded', label: 'Treat the wounded', cost: 1, effects: { wounded: -3, morale: 3 } },
              { id: 'scout_forest', label: 'Scout the forest', cost: 2, flags: ['forest_scouted'] },
              { id: 'protect_refugees', label: 'Protect the cellar refugees', cost: 1, effects: { refugeeTrust: 8 }, hiddenUntil: 'refugees_known' },
            ],
          }),
          objective('night1_defense', 'combat', 'Hold the wall through the first attack', 'The creatures gather beneath the dark beacon rather than trying to breach the gate.', { enemyId: 'rootless_spawn' }),
        ],
      },
      {
        id: 'night_2', title: 'Night Two — Missing Rations', journalText: 'Jorren’s missing stores feed corrupted refugees hidden beneath the fort.',
        scene: 'The cellar smells of medicine and boiled grain. A child with black crystal along one cheek looks up from a bowl and asks whether you are here to make them leave.',
        objectives: [
          objective('confront_jorren', 'talk', 'Confront Quartermaster Jorren', 'Follow the altered ration records into the hidden cellar.', { npcId: 'jorren_pike', flags: ['refugees_known'] }),
          objective('refugee_policy', 'choice', 'Decide the refugees’ status', 'Choose what the Watchpost will do with people the Crown has declared unlawful.', {
            options: [
              { id: 'secret', label: 'Continue sheltering them in secret', decisionTag: 'refugees_hidden', effects: { supplies: -10, refugeeTrust: 12 } },
              { id: 'admit', label: 'Admit them openly into the fort', decisionTag: 'refugees_admitted', effects: { supplies: -14, morale: -3, refugeeTrust: 24 } },
              { id: 'quarantine', label: 'Create a guarded quarantine outside', decisionTag: 'refugees_quarantined', effects: { supplies: -8, morale: 2, refugeeTrust: 4 } },
              { id: 'expel', label: 'Expel them under Crown law', decisionTag: 'refugees_expelled', effects: { supplies: 5, morale: -8, refugeeTrust: -30, crownLoyalty: 12 } },
            ],
          }),
          objective('night2_defense', 'combat', 'Defend the ration stores', 'A coordinated pack tests the weakest supply entrance.', { enemyId: 'memory_husk' }),
        ],
      },
      {
        id: 'night_3', title: 'Night Three — The Green Lantern', journalText: 'Nera is the Lantern Bearer. She has been guiding creatures away from refugees and the fort.',
        scene: 'The green light stops beneath an ash tree. Nera lowers her hood before you can raise a weapon.',
        objectives: [
          objective('follow_lantern', 'skill', 'Follow the green lantern into the Wilds', 'Track Nera without drawing the creatures behind her.', { alternatives: [{ skill: 'hunting', level: 25 }, { skill: 'cartography', level: 24 }, { skill: 'agility', level: 28 }] }),
          objective('nera_decision', 'choice', 'Decide Nera’s fate', 'Choose whether to trust, expose, imprison, or assist her.', {
            options: [
              { id: 'assist', label: 'Help Nera guide the creatures', decisionTag: 'trusted_nera', effects: { morale: 4, refugeeTrust: 12 }, flags: ['nera_available', 'safe_forest_route'] },
              { id: 'conceal', label: 'Keep her secret but order her back', decisionTag: 'concealed_nera', effects: { morale: 2 }, flags: ['nera_available'] },
              { id: 'expose', label: 'Expose her to the garrison', decisionTag: 'exposed_nera', effects: { morale: -4, crownLoyalty: 8 }, flags: ['nera_distrusted'] },
              { id: 'imprison', label: 'Imprison her for unlawful signaling', decisionTag: 'imprisoned_nera', effects: { morale: -8, crownLoyalty: 10 }, flags: ['nera_imprisoned'] },
            ],
          }),
          objective('night3_defense', 'combat', 'Repel the creatures following the lantern', 'The attack changes depending on whether Nera can guide part of the horde away.', { enemyId: 'thornmaw' }),
        ],
      },
      {
        id: 'night_4', title: 'Night Four — The Commander’s Blood', journalText: 'Commander Thorne is corrupted and has hidden it while seeking proof that identity can survive transformation.',
        scene: 'Thorne’s gauntlet hits the table. Black crystal has reached her wrist. No one in the room breathes.',
        objectives: [
          objective('treat_thorne', 'approach', 'Respond to Thorne’s condition', 'Choose a medical, political, or command response.', {
            options: [
              { id: 'treat', label: 'Attempt experimental treatment', skill: 'herblore', level: 32, item: ['corruption_salve', 1], decisionTag: 'treated_thorne', effects: { morale: 8 }, flags: ['thorne_stable'] },
              { id: 'reveal', label: 'Reveal her condition to the garrison', skill: 'leadership', level: 30, decisionTag: 'revealed_thorne', effects: { morale: -4, refugeeTrust: 10 }, flags: ['thorne_public'] },
              { id: 'conceal', label: 'Keep the condition secret', decisionTag: 'concealed_thorne', effects: { morale: 2 }, flags: ['thorne_commanding'] },
              { id: 'remove', label: 'Remove her from command', skill: 'leadership', level: 28, decisionTag: 'removed_thorne', effects: { morale: -10, crownLoyalty: 8 }, flags: ['player_commanding'] },
            ],
          }),
          objective('night4_assignment', 'command', 'Reassign the shaken garrison', 'Stabilize the fort after the truth about Thorne.', { budget: 5, minChoices: 2, options: [
            { id: 'public_briefing', label: 'Brief everyone honestly', cost: 2, effects: { morale: 8 } },
            { id: 'wall_patrols', label: 'Double wall patrols', cost: 2, effects: { wall: 10 } },
            { id: 'refugee_medics', label: 'Invite refugee medics', cost: 1, effects: { wounded: -4, refugeeTrust: 6 }, requiresTag: ['refugees_admitted', 'refugees_hidden'] },
            { id: 'ration_discipline', label: 'Tighten ration discipline', cost: 1, effects: { supplies: 8, morale: -3 } },
          ] }),
          objective('night4_defense', 'combat', 'Survive the crystal assault', 'Corruption-bearing creatures target the infirmary and command tower.', { enemyId: 'rootless_fragment_elite' }),
        ],
      },
      {
        id: 'night_5', title: 'Night Five — The Broken Oath', journalText: 'The Crown has ordered the fort destroyed and the frontier abandoned.',
        scene: 'The royal seal is genuine. So is the sentence ordering every person east of the road left behind.',
        objectives: [
          objective('read_abandonment_order', 'talk', 'Read the Crown’s sealed order', 'Hear the messenger explain what Willowbrook expects.', { npcId: 'crown_messenger' }),
          objective('answer_crown', 'choice', 'Answer the Crown', 'Choose how the Watchpost responds to the abandonment order.', {
            options: [
              { id: 'obey', label: 'Prepare to obey and collapse the road', decisionTag: 'obeyed_abandonment_order', effects: { crownLoyalty: 30, morale: -20 }, flags: ['crown_plan'] },
              { id: 'delay', label: 'Delay while requesting clarification', skill: 'diplomacy', level: 28, decisionTag: 'delayed_crown_order', effects: { morale: 4 }, flags: ['time_bought'] },
              { id: 'forge', label: 'Forge a response claiming compliance', skill: 'thieving', level: 34, decisionTag: 'forged_crown_response', effects: { morale: 8, crownLoyalty: -8 }, flags: ['time_bought'] },
              { id: 'imprison', label: 'Imprison the messenger', skill: 'leadership', level: 34, decisionTag: 'imprisoned_messenger', effects: { morale: 5, crownLoyalty: -22 }, flags: ['renounced_crown'] },
              { id: 'renounce', label: 'Read the order aloud and renounce Crown command', skill: 'diplomacy', level: 36, decisionTag: 'renounced_crown', effects: { morale: 14, crownLoyalty: -40, refugeeTrust: 15 }, flags: ['renounced_crown'] },
            ],
          }),
          objective('night5_defense', 'combat', 'Hold while the garrison chooses its oath', 'The enemy strikes before the argument is finished.', { enemyId: 'rootless_fragment_elite' }),
        ],
      },
      {
        id: 'night_6', title: 'Night Six — The Rootless One', journalText: 'The Rootless One has reached the wall. It is not an army but a moving absence carrying everything it consumes.',
        scene: 'Trees fold inward without falling. Where the entity passes, people forget which direction the sound came from.',
        objectives: [
          objective('final_preparation', 'command', 'Prepare the final defense', 'Spend the remaining personnel and supplies on the systems that survived your previous decisions.', {
            budget: 6, minChoices: 2, options: [
              { id: 'beacon_chain', label: 'Build a chain of decoy beacons', cost: 2, effects: { wall: 8 }, requiresFlag: 'safe_forest_route' },
              { id: 'alchemical_fire', label: 'Prepare alchemical fire', cost: 2, effects: { supplies: -8 }, flags: ['fire_ready'] },
              { id: 'tunnel_traps', label: 'Prepare the old road tunnels', cost: 2, skill: 'engineering', level: 32, flags: ['tunnels_ready'] },
              { id: 'evacuation', label: 'Prepare civilian evacuation', cost: 2, effects: { morale: 5 }, flags: ['evacuation_ready'] },
              { id: 'refugee_senses', label: 'Use refugee scouts to read corruption', cost: 1, effects: { wall: 10 }, requiresTag: ['refugees_admitted', 'refugees_hidden'] },
              { id: 'heartglass_lantern', label: 'Prepare the Heartglass lantern', cost: 2, item: ['heartglass_lantern', 1], flags: ['lantern_ready'] },
            ],
          }),
          objective('rootless_battle', 'combat', 'Survive the Rootless One’s approach', 'Hold long enough to make the final strategy possible.', { enemyId: 'rootless_one' }),
        ],
      },
      {
        id: 'night_7', title: 'Night Seven — No One Left to Light It', journalText: 'The fort has survived long enough for one final plan. The decision will define the frontier.',
        scene: 'The lantern burns on the command table. Thorne, Nera, and Brother Cael each offer a different way to use it. Outside, the wall groans like a ship in ice.',
        objectives: [objective('hear_final_plans', 'talk', 'Hear the final plans', 'Listen to Thorne, Nera, and Cael before choosing.', { npcId: 'maelin_thorne' })],
        decisionGate: true,
      },
    ],
    endings: [
      { id: 'thorne_sacrifice', label: 'Accept Thorne’s Last Command', title: 'The Memorial Stronghold', description: 'Thorne carries the Heartglass lantern into the Rootless One.', requirements: [{ flag: 'lantern_ready' }], decisionTags: ['thorne_sacrificed', 'destroyed_rootless_one'], rewards: { coins: 5200, xp: { leadership: 1800, slayer: 1500, faith: 700 }, reputation: { watchpost_sentinels: 320, willowbrook_crown: 80 }, items: { sentinel_mark: 20, rootless_fragment: 2 } }, worldChanges: [{ type: 'regionVariant', region: 'watchpost', variant: 'memorial_stronghold' }, { type: 'npcState', npc: 'maelin_thorne', state: 'dead_memorialized' }, { type: 'unlockProject', project: 'thorne_memorial' }], epilogue: 'Thorne walks into the absence with the lantern held high. The blast leaves the wall standing and her shadow burned into the stone. The Crown calls her loyal. The garrison remembers why she disobeyed.' },
      { id: 'nera_path', label: 'Trust the Lantern Bearer’s Path', title: 'The Open Eastern Road', description: 'Nera guides the Rootless One deeper into the Wilds instead of destroying it.', requirements: [{ tag: 'trusted_nera' }], decisionTags: ['nera_disappeared', 'rootless_one_survived'], rewards: { coins: 4300, xp: { cartography: 1600, hunting: 1300, leadership: 1000 }, reputation: { watchpost_sentinels: 220, pineglade_wardens: 140 }, items: { green_lantern: 1, map_fragment_memory: 2 } }, worldChanges: [{ type: 'regionVariant', region: 'watchpost', variant: 'eastern_gateway' }, { type: 'npcState', npc: 'nera_voss', state: 'missing_in_wilds' }, { type: 'unlockRoute', route: ['watchpost', 'the_wilds'] }, { type: 'worldPressure', key: 'rootless_return', amount: 1 }], epilogue: 'The green light moves east until even the highest tower cannot see it. The Rootless One follows. For the first time in years, the road beyond Watchpost is open—and no one knows what waits where Nera went.' },
      { id: 'open_gates', label: 'Open the Gates and Collapse the Tunnels', title: 'The Frontier Town', description: 'Draw the entity beneath the fort and bring the old road tunnels down.', requirements: [{ flag: 'tunnels_ready' }], decisionTags: ['rebuilt_watchpost_together', 'refused_deliberate_sacrifice'], rewards: { coins: 4800, xp: { engineering: 1700, construction: 1500, diplomacy: 800 }, reputation: { watchpost_sentinels: 240, willowbrook_crown: -120, riverside_league: 90 }, items: { wall_repair_kit: 8, cooperative_token: 8 } }, worldChanges: [{ type: 'regionVariant', region: 'watchpost', variant: 'frontier_town' }, { type: 'unlockProject', project: 'frontier_rebuild' }, { type: 'addService', region: 'watchpost', service: 'refugee_council' }], epilogue: 'The fort falls inward after the last civilian crosses the square. No one is chosen to die. In the ruins, soldiers and refugees begin drawing the streets of a town neither Crown law nor old fear designed.' },
      { id: 'burn_wilds', label: 'Burn the Wilds', title: 'The Scorched Frontier', description: 'Use alchemical fire across the surrounding forest.', requirements: [{ flag: 'fire_ready' }], decisionTags: ['burned_wilds', 'destroyed_rootless_one'], rewards: { coins: 6500, xp: { slayer: 2000, engineering: 1200 }, reputation: { willowbrook_crown: 260, watchpost_sentinels: 160, pineglade_wardens: -320, willow_circle: -240 }, items: { sentinel_mark: 30, ore_obsidian: 10 } }, worldChanges: [{ type: 'regionVariant', region: 'watchpost', variant: 'scorched_frontier' }, { type: 'regionVariant', region: 'the_wilds', variant: 'burned' }, { type: 'removeActivitiesByTag', region: 'the_wilds', tag: 'forest' }], epilogue: 'The Rootless One dies in a horizon-wide line of fire. So do camps, dens, groves, and ruins. The wall is safe. The wind carries ash through it for years.' },
    ],
  },

  memory_ash: {
    id: 'memory_ash', name: 'The Names in the Ash', icon: '⚒️', category: 'Memory Beneath', flagship: true,
    giver: 'Brunna Coalvein', startingNpcId: 'brunna_coalvein', region: 'stonehaven', recommendedLevel: 50,
    description: 'Names vanish from Stonehaven’s memorial while tools whisper and forged metal remembers workers the Compact erased.',
    summary: 'Descend into Deepforge, recover the Lost Shift’s history, and decide what the town owes its exploited dead.',
    prerequisites: [{ type: 'discover', region: 'dwarven_mine', count: 1 }],
    stages: [
      {
        id: 'vanishing_memorial', title: 'The Vanishing Memorial', journalText: 'Names are disappearing without tool marks. Dain Coalvein’s name vanished while he was still alive.',
        scene: 'Brunna places her remaining hand against smooth stone where a name should be. She can describe the letters, but every witness beside her sees only unbroken mineral.',
        objectives: [
          objective('speak_brunna', 'talk', 'Hear Brunna’s account', 'Ask what she remembers from the Deepforge Collapse.', { npcId: 'brunna_coalvein' }),
          objective('inspect_memorial', 'investigate', 'Investigate the memorial', 'Find why names move rather than being erased.', { sceneId: 'deepforge_memorial', evidenceRequired: 3 }),
          objective('observe_dain', 'talk', 'Witness Dain’s borrowed voices', 'Listen while Dain names workers absent from every official record.', { npcId: 'dain_coalvein', completionText: 'Dain speaks sixty-six names and wakes remembering none of them.' }),
        ],
      },
      {
        id: 'keeper_index', title: 'The Broken Index', journalText: 'Keeper Rhun’s index once held 112 workers. Someone damaged it after the collapse.',
        scene: 'The old console wakes one segment at a time. Where a name is missing, the machine repeats the sound of a hammer striking glass.',
        objectives: [
          objective('restore_rhun_link', 'approach', 'Restore a link to Keeper Rhun', 'Choose a method that will not overwrite the damaged records.', { options: [
            { id: 'engineering', label: 'Rebuild the signal relays', skill: 'engineering', level: 30, decisionTag: 'restored_rhun_engineering' },
            { id: 'runecrafting', label: 'Bridge the memory channels with runes', skill: 'runecrafting', level: 34, decisionTag: 'restored_rhun_runes' },
            { id: 'archaeology', label: 'Reconstruct the index from physical fragments', skill: 'archaeology', level: 38, decisionTag: 'restored_rhun_archaeology' },
          ] }),
          objective('compare_ledgers', 'inspect', 'Compare the shift ledgers', 'Prove that official numbering leaves room for sixty-six erased workers.', { evidenceId: 'lost_shift_count', reward: { items: { deepforge_ledger: 1 } } }),
          objective('confront_odrik', 'talk', 'Confront Odrik Vane', 'Ask whether the living town can survive the truth.', { npcId: 'odrik_vane' }),
        ],
      },
      {
        id: 'choose_descent', title: 'The Lost Shift Expedition', journalText: 'The lower galleries remain sealed. The chosen route will change what survives the descent.',
        scene: 'Brunna marks five routes across a mine plan. Every route passes through a place where the official map stops admitting there is stone.',
        objectives: [
          objective('assign_specialists', 'command', 'Assign expedition specialists', 'Choose an engineer, scout, defender, healer, excavator, and rune specialist within the available leadership budget.', { budget: 6, minChoices: 3, options: [
            { id: 'engineer', label: 'Engineer', cost: 1, skill: 'engineering', level: 25, flags: ['exp_engineer'] },
            { id: 'scout', label: 'Scout', cost: 1, skill: 'agility', level: 22, flags: ['exp_scout'] },
            { id: 'defender', label: 'Defender', cost: 1, skill: 'defence', level: 30, flags: ['exp_defender'] },
            { id: 'healer', label: 'Healer', cost: 1, skill: 'faith', level: 24, flags: ['exp_healer'] },
            { id: 'excavator', label: 'Excavator', cost: 1, skill: 'mining', level: 34, flags: ['exp_excavator'] },
            { id: 'rune_specialist', label: 'Rune specialist', cost: 1, skill: 'runecrafting', level: 30, flags: ['exp_runes'] },
          ] }),
          objective('descent_route', 'approach', 'Choose the descent route', 'Select how to pass the collapsed lift.', { options: [
            { id: 'repair_lift', label: 'Repair the original lift', skill: 'engineering', level: 34, decisionTag: 'deepforge_lift_repaired', flags: ['safe_return'] },
            { id: 'temporary_platform', label: 'Build a temporary platform', item: ['timber_support_beam', 4], decisionTag: 'deepforge_platform' },
            { id: 'ventilation_shaft', label: 'Use the ventilation shafts', skill: 'agility', level: 36, decisionTag: 'deepforge_vent_route', flags: ['found_hidden_barracks'] },
            { id: 'rune_descent', label: 'Create a rune descent', skill: 'runecrafting', level: 38, decisionTag: 'deepforge_rune_descent' },
            { id: 'controlled_blast', label: 'Blast a controlled opening', item: ['blasting_powder', 3], skill: 'mining', level: 38, decisionTag: 'deepforge_blast', effects: { evidenceRisk: 1 } },
          ] }),
        ],
      },
      {
        id: 'silent_barracks', title: 'The Silent Barracks', journalText: 'The Lost Shift knew the conduit would rupture. They volunteered after the Compact promised to support their families.',
        scene: 'Meals have petrified on the tables. Work boots remain in pairs beneath beds whose owners were officially never here.',
        objectives: [
          objective('search_barracks', 'inspect', 'Search the silent barracks', 'Recover letters proving the workers volunteered under a promise.', { evidenceId: 'lost_shift_letters', reward: { items: { miner_memory: 1 } } }),
          objective('survive_automata', 'combat', 'Disable the Deepforge automata', 'The old machines still enforce the sealed-shift order.', { enemyId: 'deepforge_automaton' }),
          objective('payroll_room', 'investigate', 'Open the sealed payroll room', 'Document the administrative erasure of the Lost Shift.', { sceneId: 'deepforge_payroll', evidenceRequired: 3 }),
        ],
      },
      {
        id: 'furnace_voices', title: 'The Furnace of Voices', journalText: 'The workers’ memories entered the ore. Stonehaven has forged fragments of them into tools and armor for decades.',
        scene: 'Every hammer in the foundry strikes at once without being lifted. Dain stands before a shape made from armor, tools, and the names Stonehaven spent generations refusing to say.',
        entryDialogue: [dialogue('The Forged Choir', 'If a town lives because we were forgotten, what is owed when we remember ourselves?')],
        objectives: [
          objective('hear_choir', 'talk', 'Listen to the individual voices', 'Hear the dead disagree about release, revenge, and the fear of being separated.', { npcId: 'forged_choir_npc' }),
          objective('odrik_arrives', 'talk', 'Hear Odrik’s final argument', 'Odrik intends to destroy the foundry before the truth reaches Stonehaven.', { npcId: 'odrik_vane' }),
          objective('assess_options', 'skill', 'Assess the possible interventions', 'Determine whether the Choir can be separated, embodied, destroyed, or allowed to claim its debt.', { alternatives: [{ skill: 'ritualism', level: 38 }, { skill: 'engineering', level: 42 }, { skill: 'diplomacy', level: 40 }, { skill: 'slayer', level: 48 }] }),
        ],
        decisionGate: true,
      },
    ],
    endings: [
      { id: 'separate_dead', label: 'Separate the Dead', title: 'Keeper of Names', description: 'Use Keeper Rhun to restore individual identities while the foundry destabilizes.', requirements: [{ skill: 'ritualism', level: 40 }, { tag: 'restored_rhun_engineering|restored_rhun_runes|restored_rhun_archaeology' }], decisionTags: ['separated_lost_shift', 'exposed_compact_erasure'], rewards: { coins: 5600, xp: { ritualism: 1800, archaeology: 1700, engineering: 1000 }, reputation: { deepforge_clans: 300, prospectors_compact: -180 }, items: { memorial_ingot: 4, rhun_core: 1 } }, worldChanges: [{ type: 'regionVariant', region: 'stonehaven', variant: 'memorial_reform' }, { type: 'npcState', npc: 'keeper_rhun', state: 'advisor' }, { type: 'addService', region: 'stonehaven', service: 'memorial_forge' }, { type: 'unlockProject', project: 'deepforge_memorial' }], epilogue: 'One hundred and twelve names appear before dawn. Dain wakes with memories that are not his but no longer control him. Stonehaven’s forges go quiet while the town learns how to work without pretending metal is mute.' },
      { id: 'give_body', label: 'Give the Choir a Body', title: 'The Choir Embassy', description: 'Construct a stable vessel for the merged consciousness.', requirements: [{ item: 'choir_vessel_frame', count: 1 }, { skill: 'engineering', level: 52 }], decisionTags: ['embodied_forged_choir', 'accepted_collective_identity'], rewards: { coins: 6000, xp: { engineering: 2100, smithing: 1700, runecrafting: 1200 }, reputation: { deepforge_clans: 220, prospectors_compact: -60 }, items: { bar_heartiron: 5, choir_voice_shard: 2 } }, worldChanges: [{ type: 'regionVariant', region: 'stonehaven', variant: 'choir_embassy' }, { type: 'npcState', npc: 'forged_choir_npc', state: 'embodied_ally' }, { type: 'addService', region: 'stonehaven', service: 'sentient_forge' }, { type: 'unlockActivity', action: 'separate_memory_shards' }], epilogue: 'The new body rises on legs of Heartiron and speaks in many voices without losing any one of them. Stonehaven must negotiate with the people it spent decades turning into property.' },
      { id: 'destroy_foundry', label: 'Destroy the Foundry', title: 'The Quiet Metal', description: 'Fight the Forged Choir and preserve Stonehaven’s immediate industrial stability.', encounter: 'forged_choir', decisionTags: ['destroyed_forged_choir', 'protected_compact_stability'], rewards: { coins: 7600, xp: { slayer: 2200, smithing: 1400 }, reputation: { prospectors_compact: 320, deepforge_clans: -260 }, items: { bar_heartiron: 8, ancient_gear: 5 } }, worldChanges: [{ type: 'regionVariant', region: 'stonehaven', variant: 'compact_restored' }, { type: 'npcState', npc: 'keeper_rhun', state: 'destroyed' }, { type: 'productionModifier', key: 'stonehaven_mining', amount: 12 }], epilogue: 'The voices stop. Stonehaven celebrates uninterrupted shifts by noon. Brunna leaves before sunset. Years later, new Heartglass crises arrive without the knowledge Keeper Rhun would have given you.' },
      { id: 'collect_debt', label: 'Let the Dead Collect Their Debt', title: 'The Worker Council', description: 'Allow the Choir to take control of Deepforge metal throughout Stonehaven and demand restitution.', requirements: [{ skill: 'diplomacy', level: 48 }], decisionTags: ['worker_council_stonehaven', 'allowed_dead_restitution'], rewards: { coins: 4200, xp: { diplomacy: 2300, leadership: 1400, smithing: 900 }, reputation: { prospectors_compact: -500, deepforge_clans: 280, riverside_league: 80 }, items: { worker_charter: 1, cooperative_token: 20 } }, worldChanges: [{ type: 'regionVariant', region: 'stonehaven', variant: 'worker_council' }, { type: 'replaceFaction', region: 'stonehaven', faction: 'stonehaven_worker_council' }, { type: 'npcState', npc: 'brunna_coalvein', state: 'civic_leader' }, { type: 'addService', region: 'stonehaven', service: 'cooperative_workshops' }], epilogue: 'Locks open, machines stop, and every Deepforge coin refuses the Compact’s hand. The Choir does not kill. It negotiates from a position Stonehaven can no longer ignore. By winter, the first cooperative forge is operating under 112 names.' },
    ],
  },
};

export const ANIMALS = {
  hens: { name: 'Riverside Hens', icon: '🐔', level: 1, region: 'riverside', feedPerHour: 1, product: { item: 'hen_egg', min: 2, max: 5 }, cycleMs: 3600000, traits: ['calm', 'prolific', 'hardy'] },
  sheep: { name: 'Pineglade Sheep', icon: '🐑', level: 12, region: 'pineglade', feedPerHour: 2, product: { item: 'sheep_wool', min: 2, max: 4 }, cycleMs: 7200000, traits: ['fine_fleece', 'hardy', 'gentle'] },
  cows: { name: 'Riverside Cows', icon: '🐄', level: 20, region: 'riverside', feedPerHour: 3, product: { item: 'cow_milk', min: 3, max: 7 }, cycleMs: 5400000, traits: ['rich_milk', 'docile', 'strong'] },
  mooncalves: { name: 'Mooncalves', icon: '🦌', level: 55, region: 'willow_grove', feedPerHour: 4, product: { item: 'mooncalf_hide', min: 0, max: 1 }, cycleMs: 14400000, traits: ['luminous', 'wayfinder', 'spirit_bond'] },
};

export const RITUALS = {
  grove_purification: { name: 'Grove Purification', icon: '☘️', level: 15, region: 'willow_grove', durationMs: 4 * 3600000, cost: { ritual_chalk: 2, ritual_candle: 2, herb_moonmint: 2 }, effects: { foragingYield: 12, corruptionDanger: -10 }, description: 'Cleanse a local grove and improve natural gathering.' },
  fisher_tide: { name: 'Fisher’s Tide', icon: '🌊', level: 24, region: 'crystal_lake', durationMs: 3 * 3600000, cost: { ritual_candle: 2, fish_salmon_raw: 2 }, effects: { fishingYield: 15, rareFind: 3 }, description: 'Invite a calm, memory-rich current to the lake.' },
  watchpost_ward: { name: 'Frontier Ward', icon: '🛡️', level: 38, region: 'watchpost', durationMs: 6 * 3600000, cost: { ritual_chalk: 4, spirit_essence: 1, corruption_salve: 1 }, effects: { enemyDamage: -12, slayerXp: 8 }, description: 'Protect the wall and those sheltering behind it.' },
  ember_appeasement: { name: 'Ember Appeasement', icon: '🌋', level: 62, region: 'mount_ember', durationMs: 2 * 3600000, cost: { purified_heartglass: 1, ritual_candle: 4, ore_emberite: 2 }, effects: { volcanicYield: 18, fireResist: 15 }, description: 'Stabilize a local volcanic channel without waking the wider network.' },
  memory_communion: { name: 'Memory Communion', icon: '🕸️', level: 80, region: 'crystal_lake', durationMs: 90 * 60000, cost: { gem_heartglass: 1, spirit_essence: 2 }, effects: { archaeologyXp: 20, loreFind: 15 }, description: 'Open a carefully bounded exchange with the Heartglass memory network.' },
};

export const DIPLOMACY_ACTIONS = {
  riverside_watchpost_supply: { name: 'Riverside–Watchpost Supply Accord', icon: '🌾', level: 18, factions: ['riverside_league', 'watchpost_sentinels'], cost: { diplomatic_letter: 2 }, reputation: { riverside_league: 30, watchpost_sentinels: 30 }, effect: { watchpostFoodPrice: -8 }, description: 'Guarantee frontier food deliveries during sieges.' },
  crown_warden_logging: { name: 'Crown–Warden Forestry Compact', icon: '🌲', level: 34, factions: ['willowbrook_crown', 'pineglade_wardens'], cost: { treaty_seal: 1, leverage_dossier: 1 }, reputation: { willowbrook_crown: 45, pineglade_wardens: 45 }, effect: { woodcuttingYield: 6, groveDamage: -12 }, description: 'Limit extraction while keeping essential timber moving.' },
  captains_navigation: { name: 'Free Captains Navigation Charter', icon: '⚓', level: 42, factions: ['free_captains', 'willowbrook_crown'], cost: { treaty_seal: 1, captain_token: 5 }, reputation: { free_captains: 70, willowbrook_crown: 20 }, effect: { sailingDanger: -10, tradeSpeed: 8 }, description: 'Recognize independent navigators in exchange for shared rescue obligations.' },
  deepforge_restoration: { name: 'Deepforge Restoration Accord', icon: '⚒️', level: 58, factions: ['deepforge_clans', 'prospectors_compact'], cost: { deepforge_ledger: 1, treaty_seal: 1 }, reputation: { deepforge_clans: 90, prospectors_compact: 40 }, effect: { miningSpeed: 5, engineeringSpeed: 5 }, description: 'Create oversight for sealed galleries and historical claims.' },
};

export const DUNGEONS = {
  lower_deepforge: {
    name: 'Lower Deepforge Galleries', icon: '⚙️', region: 'dwarven_mine', recommended: 38,
    description: 'A branching industrial ruin of toxic gas, broken lifts, automata, and memory-bearing ore.',
    entryCost: { dungeon_ration: 2, lantern_oil: 2 },
    nodes: [
      { id: 'entry', name: 'Sealed Lift', type: 'choice', next: ['repair_route', 'vent_route'] },
      { id: 'repair_route', name: 'Repair the Lift', type: 'skill', skill: 'engineering', level: 30, reward: { xp: { engineering: 180 } }, next: ['machine_hall'] },
      { id: 'vent_route', name: 'Ventilation Shafts', type: 'hazard', hazard: 'gas', mitigation: { item: 'ventilation_kit', count: 1 }, next: ['silent_barracks'] },
      { id: 'machine_hall', name: 'Machine Hall', type: 'combat', enemy: 'deepforge_automaton', next: ['ledger_vault'] },
      { id: 'silent_barracks', name: 'Silent Barracks', type: 'lore', lore: 'lost_shift_barracks', reward: { items: { miner_memory: 1 } }, next: ['ledger_vault'] },
      { id: 'ledger_vault', name: 'Ledger Vault', type: 'puzzle', puzzle: 'shift_index', reward: { items: { deepforge_ledger: 1 } }, next: ['heartiron_forge'] },
      { id: 'heartiron_forge', name: 'Heartiron Forge', type: 'boss', enemy: 'forged_armor', reward: { items: { ore_heartiron: 3, choir_voice_shard: 1 }, xp: { mining: 500, slayer: 400 } }, next: [] },
    ],
  },
  rootbound_sanctum: {
    name: 'Rootbound Sanctum', icon: '☘️', region: 'willow_grove', recommended: 42,
    description: 'A living sanctuary where purification and force produce different paths.', entryCost: { potion_antidote: 2, dungeon_ration: 1 },
    nodes: [
      { id: 'entry', name: 'Blighted Threshold', type: 'choice', next: ['purify_path', 'cut_path'] },
      { id: 'purify_path', name: 'Purification Circle', type: 'skill', skill: 'ritualism', level: 25, reward: { items: { spirit_essence: 1 } }, next: ['memory_grove'] },
      { id: 'cut_path', name: 'Tangled Passage', type: 'combat', enemy: 'rootbound_keeper', next: ['memory_grove'] },
      { id: 'memory_grove', name: 'Memory Grove', type: 'lore', lore: 'rootbound_origins', next: ['heart_chamber'] },
      { id: 'heart_chamber', name: 'Heart Chamber', type: 'boss', enemy: 'rootbound_heart', reward: { items: { purified_heartglass: 1 }, xp: { ritualism: 650, slayer: 500 } }, next: [] },
    ],
  },
  drowned_archive: {
    name: 'Drowned Archive', icon: '🔔', region: 'crystal_lake', recommended: 54, locked: true,
    description: 'Submerged records of Veyra’s Rest, with air, memory, and route-management mechanics.', entryCost: { air_canister: 2, dungeon_ration: 1 },
    nodes: [
      { id: 'entry', name: 'Sunken Street', type: 'choice', next: ['school_route', 'chapel_route'] },
      { id: 'school_route', name: 'Schoolhouse', type: 'lore', lore: 'veyra_school', reward: { items: { drowned_hymn_fragment: 1 } }, next: ['memory_current'] },
      { id: 'chapel_route', name: 'Chapel of Names', type: 'puzzle', puzzle: 'veyra_names', reward: { items: { veyra_memory: 1 } }, next: ['memory_current'] },
      { id: 'memory_current', name: 'Memory Current', type: 'combat', enemy: 'memory_echo', next: ['bell_vault'] },
      { id: 'bell_vault', name: 'Bell Vault', type: 'boss', enemy: 'bell_sorrow', reward: { items: { gem_heartglass: 1 }, xp: { archaeology: 800, ritualism: 500 } }, next: [] },
    ],
  },
  hollow_warrens: {
    name: 'Hollow Warrens', icon: '🕳️', region: 'the_wilds', recommended: 50,
    description: 'Poisoned tunnels where routes shift around a moving absence.', entryCost: { potion_antidote: 3, dungeon_ration: 2 },
    nodes: [
      { id: 'entry', name: 'Thorn Mouth', type: 'choice', next: ['upper_warren', 'lower_warren'] },
      { id: 'upper_warren', name: 'Husk Nest', type: 'combat', enemy: 'memory_husk', next: ['rootless_nest'] },
      { id: 'lower_warren', name: 'Venom Channel', type: 'hazard', hazard: 'poison', mitigation: { item: 'potion_antidote', count: 1 }, next: ['rootless_nest'] },
      { id: 'rootless_nest', name: 'Rootless Nest', type: 'boss', enemy: 'rootless_fragment_elite', reward: { items: { rootless_fragment: 2 }, xp: { slayer: 750, hunting: 450 } }, next: [] },
    ],
  },
  obsidian_crucible: {
    name: 'Obsidian Crucible', icon: '🖤', region: 'obsidian_quarry', recommended: 62,
    description: 'A furnace dungeon built around heat, armor breaking, and timed shelter.', entryCost: { potion_emberward: 3, dungeon_ration: 2 },
    nodes: [
      { id: 'entry', name: 'Glassfall', type: 'hazard', hazard: 'heat', mitigation: { item: 'potion_emberward', count: 1 }, next: ['golem_floor'] },
      { id: 'golem_floor', name: 'Golem Floor', type: 'combat', enemy: 'obsidian_golem', next: ['crucible_core'] },
      { id: 'crucible_core', name: 'Crucible Core', type: 'boss', enemy: 'ash_drake', reward: { items: { ore_obsidian: 8, ore_emberite: 2 }, xp: { mining: 900, slayer: 700 } }, next: [] },
    ],
  },
  ashen_citadel: {
    name: 'Ashen Citadel', icon: '🌋', region: 'mount_ember', recommended: 78,
    description: 'A multi-phase assault on the Covenant’s volcanic stronghold.', entryCost: { potion_emberward: 5, dungeon_ration: 3, rune_fire: 5 },
    nodes: [
      { id: 'entry', name: 'Cinder Gate', type: 'combat', enemy: 'ember_cultist', next: ['ritual_hall', 'dragon_roost'] },
      { id: 'ritual_hall', name: 'Ritual Hall', type: 'skill', skill: 'ritualism', level: 55, reward: { items: { purified_heartglass: 1 } }, next: ['ember_throne'] },
      { id: 'dragon_roost', name: 'Dragon Roost', type: 'combat', enemy: 'ash_drake', next: ['ember_throne'] },
      { id: 'ember_throne', name: 'Ember Throne', type: 'boss', enemy: 'ember_crowned_dragon', reward: { items: { heartglass_core: 1, bar_emberite: 3 }, xp: { slayer: 1800, ritualism: 900 } }, next: [] },
    ],
  },
  smugglers_undertide: {
    name: 'Smuggler’s Undertide', icon: '🗝️', region: 'cave_mouth', recommended: 35,
    description: 'Traps, contraband routes, and ambushes beneath the coast.', entryCost: { dungeon_ration: 1, lockpick_set: 1 },
    nodes: [
      { id: 'entry', name: 'False Door', type: 'skill', skill: 'thieving', level: 24, next: ['warehouse'] },
      { id: 'warehouse', name: 'Undertide Warehouse', type: 'combat', enemy: 'tidal_smuggler', reward: { items: { cargo_spices: 2 } }, next: ['reef_exit'] },
      { id: 'reef_exit', name: 'Flooded Exit', type: 'boss', enemy: 'reef_reaver', reward: { items: { stormglass: 1 }, xp: { thieving: 450, sailing: 350 } }, next: [] },
    ],
  },
  tempest_graveyard: {
    name: 'Tempest Graveyard', icon: '🌩️', region: 'coastal_fishing', recommended: 68,
    description: 'A ship-based dungeon through wrecks, storms, and hostile sea spirits.', entryCost: { ship_fittings: 2, dungeon_ration: 3 },
    nodes: [
      { id: 'entry', name: 'Wreck Line', type: 'choice', next: ['storm_route', 'reef_route'] },
      { id: 'storm_route', name: 'Lightning Channel', type: 'combat', enemy: 'storm_wraith', next: ['admirals_wreck'] },
      { id: 'reef_route', name: 'Reaver Reef', type: 'combat', enemy: 'reef_reaver', next: ['admirals_wreck'] },
      { id: 'admirals_wreck', name: 'Admiral’s Wreck', type: 'boss', enemy: 'storm_wraith', reward: { items: { stormglass: 3, ancient_fragment: 2 }, xp: { sailing: 1100, slayer: 850 } }, next: [] },
    ],
  },
};

export const REGION_VARIANTS = {
  crystal_lake: {
    normal: { name: 'Crystal Lake', description: 'A magical lake hiding a drowned settlement and damaged Heartglass currents.' },
    purified: { name: 'Quiet Crystal Lake', description: 'The trapped dead have been released. The water is calmer, and a memorial ferry crosses at dawn.', modifiers: { fishingYield: 8, enemyDamage: -5 } },
    memory_nexus: { name: 'Crystal Lake Living Archive', description: 'The Bellkeeper maintains a consent-bound archive of Veyra’s Rest beneath the water.', modifiers: { archaeologyXp: 15, runecraftingXp: 10 } },
    emerged_ruins: { name: 'The Emerged Ruins of Veyra', description: 'Roofs and streets have risen from the drained lake, exposing the Crown’s oldest crime.', modifiers: { archaeologyYield: 18, travelSpeed: -4 } },
  },
  watchpost: {
    normal: { name: 'Watchpost', description: 'An isolated military fort guarding the eastern road.' },
    memorial_stronghold: { name: 'Thorne Memorial Stronghold', description: 'A fortified memorial where the garrison remembers both Thorne’s courage and her disobedience.', modifiers: { enemyDamage: -10, leadershipXp: 10 } },
    eastern_gateway: { name: 'Eastern Gateway', description: 'Nera’s route has opened the road, though the Rootless One still exists somewhere beyond it.', modifiers: { travelSpeed: 14, rareFind: 4 } },
    frontier_town: { name: 'New Watchpost', description: 'Soldiers, refugees, and frontier families are rebuilding the ruined fort as a shared town.', modifiers: { tradeProfit: 10, diplomacyXp: 12 } },
    scorched_frontier: { name: 'Scorched Watchpost', description: 'The military wall stands above a burned forest and silent refugee camps.', modifiers: { enemyDamage: -16, foragingYield: -30 } },
  },
  the_wilds: {
    normal: { name: 'The Wilds', description: 'A shifting frontier of corruption, old ruins, and migrating creatures.' },
    burned: { name: 'The Burned Wilds', description: 'Ash covers habitats, camps, and ruins destroyed to kill the Rootless One.', modifiers: { woodcuttingYield: -40, foragingYield: -45, miningYield: 8 } },
  },
  stonehaven: {
    normal: { name: 'Stonehaven', description: 'A mountain town organized around Compact mines and forges.' },
    memorial_reform: { name: 'Stonehaven of 112 Names', description: 'The Lost Shift is publicly remembered, and the Memorial Forge works under Keeper Rhun’s oversight.', modifiers: { archaeologyXp: 12, smithingSpeed: -4 } },
    choir_embassy: { name: 'Stonehaven and the Choir', description: 'A sentient collective now occupies an embassy-workshop beside the main forge.', modifiers: { enchantingXp: 14, smithingQuality: 8 } },
    compact_restored: { name: 'Compact Stonehaven', description: 'The Choir is gone and industrial output has resumed under strengthened Compact authority.', modifiers: { miningYield: 12, diplomacyXp: -5 } },
    worker_council: { name: 'Stonehaven Worker Council', description: 'Cooperative workshops and a worker council govern the town under 112 remembered names.', modifiers: { craftingYield: 8, leadershipXp: 10, marketBuy: -4 } },
  },
};

export const SPECIALIZATIONS = {
  mining: [
    { id: 'prospector', name: 'Prospector', level: 25, description: 'Improves gems, rich veins, and rare finds.' },
    { id: 'deep_miner', name: 'Deep Miner', level: 50, description: 'Improves high-tier ore, gas resistance, and underground duration.' },
    { id: 'demolitionist', name: 'Demolitionist', level: 75, description: 'Improves blasting output while reducing collapse risk.' },
  ],
  woodcutting: [
    { id: 'forester', name: 'Forester', level: 25, description: 'Improves ordinary timber and secondary forest resources.' },
    { id: 'arborist', name: 'Arborist', level: 50, description: 'Improves grove restoration, sap, seeds, and ancient trees.' },
    { id: 'lumbermaster', name: 'Lumbermaster', level: 75, description: 'Improves plank conversion and structural timber.' },
  ],
  fishing: [
    { id: 'angler', name: 'Angler', level: 25, description: 'Improves rods, bait, and catch quality.' },
    { id: 'netmaster', name: 'Netmaster', level: 50, description: 'Improves passive nets, traps, and batch catches.' },
    { id: 'deepwater_hunter', name: 'Deepwater Hunter', level: 75, description: 'Improves harpoons, dangerous prey, and rare sea finds.' },
  ],
  farming: [
    { id: 'herbalist', name: 'Herbalist', level: 25, description: 'Improves herbs, disease control, and potion ingredients.' },
    { id: 'orchard_keeper', name: 'Orchard Keeper', level: 50, description: 'Improves long-cycle plants and fruit-tree quality.' },
    { id: 'field_steward', name: 'Field Steward', level: 75, description: 'Improves large harvests, soil rotation, and animal feed.' },
  ],
  engineering: [
    { id: 'mechanist', name: 'Mechanist', level: 25, description: 'Improves machines, traps, and maintenance.' },
    { id: 'civil_engineer', name: 'Civil Engineer', level: 50, description: 'Improves roads, walls, pumps, and settlement projects.' },
    { id: 'artificer', name: 'Artificer', level: 75, description: 'Improves Heartglass devices and combat gadgets.' },
  ],
  leadership: [
    { id: 'commander', name: 'Commander', level: 25, description: 'Improves combat squads and automation.' },
    { id: 'steward', name: 'Steward', level: 50, description: 'Improves workers, estate output, and morale.' },
    { id: 'expedition_leader', name: 'Expedition Leader', level: 75, description: 'Improves dungeon and companion expeditions.' },
  ],
  animal_husbandry: [
    { id: 'breeder', name: 'Breeder', level: 25, description: 'Improves inherited traits and rare breeds.' },
    { id: 'healer', name: 'Animal Healer', level: 50, description: 'Improves health, disease treatment, and product quality.' },
    { id: 'mount_trainer', name: 'Mount Trainer', level: 75, description: 'Improves travel mounts and working animals.' },
  ],
  ritualism: [
    { id: 'purifier', name: 'Purifier', level: 25, description: 'Improves cleansing and protective rites.' },
    { id: 'spirit_binder', name: 'Spirit Binder', level: 50, description: 'Improves spirit essence and familiar rites.' },
    { id: 'heartglass_seer', name: 'Heartglass Seer', level: 75, description: 'Improves memory communion and network stability.' },
  ],
  diplomacy: [
    { id: 'mediator', name: 'Mediator', level: 25, description: 'Improves disputes and reputation recovery.' },
    { id: 'envoy', name: 'Envoy', level: 50, description: 'Improves treaties, travel access, and faction favors.' },
    { id: 'chancellor', name: 'Chancellor', level: 75, description: 'Improves major political settlements and council actions.' },
  ],
};

export const SKILL_MILESTONES = Object.fromEntries(Object.keys(SPECIALIZATIONS).map((skillId) => [skillId, [
  { id: `${skillId}_20`, level: 20, name: 'Apprentice Trial', reward: { masteryPool: 100 } },
  { id: `${skillId}_40`, level: 40, name: 'Journeyman Trial', reward: { masteryPool: 250 } },
  { id: `${skillId}_60`, level: 60, name: 'Regional Mastery', reward: { masteryPool: 500 } },
  { id: `${skillId}_80`, level: 80, name: 'Master’s Challenge', reward: { masteryPool: 900 } },
  { id: `${skillId}_99`, level: 99, name: 'Skill Cape Chronicle', reward: { legacyPoints: 1 } },
]]));

export const MEMORY_SETTLEMENT_PROJECTS = {
  veyra_memorial: { name: 'Memorial to Veyra’s Rest', icon: '🔔', region: 'crystal_lake', description: 'Build a shore memorial that records every recovered name.', requirements: { stone: 180, plank_willow: 60, purified_heartglass: 4, coins: 14000 }, effects: { faithXp: 10, archaeologyXp: 8 }, locked: true },
  thorne_memorial: { name: 'Thorne Memorial Tower', icon: '🏯', region: 'watchpost', description: 'Rebuild the eastern beacon as a memorial and warning tower.', requirements: { stone: 240, bar_steel: 70, heartglass_lantern: 1, coins: 18000 }, effects: { leadershipXp: 12, enemyDamage: -5 }, locked: true },
  frontier_rebuild: { name: 'Build New Watchpost', icon: '🏘️', region: 'watchpost', description: 'Turn the ruined fort into a shared frontier town.', requirements: { stone: 300, plank_ironwood: 80, wall_repair_kit: 20, coins: 22000 }, effects: { tradeProfit: 12, farmPlots: 1 }, locked: true },
  deepforge_memorial: { name: 'The Memorial Forge', icon: '⚒️', region: 'stonehaven', description: 'Create a forge that records the identity carried by every memory-bearing ingot.', requirements: { bar_heartiron: 20, memorial_ingot: 10, purified_heartglass: 3, coins: 20000 }, effects: { smithingQuality: 10, archaeologyXp: 8 }, locked: true },
};

export const MEMORY_RESEARCH = {
  visual_automation: { name: 'Chronicle Visualization', icon: '🎞️', durationMs: 360000, cost: { coins: 800, ancient_gear: 1 }, description: 'Improves activity planning estimates and unlocks advanced automation summaries.', effect: { plannerAccuracy: 12 } },
  husbandry_records: { name: 'Selective Breeding Records', icon: '🐑', durationMs: 600000, cost: { coins: 1200, deepforge_ledger: 1 }, description: 'Increases inherited animal trait quality.', effect: { breedingQuality: 8 } },
  heartglass_ethics: { name: 'Heartglass Consent Protocols', icon: '💠', durationMs: 900000, cost: { coins: 2200, purified_heartglass: 1 }, description: 'Improves Ritualism and reduces negative outcomes when handling stored memories.', effect: { ritualSafety: 12 } },
};
