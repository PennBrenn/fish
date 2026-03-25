/**
 * InventoryUI - Grid inventory display overlay.
 * Imports: Inventory, EventBus, InputManager, Settings.
 * Exports: InventoryUI class.
 *
 * Full-screen overlay with 8×6 grid. Click to select, right-click to split.
 * Equipment slots on the left. Tooltip on hover.
 * Toggle with inventory key binding.
 */

import inventory from '../systems/Inventory.js';
import eventBus from '../core/EventBus.js';
import inputManager from '../core/InputManager.js';
import settings from '../core/Settings.js';

const QUALITY_COLORS = {
  Poor: '#9ca3af',
  Good: '#22c55e',
  Great: '#3b82f6',
  Trophy: '#eab308',
};

export default class InventoryUI {
  constructor() {
    this._visible = false;
    this._container = null;
    this._tooltip = null;
    this._selectedSlot = -1;
    this._dragFrom = -1;

    this._build();

    eventBus.on('inventory:updated', () => {
      if (this._visible) this._render();
    });
  }

  get isVisible() { return this._visible; }

  toggle() {
    this._visible = !this._visible;
    this._container.style.display = this._visible ? 'flex' : 'none';
    if (this._visible) {
      this._render();
      inputManager.exitPointerLock();
    }
  }

  show() {
    this._visible = true;
    this._container.style.display = 'flex';
    this._render();
    inputManager.exitPointerLock();
  }

  hide() {
    this._visible = false;
    this._container.style.display = 'none';
    this._hideTooltip();
  }

  _build() {
    this._container = document.createElement('div');
    this._container.id = 'inventory-ui';
    this._container.className = 'interactive';
    this._container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); display: none; z-index: 70;
      flex-direction: row; align-items: center; justify-content: center; gap: 24px;
      font-family: 'Segoe UI', sans-serif; color: #fff;
    `;

    // Equipment panel
    const equipPanel = document.createElement('div');
    equipPanel.style.cssText = 'display: flex; flex-direction: column; gap: 6px; align-items: center;';
    const equipTitle = document.createElement('div');
    equipTitle.textContent = 'Equipment';
    equipTitle.style.cssText = 'font-size: 14px; color: #4ade80; margin-bottom: 4px;';
    equipPanel.appendChild(equipTitle);

    this._equipSlotEls = {};
    const equipSlots = ['rod', 'reel', 'line', 'lure1', 'hat', 'vest', 'boots'];
    for (const slot of equipSlots) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 48px; height: 48px; background: rgba(74,222,128,0.1);
        border: 1px solid #2d6b3f; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #6b9e7a; cursor: pointer; position: relative;
      `;
      el.textContent = slot;
      el.addEventListener('click', () => this._onEquipSlotClick(slot));
      equipPanel.appendChild(el);
      this._equipSlotEls[slot] = el;
    }
    this._container.appendChild(equipPanel);

    // Grid panel
    const gridPanel = document.createElement('div');
    gridPanel.style.cssText = 'display: flex; flex-direction: column; align-items: center;';

    // Currency
    this._currencyEl = document.createElement('div');
    this._currencyEl.style.cssText = 'font-size: 16px; color: #eab308; margin-bottom: 8px;';
    gridPanel.appendChild(this._currencyEl);

    // Grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(8, 52px);
      grid-template-rows: repeat(6, 52px); gap: 3px;
    `;
    this._slotEls = [];
    for (let i = 0; i < 48; i++) {
      const cell = document.createElement('div');
      cell.style.cssText = `
        width: 52px; height: 52px; background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 3px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-size: 10px; cursor: pointer; position: relative; overflow: hidden;
        user-select: none;
      `;
      cell.addEventListener('click', () => this._onSlotClick(i));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); this._onSlotRightClick(i); });
      cell.addEventListener('mouseenter', () => this._showTooltip(i, cell));
      cell.addEventListener('mouseleave', () => this._hideTooltip());
      grid.appendChild(cell);
      this._slotEls.push(cell);
    }
    gridPanel.appendChild(grid);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close (I)';
    closeBtn.style.cssText = `
      margin-top: 12px; padding: 6px 20px; background: rgba(74,222,128,0.15);
      border: 1px solid #4ade80; color: #4ade80; border-radius: 4px;
      cursor: pointer; font-size: 13px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    gridPanel.appendChild(closeBtn);

    this._container.appendChild(gridPanel);

    // Tooltip
    this._tooltip = document.createElement('div');
    this._tooltip.style.cssText = `
      position: fixed; background: rgba(0,0,0,0.95); border: 1px solid #4ade80;
      border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #ccc;
      pointer-events: none; display: none; z-index: 75; max-width: 220px;
      line-height: 1.5;
    `;
    document.body.appendChild(this._tooltip);

    document.getElementById('ui-layer').appendChild(this._container);
  }

  _render() {
    const slots = inventory.slots;
    for (let i = 0; i < 48; i++) {
      const item = slots[i];
      const el = this._slotEls[i];
      if (item) {
        let label = item.name;
        if (label.length > 10) label = label.substring(0, 9) + '…';
        let qty = item.quantity > 1 ? `×${item.quantity}` : '';
        let color = '#fff';
        if (item.data && item.data.quality) {
          color = QUALITY_COLORS[item.data.quality] || '#fff';
        }
        el.innerHTML = `<span style="color:${color};font-size:9px;text-align:center;">${label}</span>
          <span style="font-size:8px;color:#aaa;">${qty}</span>`;
        el.style.borderColor = this._selectedSlot === i ? '#4ade80' : 'rgba(255,255,255,0.15)';
      } else {
        el.innerHTML = '';
        el.style.borderColor = this._selectedSlot === i ? '#4ade80' : 'rgba(255,255,255,0.1)';
      }
    }

    // Equipment slots
    const equip = inventory.equipment;
    for (const [slot, el] of Object.entries(this._equipSlotEls)) {
      const item = equip[slot];
      if (item) {
        el.textContent = item.name.substring(0, 6);
        el.style.borderColor = '#4ade80';
      } else {
        el.textContent = slot;
        el.style.borderColor = '#2d6b3f';
      }
    }

    // Currency
    this._currencyEl.textContent = `💰 ${inventory.currency} coins`;
  }

  _onSlotClick(index) {
    if (this._selectedSlot === -1) {
      if (inventory.slots[index]) {
        this._selectedSlot = index;
      }
    } else {
      inventory.moveItem(this._selectedSlot, index);
      this._selectedSlot = -1;
    }
    this._render();
  }

  _onSlotRightClick(index) {
    inventory.splitStack(index);
    this._render();
  }

  _onEquipSlotClick(slot) {
    if (this._selectedSlot >= 0) {
      inventory.equip(this._selectedSlot, slot);
      this._selectedSlot = -1;
      this._render();
    } else {
      inventory.unequip(slot);
      this._render();
    }
  }

  _showTooltip(slotIndex, el) {
    const item = inventory.slots[slotIndex];
    if (!item) { this._hideTooltip(); return; }

    let html = `<div style="color:#4ade80;font-weight:600;">${item.name}</div>`;
    html += `<div style="color:#888;">${item.category}</div>`;

    if (item.data) {
      if (item.data.weight) {
        const qColor = QUALITY_COLORS[item.data.quality] || '#fff';
        html += `<div>Weight: ${item.data.weight.toFixed(2)} kg</div>`;
        html += `<div style="color:${qColor};">Quality: ${item.data.quality}</div>`;
      }
      if (item.data.locationName) {
        html += `<div style="color:#888;">Caught at: ${item.data.locationName}</div>`;
      }
      if (item.data.tier) {
        html += `<div>Tier: ${item.data.tier}</div>`;
      }
    }

    if (item.type === 'fish') {
      html += `<div style="color:#eab308;">Sell: ${inventory.getFishSellPrice(item)} coins</div>`;
    }

    this._tooltip.innerHTML = html;
    this._tooltip.style.display = 'block';

    const rect = el.getBoundingClientRect();
    this._tooltip.style.left = (rect.right + 8) + 'px';
    this._tooltip.style.top = rect.top + 'px';
  }

  _hideTooltip() {
    this._tooltip.style.display = 'none';
  }

  dispose() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    if (this._tooltip && this._tooltip.parentNode) {
      this._tooltip.parentNode.removeChild(this._tooltip);
    }
  }
}
