/**
 * Noise - Seeded noise utilities for world generation.
 * Imports: simplex-noise (npm).
 * Exports: createNoise(seed) returning an object with noise2D, octaveNoise, moistureNoise.
 * 
 * Used on main thread for terrain height lookups.
 * Worker has its own inline noise implementation (cannot import this).
 * All noise is deterministic from the seed.
 */

import { createNoise2D } from 'simplex-noise';

/**
 * Simple seeded PRNG (mulberry32) to create deterministic noise functions.
 */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Octave configuration per spec
const OCTAVE_SCALES = [0.005, 0.01, 0.02, 0.04, 0.08, 0.16];
const OCTAVE_WEIGHTS = [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125];
const HEIGHT_SCALE = 80;
const WEIGHT_SUM = OCTAVE_WEIGHTS.reduce((a, b) => a + b, 0);

/**
 * Create a seeded noise system.
 * @param {number} seed - 32-bit integer seed
 * @returns {object} Noise utility functions
 */
export function createNoiseSystem(seed) {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);

  // Second noise function for moisture (different seed offset)
  const rng2 = mulberry32(seed + 12345);
  const moistureNoise2D = createNoise2D(rng2);

  /**
   * Sample octave noise at world position.
   * Returns raw value in approximately [-1, 1] range.
   */
  function octaveNoise(x, z) {
    let value = 0;
    for (let i = 0; i < 6; i++) {
      value += noise2D(x * OCTAVE_SCALES[i], z * OCTAVE_SCALES[i]) * OCTAVE_WEIGHTS[i];
    }
    return value / WEIGHT_SUM;
  }

  /**
   * Sample terrain height at world position.
   * Returns height in world units (positive = above water, negative = below).
   */
  function terrainHeight(x, z) {
    let height = octaveNoise(x, z) * HEIGHT_SCALE;

    // Moisture-based flattening: areas with low moisture flatten toward Y=0 (lakes)
    const moisture = moistureNoise2D(x * 0.008, z * 0.008);
    if (moisture < -0.3) {
      // Flatten toward water level
      const flatFactor = 1.0 - ((-0.3 - moisture) / 0.7); // 0 at moisture=-1, 1 at moisture=-0.3
      const clampedFactor = Math.max(0, Math.min(1, flatFactor));
      height = height * clampedFactor;
    }

    return height;
  }

  /**
   * Sample moisture at world position. Returns [-1, 1].
   */
  function moisture(x, z) {
    return moistureNoise2D(x * 0.008, z * 0.008);
  }

  /**
   * Get elevation noise at low octave (for biome assignment).
   */
  function elevation(x, z) {
    return noise2D(x * 0.005, z * 0.005);
  }

  /**
   * Determine biome from elevation and moisture values.
   * Returns biome name string.
   */
  function getBiome(x, z) {
    const elev = (elevation(x, z) + 1) / 2; // normalize to 0-1
    const moist = (moisture(x, z) + 1) / 2;  // normalize to 0-1

    if (elev > 0.7) return 'mountain';
    if (elev > 0.5 && moist < 0.3) return 'tundra';
    if (elev > 0.4 && moist > 0.5) return 'forest';
    if (elev > 0.3 && moist < 0.3) return 'desert';
    if (elev < 0.3 && moist > 0.6) return 'wetlands';
    return 'plains';
  }

  return {
    noise2D,
    moistureNoise2D,
    octaveNoise,
    terrainHeight,
    moisture,
    elevation,
    getBiome,
  };
}
