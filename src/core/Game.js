/**
 * Game - Main game controller. Init, update, render loop orchestration.
 * Imports: EventBus, Settings, InputManager, Debug, Renderer, SceneManager, LightingSystem.
 * Exports: Game class (not singleton — instantiated once in main.js).
 * 
 * Phase 2: Proper renderer, scene, lighting, camera, animation loop with delta time.
 */

import * as THREE from 'three';
import eventBus from './EventBus.js';
import settings from './Settings.js';
import inputManager from './InputManager.js';
import debug from './Debug.js';
import Renderer from '../rendering/Renderer.js';
import SceneManager from '../rendering/SceneManager.js';
import LightingSystem from '../rendering/LightingSystem.js';
import ChunkManager from '../world/ChunkManager.js';
import Player from '../entities/Player.js';
import WaterSystem from '../rendering/WaterSystem.js';
import PostProcessing from '../rendering/PostProcessing.js';
import FishingController from '../fishing/FishingController.js';
import BiteSystem from '../fishing/BiteSystem.js';
import inventory from '../systems/Inventory.js';
import progression from '../systems/Progression.js';
import encyclopedia from '../systems/Encyclopedia.js';
import InventoryUI from '../ui/InventoryUI.js';
import saveManager from '../systems/SaveManager.js';
import notificationToast from '../ui/NotificationToast.js';

export default class Game {
  constructor() {
    this._running = false;
    this._paused = false;
    this._initialized = false;

    // DOM refs
    this._canvas = null;
    this._loadingScreen = null;
    this._loadingBarFill = null;
    this._loadingText = null;
    this._clickToStart = null;
    this._pauseMenu = null;
    this._settingsPanel = null;
    this._hudFps = null;
    this._hudTopRight = null;

    // Core systems
    this._renderer = null;
    this._sceneManager = null;
    this._lightingSystem = null;
    this._chunkManager = null;
    this._waterSystem = null;
    this._postProcessing = null;
    this._fishingController = null;
    this._inventoryUI = null;
    this._player = null;
    this._camera = null;
    this._clock = null;

    // World seed (Phase 9 will fetch from Cloudflare, for now random)
    this._worldSeed = 0;

    // Frame rate limiting
    this._lastRenderTime = 0;
    this._frameInterval = 0; // 0 = unlimited

    // Reusable camera position vector (avoid allocating in update)
    this._cameraWorldPos = new THREE.Vector3();
  }

  async init() {
    // Grab DOM elements
    this._canvas = document.getElementById('game-canvas');
    this._loadingScreen = document.getElementById('loading-screen');
    this._loadingBarFill = document.getElementById('loading-bar-fill');
    this._loadingText = document.getElementById('loading-text');
    this._clickToStart = document.getElementById('click-to-start');
    this._pauseMenu = document.getElementById('pause-menu');
    this._settingsPanel = document.getElementById('settings-panel');
    this._hudFps = document.getElementById('hud-fps');
    this._hudTopRight = document.getElementById('hud-top-right');

    this._setLoadingProgress(10, 'Initializing settings...');

    // Settings already loaded in its constructor (sync from localStorage)
    // Initialize debug overlay
    debug.init();

    this._setLoadingProgress(20, 'Setting up input...');

    // Initialize input manager
    inputManager.init(this._canvas);

    this._setLoadingProgress(25, 'Setting up UI...');

    // Wire up pause menu
    this._setupPauseMenu();
    this._setupSettingsPanel();

    // Listen for Escape key to toggle pause
    this._onKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);

    this._setLoadingProgress(35, 'Initializing save system...');
    await saveManager.init();

    this._setLoadingProgress(50, 'Preparing renderer...');
    await this._initRenderer();

    this._setLoadingProgress(70, 'Generating world...');
    await this._initWorld();

    this._setLoadingProgress(100, 'Ready!');

    // Show click-to-start button
    this._clickToStart.style.display = 'block';
    this._clickToStart.addEventListener('click', () => {
      this._hideLoadingScreen();
      this._start();
    });

    this._initialized = true;
    eventBus.emit('game:initialized');
  }

  async _initRenderer() {
    this._clock = new THREE.Clock(false); // Don't auto-start

    // Create scene manager (owns the THREE.Scene)
    this._sceneManager = new SceneManager();
    const scene = this._sceneManager.scene;

    // Create camera (will be parented to player in _initWorld)
    const aspect = window.innerWidth / window.innerHeight;
    const fov = settings.get('fov');
    const drawDist = settings.get('drawDistance') * 64 + 100;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, drawDist);

    // Create renderer (owns the WebGLRenderer)
    this._renderer = new Renderer(this._canvas);

    // Create lighting system (sun, sky, time-of-day cycle)
    this._lightingSystem = new LightingSystem(scene);
    // Start at noon
    this._lightingSystem.setTime(0.5);

    // Resize handler — camera aspect + projection update + post-processing
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      if (this._postProcessing) {
        this._postProcessing.setSize(w, h);
      }
    };
    window.addEventListener('resize', this._onResize);

    // Frame rate limiting from settings
    this._updateFrameInterval();
    settings.onChange('maxFrameRate', () => this._updateFrameInterval());

    // FOV setting change
    settings.onChange('fov', (val) => {
      this._camera.fov = val;
      this._camera.updateProjectionMatrix();
    });

    // Draw distance change updates far plane
    settings.onChange('drawDistance', (val) => {
      this._camera.far = val * 64 + 100;
      this._camera.updateProjectionMatrix();
    });

    // Create post-processing pipeline
    this._postProcessing = new PostProcessing(
      this._renderer.webglRenderer, scene, this._camera
    );

    // Render one frame to show something during loading
    this._renderer.render(scene, this._camera);
  }

  async _initWorld() {
    // Generate or load world seed
    // Phase 9: fetch from Cloudflare Worker. Phase 10: load from IndexedDB.
    // For now, use a fixed seed for deterministic testing.
    this._worldSeed = 42;

    const scene = this._sceneManager.scene;
    this._chunkManager = new ChunkManager(scene, this._worldSeed);

    // Initial chunk load around origin
    this._chunkManager.update(0, 0);

    // Create player (camera becomes child of player object)
    this._player = new Player(
      this._camera,
      (x, z) => this._chunkManager.getTerrainHeight(x, z)
    );
    scene.add(this._player.object);

    // Teleport player to start position above terrain
    const startHeight = this._chunkManager.getTerrainHeight(0, 0);
    this._player.teleport(0, Math.max(startHeight + 0.1, 0.5), 0);

    // Create water system
    this._waterSystem = new WaterSystem(scene);

    // Create fishing controller
    this._fishingController = new FishingController(
      this._camera, scene,
      (x, z) => this._chunkManager.getTerrainHeight(x, z)
    );

    // Create inventory UI
    this._inventoryUI = new InventoryUI();

    // Give player starter gear
    inventory.addItem({ type: 'rod', name: 'Beginner Rod', quantity: 1, data: { tier: 1, castDist: 10, maxFishWeight: 5 } });
    inventory.addItem({ type: 'reel', name: 'Beginner Reel', quantity: 1, data: { tier: 1, reelSpeed: 1.0 } });
    inventory.addItem({ type: 'line', name: 'Basic Line', quantity: 1, data: { tier: 1, strength: 5 } });
    inventory.addItem({ type: 'bait', name: 'Worm', quantity: 20, data: { lureType: 'worm' } });
    inventory.addCurrency(50);

    // Wire fishing catches to inventory and progression
    eventBus.on('fishing:caught', (data) => {
      const biome = this._chunkManager
        ? this._chunkManager.getBiome(this._cameraWorldPos.x, this._cameraWorldPos.z)
        : 'Unknown';
      inventory.addFish(data.species, data.weight, data.quality, biome, 0);
      progression.awardFishCatchXP(data.species.rarity, data.quality === 'Trophy');
    });

    // Register save callbacks
    saveManager.registerSaveCallback('inventory', () => inventory.serialize());
    saveManager.registerSaveCallback('progression', () => progression.serialize());
    saveManager.registerSaveCallback('encyclopedia', () => encyclopedia.serialize());
    saveManager.registerSaveCallback('worldSeed', () => this._worldSeed);
    saveManager.registerSaveCallback('playerPosition', () => {
      const p = this._player ? this._player.position : { x: 0, y: 0, z: 0 };
      return { x: p.x, y: p.y, z: p.z };
    });

    // Try to load existing save
    const saveData = await saveManager.load('auto');
    if (saveData) {
      if (saveData.inventory) inventory.deserialize(saveData.inventory);
      if (saveData.progression) progression.deserialize(saveData.progression);
      if (saveData.encyclopedia) encyclopedia.deserialize(saveData.encyclopedia);
      if (saveData.playerPosition && this._player) {
        const sp = saveData.playerPosition;
        this._player.teleport(sp.x, sp.y, sp.z);
      }
    }

    // Start auto-save
    saveManager.startAutoSave();

    // Wire manual save button
    eventBus.on('game:save', () => {
      saveManager.save('auto');
    });
  }

  _updateFrameInterval() {
    const fps = settings.get('maxFrameRate');
    this._frameInterval = fps > 0 ? 1 / fps : 0;
  }

  _start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();

    const scene = this._sceneManager.scene;

    // Use setAnimationLoop per spec
    this._renderer.setAnimationLoop((timestamp) => {
      this._loop(timestamp, scene);
    });

    // Request pointer lock on canvas click (must be inside user gesture)
    this._canvas.addEventListener('click', () => {
      if (!this._paused && this._running) {
        inputManager.requestPointerLock();
      }
    });

    eventBus.emit('game:started');
  }

  _loop(timestamp, scene) {
    if (this._paused) return;

    // Frame rate limiting
    if (this._frameInterval > 0) {
      const elapsed = (timestamp - this._lastRenderTime) / 1000;
      if (elapsed < this._frameInterval) return;
      this._lastRenderTime = timestamp;
    }

    // Get delta once per frame, cap at 0.1s
    let delta = this._clock.getDelta();
    if (delta > 0.1) delta = 0.1;

    // Update all systems
    this._update(delta, scene);

    // Render (use post-processing if enabled, otherwise direct)
    if (this._postProcessing && this._postProcessing.enabled) {
      this._postProcessing.render(delta);
    } else {
      this._renderer.render(scene, this._camera);
    }
  }

  _update(delta, scene) {
    // Pass nearby collision objects to player
    if (this._player && this._chunkManager) {
      const px = this._player.position.x;
      const pz = this._player.position.z;
      this._player.setCollisionObjects(this._chunkManager.getNearbyColliders(px, pz));
    }

    // Update player (movement, collision, camera)
    if (this._player) {
      this._player.update(delta);
    }

    // Get player world position for systems (reuse vector)
    const playerPos = this._player ? this._player.position : this._cameraWorldPos;
    this._cameraWorldPos.copy(playerPos);

    // Update lighting (time-of-day cycle, sun position follows player)
    this._lightingSystem.update(delta, this._cameraWorldPos);

    // Update chunk streaming around player
    if (this._chunkManager) {
      this._chunkManager.update(this._cameraWorldPos.x, this._cameraWorldPos.z);
    }

    // Update water system
    if (this._waterSystem) {
      this._waterSystem.update(delta, this._cameraWorldPos);
    }

    // Update fishing
    if (this._fishingController) {
      // Set world conditions for bite system
      const hour = this._lightingSystem ? this._lightingSystem.hour : 12;
      const cm = this._chunkManager;
      this._fishingController.setConditions({
        biome: cm ? cm.getBiome(this._cameraWorldPos.x, this._cameraWorldPos.z) : 'plains',
        timeOfDay: BiteSystem.hourToTimePeriod(hour),
        weather: 'clear', // Phase 5+ weather system
        depth: 'shallow',
        habitat: 'lake',
        lureType: 'worm',
        playerSkillLevel: 0,
      });
      this._fishingController.update(delta);
    }

    // HUD: FPS display
    if (settings.get('showFps') && this._hudFps) {
      this._hudFps.style.display = 'block';
      if (delta > 0) {
        this._hudFps.textContent = `${Math.round(1 / delta)} FPS`;
      }
    } else if (this._hudFps) {
      this._hudFps.style.display = 'none';
    }

    // HUD: top-right info (time of day, coordinates)
    if (this._hudTopRight) {
      let info = this._lightingSystem.timeString;
      if (settings.get('showCoordinates')) {
        const p = this._cameraWorldPos;
        info += ` | ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
      }
      this._hudTopRight.textContent = info;
    }

    // Debug overlay update
    const ri = this._renderer.info;
    const cm = this._chunkManager;
    const pd = this._player ? this._player.getDebugData() : {};
    debug.update({
      delta,
      rendererInfo: ri,
      playerPosition: pd.playerPosition || this._cameraWorldPos,
      playerVelocity: pd.playerVelocity || { x: 0, y: 0, z: 0 },
      isGrounded: pd.isGrounded || false,
      isInWater: pd.isInWater || false,
      cameraPitch: pd.cameraPitch || 0,
      cameraYaw: pd.cameraYaw || 0,
      collisionState: pd.collisionState || 'none',
      timeOfDay: this._lightingSystem.timeString,
      worldSeed: this._worldSeed,
      chunksLoaded: cm ? cm.chunksLoaded : 0,
      chunksVisible: cm ? cm.chunksVisible : 0,
      workerQueueDepth: cm ? cm.workerQueueDepth : 0,
      biome: cm ? cm.getBiome(this._cameraWorldPos.x, this._cameraWorldPos.z) : 'unknown',
      playerChunk: cm ? `${Math.floor(this._cameraWorldPos.x / 64)}, ${Math.floor(this._cameraWorldPos.z / 64)}` : '0, 0',
    });
  }

  _pause() {
    if (this._paused) return;
    this._paused = true;
    inputManager.exitPointerLock();
    this._pauseMenu.style.display = 'flex';
    eventBus.emit('game:paused');
  }

  _resume() {
    if (!this._paused) return;
    this._paused = false;
    this._pauseMenu.style.display = 'none';
    this._settingsPanel.style.display = 'none';
    eventBus.emit('game:resumed');
  }

  _setupPauseMenu() {
    document.getElementById('btn-resume').addEventListener('click', () => {
      this._resume();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this._pauseMenu.style.display = 'none';
      this._showSettings();
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      // Phase 10: SaveManager integration
      eventBus.emit('game:save');
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
      // For now, just reload
      eventBus.emit('game:quit');
      window.location.reload();
    });
  }

  _showSettings() {
    this._settingsPanel.style.display = 'block';
    this._buildSettingsUI();
  }

  _setupSettingsPanel() {
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      this._settingsPanel.style.display = 'none';
      if (this._paused) {
        this._pauseMenu.style.display = 'flex';
      }
    });
  }

  _buildSettingsUI() {
    const body = document.getElementById('settings-body');
    body.innerHTML = '';

    const s = settings.getAll();

    // Helper to create a section
    const section = (title) => {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      body.appendChild(h3);
    };

    // Helper to create a select row
    const selectRow = (label, key, options) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const sel = document.createElement('select');
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (s[key] === opt.value || String(s[key]) === String(opt.value)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        let val = sel.value;
        // Try to parse as number
        if (!isNaN(val) && val !== '' && val !== 'true' && val !== 'false') {
          val = parseFloat(val);
        }
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        settings.set(key, val);

        // Apply runtime changes
        this._applySettingChange(key, val);
      });
      row.appendChild(lbl);
      row.appendChild(sel);
      body.appendChild(row);
    };

    // Helper to create a slider row
    const sliderRow = (label, key, min, max, step) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const lbl = document.createElement('label');
      lbl.textContent = `${label}: ${s[key]}`;
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = min;
      inp.max = max;
      inp.step = step;
      inp.value = s[key];
      inp.addEventListener('input', () => {
        const val = parseFloat(inp.value);
        lbl.textContent = `${label}: ${val}`;
        settings.set(key, val);
        this._applySettingChange(key, val);
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      body.appendChild(row);
    };

    // Helper for toggle
    const toggleRow = (label, key) => {
      selectRow(label, key, [
        { value: 'true', label: 'On' },
        { value: 'false', label: 'Off' },
      ]);
    };

    // --- GRAPHICS ---
    section('Graphics');
    selectRow('Quality Preset', 'qualityPreset', [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'ultra', label: 'Ultra' },
    ]);
    selectRow('Shadow Quality', 'shadowQuality', [
      { value: 'off', label: 'Off' },
      { value: 'low', label: 'Low (512)' },
      { value: 'medium', label: 'Medium (1024)' },
      { value: 'high', label: 'High (2048)' },
    ]);
    sliderRow('Shadow Distance', 'shadowDistance', 50, 500, 10);
    sliderRow('Draw Distance (chunks)', 'drawDistance', 1, 6, 1);
    selectRow('Water Reflections', 'waterReflections', [
      { value: 'off', label: 'Off' },
      { value: 'low', label: 'Low (256)' },
      { value: 'medium', label: 'Medium (512)' },
      { value: 'high', label: 'High (1024)' },
    ]);
    toggleRow('Post-Processing', 'postProcessing');
    toggleRow('SSAO', 'ssao');
    toggleRow('Bloom', 'bloom');
    sliderRow('SSAO Strength', 'ssaoStrength', 0, 1, 0.05);
    sliderRow('Bloom Strength', 'bloomStrength', 0, 2, 0.05);
    selectRow('Antialiasing', 'antialiasing', [
      { value: 'off', label: 'Off' },
      { value: 'fxaa', label: 'FXAA' },
      { value: 'msaa2x', label: 'MSAA 2x (restart)' },
      { value: 'msaa4x', label: 'MSAA 4x (restart)' },
    ]);
    sliderRow('Field of View', 'fov', 60, 110, 1);
    selectRow('Max Frame Rate', 'maxFrameRate', [
      { value: '30', label: '30' },
      { value: '60', label: '60' },
      { value: '120', label: '120' },
      { value: '0', label: 'Unlimited' },
    ]);
    selectRow('Pixel Ratio', 'pixelRatio', [
      { value: '0.5', label: '0.5x' },
      { value: '1', label: '1x' },
      { value: '1.5', label: '1.5x' },
      { value: '2', label: '2x' },
    ]);

    // --- AUDIO ---
    section('Audio');
    sliderRow('Master Volume', 'masterVolume', 0, 100, 1);
    sliderRow('Music Volume', 'musicVolume', 0, 100, 1);
    sliderRow('Effects Volume', 'effectsVolume', 0, 100, 1);
    sliderRow('Ambient Volume', 'ambientVolume', 0, 100, 1);

    // --- GAMEPLAY ---
    section('Gameplay');
    sliderRow('Mouse Sensitivity', 'mouseSensitivity', 0.1, 5.0, 0.1);
    toggleRow('Invert Y Axis', 'invertY');
    toggleRow('Show FPS Counter', 'showFps');
    toggleRow('Show Coordinates', 'showCoordinates');
    sliderRow('UI Scale', 'uiScale', 0.5, 2.0, 0.1);

    // --- CONTROLS ---
    section('Controls');
    const bindings = settings.getAll().keyBindings;
    for (const [action, code] of Object.entries(bindings)) {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const lbl = document.createElement('label');
      lbl.textContent = action.replace(/([A-Z])/g, ' $1').trim();
      const btn = document.createElement('button');
      btn.textContent = code;
      btn.style.cssText = 'background:#1a4a2e;color:#4ade80;border:1px solid #2d6b3f;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:0.85rem;';
      btn.addEventListener('click', () => {
        btn.textContent = 'Press a key...';
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const newCode = e.code;
          settings.setKeyBinding(action, newCode);
          btn.textContent = newCode;
          document.removeEventListener('keydown', handler);
        };
        document.addEventListener('keydown', handler);
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      body.appendChild(row);
    }
  }

  _applySettingChange(key, value) {
    if (!this._renderer || !this._camera) return;

    switch (key) {
      case 'qualityPreset':
        settings.applyPreset(value);
        this._buildSettingsUI(); // Refresh UI to show new values
        break;
      // fov, pixelRatio, drawDistance handled via settings.onChange in _initRenderer
    }
  }

  _handleKeyDown(e) {
    if (!this._initialized || !this._running) return;

    // Inventory toggle
    const invKey = settings.getKeyBinding('openInventory');
    if (e.code === invKey) {
      e.preventDefault();
      if (this._inventoryUI) {
        this._inventoryUI.toggle();
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      // Close inventory first if open
      if (this._inventoryUI && this._inventoryUI.isVisible) {
        this._inventoryUI.hide();
        return;
      }
      if (this._settingsPanel.style.display === 'block') {
        this._settingsPanel.style.display = 'none';
        this._pauseMenu.style.display = 'flex';
      } else if (this._paused) {
        this._resume();
      } else {
        this._pause();
      }
    }
  }

  _setLoadingProgress(percent, text) {
    if (this._loadingBarFill) {
      this._loadingBarFill.style.width = percent + '%';
    }
    if (this._loadingText) {
      this._loadingText.textContent = text;
    }
  }

  _hideLoadingScreen() {
    if (this._loadingScreen) {
      this._loadingScreen.style.opacity = '0';
      setTimeout(() => {
        this._loadingScreen.style.display = 'none';
      }, 500);
    }
  }
}
