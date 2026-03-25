/**
 * WaterSystem - Lake and river rendering at Y=0.
 * Imports: Three.js, Settings.
 * Exports: WaterSystem class.
 * 
 * Single water plane at Y=0 covering loaded world area.
 * Per spec: renderOrder=1, depthWrite=false, transparent material.
 * Vertex shader sine wave displacement for ripples.
 * Quality settings control reflection approach.
 */

import * as THREE from 'three';
import settings from '../core/Settings.js';

const WATER_VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Two sine waves at different frequencies and angles for ripples
    float wave1 = sin(pos.x * 0.3 + uTime * 1.2) * cos(pos.z * 0.2 + uTime * 0.8) * 0.05;
    float wave2 = sin(pos.x * 0.7 + pos.z * 0.5 + uTime * 1.8) * 0.03;
    pos.y += wave1 + wave2;

    // Compute displaced normal
    float dx1 = cos(pos.x * 0.3 + uTime * 1.2) * 0.3 * cos(pos.z * 0.2 + uTime * 0.8) * 0.05;
    float dz1 = sin(pos.x * 0.3 + uTime * 1.2) * (-sin(pos.z * 0.2 + uTime * 0.8)) * 0.2 * 0.05;
    float dx2 = cos(pos.x * 0.7 + pos.z * 0.5 + uTime * 1.8) * 0.7 * 0.03;
    float dz2 = cos(pos.x * 0.7 + pos.z * 0.5 + uTime * 1.8) * 0.5 * 0.03;
    vNormal = normalize(vec3(-(dx1 + dx2), 1.0, -(dz1 + dz2)));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform vec3 uWaterColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSunDirection;
  uniform float uTime;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // Fake fresnel based on view angle
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    fresnel = clamp(fresnel, 0.1, 0.9);

    // Mix water color with deeper tone based on fresnel
    vec3 color = mix(uWaterColor, uDeepColor, fresnel * 0.5);

    // Specular highlight from sun
    vec3 halfDir = normalize(uSunDirection + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);
    color += vec3(1.0, 0.95, 0.8) * spec * 0.6;

    // Edge foam approximation (fade at edges of UV)
    float foam = smoothstep(0.0, 0.02, vWorldPos.y + 0.1);

    gl_FragColor = vec4(color, uOpacity * foam);
  }
`;

export default class WaterSystem {
  constructor(scene) {
    this._scene = scene;
    this._mesh = null;
    this._material = null;
    this._geometry = null;
    this._time = 0;
    this._currentSize = 0;

    this._build();
  }

  _build() {
    // Large water plane — will be repositioned to follow player
    const size = 800;
    this._currentSize = size;
    this._geometry = new THREE.PlaneGeometry(size, size, 128, 128);

    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(0x1a6b8a) },
        uDeepColor: { value: new THREE.Color(0x0a3a4a) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uOpacity: { value: 0.75 },
      },
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this._mesh = new THREE.Mesh(this._geometry, this._material);
    this._mesh.rotation.x = -Math.PI / 2;
    this._mesh.position.y = 0;
    this._mesh.renderOrder = 1;
    this._mesh.frustumCulled = false; // Always render water

    this._scene.add(this._mesh);
  }

  /**
   * Update water each frame.
   * @param {number} delta
   * @param {THREE.Vector3} playerPosition
   * @param {THREE.Vector3} sunDirection - current sun direction for specular
   */
  update(delta, playerPosition, sunDirection) {
    this._time += delta;
    this._material.uniforms.uTime.value = this._time;

    // Follow player XZ so water is always visible
    if (playerPosition) {
      this._mesh.position.x = playerPosition.x;
      this._mesh.position.z = playerPosition.z;
    }

    // Update sun direction for specular
    if (sunDirection) {
      this._material.uniforms.uSunDirection.value.copy(sunDirection).normalize();
    }
  }

  dispose() {
    if (this._mesh) {
      this._scene.remove(this._mesh);
    }
    if (this._geometry) {
      this._geometry.dispose();
    }
    if (this._material) {
      this._material.dispose();
    }
  }
}
