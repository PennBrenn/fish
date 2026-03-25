/**
 * EventBus - Global event emitter for decoupled system communication.
 * No dependencies. Singleton export.
 * 
 * Methods: on(event, callback), off(event, callback), emit(event, ...args), once(event, callback)
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return this;
  }

  off(event, callback) {
    const list = this._listeners.get(event);
    if (!list) return this;
    const idx = list.indexOf(callback);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this._listeners.delete(event);
    }
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list) return this;
    for (let i = 0; i < list.length; i++) {
      list[i](...args);
    }
    return this;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  removeAll(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }
}

const eventBus = new EventBus();
export default eventBus;
