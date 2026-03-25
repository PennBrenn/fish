/**
 * LightingSystem - Sun, sky, time of day, shadows.
 * Imports: Three.js, Settings, EventBus.
 * Exports: LightingSystem class.
 * 
 * Manages:
 * - DirectionalLight (sun) with castShadow, frustum follows player
 * - HemisphereLight for sky/ground ambient
 * - AmbientLight at very low intensity (0.05) as fill
 * - 20-minute real-time full day cycle
 * - Night PointLight at player position
 * 
 * Reuses Vector3/Color objects per frame to avoid GC pressure.
 */

import * as THREE from 'three';
import settings from '../core/Settings.js';
import eventBus from '../core/EventBus.js';

const DAY_CYCLE_DURATION = 20 * 60; // 20 minutes in seconds for a full day
const DEG2RAD = Math.PI / 180;

// Pre-defined colors for time-of-day interpolation
const SUN_COLORS = {
  dawn:  new THREE.Color(0xff6b35),  // deep orange
  noon:  new THREE.Color(0xffffff),  // white
  dusk:  new THREE.Color(0xff8c42),  // orange
  night: new THREE.Color(0x000000),  // off
};

const SKY_COLORS = {
  dawn:  new THREE.Color(0xffb347),
  noon:  new THREE.Color(0x87ceeb),
  dusk:  new THREE.Color(0xff7043),
  night: new THREE.Color(0x0a1628),
};

const GROUND_COLORS = {
  dawn:  new THREE.Color(0x8b7355),
  noon:  new THREE.Color(0x8b7355),
  dusk:  new THREE.Color(0x6b5340),
  night: new THREE.Color(0x1a1a2e),
};

const SHADOW_MAP_SIZES = {
  off: 0,
  low: 512,
  medium: 1024,
  high: 2048,
};

export default class LightingSystem {
  constructor(scene) {
    this._scene = scene;
    this._timeOfDay = 0.5; // 0-1 representing full day cycle, 0.5 = noon

    // Reusable vectors (never allocate in update loop)
    this._sunDirection = new THREE.Vector3();
    this._tempColor = new THREE.Color();
    this._playerPos = new THREE.Vector3();

    // --- Sun (DirectionalLight) ---
    this._sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this._sunLight.castShadow = true;
    this._updateShadowMapSize();
    this._sunLight.shadow.camera.near = 0.5;
    this._sunLight.shadow.camera.far = settings.get('shadowDistance');
    this._sunLight.shadow.camera.left = -50;
    this._sunLight.shadow.camera.right = 50;
    this._sunLight.shadow.camera.top = 50;
    this._sunLight.shadow.camera.bottom = -50;
    this._sunLight.position.set(50, 80, 30);
    scene.add(this._sunLight);
    scene.add(this._sunLight.target);

    // --- Hemisphere Light ---
    this._hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.6);
    scene.add(this._hemiLight);

    // --- Ambient fill ---
    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(this._ambientLight);

    // --- Night player light ---
    this._nightLight = new THREE.PointLight(0x4466aa, 0, 10);
    scene.add(this._nightLight);

    // Listen for shadow quality changes
    this._onShadowChange = () => this._updateShadowMapSize();
    settings.onChange('shadowQuality', this._onShadowChange);

    this._onShadowDistChange = (val) => {
      this._sunLight.shadow.camera.far = val;
      this._sunLight.shadow.camera.updateProjectionMatrix();
    };
    settings.onChange('shadowDistance', this._onShadowDistChange);
  }

  get timeOfDay() {
    return this._timeOfDay;
  }

  /**
   * Returns in-game hour (0-24 float).
   */
  get hour() {
    return this._timeOfDay * 24;
  }

  /**
   * Returns formatted time string "HH:MM".
   */
  get timeString() {
    const h = this.hour;
    const hours = Math.floor(h);
    const minutes = Math.floor((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Set time of day directly (0-1).
   */
  setTime(t) {
    this._timeOfDay = t % 1;
  }

  _updateShadowMapSize() {
    const q = settings.get('shadowQuality');
    const size = SHADOW_MAP_SIZES[q] || 1024;
    if (size > 0) {
      this._sunLight.shadow.mapSize.width = size;
      this._sunLight.shadow.mapSize.height = size;
      // Force shadow map regeneration
      if (this._sunLight.shadow.map) {
        this._sunLight.shadow.map.dispose();
        this._sunLight.shadow.map = null;
      }
    }
  }

  /**
   * Update lighting each frame.
   * @param {number} delta - seconds since last frame
   * @param {THREE.Vector3} playerPosition - player world position
   */
  update(delta, playerPosition) {
    // Advance time of day
    this._timeOfDay += delta / DAY_CYCLE_DURATION;
    if (this._timeOfDay >= 1) this._timeOfDay -= 1;

    const hour = this.hour;

    // --- Sun position ---
    // Sun orbits around the scene: angle based on time of day
    // Dawn at hour 6, noon at 12, dusk at 18, midnight at 0/24
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2; // 0 at dawn, PI at dusk
    const sunElevation = Math.sin(sunAngle);
    const sunAzimuth = Math.cos(sunAngle);

    this._sunDirection.set(
      sunAzimuth * 60,
      sunElevation * 80,
      Math.sin(sunAngle * 0.7) * 30
    );

    // Position sun relative to player for shadow following
    if (playerPosition) {
      this._playerPos.copy(playerPosition);
    }
    this._sunLight.position.copy(this._playerPos).add(this._sunDirection);
    this._sunLight.target.position.copy(this._playerPos);

    // --- Sun color and intensity ---
    const sunIntensity = Math.max(0, sunElevation);
    this._sunLight.intensity = sunIntensity * 1.2;

    if (hour >= 5 && hour < 8) {
      // Dawn
      const t = (hour - 5) / 3;
      this._sunLight.color.copy(SUN_COLORS.dawn).lerp(SUN_COLORS.noon, t);
    } else if (hour >= 8 && hour < 16) {
      // Day
      this._sunLight.color.copy(SUN_COLORS.noon);
    } else if (hour >= 16 && hour < 19) {
      // Dusk
      const t = (hour - 16) / 3;
      this._sunLight.color.copy(SUN_COLORS.noon).lerp(SUN_COLORS.dusk, t);
    } else {
      // Night
      this._sunLight.color.copy(SUN_COLORS.night);
      this._sunLight.intensity = 0;
    }

    // --- Hemisphere light ---
    if (hour >= 5 && hour < 8) {
      const t = (hour - 5) / 3;
      this._hemiLight.color.copy(SKY_COLORS.dawn).lerp(SKY_COLORS.noon, t);
      this._hemiLight.groundColor.copy(GROUND_COLORS.dawn).lerp(GROUND_COLORS.noon, t);
      this._hemiLight.intensity = 0.3 + t * 0.3;
    } else if (hour >= 8 && hour < 16) {
      this._hemiLight.color.copy(SKY_COLORS.noon);
      this._hemiLight.groundColor.copy(GROUND_COLORS.noon);
      this._hemiLight.intensity = 0.6;
    } else if (hour >= 16 && hour < 19) {
      const t = (hour - 16) / 3;
      this._hemiLight.color.copy(SKY_COLORS.noon).lerp(SKY_COLORS.dusk, t);
      this._hemiLight.groundColor.copy(GROUND_COLORS.noon).lerp(GROUND_COLORS.dusk, t);
      this._hemiLight.intensity = 0.6 - t * 0.3;
    } else {
      this._hemiLight.color.copy(SKY_COLORS.night);
      this._hemiLight.groundColor.copy(GROUND_COLORS.night);
      this._hemiLight.intensity = 0.15;
    }

    // --- Scene background follows sky ---
    if (this._scene.background && this._scene.background.isColor) {
      this._scene.background.copy(this._hemiLight.color);
    }

    // --- Night player light ---
    const isNight = hour < 5 || hour > 19;
    if (isNight && playerPosition) {
      this._nightLight.intensity = 0.4;
      this._nightLight.position.copy(playerPosition);
      this._nightLight.position.y += 1.5;
    } else {
      this._nightLight.intensity = 0;
    }

    // Emit time update for debug and other systems
    eventBus.emit('time:update', {
      timeOfDay: this._timeOfDay,
      hour,
      timeString: this.timeString,
      isNight,
    });
  }

  dispose() {
    settings.offChange('shadowQuality', this._onShadowChange);
    settings.offChange('shadowDistance', this._onShadowDistChange);

    this._scene.remove(this._sunLight);
    this._scene.remove(this._sunLight.target);
    this._scene.remove(this._hemiLight);
    this._scene.remove(this._ambientLight);
    this._scene.remove(this._nightLight);

    if (this._sunLight.shadow.map) {
      this._sunLight.shadow.map.dispose();
    }
  }
}
