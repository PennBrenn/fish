/**
 * Debug - Debug overlay and developer tools.
 * Imports: Settings (for debug key bindings), EventBus (to emit debug commands).
 * Exports: Singleton.
 * 
 * Gated behind import.meta.env.DEV. In production, all methods are no-ops.
 * F3 toggles overlay. F4-F11 trigger debug commands via EventBus.
 * Renders a semi-transparent panel showing performance, world, player, networking stats.
 * Updated externally via update(data) each frame.
 */

import eventBus from './EventBus.js';

const IS_DEV = import.meta.env.DEV;

class Debug {
  constructor() {
    this._active = false;
    this._overlay = null;
    this._fpsBuffer = new Float32Array(60);
    this._fpsIndex = 0;
    this._fpsCount = 0;
    this._data = {};

    this._onKeyDown = this._handleKeyDown.bind(this);
  }

  init() {
    if (!IS_DEV) return;

    this._overlay = document.getElementById('debug-overlay');
    document.addEventListener('keydown', this._onKeyDown);
  }

  dispose() {
    if (!IS_DEV) return;
    document.removeEventListener('keydown', this._onKeyDown);
  }

  get isActive() {
    return IS_DEV && this._active;
  }

  /**
   * Update debug data each frame.
   * @param {object} data - Object with fields: delta, renderer, player, world, networking, etc.
   */
  update(data) {
    if (!IS_DEV || !this._active) return;

    // Merge incoming data
    Object.assign(this._data, data);

    // Track FPS
    if (data.delta !== undefined && data.delta > 0) {
      this._fpsBuffer[this._fpsIndex] = 1 / data.delta;
      this._fpsIndex = (this._fpsIndex + 1) % 60;
      if (this._fpsCount < 60) this._fpsCount++;
    }

    this._render();
  }

  _getAvgFps() {
    if (this._fpsCount === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this._fpsCount; i++) {
      sum += this._fpsBuffer[i];
    }
    return sum / this._fpsCount;
  }

  _render() {
    if (!this._overlay) return;

    const d = this._data;
    const fps = this._getAvgFps().toFixed(1);
    const frameTime = d.delta ? (d.delta * 1000).toFixed(2) : '0.00';

    // Renderer info
    const ri = d.rendererInfo || {};
    const render = ri.render || {};
    const memory = ri.memory || {};

    let text = '';
    text += `=== PERFORMANCE ===\n`;
    text += `FPS: ${fps}  Frame: ${frameTime}ms\n`;
    text += `Draw Calls: ${render.calls || 0}\n`;
    text += `Triangles: ${render.triangles || 0}\n`;
    text += `Geometries: ${memory.geometries || 0}\n`;
    text += `Textures: ${memory.textures || 0}\n`;
    text += `Chunks Loaded: ${d.chunksLoaded || 0}\n`;
    text += `Chunks Visible: ${d.chunksVisible || 0}\n`;
    text += `Worker Queue: ${d.workerQueueDepth || 0}\n`;

    text += `\n=== WORLD ===\n`;
    const pp = d.playerPosition || { x: 0, y: 0, z: 0 };
    text += `Position: ${pp.x.toFixed(3)}, ${pp.y.toFixed(3)}, ${pp.z.toFixed(3)}\n`;
    text += `Chunk: ${d.playerChunk || '0, 0'}\n`;
    text += `Biome: ${d.biome || 'unknown'}\n`;
    text += `Chunk Seed: ${d.chunkSeed || 0}\n`;
    text += `Fish Species: ${d.fishSpecies || 'none'}\n`;
    text += `Weather: ${d.weather || 'clear'}\n`;
    text += `Time: ${d.timeOfDay || '12:00'}\n`;
    text += `World Seed: ${d.worldSeed || 'none'}\n`;

    text += `\n=== PLAYER ===\n`;
    const pv = d.playerVelocity || { x: 0, y: 0, z: 0 };
    text += `Velocity: ${pv.x.toFixed(3)}, ${pv.y.toFixed(3)}, ${pv.z.toFixed(3)}\n`;
    text += `Grounded: ${d.isGrounded || false}\n`;
    text += `In Water: ${d.isInWater || false}\n`;
    text += `Pitch: ${(d.cameraPitch || 0).toFixed(1)}°  Yaw: ${(d.cameraYaw || 0).toFixed(1)}°\n`;
    text += `Collision: ${d.collisionState || 'none'}\n`;

    text += `\n=== NETWORKING ===\n`;
    text += `Party: ${d.partyCode || 'none'}\n`;
    text += `Peers: ${d.peerCount || 0}\n`;
    text += `Latency: ${d.peerLatency || '-'}ms\n`;
    text += `Channel: ${d.channelState || 'none'}\n`;
    text += `Msg/s: ↑${d.msgSent || 0} ↓${d.msgRecv || 0}\n`;

    this._overlay.textContent = text;
  }

  _toggle() {
    if (!IS_DEV) return;
    this._active = !this._active;
    if (this._overlay) {
      this._overlay.style.display = this._active ? 'block' : 'none';
    }
  }

  _handleKeyDown(e) {
    if (!IS_DEV) return;

    switch (e.code) {
      case 'F3':
        e.preventDefault();
        this._toggle();
        break;
      case 'F4':
        e.preventDefault();
        eventBus.emit('debug:toggleWireframe');
        break;
      case 'F5':
        e.preventDefault();
        eventBus.emit('debug:toggleBoundingBoxes');
        break;
      case 'F6':
        e.preventDefault();
        eventBus.emit('debug:reloadChunks');
        break;
      case 'F7':
        e.preventDefault();
        eventBus.emit('debug:toggleFishPaths');
        break;
      case 'F8':
        e.preventDefault();
        eventBus.emit('debug:spawnTestFish');
        break;
      case 'F9':
        e.preventDefault();
        eventBus.emit('debug:giveAllItems');
        break;
      case 'F10':
        e.preventDefault();
        eventBus.emit('debug:togglePhysicsDebug');
        break;
      case 'F11':
        // Don't prevent default for F11 (fullscreen), use Shift+F11 instead
        if (e.shiftKey) {
          e.preventDefault();
          eventBus.emit('debug:cyclePostProcessing');
        }
        break;
      case 'Numpad1':
      case 'Numpad2':
      case 'Numpad3':
      case 'Numpad4':
      case 'Numpad5':
      case 'Numpad6':
      case 'Numpad7':
      case 'Numpad8':
      case 'Numpad9': {
        const idx = parseInt(e.code.replace('Numpad', ''), 10);
        eventBus.emit('debug:teleport', idx);
        break;
      }
    }
  }
}

const debug = new Debug();
export default debug;
