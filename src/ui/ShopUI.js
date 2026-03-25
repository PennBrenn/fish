/**
 * ShopUI - Buy/sell interface overlay.
 * Imports: Economy, Inventory, EventBus.
 * Exports: ShopUI class.
 *
 * Two tabs: Buy and Sell.
 * Buy: shows shop catalog by category.
 * Sell: shows inventory fish with sell prices.
 */

import economy from '../systems/Economy.js';
import inventory from '../systems/Inventory.js';
import eventBus from '../core/EventBus.js';
import inputManager from '../core/InputManager.js';

export default class ShopUI {
  constructor() {
    this._visible = false;
    this._container = null;
    this._tab = 'buy'; // 'buy' or 'sell'
    this._category = 'rods';
    this._shopTier = 3; // Default settlement tier

    this._build();
  }

  get isVisible() { return this._visible; }

  show(shopTier) {
    this._shopTier = shopTier || 3;
    this._visible = true;
    this._container.style.display = 'flex';
    this._render();
    inputManager.exitPointerLock();
  }

  hide() {
    this._visible = false;
    this._container.style.display = 'none';
  }

  _build() {
    this._container = document.createElement('div');
    this._container.id = 'shop-ui';
    this._container.className = 'interactive';
    this._container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); display: none; z-index: 70;
      flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Segoe UI', sans-serif; color: #fff;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'General Store';
    title.style.cssText = 'font-size: 22px; color: #4ade80; margin-bottom: 12px;';
    this._container.appendChild(title);

    // Currency display
    this._currencyEl = document.createElement('div');
    this._currencyEl.style.cssText = 'font-size: 16px; color: #eab308; margin-bottom: 12px;';
    this._container.appendChild(this._currencyEl);

    // Tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
    this._buyTab = this._createTabBtn('Buy', () => { this._tab = 'buy'; this._render(); });
    this._sellTab = this._createTabBtn('Sell', () => { this._tab = 'sell'; this._render(); });
    tabs.appendChild(this._buyTab);
    tabs.appendChild(this._sellTab);
    this._container.appendChild(tabs);

    // Category selector (buy only)
    this._categoryBar = document.createElement('div');
    this._categoryBar.style.cssText = 'display: flex; gap: 6px; margin-bottom: 10px;';
    const categories = ['rods', 'reels', 'lines', 'bait', 'lures'];
    for (const cat of categories) {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.style.cssText = `
        padding: 4px 12px; background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.2); color: #ccc;
        border-radius: 3px; cursor: pointer; font-size: 12px;
      `;
      btn.addEventListener('click', () => { this._category = cat; this._render(); });
      this._categoryBar.appendChild(btn);
    }
    this._container.appendChild(this._categoryBar);

    // Items list
    this._itemList = document.createElement('div');
    this._itemList.style.cssText = `
      width: 400px; max-height: 300px; overflow-y: auto;
      background: rgba(255,255,255,0.03); border-radius: 6px;
      padding: 8px;
    `;
    this._container.appendChild(this._itemList);

    // Status message
    this._statusEl = document.createElement('div');
    this._statusEl.style.cssText = 'font-size: 13px; color: #4ade80; margin-top: 8px; height: 20px;';
    this._container.appendChild(this._statusEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      margin-top: 12px; padding: 6px 24px; background: rgba(74,222,128,0.15);
      border: 1px solid #4ade80; color: #4ade80; border-radius: 4px;
      cursor: pointer; font-size: 13px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    this._container.appendChild(closeBtn);

    document.getElementById('ui-layer').appendChild(this._container);
  }

  _createTabBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 6px 20px; border: 1px solid #4ade80; color: #4ade80;
      border-radius: 4px; cursor: pointer; font-size: 14px; background: transparent;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _render() {
    // Update tabs styling
    this._buyTab.style.background = this._tab === 'buy' ? 'rgba(74,222,128,0.2)' : 'transparent';
    this._sellTab.style.background = this._tab === 'sell' ? 'rgba(74,222,128,0.2)' : 'transparent';
    this._categoryBar.style.display = this._tab === 'buy' ? 'flex' : 'none';
    this._currencyEl.textContent = `Coins: ${inventory.currency}`;
    this._statusEl.textContent = '';

    this._itemList.innerHTML = '';

    if (this._tab === 'buy') {
      this._renderBuy();
    } else {
      this._renderSell();
    }
  }

  _renderBuy() {
    const items = economy.getShopItems(this._shopTier);
    const list = items[this._category] || [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
      `;

      const info = document.createElement('div');
      info.innerHTML = `<span style="color:#fff;">${item.name}</span>
        ${item.tier ? `<span style="color:#888;font-size:11px;"> T${item.tier}</span>` : ''}`;
      row.appendChild(info);

      const priceBtn = document.createElement('button');
      priceBtn.textContent = item.price === 0 ? 'Free' : `${item.price} coins`;
      priceBtn.style.cssText = `
        padding: 3px 10px; background: rgba(234,179,8,0.15);
        border: 1px solid #eab308; color: #eab308; border-radius: 3px;
        cursor: pointer; font-size: 11px;
      `;
      const catRef = this._category;
      priceBtn.addEventListener('click', () => {
        const success = economy.buyItem(catRef, i);
        if (success) {
          this._statusEl.textContent = `Purchased ${item.name}!`;
          this._statusEl.style.color = '#4ade80';
        } else {
          this._statusEl.textContent = 'Cannot purchase!';
          this._statusEl.style.color = '#ef4444';
        }
        this._render();
      });
      row.appendChild(priceBtn);
      this._itemList.appendChild(row);
    }

    if (list.length === 0) {
      this._itemList.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">No items available</div>';
    }
  }

  _renderSell() {
    const slots = inventory.slots;
    let hasFish = false;

    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item || item.type !== 'fish') continue;
      hasFish = true;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
      `;

      const weight = item.data ? `${item.data.weight.toFixed(1)}kg` : '';
      const quality = item.data ? item.data.quality : '';
      const info = document.createElement('div');
      info.innerHTML = `<span style="color:#fff;">${item.name}</span>
        <span style="color:#888;font-size:11px;"> ${weight} ${quality}</span>`;
      row.appendChild(info);

      const price = economy.getShopBuyPrice(item);
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell: ${price} coins`;
      sellBtn.style.cssText = `
        padding: 3px 10px; background: rgba(74,222,128,0.15);
        border: 1px solid #4ade80; color: #4ade80; border-radius: 3px;
        cursor: pointer; font-size: 11px;
      `;
      const slotIdx = i;
      sellBtn.addEventListener('click', () => {
        const earned = economy.sellFish(slotIdx);
        if (earned > 0) {
          this._statusEl.textContent = `Sold for ${earned} coins!`;
          this._statusEl.style.color = '#4ade80';
        }
        this._render();
      });
      row.appendChild(sellBtn);
      this._itemList.appendChild(row);
    }

    if (!hasFish) {
      this._itemList.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">No fish to sell</div>';
    }
  }

  dispose() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}
