/**
 * FishingController - Orchestrates FishingRod, BiteSystem, and FishingMinigame.
 * Imports: FishingRod, BiteSystem, FishingMinigame, EventBus.
 * Exports: FishingController class.
 *
 * Single entry point for Game.js to manage all fishing logic.
 * Handles state transitions between casting, waiting, biting, and minigame.
 */

import FishingRod from './FishingRod.js';
import BiteSystem from './BiteSystem.js';
import FishingMinigame from './FishingMinigame.js';
import eventBus from '../core/EventBus.js';
import inputManager from '../core/InputManager.js';

// Seeded PRNG for fish weight
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default class FishingController {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Scene} scene
   * @param {function(number,number): number} getTerrainHeight
   */
  constructor(camera, scene, getTerrainHeight) {
    this._scene = scene;
    this._camera = camera;

    this._rod = new FishingRod(camera, getTerrainHeight);
    this._biteSystem = new BiteSystem();
    this._minigame = new FishingMinigame();

    // Add lure and line meshes to scene
    scene.add(this._rod.lureMesh);
    scene.add(this._rod.lineMesh);

    // HUD elements for cast power
    this._castPowerEl = null;
    this._createCastPowerHUD();

    // Bite indicator
    this._biteIndicatorEl = null;
    this._createBiteIndicatorHUD();

    // Result message
    this._resultEl = null;
    this._resultTimer = 0;

    // Listen for events
    eventBus.on('fishing:bite', () => this._showBiteIndicator());
    eventBus.on('fishing:biteMissed', () => this._hideBiteIndicator());
    eventBus.on('fishing:missedWater', () => this._showResult('Missed the water!', '#eab308'));
    eventBus.on('minigame:end', (data) => this._onMinigameEnd(data));
  }

  get rod() { return this._rod; }
  get biteSystem() { return this._biteSystem; }
  get minigame() { return this._minigame; }

  /**
   * Set conditions for the bite system based on current world state.
   */
  setConditions(conditions) {
    this._biteSystem.setConditions(conditions);
  }

  /**
   * Update each frame.
   * @param {number} delta
   */
  update(delta) {
    // Update rod (cast, lure flight, line)
    this._rod.update(delta);

    // Update cast power HUD
    this._updateCastPowerHUD();

    // Update bite system when lure is in water
    if (this._rod.isLureInWater && !this._minigame.isActive) {
      const biteResult = this._biteSystem.update(delta);

      if (biteResult.biting && inputManager.isPointerLocked && inputManager.isActionDown('reel')) {
        // Player reeled during bite window — hook the fish!
        const fish = this._biteSystem.hookFish();
        if (fish) {
          this._startMinigame(fish);
        }
      }
    }

    // Update minigame
    if (this._minigame.isActive) {
      this._minigame.update(delta);
    }

    // Result message timer
    if (this._resultTimer > 0) {
      this._resultTimer -= delta;
      if (this._resultTimer <= 0) {
        this._hideResult();
      }
    }
  }

  _startMinigame(fish) {
    this._hideBiteIndicator();
    this._rod.startReeling();

    // Generate actual weight from species range using position-seeded PRNG
    const lurePos = this._rod.lurePosition;
    const weightSeed = (Math.floor(lurePos.x * 100) * 73856) ^ (Math.floor(lurePos.z * 100) * 19349) ^ Date.now();
    const rng = mulberry32(weightSeed);
    const weight = fish.weightMin + rng() * (fish.weightMax - fish.weightMin);
    const roundedWeight = Math.round(weight * 100) / 100;

    this._minigame.start(fish, roundedWeight);
  }

  _onMinigameEnd(data) {
    this._rod.finishFishing();

    switch (data.result) {
      case 'landed':
        this._showResult(
          `Caught ${data.fish.name}! ${data.weight.toFixed(1)}kg`,
          '#4ade80'
        );
        eventBus.emit('fishing:caught', {
          species: data.fish,
          weight: data.weight,
          quality: this._determineQuality(data.fish, data.weight),
        });
        break;
      case 'escaped':
        this._showResult('The fish escaped!', '#ef4444');
        break;
      case 'lineBreak':
        this._showResult('Line snapped!', '#ef4444');
        break;
    }
  }

  _determineQuality(fish, weight) {
    const range = fish.weightMax - fish.weightMin;
    const ratio = (weight - fish.weightMin) / range;
    if (ratio >= 0.95) return 'Trophy';
    if (ratio >= 0.7) return 'Great';
    if (ratio >= 0.4) return 'Good';
    return 'Poor';
  }

  // ============================================
  // HUD Elements
  // ============================================
  _createCastPowerHUD() {
    this._castPowerEl = document.createElement('div');
    this._castPowerEl.id = 'cast-power-hud';
    this._castPowerEl.style.cssText = `
      position: absolute; bottom: 50%; left: 50%; transform: translate(-50%, 50%);
      width: 8px; height: 120px; background: rgba(0,0,0,0.4);
      border-radius: 4px; overflow: hidden; display: none; z-index: 25;
      pointer-events: none;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      position: absolute; bottom: 0; left: 0; width: 100%;
      background: linear-gradient(to top, #22c55e, #eab308, #ef4444);
      border-radius: 4px; transition: height 0.05s;
    `;
    this._castPowerEl._fill = fill;
    this._castPowerEl.appendChild(fill);
    document.getElementById('ui-layer').appendChild(this._castPowerEl);
  }

  _updateCastPowerHUD() {
    if (this._rod.state === this._rod.STATE_CHARGING) {
      this._castPowerEl.style.display = 'block';
      this._castPowerEl._fill.style.height = `${this._rod.castPower}%`;
    } else {
      this._castPowerEl.style.display = 'none';
    }
  }

  _createBiteIndicatorHUD() {
    this._biteIndicatorEl = document.createElement('div');
    this._biteIndicatorEl.id = 'bite-indicator';
    this._biteIndicatorEl.textContent = '! BITE !';
    this._biteIndicatorEl.style.cssText = `
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      font-size: 24px; font-weight: bold; color: #eab308;
      text-shadow: 0 0 10px rgba(234,179,8,0.5);
      display: none; z-index: 25; pointer-events: none;
      animation: pulse 0.3s ease-in-out infinite alternate;
    `;
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `@keyframes pulse { from { transform: translate(-50%,-50%) scale(1); } to { transform: translate(-50%,-50%) scale(1.15); } }`;
    document.head.appendChild(style);
    document.getElementById('ui-layer').appendChild(this._biteIndicatorEl);
  }

  _showBiteIndicator() {
    if (this._biteIndicatorEl) this._biteIndicatorEl.style.display = 'block';
  }

  _hideBiteIndicator() {
    if (this._biteIndicatorEl) this._biteIndicatorEl.style.display = 'none';
  }

  _showResult(text, color) {
    if (!this._resultEl) {
      this._resultEl = document.createElement('div');
      this._resultEl.style.cssText = `
        position: absolute; top: 35%; left: 50%; transform: translateX(-50%);
        font-size: 20px; font-weight: 600; pointer-events: none; z-index: 25;
        transition: opacity 0.3s;
      `;
      document.getElementById('ui-layer').appendChild(this._resultEl);
    }
    this._resultEl.textContent = text;
    this._resultEl.style.color = color;
    this._resultEl.style.opacity = '1';
    this._resultTimer = 3;
  }

  _hideResult() {
    if (this._resultEl) {
      this._resultEl.style.opacity = '0';
    }
  }

  dispose() {
    this._rod.dispose();
    this._biteSystem.dispose();
    this._minigame.dispose();
    if (this._castPowerEl && this._castPowerEl.parentNode) {
      this._castPowerEl.parentNode.removeChild(this._castPowerEl);
    }
    if (this._biteIndicatorEl && this._biteIndicatorEl.parentNode) {
      this._biteIndicatorEl.parentNode.removeChild(this._biteIndicatorEl);
    }
    if (this._resultEl && this._resultEl.parentNode) {
      this._resultEl.parentNode.removeChild(this._resultEl);
    }
  }
}
