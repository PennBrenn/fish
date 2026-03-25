/**
 * NotificationToast - Stackable notification popups.
 * Imports: EventBus.
 * Exports: NotificationToast singleton.
 *
 * Shows toast messages at top-center of screen.
 * Auto-dismiss after 3 seconds. Max 4 visible at once.
 */

import eventBus from '../core/EventBus.js';

const MAX_VISIBLE = 4;
const DURATION = 3000; // ms

class NotificationToast {
  constructor() {
    this._container = null;
    this._toasts = [];
    this._build();
    this._wireEvents();
  }

  _build() {
    this._container = document.createElement('div');
    this._container.id = 'toast-container';
    this._container.style.cssText = `
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      z-index: 80; pointer-events: none;
    `;
    document.getElementById('ui-layer').appendChild(this._container);
  }

  _wireEvents() {
    eventBus.on('fishing:caught', (d) => this.show(`Caught ${d.species.name}! ${d.weight.toFixed(1)}kg`, 'success'));
    eventBus.on('encyclopedia:newDiscovery', (d) => this.show(`New species discovered: ${d.species.name}!`, 'rare'));
    eventBus.on('encyclopedia:newRecord', (d) => this.show(`New record: ${d.species.name} ${d.weight.toFixed(1)}kg!`, 'rare'));
    eventBus.on('progression:xpGained', (d) => this.show(`+${d.amount} XP`, 'info'));
    eventBus.on('progression:levelUp', (d) => this.show(`${d.skill} leveled up to ${d.level}!`, 'success'));
    eventBus.on('economy:purchased', (d) => this.show(`Purchased ${d.item.name}`, 'info'));
    eventBus.on('economy:sold', (d) => this.show(`Sold for ${d.price} coins`, 'info'));
    eventBus.on('save:complete', () => this.show('Game saved', 'info'));
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'|'rare'} [type='info']
   */
  show(message, type = 'info') {
    const colors = {
      info: { bg: 'rgba(59,130,246,0.9)', text: '#fff' },
      success: { bg: 'rgba(34,197,94,0.9)', text: '#fff' },
      warning: { bg: 'rgba(234,179,8,0.9)', text: '#000' },
      error: { bg: 'rgba(239,68,68,0.9)', text: '#fff' },
      rare: { bg: 'rgba(168,85,247,0.9)', text: '#fff' },
    };
    const c = colors[type] || colors.info;

    const el = document.createElement('div');
    el.style.cssText = `
      padding: 8px 20px; border-radius: 6px; font-size: 13px;
      font-family: 'Segoe UI', sans-serif; font-weight: 500;
      background: ${c.bg}; color: ${c.text};
      opacity: 0; transform: translateY(-10px);
      transition: opacity 0.2s, transform 0.2s;
      white-space: nowrap;
    `;
    el.textContent = message;
    this._container.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    this._toasts.push(el);

    // Remove excess
    while (this._toasts.length > MAX_VISIBLE) {
      const old = this._toasts.shift();
      if (old.parentNode) old.parentNode.removeChild(old);
    }

    // Auto-dismiss
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = this._toasts.indexOf(el);
        if (idx >= 0) this._toasts.splice(idx, 1);
      }, 200);
    }, DURATION);
  }

  dispose() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}

const notificationToast = new NotificationToast();
export default notificationToast;
