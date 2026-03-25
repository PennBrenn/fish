/**
 * FishingMinigame - Reel tension bar, fish stamina, landing/escape.
 * Imports: EventBus, InputManager.
 * Exports: FishingMinigame class.
 *
 * Tension bar: green (center), yellow (sides), red (extremes).
 * Player holds reel button = increase tension, release = decrease.
 * Fish pulls based on weight and fight rating.
 * Fish position 0 (escaped) to 1 (landed).
 * Fish stamina decreases over time proportional to tension zone.
 * Line breaks if tension in red zone > 0.5s.
 * Per spec: do NOT process input on the frame fish is hooked (wait 1 frame).
 */

import inputManager from '../core/InputManager.js';
import eventBus from '../core/EventBus.js';

// Tension zones (0-1 range)
const RED_LOW = 0.0;
const YELLOW_LOW = 0.15;
const GREEN_LOW = 0.35;
const GREEN_HIGH = 0.65;
const YELLOW_HIGH = 0.85;
const RED_HIGH = 1.0;

const LINE_BREAK_TIME = 0.5; // seconds in red before line breaks

export default class FishingMinigame {
  constructor() {
    this._active = false;
    this._fish = null;
    this._skipFirstFrame = false; // Per spec: don't process input first frame

    // Minigame state
    this._tension = 0.5;      // 0 to 1
    this._fishPosition = 0.5; // 0 = escaped, 1 = landed
    this._fishStamina = 1.0;  // 0 = exhausted
    this._redZoneTime = 0;    // seconds spent in red zone
    this._fishSurgeTimer = 0; // timer for periodic fish surges
    this._surgeActive = false;
    this._surgeDirection = 0; // -1 or 1

    // Fish stats (set from species)
    this._fishWeight = 1;
    this._fishFight = 5;
    this._fishPullForce = 0;

    // Result
    this._result = null; // 'landed', 'escaped', 'lineBreak'

    // HUD elements (created on start)
    this._hudContainer = null;
    this._tensionBar = null;
    this._tensionIndicator = null;
    this._fishPosBar = null;
    this._fishPosIndicator = null;
    this._staminaBar = null;
  }

  get isActive() {
    return this._active;
  }

  get tension() {
    return this._tension;
  }

  get fishPosition() {
    return this._fishPosition;
  }

  get fishStamina() {
    return this._fishStamina;
  }

  get result() {
    return this._result;
  }

  /**
   * Start the minigame with a hooked fish.
   * @param {object} fish - fish species data
   * @param {number} actualWeight - randomly generated weight for this catch
   */
  start(fish, actualWeight) {
    this._fish = fish;
    this._fishWeight = actualWeight;
    this._fishFight = fish.fightRating;
    this._fishPullForce = (fish.fightRating / 10) * 0.8 + (actualWeight / fish.weightMax) * 0.4;

    this._tension = 0.5;
    this._fishPosition = 0.5;
    this._fishStamina = 1.0;
    this._redZoneTime = 0;
    this._fishSurgeTimer = 0;
    this._surgeActive = false;
    this._result = null;
    this._skipFirstFrame = true; // Skip input on first frame
    this._active = true;

    this._createHUD();
    eventBus.emit('minigame:start', { fish, weight: actualWeight });
  }

  /**
   * Update each frame.
   * @param {number} delta
   * @returns {string|null} Result: 'landed', 'escaped', 'lineBreak', or null if ongoing
   */
  update(delta) {
    if (!this._active) return null;

    // Skip first frame input per spec
    if (this._skipFirstFrame) {
      this._skipFirstFrame = false;
      this._updateHUD();
      return null;
    }

    // Player input: reel button increases tension, release decreases
    if (inputManager.isPointerLocked && inputManager.isActionDown('reel')) {
      this._tension += 1.2 * delta;
    } else {
      this._tension -= 0.8 * delta;
    }
    this._tension = Math.max(0, Math.min(1, this._tension));

    // Determine tension zone
    const zone = this._getTensionZone();

    // Fish surge mechanics
    this._fishSurgeTimer += delta;
    const surgeInterval = 3 + (1 - this._fishFight / 10) * 5; // Higher fight = more frequent
    if (this._fishSurgeTimer >= surgeInterval) {
      this._fishSurgeTimer = 0;
      this._surgeActive = true;
      this._surgeDirection = Math.random() < 0.5 ? -1 : 1;
      setTimeout(() => { this._surgeActive = false; }, 800);
    }

    // Fish pull force (affected by stamina)
    let fishPull = this._fishPullForce * this._fishStamina;
    if (this._surgeActive) {
      fishPull *= 2.0; // Surges double pull force
    }

    // Fish position movement
    if (zone === 'green') {
      // Steady reel in
      this._fishPosition += (0.08 - fishPull * 0.03) * delta;
      this._fishStamina -= 0.06 * delta; // Fish tires
    } else if (zone === 'yellow') {
      // Fish tires faster but line stress
      this._fishPosition += (0.03 - fishPull * 0.05) * delta;
      this._fishStamina -= 0.1 * delta;
    } else if (zone === 'red') {
      // Fish moves toward escape, or line breaks
      this._fishPosition -= fishPull * 0.15 * delta;
      this._fishStamina -= 0.04 * delta;
      this._redZoneTime += delta;
    } else {
      this._redZoneTime = 0;
    }

    // Reset red zone timer when not in red
    if (zone !== 'red') {
      this._redZoneTime = Math.max(0, this._redZoneTime - delta * 2);
    }

    // Apply fish surge to position
    if (this._surgeActive) {
      this._fishPosition -= this._surgeDirection * fishPull * 0.1 * delta;
    }

    // Clamp values
    this._fishPosition = Math.max(0, Math.min(1, this._fishPosition));
    this._fishStamina = Math.max(0, Math.min(1, this._fishStamina));

    // Check end conditions
    if (this._redZoneTime >= LINE_BREAK_TIME) {
      this._finish('lineBreak');
      return 'lineBreak';
    }

    if (this._fishPosition >= 1 || this._fishStamina <= 0) {
      this._finish('landed');
      return 'landed';
    }

    if (this._fishPosition <= 0) {
      this._finish('escaped');
      return 'escaped';
    }

    this._updateHUD();
    return null;
  }

  _getTensionZone() {
    if (this._tension < YELLOW_LOW || this._tension > YELLOW_HIGH) return 'red';
    if (this._tension < GREEN_LOW || this._tension > GREEN_HIGH) return 'yellow';
    return 'green';
  }

  _finish(result) {
    this._result = result;
    this._active = false;
    this._removeHUD();

    eventBus.emit('minigame:end', {
      result,
      fish: this._fish,
      weight: this._fishWeight,
    });
  }

  // =============================================
  // HUD rendering (HTML overlay)
  // =============================================
  _createHUD() {
    this._removeHUD(); // Clean up any existing

    this._hudContainer = document.createElement('div');
    this._hudContainer.id = 'fishing-minigame-hud';
    this._hudContainer.style.cssText = `
      position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%);
      width: 320px; pointer-events: none; z-index: 25;
      font-family: 'Segoe UI', sans-serif; color: #fff; text-align: center;
    `;

    // Fish name
    const nameEl = document.createElement('div');
    nameEl.textContent = this._fish ? `${this._fish.name} (${this._fishWeight.toFixed(1)}kg)` : 'Unknown Fish';
    nameEl.style.cssText = 'font-size: 14px; margin-bottom: 6px; color: #4ade80;';
    this._hudContainer.appendChild(nameEl);

    // Tension bar
    const tensionLabel = document.createElement('div');
    tensionLabel.textContent = 'Tension';
    tensionLabel.style.cssText = 'font-size: 11px; margin-bottom: 2px; opacity: 0.7;';
    this._hudContainer.appendChild(tensionLabel);

    this._tensionBar = document.createElement('div');
    this._tensionBar.style.cssText = `
      width: 100%; height: 16px; background: linear-gradient(to right,
        #ef4444 0%, #ef4444 15%, #eab308 15%, #eab308 35%,
        #22c55e 35%, #22c55e 65%, #eab308 65%, #eab308 85%,
        #ef4444 85%, #ef4444 100%);
      border-radius: 4px; position: relative; overflow: hidden;
    `;
    this._tensionIndicator = document.createElement('div');
    this._tensionIndicator.style.cssText = `
      position: absolute; top: 0; width: 4px; height: 100%;
      background: #fff; border-radius: 2px; transition: left 0.05s;
    `;
    this._tensionBar.appendChild(this._tensionIndicator);
    this._hudContainer.appendChild(this._tensionBar);

    // Fish position bar
    const fishLabel = document.createElement('div');
    fishLabel.textContent = 'Reel Progress';
    fishLabel.style.cssText = 'font-size: 11px; margin-top: 6px; margin-bottom: 2px; opacity: 0.7;';
    this._hudContainer.appendChild(fishLabel);

    this._fishPosBar = document.createElement('div');
    this._fishPosBar.style.cssText = `
      width: 100%; height: 10px; background: rgba(255,255,255,0.15);
      border-radius: 3px; position: relative; overflow: hidden;
    `;
    this._fishPosIndicator = document.createElement('div');
    this._fishPosIndicator.style.cssText = `
      position: absolute; top: 0; left: 0; height: 100%;
      background: #4ade80; border-radius: 3px; transition: width 0.1s;
    `;
    this._fishPosBar.appendChild(this._fishPosIndicator);
    this._hudContainer.appendChild(this._fishPosBar);

    // Stamina bar
    const stamLabel = document.createElement('div');
    stamLabel.textContent = 'Fish Stamina';
    stamLabel.style.cssText = 'font-size: 11px; margin-top: 6px; margin-bottom: 2px; opacity: 0.7;';
    this._hudContainer.appendChild(stamLabel);

    this._staminaBar = document.createElement('div');
    this._staminaBar.style.cssText = `
      width: 100%; height: 8px; background: rgba(255,255,255,0.15);
      border-radius: 3px; position: relative; overflow: hidden;
    `;
    const staminaFill = document.createElement('div');
    staminaFill.style.cssText = `
      position: absolute; top: 0; left: 0; height: 100%;
      background: #f97316; border-radius: 3px; transition: width 0.1s;
      width: 100%;
    `;
    this._staminaBar._fill = staminaFill;
    this._staminaBar.appendChild(staminaFill);
    this._hudContainer.appendChild(this._staminaBar);

    document.getElementById('ui-layer').appendChild(this._hudContainer);
  }

  _updateHUD() {
    if (!this._hudContainer) return;

    // Tension indicator position
    if (this._tensionIndicator) {
      this._tensionIndicator.style.left = `${this._tension * 100}%`;
    }

    // Fish position
    if (this._fishPosIndicator) {
      this._fishPosIndicator.style.width = `${this._fishPosition * 100}%`;
    }

    // Stamina
    if (this._staminaBar && this._staminaBar._fill) {
      this._staminaBar._fill.style.width = `${this._fishStamina * 100}%`;
    }
  }

  _removeHUD() {
    if (this._hudContainer && this._hudContainer.parentNode) {
      this._hudContainer.parentNode.removeChild(this._hudContainer);
    }
    this._hudContainer = null;
    this._tensionBar = null;
    this._tensionIndicator = null;
    this._fishPosBar = null;
    this._fishPosIndicator = null;
    this._staminaBar = null;
  }

  dispose() {
    this._removeHUD();
    this._active = false;
  }
}
