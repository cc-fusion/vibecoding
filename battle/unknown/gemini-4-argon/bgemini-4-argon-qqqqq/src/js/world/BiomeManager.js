import { SEA_LEVEL } from '../constants.js';
import { SeededNoise } from '../utils/Noise.js';

export const BIOME_IDS = {
  OCEAN: 'ocean',
  BEACH: 'beach',
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  SNOWY_TAIGA: 'snowy_taiga',
  MOUNTAINS: 'mountains',
};

export const BIOMES = {
  [BIOME_IDS.OCEAN]: {
    id: BIOME_IDS.OCEAN,
    name: 'Azure Ocean',
    grassTint: [0.45, 0.78, 0.35],
    foliageTint: [0.38, 0.72, 0.30],
    snowy: false,
  },
  [BIOME_IDS.BEACH]: {
    id: BIOME_IDS.BEACH,
    name: 'Sunlit Shore',
    grassTint: [0.50, 0.80, 0.36],
    foliageTint: [0.42, 0.74, 0.31],
    snowy: false,
  },
  [BIOME_IDS.PLAINS]: {
    id: BIOME_IDS.PLAINS,
    name: 'Emerald Plains',
    grassTint: [0.47, 0.82, 0.33],
    foliageTint: [0.40, 0.75, 0.28],
    snowy: false,
  },
  [BIOME_IDS.FOREST]: {
    id: BIOME_IDS.FOREST,
    name: 'Whispering Forest',
    grassTint: [0.36, 0.75, 0.28],
    foliageTint: [0.30, 0.68, 0.24],
    snowy: false,
  },
  [BIOME_IDS.DESERT]: {
    id: BIOME_IDS.DESERT,
    name: 'Golden Desert',
    grassTint: [0.68, 0.72, 0.32],
    foliageTint: [0.58, 0.66, 0.28],
    dry: true,
    snowy: false,
  },
  [BIOME_IDS.SNOWY_TAIGA]: {
    id: BIOME_IDS.SNOWY_TAIGA,
    name: 'Snowy Taiga',
    grassTint: [0.44, 0.66, 0.48],
    foliageTint: [0.35, 0.58, 0.40],
    snowy: true,
  },
  [BIOME_IDS.MOUNTAINS]: {
    id: BIOME_IDS.MOUNTAINS,
    name: 'Alpine Peaks',
    grassTint: [0.42, 0.68, 0.42],
    foliageTint: [0.36, 0.62, 0.36],
    snowy: false,
  },
};

export class BiomeManager {
  constructor(seed) {
    this.tempNoise = new SeededNoise(seed ^ 0x1a2b3c4d);
    this.humidNoise = new SeededNoise(seed ^ 0x5e6f7788);
    this.contNoise = new SeededNoise(seed ^ 0x91827364);
    this.ridgeNoise = new SeededNoise(seed ^ 0x33557799);
    this.detailNoise = new SeededNoise(seed ^ 0xabcdef12);
  }

  // Smooth continuous column parameters + biome classification
  sampleColumn(wx, wz) {
    const scaleClimate = 0.0028;
    const temp = this.tempNoise.fbm2D(wx * scaleClimate, wz * scaleClimate, 3);     // ~[-0.7, 0.7]
    const humid = this.humidNoise.fbm2D(wx * scaleClimate + 31.7, wz * scaleClimate - 19.3, 3);
    const cont = this.contNoise.fbm2D(wx * 0.0042, wz * 0.0042, 4);               // continentalness
    const ridge = this.ridgeNoise.ridged2D(wx * 0.0065, wz * 0.0065, 4);          // [0..1]
    const hills = this.detailNoise.fbm2D(wx * 0.016, wz * 0.016, 3);

    // Smooth elevation synthesis from continuous fields (zero sharp seams!)
    let baseHeight = SEA_LEVEL + 4.5 + cont * 21.0 + hills * 5.5;

    // Mountain uplift where continentalness & ridge align
    const mountainFactor = Math.max(0, (cont - 0.06) * 1.85) * Math.max(0, ridge - 0.25);
    baseHeight += mountainFactor * 38.0;

    // Carve gentle river channels along narrow contour bands when inland
    const riverWave = Math.abs(this.contNoise.noise2D(wx * 0.0055 + 100, wz * 0.0055 - 100));
    if (cont > -0.08 && mountainFactor < 0.32 && riverWave < 0.055) {
      const riverDepth = (1.0 - riverWave / 0.055) * 7.5;
      baseHeight = Math.min(baseHeight, SEA_LEVEL + 2.5) - riverDepth * 0.75;
    }

    const height = Math.max(8, Math.min(86, Math.round(baseHeight)));

    // Classify biome smoothly
    let biomeId = BIOME_IDS.PLAINS;
    if (height < SEA_LEVEL - 1) {
      biomeId = BIOME_IDS.OCEAN;
    } else if (height <= SEA_LEVEL + 1 && temp > -0.18 && mountainFactor < 0.22) {
      biomeId = BIOME_IDS.BEACH;
    } else if (mountainFactor > 0.28 || height >= 58) {
      biomeId = BIOME_IDS.MOUNTAINS;
    } else if (temp < -0.20) {
      biomeId = BIOME_IDS.SNOWY_TAIGA;
    } else if (temp > 0.20 && humid < 0.04) {
      biomeId = BIOME_IDS.DESERT;
    } else if (humid > 0.05) {
      biomeId = BIOME_IDS.FOREST;
    } else {
      biomeId = BIOME_IDS.PLAINS;
    }

    return {
      height,
      temp,
      humid,
      cont,
      mountainFactor,
      biome: BIOMES[biomeId],
    };
  }
}
