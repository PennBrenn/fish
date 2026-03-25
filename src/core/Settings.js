/**
 * Settings - All user settings, persisted to localStorage.
 * No dependencies on game systems. Singleton export.
 * Must load before any system initializes.
 * 
 * Exports: Settings singleton with get(key), set(key, value), save(), load(),
 *          getKeyBinding(action), setKeyBinding(action, key), getAll(), applyPreset(name)
 */

const STORAGE_KEY = 'fishgame_settings';

const QUALITY_PRESETS = {
  low: {
    shadowQuality: 'off',
    shadowDistance: 100,
    drawDistance: 1,
    waterReflections: 'off',
    ssao: false,
    bloom: false,
    postProcessing: false,
    antialiasing: 'off',
    pixelRatio: 0.5,
    ssaoStrength: 0.3,
    bloomStrength: 0.2,
  },
  medium: {
    shadowQuality: 'medium',
    shadowDistance: 200,
    drawDistance: 3,
    waterReflections: 'medium',
    ssao: true,
    bloom: true,
    postProcessing: true,
    antialiasing: 'fxaa',
    pixelRatio: 1,
    ssaoStrength: 0.5,
    bloomStrength: 0.4,
  },
  high: {
    shadowQuality: 'high',
    shadowDistance: 350,
    drawDistance: 5,
    waterReflections: 'high',
    ssao: true,
    bloom: true,
    postProcessing: true,
    antialiasing: 'msaa2x',
    pixelRatio: 1.5,
    ssaoStrength: 0.6,
    bloomStrength: 0.5,
  },
  ultra: {
    shadowQuality: 'high',
    shadowDistance: 500,
    drawDistance: 6,
    waterReflections: 'high',
    ssao: true,
    bloom: true,
    postProcessing: true,
    antialiasing: 'msaa4x',
    pixelRatio: 2,
    ssaoStrength: 0.7,
    bloomStrength: 0.6,
  },
};

const DEFAULT_KEY_BINDINGS = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  interact: 'KeyE',
  cast: 'Mouse0',
  reel: 'Mouse0',
  openInventory: 'KeyI',
  openMap: 'KeyM',
  openJournal: 'KeyJ',
};

const DEFAULTS = {
  // Graphics
  qualityPreset: 'medium',
  shadowQuality: 'medium',
  shadowDistance: 200,
  drawDistance: 3,
  waterReflections: 'medium',
  ssao: true,
  bloom: true,
  postProcessing: true,
  antialiasing: 'fxaa',
  fov: 80,
  ssaoStrength: 0.5,
  bloomStrength: 0.4,
  maxFrameRate: 60,
  pixelRatio: 1,

  // Audio
  masterVolume: 80,
  musicVolume: 60,
  effectsVolume: 80,
  ambientVolume: 50,

  // Gameplay
  mouseSensitivity: 1.0,
  invertY: false,
  showFps: false,
  showCoordinates: false,
  uiScale: 1.0,

  // Controls
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

class Settings {
  constructor() {
    this._values = {};
    this._changeCallbacks = new Map();
    this.load();
  }

  load() {
    // Start with defaults
    this._values = JSON.parse(JSON.stringify(DEFAULTS));

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Merge saved over defaults (shallow merge, deep merge for keyBindings)
        for (const key of Object.keys(saved)) {
          if (key === 'keyBindings' && typeof saved.keyBindings === 'object') {
            this._values.keyBindings = {
              ...DEFAULT_KEY_BINDINGS,
              ...saved.keyBindings,
            };
          } else {
            this._values[key] = saved[key];
          }
        }
      }
    } catch (e) {
      console.warn('Settings: Failed to load from localStorage, using defaults', e);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._values));
    } catch (e) {
      console.warn('Settings: Failed to save to localStorage', e);
    }
  }

  get(key) {
    return this._values[key];
  }

  set(key, value) {
    const old = this._values[key];
    if (old === value) return;
    this._values[key] = value;
    this.save();
    // Notify listeners
    const cbs = this._changeCallbacks.get(key);
    if (cbs) {
      for (const cb of cbs) {
        cb(value, old, key);
      }
    }
    // Also notify wildcard listeners
    const wcbs = this._changeCallbacks.get('*');
    if (wcbs) {
      for (const cb of wcbs) {
        cb(value, old, key);
      }
    }
  }

  onChange(key, callback) {
    if (!this._changeCallbacks.has(key)) {
      this._changeCallbacks.set(key, []);
    }
    this._changeCallbacks.get(key).push(callback);
  }

  offChange(key, callback) {
    const list = this._changeCallbacks.get(key);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  getKeyBinding(action) {
    return this._values.keyBindings[action] || DEFAULT_KEY_BINDINGS[action];
  }

  setKeyBinding(action, key) {
    this._values.keyBindings[action] = key;
    this.save();
  }

  getAll() {
    return { ...this._values };
  }

  applyPreset(presetName) {
    const preset = QUALITY_PRESETS[presetName];
    if (!preset) return;
    this._values.qualityPreset = presetName;
    for (const [key, value] of Object.entries(preset)) {
      this._values[key] = value;
    }
    this.save();
    // Notify all preset keys
    for (const key of Object.keys(preset)) {
      const cbs = this._changeCallbacks.get(key);
      if (cbs) {
        for (const cb of cbs) {
          cb(this._values[key], undefined, key);
        }
      }
    }
  }

  getPresets() {
    return QUALITY_PRESETS;
  }

  getDefaultKeyBindings() {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

const settings = new Settings();
export default settings;
