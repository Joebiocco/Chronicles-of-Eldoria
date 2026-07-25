import { DATA } from './data.js';
import { clamp, deepClone, formatDuration, hashString, randomInt, safeUUID, seededRandom } from './utils.js';

/*
 * Runtime systems for The Memory Beneath.
 *
 * The base engine intentionally remains usable without these authored systems.
 * This installer adds staged narrative quests, regional consequences, branching
 * dungeons, husbandry, ritualism, diplomacy, planner rules, item preferences,
 * and presentation events without coupling the simulation to the UI or to a
 * future persistence provider.
 */

const STORY_TYPES = new Set(['talk', 'inspect', 'investigate', 'puzzle', 'approach', 'choice', 'command', 'skill', 'combat']);

export function installMemorySystems(GameEngine) {
  if (!GameEngine || GameEngine.prototype.__memorySystemsInstalled) return;
  const proto = GameEngine.prototype;
  Object.defineProperty(proto, '__memorySystemsInstalled', { value: true });

  const originalCombinedModifiers = proto.getCombinedModifiers;
  const originalProcessPassive = proto.processPassive;
  const originalHandleEnemyDefeat = proto.handleEnemyDefeat;
  const originalResolveCombatRound = proto.resolveCombatRound;
  const originalAdvanceTo = proto.advanceTo;
  const originalCompleteActionBatch = proto.completeActionBatch;
  const originalStartSkillAction = proto.startSkillAction;
  const originalStopActivity = proto.stopActivity;
  const originalGetAvailableActions = proto.getAvailableActions;
  const originalUseCombatAbility = proto.useCombatAbility;



  proto.getAvailableActions = function getAvailableActionsWithWorldState(skillId, regionId = this.character?.location) {
    const character = this.character;
    const base = originalGetAvailableActions.call(this, skillId, regionId);
    if (!character) return base;
    const unlocked = new Set(character.world?.unlockedActivities || []);
    const removedTags = new Set(character.world?.removedActivityTags?.[regionId] || []);
    const merged = new Map(base.map((action) => [action.id, action]));
    for (const actionId of unlocked) {
      const action = DATA.actions[actionId];
      if (action?.skill === skillId && (!action.regions?.length || action.regions.includes(regionId))) merged.set(action.id, action);
    }
    return [...merged.values()].filter((action) => !(action.tags || []).some((tag) => removedTags.has(tag)));
  };

  proto.getRegionDefinition = function getRegionDefinition(regionId = this.character?.location) {
    const base = DATA.regions[regionId];
    if (!base) return null;
    const variantId = this.character?.world?.regionVariants?.[regionId] || 'normal';
    const variant = DATA.regionVariants?.[regionId]?.[variantId];
    return { ...base, ...(variant || {}), id: regionId, baseName: base.name, variantId };
  };

  proto.getRegionVariant = function getRegionVariant(regionId = this.character?.location) {
    return this.character?.world?.regionVariants?.[regionId] || 'normal';
  };

  proto.getCombinedModifiers = function getCombinedModifiersWithMemory(regionId = this.character?.location, at = Date.now()) {
    const modifiers = originalCombinedModifiers.call(this, regionId, at);
    const character = this.character;
    if (!character) return modifiers;
    const add = (source) => {
      for (const [key, value] of Object.entries(source || {})) modifiers[key] = (modifiers[key] || 0) + Number(value || 0);
    };
    const variantId = character.world?.regionVariants?.[regionId] || 'normal';
    add(DATA.regionVariants?.[regionId]?.[variantId]?.modifiers);
    for (const active of character.ritualism?.active || []) {
      if (active.expiresAt > at && (!active.region || active.region === regionId)) add(active.effects);
    }
    for (const treaty of character.diplomacy?.treaties || []) add(DATA.diplomacyActions?.[treaty.actionId]?.effect);
    add(character.world?.productionModifiers);
    const selected = character.specializations || {};
    for (const [skillId, specializationId] of Object.entries(selected)) add(specializationModifiers(skillId, specializationId));
    return modifiers;
  };

  proto.processPassive = function processPassiveWithMemory(now, report, rng) {
    originalProcessPassive.call(this, now, report, rng);
    this.processHusbandry(now, report, rng);
    this.processRituals(now, report);
  };

  proto.advanceTo = function advanceToWithMemory(now = Date.now(), options = {}) {
    const report = originalAdvanceTo.call(this, now, options);
    if (!this.character) return report;
    this.refreshStoryQuestStates();
    this.updateSkillMilestones(report);
    this.evaluateActivityPlan(report, now);
    this.processPlannerPostActions(report);
    if (options.offline && this.character.story?.pendingDecision && report) {
      const pending = this.character.story.pendingDecision;
      const quest = DATA.quests[pending.questId];
      const message = `${quest?.name || 'A quest'} is waiting for your decision: ${pending.title || 'Choose what happens next'}.`;
      if (!report.messages.includes(message)) report.messages.push(message);
      report.changed = true;
    }
    return report;
  };

  proto.resolveCombatRound = function resolveCombatRoundWithPresentation(activity, enemy, stats, difficulty, rng, report, simNow, offline) {
    const before = {
      playerHp: this.character?.currentHp || 0,
      enemyHp: activity.enemyHp,
      killsThisSession: activity.killsThisSession || 0,
      playerStatuses: deepClone(activity.playerStatuses || []),
      enemyStatuses: deepClone(activity.enemyStatuses || []),
      round: activity.round,
      telegraph: activity.telegraph ? deepClone(activity.telegraph) : null,
    };
    originalResolveCombatRound.call(this, activity, enemy, stats, difficulty, rng, report, simNow, offline);
    if (offline || !this.character) return;
    const afterPlayerHp = this.character.currentHp;
    const afterEnemyHp = activity.enemyHp;
    const defeatedThisRound = (activity.killsThisSession || 0) > before.killsThisSession || this.character.activity !== activity;
    // Normal repeat combat resets enemy HP immediately after a kill. Preserve
    // the finishing blow for presentation rather than reporting a negative
    // damage delta from the respawned target.
    const playerDamage = Math.max(0, before.playerHp - afterPlayerHp);
    const enemyDamage = defeatedThisRound ? Math.max(1, before.enemyHp) : Math.max(0, before.enemyHp - afterEnemyHp);
    const event = {
      id: safeUUID(),
      type: 'combat:round',
      timestamp: simNow,
      round: activity.round,
      enemyId: enemy.id,
      sourceId: enemyDamage > 0 ? 'player' : enemy.id,
      targetId: enemyDamage > 0 ? enemy.id : 'player',
      enemyDamage,
      playerDamage,
      playerHealing: Math.max(0, afterPlayerHp - before.playerHp),
      result: enemyDamage > Math.max(3, stats.maxHit * 0.75) ? 'critical' : enemyDamage > 0 ? 'hit' : 'miss',
      playerResult: playerDamage > 0 ? 'hit' : 'miss',
      enemyDefeated: defeatedThisRound,
      playerDefeated: afterPlayerHp <= 0,
      abilityId: activity.queuedAbility || null,
      damageType: enemy.damageType || 'physical',
      appliedPlayerStatuses: diffStatusIds(before.playerStatuses, activity.playerStatuses || []),
      appliedEnemyStatuses: diffStatusIds(before.enemyStatuses, activity.enemyStatuses || []),
      telegraphStarted: !before.telegraph && activity.telegraph ? activity.telegraph.name : null,
      specialResolved: before.telegraph && !activity.telegraph ? before.telegraph.name : null,
    };
    this.emit('combat-fx', event);
    this.emit('audio', { cue: event.enemyDefeated ? 'victory' : enemyDamage > 0 ? 'hit' : playerDamage > 0 ? 'hurt' : 'miss' });
  };

  proto.useCombatAbility = function useCombatAbilityWithPresentation(abilityId) {
    const character = this.requireCharacter();
    const activity = character.activity;
    const beforeHp = character.currentHp;
    const beforeStatuses = deepClone(activity?.playerStatuses || []);
    const beforeTelegraph = activity?.telegraph ? deepClone(activity.telegraph) : null;
    const result = originalUseCombatAbility.call(this, abilityId);
    const ability = DATA.abilities[abilityId];
    if (activity?.kind === 'combat') {
      const healing = Math.max(0, character.currentHp - beforeHp);
      const removedStatuses = beforeStatuses.filter((status) => !(activity.playerStatuses || []).some((entry) => entry.id === status.id)).map((status) => status.id);
      const kind = abilityId === 'mend' ? 'healing'
        : abilityId === 'cleanse' ? 'cleanse'
          : abilityId === 'interrupt' ? 'interrupt'
            : ['guard', 'frost_ward'].includes(abilityId) ? 'shield'
              : 'ability';
      this.emit('combat-fx', {
        id: safeUUID(), type: `combat:${kind}`, timestamp: Date.now(), abilityId,
        sourceId: 'player', targetId: kind === 'interrupt' ? activity.enemyId : 'player',
        healing, removedStatuses, interrupted: abilityId === 'interrupt' && Boolean(beforeTelegraph),
        shielded: ['guard', 'frost_ward'].includes(abilityId),
        label: ability?.name || abilityId,
      });
      this.emit('audio', { cue: healing > 0 ? 'objective' : 'click' });
    }
    return result;
  };

  proto.handleEnemyDefeat = function handleEnemyDefeatWithStory(activity, enemy, rng, report, offline) {
    const storyContext = activity.storyContext ? deepClone(activity.storyContext) : null;
    const dungeonContext = activity.dungeonContext ? deepClone(activity.dungeonContext) : null;
    const beforeRareDrops = Number(this.character?.stats?.rareDrops) || 0;
    originalHandleEnemyDefeat.call(this, activity, enemy, rng, report, offline);
    if (!offline && (Number(this.character?.stats?.rareDrops) || 0) > beforeRareDrops) {
      this.emit('combat-fx', { id: safeUUID(), type: 'combat:rare-loot', timestamp: Date.now(), sourceId: enemy.id, targetId: 'player', enemyId: enemy.id, rareLoot: true, label: 'Rare loot' });
      this.emit('audio', { cue: 'rare' });
    }
    if (storyContext) {
      // The base engine keeps a multi-enemy encounter activity alive between
      // enemies. Do not finalize a quest objective or ending until that
      // encounter has actually completed.
      const encounterStillRunning = Boolean(activity.encounterId && this.character.activity === activity);
      if (!encounterStillRunning && storyContext.kind === 'objective') {
        this.completeStoryObjective(storyContext.questId, storyContext.objectiveId, {
          enemyId: enemy.id,
          completedAt: Date.now(),
          via: 'combat',
        }, { silent: true });
        this.character.activity = null;
      } else if (!encounterStillRunning && storyContext.kind === 'ending') {
        this.character.activity = null;
        this.finalizeStoryEnding(storyContext.questId, storyContext.endingId);
      }
    }
    if (dungeonContext) {
      this.character.activity = null;
      this.completeDungeonNode(dungeonContext.dungeonId, dungeonContext.nodeId, report);
    }
  };

  proto.completeActionBatch = function completeActionBatchWithReserves(action, requested, rng, report, activity) {
    const globalReserves = this.character?.itemPreferences?.reserved || {};
    const plan = this.character?.planner?.activePlan;
    const planReserves = plan?.conditions?.inputReserves || {};
    let allowed = requested;
    for (const [itemId, perAction] of Object.entries(action.inputs || {})) {
      const reserve = Math.max(0, Number(globalReserves[itemId]) || 0, Number(planReserves[itemId]) || 0);
      const available = Math.max(0, this.totalOwned(itemId) - reserve);
      allowed = Math.min(allowed, Math.floor(available / perAction));
    }
    if (allowed <= 0 && requested > 0) return { completed: 0, stopReason: 'Protected material reserve reached.' };
    const beforeRare = Number(this.character?.stats?.rareDrops) || 0;
    const result = originalCompleteActionBatch.call(this, action, allowed, rng, report, activity);
    if (plan && plan.actionId === action.id && (Number(this.character?.stats?.rareDrops) || 0) > beforeRare) {
      plan.rareDropTriggered = true;
      plan.rareDropAt = Date.now();
    }
    return result;
  };

  proto.startSkillAction = function startSkillActionWithPlan(actionId) {
    originalStartSkillAction.call(this, actionId);
    const plan = this.character?.planner?.activePlan;
    if (plan && plan.actionId === actionId) {
      plan.startedAt ||= Date.now();
      plan.startXp ||= this.character.xp[DATA.actions[actionId].skill] || 0;
      plan.startMastery ||= this.character.mastery.actions[actionId] || 0;
      plan.startCount ||= this.character.stats.actionCounts[actionId] || 0;
    }
  };

  proto.stopActivity = function stopActivityWithPlan(reason = 'Stopped by player.') {
    originalStopActivity.call(this, reason);
    const plan = this.character?.planner?.activePlan;
    if (plan && !plan.completedAt) {
      plan.stoppedAt = Date.now();
      plan.stopReason = reason;
      this.character.planner.history.unshift(deepClone(plan));
      this.character.planner.history = this.character.planner.history.slice(0, 30);
      this.character.planner.activePlan = null;
    }
  };

  /* ---------------------------- Story quests ---------------------------- */

  proto.isStoryQuest = function isStoryQuest(questId) {
    return Boolean(DATA.quests[questId]?.stages?.length);
  };

  proto.getStoryQuestState = function getStoryQuestState(questId) {
    const quest = DATA.quests[questId];
    const state = this.character?.quests?.[questId];
    if (!quest?.stages?.length || !state) return null;
    normalizeStoryQuestState(state, quest);
    return state;
  };

  proto.getCurrentStoryStage = function getCurrentStoryStage(questId) {
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    if (!quest || !state || state.status === 'completed') return null;
    return quest.stages[state.stageIndex] || quest.stages.find((stage) => stage.id === state.stageId) || null;
  };

  proto.checkRequirement = function checkRequirement(requirement) {
    if (!requirement) return { ok: true };
    const character = this.requireCharacter();
    if (Array.isArray(requirement)) return { ok: requirement.every((entry) => this.checkRequirement(entry).ok) };
    if (requirement.alternatives) {
      const alternatives = requirement.alternatives.map((entry) => this.checkRequirement(entry));
      return { ok: alternatives.some((entry) => entry.ok), reason: alternatives.map((entry) => entry.reason).filter(Boolean).join(' or ') };
    }
    if (requirement.type === 'discover') return { ok: character.discoveredRegions.includes(requirement.region), reason: `Discover ${DATA.regions[requirement.region]?.name || requirement.region}.` };
    if (requirement.type === 'visit') return { ok: character.location === requirement.region, reason: `Travel to ${DATA.regions[requirement.region]?.name || requirement.region}.` };
    if (requirement.skill) return { ok: this.getSkillLevel(requirement.skill) >= Number(requirement.level || 1), reason: `${DATA.skills[requirement.skill]?.name || requirement.skill} level ${requirement.level || 1} required.` };
    if (requirement.item) {
      const [itemId, count] = Array.isArray(requirement.item) ? requirement.item : [requirement.item, requirement.count || 1];
      return { ok: this.totalOwned(itemId) >= Number(count || 1), reason: `${count || 1} ${DATA.items[itemId]?.name || itemId} required.` };
    }
    if (requirement.reputation) {
      const [faction, count] = requirement.reputation;
      return { ok: (character.reputations[faction] || 0) >= count, reason: `${count} reputation with ${DATA.factions[faction]?.name || faction} required.` };
    }
    if (requirement.faction) return { ok: (character.reputations[requirement.faction] || 0) >= Number(requirement.count || requirement.level || 1), reason: 'More faction reputation is required.' };
    if (requirement.flag || requirement.requiresFlag) {
      const flag = requirement.flag || requirement.requiresFlag;
      return { ok: Boolean(character.flags[flag]), reason: `Requires ${humanize(flag)}.` };
    }
    if (requirement.tag || requirement.requiresTag) {
      const raw = requirement.tag || requirement.requiresTag;
      const groups = Array.isArray(raw) ? raw : String(raw).split('|');
      const ok = groups.some((tag) => character.story.decisionTags.includes(tag) || Boolean(character.flags[tag]));
      return { ok, reason: `Requires one of: ${groups.map(humanize).join(', ')}.` };
    }
    if (requirement.project) return { ok: Boolean(character.projects[requirement.project]?.complete), reason: `${DATA.settlementProjects[requirement.project]?.name || requirement.project} must be completed.` };
    return { ok: true };
  };

  proto.canStartStoryQuest = function canStartStoryQuest(questId) {
    const quest = DATA.quests[questId];
    const state = this.character?.quests?.[questId];
    if (!quest?.stages?.length || !state) return { ok: false, reason: 'Unknown story quest.' };
    if (!['available', 'active'].includes(state.status)) return { ok: false, reason: `Quest is ${state.status}.` };
    const failures = (quest.prerequisites || []).map((req) => this.checkRequirement(req)).filter((result) => !result.ok);
    return failures.length ? { ok: false, reason: failures[0].reason } : { ok: true };
  };

  proto.startStoryQuest = function startStoryQuest(questId) {
    const character = this.requireCharacter();
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    const check = this.canStartStoryQuest(questId);
    if (!check.ok) throw new Error(check.reason);
    if (state.status === 'active' && state.startedAt) return state;
    state.status = 'active';
    state.startedAt = Date.now();
    state.updatedAt = Date.now();
    state.stageIndex = 0;
    state.stageId = quest.stages[0].id;
    this.appendQuestJournal(questId, `Started ${quest.name}.`, quest.stages[0].journalText);
    this.addStoryRecap(questId);
    this.notify('Quest begun', quest.name, 'quest');
    this.emit('audio', { cue: 'quest' });
    this.touch('story-quest-started', { questId }, true);
    return state;
  };

  proto.getStoryObjective = function getStoryObjective(questId, objectiveId) {
    const stage = this.getCurrentStoryStage(questId);
    return stage?.objectives?.find((entry) => entry.id === objectiveId) || null;
  };

  proto.performStoryObjective = function performStoryObjective(questId, objectiveId, payload = {}) {
    const character = this.requireCharacter();
    const state = this.getStoryQuestState(questId);
    const stage = this.getCurrentStoryStage(questId);
    if (!state || state.status !== 'active' || !stage) throw new Error('That story quest is not active.');
    const objective = stage.objectives.find((entry) => entry.id === objectiveId);
    if (!objective || !STORY_TYPES.has(objective.type)) throw new Error('Unknown story objective.');
    if (state.completedObjectives[objective.id]) return { complete: true, alreadyComplete: true };

    if (objective.type === 'combat') {
      const enemy = DATA.enemies[objective.enemyId];
      if (!enemy) throw new Error('The quest encounter is unavailable.');
      character.activity = this.createCombatActivity(enemy.id, { storyContext: { kind: 'objective', questId, objectiveId } });
      this.combatLog(`Quest encounter: ${enemy.name}.`);
      this.touch('story-combat-started', { questId, objectiveId, enemyId: enemy.id }, true);
      return { startedCombat: true };
    }

    if (objective.type === 'investigate') return this.investigateStoryScene(questId, objective, payload.evidenceId);
    if (objective.type === 'puzzle') return this.solveStoryPuzzle(questId, objective, payload.optionId);
    if (['approach', 'choice'].includes(objective.type)) return this.selectStoryOption(questId, objective, payload.optionId);
    if (objective.type === 'command') return this.resolveStoryCommand(questId, objective, payload.optionIds || payload.selections || []);
    if (objective.type === 'skill') {
      const candidates = objective.alternatives || [{ skill: objective.skill, level: objective.level, item: objective.item, count: objective.count }];
      const passed = candidates.find((entry) => this.checkRequirement(entry).ok);
      if (!passed) throw new Error(candidates.map((entry) => this.checkRequirement(entry).reason).filter(Boolean).join(' or '));
      const data = { method: passed.skill || passed.item || 'prepared', completedAt: Date.now() };
      this.completeStoryObjective(questId, objectiveId, data);
      return { complete: true, data };
    }

    if (objective.type === 'inspect') {
      const data = { evidenceId: objective.evidenceId || objective.id, interpretations: this.getAvailableInterpretations(objective), completedAt: Date.now() };
      if (objective.evidenceId && !state.evidence.includes(objective.evidenceId)) state.evidence.push(objective.evidenceId);
      if (objective.reward) this.grantRewards(objective.reward);
      this.completeStoryObjective(questId, objectiveId, data);
      return { complete: true, data };
    }

    if (objective.type === 'talk') {
      const data = { npcId: objective.npcId || null, text: objective.completionText || '', completedAt: Date.now() };
      this.completeStoryObjective(questId, objectiveId, data);
      return { complete: true, data };
    }

    throw new Error('That objective cannot be resolved here.');
  };

  proto.investigateStoryScene = function investigateStoryScene(questId, objective, evidenceId) {
    const state = this.getStoryQuestState(questId);
    const scene = DATA.investigationScenes[objective.sceneId];
    if (!scene) throw new Error('Investigation scene unavailable.');
    const evidence = scene.evidence.find((entry) => entry.id === evidenceId);
    if (!evidence) throw new Error('Choose a piece of evidence to inspect.');
    const data = state.objectiveData[objective.id] || { found: [], interpretations: {} };
    if (!data.found.includes(evidence.id)) data.found.push(evidence.id);
    if (!state.evidence.includes(evidence.id)) state.evidence.push(evidence.id);
    data.interpretations[evidence.id] = this.getAvailableInterpretations(evidence);
    state.objectiveData[objective.id] = data;
    const required = Math.min(scene.evidence.length, Number(objective.evidenceRequired || scene.evidence.length));
    const complete = data.found.length >= required;
    if (complete) this.completeStoryObjective(questId, objective.id, data);
    else this.touch('story-evidence-found', { questId, objectiveId: objective.id, evidenceId }, true);
    return { complete, evidence, found: data.found.length, required, interpretations: data.interpretations[evidence.id] };
  };

  proto.getAvailableInterpretations = function getAvailableInterpretations(source) {
    const interpretations = {};
    for (const [skillId, text] of Object.entries(source.interpretations || {})) {
      const level = this.getSkillLevel(skillId);
      if (level >= 10) interpretations[skillId] = text;
    }
    for (const skillId of source.skillInsights || []) {
      if (this.getSkillLevel(skillId) >= 10) interpretations[skillId] = `${DATA.skills[skillId]?.name || skillId} reveals additional context.`;
    }
    return interpretations;
  };

  proto.solveStoryPuzzle = function solveStoryPuzzle(questId, objective, optionId) {
    const state = this.getStoryQuestState(questId);
    const option = objective.options?.find((entry) => entry.id === optionId);
    if (!option) throw new Error('Choose an answer.');
    state.attempts[objective.id] = (state.attempts[objective.id] || 0) + 1;
    if (!option.correct) {
      state.objectiveData[objective.id] = { lastOption: optionId, hint: objective.hint, attempts: state.attempts[objective.id] };
      this.touch('story-puzzle-attempt', { questId, objectiveId: objective.id, correct: false }, true);
      return { complete: false, correct: false, hint: objective.hint, attempts: state.attempts[objective.id] };
    }
    if (objective.rewardEvidence && !state.evidence.includes(objective.rewardEvidence)) state.evidence.push(objective.rewardEvidence);
    const data = { optionId, correct: true, attempts: state.attempts[objective.id], completedAt: Date.now() };
    this.completeStoryObjective(questId, objective.id, data);
    return { complete: true, correct: true, data };
  };

  proto.selectStoryOption = function selectStoryOption(questId, objective, optionId) {
    const state = this.getStoryQuestState(questId);
    const option = objective.options?.find((entry) => entry.id === optionId);
    if (!option) throw new Error('Choose a valid approach.');
    const checks = [
      option.skill ? { skill: option.skill, level: option.level } : null,
      option.item ? { item: option.item } : null,
      option.reputation ? { reputation: option.reputation } : null,
      option.requiresFlag ? { flag: option.requiresFlag } : null,
      option.requiresTag ? { tag: option.requiresTag } : null,
    ].filter(Boolean).map((entry) => this.checkRequirement(entry));
    const failed = checks.find((entry) => !entry.ok);
    if (failed) throw new Error(failed.reason);
    if (option.consumeItem && option.item) {
      const [itemId, qty] = option.item;
      this.consumeAcrossStorage({ [itemId]: qty || 1 });
    }
    this.applyStoryOptionEffects(option, questId);
    const data = { optionId, label: option.label, completedAt: Date.now() };
    state.decisions[objective.id] = optionId;
    this.completeStoryObjective(questId, objective.id, data);
    return { complete: true, option, data };
  };

  proto.resolveStoryCommand = function resolveStoryCommand(questId, objective, optionIds) {
    const state = this.getStoryQuestState(questId);
    const selectedIds = [...new Set(Array.isArray(optionIds) ? optionIds : [optionIds])].filter(Boolean);
    if (!selectedIds.length) throw new Error('Assign at least one available option.');
    const campaign = this.ensureQuestCampaign(questId);
    const points = Number(objective.points ?? objective.personnel ?? campaign.availablePersonnel ?? 4);
    let spent = 0;
    const selected = [];
    for (const id of selectedIds) {
      const option = objective.options?.find((entry) => entry.id === id);
      if (!option) throw new Error(`Unknown assignment: ${id}.`);
      const requirements = [
        option.skill ? { skill: option.skill, level: option.level } : null,
        option.item ? { item: option.item } : null,
        option.requiresFlag ? { flag: option.requiresFlag } : null,
        option.requiresTag ? { tag: option.requiresTag } : null,
      ].filter(Boolean);
      const failure = requirements.map((entry) => this.checkRequirement(entry)).find((entry) => !entry.ok);
      if (failure) throw new Error(failure.reason);
      spent += Number(option.cost || 1);
      selected.push(option);
    }
    if (spent > points) throw new Error(`Assignments cost ${spent} personnel, but only ${points} are available.`);
    for (const option of selected) this.applyStoryOptionEffects(option, questId);
    const data = { optionIds: selectedIds, spent, available: points, completedAt: Date.now() };
    state.decisions[objective.id] = selectedIds;
    this.completeStoryObjective(questId, objective.id, data);
    return { complete: true, data, campaign: deepClone(campaign) };
  };

  proto.applyStoryOptionEffects = function applyStoryOptionEffects(option, questId) {
    const character = this.requireCharacter();
    if (option.decisionTag && !character.story.decisionTags.includes(option.decisionTag)) character.story.decisionTags.push(option.decisionTag);
    for (const flag of option.flags || []) character.flags[flag] = true;
    if (option.effects) {
      const campaign = this.ensureQuestCampaign(questId);
      for (const [key, amount] of Object.entries(option.effects)) campaign[key] = Number(campaign[key] || 0) + Number(amount || 0);
      campaign.wall = clamp(campaign.wall ?? 65, 0, 100);
      campaign.morale = clamp(campaign.morale ?? 50, -100, 100);
      campaign.supplies = clamp(campaign.supplies ?? 70, -100, 200);
      campaign.refugeeTrust = clamp(campaign.refugeeTrust ?? 0, -100, 100);
      campaign.crownLoyalty = clamp(campaign.crownLoyalty ?? 0, -100, 100);
      campaign.wounded = Math.max(0, campaign.wounded || 0);
    }
  };

  proto.ensureQuestCampaign = function ensureQuestCampaign(questId) {
    const state = this.getStoryQuestState(questId);
    state.campaign ||= questId === 'memory_wall'
      ? { availablePersonnel: 4, supplies: 70, wall: 65, morale: 50, wounded: 7, refugeeTrust: 0, crownLoyalty: 10, casualties: 0 }
      : questId === 'memory_ash'
        ? { availablePersonnel: 4, evidenceRisk: 0, expeditionMorale: 50 }
        : { availablePersonnel: 4 };
    return state.campaign;
  };

  proto.completeStoryObjective = function completeStoryObjective(questId, objectiveId, data = {}, { silent = false } = {}) {
    const state = this.getStoryQuestState(questId);
    const stage = this.getCurrentStoryStage(questId);
    if (!state || !stage) return false;
    if (state.completedObjectives[objectiveId]) return false;
    state.completedObjectives[objectiveId] = true;
    state.objectiveData[objectiveId] = { ...(state.objectiveData[objectiveId] || {}), ...deepClone(data) };
    state.updatedAt = Date.now();
    const objective = stage.objectives.find((entry) => entry.id === objectiveId);
    if (objective?.reward) this.grantRewards(objective.reward);
    this.appendQuestJournal(questId, objective?.label || humanize(objectiveId), objective?.completionText || objective?.description || 'Objective completed.');
    if (!silent) {
      this.emit('audio', { cue: 'objective' });
      this.touch('story-objective-completed', { questId, objectiveId }, true);
    }
    this.advanceStoryStageIfReady(questId);
    return true;
  };

  proto.isStoryStageComplete = function isStoryStageComplete(questId) {
    const state = this.getStoryQuestState(questId);
    const stage = this.getCurrentStoryStage(questId);
    return Boolean(stage && stage.objectives.every((objective) => state.completedObjectives[objective.id]));
  };

  proto.advanceStoryStageIfReady = function advanceStoryStageIfReady(questId) {
    const character = this.requireCharacter();
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    const stage = this.getCurrentStoryStage(questId);
    if (!quest || !state || !stage || !this.isStoryStageComplete(questId)) return false;
    if (stage.decisionGate || state.stageIndex >= quest.stages.length - 1) {
      state.status = 'decision';
      state.pendingDecision = true;
      character.story.pendingDecision = {
        questId,
        stageId: stage.id,
        title: stage.title,
        endings: quest.endings.map((ending) => ending.id),
        since: Date.now(),
      };
      this.appendQuestJournal(questId, 'Decision required', 'The Chronicle pauses here until you choose an ending.');
      this.notify('Your decision is required', quest.name, 'quest');
      this.touch('story-decision-gate', { questId, stageId: stage.id }, true);
      return true;
    }
    state.stageIndex += 1;
    state.stageId = quest.stages[state.stageIndex].id;
    state.updatedAt = Date.now();
    const next = quest.stages[state.stageIndex];
    this.appendQuestJournal(questId, next.title, next.journalText || next.scene || 'A new stage has begun.');
    this.addStoryRecap(questId);
    this.notify('Quest stage advanced', `${quest.name}: ${next.title}`, 'quest');
    this.touch('story-stage-advanced', { questId, stageId: next.id, stageIndex: state.stageIndex }, true);
    return true;
  };

  proto.getEndingAvailability = function getEndingAvailability(questId, endingId) {
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    const ending = quest?.endings?.find((entry) => entry.id === endingId);
    if (!ending || !state || !['decision', 'active'].includes(state.status)) return { ok: false, reason: 'Ending unavailable.' };
    const failures = (ending.requirements || []).map((entry) => this.checkRequirement(entry)).filter((entry) => !entry.ok);
    return failures.length ? { ok: false, reason: failures[0].reason, ending } : { ok: true, ending };
  };

  proto.chooseStoryEnding = function chooseStoryEnding(questId, endingId) {
    const character = this.requireCharacter();
    const availability = this.getEndingAvailability(questId, endingId);
    if (!availability.ok) throw new Error(availability.reason);
    const ending = availability.ending;
    if (ending.encounter) {
      const encounter = DATA.encounters[ending.encounter];
      const enemy = DATA.enemies[ending.encounter];
      if (encounter) {
        const first = encounter.sequence[0];
        character.activity = this.createCombatActivity(first, { encounterId: ending.encounter, encounterIndex: 0, storyContext: { kind: 'ending', questId, endingId } });
      } else if (enemy) character.activity = this.createCombatActivity(enemy.id, { storyContext: { kind: 'ending', questId, endingId } });
      else throw new Error('The ending encounter is unavailable.');
      this.touch('story-ending-combat-started', { questId, endingId }, true);
      return { startedCombat: true };
    }
    return this.finalizeStoryEnding(questId, endingId);
  };

  proto.finalizeStoryEnding = function finalizeStoryEnding(questId, endingId) {
    const character = this.requireCharacter();
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    const ending = quest?.endings?.find((entry) => entry.id === endingId);
    if (!quest || !state || !ending) throw new Error('Unknown quest ending.');
    if (state.status === 'completed') return { completed: true, alreadyComplete: true, ending: state.ending };
    for (const tag of ending.decisionTags || []) if (!character.story.decisionTags.includes(tag)) character.story.decisionTags.push(tag);
    this.grantRewards(ending.rewards || {});
    for (const change of ending.worldChanges || []) this.applyWorldChange(change, `${questId}:${endingId}`);
    state.status = 'completed';
    state.ending = endingId;
    state.choice = endingId;
    state.pendingDecision = false;
    state.claimedAt = Date.now();
    state.updatedAt = Date.now();
    character.story.pendingDecision = null;
    character.stats.questsCompleted += 1;
    character.story.consequences.unshift({ id: `${questId}:${endingId}`, questId, endingId, title: ending.title, text: ending.epilogue, at: Date.now() });
    character.story.consequences = character.story.consequences.slice(0, 60);
    this.appendQuestJournal(questId, ending.title, ending.epilogue);
    this.addStoryRecap(questId);
    this.notify('Quest complete', `${quest.name} — ${ending.title}`, 'quest');
    this.emit('audio', { cue: 'quest-complete' });
    this.touch('story-quest-completed', { questId, endingId }, true);
    return { completed: true, ending: endingId, worldChanges: ending.worldChanges || [] };
  };

  proto.applyWorldChange = function applyWorldChange(change, sourceId = 'unknown') {
    const character = this.requireCharacter();
    const world = character.world;
    world.appliedChanges ||= [];
    const changeId = `${sourceId}:${hashString(JSON.stringify(change))}`;
    if (world.appliedChanges.includes(changeId)) return false;
    switch (change.type) {
      case 'regionVariant': world.regionVariants[change.region] = change.variant; break;
      case 'unlockProject':
        if (!world.unlockedProjects.includes(change.project)) world.unlockedProjects.push(change.project);
        character.projects[change.project] ||= { contributions: {}, coins: 0, complete: false, completedAt: null };
        break;
      case 'unlockActivity': if (!world.unlockedActivities.includes(change.action)) world.unlockedActivities.push(change.action); break;
      case 'unlockDungeon':
        if (!world.unlockedDungeons.includes(change.dungeon)) world.unlockedDungeons.push(change.dungeon);
        if (!character.dungeons.unlocked.includes(change.dungeon)) character.dungeons.unlocked.push(change.dungeon);
        break;
      case 'npcState': world.npcStates[change.npc] = change.state; break;
      case 'addService':
        world.addedServices[change.region] ||= [];
        if (!world.addedServices[change.region].includes(change.service)) world.addedServices[change.region].push(change.service);
        break;
      case 'unlockRoute': if (!world.unlockedRoutes.includes(change.route)) world.unlockedRoutes.push(change.route); break;
      case 'removeActivitiesByTag':
        world.removedActivityTags[change.region] ||= [];
        if (!world.removedActivityTags[change.region].includes(change.tag)) world.removedActivityTags[change.region].push(change.tag);
        break;
      case 'worldPressure': world.worldPressure[change.key] = Number(world.worldPressure[change.key] || 0) + Number(change.amount || 0); break;
      case 'replaceFaction': world.factionOverrides[change.region] = change.faction; break;
      case 'productionModifier': world.productionModifiers[change.key] = Number(world.productionModifiers[change.key] || 0) + Number(change.amount || 0); break;
      default: return false;
    }
    world.appliedChanges.push(changeId);
    return true;
  };

  proto.appendQuestJournal = function appendQuestJournal(questId, title, text) {
    const character = this.requireCharacter();
    const state = this.getStoryQuestState(questId);
    const entry = { id: safeUUID(), at: Date.now(), title, text };
    state.journal.unshift(entry);
    state.journal = state.journal.slice(0, 100);
    character.story.journal.unshift({ ...entry, questId });
    character.story.journal = character.story.journal.slice(0, 200);
  };

  proto.addStoryRecap = function addStoryRecap(questId) {
    const character = this.requireCharacter();
    const quest = DATA.quests[questId];
    const state = this.getStoryQuestState(questId);
    if (!quest || !state) return;
    const stage = this.getCurrentStoryStage(questId);
    const decisions = Object.entries(state.decisions).map(([id, value]) => `${humanize(id)}: ${Array.isArray(value) ? value.map(humanize).join(', ') : humanize(value)}`);
    const recap = {
      id: safeUUID(), questId, at: Date.now(),
      title: `Previously in ${quest.name}`,
      text: [stage?.journalText, decisions.length ? `Decisions: ${decisions.join('; ')}.` : ''].filter(Boolean).join(' '),
    };
    character.story.recaps.unshift(recap);
    character.story.recaps = character.story.recaps.slice(0, 40);
  };

  proto.refreshStoryQuestStates = function refreshStoryQuestStates() {
    const character = this.character;
    if (!character) return;
    for (const [questId, quest] of Object.entries(DATA.quests)) {
      if (!quest.stages?.length) continue;
      const state = this.getStoryQuestState(questId);
      if (state.status === 'locked' && (quest.prerequisites || []).every((req) => this.checkRequirement(req).ok)) state.status = 'available';
      if (state.status === 'active') this.advanceStoryStageIfReady(questId);
    }
  };

  /* ----------------------------- Dungeons ------------------------------ */

  proto.isDungeonUnlocked = function isDungeonUnlocked(dungeonId) {
    const dungeon = DATA.dungeons[dungeonId];
    if (!dungeon) return false;
    if (!dungeon.locked) return true;
    return this.character?.dungeons?.unlocked?.includes(dungeonId) || this.character?.world?.unlockedDungeons?.includes(dungeonId);
  };

  proto.startDungeon = function startDungeon(dungeonId) {
    const character = this.requireCharacter();
    const dungeon = DATA.dungeons[dungeonId];
    if (!dungeon) throw new Error('Unknown dungeon.');
    if (!this.isDungeonUnlocked(dungeonId)) throw new Error('That dungeon has not been unlocked.');
    if (character.location !== dungeon.region) throw new Error(`Travel to ${this.getRegionDefinition(dungeon.region)?.name || dungeon.region} first.`);
    if (character.dungeons.activeRun) throw new Error('A dungeon run is already active.');
    for (const [itemId, qty] of Object.entries(dungeon.entryCost || {})) if (this.totalOwned(itemId) < qty) throw new Error(`${qty} ${DATA.items[itemId]?.name || itemId} required.`);
    this.consumeAcrossStorage(dungeon.entryCost || {});
    const first = dungeon.nodes[0];
    character.dungeons.activeRun = {
      id: safeUUID(), dungeonId, nodeId: first.id, history: [], rewards: {}, startedAt: Date.now(), supplies: deepClone(dungeon.entryCost || {}), status: 'active', pendingChoice: first.type === 'choice',
    };
    this.touch('dungeon-started', { dungeonId }, true);
    return character.dungeons.activeRun;
  };

  proto.getActiveDungeonNode = function getActiveDungeonNode() {
    const run = this.character?.dungeons?.activeRun;
    if (!run) return null;
    return DATA.dungeons[run.dungeonId]?.nodes?.find((node) => node.id === run.nodeId) || null;
  };

  proto.chooseDungeonPath = function chooseDungeonPath(nextNodeId) {
    const run = this.character?.dungeons?.activeRun;
    const node = this.getActiveDungeonNode();
    if (!run || !node || !node.next?.includes(nextNodeId)) throw new Error('That route is not available.');
    run.history.push({ nodeId: node.id, outcome: 'chosen', nextNodeId, at: Date.now() });
    run.nodeId = nextNodeId;
    run.pendingChoice = false;
    this.touch('dungeon-path-chosen', { dungeonId: run.dungeonId, nodeId: nextNodeId }, true);
    return this.resolveDungeonNode();
  };

  proto.resolveDungeonNode = function resolveDungeonNode(payload = {}) {
    const character = this.requireCharacter();
    const run = character.dungeons.activeRun;
    const node = this.getActiveDungeonNode();
    if (!run || !node) throw new Error('No dungeon node is active.');
    if (node.type === 'choice') {
      run.pendingChoice = true;
      return { pendingChoice: true, choices: node.next };
    }
    if (['combat', 'boss'].includes(node.type)) {
      character.activity = this.createCombatActivity(node.enemy, { dungeonContext: { dungeonId: run.dungeonId, nodeId: node.id } });
      this.touch('dungeon-combat-started', { dungeonId: run.dungeonId, nodeId: node.id, enemyId: node.enemy }, true);
      return { startedCombat: true };
    }
    if (node.type === 'skill') {
      if (this.getSkillLevel(node.skill) < node.level) throw new Error(`${DATA.skills[node.skill]?.name || node.skill} level ${node.level} required.`);
    } else if (node.type === 'hazard' && node.mitigation) {
      const check = this.checkRequirement(node.mitigation);
      if (!check.ok) {
        const damage = Math.max(5, Math.round(this.getMaxHp() * 0.18));
        character.currentHp = Math.max(1, character.currentHp - damage);
        run.history.push({ nodeId: node.id, outcome: 'hazard-unmitigated', damage, at: Date.now() });
      }
    } else if (node.type === 'puzzle') {
      const answer = payload.answer || payload.optionId;
      if (!answer) return { pendingPuzzle: true, puzzle: node.puzzle };
      run.history.push({ nodeId: node.id, outcome: 'puzzle-solved', answer, at: Date.now() });
    } else if (node.type === 'lore' && node.lore) {
      if (!character.collections.lore.includes(node.lore)) character.collections.lore.push(node.lore);
      if (!character.dungeons.discoveries.includes(node.lore)) character.dungeons.discoveries.push(node.lore);
    }
    return this.completeDungeonNode(run.dungeonId, node.id);
  };

  proto.completeDungeonNode = function completeDungeonNode(dungeonId, nodeId, report = null) {
    const character = this.requireCharacter();
    const run = character.dungeons.activeRun;
    const dungeon = DATA.dungeons[dungeonId];
    const node = dungeon?.nodes?.find((entry) => entry.id === nodeId);
    if (!run || run.dungeonId !== dungeonId || !node) return false;
    if (!run.history.some((entry) => entry.nodeId === nodeId && entry.outcome === 'complete')) {
      this.grantRewards(node.reward || {}, report);
      run.history.push({ nodeId, outcome: 'complete', at: Date.now() });
    }
    if (!node.next?.length) return this.finishDungeon(dungeonId, report);
    if (node.next.length === 1) {
      run.nodeId = node.next[0];
      run.pendingChoice = false;
      this.touch('dungeon-node-completed', { dungeonId, nodeId, nextNodeId: run.nodeId }, true);
      return { complete: true, nextNodeId: run.nodeId };
    }
    run.pendingChoice = true;
    this.touch('dungeon-node-completed', { dungeonId, nodeId, choices: node.next }, true);
    return { complete: true, pendingChoice: true, choices: node.next };
  };

  proto.finishDungeon = function finishDungeon(dungeonId, report = null) {
    const character = this.requireCharacter();
    const run = character.dungeons.activeRun;
    if (!run || run.dungeonId !== dungeonId) return false;
    character.dungeons.completed[dungeonId] = (character.dungeons.completed[dungeonId] || 0) + 1;
    character.dungeons.history.unshift({ ...deepClone(run), status: 'completed', completedAt: Date.now() });
    character.dungeons.history = character.dungeons.history.slice(0, 30);
    character.dungeons.activeRun = null;
    this.notify('Dungeon complete', DATA.dungeons[dungeonId]?.name || dungeonId, 'combat');
    this.emit('audio', { cue: 'victory' });
    this.touch('dungeon-completed', { dungeonId }, true);
    if (report) report.messages.push(`Completed ${DATA.dungeons[dungeonId]?.name || dungeonId}.`);
    return true;
  };

  proto.abandonDungeon = function abandonDungeon() {
    const character = this.requireCharacter();
    const run = character.dungeons.activeRun;
    if (!run) return;
    character.dungeons.history.unshift({ ...deepClone(run), status: 'abandoned', abandonedAt: Date.now() });
    character.dungeons.history = character.dungeons.history.slice(0, 30);
    character.dungeons.activeRun = null;
    if (character.activity?.dungeonContext) character.activity = null;
    this.touch('dungeon-abandoned', { dungeonId: run.dungeonId }, true);
  };

  /* ---------------------------- Husbandry ----------------------------- */

  proto.processHusbandry = function processHusbandry(now, report, rng) {
    const husbandry = this.character?.husbandry;
    if (!husbandry) return;
    const elapsed = Math.max(0, now - (husbandry.lastProcessedAt || now));
    if (!elapsed) return;
    for (const pen of husbandry.pens) {
      const species = DATA.animals[pen.speciesId];
      if (!species || pen.count <= 0) continue;
      const hours = elapsed / 3600000;
      const feedNeeded = species.feedPerHour * pen.count * hours;
      const feedUsed = Math.min(pen.feed || 0, feedNeeded);
      pen.feed = Math.max(0, (pen.feed || 0) - feedUsed);
      const fedRatio = feedNeeded > 0 ? feedUsed / feedNeeded : 1;
      pen.health = clamp((pen.health || 100) + (fedRatio >= 0.95 ? hours * 0.5 : -hours * 3), 10, 100);
      pen.happiness = clamp((pen.happiness || 70) + (fedRatio >= 0.95 ? hours * 0.35 : -hours * 2), 0, 100);
      const cycles = Math.floor((now - (pen.lastProducedAt || husbandry.lastProcessedAt)) / species.cycleMs);
      if (cycles > 0 && fedRatio > 0.45) {
        const min = species.product.min * pen.count * cycles;
        const max = species.product.max * pen.count * cycles;
        const qty = Math.max(0, randomInt(rng, min, Math.max(min, max)));
        pen.pendingProducts ||= {};
        pen.pendingProducts[species.product.item] = (pen.pendingProducts[species.product.item] || 0) + qty;
        pen.lastProducedAt += cycles * species.cycleMs;
        if (qty) {
          report.messages.push(`${species.name} produced ${qty} ${DATA.items[species.product.item]?.name || species.product.item}.`);
          report.changed = true;
        }
      }
    }
    if (husbandry.breeding?.endsAt <= now) {
      const pen = husbandry.pens.find((entry) => entry.id === husbandry.breeding.penId);
      if (pen) {
        pen.count += husbandry.breeding.births || 1;
        const species = DATA.animals[pen.speciesId];
        if (species?.traits?.length) {
          const trait = species.traits[Math.floor(rng() * species.traits.length)];
          if (trait && !pen.traits.includes(trait)) pen.traits.push(trait);
        }
        husbandry.births += husbandry.breeding.births || 1;
        report.messages.push(`${species?.name || 'Animals'} completed a breeding cycle.`);
        report.changed = true;
      }
      husbandry.breeding = null;
    }
    husbandry.lastProcessedAt = now;
  };

  proto.stockAnimalPen = function stockAnimalPen(penId, speciesId, count = 1) {
    const character = this.requireCharacter();
    const pen = character.husbandry.pens.find((entry) => entry.id === penId);
    const species = DATA.animals[speciesId];
    if (!pen || !species) throw new Error('Unknown pen or animal species.');
    if (this.getSkillLevel('animal_husbandry') < species.level) throw new Error(`Animal Husbandry level ${species.level} required.`);
    if (pen.speciesId && pen.speciesId !== speciesId && pen.count > 0) throw new Error('Empty the pen before changing species.');
    pen.speciesId = speciesId;
    pen.count += Math.max(1, Math.floor(count));
    pen.lastProducedAt = Date.now();
    this.touch('husbandry-stocked', { penId, speciesId, count }, true);
  };

  proto.feedAnimalPen = function feedAnimalPen(penId, qty = 10) {
    const pen = this.character?.husbandry?.pens?.find((entry) => entry.id === penId);
    qty = Math.max(1, Math.floor(qty));
    if (!pen) throw new Error('Unknown animal pen.');
    if (this.totalOwned('animal_feed') < qty) throw new Error(`${qty} Animal Feed required.`);
    this.consumeAcrossStorage({ animal_feed: qty });
    pen.feed += qty;
    this.addXp('animal_husbandry', qty * 2.5);
    this.touch('husbandry-fed', { penId, qty }, true);
  };

  proto.collectAnimalProducts = function collectAnimalProducts(penId) {
    const pen = this.character?.husbandry?.pens?.find((entry) => entry.id === penId);
    if (!pen) throw new Error('Unknown animal pen.');
    const products = { ...(pen.pendingProducts || {}) };
    let collected = 0;
    for (const [itemId, qty] of Object.entries(products)) {
      const result = this.addItem(itemId, qty, { allowBankFallback: true });
      if (result.added) collected += result.added;
    }
    pen.pendingProducts = {};
    this.character.husbandry.productsCollected += collected;
    this.addXp('animal_husbandry', Math.max(1, collected * 4));
    this.touch('husbandry-collected', { penId, products, collected }, true);
    return products;
  };

  proto.startAnimalBreeding = function startAnimalBreeding(penId) {
    const character = this.requireCharacter();
    const pen = character.husbandry.pens.find((entry) => entry.id === penId);
    if (!pen?.speciesId || pen.count < 2) throw new Error('A pen needs at least two animals to breed.');
    if (character.husbandry.breeding) throw new Error('A breeding cycle is already active.');
    const duration = Math.max(30 * 60000, 4 * 3600000 * (1 - this.getSkillLevel('animal_husbandry') / 180));
    character.husbandry.breeding = { penId, speciesId: pen.speciesId, births: 1, startedAt: Date.now(), endsAt: Date.now() + duration };
    this.touch('husbandry-breeding-started', { penId, endsAt: character.husbandry.breeding.endsAt }, true);
  };

  /* ----------------------------- Rituals ------------------------------ */

  proto.processRituals = function processRituals(now, report) {
    const character = this.character;
    const expired = (character.ritualism.active || []).filter((entry) => entry.expiresAt <= now);
    if (expired.length) {
      character.ritualism.active = character.ritualism.active.filter((entry) => entry.expiresAt > now);
      for (const entry of expired) report.messages.push(`${DATA.rituals[entry.ritualId]?.name || entry.ritualId} ended.`);
      report.changed = true;
    }
  };

  proto.performRitual = function performRitual(ritualId) {
    const character = this.requireCharacter();
    const ritual = DATA.rituals[ritualId];
    if (!ritual) throw new Error('Unknown ritual.');
    if (character.location !== ritual.region) throw new Error(`Travel to ${this.getRegionDefinition(ritual.region)?.name || ritual.region}.`);
    if (this.getSkillLevel('ritualism') < ritual.level) throw new Error(`Ritualism level ${ritual.level} required.`);
    for (const [itemId, qty] of Object.entries(ritual.cost || {})) if (this.totalOwned(itemId) < qty) throw new Error(`${qty} ${DATA.items[itemId]?.name || itemId} required.`);
    this.consumeAcrossStorage(ritual.cost || {});
    character.ritualism.active = character.ritualism.active.filter((entry) => entry.ritualId !== ritualId);
    const entry = { id: safeUUID(), ritualId, region: ritual.region, startedAt: Date.now(), expiresAt: Date.now() + ritual.durationMs, effects: deepClone(ritual.effects || {}) };
    character.ritualism.active.push(entry);
    character.ritualism.completed[ritualId] = (character.ritualism.completed[ritualId] || 0) + 1;
    character.ritualism.history.unshift(entry);
    character.ritualism.history = character.ritualism.history.slice(0, 30);
    this.addXp('ritualism', ritual.level * 12 + ritual.durationMs / 60000);
    this.touch('ritual-performed', { ritualId, expiresAt: entry.expiresAt }, true);
    return entry;
  };

  /* ---------------------------- Diplomacy ----------------------------- */

  proto.performDiplomacyAction = function performDiplomacyAction(actionId) {
    const character = this.requireCharacter();
    const action = DATA.diplomacyActions[actionId];
    if (!action) throw new Error('Unknown diplomatic action.');
    if (this.getSkillLevel('diplomacy') < action.level) throw new Error(`Diplomacy level ${action.level} required.`);
    if (character.diplomacy.treaties.some((entry) => entry.actionId === actionId)) throw new Error('This treaty is already active.');
    for (const [itemId, qty] of Object.entries(action.cost || {})) if (this.totalOwned(itemId) < qty) throw new Error(`${qty} ${DATA.items[itemId]?.name || itemId} required.`);
    this.consumeAcrossStorage(action.cost || {});
    for (const [factionId, amount] of Object.entries(action.reputation || {})) character.reputations[factionId] = (character.reputations[factionId] || 0) + amount;
    const treaty = { id: safeUUID(), actionId, signedAt: Date.now() };
    character.diplomacy.treaties.push(treaty);
    character.diplomacy.disputesResolved += 1;
    character.diplomacy.leverage = Math.max(0, character.diplomacy.leverage - Number(action.leverageCost || 0));
    character.diplomacy.history.unshift(treaty);
    character.diplomacy.history = character.diplomacy.history.slice(0, 30);
    this.addXp('diplomacy', action.level * 15 + 100);
    this.touch('diplomacy-action-completed', { actionId }, true);
    return treaty;
  };

  /* -------------------- Specializations and milestones -------------------- */

  proto.selectSpecialization = function selectSpecialization(skillId, specializationId) {
    const character = this.requireCharacter();
    const spec = DATA.specializations?.[skillId]?.find((entry) => entry.id === specializationId);
    if (!spec) throw new Error('Unknown specialization.');
    if (this.getSkillLevel(skillId) < spec.level) throw new Error(`${DATA.skills[skillId]?.name || skillId} level ${spec.level} required.`);
    if (character.specializations[skillId] && character.specializations[skillId] !== specializationId) throw new Error('This skill already has a specialization.');
    character.specializations[skillId] = specializationId;
    this.touch('specialization-selected', { skillId, specializationId }, true);
  };

  proto.updateSkillMilestones = function updateSkillMilestones(report = null) {
    const character = this.character;
    if (!character) return;
    for (const [skillId, milestones] of Object.entries(DATA.skillMilestones || {})) {
      character.skillMilestones[skillId] ||= [];
      const level = this.getSkillLevel(skillId);
      for (const milestone of milestones) {
        if (level < milestone.level || character.skillMilestones[skillId].includes(milestone.id)) continue;
        character.skillMilestones[skillId].push(milestone.id);
        if (milestone.reward) this.grantRewards(milestone.reward, report);
        this.notify(`${DATA.skills[skillId]?.name || skillId} milestone`, milestone.name || `Level ${milestone.level}`, 'level');
        if (report) report.changed = true;
      }
    }
  };

  /* ---------------------- Item preference controls ---------------------- */

  proto.toggleItemFavorite = function toggleItemFavorite(itemId) {
    const prefs = this.requireCharacter().itemPreferences;
    const index = prefs.favorites.indexOf(itemId);
    if (index >= 0) prefs.favorites.splice(index, 1); else prefs.favorites.push(itemId);
    this.touch('item-favorite-changed', { itemId, favorite: index < 0 }, true);
  };

  proto.setItemReserve = function setItemReserve(itemId, qty) {
    const prefs = this.requireCharacter().itemPreferences;
    const amount = Math.max(0, Math.floor(Number(qty) || 0));
    if (amount) prefs.reserved[itemId] = amount; else delete prefs.reserved[itemId];
    this.touch('item-reserve-changed', { itemId, qty: amount }, true);
  };

  proto.setItemNote = function setItemNote(itemId, note) {
    const prefs = this.requireCharacter().itemPreferences;
    const clean = String(note || '').trim().slice(0, 500);
    if (clean) prefs.notes[itemId] = clean; else delete prefs.notes[itemId];
    this.touch('item-note-changed', { itemId }, true);
  };

  proto.toggleProtectedStack = function toggleProtectedStack(itemId) {
    const prefs = this.requireCharacter().itemPreferences;
    const index = prefs.protectedStacks.indexOf(itemId);
    if (index >= 0) prefs.protectedStacks.splice(index, 1); else prefs.protectedStacks.push(itemId);
    this.touch('item-protection-changed', { itemId, protected: index < 0 }, true);
  };

  /* --------------------------- Activity planner -------------------------- */

  proto.estimateActivityPlan = function estimateActivityPlan(actionId, conditions = {}) {
    const action = DATA.actions[actionId];
    if (!action) throw new Error('Unknown skill action.');
    const durationMs = this.getActionDuration(action);
    const requestedCount = Number(conditions.actionCount || conditions.count || 0);
    const durationCount = conditions.durationMs ? Math.max(1, Math.floor(Number(conditions.durationMs) / durationMs)) : 0;
    const count = Math.max(1, Math.floor(requestedCount || durationCount || 100));
    const yieldMultiplier = 1 + (this.getYieldChance(action.skill, actionId) || 0);
    const outputs = {};
    for (const [itemId, qty] of Object.entries(action.outputs || {})) outputs[itemId] = Math.max(0, Math.round(qty * count * yieldMultiplier));
    const inputs = {};
    for (const [itemId, qty] of Object.entries(action.inputs || {})) inputs[itemId] = qty * count;
    const xp = action.xp * count;
    const duration = durationMs * count;
    const likelyStops = [];
    for (const [itemId, needed] of Object.entries(inputs)) {
      const reserve = Math.max(Number(this.character.itemPreferences.reserved[itemId]) || 0, Number(conditions.inputReserves?.[itemId]) || 0);
      const usable = Math.max(0, this.totalOwned(itemId) - reserve);
      if (usable < needed) likelyStops.push(`${DATA.items[itemId]?.name || itemId} reserve reached after about ${Math.floor(usable / (action.inputs[itemId] || 1))} actions`);
    }
    if (conditions.freeSlots && this.getInventoryCapacity() - this.getContainerSlots(this.character.inventory) < Number(conditions.freeSlots)) likelyStops.push('Inventory free-slot reserve is already reached');
    return {
      actionId, count, durationMs: duration, durationText: formatDuration(duration), xp, outputs, inputs,
      likelyStop: likelyStops[0] || (conditions.stopOnRareDrop ? 'First rare drop or another configured condition' : 'Configured target reached'),
      xpPerHour: Math.round(action.xp * 3600000 / durationMs),
      actionsPerHour: Math.floor(3600000 / durationMs),
    };
  };

  proto.startActivityPlan = function startActivityPlan(actionId, conditions = {}, nextPlan = null) {
    const character = this.requireCharacter();
    const normalizedConditions = deepClone(conditions || {});
    const estimate = this.estimateActivityPlan(actionId, normalizedConditions);
    const action = DATA.actions[actionId];
    const plan = {
      id: safeUUID(), actionId, conditions: normalizedConditions, estimate, nextPlan: nextPlan ? deepClone(nextPlan) : null,
      createdAt: Date.now(), startedAt: Date.now(), startXp: character.xp[action.skill] || 0,
      startMastery: character.mastery.actions[actionId] || 0, startCount: character.stats.actionCounts[actionId] || 0,
      startItemCount: normalizedConditions.stopOnItem ? this.totalOwned(normalizedConditions.stopOnItem) : 0,
      startRareDrops: Number(character.stats.rareDrops) || 0,
      startOutputCounts: Object.fromEntries(Object.keys(action.outputs || {}).map((itemId) => [itemId, this.stackQty(itemId, 'inventory')])),
      rareDropTriggered: false,
    };
    character.planner.activePlan = plan;
    const count = Number(normalizedConditions.actionCount || normalizedConditions.count || 0);
    this.startSkillAction(actionId);
    if (count && character.activity?.kind === 'skill') character.activity.stopAfter = Math.max(1, Math.floor(count));
    this.touch('activity-plan-started', { planId: plan.id, actionId }, true);
    return plan;
  };

  proto.evaluateActivityPlan = function evaluateActivityPlan(report = null, at = Date.now()) {
    const character = this.character;
    const plan = character?.planner?.activePlan;
    if (!plan) return;
    const action = DATA.actions[plan.actionId];
    const activity = character.activity;
    const conditions = plan.conditions || {};
    let stopReason = null;
    if (conditions.durationMs && at - plan.startedAt >= Number(conditions.durationMs)) stopReason = 'Planned duration reached.';
    if (conditions.actionCount && (character.stats.actionCounts[action.id] || 0) - plan.startCount >= Number(conditions.actionCount)) stopReason = 'Planned action count reached.';
    if (conditions.targetSkillLevel && this.getSkillLevel(action.skill) >= Number(conditions.targetSkillLevel)) stopReason = `Reached ${DATA.skills[action.skill].name} level ${conditions.targetSkillLevel}.`;
    if (conditions.targetMastery && this.getActionMastery(action.id) >= Number(conditions.targetMastery)) stopReason = `Reached mastery ${conditions.targetMastery}.`;
    if (conditions.freeSlots && this.getInventoryCapacity() - this.getContainerSlots(character.inventory) < Number(conditions.freeSlots)) stopReason = 'Inventory free-slot reserve reached.';
    for (const [itemId, reserve] of Object.entries(conditions.inputReserves || {})) if (this.totalOwned(itemId) <= Number(reserve)) stopReason ||= `${DATA.items[itemId]?.name || itemId} input reserve reached.`;
    if (conditions.stopOnItem && this.totalOwned(conditions.stopOnItem) > Number(plan.startItemCount || 0)) stopReason = `${DATA.items[conditions.stopOnItem]?.name || conditions.stopOnItem} obtained.`;
    if (conditions.stopOnRareDrop && (plan.rareDropTriggered || (Number(character.stats.rareDrops) || 0) > plan.startRareDrops)) stopReason = 'A rare drop was obtained.';
    if (conditions.foodReserve && this.totalFoodCount() <= Number(conditions.foodReserve)) stopReason = 'Food reserve reached.';
    if (!activity || activity.actionId !== plan.actionId) stopReason ||= activity ? 'Activity changed.' : 'Activity ended.';
    if (!stopReason) return;

    plan.completedAt = at;
    plan.stopReason = stopReason;
    plan.outputGains = Object.fromEntries(Object.keys(action.outputs || {}).map((itemId) => [itemId, Math.max(0, this.stackQty(itemId, 'inventory') - Number(plan.startOutputCounts?.[itemId] || 0))]));
    character.planner.history.unshift(deepClone(plan));
    character.planner.history = character.planner.history.slice(0, 30);
    character.planner.activePlan = null;
    if (activity?.actionId === plan.actionId) character.activity = null;
    if (report) { report.messages.push(`${action.name} plan stopped: ${stopReason}`); report.changed = true; }

    const post = {
      planId: plan.id,
      outputGains: plan.outputGains,
      depositOutputs: Boolean(conditions.depositOutputs),
      returnToTown: Boolean(conditions.returnToTown),
      returnRegion: conditions.returnRegion || null,
      nextPlan: plan.nextPlan ? deepClone(plan.nextPlan) : null,
      createdAt: at,
    };
    if (post.depositOutputs || post.returnToTown || post.nextPlan) character.planner.pendingPostActions = post;
    this.processPlannerPostActions(report);
  };

  proto.getPlannerReturnRegion = function getPlannerReturnRegion(preferred = null) {
    const character = this.requireCharacter();
    const hasBank = (regionId) => {
      const services = [...(DATA.regions[regionId]?.services || []), ...(character.world?.addedServices?.[regionId] || [])];
      return services.includes('bank');
    };
    if (preferred && DATA.regions[preferred] && character.discoveredRegions.includes(preferred) && hasBank(preferred)) return preferred;
    const candidates = character.discoveredRegions.filter((id) => hasBank(id));
    let best = character.location;
    let bestSeconds = Number.POSITIVE_INFINITY;
    for (const id of candidates) {
      if (id === character.location) return id;
      const route = this.getTravelPlan(id);
      if (route && route.seconds < bestSeconds) { best = id; bestSeconds = route.seconds; }
    }
    return best;
  };

  proto.depositPlannerOutputs = function depositPlannerOutputs(post, report = null) {
    const character = this.requireCharacter();
    let moved = 0;
    for (const [itemId, plannedQty] of Object.entries(post.outputGains || {})) {
      const qty = Math.max(0, Math.min(Number(plannedQty) || 0, this.stackQty(itemId, 'inventory')));
      if (!qty || !this.canFit('bank', {}, { [itemId]: qty }, 0)) continue;
      this.removeStack(itemId, qty, 'inventory');
      character.bank.stacks[itemId] = (character.bank.stacks[itemId] || 0) + qty;
      moved += qty;
    }
    post.depositOutputs = false;
    post.deposited = moved;
    if (moved && report) { report.messages.push(`Deposited ${moved} planned output item${moved === 1 ? '' : 's'} in the bank.`); report.changed = true; }
    return moved;
  };

  proto.processPlannerPostActions = function processPlannerPostActions(report = null) {
    const character = this.character;
    const post = character?.planner?.pendingPostActions;
    if (!post) return false;
    const destination = post.returnToTown ? this.getPlannerReturnRegion(post.returnRegion) : character.location;
    if (post.returnToTown && character.location !== destination) {
      if (!character.activity) {
        try { this.startTravel(destination); post.returnRegion = destination; }
        catch (error) { post.returnToTown = false; this.log(`Could not return after the activity plan: ${error.message}`); }
      }
      return false;
    }
    post.returnToTown = false;
    const services = [...(DATA.regions[character.location]?.services || []), ...(character.world?.addedServices?.[character.location] || [])];
    if (post.depositOutputs && services.includes('bank')) this.depositPlannerOutputs(post, report);
    else if (post.depositOutputs && !post.returnToTown) {
      this.log('Planned outputs could not be deposited because no bank service is available.');
      post.depositOutputs = false;
    }
    const next = post.nextPlan;
    character.planner.pendingPostActions = null;
    if (next?.actionId) {
      try { this.startActivityPlan(next.actionId, next.conditions || {}, next.nextPlan || null); }
      catch (error) { this.log(`Next planned activity could not start: ${error.message}`); }
    }
    return true;
  };
}

function normalizeStoryQuestState(state, quest) {
  state.stageIndex = Math.max(0, Number(state.stageIndex) || 0);
  if (state.stageIndex >= quest.stages.length) state.stageIndex = quest.stages.length - 1;
  state.stageId = quest.stages[state.stageIndex]?.id || state.stageId || quest.stages[0].id;
  state.completedObjectives ||= {};
  state.objectiveData ||= {};
  state.evidence ||= [];
  state.journal ||= [];
  state.decisions ||= {};
  state.attempts ||= {};
  state.pendingDecision = Boolean(state.pendingDecision);
}

function diffStatusIds(before = [], after = []) {
  const beforeIds = new Set(before.map((entry) => entry.id));
  return after.filter((entry) => !beforeIds.has(entry.id)).map((entry) => entry.id);
}

function specializationModifiers(skillId, specializationId) {
  const map = {
    prospector: { rareFind: 0.04, miningYield: 5 }, deep_miner: { miningSpeed: 7, enemyDamage: -3 }, demolitionist: { miningYield: 10 },
    forester: { woodcuttingYield: 6 }, arborist: { rareFind: 0.03, foragingYield: 4 }, lumbermaster: { woodcuttingSpeed: 8, craftingYield: 4 },
    angler: { fishingYield: 5 }, netmaster: { fishingSpeed: 7 }, deepwater_hunter: { fishingYield: 10, rareFind: 0.04 },
    herbalist: { farmingYield: 6, herbloreSpeed: 5 }, orchard_keeper: { farmingYield: 9 }, field_steward: { farmingYield: 12 },
    mechanist: { engineeringSpeed: 7 }, civil_engineer: { constructionSpeed: 8, projectEfficiency: 8 }, artificer: { engineeringYield: 8, magicDamage: 5 },
    commander: { enemyDamage: -4, leadershipXp: 7 }, steward: { passiveYield: 8 }, expedition_leader: { expeditionSpeed: 10 },
    breeder: { husbandryBirthChance: 12 }, healer: { husbandryHealth: 15 }, mount_trainer: { travelSpeed: 10 },
    purifier: { corruptionDanger: -12 }, spirit_binder: { ritualismYield: 8 }, heartglass_seer: { archaeologyXp: 10, ritualismXp: 10 },
    mediator: { diplomacyXp: 7 }, envoy: { travelSpeed: 5, tradeProfit: 5 }, chancellor: { reputationGain: 10 },
  };
  return map[specializationId] || { [`${skillId}Xp`]: 3 };
}

function humanize(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
