/**
 * ChunkManager - Chunk loading, unloading, streaming around player position.
 * Imports: Chunk, Settings, EventBus, Noise (for main-thread height lookups).
 * Exports: ChunkManager class.
 * 
 * Manages chunk lifecycle with proper disposal.
 * Exposes getTerrainHeight(x, z) with bilinear interpolation.
 * Uses Web Worker for off-thread heightmap generation.
 * Chunks keyed by "cx,cz" string in a Map.
 */

import Chunk from './Chunk.js';
import { createNoiseSystem } from './Noise.js';
import settings from '../core/Settings.js';
import eventBus from '../core/EventBus.js';

const CHUNK_SIZE = 64;

export default class ChunkManager {
  /**
   * @param {THREE.Scene} scene - the scene to add/remove chunk meshes
   * @param {number} seed - world seed for deterministic generation
   */
  constructor(scene, seed) {
    this._scene = scene;
    this._seed = seed;
    this._chunks = new Map(); // key "cx,cz" -> Chunk
    this._loadRadius = settings.get('drawDistance'); // in chunks
    this._lastPlayerCX = null;
    this._lastPlayerCZ = null;

    // Main-thread noise for height lookups (getTerrainHeight)
    this._noise = createNoiseSystem(seed);

    // Web Worker for off-thread generation
    this._worker = null;
    this._workerReady = false;
    this._workerQueue = []; // pending requests
    this._workerPending = new Map(); // key -> true (in-flight requests)
    this._initWorker();

    // Listen for draw distance changes
    this._onDrawDistChange = (val) => {
      this._loadRadius = val;
    };
    settings.onChange('drawDistance', this._onDrawDistChange);

    // Debug: force chunk reload
    eventBus.on('debug:reloadChunks', () => this._reloadAll());
  }

  get chunksLoaded() {
    return this._chunks.size;
  }

  get chunksVisible() {
    let count = 0;
    for (const chunk of this._chunks.values()) {
      if (chunk.mesh && chunk.mesh.visible) count++;
    }
    return count;
  }

  get workerQueueDepth() {
    return this._workerQueue.length + this._workerPending.size;
  }

  _initWorker() {
    try {
      this._worker = new Worker(
        new URL('../workers/ChunkWorker.js', import.meta.url),
        { type: 'module' }
      );

      this._worker.onmessage = (e) => {
        this._handleWorkerMessage(e.data);
      };

      this._worker.onerror = (err) => {
        console.error('ChunkWorker error:', err);
      };

      this._workerReady = true;
    } catch (err) {
      console.warn('ChunkManager: Web Worker unavailable, using main thread fallback', err);
      this._workerReady = false;
    }
  }

  _handleWorkerMessage(msg) {
    if (msg.type === 'chunkData') {
      const key = `${msg.cx},${msg.cz}`;
      this._workerPending.delete(key);

      // Check if chunk is still needed (player may have moved)
      if (!this._isChunkInRange(msg.cx, msg.cz)) {
        return; // Discard — chunk no longer needed
      }

      // Don't overwrite an existing chunk
      if (this._chunks.has(key)) return;

      const chunk = new Chunk(msg.cx, msg.cz, msg.heightmap, msg.biome, msg.trees, msg.rocks);
      chunk.build();
      this._chunks.set(key, chunk);

      if (chunk.mesh) {
        this._scene.add(chunk.mesh);
      }
      if (chunk.objectGroup) {
        this._scene.add(chunk.objectGroup);
      }

      // Process next item in queue
      this._processQueue();
    }
  }

  _requestChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this._chunks.has(key)) return;
    if (this._workerPending.has(key)) return;

    if (this._workerReady) {
      // Limit concurrent worker requests
      if (this._workerPending.size < 4) {
        this._workerPending.set(key, true);
        this._worker.postMessage({
          type: 'generateChunk',
          seed: this._seed,
          cx,
          cz,
        });
      } else {
        // Queue for later
        this._workerQueue.push({ cx, cz });
      }
    } else {
      // Fallback: generate on main thread
      this._generateOnMainThread(cx, cz);
    }
  }

  _processQueue() {
    while (this._workerQueue.length > 0 && this._workerPending.size < 4) {
      const { cx, cz } = this._workerQueue.shift();
      const key = `${cx},${cz}`;

      // Skip if already loaded or no longer needed
      if (this._chunks.has(key) || !this._isChunkInRange(cx, cz)) continue;

      this._workerPending.set(key, true);
      this._worker.postMessage({
        type: 'generateChunk',
        seed: this._seed,
        cx,
        cz,
      });
    }
  }

  _generateOnMainThread(cx, cz) {
    const key = `${cx},${cz}`;
    if (this._chunks.has(key)) return;

    const CHUNK_VERTS = 65;
    const heightmap = new Float32Array(CHUNK_VERTS * CHUNK_VERTS);
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    for (let iz = 0; iz < CHUNK_VERTS; iz++) {
      for (let ix = 0; ix < CHUNK_VERTS; ix++) {
        heightmap[iz * CHUNK_VERTS + ix] = this._noise.terrainHeight(worldX + ix, worldZ + iz);
      }
    }

    const biome = this._noise.getBiome(
      cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      cz * CHUNK_SIZE + CHUNK_SIZE / 2
    );

    const chunk = new Chunk(cx, cz, heightmap, biome);
    chunk.build();
    this._chunks.set(key, chunk);

    if (chunk.mesh) {
      this._scene.add(chunk.mesh);
    }
    if (chunk.objectGroup) {
      this._scene.add(chunk.objectGroup);
    }
  }

  /**
   * Get collision objects near a world position.
   * Returns colliders from current chunk + 8 neighbors.
   * @param {number} wx - world X
   * @param {number} wz - world Z
   * @returns {Array<{x, z, radius, heightMin, heightMax}>}
   */
  getNearbyColliders(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const colliders = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const chunk = this._chunks.get(key);
        if (chunk && chunk.colliders) {
          // Only include colliders within ~16 units of player for perf
          for (let i = 0; i < chunk.colliders.length; i++) {
            const c = chunk.colliders[i];
            const ddx = c.x - wx;
            const ddz = c.z - wz;
            if (ddx * ddx + ddz * ddz < 256) { // 16^2
              colliders.push(c);
            }
          }
        }
      }
    }

    return colliders;
  }

  _isChunkInRange(cx, cz) {
    if (this._lastPlayerCX === null) return true;
    const dx = Math.abs(cx - this._lastPlayerCX);
    const dz = Math.abs(cz - this._lastPlayerCZ);
    return dx <= this._loadRadius && dz <= this._loadRadius;
  }

  /**
   * Update each frame with player world position.
   * Loads new chunks, unloads distant ones.
   * @param {number} playerX - world X
   * @param {number} playerZ - world Z
   */
  update(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Only re-evaluate if player changed chunk
    if (pcx === this._lastPlayerCX && pcz === this._lastPlayerCZ) return;

    this._lastPlayerCX = pcx;
    this._lastPlayerCZ = pcz;

    const radius = this._loadRadius;

    // Request new chunks in range (spiral from center for nearest-first loading)
    for (let r = 0; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // Only ring edges
          if (r === 0 || (Math.abs(dx) === r || Math.abs(dz) === r)) {
            this._requestChunk(pcx + dx, pcz + dz);
          }
        }
      }
    }

    // Unload chunks outside range
    const toRemove = [];
    for (const [key, chunk] of this._chunks) {
      const dx = Math.abs(chunk.cx - pcx);
      const dz = Math.abs(chunk.cz - pcz);
      if (dx > radius + 1 || dz > radius + 1) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const chunk = this._chunks.get(key);
      chunk.dispose(this._scene);
      this._chunks.delete(key);
    }
  }

  /**
   * Get interpolated terrain height at any world XZ position.
   * Uses loaded chunk data if available, falls back to main-thread noise.
   * Per spec: clamps to chunk edge if neighbor not loaded.
   * @param {number} wx - world X
   * @param {number} wz - world Z
   * @returns {number} terrain height
   */
  getTerrainHeight(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    const chunk = this._chunks.get(key);

    if (chunk && chunk.heightmap) {
      return chunk.getHeight(wx, wz);
    }

    // Fallback: compute from noise on main thread
    return this._noise.terrainHeight(wx, wz);
  }

  /**
   * Get the biome at a world XZ position.
   */
  getBiome(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    const chunk = this._chunks.get(key);

    if (chunk) {
      return chunk.biome;
    }

    return this._noise.getBiome(wx, wz);
  }

  /**
   * Get the chunk at given chunk coordinates.
   */
  getChunk(cx, cz) {
    return this._chunks.get(`${cx},${cz}`) || null;
  }

  _reloadAll() {
    // Dispose all chunks and re-request
    for (const [key, chunk] of this._chunks) {
      chunk.dispose(this._scene);
    }
    this._chunks.clear();
    this._workerQueue.length = 0;
    this._workerPending.clear();
    this._lastPlayerCX = null;
    this._lastPlayerCZ = null;
  }

  dispose() {
    settings.offChange('drawDistance', this._onDrawDistChange);

    for (const [key, chunk] of this._chunks) {
      chunk.dispose(this._scene);
    }
    this._chunks.clear();

    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }
}
