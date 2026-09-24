// =============================================================
//  data.js — all the game's "numbers": foods, goods, upgrades...
//  Tweak values here to balance the game.
// =============================================================

const TILE = 32;                 // size of one map square in pixels
const BLOCK = 12;                // a city block (incl. road) is 12 tiles wide
const BLOCKS_X = 8, BLOCKS_Y = 6;
const MAP_W = BLOCKS_X * BLOCK + 2;
const MAP_H = BLOCKS_Y * BLOCK + 2;
const CITY = { bx0: 1, bx1: 6, by0: 1, by1: 4 }; // which blocks are "city" (the rest is countryside)

const GAME_MINUTES_PER_SEC = 4;  // 1 real second = 4 in-game minutes (a day = 6 real minutes)
const SAVE_KEY = 'capitalio_save_v1';
const OFFLINE_CAP_SEC = 8 * 3600;

// ---------- Goods (things you can own, farm and trade) ----------
const GOODS = {
  wheat:   { name: 'Wheat',   emoji: '🌾', base: 1.0, grow: 45 },
  corn:    { name: 'Corn',    emoji: '🌽', base: 1.0, grow: 60 },
  potato:  { name: 'Potato',  emoji: '🥔', base: 0.8, grow: 50 },
  lettuce: { name: 'Lettuce', emoji: '🥬', base: 1.0, grow: 40 },
  tomato:  { name: 'Tomato',  emoji: '🍅', base: 1.2, grow: 75 },
  rice:    { name: 'Rice',    emoji: '🍚', base: 1.2, grow: 80 },
  eggs:    { name: 'Eggs',    emoji: '🥚', base: 1.5 },
  meat:    { name: 'Meat',    emoji: '🥩', base: 3.0 },
  cheese:  { name: 'Cheese',  emoji: '🧀', base: 2.5 },
  fish:    { name: 'Fish',    emoji: '🐟', base: 4.0 },
};
const CROPS = Object.keys(GOODS).filter(g => GOODS[g].grow);
const CROP_YIELD = 3;        // goods you get per harvested tile
const SEED_COST_MULT = 0.5;  // seed cost = base price * this

// ---------- The 7 cuisines ----------
// game = which cooking minigame you play
const CUISINES = {
  hotdog:    { name: 'Hot Dog',      emoji: '🌭', color: '#e4572e', fair: 7,  cook: 3.5, recipe: ['meat', 'wheat'],            game: 'timing',   verb: 'Grill the sausage!', extras: ['🧅', '🟡'] },
  burger:    { name: 'Burger',       emoji: '🍔', color: '#c47a2c', fair: 9,  cook: 5,   recipe: ['meat', 'wheat', 'lettuce'], game: 'timing',   verb: 'Flip the patty!', extras: ['🧀', '🧅'] },
  sushi:     { name: 'Sushi',        emoji: '🍣', color: '#f28482', fair: 12, cook: 6,   recipe: ['fish', 'rice'],             game: 'sequence', verb: 'Roll the sushi!', extras: ['🥒', '🥑', '🌿'] },
  crepe:     { name: 'Crêpe',        emoji: '🥞', color: '#f6bd60', fair: 7,  cook: 4,   recipe: ['wheat', 'eggs'],            game: 'hold',     verb: 'Cook until golden!', extras: ['🍓', '🍫'] },
  fishchips: { name: 'Fish & Chips', emoji: '🐟', color: '#3a86ff', fair: 10, cook: 5,   recipe: ['fish', 'potato'],           game: 'hold',     verb: 'Fry until crispy!', extras: ['🍋', '🧂'] },
  pizza:     { name: 'Pizza',        emoji: '🍕', color: '#d62828', fair: 11, cook: 6,   recipe: ['wheat', 'tomato', 'cheese'], game: 'sequence', verb: 'Build the pizza!', extras: ['🍄', '🫒', '🌶️'] },
  burrito:   { name: 'Burrito',      emoji: '🌯', color: '#6a994e', fair: 9,  cook: 5,   recipe: ['corn', 'meat', 'tomato'],    game: 'sequence', verb: 'Wrap the burrito!', extras: ['🥑', '🧅', '🌶️'] },
};

// ---------- 6 cart upgrade tracks (max level 10) ----------
const UPGRADE_MAX = 10;
const UPGRADES = {
  grill:   { name: 'Grill',      icon: '🔥', desc: 'Cook 6% faster per level',            base: 60 },
  recipe:  { name: 'Recipe',     icon: '📜', desc: 'Tastier food: more appeal and tips',  base: 80 },
  sign:    { name: 'Signage',    icon: '🪧', desc: 'People notice you from further away', base: 50 },
  fridge:  { name: 'Fridge',     icon: '🧊', desc: 'Hold more ingredients',               base: 40 },
  hygiene: { name: 'Hygiene',    icon: '🧽', desc: 'Gets dirty slower',                   base: 40 },
  queue:   { name: 'Queue Rope', icon: '🚧', desc: '+1 customer can wait in line',        base: 50 },
};
const upgradeCost = (key, lvl) => Math.round(UPGRADES[key].base * Math.pow(1.65, lvl));

const CART_BASE_COST = 200;
const cartCost = (owned) => Math.round(CART_BASE_COST * Math.pow(1.45, Math.max(0, owned - 1)) / 10) * 10;

// ---------- Ranch animals (they eat corn from the trough) ----------
const ANIMALS = {
  chicken: { name: 'Chicken', emoji: '🐔', cost: 40,  product: 'eggs',   every: 18, feed: 1 },
  pig:     { name: 'Pig',     emoji: '🐖', cost: 120, product: 'meat',   every: 30, feed: 2 },
  cow:     { name: 'Cow',     emoji: '🐄', cost: 180, product: 'cheese', every: 36, feed: 2 },
};
const RANCH_MAX_ANIMALS = 8;
const RANCH_FENCE_COST = 150;
const TROUGH_MAX = 60;

// ---------- Workers ----------
// Level perks, in the order they unlock
const WORKER_PERKS = ['Cooks & serves', 'Auto-buys ingredients', 'Auto-sets price', 'Auto-cleans', 'Works 20% faster'];
const WORKER_MAX_LEVEL = 5;
const xpForLevel = (lvl) => 15 * lvl * lvl;

const FIRST_NAMES = ['Ava', 'Leo', 'Mia', 'Noah', 'Zara', 'Omar', 'Ivy', 'Kai', 'Luna', 'Ravi', 'Emma', 'Jin', 'Sofia', 'Diego', 'Aria', 'Finn', 'Nia', 'Theo', 'Maya', 'Arjun', 'Chloe', 'Yuki', 'Sam', 'Priya', 'Eli', 'Rosa', 'Max', 'Lila', 'Ben', 'Amara'];
const LAST_NAMES = ['Park', 'Silva', 'Khan', 'Brown', 'Tanaka', 'Rossi', 'Patel', 'Nguyen', 'Garcia', 'Smith', 'Okafor', 'Müller', 'Cohen', 'Reyes', 'Singh', 'Lopez'];
const RIVAL_OWNERS = ['Tony', 'Marge', 'Big Al', 'Rosa', 'Chef Ken', 'Lulu', 'Vinny', 'Mama Li'];

// ---------- Looks ----------
const ROOF_COLORS = ['#b56576', '#6d597a', '#355070', '#e56b6f', '#c9ada7', '#8d99ae', '#588157', '#bc6c25', '#7f5539', '#457b9d', '#9a8c98', '#d4a373', '#264653', '#e9c46a'];
const SHIRT_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#6d597a', '#90be6d', '#f28482', '#577590', '#ff006e', '#8338ec', '#3a86ff', '#fb8500'];
const SKIN_COLORS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673c'];
const HAIR_COLORS = ['#2b2118', '#4a3728', '#8b5a2b', '#d4a76a', '#111111', '#a33b20', '#6b6b6b'];
const TREE_COLORS = ['#2d6a4f', '#40916c', '#1b4332', '#52b788', '#3a7d44'];
const CAR_COLORS = ['#e63946', '#f1faee', '#1d3557', '#ffb703', '#2a9d8f', '#8d99ae', '#222222', '#9b2226', '#43aa8b'];
const BUILDING_KINDS = ['Apartments', 'Office', 'Corner Shop', 'Lofts', 'Studio Flats', 'Warehouse', 'Townhouse', 'Bakery', 'Book Store', 'Gym', 'Hostel', 'Studio'];

// ---------- Goals (a simple guided path through the game) ----------
const GOALS = [
  { text: 'Walk to your cart and cook for 3 customers (press E)', reward: 40,   check: s => s.stats.playerServed >= 3 },
  { text: 'Buy any cart upgrade',                                   reward: 40,   check: s => s.carts.some(c => Object.values(c.upgrades).some(v => v > 0)) },
  { text: 'Hire a worker and put them on a cart',                   reward: 75,   check: s => s.workers.some(w => w.assign && w.assign.type === 'cart') },
  { text: 'Have $500 cash',                                         reward: 50,   check: s => s.money >= 500 },
  { text: 'Buy a second food cart',                                 reward: 100,  check: s => s.carts.length >= 2 },
  { text: 'Buy a plot of land in the countryside',                  reward: 100,  check: s => Object.keys(s.plots).length >= 1 },
  { text: 'Harvest 20 crops',                                       reward: 120,  check: s => s.stats.harvested >= 20 },
  { text: 'Sell something on the market',                           reward: 60,   check: s => s.stats.marketSold >= 1 },
  { text: 'Buy an animal for a ranch',                              reward: 150,  check: s => Object.values(s.plots).some(p => p.animals && p.animals.length) },
  { text: 'Buy a building and collect rent',                        reward: 250,  check: s => Object.keys(s.buildings).length >= 1 },
  { text: 'Run 5 food carts',                                       reward: 500,  check: s => s.carts.length >= 5 },
  { text: 'Reach $25,000 net worth',                                reward: 1000, check: s => netWorth(s) >= 25000 },
  { text: 'Reach $100,000 net worth — you are a tycoon!',           reward: 5000, check: s => netWorth(s) >= 100000 },
];
