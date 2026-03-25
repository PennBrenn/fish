/**
 * TerrainBuilder - Builds Three.js mesh from raw heightmap data.
 * Imports: Three.js only.
 * Exports: TerrainBuilder class with static build method.
 * 
 * Takes a Float32Array heightmap (65x65) and chunk world offset,
 * builds a PlaneGeometry with displaced vertices, computes normals,
 * applies vertex colors based on height.
 */

import * as THREE from 'three';

const CHUNK_SIZE = 64;
const CHUNK_VERTS = 65;

// Biome color palettes (base ground color)
const BIOME_COLORS = {
  plains:   { low: new THREE.Color(0x5a8f3c), high: new THREE.Color(0x8b7355) },
  forest:   { low: new THREE.Color(0x2d5a1e), high: new THREE.Color(0x6b5a3c) },
  mountain: { low: new THREE.Color(0x6b6b6b), high: new THREE.Color(0xcccccc) },
  desert:   { low: new THREE.Color(0xc2a64e), high: new THREE.Color(0xe8d5a3) },
  wetlands: { low: new THREE.Color(0x3a6b3a), high: new THREE.Color(0x5a7d4a) },
  tundra:   { low: new THREE.Color(0x8a9a8a), high: new THREE.Color(0xd0d8d0) },
};

// Shared material per biome type (reuse across chunks)
const sharedMaterials = new Map();

export default class TerrainBuilder {
  /**
   * Build a terrain mesh from heightmap data.
   * @param {Float32Array} heightmap - 65x65 height values
   * @param {number} cx - chunk X coordinate
   * @param {number} cz - chunk Z coordinate
   * @param {string} biome - biome name
   * @returns {{ mesh: THREE.Mesh, geometry: THREE.BufferGeometry, material: THREE.Material }}
   */
  static build(heightmap, cx, cz, biome) {
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    // Create geometry
    const geometry = new THREE.BufferGeometry();

    const vertCount = CHUNK_VERTS * CHUNK_VERTS;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    const palette = BIOME_COLORS[biome] || BIOME_COLORS.plains;
    const tempColor = new THREE.Color();

    // Fill vertex data
    for (let iz = 0; iz < CHUNK_VERTS; iz++) {
      for (let ix = 0; ix < CHUNK_VERTS; ix++) {
        const idx = iz * CHUNK_VERTS + ix;
        const height = heightmap[idx];

        // Position in world space
        positions[idx * 3]     = worldX + ix;       // x
        positions[idx * 3 + 1] = height;             // y
        positions[idx * 3 + 2] = worldZ + iz;       // z

        // UV
        uvs[idx * 2]     = ix / (CHUNK_VERTS - 1);
        uvs[idx * 2 + 1] = iz / (CHUNK_VERTS - 1);

        // Vertex color based on height
        const t = Math.max(0, Math.min(1, (height + 20) / 80)); // normalize height range
        tempColor.copy(palette.low).lerp(palette.high, t);

        // Water-adjacent vertices get a sandy/muddy tint
        if (height < 1.0 && height >= 0) {
          tempColor.lerp(new THREE.Color(0x8b7d5c), 1.0 - height);
        }
        // Underwater vertices are darker
        if (height < 0) {
          tempColor.multiplyScalar(0.6);
        }

        colors[idx * 3]     = tempColor.r;
        colors[idx * 3 + 1] = tempColor.g;
        colors[idx * 3 + 2] = tempColor.b;
      }
    }

    // Build index buffer (two triangles per quad)
    const quads = (CHUNK_VERTS - 1) * (CHUNK_VERTS - 1);
    const indices = new Uint32Array(quads * 6);
    let idxPtr = 0;

    for (let iz = 0; iz < CHUNK_VERTS - 1; iz++) {
      for (let ix = 0; ix < CHUNK_VERTS - 1; ix++) {
        const a = iz * CHUNK_VERTS + ix;
        const b = a + 1;
        const c = a + CHUNK_VERTS;
        const d = c + 1;

        // Triangle 1
        indices[idxPtr++] = a;
        indices[idxPtr++] = c;
        indices[idxPtr++] = b;

        // Triangle 2
        indices[idxPtr++] = b;
        indices[idxPtr++] = c;
        indices[idxPtr++] = d;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Get or create shared material for this biome
    const material = TerrainBuilder._getMaterial(biome);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false; // Terrain doesn't cast shadows on itself
    mesh.frustumCulled = true;

    return { mesh, geometry, material };
  }

  static _getMaterial(biome) {
    if (sharedMaterials.has(biome)) {
      return sharedMaterials.get(biome);
    }

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });

    sharedMaterials.set(biome, mat);
    return mat;
  }

  /**
   * Get interpolated height at any world XZ from a heightmap.
   * Clamps to chunk edge if neighbors not available.
   * @param {Float32Array} heightmap
   * @param {number} cx - chunk coord X
   * @param {number} cz - chunk coord Z
   * @param {number} wx - world X position
   * @param {number} wz - world Z position
   * @returns {number} interpolated height
   */
  static sampleHeight(heightmap, cx, cz, wx, wz) {
    const localX = wx - cx * CHUNK_SIZE;
    const localZ = wz - cz * CHUNK_SIZE;

    // Clamp to chunk bounds
    const clampedX = Math.max(0, Math.min(CHUNK_SIZE, localX));
    const clampedZ = Math.max(0, Math.min(CHUNK_SIZE, localZ));

    const ix = Math.floor(clampedX);
    const iz = Math.floor(clampedZ);
    const fx = clampedX - ix;
    const fz = clampedZ - iz;

    // Clamp indices to valid range
    const ix0 = Math.min(ix, CHUNK_VERTS - 2);
    const iz0 = Math.min(iz, CHUNK_VERTS - 2);
    const ix1 = ix0 + 1;
    const iz1 = iz0 + 1;

    // Bilinear interpolation
    const h00 = heightmap[iz0 * CHUNK_VERTS + ix0];
    const h10 = heightmap[iz0 * CHUNK_VERTS + ix1];
    const h01 = heightmap[iz1 * CHUNK_VERTS + ix0];
    const h11 = heightmap[iz1 * CHUNK_VERTS + ix1];

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;

    return h0 + (h1 - h0) * fz;
  }
}
