/**
 * SaveManager - IndexedDB save/load system.
 * Imports: EventBus.
 * Exports: SaveManager singleton.
 *
 * Stores: inventory, progression, encyclopedia, world seed, player position.
 * Auto-save every 2 minutes + on manual save.
 * Uses IndexedDB 'fishgame_saves' database.
 * Per spec: never store Three.js objects in save files.
 */

import eventBus from '../core/EventBus.js';

const DB_NAME = 'fishgame_saves';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const AUTO_SAVE_INTERVAL = 120000; // 2 minutes

class SaveManager {
  constructor() {
    this._db = null;
    this._autoSaveTimer = null;
    this._saveCallbacks = [];
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('SaveManager: IndexedDB error', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Register a callback that returns save data for a system.
   * @param {string} key - unique key for the system
   * @param {function(): object} callback - returns serializable data
   */
  registerSaveCallback(key, callback) {
    this._saveCallbacks.push({ key, callback });
  }

  /**
   * Save all registered data to IndexedDB.
   * @param {string} [slotId='auto'] - save slot identifier
   */
  async save(slotId = 'auto') {
    if (!this._db) return;

    const saveData = {
      id: slotId,
      timestamp: Date.now(),
      version: 1,
    };

    // Collect data from all registered callbacks
    for (const { key, callback } of this._saveCallbacks) {
      try {
        saveData[key] = callback();
      } catch (err) {
        console.warn(`SaveManager: Error saving ${key}`, err);
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(saveData);

      request.onsuccess = () => {
        eventBus.emit('save:complete', { slotId });
        resolve();
      };
      request.onerror = () => {
        console.error('SaveManager: Save failed');
        reject(request.error);
      };
    });
  }

  /**
   * Load data from IndexedDB.
   * @param {string} [slotId='auto']
   * @returns {object|null} save data or null if not found
   */
  async load(slotId = 'auto') {
    if (!this._db) return null;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(slotId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a save slot.
   */
  async deleteSave(slotId) {
    if (!this._db) return;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(slotId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all save slots.
   */
  async listSaves() {
    if (!this._db) return [];

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const saves = request.result.map(s => ({
          id: s.id,
          timestamp: s.timestamp,
        }));
        resolve(saves);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Start auto-save timer.
   */
  startAutoSave() {
    this.stopAutoSave();
    this._autoSaveTimer = setInterval(() => {
      this.save('auto').catch(err => console.warn('Auto-save failed:', err));
    }, AUTO_SAVE_INTERVAL);
  }

  stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }

  dispose() {
    this.stopAutoSave();
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

const saveManager = new SaveManager();
export default saveManager;
