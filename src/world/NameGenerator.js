/**
 * NameGenerator - Procedural place name generation using Markov chains.
 * No external dependencies. Uses seeded PRNG for determinism.
 * Exports: NameGenerator class.
 * 
 * Trained on hardcoded syllable list. Generates 2-4 syllable names.
 * Seed per-location using world seed + chunk coordinates.
 */

// 200 English/Welsh-inspired place name syllables
const SYLLABLES = [
  'aber', 'ac', 'al', 'an', 'ar', 'ash', 'ath', 'av', 'bal', 'ban',
  'bar', 'bay', 'beck', 'bel', 'ben', 'ber', 'birch', 'black', 'blan', 'bly',
  'bon', 'bor', 'brad', 'brae', 'bran', 'bre', 'bri', 'bridge', 'brin', 'bro',
  'brook', 'bur', 'burn', 'by', 'cae', 'cal', 'cam', 'car', 'cas', 'ced',
  'cer', 'ches', 'church', 'cir', 'cla', 'cliff', 'clyn', 'coil', 'col', 'com',
  'con', 'cor', 'crag', 'cre', 'crick', 'cross', 'cul', 'cwm', 'dal', 'dale',
  'dar', 'dean', 'del', 'den', 'der', 'din', 'dol', 'don', 'dor', 'down',
  'dun', 'dur', 'ead', 'eal', 'east', 'ed', 'el', 'elm', 'en', 'er',
  'eth', 'fal', 'far', 'fell', 'fen', 'fer', 'field', 'fin', 'fir', 'firth',
  'ford', 'for', 'fos', 'gar', 'gate', 'gil', 'glen', 'glyn', 'gor', 'gra',
  'green', 'grim', 'gwen', 'hag', 'hal', 'ham', 'har', 'haven', 'hay', 'heath',
  'hel', 'hen', 'her', 'high', 'hil', 'holm', 'holt', 'how', 'hurst', 'inch',
  'ing', 'inver', 'ith', 'kel', 'ken', 'ker', 'kin', 'kirk', 'kyle', 'lan',
  'lang', 'lea', 'leigh', 'len', 'ley', 'lin', 'llan', 'loch', 'lon', 'low',
  'lyn', 'mal', 'man', 'mar', 'may', 'mel', 'mer', 'mid', 'mil', 'min',
  'mon', 'moor', 'mor', 'moss', 'moun', 'mul', 'nar', 'ness', 'new', 'nor',
  'north', 'oak', 'old', 'pen', 'pine', 'pol', 'pont', 'pool', 'port', 'rath',
  'red', 'ren', 'rhi', 'ridge', 'rin', 'riv', 'rock', 'ros', 'roth', 'run',
  'sand', 'shan', 'shaw', 'shel', 'shin', 'shire', 'sil', 'south', 'stan', 'stead',
  'ster', 'stock', 'stone', 'strath', 'tal', 'tar', 'tarn', 'ter', 'thorp', 'ton',
];

// Suffix patterns that commonly end place names
const SUFFIXES = [
  'ton', 'ford', 'ley', 'ham', 'wick', 'bury', 'dale', 'field', 'worth',
  'mere', 'pool', 'stead', 'mouth', 'haven', 'bridge', 'hollow', 'reach',
  'crossing', 'landing', 'point', 'bay', 'creek', 'falls',
];

// Prefixes for lakes/rivers
const LAKE_PREFIXES = ['Lake ', 'Loch ', '', '', ''];
const RIVER_PREFIXES = ['River ', '', ''];

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default class NameGenerator {
  /**
   * Generate a deterministic place name from world seed and position.
   * @param {number} worldSeed
   * @param {number} x - chunk or position X
   * @param {number} z - chunk or position Z
   * @param {string} [type='settlement'] - 'settlement', 'lake', 'river', 'mountain'
   * @returns {string}
   */
  static generate(worldSeed, x, z, type = 'settlement') {
    // Deterministic seed from world seed + position
    const localSeed = (worldSeed * 73856093) ^ (x * 19349663) ^ (z * 83492791);
    const rng = mulberry32(localSeed);

    // Number of syllables: 2-4
    const syllableCount = 2 + Math.floor(rng() * 3);

    let name = '';
    for (let i = 0; i < syllableCount; i++) {
      const idx = Math.floor(rng() * SYLLABLES.length);
      let syl = SYLLABLES[idx];

      // Capitalize first syllable
      if (i === 0) {
        syl = syl.charAt(0).toUpperCase() + syl.slice(1);
      }
      name += syl;
    }

    // 40% chance to append a suffix
    if (rng() < 0.4) {
      const suffIdx = Math.floor(rng() * SUFFIXES.length);
      name += SUFFIXES[suffIdx];
    }

    // Type-specific prefix
    if (type === 'lake') {
      const prefix = LAKE_PREFIXES[Math.floor(rng() * LAKE_PREFIXES.length)];
      name = prefix + name;
    } else if (type === 'river') {
      const prefix = RIVER_PREFIXES[Math.floor(rng() * RIVER_PREFIXES.length)];
      name = prefix + name;
    } else if (type === 'mountain') {
      if (rng() < 0.5) {
        name = 'Mt. ' + name;
      } else {
        name = name + ' Peak';
      }
    }

    return name;
  }

  /**
   * Generate a batch of names for testing.
   */
  static generateBatch(worldSeed, count) {
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(NameGenerator.generate(worldSeed, i * 7, i * 13));
    }
    return names;
  }
}
