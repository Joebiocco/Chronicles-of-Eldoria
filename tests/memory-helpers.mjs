import { createEmptyAccount, createItemInstance } from '../src/state.js';
import { GameEngine } from '../src/engine.js';
import { DATA } from '../src/data.js';
import { xpForLevel } from '../src/utils.js';

export function makeMasterEngine({ seed = 12345, difficulty = 'relaxed' } = {}) {
  const account = createEmptyAccount();
  const engine = new GameEngine(account);
  engine.createCharacter(0, { name: 'Memory Tester', background: 'stonehaven_apprentice', difficulty, seed });
  const character = engine.character;
  for (const skillId of Object.keys(DATA.skills)) character.xp[skillId] = xpForLevel(99);
  character.discoveredRegions = [...Object.keys(DATA.regions)];
  for (const factionId of Object.keys(DATA.factions)) character.reputations[factionId] = 10_000;
  for (const [itemId, definition] of Object.entries(DATA.items)) {
    if (definition.stackable === false) character.bank.instances.push(createItemInstance(itemId, { quality: 'legendary' }));
    else character.bank.stacks[itemId] = 9_999;
  }
  character.dungeons.unlocked = [...Object.keys(DATA.dungeons || {})];
  character.world.unlockedDungeons = [...Object.keys(DATA.dungeons || {})];
  for (const questState of Object.values(character.quests)) if (questState.status === 'locked') questState.status = 'available';
  character.currentHp = engine.getMaxHp();
  return engine;
}

export function chooseAvailableStoryOption(engine, objective, preferredId = null) {
  const choices = preferredId
    ? [...(objective.options || []).filter((option) => option.id === preferredId), ...(objective.options || []).filter((option) => option.id !== preferredId)]
    : objective.options || [];
  for (const option of choices) {
    const requirements = [
      option.skill ? { skill: option.skill, level: option.level } : null,
      option.item ? { item: option.item } : null,
      option.reputation ? { reputation: option.reputation } : null,
      option.requiresFlag ? { flag: option.requiresFlag } : null,
      option.requiresTag ? { tag: option.requiresTag } : null,
    ].filter(Boolean);
    if (requirements.every((requirement) => engine.checkRequirement(requirement).ok)) return option.id;
  }
  throw new Error(`No available option for ${objective.id}.`);
}

export function resolveCurrentCombat(engine) {
  let guard = 0;
  while (engine.character.activity?.kind === 'combat' && guard < 120) {
    guard += 1;
    engine.character.currentHp = engine.getMaxHp();
    engine.character.activity.enemyHp = 1;
    const base = Math.max(Number(engine.character.lastProcessedAt) || 0, Date.now());
    engine.advanceTo(base + 10_000, { offline: false });
  }
  if (guard >= 120) throw new Error('Combat did not resolve within the test guard.');
}

function chooseCommandOptions(engine, questId, objective, preferredIds = []) {
  const campaign = engine.ensureQuestCampaign(questId);
  const points = Number(objective.points || campaign.availablePersonnel || 4);
  const options = [
    ...(objective.options || []).filter((option) => preferredIds.includes(option.id)),
    ...(objective.options || []).filter((option) => !preferredIds.includes(option.id)),
  ];
  const chosen = [];
  let spent = 0;
  for (const option of options) {
    const cost = Number(option.cost || 1);
    if (spent + cost > points) continue;
    const requirements = [
      option.skill ? { skill: option.skill, level: option.level } : null,
      option.item ? { item: option.item } : null,
      option.requiresFlag ? { flag: option.requiresFlag } : null,
      option.requiresTag ? { tag: option.requiresTag } : null,
    ].filter(Boolean);
    if (!requirements.every((requirement) => engine.checkRequirement(requirement).ok)) continue;
    chosen.push(option.id);
    spent += cost;
  }
  return chosen;
}

export function driveStoryToDecision(engine, questId, choices = {}) {
  const quest = DATA.quests[questId];
  if (!quest?.stages?.length) throw new Error(`${questId} is not a staged story quest.`);
  engine.character.location = quest.region;
  engine.startStoryQuest(questId);
  let guard = 0;
  while (engine.getStoryQuestState(questId).status === 'active' && guard < 120) {
    guard += 1;
    const stage = engine.getCurrentStoryStage(questId);
    if (!stage) break;
    for (const objective of stage.objectives) {
      const state = engine.getStoryQuestState(questId);
      if (state.completedObjectives[objective.id]) continue;
      const preferred = choices[objective.id];
      switch (objective.type) {
        case 'investigate': {
          const scene = DATA.investigationScenes[objective.sceneId];
          for (const evidence of scene.evidence) {
            if (engine.getStoryQuestState(questId).completedObjectives[objective.id]) break;
            engine.performStoryObjective(questId, objective.id, { evidenceId: evidence.id });
          }
          break;
        }
        case 'puzzle': {
          const correct = objective.options.find((option) => option.correct);
          engine.performStoryObjective(questId, objective.id, { optionId: correct.id });
          break;
        }
        case 'approach':
        case 'choice':
          engine.performStoryObjective(questId, objective.id, { optionId: chooseAvailableStoryOption(engine, objective, preferred) });
          break;
        case 'command': {
          const preferredIds = Array.isArray(preferred) ? preferred : preferred ? [preferred] : [];
          engine.performStoryObjective(questId, objective.id, { optionIds: chooseCommandOptions(engine, questId, objective, preferredIds) });
          break;
        }
        case 'combat':
          engine.performStoryObjective(questId, objective.id);
          resolveCurrentCombat(engine);
          break;
        default:
          engine.performStoryObjective(questId, objective.id);
      }
    }
  }
  if (guard >= 120) throw new Error(`${questId} did not reach a decision gate.`);
  return engine.getStoryQuestState(questId);
}

export function satisfyEndingRequirements(engine, requirements = []) {
  for (const requirement of requirements) {
    if (requirement.tag || requirement.requiresTag) {
      const raw = requirement.tag || requirement.requiresTag;
      const tag = (Array.isArray(raw) ? raw : String(raw).split('|'))[0];
      if (!engine.character.story.decisionTags.includes(tag)) engine.character.story.decisionTags.push(tag);
    }
    if (requirement.flag || requirement.requiresFlag) engine.character.flags[requirement.flag || requirement.requiresFlag] = true;
    if (requirement.project) engine.character.projects[requirement.project] = { complete: true, completedAt: Date.now(), contributions: {}, coins: 0 };
  }
}

export function completeStoryEnding(engine, questId, endingId) {
  const ending = DATA.quests[questId].endings.find((entry) => entry.id === endingId);
  satisfyEndingRequirements(engine, ending.requirements || []);
  const result = engine.chooseStoryEnding(questId, endingId);
  if (result.startedCombat) resolveCurrentCombat(engine);
  return engine.getStoryQuestState(questId);
}

export function driveDungeonToCompletion(engine, dungeonId) {
  const dungeon = DATA.dungeons[dungeonId];
  engine.character.location = dungeon.region;
  engine.startDungeon(dungeonId);
  let guard = 0;
  while (engine.character.dungeons.activeRun && guard < 120) {
    guard += 1;
    const run = engine.character.dungeons.activeRun;
    const node = engine.getActiveDungeonNode();
    if (run.pendingChoice || node.type === 'choice') {
      engine.chooseDungeonPath(node.next[0]);
      continue;
    }
    const result = engine.resolveDungeonNode({ answer: 'resolved' });
    if (result?.startedCombat) resolveCurrentCombat(engine);
  }
  if (guard >= 120) throw new Error(`${dungeonId} did not complete.`);
  return engine.character.dungeons.completed[dungeonId] || 0;
}
