# Capital.io 🍔🏙️

**Version:** v1.2-beta

A 2D city business game you play in your browser, inspired by **Capital Rift** and **Big Ambitions**.
You start out with one food cart in the town square. From there you cook for customers, hire workers,
open shops, buy land, farm, raise animals, buy buildings and trade on the market until you basically own the city.

## How to play it

**The easy way:** double-click `index.html`. It opens in your browser and you're good to go.
There's nothing to install.

**Or run a little local server** (handy later if you add features that need one):

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Your game saves on its own, right in your browser. In **❓ Help → ⚙️ Settings** you can turn things on and off
(the minimap, night lighting, crowds, autosave and more) and download a backup of your save.

## Controls

| Key / action | What it does |
|---|---|
| `W A S D` or arrow keys | Walk (tap `Shift` to switch between walking and running) |
| Click the map | Walk there |
| `E` | Cook at your cart (this starts the cooking game) |
| `C` | Scrub your cart clean |
| Mouse wheel, `+` / `-` | Zoom in and out |
| Click the minimap | Open the big city map |
| `Esc`, or click the map | Close menus (clicking the map to close a menu won't make you walk) |

### On a phone or tablet

| Touch | What it does |
|---|---|
| Joystick (bottom-left) | Walk (push it all the way to run) |
| Tap the map | Walk there |
| Tap **🍳 Cook** or **🧽 Clean** | Cook or clean at your cart |
| Pinch with two fingers | Zoom in and out |
| Tap the minimap | Open the big city map |
| Swipe a menu down, or tap the map | Close it |

It works with your phone upright or sideways. Once the game is online (on GitHub Pages, for example),
use your browser's **Add to Home Screen** button to install it like an app. It'll open full screen.

## The big city map

Click or tap the minimap in the corner to open a big map of the whole city. It shows where you are, your carts,
shops, land and buildings, your rivals' carts, and everything that's for sale or for rent. There's a key at the
bottom that explains the colors. Scroll or pinch to zoom, drag to move around, and hit **Whole city** to zoom back out.

## The story

The game is split into 6 chapters, and each one starts with a character talking to you:

1. **The Old Cart**: Grandma Rosa hands you her food cart. Learn to cook and keep it clean.
2. **Street Hustle**: hire some help, buy a second cart, and save up for a shop.
3. **A Shop of Your Own**: Mr. Lee the landlord rents you a shop. **Shops unlock here!**
4. **Shopkeeper**: hire cashiers, decorate, and open a second shop.
5. **Farm to Shelf**: Farmer Joe sells you land so you can grow food for your shops and carts.
6. **Tycoon**: the Mayor dares you to own the whole city.

Click the goal box in the top-left whenever you want to read the current chapter again.

## What's in the game

- **Shops** (from Chapter 3): rent a shop and turn it into a coffee shop, bakery, grocery store, flower shop or gift shop. Set it up with counters, shelves, plants and tables, stock it, and pick your prices. Customers walk in, look around and pay at the counter. Stand next to your shop and the roof disappears so you can watch them. Grocery stores can even sell food from your own farms. Shops have their own upgrades (bigger sign, faster checkout, bigger shelves, nicer floors and more) and opening hours you choose.
- **📋 Daily orders**: every morning a few customers want a lot of food at once (like "15 burgers by 18:00"). Accept an order, sell that many in time, and get a bonus.
- **City events**: rainy days, festival weekends in the park, ingredient shortages, and food critics who can make or break your reviews. Today's events show up next to the clock.
- **7 food carts**: hot dog, burger, sushi, crêpe, fish & chips, pizza and burrito. Each one has its own cooking game (timing, combo, or hold and let go).
- **Customers** who walk around the city and pick a cart based on price, how clean it is, reviews, and who else is nearby.
- **Rivals that fight back** (from Chapter 2): rival carts cut their prices when you open near them, and Victor Vance opens Vance's carts (dark umbrellas) next to your best ones. Keep your cart way more appealing than theirs for a few hours to run them out of town.
- **6 upgrades** for every cart (Grill, Recipe, Signage, Fridge, Hygiene and Queue Rope), each going up to level 10.
- **Workers** rated from 1 to 5 stars. You pay them per job, and they learn new skills as they level up: buying ingredients, setting prices, cleaning, and working faster.
- **Land** out in the countryside. Turn it into a **farm** (6 crops) or a **ranch** with chickens, pigs and cows that eat corn from a trough.
- **Buildings** around the city that you can buy and rent out for money every minute.
- **The City Exchange**, a big market window with price charts (line or candles), who's buying and selling, and a Buy / Sell box where you type how many. Plus **a bank** that pays interest and shows how much your savings make per minute.
- **Day and night**, with busy lunch and dinner rushes.
- **Offline progress**: your workers, farms, rent and savings keep going while you're away (for up to 8 hours).
- **Goals** that walk you through the game and pay you cash rewards.

## How the code is organized

Everything is plain JavaScript (no frameworks), split into files by what they do:

| File | What it does |
|---|---|
| `index.html` | The page itself: the game screen, top bar, menus and start screen |
| `css/style.css` | How everything looks |
| `js/data.js` | **All the game's numbers and story text**: foods, prices, upgrades, animals, goals. Start here if you want to tweak things! |
| `js/util.js` | Small helpers, like formatting money and picking random numbers |
| `js/world.js` | Builds the city map (roads, buildings, parks, farmland) and figures out walking paths |
| `js/economy.js` | The money rules: market, carts, workers, farms, saving and loading, offline progress |
| `js/entities.js` | Everything that moves: you, customers, cars, workers cooking, animals |
| `js/render.js` | Draws everything on the screen |
| `js/minigames.js` | The cooking games and the scrubbing game |
| `js/ui.js` | The menus, story pop-ups, and what every button does |
| `js/shops.js` | **Everything about shops**: renting, the layout editor, stock, customers inside, cashiers |
| `js/events.js` | Daily orders and city events (rain, festivals, shortages, food critics) |
| `js/rivals.js` | Rival carts that fight back, and the rival boss Victor Vance |
| `js/bigmap.js` | The big city map that opens when you click the minimap |
| `js/exchange.js` | The 📈 Market window: price charts, who's buying and selling, and the Buy / Sell box |
| `js/touch.js` | Phone controls: joystick, pinch to zoom, swipe to close |
| `js/settings.js` | The ⚙️ Settings and save backups |
| `js/main.js` | The start screen, keyboard and mouse controls, and the main game loop |

### Easy things to try changing

- Starting money: `money: 150` in `js/economy.js` (inside `newState`)
- Food prices and cooking times: `CUISINES` in `js/data.js`
- The story and goals: `STORY` in `js/data.js`
- Shop products and their prices: `PRODUCTS` in `js/data.js`
- How fast a day goes by: `GAME_MINUTES_PER_SEC` in `js/data.js`
- Upgrade costs: the `base` number in `UPGRADES` in `js/data.js`
