export type Rarity = 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Chroma' | 'Mystic';

export interface BlookItem {
  id: string;
  name: string;
  rarity: Rarity;
  chance: number; // Exact percentage
  chanceLabel: string; // e.g., "17%", "15%", "7%", "3.57%", "0.4%", "0.03%"
  sellPrice: number;
  packId: string;
  imageUrl?: string;
}

export interface PackInfo {
  id: string;
  name: string;
  price: number;
  bgColor: string;
  borderColor: string;
  revealBgColor: string;
  coverImageUrl?: string;
  blooks: BlookItem[];
}

export const RARITY_COLORS: Record<Rarity, string> = {
  Uncommon: '#4bc22e', // Lime green
  Rare: '#0a5cf5',     // Vibrant blue
  Epic: '#be0000',     // Crimson red
  Legendary: '#ff910f',// Orange
  Chroma: '#00ccff',   // Cyan
  Mystic: '#9900ff',   // Purple
};

export const RARITY_RANK: Record<Rarity, number> = {
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Chroma: 5,
  Mystic: 6,
};

export const CIRCUS_BLOOKS: BlookItem[] = [
  {
    id: 'tightrope-walker',
    name: 'Tightrope Walker',
    rarity: 'Uncommon',
    chance: 17,
    chanceLabel: '17%',
    sellPrice: 5,
    packId: 'circus',
  },
  {
    id: 'jester',
    name: 'Jester',
    rarity: 'Uncommon',
    chance: 17,
    chanceLabel: '17%',
    sellPrice: 5,
    packId: 'circus',
  },
  {
    id: 'magician',
    name: 'Magician',
    rarity: 'Uncommon',
    chance: 17,
    chanceLabel: '17%',
    sellPrice: 5,
    packId: 'circus',
  },
  {
    id: 'top-hat',
    name: 'Top Hat',
    rarity: 'Uncommon',
    chance: 17,
    chanceLabel: '17%',
    sellPrice: 5,
    packId: 'circus',
  },
  {
    id: 'popcorn',
    name: 'Popcorn',
    rarity: 'Uncommon',
    chance: 17,
    chanceLabel: '17%',
    sellPrice: 5,
    packId: 'circus',
  },
  {
    id: 'cotton-candy',
    name: 'Cotton Candy',
    rarity: 'Rare',
    chance: 8,
    chanceLabel: '8%',
    sellPrice: 20,
    packId: 'circus',
  },
  {
    id: 'unicycler',
    name: 'Unicycler',
    rarity: 'Rare',
    chance: 8,
    chanceLabel: '8%',
    sellPrice: 20,
    packId: 'circus',
  },
  {
    id: 'canon-ball',
    name: 'Canon Ball',
    rarity: 'Rare',
    chance: 8,
    chanceLabel: '8%',
    sellPrice: 20,
    packId: 'circus',
  },
  {
    id: 'magic-wand',
    name: 'Magic Wand',
    rarity: 'Epic',
    chance: 3,
    chanceLabel: '3%',
    sellPrice: 75,
    packId: 'circus',
  },
  {
    id: 'tent',
    name: 'Tent',
    rarity: 'Epic',
    chance: 3,
    chanceLabel: '3%',
    sellPrice: 75,
    packId: 'circus',
  },
  {
    id: 'circus-ball',
    name: 'Circus Ball',
    rarity: 'Legendary',
    chance: 0.3,
    chanceLabel: '0.3%',
    sellPrice: 200,
    packId: 'circus',
  },
  {
    id: 'circus-elephant',
    name: 'Circus Elephant',
    rarity: 'Chroma',
    chance: 0.05,
    chanceLabel: '0.05%',
    sellPrice: 300,
    packId: 'circus',
  },
  {
    id: 'ring-lion',
    name: 'Ring Lion',
    rarity: 'Chroma',
    chance: 0.03,
    chanceLabel: '0.03%',
    sellPrice: 350,
    packId: 'circus',
  },
  {
    id: 'fire-guy',
    name: 'Fire Guy',
    rarity: 'Chroma',
    chance: 0.03,
    chanceLabel: '0.03%',
    sellPrice: 350,
    packId: 'circus',
  },
  {
    id: 'the-golden-ticket',
    name: 'The Golden Ticket',
    rarity: 'Mystic',
    chance: 0.002,
    chanceLabel: '0.002%',
    sellPrice: 1000,
    packId: 'circus',
  },
];

export const ATHLETES_BLOOKS: BlookItem[] = [
  {
    id: 'athlete-football',
    name: 'Football Player',
    rarity: 'Uncommon',
    chance: 15,
    chanceLabel: '15%',
    sellPrice: 5,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__8__1fd2ddf0.png',
  },
  {
    id: 'athlete-baseball',
    name: 'Baseball Player',
    rarity: 'Uncommon',
    chance: 15,
    chanceLabel: '15%',
    sellPrice: 5,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__9__503c7292.png',
  },
  {
    id: 'athlete-racer',
    name: 'Race Car Driver',
    rarity: 'Uncommon',
    chance: 15,
    chanceLabel: '15%',
    sellPrice: 5,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__10__a82bd15a.png',
  },
  {
    id: 'athlete-referee',
    name: 'Referee',
    rarity: 'Uncommon',
    chance: 15,
    chanceLabel: '15%',
    sellPrice: 5,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__11__98e22493.png',
  },
  {
    id: 'athlete-basketball',
    name: 'Basketball Player',
    rarity: 'Uncommon',
    chance: 15,
    chanceLabel: '15%',
    sellPrice: 5,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__12__145c93f6.png',
  },
  {
    id: 'athlete-runner',
    name: 'Track Runner',
    rarity: 'Rare',
    chance: 7,
    chanceLabel: '7%',
    sellPrice: 20,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__13__9bca1b6b.png',
  },
  {
    id: 'athlete-martial-artist',
    name: 'Martial Artist',
    rarity: 'Rare',
    chance: 7,
    chanceLabel: '7%',
    sellPrice: 20,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__14__24143c42.png',
  },
  {
    id: 'athlete-fencer',
    name: 'Fencer',
    rarity: 'Rare',
    chance: 7,
    chanceLabel: '7%',
    sellPrice: 20,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__15__d4d9b8c1.png',
  },
  {
    id: 'athlete-golfer',
    name: 'Golfer',
    rarity: 'Epic',
    chance: 3.57,
    chanceLabel: '3.57%',
    sellPrice: 75,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__16__518d3dbc.png',
  },
  {
    id: 'athlete-soccer',
    name: 'Soccer Player',
    rarity: 'Legendary',
    chance: 0.4,
    chanceLabel: '0.4%',
    sellPrice: 200,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__17__e8d8a365.png',
  },
  {
    id: 'athlete-cyborg',
    name: 'Cyborg Coach',
    rarity: 'Chroma',
    chance: 0.03,
    chanceLabel: '0.03%',
    sellPrice: 350,
    packId: 'athletes',
    imageUrl: 'assets/aistudio/download__18__e086e375.png',
  },
];

export const ALL_BLOOKS: BlookItem[] = [...CIRCUS_BLOOKS, ...ATHLETES_BLOOKS];

export const CIRCUS_PACK: PackInfo = {
  id: 'circus',
  name: 'Circus Pack',
  price: 20,
  bgColor: '#ff4242',
  borderColor: '#b91c1c',
  revealBgColor: '#fca5a5',
  coverImageUrl: 'assets/aistudio/Pack_Designs__4_-removebg-preview_40ec04e2.png',
  blooks: CIRCUS_BLOOKS,
};

export const ATHLETES_PACK: PackInfo = {
  id: 'athletes',
  name: 'Athletes Pack',
  price: 20,
  bgColor: '#4ade80',
  borderColor: '#16a34a',
  revealBgColor: '#86efac',
  coverImageUrl: 'assets/aistudio/Pack_Designs__2_-removebg-preview_c4530e10.png',
  blooks: ATHLETES_BLOOKS,
};

export const MARKET_PACKS: PackInfo[] = [CIRCUS_PACK, ATHLETES_PACK];

export function rollBlookFromPack(pack: PackInfo, luckMultiplier: number = 1): BlookItem {
  const items = pack.blooks;
  const weights = items.map((item) => {
    if (luckMultiplier > 1 && item.rarity !== 'Uncommon') {
      return item.chance * luckMultiplier;
    }
    return item.chance;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[0];
}

export interface BazaarIngredient {
  blookId: string;
  count: number;
}

export interface BazaarRecipe {
  id: string;
  targetBlookId: string;
  ingredients: BazaarIngredient[];
}

export const BAZAAR_RECIPES: BazaarRecipe[] = [
  {
    id: 'craft-cotton-candy',
    targetBlookId: 'cotton-candy',
    ingredients: [
      { blookId: 'tightrope-walker', count: 5 },
      { blookId: 'jester', count: 1 },
      { blookId: 'magician', count: 2 },
    ],
  },
  {
    id: 'craft-unicycler',
    targetBlookId: 'unicycler',
    ingredients: [
      { blookId: 'jester', count: 3 },
      { blookId: 'popcorn', count: 3 },
      { blookId: 'top-hat', count: 2 },
    ],
  },
  {
    id: 'craft-canon-ball',
    targetBlookId: 'canon-ball',
    ingredients: [
      { blookId: 'top-hat', count: 4 },
      { blookId: 'popcorn', count: 2 },
      { blookId: 'tightrope-walker', count: 2 },
    ],
  },
  {
    id: 'craft-magic-wand',
    targetBlookId: 'magic-wand',
    ingredients: [
      { blookId: 'cotton-candy', count: 2 },
      { blookId: 'unicycler', count: 2 },
      { blookId: 'magician', count: 3 },
    ],
  },
  {
    id: 'craft-tent',
    targetBlookId: 'tent',
    ingredients: [
      { blookId: 'canon-ball', count: 2 },
      { blookId: 'cotton-candy', count: 2 },
      { blookId: 'top-hat', count: 3 },
    ],
  },
  {
    id: 'craft-circus-ball',
    targetBlookId: 'circus-ball',
    ingredients: [
      { blookId: 'magic-wand', count: 3 },
      { blookId: 'tent', count: 3 },
    ],
  },
  {
    id: 'craft-circus-elephant',
    targetBlookId: 'circus-elephant',
    ingredients: [
      { blookId: 'circus-ball', count: 2 },
      { blookId: 'magic-wand', count: 2 },
      { blookId: 'tent', count: 2 },
    ],
  },
  {
    id: 'craft-ring-lion',
    targetBlookId: 'ring-lion',
    ingredients: [
      { blookId: 'circus-ball', count: 2 },
      { blookId: 'circus-elephant', count: 1 },
      { blookId: 'canon-ball', count: 3 },
    ],
  },
  {
    id: 'craft-fire-guy',
    targetBlookId: 'fire-guy',
    ingredients: [
      { blookId: 'circus-ball', count: 2 },
      { blookId: 'magic-wand', count: 3 },
      { blookId: 'popcorn', count: 3 },
    ],
  },
  {
    id: 'craft-the-golden-ticket',
    targetBlookId: 'the-golden-ticket',
    ingredients: [
      { blookId: 'circus-elephant', count: 1 },
      { blookId: 'ring-lion', count: 1 },
      { blookId: 'fire-guy', count: 1 },
      { blookId: 'circus-ball', count: 2 },
    ],
  },
];

