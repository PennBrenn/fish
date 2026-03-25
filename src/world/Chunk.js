/**
 * Chunk - Single chunk: stores heightmap, mesh, and disposables array.
 * Imports: TerrainBuilder.
 * Exports: Chunk class.
 * 
 * Handles disposal of all GPU resources (geometry, material textures).
 * Per spec: keeps a disposables array, iterates on unload to dispose everything.
 * Material is shared across chunks so NOT disposed here (owned by TerrainBuilder).
 */

import TerrainBuilder from './TerrainBuilder.js';
import ObjectPlacer from './ObjectPlacer.js';

const CHUNK_SIZE = 64;
const CHUNK_VERTS = 65;

export default class Chunk {
  /**
   * @param {number} cx - chunk coordinate X
   * @param {number} cz - chunk coordinate Z
   * @param {Float32Array} heightmap - 65x65 vertex heights
   * @param {string} biome - biome name for this chunk
   */
  /**
   * @param {number} cx - chunk coordinate X
   * @param {number} cz - chunk coordinate Z
   * @param {Float32Array} heightmap - 65x65 vertex heights
   * @param {string} biome - biome name for this chunk
   * @param {Array} [trees] - tree placement data from worker
   * @param {Array} [rocks] - rock placement data from worker
   */
  constructor(cx, cz, heightmap, biome, trees, rocks) {
    this.cx = cx;
    this.cz = cz;
    this.heightmap = heightmap;
    this.biome = biome;
    this.trees = trees || [];
    this.rocks = rocks || [];
    this.mesh = null;
    this.objectGroup = null;
    this.colliders = [];  // collision cylinders for Player
    this._disposables = [];
    this._built = false;
  }

  get key() {
    return `${this.cx},${this.cz}`;
  }

  get worldX() {
    return this.cx * CHUNK_SIZE;
  }

  get worldZ() {
    return this.cz * CHUNK_SIZE;
  }

  /**
   * Build the Three.js mesh from heightmap data.
   * Call once after construction.
   */
  build() {
    if (this._built) return;

    // Build terrain mesh
    const result = TerrainBuilder.build(this.heightmap, this.cx, this.cz, this.biome);
    this.mesh = result.mesh;
    this._disposables.push(result.geometry);

    // Build objects (trees, rocks) using InstancedMesh
    if (this.trees.length > 0 || this.rocks.length > 0) {
      const getH = (wx, wz) => this.getHeight(wx, wz);
      const objResult = ObjectPlacer.buildChunkObjects(
        this.trees, this.rocks, this.biome, getH
      );
      this.objectGroup = objResult.group;
      this.colliders = objResult.colliders;
      // Track disposables from object placement
      for (const d of objResult.disposables) {
        this._disposables.push(d);
      }
    }

    this._built = true;
  }

  /**
   * Get interpolated terrain height at a world XZ position within this chunk.
   * Clamps to chunk edges if position is at boundary.
   * @param {number} wx - world X
   * @param {number} wz - world Z
   * @returns {number} height
   */
  getHeight(wx, wz) {
    return TerrainBuilder.sampleHeight(this.heightmap, this.cx, this.cz, wx, wz);
  }

  /**
   * Check if a world position falls within this chunk's XZ bounds.
   */
  containsXZ(wx, wz) {
    const lx = wx - this.worldX;
    const lz = wz - this.worldZ;
    return lx >= 0 && lx <= CHUNK_SIZE && lz >= 0 && lz <= CHUNK_SIZE;
  }

  /**
   * Dispose all GPU resources and remove mesh from scene.
   * After calling this, the chunk should not be used.
   */
  dispose(scene) {
    // Dispose all tracked GPU resources
    for (const disposable of this._disposables) {
      if (disposable && typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
    }
    this._disposables.length = 0;

    // Remove terrain mesh from scene
    if (this.mesh && scene) {
      scene.remove(this.mesh);
    }

    // Remove object group from scene and dispose instanced meshes
    if (this.objectGroup && scene) {
      // Dispose InstancedMesh geometry is shared, but we need to remove from scene
      this.objectGroup.traverse((child) => {
        if (child.isInstancedMesh && child.geometry) {
          // Shared geometry — don't dispose. InstancedMesh only.
        }
      });
      scene.remove(this.objectGroup);
    }

    this.mesh = null;
    this.objectGroup = null;
    this.colliders = [];
    this.heightmap = null;
    this.trees = null;
    this.rocks = null;
    this._built = false;
  }
}
