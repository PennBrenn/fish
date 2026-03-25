/**
 * ChunkWorker - Self-contained Web Worker for off-thread chunk generation.
 * NO imports from main thread. NO Three.js (requires DOM).
 * 
 * Receives: { type: 'generateChunk', seed, cx, cz }
 * Returns: { type: 'chunkData', cx, cz, heightmap: Float32Array, biome: string }
 * 
 * Contains its own inline simplex noise implementation.
 */

// ============================================================
// Inline seeded PRNG (mulberry32)
// ============================================================
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Inline simplex noise 2D (based on open-simplex-noise algorithm)
// ============================================================
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

function buildPermTable(rng) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }
  return perm;
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function createNoise2D(rng) {
  const perm = buildPermTable(rng);

  return function noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = perm[ii + perm[jj]] & 7;
      n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = perm[ii + i1 + perm[jj + j1]] & 7;
      n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = perm[ii + 1 + perm[jj + 1]] & 7;
      n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  };
}

// ============================================================
// Terrain generation constants (must match Noise.js)
// ============================================================
const CHUNK_SIZE = 64;
const CHUNK_VERTS = 65; // 64 quads + 1
const OCTAVE_SCALES = [0.005, 0.01, 0.02, 0.04, 0.08, 0.16];
const OCTAVE_WEIGHTS = [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125];
const HEIGHT_SCALE = 80;
const WEIGHT_SUM = OCTAVE_WEIGHTS.reduce((a, b) => a + b, 0);

// ============================================================
// Worker message handler
// ============================================================
let noise2D = null;
let moistureNoise2D = null;
let currentSeed = null;

function initNoise(seed) {
  if (seed === currentSeed) return;
  currentSeed = seed;
  const rng1 = mulberry32(seed);
  noise2D = createNoise2D(rng1);
  const rng2 = mulberry32(seed + 12345);
  moistureNoise2D = createNoise2D(rng2);
}

function octaveNoise(x, z) {
  let value = 0;
  for (let i = 0; i < 6; i++) {
    value += noise2D(x * OCTAVE_SCALES[i], z * OCTAVE_SCALES[i]) * OCTAVE_WEIGHTS[i];
  }
  return value / WEIGHT_SUM;
}

function generateChunkHeightmap(cx, cz) {
  const heightmap = new Float32Array(CHUNK_VERTS * CHUNK_VERTS);
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  for (let iz = 0; iz < CHUNK_VERTS; iz++) {
    for (let ix = 0; ix < CHUNK_VERTS; ix++) {
      const wx = worldX + ix;
      const wz = worldZ + iz;

      let height = octaveNoise(wx, wz) * HEIGHT_SCALE;

      // Moisture-based flattening for lake basins
      const moisture = moistureNoise2D(wx * 0.008, wz * 0.008);
      if (moisture < -0.3) {
        const flatFactor = 1.0 - ((-0.3 - moisture) / 0.7);
        const clamped = Math.max(0, Math.min(1, flatFactor));
        height = height * clamped;
      }

      heightmap[iz * CHUNK_VERTS + ix] = height;
    }
  }

  return heightmap;
}

// ============================================================
// Biome density config
// ============================================================
const BIOME_TREE_DENSITY = {
  plains: 0.15,
  forest: 0.6,
  mountain: 0.08,
  desert: 0.02,
  wetlands: 0.25,
  tundra: 0.05,
};

const BIOME_ROCK_DENSITY = {
  plains: 0.05,
  forest: 0.08,
  mountain: 0.4,
  desert: 0.15,
  wetlands: 0.03,
  tundra: 0.2,
};

// ============================================================
// Poisson disk sampling (fast approximation)
// ============================================================
function poissonDiskSample(cx, cz, seed, minDist, maxCount) {
  const rng = mulberry32(seed ^ (cx * 73856093) ^ (cz * 19349663));
  const points = [];
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(CHUNK_SIZE / cellSize);
  const grid = new Int32Array(gridW * gridW).fill(-1);
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  // Seed with a few initial points
  const numSeeds = Math.min(10, maxCount);
  for (let s = 0; s < numSeeds && points.length < maxCount; s++) {
    const px = rng() * CHUNK_SIZE;
    const pz = rng() * CHUNK_SIZE;
    const gx = Math.floor(px / cellSize);
    const gz = Math.floor(pz / cellSize);

    if (gx >= 0 && gx < gridW && gz >= 0 && gz < gridW) {
      const gi = gz * gridW + gx;
      if (grid[gi] === -1) {
        grid[gi] = points.length;
        points.push({ x: worldX + px, z: worldZ + pz });
      }
    }
  }

  // Generate more points around existing ones
  const active = [...Array(points.length).keys()];
  const maxAttempts = 8;

  while (active.length > 0 && points.length < maxCount) {
    const aidx = Math.floor(rng() * active.length);
    const pidx = active[aidx];
    const point = points[pidx];
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = minDist + rng() * minDist;
      const nx = (point.x - worldX) + Math.cos(angle) * dist;
      const nz = (point.z - worldZ) + Math.sin(angle) * dist;

      if (nx < 1 || nx > CHUNK_SIZE - 1 || nz < 1 || nz > CHUNK_SIZE - 1) continue;

      const gx = Math.floor(nx / cellSize);
      const gz = Math.floor(nz / cellSize);
      if (gx < 0 || gx >= gridW || gz < 0 || gz >= gridW) continue;

      // Check neighbors
      let tooClose = false;
      for (let di = -2; di <= 2 && !tooClose; di++) {
        for (let dj = -2; dj <= 2 && !tooClose; dj++) {
          const ngi = gz + dj;
          const ngj = gx + di;
          if (ngi < 0 || ngi >= gridW || ngj < 0 || ngj >= gridW) continue;
          const ni = ngi * gridW + ngj;
          if (grid[ni] !== -1) {
            const other = points[grid[ni]];
            const ddx = (worldX + nx) - other.x;
            const ddz = (worldZ + nz) - other.z;
            if (ddx * ddx + ddz * ddz < minDist * minDist) {
              tooClose = true;
            }
          }
        }
      }

      if (!tooClose) {
        const gi = gz * gridW + gx;
        grid[gi] = points.length;
        const newPoint = { x: worldX + nx, z: worldZ + nz };
        points.push(newPoint);
        active.push(points.length - 1);
        found = true;
        if (points.length >= maxCount) break;
      }
    }

    if (!found) {
      active.splice(aidx, 1);
    }
  }

  return points;
}

// ============================================================
// Object placement generation
// ============================================================
function generateObjects(cx, cz, seed, heightmap, biome) {
  const rng = mulberry32(seed ^ (cx * 48611) ^ (cz * 96137));
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  // Helper to get height from heightmap at world pos
  function getH(wx, wz) {
    const lx = Math.max(0, Math.min(CHUNK_SIZE, wx - worldX));
    const lz = Math.max(0, Math.min(CHUNK_SIZE, wz - worldZ));
    const ix = Math.min(Math.floor(lx), CHUNK_VERTS - 2);
    const iz = Math.min(Math.floor(lz), CHUNK_VERTS - 2);
    return heightmap[iz * CHUNK_VERTS + ix];
  }

  // Trees
  const treeDensity = BIOME_TREE_DENSITY[biome] || 0.1;
  const maxTrees = Math.floor(500 * treeDensity);
  const treeMinDist = 3.0 / Math.max(0.1, treeDensity);
  const treePoints = poissonDiskSample(cx, cz, seed + 111, Math.max(2, treeMinDist), maxTrees);

  const trees = [];
  for (const pt of treePoints) {
    const h = getH(pt.x, pt.z);
    if (h < 0.5) continue; // Don't place in water or near shore

    const trunkHeight = 4 + rng() * 8;
    const trunkRadius = 0.3 + rng() * 0.5;
    const canopyRadius = 2 + rng() * 4;
    const canopyType = rng() < 0.5 ? 0 : 1; // 0 = cone, 1 = sphere
    const lean = (rng() - 0.5) * 2; // -1 to 1, will be scaled in ObjectPlacer

    trees.push({
      x: pt.x,
      z: pt.z,
      trunkHeight,
      trunkRadius,
      canopyRadius,
      canopyType,
      lean,
    });
  }

  // Rocks
  const rockDensity = BIOME_ROCK_DENSITY[biome] || 0.05;
  const maxRocks = Math.floor(200 * rockDensity);
  const rockPoints = poissonDiskSample(cx, cz, seed + 222, 2.5, maxRocks);

  const rocks = [];
  for (const pt of rockPoints) {
    const h = getH(pt.x, pt.z);
    if (h < -1) continue;

    const scale = 0.5 + rng() * 2.5;
    const rotY = rng() * Math.PI * 2;
    rocks.push({ x: pt.x, z: pt.z, scale, rotY });
  }

  return { trees, rocks };
}

function getChunkBiome(cx, cz) {
  const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;

  const elev = (noise2D(centerX * 0.005, centerZ * 0.005) + 1) / 2;
  const moist = (moistureNoise2D(centerX * 0.008, centerZ * 0.008) + 1) / 2;

  if (elev > 0.7) return 'mountain';
  if (elev > 0.5 && moist < 0.3) return 'tundra';
  if (elev > 0.4 && moist > 0.5) return 'forest';
  if (elev > 0.3 && moist < 0.3) return 'desert';
  if (elev < 0.3 && moist > 0.6) return 'wetlands';
  return 'plains';
}

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'generateChunk') {
    initNoise(msg.seed);

    const heightmap = generateChunkHeightmap(msg.cx, msg.cz);
    const biome = getChunkBiome(msg.cx, msg.cz);
    const objects = generateObjects(msg.cx, msg.cz, msg.seed, heightmap, biome);

    self.postMessage(
      {
        type: 'chunkData',
        cx: msg.cx,
        cz: msg.cz,
        heightmap,
        biome,
        trees: objects.trees,
        rocks: objects.rocks,
      },
      [heightmap.buffer] // Transfer ownership for zero-copy
    );
  }
};
