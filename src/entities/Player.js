/**
 * Player - First-person controller with capsule collision.
 * Imports: Three.js, InputManager, Settings, EventBus.
 * Exports: Player class.
 *
 * Capsule: radius 0.4, height 1.8, origin at feet.
 * Eye height: 1.7 units above origin.
 * Yaw on player object Y rotation, pitch on camera X rotation (clamped ±89°).
 * Axis-separated collision: X → test → Y → test → Z → test.
 * Terrain collision via heightmap lookup (ChunkManager.getTerrainHeight).
 * No new Vector3/Quaternion allocations in update loop.
 */

import * as THREE from 'three';
import inputManager from '../core/InputManager.js';
import settings from '../core/Settings.js';
import eventBus from '../core/EventBus.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Player constants
const CAPSULE_RADIUS = 0.4;
const CAPSULE_HEIGHT = 1.8;
const EYE_HEIGHT = 1.7;
const WALK_SPEED = 5;
const SPRINT_SPEED = 10;
const SWIM_SPEED = 3;
const GRAVITY = -20;
const JUMP_IMPULSE = 8;
const MAX_FALL_SPEED = -40;
const WATER_GRAVITY = -5;
const WATER_BUOYANCY = 4;
const WATER_MAX_VERT_SPEED = 2;
const WATER_DRAG = 0.85;
const WATER_JUMP_IMPULSE = 3;
const SLOPE_LIMIT_Y = 0.7; // Normal Y below this = too steep
const GROUND_CHECK_DIST = 0.05;
const MAX_STAMINA = 100;
const STAMINA_DRAIN = 20; // per second while sprinting
const STAMINA_REGEN = 15; // per second while not sprinting
const SPRINT_SLOPE_LIMIT = 20 * DEG2RAD;

// Head bobbing
const BOB_WALK_FREQ = 2;
const BOB_SPRINT_FREQ = 2.8;
const BOB_WALK_AMP = 0.04;
const BOB_SPRINT_AMP = 0.07;

export default class Player {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {function(number, number): number} getTerrainHeight - ChunkManager.getTerrainHeight
   */
  constructor(camera, getTerrainHeight) {
    this._getTerrainHeight = getTerrainHeight;

    // Player root object (position = feet)
    this.object = new THREE.Object3D();
    this.object.position.set(0, 0, 0);

    // Camera setup: child of player at eye height
    this._camera = camera;
    this._camera.rotation.set(0, 0, 0);
    this._camera.position.set(0, EYE_HEIGHT, 0);
    this.object.add(this._camera);

    // State
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isGrounded = false;
    this.isSprinting = false;
    this.isInWater = false;
    this.isOnSlope = false;
    this.slopeAngle = 0;
    this.stamina = MAX_STAMINA;

    // Camera angles (separate yaw/pitch to avoid gimbal lock)
    this._yaw = 0;   // radians, applied to object.rotation.y
    this._pitch = 0;  // radians, applied to camera.rotation.x

    // Head bobbing state
    this._bobTime = 0;
    this._bobAmplitude = 0; // current amplitude (lerped)
    this._bobOffset = 0;

    // Collision objects list (set externally by ChunkManager or Game)
    this._collisionObjects = []; // array of { x, z, radius, heightMin, heightMax }

    // Reusable vectors — allocated once, reused every frame
    this._moveDir = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._tempVec = new THREE.Vector3();
    this._slopeNormal = new THREE.Vector3();
  }

  get position() {
    return this.object.position;
  }

  get yaw() {
    return this._yaw;
  }

  get pitch() {
    return this._pitch;
  }

  get yawDeg() {
    return this._yaw * RAD2DEG;
  }

  get pitchDeg() {
    return this._pitch * RAD2DEG;
  }

  /**
   * Set collision objects for the current area.
   * Called by ChunkManager or Game each frame with nearby objects.
   * @param {Array<{x: number, z: number, radius: number, heightMin: number, heightMax: number}>} objects
   */
  setCollisionObjects(objects) {
    this._collisionObjects = objects;
  }

  /**
   * Teleport player to a world position.
   */
  teleport(x, y, z) {
    this.object.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.isGrounded = false;
  }

  /**
   * Main update — called once per frame with delta time.
   * @param {number} delta - seconds since last frame (already capped)
   */
  update(delta) {
    this._handleMouseLook();
    this._handleMovement(delta);
    this._handleCollision(delta);
    this._handleHeadBob(delta);
    this._updateCamera();
  }

  // =========================================================
  // MOUSE LOOK
  // =========================================================
  _handleMouseLook() {
    if (!inputManager.isPointerLocked) return;

    const { x: dx, y: dy } = inputManager.getMouseDelta();
    const sensitivity = settings.get('mouseSensitivity') * 0.002;
    const invertY = settings.get('invertY');

    this._yaw -= dx * sensitivity;
    this._pitch -= (invertY ? -dy : dy) * sensitivity;

    // Clamp pitch to ±89 degrees
    const limit = 89 * DEG2RAD;
    if (this._pitch > limit) this._pitch = limit;
    if (this._pitch < -limit) this._pitch = -limit;
  }

  // =========================================================
  // MOVEMENT INPUT
  // =========================================================
  _handleMovement(delta) {
    // Compute forward and right directions from yaw only (not pitch)
    this._forward.set(0, 0, -1);
    this._forward.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this._yaw);

    this._right.set(1, 0, 0);
    this._right.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this._yaw);

    // Read input
    this._moveDir.set(0, 0, 0);
    if (inputManager.isActionDown('moveForward'))  this._moveDir.add(this._forward);
    if (inputManager.isActionDown('moveBackward')) this._moveDir.sub(this._forward);
    if (inputManager.isActionDown('moveRight'))    this._moveDir.add(this._right);
    if (inputManager.isActionDown('moveLeft'))     this._moveDir.sub(this._right);

    // Normalize
    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
    }

    // Sprint
    const wantSprint = inputManager.isActionDown('sprint');
    const canSprint = this.isGrounded && this.stamina > 0 && this.slopeAngle < SPRINT_SLOPE_LIMIT;
    this.isSprinting = wantSprint && canSprint && this._moveDir.lengthSq() > 0;

    // Stamina
    if (this.isSprinting) {
      this.stamina -= STAMINA_DRAIN * delta;
      if (this.stamina < 0) this.stamina = 0;
    } else {
      this.stamina += STAMINA_REGEN * delta;
      if (this.stamina > MAX_STAMINA) this.stamina = MAX_STAMINA;
    }

    // Determine speed
    let speed;
    if (this.isInWater) {
      speed = SWIM_SPEED;
    } else if (this.isSprinting) {
      speed = SPRINT_SPEED;
    } else {
      speed = WALK_SPEED;
    }

    // Apply horizontal velocity from input
    this.velocity.x = this._moveDir.x * speed;
    this.velocity.z = this._moveDir.z * speed;

    // Gravity
    if (this.isInWater) {
      // Water physics
      this.velocity.y += WATER_GRAVITY * delta;
      // Buoyancy when submerged
      if (this.object.position.y < 0) {
        this.velocity.y += WATER_BUOYANCY * delta;
      }
      // Clamp vertical speed
      if (this.velocity.y > WATER_MAX_VERT_SPEED) this.velocity.y = WATER_MAX_VERT_SPEED;
      if (this.velocity.y < -WATER_MAX_VERT_SPEED) this.velocity.y = -WATER_MAX_VERT_SPEED;
      // Water drag on horizontal
      this.velocity.x *= WATER_DRAG;
      this.velocity.z *= WATER_DRAG;
      // Jump in water
      if (inputManager.isActionDown('jump')) {
        this.velocity.y = WATER_JUMP_IMPULSE;
      }
    } else if (!this.isGrounded) {
      // Air gravity
      this.velocity.y += GRAVITY * delta;
      if (this.velocity.y < MAX_FALL_SPEED) this.velocity.y = MAX_FALL_SPEED;
    } else {
      // On ground
      // Jump
      if (inputManager.isActionDown('jump') && !this.isOnSlope) {
        this.velocity.y = JUMP_IMPULSE;
        this.isGrounded = false;
      } else {
        // Small downward velocity to stick to slopes
        this.velocity.y = -1;
      }

      // Slope slide
      if (this.isOnSlope) {
        // Apply slide force in down-slope direction
        const slideForce = 15;
        this.velocity.x += this._slopeNormal.x * slideForce * delta;
        this.velocity.z += this._slopeNormal.z * slideForce * delta;
      }
    }
  }

  // =========================================================
  // AXIS-SEPARATED COLLISION
  // =========================================================
  _handleCollision(delta) {
    const pos = this.object.position;

    // Step 1: Store start position (implicitly via pos)

    // Step 2: Move X
    pos.x += this.velocity.x * delta;

    // Step 3: Test X collision against objects
    this._resolveObjectCollisionsAxis(pos, 'x');

    // Step 4: Move Y
    pos.y += this.velocity.y * delta;

    // Step 5: Test Y — terrain heightmap
    const terrainY = this._getTerrainHeight(pos.x, pos.z);
    if (pos.y < terrainY) {
      pos.y = terrainY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    // Test Y against object collision cylinders
    this._resolveObjectCollisionsAxis(pos, 'y');

    // Step 6: Move Z
    pos.z += this.velocity.z * delta;

    // Step 7: Test Z collision against objects
    this._resolveObjectCollisionsAxis(pos, 'z');

    // Step 8: Re-test grounded state
    const groundY = this._getTerrainHeight(pos.x, pos.z);
    if (pos.y - groundY < GROUND_CHECK_DIST) {
      this.isGrounded = true;

      // Compute slope
      this._computeSlope(pos.x, pos.z, groundY);
    } else {
      this.isGrounded = false;
      this.isOnSlope = false;
      this.slopeAngle = 0;
    }

    // Water check
    this.isInWater = pos.y < 0;
  }

  _resolveObjectCollisionsAxis(pos, axis) {
    const playerTop = pos.y + CAPSULE_HEIGHT;
    const playerBottom = pos.y;

    for (let i = 0; i < this._collisionObjects.length; i++) {
      const obj = this._collisionObjects[i];

      // Y overlap check
      if (playerTop < obj.heightMin || playerBottom > obj.heightMax) continue;

      // XZ distance check
      const dx = pos.x - obj.x;
      const dz = pos.z - obj.z;
      const distSq = dx * dx + dz * dz;
      const combinedRadius = CAPSULE_RADIUS + obj.radius;

      if (distSq < combinedRadius * combinedRadius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = combinedRadius - dist;

        if (axis === 'x') {
          pos.x += (dx / dist) * overlap;
        } else if (axis === 'z') {
          pos.z += (dz / dist) * overlap;
        } else if (axis === 'y') {
          // Push player up if standing on top of object
          if (this.velocity.y <= 0 && pos.y < obj.heightMax) {
            pos.y = obj.heightMax;
            this.velocity.y = 0;
            this.isGrounded = true;
          }
        }
      }
    }
  }

  _computeSlope(x, z, groundY) {
    // Sample terrain at small offsets to compute normal
    const d = 0.5;
    const hL = this._getTerrainHeight(x - d, z);
    const hR = this._getTerrainHeight(x + d, z);
    const hF = this._getTerrainHeight(x, z - d);
    const hB = this._getTerrainHeight(x, z + d);

    // Approximate normal from cross product of tangent vectors
    this._slopeNormal.set(hL - hR, 2 * d, hF - hB).normalize();

    this.slopeAngle = Math.acos(Math.min(1, this._slopeNormal.y));
    this.isOnSlope = this._slopeNormal.y < SLOPE_LIMIT_Y;
  }

  // =========================================================
  // HEAD BOBBING
  // =========================================================
  _handleHeadBob(delta) {
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    const isMoving = this.isGrounded && speed > 0.5;

    // Target amplitude and frequency
    let targetAmp = 0;
    let freq = BOB_WALK_FREQ;

    if (isMoving) {
      if (this.isSprinting) {
        targetAmp = BOB_SPRINT_AMP;
        freq = BOB_SPRINT_FREQ;
      } else {
        targetAmp = BOB_WALK_AMP;
        freq = BOB_WALK_FREQ;
      }
    }

    // Lerp amplitude for smooth start/stop
    this._bobAmplitude += (targetAmp - this._bobAmplitude) * Math.min(1, delta * 10);

    if (this._bobAmplitude > 0.001) {
      this._bobTime += delta * freq * Math.PI * 2;
      this._bobOffset = Math.sin(this._bobTime) * this._bobAmplitude;
    } else {
      this._bobTime = 0;
      this._bobOffset = 0;
    }
  }

  // =========================================================
  // CAMERA SYNC
  // =========================================================
  _updateCamera() {
    // Apply yaw to player object
    this.object.rotation.y = this._yaw;

    // Apply pitch to camera (child of player)
    this._camera.rotation.x = this._pitch;

    // Head bob offset on camera local Y
    this._camera.position.y = EYE_HEIGHT + this._bobOffset;
  }

  /**
   * Get debug data for the overlay.
   */
  getDebugData() {
    return {
      playerPosition: this.object.position,
      playerVelocity: this.velocity,
      isGrounded: this.isGrounded,
      isInWater: this.isInWater,
      isOnSlope: this.isOnSlope,
      slopeAngle: this.slopeAngle * RAD2DEG,
      cameraPitch: this.pitchDeg,
      cameraYaw: this.yawDeg,
      stamina: this.stamina,
      isSprinting: this.isSprinting,
      collisionState: this.isOnSlope ? 'slope' : this.isGrounded ? 'ground' : 'air',
    };
  }
}
