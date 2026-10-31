# Capital.io 🍔🏙️ — v1-beta

A 2D top-down business game for the browser, inspired by **Capital Rift**.
Start with one food cart in the town square, cook for customers, hire workers,
buy land, farm, raise animals, buy buildings, trade on the market and grow an empire.

## How to play it

**Easiest:** double-click `index.html`. It opens in your browser and that's it.
There's nothing to install.

**Or run a tiny local server** (useful later if you add features that need one):

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Your game saves automatically in your browser (localStorage). In **❓ Help → ⚙️ Settings** you can turn things on or off (minimap, night lighting, crowds, autosave…) and download a backup of your save.

## Controls

| Key / action | What it does |
|---|---|
| `W A S D` / arrow keys | Walk (`Shift` to run) |
| Click / tap the map | Walk there |
| `E` | Cook at your cart (plays the minigame) |
| `C` | Scrub your cart clean |
| Mouse wheel, `+` / `-` | Zoom |
| Click the minimap | Walk to that spot |
| `Esc` | Close menus / cancel |

### On a phone or tablet

| Touch | What it does |
|---|---|
| Joystick (bottom-left) | Walk (push it all the way to run) |
| Tap the map | Walk there |
| Tap **🍳 Cook** / **🧽 Clean** | Cook or clean at your cart |
| Pinch with two fingers | Zoom |
| Swipe a menu down | Close it |

The game works upright and sideways. Once it's online (for example on GitHub Pages), use your browser's
**Add to Home Screen** to install it like an app, and it opens full screen.

## The story

You play through 6 chapters, each started by a character who talks to you:

1. **The Old Cart**: Grandma Rosa gives you her food cart. Learn to cook and clean.
2. **Street Hustle**: hire help, buy a second cart, save up for a shop.
3. **A Shop of Your Own**: Mr. Lee the landlord rents you a storefront. **Shops unlock!**
4. **Shopkeeper**: hire cashiers, decorate, open a second shop.
5. **Farm to Shelf**: Farmer Joe sells you land. Grow food for your shops and carts.
6. **Tycoon**: the Mayor dares you to own the city.

Click the goal box (top-left) at any time to read the current chapter again.

## What's in the game

- **Shops** (from Chapter 3): rent a storefront and pick a Coffee Shop, Bakery, Grocery, Flower Shop or Gift Shop. Place counters, shelves, plants and tables in the layout editor, stock products and set prices. Customers walk inside, browse and pay at the counter. When you stand next to your shop, the roof disappears so you can see inside. Grocery shops can be stocked from your own farms.
- **7 food carts**: Hot Dog, Burger, Sushi, Crêpe, Fish & Chips, Pizza and Burrito, each with its own cooking minigame (timing, combo or hold-and-release).
- **Customers** walk around the city, notice nearby carts, and decide based on price, cleanliness, reviews and competition.
- **6 upgrade tracks** per cart (Grill, Recipe, Signage, Fridge, Hygiene, Queue Rope), each up to level 10.
- **Workers** with 1–5 star ratings. They're paid per job and level up (auto-restock → auto-price → auto-clean → faster).
- **Land**: buy countryside plots and make a **farm** (6 crops) or a **ranch** (chickens, pigs and cows that eat corn from a trough).
- **Property**: buy city buildings and collect rent every minute.
- **Market** with moving prices, plus a **bank** with interest.
- **Day/night cycle** with lunch and dinner rushes.
- **Offline progress**: your workers, farms, rent and interest keep going while you're away (up to 8 hours).
- **Goals** that guide you step by step and pay cash rewards.

## How the code is organised

All code is plain JavaScript (no frameworks), split into files by job:

| File | What it does |
|---|---|
| `index.html` | The page: the canvas, the top bar, menus and the start screen |
| `css/style.css` | How everything looks |
| `js/data.js` | **All the game numbers**: foods, prices, upgrades, animals, goals. Start here if you want to tweak the balance! |
| `js/util.js` | Small helpers (formatting money, random numbers…) |
| `js/world.js` | Builds the city map (roads, buildings, parks, farmland) and finds walking paths |
| `js/economy.js` | Money rules: market, carts, workers, farms, saving/loading, offline progress |
| `js/entities.js` | Things that move: you, customers, cars, workers cooking, animals |
| `js/render.js` | Draws everything on the canvas |
| `js/minigames.js` | The cooking minigames and the scrubbing game |
| `js/ui.js` | The menus/panels, the story pop-ups, and what every button does |
| `js/shops.js` | **Everything about shops**: renting, the layout editor, stock, customers inside, cashiers |
| `js/touch.js` | Phone controls: joystick, pinch-to-zoom, swipe-to-close |
| `js/settings.js` | The ⚙️ Settings and save backups |
| `js/main.js` | Start screen, keyboard/mouse input and the main game loop |

### Easy things to try changing

- Starting money: `money: 150` in `js/economy.js` (`newState`)
- Food prices / cook times: `CUISINES` in `js/data.js`
- The story text and goals: `STORY` in `js/data.js`
- Shop products and their prices: `PRODUCTS` in `js/data.js`
- How fast the day goes: `GAME_MINUTES_PER_SEC` in `js/data.js`
- Upgrade costs: `UPGRADES` (the `base` number) in `js/data.js`
