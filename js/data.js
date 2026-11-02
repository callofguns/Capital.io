// =============================================================
//  data.js — all the game's "numbers": foods, goods, upgrades...
//  Tweak values here to balance the game.
// =============================================================

const GAME_VERSION = 'v1.2-beta';

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
  wheat:   { name: 'Wheat', tick: 'WHT',   emoji: '🌾', base: 1.0, grow: 45 },
  corn:    { name: 'Corn', tick: 'CRN',    emoji: '🌽', base: 1.0, grow: 60 },
  potato:  { name: 'Potato', tick: 'POT',  emoji: '🥔', base: 0.8, grow: 50 },
  lettuce: { name: 'Lettuce', tick: 'LET', emoji: '🥬', base: 1.0, grow: 40 },
  tomato:  { name: 'Tomato', tick: 'TOM',  emoji: '🍅', base: 1.2, grow: 75 },
  rice:    { name: 'Rice', tick: 'RCE',    emoji: '🍚', base: 1.2, grow: 80 },
  eggs:    { name: 'Eggs', tick: 'EGG',    emoji: '🥚', base: 1.5 },
  meat:    { name: 'Meat', tick: 'MEA',    emoji: '🥩', base: 3.0 },
  cheese:  { name: 'Cheese', tick: 'CHS',  emoji: '🧀', base: 2.5 },
  fish:    { name: 'Fish', tick: 'FSH',    emoji: '🐟', base: 4.0 },
};
const CROPS = Object.keys(GOODS).filter(g => GOODS[g].grow);
const CROP_YIELD = 3;        // goods you get per harvested tile
const SEED_COST_MULT = 0.5;  // seed cost = base price * this

// ---------- The 7 cuisines ----------
// game = which cooking minigame you play
const CUISINES = {
  hotdog:    { name: 'Hot Dog',      emoji: '🌭', color: '#e4572e', fair: 7,  cook: 3.5, recipe: ['meat', 'wheat'],            game: 'timing',   verb: 'Grill that sausage!', extras: ['🧅', '🟡'] },
  burger:    { name: 'Burger',       emoji: '🍔', color: '#c47a2c', fair: 9,  cook: 5,   recipe: ['meat', 'wheat', 'lettuce'], game: 'timing',   verb: 'Flip the patty!', extras: ['🧀', '🧅'] },
  sushi:     { name: 'Sushi',        emoji: '🍣', color: '#f28482', fair: 12, cook: 6,   recipe: ['fish', 'rice'],             game: 'sequence', verb: 'Roll it up!', extras: ['🥒', '🥑', '🌿'] },
  crepe:     { name: 'Crêpe',        emoji: '🥞', color: '#f6bd60', fair: 7,  cook: 4,   recipe: ['wheat', 'eggs'],            game: 'hold',     verb: 'Get it nice and golden!', extras: ['🍓', '🍫'] },
  fishchips: { name: 'Fish & Chips', emoji: '🐟', color: '#3a86ff', fair: 10, cook: 5,   recipe: ['fish', 'potato'],           game: 'hold',     verb: "Fry it till it's crispy!", extras: ['🍋', '🧂'] },
  pizza:     { name: 'Pizza',        emoji: '🍕', color: '#d62828', fair: 11, cook: 6,   recipe: ['wheat', 'tomato', 'cheese'], game: 'sequence', verb: 'Build your pizza!', extras: ['🍄', '🫒', '🌶️'] },
  burrito:   { name: 'Burrito',      emoji: '🌯', color: '#6a994e', fair: 9,  cook: 5,   recipe: ['corn', 'meat', 'tomato'],    game: 'sequence', verb: 'Wrap it up!', extras: ['🥑', '🧅', '🌶️'] },
};

// ---------- 6 cart upgrade tracks (max level 10) ----------
const UPGRADE_MAX = 10;
const UPGRADES = {
  grill:   { name: 'Grill',      icon: '🔥', desc: 'Cooks 6% faster every level',         base: 60 },
  recipe:  { name: 'Recipe',     icon: '📜', desc: 'Tastier food, so more customers and bigger tips', base: 80 },
  sign:    { name: 'Signage',    icon: '🪧', desc: 'People spot your cart from further away', base: 50 },
  fridge:  { name: 'Fridge',     icon: '🧊', desc: 'Holds more ingredients',              base: 40 },
  hygiene: { name: 'Hygiene',    icon: '🧽', desc: 'Gets dirty more slowly',              base: 40 },
  queue:   { name: 'Queue Rope', icon: '🚧', desc: 'One more person can wait in line',    base: 50 },
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
const WORKER_PERKS = ['Cooks and serves', 'Buys ingredients on their own', 'Sets prices on their own', 'Cleans up on their own', 'Works 20% faster'];
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

// ---------- Shops (unlock in Chapter 3) ----------
const SHOP_TYPES = {
  coffee:  { name: 'Coffee Shop', emoji: '☕', color: '#7f5539', products: ['coffee', 'tea', 'muffin', 'cookie'] },
  bakery:  { name: 'Bakery',      emoji: '🥐', color: '#e9a23b', products: ['bread', 'croissant', 'donut', 'cake'] },
  grocery: { name: 'Grocery',     emoji: '🥬', color: '#40916c', products: ['lettuce', 'tomato', 'potato', 'eggs', 'cheese', 'meat'] },
  flowers: { name: 'Flower Shop', emoji: '💐', color: '#e56b6f', products: ['tulip', 'rose', 'bouquet', 'plant'] },
  gifts:   { name: 'Gift Shop',   emoji: '🎁', color: '#8338ec', products: ['balloon', 'candle', 'teddy', 'giftbox'] },
};
// Things shops sell. cost = wholesale price, price = normal shelf price.
// Grocery products are farm GOODS — you can stock them from your own farms!
const PRODUCTS = {
  coffee:    { name: 'Coffee',    emoji: '☕', cost: 1.0, price: 4 },
  tea:       { name: 'Tea',       emoji: '🍵', cost: 0.8, price: 3 },
  muffin:    { name: 'Muffin',    emoji: '🧁', cost: 1.2, price: 4 },
  cookie:    { name: 'Cookie',    emoji: '🍪', cost: 0.5, price: 2.5 },
  bread:     { name: 'Bread',     emoji: '🍞', cost: 0.8, price: 3.5 },
  croissant: { name: 'Croissant', emoji: '🥐', cost: 1.0, price: 4 },
  donut:     { name: 'Donut',     emoji: '🍩', cost: 0.6, price: 3 },
  cake:      { name: 'Cake',      emoji: '🍰', cost: 2.5, price: 8 },
  tulip:     { name: 'Tulips',    emoji: '🌷', cost: 1.5, price: 5 },
  rose:      { name: 'Roses',     emoji: '🌹', cost: 2.0, price: 7 },
  bouquet:   { name: 'Bouquet',   emoji: '💐', cost: 5.0, price: 16 },
  plant:     { name: 'Cactus',    emoji: '🌵', cost: 6.0, price: 18 },
  balloon:   { name: 'Balloon',   emoji: '🎈', cost: 0.5, price: 3 },
  candle:    { name: 'Candle',    emoji: '🕯️', cost: 2.0, price: 7 },
  teddy:     { name: 'Teddy',     emoji: '🧸', cost: 4.0, price: 12 },
  giftbox:   { name: 'Gift Box',  emoji: '🎁', cost: 6.0, price: 18 },
};
const FARM_MARKUP = 2.5;    // grocery shelf price = market base price x this
const SHELF_CAP = 15;       // how many items one shelf holds

// Shop upgrades (each goes up to UPGRADE_MAX, like cart upgrades)
const SHOP_UPGRADES = {
  sign:     { name: 'Bigger Sign',       icon: '🪧', desc: 'People notice your shop from further away',  base: 120 },
  register: { name: 'Faster Checkout',   icon: '🧾', desc: 'Cashiers ring people up 6% faster every level', base: 150 },
  shelves:  { name: 'Bigger Shelves',    icon: '🗄️', desc: 'Every shelf holds 2 more items',             base: 120 },
  floors:   { name: 'Nicer Floors',      icon: '✨', desc: '+2 appeal every level',                      base: 140 },
  hygiene:  { name: 'Cleaning Supplies', icon: '🧽', desc: 'Gets dirty more slowly',                     base: 90 },
  comfort:  { name: 'Music & Comfort',   icon: '🎵', desc: 'Customers wait 8% longer before giving up',  base: 100 },
};
const shopUpgradeCost = (key, lvl) => Math.round(SHOP_UPGRADES[key].base * Math.pow(1.65, lvl));
const LEASE_DEPOSIT_MIN = 15; // renting costs 15 minutes of rent up front
const FURNITURE = {
  counter: { name: 'Checkout Counter', emoji: '🧾', cost: 150, desc: 'Where people pay. You need one for each cashier.' },
  shelf:   { name: 'Shelf',            emoji: '🗄️', cost: 80,  desc: `Holds ${SHELF_CAP} of one product.` },
  decor:   { name: 'Plant',            emoji: '🪴', cost: 40,  desc: '+3 appeal (decorations add up to +30)', appeal: 3 },
  table:   { name: 'Table & Chairs',   emoji: '🪑', cost: 60,  desc: '+4 appeal (decorations add up to +30)', appeal: 4 },
};

// ---------- The story ----------
// Each chapter has a character who talks to you, then a list of goals.
const countDecor = s => s.shops.reduce((n, sh) => n + sh.furniture.filter(f => f && (f.k === 'decor' || f.k === 'table')).length, 0);
const STORY = [
  {
    title: 'Chapter 1 · The Old Cart', who: '👵', speaker: 'Grandma Rosa',
    text: "Welcome to the city, {name}! I'm getting too old to run my {cart} cart, so it's all yours now. When people line up, walk over and press <kbd>E</kbd> to cook. Keep it clean, and make me proud!",
    goals: [
      { text: 'Cook for 3 customers yourself (walk to the cart, press E)', reward: 40, check: s => s.stats.playerServed >= 3 },
      { text: 'Buy your first cart upgrade', reward: 40, check: s => s.carts.some(c => Object.values(c.upgrades).some(v => v > 0)) },
      { text: 'Give your cart a good scrub (press C at the cart)', reward: 30, check: s => (s.stats.cleaned || 0) >= 1 },
      { text: 'Save up $400', reward: 50, check: s => s.money >= 400 },
    ],
  },
  {
    title: 'Chapter 2 · Street Hustle', who: '👵', speaker: 'Grandma Rosa',
    text: "Look at you go! But you can't cook all day and all night. Hire someone to run the cart for you, then start growing your little street business.",
    goals: [
      { text: 'Hire a worker and put them on a cart', reward: 75, check: s => s.workers.some(w => w.assign && w.assign.type === 'cart') },
      { text: 'Buy a second food cart', reward: 100, check: s => s.carts.length >= 2 },
      { text: 'Serve 100 meals in total', reward: 120, check: s => s.stats.served >= 100 },
      { text: 'Save up $700 for your first shop', reward: 80, check: s => s.money >= 700 },
    ],
  },
  {
    title: 'Chapter 3 · A Shop of Your Own', who: '🧔', speaker: 'Mr. Lee, the landlord',
    text: "So you're the cart kid everyone keeps talking about! I've got empty storefronts for rent all over town. A real shop, with shelves, a register and customers walking through the door. That's where the real money is. 🏪 <b>Shops are unlocked!</b>",
    goals: [
      { text: 'Rent a storefront (check the 🏪 Shops menu)', reward: 100, check: s => s.shops.length >= 1 },
      { text: 'Put a checkout counter and a shelf in your shop', reward: 60, check: s => s.shops.some(sh => sh.furniture.some(f => f && f.k === 'counter') && sh.furniture.some(f => f && f.k === 'shelf')) },
      { text: 'Fill your shelves with stuff to sell', reward: 40, check: s => s.shops.some(sh => Object.values(sh.stock).some(v => v > 0)) },
      { text: 'Sell to 10 shop customers', reward: 120, check: s => (s.stats.shopServed || 0) >= 10 },
    ],
  },
  {
    title: 'Chapter 4 · Shopkeeper', who: '👵', speaker: 'Grandma Rosa',
    text: "A real shop! Your grandpa would've loved this. Now get it running without you. Hire a cashier, make it cozy so people want to come in, then open another one.",
    goals: [
      { text: 'Hire a cashier for your shop', reward: 80, check: s => s.workers.some(w => w.assign && w.assign.type === 'shop') },
      { text: 'Decorate with 3 plants or tables', reward: 80, check: s => countDecor(s) >= 3 },
      { text: 'Make $1,000 from shop sales', reward: 200, check: s => (s.stats.shopEarned || 0) >= 1000 },
      { text: 'Run 2 shops at once', reward: 300, check: s => s.shops.length >= 2 },
    ],
  },
  {
    title: 'Chapter 5 · Farm to Shelf', who: '👨‍🌾', speaker: 'Farmer Joe',
    text: "City folks pay good money for fresh food. Buy some land from me out in the countryside! Grow crops and raise animals, then sell them in a grocery shop or on the market. Bonus: cheaper ingredients for your carts.",
    goals: [
      { text: 'Buy a plot of land in the countryside', reward: 100, check: s => Object.keys(s.plots).length >= 1 },
      { text: 'Harvest 20 crops', reward: 120, check: s => s.stats.harvested >= 20 },
      { text: 'Buy an animal for your ranch', reward: 150, check: s => Object.values(s.plots).some(p => p.animals && p.animals.length) },
      { text: 'Sell something on the market', reward: 60, check: s => s.stats.marketSold >= 1 },
    ],
  },
  {
    title: 'Chapter 6 · Tycoon', who: '🎩', speaker: 'The Mayor',
    text: "{name}! Your carts, shops and farms are everywhere. People are saying you could own this whole city one day. Let's find out.",
    goals: [
      { text: 'Buy a building', reward: 250, check: s => Object.keys(s.buildings).length >= 1 },
      { text: 'Own 6 businesses (carts and shops both count)', reward: 500, check: s => s.carts.length + s.shops.length >= 6 },
      { text: 'Hit $25,000 net worth', reward: 1000, check: s => netWorth(s) >= 25000 },
      { text: 'Hit $100,000 net worth. The city is yours!', reward: 5000, check: s => netWorth(s) >= 100000 },
    ],
  },
];
// One long list of goals, each remembering its chapter
const GOALS = STORY.flatMap((ch, ci) => ch.goals.map(g => ({ ...g, chapter: ci })));
const SHOPS_CHAPTER = 2; // shops unlock when you reach Chapter 3 (index 2)
