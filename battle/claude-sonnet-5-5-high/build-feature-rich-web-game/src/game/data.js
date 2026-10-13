// ===== Pocket Valley : static game data =====
export const TILE = 32;
export const SEASON_DAYS = 10;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const SEASON_ICON = ['🌸', '☀️', '🍂', '❄️'];
export const DAY_START = 360;
export const DAY_END = 1560;
export const INV_SIZE = 24;
export const HEART = 100;

export const ITEMS = {};
const I = (id, name, icon, price, cat, x) => { ITEMS[id] = Object.assign({ id, name, icon, price, cat }, x || {}); };

// ---------- crops ----------
export const CROPS = {};
const CR = [
  ['parsnip', 'Parsnip', '🥕', [0], 3, 35, 20, 0, 0],
  ['potato', 'Potato', '🥔', [0], 4, 60, 30, 0, 0],
  ['cauliflower', 'Cauliflower', '🥦', [0], 5, 150, 60, 0, 0],
  ['strawberry', 'Strawberry', '🍓', [0], 4, 75, 80, 2, 1],
  ['greenbean', 'Green Bean', '🌱', [0], 5, 40, 30, 2, 0],
  ['tomato', 'Tomato', '🍅', [1], 4, 70, 50, 3, 1],
  ['melon', 'Melon', '🍈', [1], 5, 190, 80, 0, 1],
  ['pepper', 'Hot Pepper', '🌶️', [1], 3, 45, 40, 2, 0],
  ['blueberry', 'Blueberry', '🫐', [1], 4, 55, 80, 2, 1],
  ['corn', 'Corn', '🌽', [1, 2], 6, 60, 70, 3, 0],
  ['wheat', 'Wheat', '🌾', [1, 2], 3, 25, 10, 0, 0],
  ['pumpkin', 'Pumpkin', '🎃', [2], 6, 220, 90, 0, 0],
  ['eggplant', 'Eggplant', '🍆', [2], 4, 70, 40, 3, 0],
  ['yam', 'Yam', '🍠', [2], 4, 90, 35, 0, 0],
  ['cranberry', 'Cranberry', '🍒', [2], 5, 80, 100, 3, 1],
];
CR.forEach(([id, n, i, s, d, p, sp, rg, fr]) => {
  CROPS[id] = { id, n, i, s, d, p, sp, rg, fr };
  I(id, n, i, p, 'crop');
  I(id + '_seed', n + ' Seeds', i, Math.round(sp * 0.5), 'seed', { seed: id });
});

// ---------- forage ----------
export const FORAGE = [
  ['daffodil', 'Daffodil', '🌼', 30, [0]], ['leek', 'Leek', '🧅', 60, [0]], ['dandelion', 'Dandelion', '🌻', 40, [0]],
  ['sweetpea', 'Sweet Pea', '🌸', 50, [1]], ['fiddlehead', 'Fiddlehead', '🍃', 70, [1]], ['spiceberry', 'Spice Berry', '🔴', 80, [1]],
  ['blackberry', 'Blackberry', '🍇', 25, [2]], ['hazelnut', 'Hazelnut', '🌰', 40, [2]], ['mushroom', 'Mushroom', '🍄', 90, [2]],
  ['plum', 'Wild Plum', '🍑', 80, [2]], ['snowyam', 'Snow Yam', '❄️', 100, [3]], ['crocus', 'Crocus', '🌷', 60, [3]],
  ['winterroot', 'Winter Root', '🥜', 70, [3]], ['seashell', 'Seashell', '🐚', 45, [0, 1, 2, 3]], ['crab', 'Crab Shell', '🦀', 75, [0, 1, 2, 3]],
];
FORAGE.forEach(([id, n, i, p]) => I(id, n, i, p, 'forage'));

// ---------- fish ----------
export const FISH = [
  { id: 'sunfish', n: 'Sunfish', i: '🐟', p: 30, loc: 'pond', se: [0, 1], h: [6, 19], d: 25 },
  { id: 'carp', n: 'Carp', i: '🐟', p: 50, loc: 'pond', se: [0, 1, 2], h: [6, 26], d: 35 },
  { id: 'bass', n: 'Largemouth Bass', i: '🐠', p: 70, loc: 'pond', se: [1, 2], h: [6, 19], d: 45 },
  { id: 'koi', n: 'Golden Koi', i: '🐡', p: 900, loc: 'pond', se: [0, 1, 2, 3], h: [6, 26], d: 85, legend: true, lvl: 6 },
  { id: 'chub', n: 'Chub', i: '🐟', p: 45, loc: 'river', se: [0, 1, 2, 3], h: [6, 26], d: 30 },
  { id: 'salmon', n: 'Salmon', i: '🐠', p: 130, loc: 'river', se: [2], h: [6, 19], d: 55 },
  { id: 'catfish', n: 'Catfish', i: '🐟', p: 150, loc: 'river', se: [0, 2], h: [6, 26], d: 60, w: 'rain' },
  { id: 'perch', n: 'Perch', i: '🐠', p: 60, loc: 'river', se: [3], h: [6, 26], d: 35 },
  { id: 'pike', n: 'Pike', i: '🐟', p: 110, loc: 'river', se: [1, 3], h: [6, 26], d: 55 },
  { id: 'sardine', n: 'Sardine', i: '🐟', p: 40, loc: 'ocean', se: [0, 1, 2, 3], h: [6, 19], d: 25 },
  { id: 'anchovy', n: 'Anchovy', i: '🐟', p: 35, loc: 'ocean', se: [0, 2], h: [6, 26], d: 25 },
  { id: 'tuna', n: 'Tuna', i: '🐠', p: 120, loc: 'ocean', se: [1, 3], h: [6, 19], d: 55 },
  { id: 'snapper', n: 'Red Snapper', i: '🐠', p: 95, loc: 'ocean', se: [1, 2], h: [6, 26], d: 45, w: 'rain' },
  { id: 'squid', n: 'Squid', i: '🦑', p: 160, loc: 'ocean', se: [3], h: [18, 26], d: 60 },
  { id: 'flounder', n: 'Flounder', i: '🐟', p: 100, loc: 'ocean', se: [0, 1], h: [6, 26], d: 45 },
];
FISH.forEach(f => I(f.id, f.n, f.i, f.p, 'fish'));

// ---------- minerals / misc ----------
I('stone', 'Stone', '🪨', 2, 'mineral'); I('coal', 'Coal', '⚫', 25, 'mineral');
I('copper_ore', 'Copper Ore', '🟠', 8, 'ore'); I('iron_ore', 'Iron Ore', '⚪', 14, 'ore'); I('gold_ore', 'Gold Ore', '🟡', 25, 'ore');
I('copper_bar', 'Copper Bar', '🟧', 60, 'bar'); I('iron_bar', 'Iron Bar', '⬜', 110, 'bar'); I('gold_bar', 'Gold Bar', '🏅', 220, 'bar');
I('quartz', 'Quartz', '🔷', 40, 'gem'); I('amethyst', 'Amethyst', '🔮', 100, 'gem'); I('topaz', 'Topaz', '🔶', 120, 'gem'); I('ruby', 'Ruby', '💎', 250, 'gem');
I('wood', 'Wood', '🪵', 4, 'mineral'); I('fiber', 'Fiber', '🧵', 3, 'mineral'); I('hay', 'Hay', '🌾', 20, 'misc', { desc: 'Feeds animals.' });
I('slime', 'Slime', '🟢', 15, 'monster'); I('batwing', 'Bat Wing', '🦇', 25, 'monster'); I('bone', 'Bone Fragment', '🦴', 30, 'monster');
I('ectoplasm', 'Ectoplasm', '👻', 45, 'monster'); I('cinder', 'Cinder Shard', '♨️', 70, 'monster');
I('crown', "Slime King's Crown", '👑', 500, 'trophy'); I('skull', "Bone Lord's Skull", '💀', 600, 'trophy'); I('core', 'Golem Core', '🔥', 800, 'trophy');
I('egg', 'Egg', '🥚', 50, 'animal'); I('large_egg', 'Large Egg', '🥚', 95, 'animal'); I('milk', 'Milk', '🥛', 125, 'animal'); I('large_milk', 'Large Milk', '🥛', 190, 'animal');
I('jelly', 'Jelly', '🍯', 170, 'artisan'); I('pickles', 'Pickles', '🥒', 130, 'artisan');
I('coffee', 'Coffee', '☕', 60, 'food', { food: { e: 30, h: 0, buff: ['speed', 1, 120] } });

// ---------- crafted ----------
export const CRAFTS = [
  { id: 'sprinkler', n: 'Sprinkler', i: '💦', ing: [['copper_bar', 1], ['iron_bar', 1]], sk: ['farming', 2], desc: 'Waters the 4 tiles around it every morning.', place: 1 },
  { id: 'qsprinkler', n: 'Quality Sprinkler', i: '🌧️', ing: [['iron_bar', 1], ['gold_bar', 1], ['quartz', 1]], sk: ['farming', 5], desc: 'Waters all 8 surrounding tiles.', place: 1 },
  { id: 'fertilizer', n: 'Fertilizer', i: '🟤', ing: [['fiber', 3], ['stone', 3]], out: 3, sk: ['farming', 1], desc: 'Plant-side: boosts crop quality. Use on tilled soil.' },
  { id: 'scarecrow', n: 'Scarecrow', i: '🧑‍🌾', ing: [['wood', 20], ['coal', 1], ['fiber', 10]], sk: ['foraging', 1], desc: 'Keeps crows away from crops in a 7-tile radius.', place: 1 },
  { id: 'furnace', n: 'Furnace', i: '🔥', ing: [['copper_ore', 10], ['stone', 20]], sk: ['mining', 1], desc: 'Smelts 5 ore + 1 coal into a bar (2 hours).', place: 1 },
  { id: 'jar', n: 'Preserves Jar', i: '🏺', ing: [['wood', 40], ['stone', 20], ['coal', 3]], sk: ['farming', 3], desc: 'Turns a crop into Jelly or Pickles (2 days).', place: 1 },
  { id: 'bomb', n: 'Bomb', i: '💣', ing: [['copper_ore', 3], ['coal', 1]], out: 2, sk: ['mining', 2], desc: 'Place and run! Blasts rocks and monsters.', place: 1 },
];
CRAFTS.forEach(c => I(c.id, c.n, c.i, c.id === 'fertilizer' ? 20 : 80, 'craft', { desc: c.desc, place: c.place, craft: 1 }));

// ---------- cooking ----------
export const RECIPES = [
  { id: 'fried_egg', n: 'Fried Egg', i: '🍳', ing: [['egg', 1]], e: 45, h: 15, p: 80, src: 'start' },
  { id: 'salad', n: 'Garden Salad', i: '🥗', ing: [['any:forage', 2]], e: 60, h: 25, p: 110, src: 'start' },
  { id: 'omelet', n: 'Omelet', i: '🥞', ing: [['egg', 1], ['milk', 1]], e: 95, h: 40, p: 220, src: { shop: 250 } },
  { id: 'parsnip_soup', n: 'Parsnip Soup', i: '🍲', ing: [['parsnip', 2], ['milk', 1]], e: 80, h: 30, p: 200, buff: ['farming', 2, 240], src: { npc: 'mabel', h: 3 } },
  { id: 'fish_stew', n: 'Fisher Stew', i: '🍜', ing: [['any:fish', 1], ['potato', 1]], e: 85, h: 30, p: 190, buff: ['fishing', 2, 300], src: { npc: 'salty', h: 3 } },
  { id: 'miner_stew', n: "Miner's Stew", i: '🥘', ing: [['potato', 1], ['mushroom', 1]], e: 90, h: 50, p: 210, buff: ['mining', 2, 300], src: { npc: 'rook', h: 3 } },
  { id: 'sashimi', n: 'Sashimi', i: '🍣', ing: [['any:fish', 1]], e: 55, h: 25, p: 150, buff: ['fishing', 1, 180], src: { shop: 300 } },
  { id: 'pumpkin_pie', n: 'Pumpkin Pie', i: '🥧', ing: [['pumpkin', 1], ['milk', 1], ['egg', 1]], e: 150, h: 60, p: 420, buff: ['luck', 2, 360], src: { shop: 500 } },
  { id: 'straw_cake', n: 'Strawberry Cake', i: '🍰', ing: [['strawberry', 1], ['egg', 1], ['milk', 1]], e: 170, h: 70, p: 460, buff: ['speed', 2, 300], src: { npc: 'edda', h: 5 } },
  { id: 'roast_nuts', n: 'Roasted Nuts', i: '🥜', ing: [['hazelnut', 3]], e: 50, h: 20, p: 140, buff: ['combat', 2, 240], src: { shop: 150 } },
];
RECIPES.forEach(r => I(r.id, r.n, r.i, r.p, 'food', { food: { e: r.e, h: r.h, buff: r.buff } }));
export const BUFF_NAME = { speed: 'Speed', mining: 'Mining', fishing: 'Fishing', farming: 'Farming', combat: 'Combat', luck: 'Luck' };

// ---------- skills ----------
export const SKILLS = [
  { id: 'farming', n: 'Farming', i: '🌾', perk: 'Higher crop quality chance, lower hoe/can energy.' },
  { id: 'mining', n: 'Mining', i: '⛏️', perk: 'Faster rock breaking, more ore.' },
  { id: 'fishing', n: 'Fishing', i: '🎣', perk: 'Bigger catch bar, rarer fish.' },
  { id: 'foraging', n: 'Foraging', i: '🍄', perk: 'Better forage quality, more wood.' },
  { id: 'combat', n: 'Combat', i: '⚔️', perk: 'More damage and max health.' },
];
export const XP_LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
export function lvlOf(xp) { let l = 0; for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i] && i > 0) l = i; return l; }

// ---------- tools ----------
export const TOOLS = {
  hoe: { n: 'Hoe', i: '⚒️', desc: 'Till soil. Upgrades hit more tiles.' },
  can: { n: 'Watering Can', i: '🚿', desc: 'Water crops. Upgrades hold more water.' },
  pickaxe: { n: 'Pickaxe', i: '⛏️', desc: 'Break rocks and ore.' },
  axe: { n: 'Axe', i: '🪓', desc: 'Chop trees and clear debris.' },
  rod: { n: 'Fishing Rod', i: '🎣', desc: 'Cast at water. Better rods = bigger bar.' },
  sword: { n: 'Sword', i: '🗡️', desc: 'Slash monsters and weeds.' },
};
export const TIER_NAME = ['Basic', 'Copper', 'Iron', 'Gold'];
export const TIER_COL = ['#b9a58a', '#d9803f', '#cfd8e0', '#ffd23f'];
export const CAN_CAP = [25, 40, 60, 90];
export const UPGRADE_COST = [[300, 'copper_bar'], [700, 'iron_bar'], [1500, 'gold_bar']];
export const ROD_COST = [500, 1500, 3500];

// ---------- NPCs ----------
export const NPCS = {
  mabel: {
    n: 'Mabel', role: 'Shopkeeper', hair: '#8a4b2a', shirt: '#d9534f', skin: '#f1c9a5', bday: [0, 3], home: 'store_front',
    loves: ['cauliflower', 'strawberry', 'pumpkin_pie'], likes: ['parsnip', 'potato', 'daffodil', 'salad', 'tomato'], hates: ['slime', 'bone', 'ectoplasm'],
    perk: 'Seeds cost 15% less.', reward: { h: 6, item: 'cauliflower_seed', n: 10, msg: 'a bundle of Cauliflower Seeds' },
    sched: [[540, 'store_front'], [780, 'plaza'], [900, 'store_front'], [1020, 'saloon_front'], [1230, 'home']],
    talk: [["Welcome to Pocket Valley! Seeds are on my shelf.", "The valley needs young hands like yours."], ["I saved the best seeds for you.", "Parsnips today, cauliflowers tomorrow, eh?"], ["You've become the heart of this town, you know.", "Come by anytime. The door's always open!"]],
    gift: { love: "Oh! This is wonderful, thank you!!", like: "How thoughtful, I love it.", neutral: "Oh, thank you.", hate: "...Why would you give me this?" },
    rain: "Rain's good for sales... and for your crops!", bdayLine: "Happy birthday to me! Thanks for stopping by!",
  },
  brom: {
    n: 'Brom', role: 'Blacksmith', hair: '#3a2a22', shirt: '#6b7280', skin: '#d9a679', bday: [1, 4], home: 'smith_front',
    loves: ['gold_bar', 'omelet', 'miner_stew'], likes: ['copper_bar', 'iron_bar', 'coal', 'quartz', 'amethyst', 'topaz'], hates: ['daffodil', 'sweetpea', 'jelly'],
    perk: 'Tool upgrades cost 25% less.', reward: { h: 6, item: 'iron_bar', n: 3, msg: 'three Iron Bars' },
    sched: [[540, 'smith_front'], [720, 'plaza2'], [840, 'smith_front'], [1020, 'saloon_front'], [1260, 'home']],
    talk: [["Hmph. Need a tool fixed?", "Metal doesn't lie. Neither do I."], ["Bring bars and gold. I'll make it shine.", "Your pickaxe has seen some wear."], ["You've got a smith's patience, kid.", "Take care of your tools, they'll take care of you."]],
    gift: { love: "Now that's a gift worth a hammer-swing!", like: "Good stuff. Thanks.", neutral: "Huh. Thanks, I guess.", hate: "Take it back." },
    rain: "Rain makes the forge hiss. Love it.", bdayLine: "It's my birthday. Don't make a fuss... but thanks.",
  },
  hazel: {
    n: 'Hazel', role: 'Rancher', hair: '#c97b3a', shirt: '#4a8a5a', skin: '#f3d0b0', bday: [2, 5], home: 'ranch_front',
    loves: ['large_milk', 'omelet', 'strawberry'], likes: ['egg', 'milk', 'corn', 'wheat', 'yam', 'hay'], hates: ['batwing', 'ectoplasm', 'mushroom'],
    perk: 'Animals give better products.', reward: { h: 6, item: 'hay', n: 20, msg: 'twenty bales of Hay' },
    sched: [[540, 'ranch_front'], [840, 'plaza'], [1000, 'ranch_front'], [1200, 'home']],
    talk: [["Animals need love and hay. Remember that.", "Chickens and cows are cheap company."], ["Your animals look happy. That's rare.", "Pet them every day, they notice."], ["You'd make a fine rancher.", "My cows ask about you!"]],
    gift: { love: "Aww, my favorite! Thank you!", like: "That's sweet of you.", neutral: "Thanks, dear.", hate: "Oh... not my thing." },
    rain: "Poor chickens hate puddles.", bdayLine: "It's my birthday today! The cows got me a hat.",
  },
  otto: {
    n: 'Otto', role: 'Saloon Cook', hair: '#d8d2c4', shirt: '#b8863a', skin: '#e8b88f', bday: [3, 6], home: 'saloon_front',
    loves: ['sashimi', 'fish_stew', 'pickles'], likes: ['tuna', 'salmon', 'tomato', 'pepper', 'egg', 'pumpkin'], hates: ['stone', 'coal', 'wood'],
    perk: 'Meals restore 25% more energy.', reward: { h: 6, recipe: 'roast_nuts', msg: 'the Roasted Nuts recipe' },
    sched: [[600, 'saloon_front'], [900, 'plaza'], [1020, 'saloon_front'], [1380, 'home']],
    talk: [["Hungry? The saloon opens at noon.", "A good meal fixes most problems."], ["Cooking is just farming with extra steps.", "Bring me good ingredients and I'll teach you things."], ["You cook like family now.", "A friend at my table is a good day."]],
    gift: { love: "A feast in my hands! Bless you!", like: "Mmm, good ingredients.", neutral: "Fine, fine. Thanks.", hate: "I will pretend this didn't happen." },
    rain: "Soup weather. Come by!", bdayLine: "Birthday dinner is on the house. Mostly.",
  },
  salty: {
    n: 'Salty', role: 'Fisherman', hair: '#e0e0e0', shirt: '#2d6a9f', skin: '#c68a5a', bday: [1, 9], home: 'hut_front',
    loves: ['squid', 'tuna', 'koi', 'sashimi'], likes: ['salmon', 'snapper', 'flounder', 'catfish', 'seashell', 'crab'], hates: ['jelly', 'daffodil', 'slime'],
    perk: 'Your fishing bar is 20% bigger.', reward: { h: 6, item: 'sashimi', n: 3, msg: 'three plates of Sashimi' },
    sched: [[540, 'dock'], [900, 'beach_walk'], [1080, 'hut_front'], [1200, 'home']],
    talk: [["The sea gives and the sea takes, lad.", "Hold the bar steady when the fish jumps."], ["Rain brings the big ones, aye.", "Fish like patience. And you've got some."], ["You fish like an old sailor.", "I'd trust you with my best rod."]],
    gift: { love: "By Neptune's beard! Thanks!", like: "Ah, a fine gift.", neutral: "Aye. Cheers.", hate: "Bah! Sea-sick already." },
    rain: "Perfect weather, if you ask me.", bdayLine: "Another year older, another year wiser at sea!",
  },
  lily: {
    n: 'Lily', role: 'Forager', hair: '#e07aa6', shirt: '#8e6bbf', skin: '#f5d3bd', bday: [0, 9], home: 'lily_home',
    loves: ['sweetpea', 'crocus', 'daffodil', 'salad'], likes: ['blueberry', 'strawberry', 'leek', 'dandelion', 'fiddlehead', 'plum'], hates: ['coal', 'stone', 'bone'],
    perk: 'Foraging yields extra and better items.', reward: { h: 6, item: 'fertilizer', n: 15, msg: 'fifteen Fertilizer' },
    sched: [[480, 'plaza'], [720, 'fountain'], [960, 'plaza2'], [1140, 'fountain'], [1260, 'home']],
    talk: [["Hi! I love hunting for wild flowers.", "There's always something growing in the valley."], ["Look closely in the grass, it hides treasures.", "Seasons paint the whole valley differently."], ["You see the valley the way I do.", "Thank you for being a friend."]],
    gift: { love: "Oh my gosh, I adore it!", like: "That's so sweet!", neutral: "Thank you!", hate: "Oh... um... thanks?" },
    rain: "I love walking in the rain.", bdayLine: "It's my birthday! Do you have a gift? Hehe!",
  },
  rook: {
    n: 'Rook', role: 'Night-owl Miner', hair: '#2b2b3d', shirt: '#4b3b6b', skin: '#e0b79a', bday: [2, 2], home: 'rook_home',
    loves: ['amethyst', 'ruby', 'miner_stew', 'cinder'], likes: ['topaz', 'quartz', 'coal', 'mushroom', 'iron_bar', 'bone'], hates: ['daffodil', 'milk', 'salad', 'sweetpea'],
    perk: 'Mining yields extra ore (25%).', reward: { h: 6, item: 'bomb', n: 5, msg: 'five Bombs' },
    sched: [[600, 'plaza2'], [900, 'bench'], [1140, 'fountain'], [1380, 'home']],
    talk: [["...Mines are quiet. Mostly.", "Watch the skeletons. They throw bones."], ["Bring bombs deeper. Trust me.", "Fire floors burn. Eat before you go."], ["Not many folks get it. You do.", "Slime King's got a soft spot, strike fast."]],
    gift: { love: "...Oh. This is perfect. Thanks.", like: "Cool. Thanks.", neutral: "Uh. Okay.", hate: "...Pass." },
    rain: "Rain's cool. Quiet.", bdayLine: "...It's my birthday. Don't tell anyone.",
  },
  edda: {
    n: 'Granny Edda', role: 'Community Keeper', hair: '#f2f2f2', shirt: '#7a4b8a', skin: '#efc9a5', bday: [3, 2], home: 'center_front',
    loves: ['jelly', 'pickles', 'straw_cake', 'pumpkin'], likes: ['potato', 'corn', 'tomato', 'salad', 'omelet', 'wheat'], hates: ['bone', 'slime', 'batwing'],
    perk: 'Shipping bin pays 10% more.', reward: { h: 5, gold: 500, msg: '500g to help with the Center' },
    sched: [[540, 'center_front'], [840, 'fountain'], [1020, 'center_front'], [1260, 'home']],
    talk: [["Our old Community Center needs fixing, dear.", "Place items in the bundles inside. Every bit helps!"], ["Joja Mart wants this land. We can't let them.", "Time is short but I believe in you."], ["I see the old days returning.", "Every bundle you finish makes my heart sing."]],
    gift: { love: "You spoil an old woman!", like: "How kind, thank you, dear.", neutral: "Thank you, dear.", hate: "Oh dear, no." },
    rain: "Careful in that weather, dear.", bdayLine: "Another birthday for this old woman. How kind of you to visit!",
  },
};

// ---------- community bundles ----------
export const BUNDLES = [
  { id: 'spring', n: 'Spring Crops', i: '🌱', items: ['parsnip', 'potato', 'cauliflower', 'strawberry'], reward: { gold: 300, unlock: 'greenhouse', txt: 'The Greenhouse is restored! Crops grow there in any season.' } },
  { id: 'summer', n: 'Summer Crops', i: '☀️', items: ['tomato', 'melon', 'pepper', 'blueberry'], reward: { gold: 500, items: [['sprinkler', 3]], txt: 'Three Sprinklers appear in your pack.' } },
  { id: 'fall', n: 'Fall Crops', i: '🍂', items: ['pumpkin', 'eggplant', 'yam', 'cranberry'], reward: { gold: 500, items: [['scarecrow', 2]], txt: 'Two Scarecrows protect your fields.' } },
  { id: 'forage', n: "Forager's Bundle", i: '🍄', items: ['daffodil', 'sweetpea', 'blackberry', 'snowyam'], reward: { gold: 400, items: [['fertilizer', 20]], txt: 'Twenty Fertilizer for your soil.' } },
  { id: 'fish', n: "Angler's Bundle", i: '🎣', items: ['carp', 'chub', 'sardine', 'bass'], reward: { gold: 300, rod: 1, txt: 'Your fishing rod is upgraded!' } },
  { id: 'mining', n: "Miner's Bundle", i: '⛏️', items: ['copper_bar', 'iron_bar', 'gold_bar', 'amethyst'], reward: { gold: 1000, items: [['bomb', 10]], txt: 'Ten Bombs and a bag of gold.' } },
  { id: 'ranch', n: 'Ranch & Kitchen', i: '🥛', items: ['egg', 'milk', 'omelet', 'jelly'], reward: { gold: 800, hp: 20, txt: 'The warm meal heals your spirit: max health +20.' } },
  { id: 'vault', n: "Hero's Vault", i: '👑', items: ['crown', 'skull', 'core'], reward: { gold: 5000, txt: 'The vault opens, the valley is saved!' }, final: true },
];

// ---------- monsters ----------
export const MON = {
  slime: { n: 'Slime', hp: 22, dmg: 6, sp: 38, xp: 8, r: 9, col: '#59c25a', drops: [['slime', 0.6], ['copper_ore', 0.2], ['coal', 0.1]] },
  bat: { n: 'Cave Bat', hp: 14, dmg: 5, sp: 70, xp: 8, r: 8, col: '#7a4aa0', fly: 1, drops: [['batwing', 0.5], ['coal', 0.1]] },
  crab: { n: 'Rock Crab', hp: 42, dmg: 8, sp: 30, xp: 14, r: 10, col: '#8d8d99', armor: 0.35, drops: [['iron_ore', 0.4], ['stone', 0.5], ['quartz', 0.15]] },
  skeleton: { n: 'Skeleton', hp: 38, dmg: 9, sp: 42, xp: 18, r: 10, col: '#e8e4d6', range: 1, drops: [['bone', 0.6], ['coal', 0.25], ['iron_ore', 0.2]] },
  ghost: { n: 'Ghost', hp: 34, dmg: 8, sp: 44, xp: 20, r: 10, col: '#cfe3ff', fly: 1, ghost: 1, drops: [['ectoplasm', 0.5], ['gold_ore', 0.15]] },
  sprite: { n: 'Magma Sprite', hp: 52, dmg: 12, sp: 50, xp: 28, r: 10, col: '#ff7a2e', range: 1, fly: 1, drops: [['cinder', 0.55], ['gold_ore', 0.25], ['coal', 0.3]] },
};
export const BOSSES = {
  5: { id: 'slimeking', n: 'Slime King', hp: 260, dmg: 12, r: 26, col: '#46b84f', drop: 'crown', xp: 140 },
  10: { id: 'bonelord', n: 'Bone Lord', hp: 480, dmg: 14, r: 20, col: '#efe9d6', drop: 'skull', xp: 260 },
  15: { id: 'golem', n: 'Magma Golem', hp: 820, dmg: 18, r: 28, col: '#d4502a', drop: 'core', xp: 500 },
};
export const MINE_MAX = 15;

// ---------- difficulty ----------
export const DIFFS = {
  cozy: { n: 'Cozy', desc: '3 years to restore the Center. Gentle monsters, generous prices.', days: 120, gold: 700, energy: 0.8, dmg: 0.7, sell: 1.1, lp: 1 },
  standard: { n: 'Standard', desc: '2 years to restore the Center. A fair challenge.', days: 80, gold: 500, energy: 1, dmg: 1, sell: 1, lp: 1.5 },
  hard: { n: 'Hardcore', desc: '1.5 years. Tough monsters, thrifty buyers, hungry tools.', days: 60, gold: 300, energy: 1.25, dmg: 1.4, sell: 0.9, lp: 2.5 },
};
export const MODS = {
  drought: { n: '🏜️ Drought', desc: 'Rain is rare. Water everything yourself!', lp: 0.3 },
  surge: { n: '👹 Monster Surge', desc: '+50% monsters with extra health. Better drops.', lp: 0.4 },
  frugal: { n: '💸 Frugal Times', desc: 'Shop prices +30%, bin payouts +15%.', lp: 0.3 },
};

// ---------- legacy (meta progression) ----------
export const LEGACY = [
  { id: 'seeds', n: 'Heirloom Seeds', i: '🌰', cost: 10, desc: 'Start with 15 extra Parsnip Seeds.' },
  { id: 'nest', n: 'Nest Egg', i: '💰', cost: 15, desc: 'Start each run with +300g.' },
  { id: 'back', n: 'Strong Back', i: '💪', cost: 20, desc: '+30 maximum energy.' },
  { id: 'skin', n: 'Thick Skin', i: '🛡️', cost: 20, desc: '+25 maximum health.' },
  { id: 'friends', n: 'Smooth Talker', i: '💬', cost: 25, desc: 'Everyone starts with +40 friendship.' },
  { id: 'thumb', n: 'Green Thumb', i: '🧤', cost: 30, desc: 'Crops have a 12% chance to grow an extra day.' },
  { id: 'copper', n: 'Copper Heirloom', i: '🥉', cost: 40, desc: 'Start with Copper Hoe and Watering Can.' },
  { id: 'time', n: 'Extra Days', i: '⏳', cost: 50, desc: '+10 days on the deadline.' },
];

// ---------- festivals ----------
export const FESTIVAL_DAY = 8;
export const FESTIVALS = [
  { n: 'Egg Hunt', i: '🥚', desc: 'Collect as many eggs as you can in the town square before time runs out!' },
  { n: 'Fishing Derby', i: '🎣', desc: 'Fish at the beach for 90 seconds. Biggest catch value wins prizes!' },
  { n: 'Harvest Fair', i: '🎃', desc: 'Arrange your best goods in a display. Variety and quality win the blue ribbon.' },
  { n: 'Winter Star Feast', i: '⭐', desc: 'Give a gift to your secret friend and share a feast.' },
];

// ---------- tutorial ----------
export const TUTORIAL = [
  { id: 'move', t: 'Move around with WASD or the arrow keys.' },
  { id: 'pack', t: 'Press I (or Tab) to open your Journal and Pack.' },
  { id: 'clear', t: 'Select the 🪓 Axe or ⛏️ Pickaxe and clear a weed or stone nearby (Space / click).' },
  { id: 'till', t: 'Select the ⚒️ Hoe and till some grass (Space / click).' },
  { id: 'plant', t: 'Select Parsnip Seeds and plant them on tilled soil.' },
  { id: 'water', t: 'Select the 🚿 Watering Can and water your seeds.' },
  { id: 'sleep', t: 'Go inside your house (door below the roof) and press E on the bed to sleep.' },
  { id: 'town', t: 'Follow the dirt road east out of your farm to reach Town. Granny Edda waits at the Community Center.' },
  { id: 'bundle', t: 'Enter the Community Center door and put an item in a bundle.' },
];

// ---------- helpers ----------
export function fmtTime(m) {
  let h = Math.floor(m / 60), mm = Math.floor(m % 60 / 10) * 10;
  const ap = (h >= 12 && h < 24) ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return hh + ':' + String(mm).padStart(2, '0') + ' ' + ap;
}
export const QNAME = ['', 'Silver', 'Gold'];
export const QMULT = [1, 1.25, 1.5];
export const QSTAR = ['', '★', '★★'];
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0);
}
