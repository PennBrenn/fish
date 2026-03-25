/**
 * Inventory - Item storage, stacking, persistence.
 * Imports: EventBus.
 * Exports: Inventory singleton.
 *
 * Grid: 8 columns × 6 rows = 48 slots.
 * Items stack up to their stackSize.
 * Fish have individual records (species, weight, quality, location, time).
 * Equipment slots separate from grid.
 * Auto-saves to EventBus on change (SaveManager listens).
 */

import eventBus from '../core/EventBus.js';

const GRID_COLS = 8;
const GRID_ROWS = 6;
const GRID_SIZE = GRID_COLS * GRID_ROWS;

// Item type definitions with stack sizes
const ITEM_TYPES = {
  fish:       { stackSize: 1, category: 'fish' },
  bait:       { stackSize: 50, category: 'bait' },
  lure:       { stackSize: 1, category: 'lure' },
  rod:        { stackSize: 1, category: 'rod' },
  reel:       { stackSize: 1, category: 'reel' },
  line:       { stackSize: 1, category: 'line' },
  consumable: { stackSize: 20, category: 'consumable' },
  keyItem:    { stackSize: 1, category: 'keyItem' },
};

// Equipment slot names
const EQUIPMENT_SLOTS = ['rod', 'reel', 'line', 'lure1', 'lure2', 'lure3', 'hat', 'vest', 'boots'];

let _nextItemId = 1;

class Inventory {
  constructor() {
    this._slots = new Array(GRID_SIZE).fill(null);
    this._equipment = {};
    for (const slot of EQUIPMENT_SLOTS) {
      this._equipment[slot] = null;
    }
    this._currency = 0;
    this._debounceTimer = null;
  }

  get slots() { return this._slots; }
  get equipment() { return this._equipment; }
  get currency() { return this._currency; }
  get gridCols() { return GRID_COLS; }
  get gridRows() { return GRID_ROWS; }

  /**
   * Add an item to the first available slot. Stacks if possible.
   * @param {object} item - { type, name, quantity, data }
   * @returns {boolean} true if added successfully
   */
  addItem(item) {
    if (!item || !item.type) return false;

    const typeDef = ITEM_TYPES[item.type] || { stackSize: 1, category: 'misc' };
    item.id = item.id || _nextItemId++;
    item.quantity = item.quantity || 1;
    item.stackSize = typeDef.stackSize;
    item.category = typeDef.category;

    // Try to stack with existing items
    if (typeDef.stackSize > 1) {
      for (let i = 0; i < GRID_SIZE; i++) {
        const slot = this._slots[i];
        if (slot && slot.name === item.name && slot.type === item.type) {
          const space = slot.stackSize - slot.quantity;
          if (space > 0) {
            const toAdd = Math.min(space, item.quantity);
            slot.quantity += toAdd;
            item.quantity -= toAdd;
            if (item.quantity <= 0) {
              this._onChange();
              return true;
            }
          }
        }
      }
    }

    // Find empty slot for remaining
    for (let i = 0; i < GRID_SIZE; i++) {
      if (!this._slots[i]) {
        this._slots[i] = { ...item };
        this._onChange();
        return true;
      }
    }

    return false; // Inventory full
  }

  /**
   * Remove an item from a specific slot.
   * @param {number} slotIndex
   * @param {number} [quantity=1]
   * @returns {object|null} removed item data
   */
  removeItem(slotIndex, quantity = 1) {
    const slot = this._slots[slotIndex];
    if (!slot) return null;

    if (slot.quantity <= quantity) {
      const removed = { ...slot };
      this._slots[slotIndex] = null;
      this._onChange();
      return removed;
    }

    slot.quantity -= quantity;
    this._onChange();
    return { ...slot, quantity };
  }

  /**
   * Move item from one slot to another. Swaps if target occupied.
   */
  moveItem(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= GRID_SIZE) return;
    if (toIndex < 0 || toIndex >= GRID_SIZE) return;

    const fromItem = this._slots[fromIndex];
    const toItem = this._slots[toIndex];

    // Stack if same item type
    if (fromItem && toItem && fromItem.name === toItem.name &&
        fromItem.type === toItem.type && toItem.stackSize > 1) {
      const space = toItem.stackSize - toItem.quantity;
      if (space > 0) {
        const toMove = Math.min(space, fromItem.quantity);
        toItem.quantity += toMove;
        fromItem.quantity -= toMove;
        if (fromItem.quantity <= 0) {
          this._slots[fromIndex] = null;
        }
        this._onChange();
        return;
      }
    }

    // Swap
    this._slots[fromIndex] = toItem;
    this._slots[toIndex] = fromItem;
    this._onChange();
  }

  /**
   * Split a stack at slotIndex, putting half into first empty slot.
   */
  splitStack(slotIndex) {
    const slot = this._slots[slotIndex];
    if (!slot || slot.quantity <= 1) return;

    const splitQty = Math.floor(slot.quantity / 2);
    const emptyIdx = this._slots.indexOf(null);
    if (emptyIdx === -1) return;

    this._slots[emptyIdx] = { ...slot, quantity: splitQty, id: _nextItemId++ };
    slot.quantity -= splitQty;
    this._onChange();
  }

  /**
   * Equip an item from inventory to an equipment slot.
   */
  equip(slotIndex, equipSlot) {
    if (!EQUIPMENT_SLOTS.includes(equipSlot)) return;
    const item = this._slots[slotIndex];
    if (!item) return;

    // Unequip current
    const current = this._equipment[equipSlot];
    this._equipment[equipSlot] = item;
    this._slots[slotIndex] = current; // Swap back to inventory (may be null)
    this._onChange();
  }

  /**
   * Unequip an item back to inventory.
   */
  unequip(equipSlot) {
    const item = this._equipment[equipSlot];
    if (!item) return false;

    const emptyIdx = this._slots.indexOf(null);
    if (emptyIdx === -1) return false; // No space

    this._slots[emptyIdx] = item;
    this._equipment[equipSlot] = null;
    this._onChange();
    return true;
  }

  addCurrency(amount) {
    this._currency += amount;
    this._onChange();
  }

  removeCurrency(amount) {
    if (this._currency < amount) return false;
    this._currency -= amount;
    this._onChange();
    return true;
  }

  /**
   * Add a caught fish to inventory.
   */
  addFish(species, weight, quality, locationName, inGameTime) {
    return this.addItem({
      type: 'fish',
      name: species.name,
      quantity: 1,
      data: {
        species: species.name,
        scientificName: species.scientificName,
        weight,
        quality,
        locationName: locationName || 'Unknown',
        catchTime: inGameTime || 0,
        basePrice: species.basePrice,
        rarity: species.rarity,
      },
    });
  }

  /**
   * Get sell price for a fish item.
   */
  getFishSellPrice(item) {
    if (!item || item.type !== 'fish' || !item.data) return 0;
    const qualityMult = { Poor: 0.5, Good: 1.0, Great: 1.5, Trophy: 3.0 };
    const mult = qualityMult[item.data.quality] || 1.0;
    return Math.round(item.data.basePrice * item.data.weight * mult);
  }

  /**
   * Serialize inventory for saving. Plain data only.
   */
  serialize() {
    return {
      slots: this._slots.map(s => s ? { ...s } : null),
      equipment: Object.fromEntries(
        Object.entries(this._equipment).map(([k, v]) => [k, v ? { ...v } : null])
      ),
      currency: this._currency,
    };
  }

  /**
   * Restore inventory from saved data.
   */
  deserialize(data) {
    if (!data) return;
    if (data.slots) {
      for (let i = 0; i < GRID_SIZE; i++) {
        this._slots[i] = data.slots[i] || null;
      }
    }
    if (data.equipment) {
      for (const slot of EQUIPMENT_SLOTS) {
        this._equipment[slot] = data.equipment[slot] || null;
      }
    }
    if (data.currency !== undefined) {
      this._currency = data.currency;
    }
    // Update next ID
    let maxId = 0;
    for (const s of this._slots) {
      if (s && s.id > maxId) maxId = s.id;
    }
    _nextItemId = maxId + 1;
  }

  _onChange() {
    // Debounce auto-save (2 seconds per spec)
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      eventBus.emit('inventory:changed', this.serialize());
    }, 2000);
    // Immediate UI update
    eventBus.emit('inventory:updated');
  }
}

const inventory = new Inventory();
export default inventory;
