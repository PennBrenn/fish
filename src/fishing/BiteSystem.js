/**
 * BiteSystem - Fish attraction logic, lure matching, bite timer.
 * Imports: FishSpecies, EventBus.
 * Exports: BiteSystem class.
 *
 * Once lure is in water, starts bite timer.
 * Base interval 15-60s, modified by lure match, time of day, weather, depth, skill.
 * When bite occurs: 0.5s window for player to reel.
 * Selects fish species based on biome, time, weather, depth, lure type.
 */

import { getEligibleFish, FISH_SPECIES } from './FishSpecies.js';
import eventBus from '../core/EventBus.js';

// Seeded PRNG for deterministic bite timing per cast position
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BITE_WINDOW = 0.5; // seconds to react to a bite

export default class BiteSystem {
  constructor() {
    this._active = false;
    this._biteTimer = 0;
    this._biteInterval = 0;
    this._biteWindowTimer = 0;
    this._biteWindowActive = false;
    this._selectedFish = null;
    this._rng = null;

    // Current conditions
    this._biome = 'plains';
    this._timeOfDay = 'day'; // day/dawn/dusk/night
    this._weather = 'clear'; // clear/rain/storm
    this._depth = 'shallow'; // shallow/mid/deep
    this._habitat = 'lake';
    this._lureType = 'worm';
    this._playerSkillLevel = 0;

    // Listen for lure landing in water
    eventBus.on('fishing:lureInWater', (data) => this._startBiteTimer(data));
    eventBus.on('fishing:reelIn', () => this._stop());
  }

  /**
   * Set current world conditions for bite calculations.
   */
  setConditions({ biome, timeOfDay, weather, depth, habitat, lureType, playerSkillLevel }) {
    if (biome !== undefined) this._biome = biome;
    if (timeOfDay !== undefined) this._timeOfDay = timeOfDay;
    if (weather !== undefined) this._weather = weather;
    if (depth !== undefined) this._depth = depth;
    if (habitat !== undefined) this._habitat = habitat;
    if (lureType !== undefined) this._lureType = lureType;
    if (playerSkillLevel !== undefined) this._playerSkillLevel = playerSkillLevel;
  }

  /**
   * Convert hour (0-24) to time period string.
   */
  static hourToTimePeriod(hour) {
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
  }

  _startBiteTimer(data) {
    // Seed RNG from lure position for deterministic behavior
    const positionSeed = (Math.floor(data.x) * 73856093) ^ (Math.floor(data.z) * 19349663);
    this._rng = mulberry32(positionSeed);

    // Base interval 15-60 seconds
    const baseInterval = 15 + this._rng() * 45;

    // Select eligible fish
    const eligible = getEligibleFish(
      this._biome, this._timeOfDay, this._weather, this._depth, this._habitat
    );

    if (eligible.length === 0) {
      // Fallback: any fish for this biome
      const fallback = FISH_SPECIES.filter(f => f.biomes.includes(this._biome));
      if (fallback.length > 0) {
        this._selectedFish = fallback[Math.floor(this._rng() * fallback.length)];
      } else {
        this._selectedFish = FISH_SPECIES[0]; // absolute fallback
      }
    } else {
      // Weight by rarity (common more likely)
      const weights = eligible.map(f => {
        switch (f.rarity) {
          case 'common': return 10;
          case 'uncommon': return 4;
          case 'rare': return 1;
          case 'legendary': return 0.1;
          default: return 5;
        }
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let roll = this._rng() * totalWeight;
      this._selectedFish = eligible[eligible.length - 1];
      for (let i = 0; i < eligible.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          this._selectedFish = eligible[i];
          break;
        }
      }
    }

    // Apply modifiers to interval
    let interval = baseInterval;

    // Lure match: if lure type matches fish preference, 0.4x
    if (this._selectedFish.lurePreference.includes(this._lureType)) {
      interval *= 0.4;
    }

    // Time of day: peak at dawn/dusk, 0.5x
    if (this._timeOfDay === 'dawn' || this._timeOfDay === 'dusk') {
      interval *= 0.5;
    }

    // Weather: rain 0.7x, storm 1.5x for rarer species
    if (this._weather === 'rain') {
      interval *= 0.7;
    } else if (this._weather === 'storm') {
      if (this._selectedFish.rarity === 'rare' || this._selectedFish.rarity === 'legendary') {
        interval *= 0.8; // Better chance for rare in storms
      } else {
        interval *= 1.5;
      }
    }

    // Depth bonus for deep-water species
    if (this._depth === 'deep' && this._selectedFish.depthPreference === 'deep') {
      interval *= 0.8;
    }

    // Player skill (each level 0.95x)
    for (let i = 0; i < this._playerSkillLevel; i++) {
      interval *= 0.95;
    }

    // Clamp
    interval = Math.max(5, Math.min(120, interval));

    this._biteInterval = interval;
    this._biteTimer = 0;
    this._biteWindowActive = false;
    this._biteWindowTimer = 0;
    this._active = true;
  }

  _stop() {
    this._active = false;
    this._biteWindowActive = false;
    this._selectedFish = null;
  }

  /**
   * Update each frame.
   * @param {number} delta
   * @returns {{ biting: boolean, fish: object|null, missed: boolean }}
   */
  update(delta) {
    if (!this._active) {
      return { biting: false, fish: null, missed: false };
    }

    if (this._biteWindowActive) {
      // Player has BITE_WINDOW seconds to react
      this._biteWindowTimer += delta;
      if (this._biteWindowTimer >= BITE_WINDOW) {
        // Missed the bite
        this._biteWindowActive = false;
        eventBus.emit('fishing:biteMissed');
        // Reset timer for next bite attempt
        this._biteTimer = 0;
        this._biteInterval = 10 + (this._rng ? this._rng() : Math.random()) * 30;
        return { biting: false, fish: null, missed: true };
      }
      return { biting: true, fish: this._selectedFish, missed: false };
    }

    // Count down to bite
    this._biteTimer += delta;
    if (this._biteTimer >= this._biteInterval) {
      // Bite!
      this._biteWindowActive = true;
      this._biteWindowTimer = 0;
      eventBus.emit('fishing:bite', { fish: this._selectedFish });
      return { biting: true, fish: this._selectedFish, missed: false };
    }

    return { biting: false, fish: null, missed: false };
  }

  /**
   * Called when player hooks the fish during bite window.
   * Returns the selected fish for the minigame.
   */
  hookFish() {
    if (!this._biteWindowActive || !this._selectedFish) return null;
    this._biteWindowActive = false;
    this._active = false;
    const fish = this._selectedFish;
    eventBus.emit('fishing:hooked', { fish });
    return fish;
  }

  get isActive() {
    return this._active;
  }

  get isBiting() {
    return this._biteWindowActive;
  }

  get selectedFish() {
    return this._selectedFish;
  }

  dispose() {
    this._stop();
  }
}
