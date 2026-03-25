/**
 * Encyclopedia - Fish catalog, discovery tracking.
 * Imports: EventBus, FishSpecies.
 * Exports: Encyclopedia singleton.
 *
 * Tracks which species have been caught, trophy records per species.
 * Provides catalog UI data.
 */

import eventBus from '../core/EventBus.js';
import { FISH_SPECIES } from '../fishing/FishSpecies.js';

class Encyclopedia {
  constructor() {
    // Map: speciesName -> { discovered, count, bestWeight, bestQuality, firstCatchTime }
    this._entries = new Map();

    // Listen for catches
    eventBus.on('fishing:caught', (data) => this._onCatch(data));
  }

  get totalSpecies() { return FISH_SPECIES.length; }
  get discoveredCount() { return this._entries.size; }

  isDiscovered(speciesName) {
    return this._entries.has(speciesName);
  }

  getEntry(speciesName) {
    return this._entries.get(speciesName) || null;
  }

  getAllEntries() {
    return FISH_SPECIES.map(species => {
      const entry = this._entries.get(species.name);
      return {
        species,
        discovered: !!entry,
        count: entry ? entry.count : 0,
        bestWeight: entry ? entry.bestWeight : 0,
        bestQuality: entry ? entry.bestQuality : null,
      };
    });
  }

  _onCatch(data) {
    const { species, weight, quality } = data;
    const name = species.name;

    if (!this._entries.has(name)) {
      this._entries.set(name, {
        discovered: true,
        count: 1,
        bestWeight: weight,
        bestQuality: quality,
        firstCatchTime: Date.now(),
      });
      eventBus.emit('encyclopedia:newDiscovery', { species, weight, quality });
    } else {
      const entry = this._entries.get(name);
      entry.count++;
      if (weight > entry.bestWeight) {
        entry.bestWeight = weight;
        entry.bestQuality = quality;
        eventBus.emit('encyclopedia:newRecord', { species, weight, quality });
      }
    }
    eventBus.emit('encyclopedia:changed');
  }

  serialize() {
    const entries = {};
    for (const [name, entry] of this._entries) {
      entries[name] = { ...entry };
    }
    return { entries };
  }

  deserialize(data) {
    if (!data || !data.entries) return;
    this._entries.clear();
    for (const [name, entry] of Object.entries(data.entries)) {
      this._entries.set(name, entry);
    }
  }
}

const encyclopedia = new Encyclopedia();
export default encyclopedia;
