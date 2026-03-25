/**
 * PostProcessing - EffectComposer with SSAO, Bloom, FXAA.
 * Imports: Three.js r128 examples/jsm modules, Settings.
 * Exports: PostProcessing class.
 * 
 * Pass order: RenderPass → SSAOPass → UnrealBloomPass → FXAA ShaderPass → CopyShader output.
 * Each pass conditionally added based on settings.
 * Rebuilds composer pass chain when settings change at runtime.
 * r128 has no OutputPass — use ShaderPass(CopyShader) as final pass.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import settings from '../core/Settings.js';

export default class PostProcessing {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._composer = null;
    this._enabled = false;

    // Pass references (for parameter updates)
    this._renderPass = null;
    this._ssaoPass = null;
    this._bloomPass = null;
    this._fxaaPass = null;
    this._copyPass = null;

    this._build();

    // Rebuild when relevant settings change
    const rebuildKeys = ['postProcessing', 'ssao', 'bloom', 'antialiasing'];
    for (const key of rebuildKeys) {
      settings.onChange(key, () => this._build());
    }

    settings.onChange('ssaoStrength', (val) => {
      if (this._ssaoPass) {
        this._ssaoPass.kernelRadius = val * 16;
        this._ssaoPass.minDistance = 0.001;
        this._ssaoPass.maxDistance = 0.1 * val + 0.02;
      }
    });

    settings.onChange('bloomStrength', (val) => {
      if (this._bloomPass) {
        this._bloomPass.strength = val;
      }
    });
  }

  get enabled() {
    return this._enabled && this._composer !== null;
  }

  _build() {
    const ppEnabled = settings.get('postProcessing');
    const ssaoEnabled = ppEnabled && settings.get('ssao');
    const bloomEnabled = ppEnabled && settings.get('bloom');
    const aa = settings.get('antialiasing');
    const fxaaEnabled = ppEnabled && aa === 'fxaa';

    // If no post-processing effects are on, disable composer
    if (!ppEnabled && !fxaaEnabled) {
      this._enabled = false;
      this._disposeComposer();
      return;
    }

    this._enabled = true;
    this._disposeComposer();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const pixelRatio = this._renderer.getPixelRatio();

    this._composer = new EffectComposer(this._renderer);

    // 1. RenderPass
    this._renderPass = new RenderPass(this._scene, this._camera);
    this._composer.addPass(this._renderPass);

    // 2. SSAOPass (optional)
    if (ssaoEnabled) {
      this._ssaoPass = new SSAOPass(this._scene, this._camera, w, h);
      const strength = settings.get('ssaoStrength');
      this._ssaoPass.kernelRadius = strength * 16;
      this._ssaoPass.minDistance = 0.001;
      this._ssaoPass.maxDistance = 0.1 * strength + 0.02;
      this._composer.addPass(this._ssaoPass);
    }

    // 3. UnrealBloomPass (optional)
    if (bloomEnabled) {
      const bloomStrength = settings.get('bloomStrength');
      this._bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        bloomStrength,
        0.4,  // radius
        0.85  // threshold
      );
      this._composer.addPass(this._bloomPass);
    }

    // 4. FXAA (optional — only if antialiasing is set to 'fxaa')
    if (fxaaEnabled) {
      this._fxaaPass = new ShaderPass(FXAAShader);
      this._fxaaPass.uniforms['resolution'].value.set(
        1 / (w * pixelRatio),
        1 / (h * pixelRatio)
      );
      this._composer.addPass(this._fxaaPass);
    }

    // 5. Final CopyShader pass (acts as output)
    this._copyPass = new ShaderPass(CopyShader);
    this._copyPass.renderToScreen = true;
    this._composer.addPass(this._copyPass);

    this._composer.setSize(w, h);
  }

  _disposeComposer() {
    if (this._composer) {
      // EffectComposer render targets
      if (this._composer.renderTarget1) this._composer.renderTarget1.dispose();
      if (this._composer.renderTarget2) this._composer.renderTarget2.dispose();
    }
    this._composer = null;
    this._renderPass = null;
    this._ssaoPass = null;
    this._bloomPass = null;
    this._fxaaPass = null;
    this._copyPass = null;
  }

  /**
   * Render a frame through the post-processing pipeline.
   * Returns true if it rendered, false if disabled (caller should render directly).
   */
  render(delta) {
    if (!this._enabled || !this._composer) return false;
    this._composer.render(delta);
    return true;
  }

  /**
   * Handle window resize.
   */
  setSize(width, height) {
    if (!this._composer) return;

    const pixelRatio = this._renderer.getPixelRatio();
    this._composer.setSize(width, height);

    if (this._fxaaPass) {
      this._fxaaPass.uniforms['resolution'].value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio)
      );
    }

    if (this._ssaoPass) {
      this._ssaoPass.setSize(width, height);
    }
  }

  dispose() {
    this._disposeComposer();
  }
}
