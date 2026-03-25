/**
 * RemotePlayer - Avatar rendering for other players.
 * Imports: Three.js.
 * Exports: RemotePlayer class.
 *
 * Simple capsule mesh with nametag sprite.
 * Position/rotation interpolated toward received network state.
 * Shows fishing rod if player is fishing.
 */

import * as THREE from 'three';

const LERP_SPEED = 10; // Position interpolation speed
const CAPSULE_RADIUS = 0.4;
const CAPSULE_HEIGHT = 1.8;

export default class RemotePlayer {
  /**
   * @param {string} playerId
   * @param {string} playerName
   * @param {THREE.Scene} scene
   */
  constructor(playerId, playerName, scene) {
    this.playerId = playerId;
    this.playerName = playerName || 'Unknown';
    this._scene = scene;

    // Target state (received from network)
    this._targetPos = new THREE.Vector3();
    this._targetYaw = 0;

    // Current interpolated state
    this._currentPos = new THREE.Vector3();
    this._currentYaw = 0;

    // Fishing state
    this.isFishing = false;

    // Build avatar
    this._group = new THREE.Group();
    this._buildAvatar();
    this._buildNametag();
    scene.add(this._group);
  }

  get position() { return this._currentPos; }

  _buildAvatar() {
    // Body capsule (cylinder + two half-spheres)
    const bodyGeo = new THREE.CylinderGeometry(CAPSULE_RADIUS, CAPSULE_RADIUS, CAPSULE_HEIGHT - CAPSULE_RADIUS * 2, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = CAPSULE_HEIGHT / 2;
    body.castShadow = true;
    this._group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(CAPSULE_RADIUS * 0.9, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = CAPSULE_HEIGHT + CAPSULE_RADIUS * 0.3;
    head.castShadow = true;
    this._group.add(head);

    this._bodyMesh = body;
  }

  _buildNametag() {
    // Canvas-based sprite for the name
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.playerName, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.y = CAPSULE_HEIGHT + CAPSULE_RADIUS * 2 + 0.3;
    sprite.scale.set(2, 0.5, 1);
    this._group.add(sprite);
    this._nametagTexture = texture;
    this._nametagMat = mat;
  }

  /**
   * Update received network state.
   */
  setState(state) {
    if (state.x !== undefined) this._targetPos.set(state.x, state.y, state.z);
    if (state.yaw !== undefined) this._targetYaw = state.yaw;
    if (state.fishing !== undefined) this.isFishing = state.fishing;
  }

  /**
   * Interpolate toward target state each frame.
   */
  update(delta) {
    // Lerp position
    const t = Math.min(1, LERP_SPEED * delta);
    this._currentPos.lerp(this._targetPos, t);
    this._group.position.copy(this._currentPos);

    // Lerp yaw
    let yawDiff = this._targetYaw - this._currentYaw;
    // Wrap around PI
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this._currentYaw += yawDiff * t;
    this._group.rotation.y = this._currentYaw;
  }

  dispose() {
    this._scene.remove(this._group);
    if (this._nametagTexture) this._nametagTexture.dispose();
    if (this._nametagMat) this._nametagMat.dispose();
    // Traverse and dispose geometries/materials
    this._group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && child.material !== this._nametagMat) child.material.dispose();
    });
  }
}
