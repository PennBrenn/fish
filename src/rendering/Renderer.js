/**
 * Renderer - WebGLRenderer setup, resize handling.
 * Imports: Settings (for graphics options).
 * Exports: Renderer class.
 * 
 * Owns the WebGLRenderer. Does NOT own the animation loop.
 * Handles resize, pixel ratio, shadow map configuration.
 * Shadow map enabled state set once during init (per spec warning).
 */

import * as THREE from 'three';
import settings from '../core/Settings.js';

const SHADOW_MAP_SIZES = {
  off: 0,
  low: 512,
  medium: 1024,
  high: 2048,
};

export default class Renderer {
  constructor(canvas) {
    this._canvas = canvas;

    const aa = settings.get('antialiasing');
    const useNativeAA = aa === 'msaa2x' || aa === 'msaa4x';

    this._webglRenderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: useNativeAA,
      powerPreference: 'high-performance',
    });

    const pr = settings.get('pixelRatio') * window.devicePixelRatio;
    this._webglRenderer.setPixelRatio(pr);
    this._webglRenderer.setSize(window.innerWidth, window.innerHeight);

    // r128 API
    this._webglRenderer.outputEncoding = THREE.sRGBEncoding;
    this._webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._webglRenderer.toneMappingExposure = 1.0;

    // Shadow map — set once during init per spec
    const shadowQ = settings.get('shadowQuality');
    this._webglRenderer.shadowMap.enabled = shadowQ !== 'off';
    this._webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Resize handler
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // Settings change listeners
    this._onPixelRatioChange = (val) => {
      this._webglRenderer.setPixelRatio(val * window.devicePixelRatio);
    };
    settings.onChange('pixelRatio', this._onPixelRatioChange);
  }

  get webglRenderer() {
    return this._webglRenderer;
  }

  get info() {
    return this._webglRenderer.info;
  }

  get domElement() {
    return this._webglRenderer.domElement;
  }

  setAnimationLoop(callback) {
    this._webglRenderer.setAnimationLoop(callback);
  }

  render(scene, camera) {
    this._webglRenderer.render(scene, camera);
  }

  updateShadowMap(quality) {
    const size = SHADOW_MAP_SIZES[quality] || 1024;
    // Shadow map enabled state was set at init. We can update the map size
    // by adjusting the light's shadow map, but not the renderer flag.
    // Caller is responsible for updating light shadow map sizes.
    return size;
  }

  getShadowMapSize() {
    const q = settings.get('shadowQuality');
    return SHADOW_MAP_SIZES[q] || 1024;
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._webglRenderer.setSize(w, h);
    // Camera aspect is updated externally (Game.js or Player.js)
  }

  getSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    settings.offChange('pixelRatio', this._onPixelRatioChange);
    this._webglRenderer.dispose();
  }
}
