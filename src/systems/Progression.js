/**
 * Progression - XP, skills, unlocks.
 * Imports: EventBus.
 * Exports: Progression singleton.
 *
 * Three skill trees, each with 10 levels.
 * XP earned from catching fish, discovering locations, quests, trophy fish.
 * Cost increases per level.
 */

import eventBus from '../core/EventBus.js';

const SKILL_TREES = {
  castMastery: {
    name: 'Cast Mastery',
    description: 'Increases cast distance, accuracy, reduces spooking fish',
    perLevel: { castDistBonus: 2, accuracyBonus: 0.05, spookReduction: 0.05 },
  },
  fishSense: {
    name: 'Fish Sense',
    description: 'Increases bite detection range, shows fish species before catching',
    perLevel: { detectionRange: 5, speciesRevealChance: 0.1 },
  },
  lineCraft: {
    name: 'Line Craft',
    description: 'Reduces line break chance, increases max tension time, unlocks crafting',
    perLevel: { breakReduction: 0.05, tensionTimeBonus: 0.1, craftTierUnlock: 1 },
  },
};

// XP cost per level: level 1 = 100, level 2 = 250, etc.
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// XP rewards by rarity
const RARITY_XP = {
  common: 10,
  uncommon: 25,
  rare: 60,
  legendary: 200,
};

class Progression {
  constructor() {
    this._totalXP = 0;
    this._skills = {};
    for (const key of Object.keys(SKILL_TREES)) {
      this._skills[key] = 0; // current level (0 = not started)
    }
    this._discoveredLocations = new Set();
    this._questsCompleted = 0;
  }

  get totalXP() { return this._totalXP; }
  get skills() { return { ...this._skills }; }

  getSkillLevel(skill) {
    return this._skills[skill] || 0;
  }

  getSkillInfo(skill) {
    return SKILL_TREES[skill] || null;
  }

  getXPForNextLevel(skill) {
    const level = this._skills[skill] || 0;
    if (level >= 10) return Infinity;
    return xpForLevel(level + 1);
  }

  getAvailableXP() {
    // XP spent on all skills
    let spent = 0;
    for (const key of Object.keys(this._skills)) {
      for (let l = 1; l <= this._skills[key]; l++) {
        spent += xpForLevel(l);
      }
    }
    return this._totalXP - spent;
  }

  /**
   * Try to level up a skill. Returns true if successful.
   */
  levelUp(skill) {
    if (!SKILL_TREES[skill]) return false;
    const current = this._skills[skill];
    if (current >= 10) return false;

    const cost = xpForLevel(current + 1);
    if (this.getAvailableXP() < cost) return false;

    this._skills[skill] = current + 1;
    eventBus.emit('progression:levelUp', { skill, level: current + 1 });
    eventBus.emit('progression:changed');
    return true;
  }

  /**
   * Award XP for catching a fish.
   */
  awardFishCatchXP(rarity, isTrophy) {
    let xp = RARITY_XP[rarity] || 10;
    if (isTrophy) xp *= 2;
    this._totalXP += xp;
    eventBus.emit('progression:xpGained', { amount: xp, source: 'fish' });
    eventBus.emit('progression:changed');
  }

  /**
   * Award XP for discovering a new location.
   */
  awardDiscoveryXP(locationId) {
    if (this._discoveredLocations.has(locationId)) return;
    this._discoveredLocations.add(locationId);
    this._totalXP += 50;
    eventBus.emit('progression:xpGained', { amount: 50, source: 'discovery' });
    eventBus.emit('progression:changed');
  }

  /**
   * Award XP for completing a quest.
   */
  awardQuestXP(amount) {
    this._totalXP += amount;
    this._questsCompleted++;
    eventBus.emit('progression:xpGained', { amount, source: 'quest' });
    eventBus.emit('progression:changed');
  }

  /**
   * Get bonuses from current skill levels.
   */
  getBonuses() {
    const bonuses = {
      castDistBonus: 0, accuracyBonus: 0, spookReduction: 0,
      detectionRange: 0, speciesRevealChance: 0,
      breakReduction: 0, tensionTimeBonus: 0, craftTierUnlock: 0,
    };
    for (const [skill, tree] of Object.entries(SKILL_TREES)) {
      const level = this._skills[skill] || 0;
      for (const [key, val] of Object.entries(tree.perLevel)) {
        bonuses[key] = (bonuses[key] || 0) + val * level;
      }
    }
    return bonuses;
  }

  serialize() {
    return {
      totalXP: this._totalXP,
      skills: { ...this._skills },
      discoveredLocations: [...this._discoveredLocations],
      questsCompleted: this._questsCompleted,
    };
  }

  deserialize(data) {
    if (!data) return;
    this._totalXP = data.totalXP || 0;
    if (data.skills) Object.assign(this._skills, data.skills);
    if (data.discoveredLocations) {
      this._discoveredLocations = new Set(data.discoveredLocations);
    }
    this._questsCompleted = data.questsCompleted || 0;
  }
}

const progression = new Progression();
export default progression;
