/**
 * Economy - Shop prices, selling fish, currency management.
 * Imports: EventBus, Inventory.
 * Exports: Economy singleton.
 *
 * Shops buy fish at 70% of sell price.
 * Shops sell gear at fixed prices.
 * Per-shop inventory with restock every in-game day.
 * Gear tiers: Beginner, Amateur, Intermediate, Advanced, Master.
 */

import eventBus from '../core/EventBus.js';
import inventory from './Inventory.js';

// Gear tier definitions
const GEAR_TIERS = [
  { name: 'Beginner', tier: 1, castDist: 10, maxFishWeight: 5, reelSpeed: 1.0, biteBonus: 0 },
  { name: 'Amateur', tier: 2, castDist: 15, maxFishWeight: 12, reelSpeed: 1.2, biteBonus: 0.05 },
  { name: 'Intermediate', tier: 3, castDist: 22, maxFishWeight: 25, reelSpeed: 1.5, biteBonus: 0.1 },
  { name: 'Advanced', tier: 4, castDist: 32, maxFishWeight: 50, reelSpeed: 1.8, biteBonus: 0.15 },
  { name: 'Master', tier: 5, castDist: 40, maxFishWeight: 200, reelSpeed: 2.0, biteBonus: 0.2 },
];

// Shop item catalog
const SHOP_CATALOG = {
  rods: [
    { name: 'Beginner Rod', type: 'rod', tier: 1, price: 0, data: { tier: 1, castDist: 10, maxFishWeight: 5 } },
    { name: 'Amateur Rod', type: 'rod', tier: 2, price: 200, data: { tier: 2, castDist: 15, maxFishWeight: 12 } },
    { name: 'Intermediate Rod', type: 'rod', tier: 3, price: 800, data: { tier: 3, castDist: 22, maxFishWeight: 25 } },
    { name: 'Advanced Rod', type: 'rod', tier: 4, price: 2500, data: { tier: 4, castDist: 32, maxFishWeight: 50 } },
    { name: 'Master Rod', type: 'rod', tier: 5, price: 8000, data: { tier: 5, castDist: 40, maxFishWeight: 200 } },
  ],
  reels: [
    { name: 'Beginner Reel', type: 'reel', tier: 1, price: 0, data: { tier: 1, reelSpeed: 1.0 } },
    { name: 'Amateur Reel', type: 'reel', tier: 2, price: 150, data: { tier: 2, reelSpeed: 1.2 } },
    { name: 'Intermediate Reel', type: 'reel', tier: 3, price: 600, data: { tier: 3, reelSpeed: 1.5 } },
    { name: 'Advanced Reel', type: 'reel', tier: 4, price: 2000, data: { tier: 4, reelSpeed: 1.8 } },
    { name: 'Master Reel', type: 'reel', tier: 5, price: 6000, data: { tier: 5, reelSpeed: 2.0 } },
  ],
  lines: [
    { name: 'Basic Line', type: 'line', tier: 1, price: 0, data: { tier: 1, strength: 5 } },
    { name: 'Braided Line', type: 'line', tier: 2, price: 100, data: { tier: 2, strength: 12 } },
    { name: 'Fluorocarbon Line', type: 'line', tier: 3, price: 400, data: { tier: 3, strength: 25 } },
    { name: 'Titanium Line', type: 'line', tier: 4, price: 1500, data: { tier: 4, strength: 50 } },
    { name: 'Mythril Line', type: 'line', tier: 5, price: 5000, data: { tier: 5, strength: 200 } },
  ],
  bait: [
    { name: 'Worm', type: 'bait', price: 2, data: { lureType: 'worm' } },
    { name: 'Minnow', type: 'bait', price: 5, data: { lureType: 'minnow' } },
    { name: 'Cricket', type: 'bait', price: 3, data: { lureType: 'cricket' } },
    { name: 'Corn', type: 'bait', price: 1, data: { lureType: 'corn' } },
    { name: 'Bread', type: 'bait', price: 1, data: { lureType: 'bread' } },
    { name: 'Stinkbait', type: 'bait', price: 8, data: { lureType: 'stinkbait' } },
  ],
  lures: [
    { name: 'Spinner', type: 'lure', price: 25, data: { lureType: 'spinner', durability: 50 } },
    { name: 'Crankbait', type: 'lure', price: 35, data: { lureType: 'crankbait', durability: 40 } },
    { name: 'Spoon', type: 'lure', price: 30, data: { lureType: 'spoon', durability: 60 } },
    { name: 'Jig', type: 'lure', price: 20, data: { lureType: 'jig', durability: 45 } },
    { name: 'Fly', type: 'lure', price: 15, data: { lureType: 'fly', durability: 30 } },
    { name: 'Topwater', type: 'lure', price: 40, data: { lureType: 'topwater', durability: 35 } },
    { name: 'Frog Lure', type: 'lure', price: 45, data: { lureType: 'frog lure', durability: 40 } },
    { name: 'Glow Lure', type: 'lure', price: 60, data: { lureType: 'glow lure', durability: 30 } },
    { name: 'Deep Jig', type: 'lure', price: 50, data: { lureType: 'deep jig', durability: 50 } },
  ],
};

const SHOP_BUY_RATE = 0.7; // Shops buy at 70% of sell price

class Economy {
  constructor() {
    this._shops = new Map(); // shopId -> { items, lastRestock }
  }

  get gearTiers() { return GEAR_TIERS; }
  get catalog() { return SHOP_CATALOG; }

  /**
   * Get the sell price for a fish item (what a shop will pay).
   */
  getShopBuyPrice(item) {
    const sellPrice = inventory.getFishSellPrice(item);
    return Math.floor(sellPrice * SHOP_BUY_RATE);
  }

  /**
   * Sell a fish from inventory slot to a shop.
   * @returns {number} coins earned, or 0 if failed
   */
  sellFish(slotIndex) {
    const item = inventory.slots[slotIndex];
    if (!item || item.type !== 'fish') return 0;

    const price = this.getShopBuyPrice(item);
    inventory.removeItem(slotIndex);
    inventory.addCurrency(price);
    eventBus.emit('economy:sold', { item, price });
    return price;
  }

  /**
   * Buy an item from a shop catalog.
   * @param {string} category - 'rods', 'reels', etc.
   * @param {number} index - index in the category array
   * @returns {boolean} true if purchased
   */
  buyItem(category, index) {
    const cat = SHOP_CATALOG[category];
    if (!cat || !cat[index]) return false;

    const shopItem = cat[index];
    if (inventory.currency < shopItem.price) return false;

    // Check tier requirement (need previous tier)
    if (shopItem.tier && shopItem.tier > 1) {
      const prevTierName = GEAR_TIERS[shopItem.tier - 2].name;
      const hasPreReq = inventory.slots.some(s =>
        s && s.type === shopItem.type && s.data && s.data.tier === shopItem.tier - 1
      ) || Object.values(inventory.equipment).some(e =>
        e && e.type === shopItem.type && e.data && e.data.tier === shopItem.tier - 1
      );
      if (!hasPreReq && shopItem.tier > 1 && shopItem.price > 0) {
        eventBus.emit('economy:needPrereq', { required: prevTierName });
        return false;
      }
    }

    if (!inventory.removeCurrency(shopItem.price)) return false;

    const success = inventory.addItem({
      type: shopItem.type,
      name: shopItem.name,
      quantity: shopItem.type === 'bait' ? 10 : 1,
      data: { ...shopItem.data },
    });

    if (!success) {
      // Refund
      inventory.addCurrency(shopItem.price);
      return false;
    }

    eventBus.emit('economy:purchased', { item: shopItem });
    return true;
  }

  /**
   * Get available items for a shop based on settlement tier.
   */
  getShopItems(settlementTier) {
    const items = {};
    for (const [cat, list] of Object.entries(SHOP_CATALOG)) {
      items[cat] = list.filter(item => !item.tier || item.tier <= (settlementTier || 3));
    }
    return items;
  }

  serialize() {
    return {
      shops: Object.fromEntries(this._shops),
    };
  }

  deserialize(data) {
    if (data && data.shops) {
      this._shops = new Map(Object.entries(data.shops));
    }
  }
}

const economy = new Economy();
export default economy;
