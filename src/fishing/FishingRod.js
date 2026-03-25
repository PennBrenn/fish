/**
 * FishingRod - First-person rod model, cast mechanics, line rendering.
 * Imports: Three.js, InputManager, Settings, EventBus.
 * Exports: FishingRod class.
 *
 * Rod visible in first-person as right-hand held object.
 * Three cylinders (handle, middle, tip) attached to camera with fixed offset.
 * Cast: hold cast button to charge power (0-100% over 2s), release to cast.
 * Lure trajectory: parabolic arc to water plane Y=0.
 * Line: CatmullRomCurve3 with 20 points, updated each frame.
 */

import * as THREE from 'three';
import inputManager from '../core/InputManager.js';
import eventBus from '../core/EventBus.js';

const ROD_OFFSET = new THREE.Vector3(0.35, -0.25, -0.6);
const CAST_CHARGE_RATE = 50; // percent per second (2s to full)
const CAST_MIN_DIST = 5;
const CAST_MAX_DIST = 40;
const LURE_GRAVITY = 4.9;

// States
const STATE_IDLE = 0;
const STATE_CHARGING = 1;
const STATE_CASTING = 2;
const STATE_LURE_IN_WATER = 3;
const STATE_REELING = 4;

export default class FishingRod {
  /**
   * @param {THREE.Camera} camera
   * @param {function(number, number): number} getTerrainHeight
   */
  constructor(camera, getTerrainHeight) {
    this._camera = camera;
    this._getTerrainHeight = getTerrainHeight;
    this.state = STATE_IDLE;

    // Rod mesh group (child of camera)
    this._rodGroup = new THREE.Group();
    this._buildRodMesh();
    camera.add(this._rodGroup);

    // Cast state
    this._castPower = 0;
    this._castDirection = new THREE.Vector3();
    this._castStartPos = new THREE.Vector3();

    // Lure
    this._lurePosition = new THREE.Vector3();
    this._lureVelocity = new THREE.Vector3();
    this._lureInFlight = false;
    this._lureLanded = false;
    this._lureMesh = null;
    this._buildLureMesh();

    // Line
    this._lineCurve = null;
    this._lineGeometry = null;
    this._lineMesh = null;
    this._linePoints = [];
    for (let i = 0; i < 20; i++) {
      this._linePoints.push(new THREE.Vector3());
    }
    this._buildLineMesh();

    // Idle sway
    this._swayTime = 0;

    // Reusable vectors
    this._tempVec = new THREE.Vector3();
    this._rodTipWorld = new THREE.Vector3();

    // Expose states as constants
    this.STATE_IDLE = STATE_IDLE;
    this.STATE_CHARGING = STATE_CHARGING;
    this.STATE_CASTING = STATE_CASTING;
    this.STATE_LURE_IN_WATER = STATE_LURE_IN_WATER;
    this.STATE_REELING = STATE_REELING;
  }

  get castPower() {
    return this._castPower;
  }

  get lurePosition() {
    return this._lurePosition;
  }

  get isLureInWater() {
    return this.state === STATE_LURE_IN_WATER;
  }

  _buildRodMesh() {
    // Three cylinders of decreasing radius
    const matHandle = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
    const matMiddle = new THREE.MeshStandardMaterial({ color: 0x6b4c30, roughness: 0.7 });
    const matTip = new THREE.MeshStandardMaterial({ color: 0x8b6b40, roughness: 0.6 });

    const handleGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6);
    const middleGeo = new THREE.CylinderGeometry(0.008, 0.015, 0.4, 5);
    const tipGeo = new THREE.CylinderGeometry(0.003, 0.008, 0.5, 4);

    const handle = new THREE.Mesh(handleGeo, matHandle);
    handle.position.set(0, 0, 0);
    handle.rotation.x = Math.PI * 0.15;

    const middle = new THREE.Mesh(middleGeo, matMiddle);
    middle.position.set(0, 0.3, -0.08);
    middle.rotation.x = Math.PI * 0.12;

    const tip = new THREE.Mesh(tipGeo, matTip);
    tip.position.set(0, 0.6, -0.15);
    tip.rotation.x = Math.PI * 0.1;

    this._rodGroup.add(handle, middle, tip);
    this._rodGroup.position.copy(ROD_OFFSET);
    this._tipRef = tip;
  }

  _buildLureMesh() {
    const geo = new THREE.SphereGeometry(0.06, 6, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5, metalness: 0.3 });
    this._lureMesh = new THREE.Mesh(geo, mat);
    this._lureMesh.visible = false;
    // Add to scene (not camera) — it exists in world space
    // Will be added to scene externally
  }

  get lureMesh() {
    return this._lureMesh;
  }

  _buildLineMesh() {
    this._lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    this._lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xcccccc, linewidth: 1 });
    this._lineMesh = new THREE.Line(this._lineGeometry, mat);
    this._lineMesh.frustumCulled = false;
    this._lineMesh.visible = false;
  }

  get lineMesh() {
    return this._lineMesh;
  }

  /**
   * Update each frame.
   * @param {number} delta
   * @param {THREE.Vector3} playerPosition - player feet position
   */
  update(delta) {
    this._updateIdleSway(delta);

    switch (this.state) {
      case STATE_IDLE:
        this._updateIdle(delta);
        break;
      case STATE_CHARGING:
        this._updateCharging(delta);
        break;
      case STATE_CASTING:
        this._updateCasting(delta);
        break;
      case STATE_LURE_IN_WATER:
        this._updateLureInWater(delta);
        break;
      case STATE_REELING:
        // Handled by FishingMinigame
        break;
    }

    this._updateLine();
  }

  _updateIdleSway(delta) {
    this._swayTime += delta;
    const swayX = Math.sin(this._swayTime * 1.5) * 0.003;
    const swayY = Math.sin(this._swayTime * 2.1) * 0.002;
    this._rodGroup.rotation.z = swayX;
    this._rodGroup.rotation.x = swayY;
  }

  _updateIdle(delta) {
    this._lureMesh.visible = false;
    this._lineMesh.visible = false;

    // Check for cast button press
    if (inputManager.isPointerLocked && inputManager.isActionDown('cast')) {
      this.state = STATE_CHARGING;
      this._castPower = 0;
    }
  }

  _updateCharging(delta) {
    this._castPower += CAST_CHARGE_RATE * delta;
    if (this._castPower > 100) this._castPower = 100;

    // Animate rod bending back
    this._rodGroup.rotation.x = -0.3 * (this._castPower / 100);

    // Release to cast
    if (!inputManager.isActionDown('cast')) {
      this._executeCast();
    }
  }

  _executeCast() {
    // Cast direction: camera forward projected onto XZ plane
    this._camera.getWorldDirection(this._castDirection);
    this._castDirection.y = 0;
    this._castDirection.normalize();

    // Get rod tip world position as lure start
    this._tipRef.getWorldPosition(this._castStartPos);
    this._lurePosition.copy(this._castStartPos);

    // Calculate lure velocity
    const power = this._castPower / 100;
    const dist = CAST_MIN_DIST + (CAST_MAX_DIST - CAST_MIN_DIST) * power;
    const speed = dist * 1.5; // Velocity to cover distance
    this._lureVelocity.copy(this._castDirection).multiplyScalar(speed);
    this._lureVelocity.y = speed * 0.4; // Upward arc

    this._lureInFlight = true;
    this._lureLanded = false;
    this._lureMesh.visible = true;
    this._lineMesh.visible = true;
    this.state = STATE_CASTING;
    this._castPower = 0;

    // Reset rod rotation
    this._rodGroup.rotation.x = 0;

    eventBus.emit('fishing:cast', { power: this._castPower, direction: this._castDirection });
  }

  _updateCasting(delta) {
    if (!this._lureInFlight) return;

    // Parabolic trajectory
    this._lureVelocity.y -= LURE_GRAVITY * delta * 10;
    this._lurePosition.addScaledVector(this._lureVelocity, delta);

    this._lureMesh.position.copy(this._lurePosition);

    // Check landing on water (Y=0)
    if (this._lurePosition.y <= 0) {
      this._lurePosition.y = 0;
      this._lureInFlight = false;
      this._lureLanded = true;
      this._lureMesh.position.copy(this._lurePosition);

      // Check if it landed on terrain (missed water)
      const terrainH = this._getTerrainHeight(this._lurePosition.x, this._lurePosition.z);
      if (terrainH > 0.1) {
        // Missed water — land on terrain
        this._lurePosition.y = terrainH;
        this._lureMesh.position.y = terrainH;
        eventBus.emit('fishing:missedWater');
        // Auto-reel back after short delay
        setTimeout(() => {
          if (this.state === STATE_CASTING) {
            this.reelIn();
          }
        }, 1500);
      } else {
        // Landed in water
        this.state = STATE_LURE_IN_WATER;
        eventBus.emit('fishing:lureInWater', {
          x: this._lurePosition.x,
          z: this._lurePosition.z,
        });
      }
    }

    // Check if lure hit terrain above water
    const terrainH = this._getTerrainHeight(this._lurePosition.x, this._lurePosition.z);
    if (this._lurePosition.y <= terrainH && terrainH > 0.1) {
      this._lurePosition.y = terrainH;
      this._lureInFlight = false;
      this._lureMesh.position.copy(this._lurePosition);
      eventBus.emit('fishing:missedWater');
      setTimeout(() => {
        if (this.state === STATE_CASTING) {
          this.reelIn();
        }
      }, 1500);
    }
  }

  _updateLureInWater(delta) {
    // Gentle bobbing
    this._lurePosition.y = Math.sin(this._swayTime * 2) * 0.02;
    this._lureMesh.position.copy(this._lurePosition);

    // Player can reel in at any time
    if (inputManager.isPointerLocked && inputManager.isActionDown('reel')) {
      // If no fish is hooked, just reel in
      // BiteSystem will intercept this if a fish is biting
      if (!this._fishHooked) {
        this.reelIn();
      }
    }
  }

  _updateLine() {
    if (!this._lineMesh.visible) return;

    // Rod tip world position
    this._tipRef.getWorldPosition(this._rodTipWorld);

    // Generate line points from rod tip to lure with sag
    const posAttr = this._lineGeometry.getAttribute('position');
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      // Lerp from rod tip to lure
      const x = this._rodTipWorld.x + (this._lurePosition.x - this._rodTipWorld.x) * t;
      const z = this._rodTipWorld.z + (this._lurePosition.z - this._rodTipWorld.z) * t;
      // Y with sag (catenary approximation)
      const baseY = this._rodTipWorld.y + (this._lurePosition.y - this._rodTipWorld.y) * t;
      const sag = Math.sin(t * Math.PI) * -0.3 * (1 - this._castPower / 200);
      const y = baseY + sag;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Called when a fish bites and player reels — transition to minigame.
   */
  startReeling() {
    this._fishHooked = true;
    this.state = STATE_REELING;
    eventBus.emit('fishing:hookSet');
  }

  /**
   * Reel in (no fish). Returns to idle.
   */
  reelIn() {
    this.state = STATE_IDLE;
    this._lureInFlight = false;
    this._lureLanded = false;
    this._fishHooked = false;
    this._lureMesh.visible = false;
    this._lineMesh.visible = false;
    this._castPower = 0;
    eventBus.emit('fishing:reelIn');
  }

  /**
   * Fish landed or escaped — return to idle.
   */
  finishFishing() {
    this.reelIn();
  }

  dispose() {
    if (this._rodGroup.parent) {
      this._rodGroup.parent.remove(this._rodGroup);
    }
  }
}
