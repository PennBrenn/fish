# THE LAKE — Feature Expansion Design Specification

> **Game:** THE LAKE (Stillwater Fishing Simulator)
> **Version:** v2.0 Expansion
> **Date:** 2026-03-26
> **Status:** Implementation-Ready

---

## Table of Contents

1. [Multiplayer & Social](#1-multiplayer--social)
2. [Controls & UI/UX](#2-controls--uiux)
3. [Fishing System](#3-fishing-system)
4. [Inventory & Equipment](#4-inventory--equipment)
5. [World & Terrain](#5-world--terrain)
6. [Chaos & Game Feel](#6-chaos--game-feel)

---

## 1. Multiplayer & Social

### 1.1 Server Capacity — 400 Concurrent Players

**Architecture:**

- Migrate from the current PeerJS/WebRTC room-code model (2-player) to a dedicated WebSocket server architecture using `Socket.IO` or raw `ws` on a Node.js backend.
- Implement an **authoritative server** model: the server owns world state, player positions, fish spawns, and loot tables. Clients send inputs; server broadcasts snapshots.
- Use **spatial partitioning** (grid-based or quadtree) so each client only receives updates for entities within a relevant radius (~200 in-world units). This keeps per-tick bandwidth manageable at 400 players.
- Target a **20 Hz server tick rate** for position updates, with interpolation/extrapolation on the client to smooth movement between ticks.
- Entity culling: clients render at most ~50 nearby player models at full detail; distant players degrade to simplified markers or dots on the minimap.

**Scaling notes:**

- A single Node.js process on a 4-core server can handle 400 WebSocket connections at 20 Hz if payloads are kept under 200 bytes per player per tick (binary protocol recommended).
- If future demand exceeds 400, shard into multiple world instances behind a lobby/matchmaking service.

**Balance considerations:**

- Fish spawn rates and loot tables must scale with player count. Formula: `baseSpawnRate * (1 + 0.3 * log2(playerCount))` — ensures resources grow sub-linearly so scarcity still exists.
- Heart attack events (see §6.2) affect all players simultaneously, so server restart cost scales with player count — this is intentional.

### 1.2 Username System & In-Game Text Chat

**Username system:**

- On first connection, display a **username entry modal** (max 20 characters, alphanumeric + underscores).
- Persist username in `localStorage` so returning players auto-fill.
- Render username as a floating label above each player's head using a screen-space `<div>` overlay positioned via 3D-to-2D projection, or as canvas text drawn during the render loop.
- Username color matches player's customization accent or defaults to `var(--cream)`.

**Text chat:**

- **UI:** A semi-transparent chat box fixed to the bottom-left, `360px` wide, `200px` tall. Messages fade after 8 seconds unless the chat is focused.
- Press **Enter** to open the chat input field. Press **Enter** again to send; **Escape** to cancel.
- Messages are broadcast to all players on the server. Each message prefixed with `[username]:` in `var(--gold)`.
- **Rate limit:** Max 3 messages per 5-second window per player. Excess messages are silently dropped with a local "slow down" indicator.
- **Profanity filter:** Optional toggle in settings. Client-side filter using a word list; server does not censor (keeps things chaotic per game tone).

**Implementation — HTML additions:**

```html
<div id="chat-box" style="position:fixed;bottom:60px;left:16px;width:360px;max-height:200px;overflow-y:auto;pointer-events:none;z-index:250;">
  <!-- Messages appended here as <div class="chat-msg"> -->
</div>
<input id="chat-input" type="text" maxlength="200" placeholder="Press Enter to chat..."
  style="position:fixed;bottom:36px;left:16px;width:360px;display:none;padding:6px 12px;
  background:var(--ui-bg);border:1px solid var(--border);color:var(--cream);
  font-family:'Courier Prime',monospace;font-size:12px;z-index:251;" />
```

### 1.3 Melanin / Skin Tone Slider

**Location:** Multiplayer lobby menu (`#mp-menu`), displayed after username entry and before host/join actions.

**UI spec:**

- Label: **"SKIN TONE"** in `var(--gold)`, 10px, letter-spacing 2px (matches existing UI language).
- A horizontal `<input type="range">` slider, `min="0" max="100" step="1"`, default `50`.
- Below the slider, render a **60×60px preview swatch** (rounded square) showing the interpolated skin color in real time.
- Color ramp (left to right): `#FDEBD0` (0) → `#D4A574` (25) → `#A0724A` (50) → `#6B4226` (75) → `#3B2212` (100). Use HSL interpolation for smooth transitions.

**Gameplay integration:**

- Skin tone value is sent to the server as part of the player's profile payload and broadcast to all clients.
- Applied to the player's rendered model/avatar. In the current canvas-based rendering, this means tinting the player circle/sprite with the selected color.
- Stored in `localStorage` alongside username for persistence.

### 1.4 Live Player Count on Server Browser

**UI spec:**

- In the multiplayer menu (`#mp-menu`), add a **server status bar** above the host/join buttons:

```html
<div id="mp-server-status" style="display:flex;justify-content:space-between;padding:8px 12px;
  background:rgba(0,0,0,0.3);border:1px solid var(--border);margin-bottom:15px;font-size:12px;">
  <span style="color:rgba(200,210,230,0.6);">Players Online</span>
  <span id="mp-online-count" style="color:#44dd88;font-weight:700;">0 / 400</span>
</div>
```

- The client pings a lightweight HTTP endpoint (`GET /status`) every 5 seconds while the multiplayer menu is open. Response: `{ "players": 127, "max": 400 }`.
- The existing HUD element `#mp-hud-players` already shows player count during gameplay — keep that as-is but update it from the server tick data rather than local peer count.

---

## 2. Controls & UI/UX

### 2.1 On-Screen Control Reference / Tutorial Overlay

**Current state:** Controls panel (`#controls-panel`) exists at top-right but is static and small.

**Changes:**

- **First-play tutorial:** On a new game (no `localStorage` save detected), display a full-screen semi-transparent overlay that walks through controls in 5 steps:
  1. **Movement** — WASD keys highlighted, "Move around the lake"
  2. **Casting** — "Hold CLICK to charge, release to cast"
  3. **Hooking** — "Press SPACE when you see a bite"
  4. **Reeling** — "Spam R to reel the fish in"
  5. **Survival** — "P to piss, O to shit, E to eat — manage your gauges"
- Each step shows an animated key icon and a short description. Player presses **Space** or clicks **Next** to advance. A **Skip Tutorial** button is always visible.
- Store `tutorialComplete: true` in `localStorage` after completion or skip.

**Persistent control reference:**

- Add a small **"?" button** (fixed, bottom-right corner, `32×32px`, `var(--gold)` border) that toggles the existing `#controls-panel` visibility on click.
- When toggled on, the panel slides in with a `300ms` ease transition. Default: visible (current behavior preserved).

### 2.2 Larger, Easier-to-Navigate Menus

**Across all menus (`#pause-menu`, `#mp-menu`, `#inventory-panel`, `#graphics-menu`, `#tackle-box-ui`, `#encyclopedia-panel`):**

- Increase base button font size from `14px` → `18px`.
- Increase button padding from `14px 24px` → `18px 32px`.
- Increase menu panel minimum width from `400px` → `520px`.
- Increase heading sizes by ~20% (e.g., `28px` → `34px`).
- Add `:focus-visible` outlines (`2px solid var(--gold)`) for keyboard navigation accessibility.
- Ensure all interactive elements have a minimum touch target of `44×44px` (WCAG recommendation).

**CSS changes (`.pause-menu-btn`):**

```css
.pause-menu-btn {
  padding: 18px 32px;
  font-size: 18px;
  min-height: 52px;
}

.main-menu-btn {
  padding: 20px 60px;
  font-size: 20px;
  min-width: 360px;
}
```

### 2.3 Fish Bite Visual Indicator (Particle Effect)

**Current state:** The `#bite-indicator` shows a text "Bite!" with "PRESS SPACE TO FIGHT" — functional but easy to miss.

**New system — layered feedback:**

1. **Glowing ripple effect:** When a fish bites, spawn 3 concentric expanding ring particles at the bobber's screen position. Rings are `var(--gold)` with decreasing opacity (`0.8 → 0.3 → 0.1`), expanding from `20px` to `120px` diameter over `600ms`. Use CSS animations on dynamically created `<div>` elements, removed after animation ends.

2. **Exclamation burst:** A large **"!"** glyph (`64px`, `#ff4040`, `Playfair Display`) appears above the bobber with a scale-up-and-fade animation (`0 → 1.2 → 1.0` scale over `300ms`, then holds for `1.5s`).

3. **Screen flash:** A subtle full-screen flash — `rgba(201,168,76,0.15)` overlay that fades over `200ms`.

4. **Audio cue:** (if audio system exists) A sharp "plunk" sound effect.

5. **Controller rumble:** (future) `navigator.getGamepads()` haptic pulse if gamepad connected.

**Update bite sub-text:** Change from "PRESS SPACE TO FIGHT" to "PRESS **R** TO REEL" to match the requested wording, or keep the existing SPACE-to-hook flow and clarify: "PRESS **SPACE** TO HOOK, THEN **R** TO REEL".

**CSS for ripple:**

```css
@keyframes biteRipple {
  0% { width: 20px; height: 20px; opacity: 0.8; }
  100% { width: 120px; height: 120px; opacity: 0; }
}

.bite-ripple {
  position: fixed;
  border: 2px solid var(--gold);
  border-radius: 50%;
  pointer-events: none;
  animation: biteRipple 0.6s ease-out forwards;
  transform: translate(-50%, -50%);
  z-index: 500;
}
```

### 2.4 Adjustable Game Difficulty Slider

**Location:** Multiplayer menu (`#mp-menu`), visible only to the host player. Also available in the pause menu for single-player.

**UI spec:**

```html
<div style="margin-top:15px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid var(--border);">
  <div style="font-size:10px;color:var(--gold);letter-spacing:2px;margin-bottom:8px;">DIFFICULTY</div>
  <input type="range" id="difficulty-slider" min="1" max="5" step="1" value="3" style="width:100%;" />
  <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(200,210,230,0.5);margin-top:4px;">
    <span>Peaceful</span><span>Easy</span><span>Normal</span><span>Hard</span><span>Chaos</span>
  </div>
</div>
```

**Difficulty levels and what they affect:**

| Parameter | Peaceful (1) | Easy (2) | Normal (3) | Hard (4) | Chaos (5) |
|---|---|---|---|---|---|
| Fish fight difficulty | 0.5x | 0.75x | 1.0x | 1.5x | 2.5x |
| Bite frequency | 2.0x | 1.5x | 1.0x | 0.7x | 0.4x |
| Survival drain rates | OFF | 0.5x | 1.0x | 1.5x | 2.0x |
| Heart attack chance | 0% | 25% | 50% | 75% | 100% |
| Loot quality multiplier | 1.5x | 1.25x | 1.0x | 0.8x | 0.6x |
| Boss fish spawn rate | 0.5x | 0.75x | 1.0x | 1.5x | 3.0x |
| Nuke availability | No | No | Yes | Yes | All spawn with one |
| Beer stat restore | 100% | 100% | 100% | 75% | 50% |

- Difficulty is synced from host to all clients in multiplayer. Clients see the current difficulty in their HUD but cannot change it.

---

## 3. Fishing System

### 3.1 Reeling Mechanic Overhaul

**Current state:** Spam R to reel, simple progress bar in fight UI.

**New system — Tension-Based Reeling:**

The reel mechanic becomes a **tension management minigame** during the fish fight:

1. **Line Tension Gauge** (already exists as `#tension-bar` — expand its role):
   - Tension ranges from `0%` to `100%`. If tension exceeds `100%`, the line **snaps** and the fish escapes.
   - If tension drops below `10%` for more than 2 seconds, the fish **unhooks** and escapes.
   - The sweet spot is **40%–70%** tension (highlighted green on the bar).

2. **Reel input:**
   - Each press of **R** adds `+5%` tension and pulls the fish `+1 unit` closer.
   - Holding **R** engages a **steady reel** at `+2%/tick` tension, `+0.3 units/tick` pull — less frantic, more control.
   - The fish periodically **surges** (random direction pulls adding `+15–30%` tension over 1 second). Player must **stop reeling** or **press SPACE to give slack** (`-20%` tension, but fish gains `+3 units` distance).

3. **Fish stamina:**
   - Fish have a stamina value. Each reel-in depletes fish stamina. Surges cost the fish stamina too.
   - When fish stamina hits 0, it stops fighting and can be reeled in freely.
   - Larger fish have more stamina and more aggressive surges.

4. **Rod quality impact:**
   - Better rods increase tension capacity (line breaks at `110%`, `120%`, etc.) and reel-per-press distance.
   - Rod `reelSpeed` stat multiplies the pull distance.

5. **Visual feedback:**
   - The line drawn on canvas bows/curves based on tension (Bezier control point offset = `tension * 2` pixels).
   - Screen shake intensity scales with tension above 80%.
   - At >90% tension, the tension bar flashes red with the `flash` keyframe animation.

### 3.2 Boss-Tier Fish (Massive Variants)

**New fish category: LEVIATHANS**

Each biome/depth zone has one Leviathan. They are **rare** (1% base spawn chance per cast at max depth), **enormous**, and trigger a unique multi-phase fight.

| Leviathan | Biome | Weight | Stamina | Special Mechanic |
|---|---|---|---|---|
| 🐋 The Ancient Whale | Deep ocean | 2,000–5,000 lbs | 500 | Drags the player's camera underwater; must surface (press W) periodically or drown |
| 🦑 Kraken of the Depths | Abyss | 800–2,000 lbs | 400 | Spawns tentacle QTEs — press displayed keys within 1.5s or take line damage |
| 🐊 Old Ironskin | Swamp | 600–1,200 lbs | 350 | Periodically charges the shore; dodge (press A/D within 0.8s) or get knocked back |
| 🦈 The Crimson Fin | Open water | 400–900 lbs | 300 | Cuts the line if tension stays above 60% for >3s; requires patient play |
| 🐉 Loch Ness Larry | Lake center | 3,000–8,000 lbs | 600 | Three-phase fight: Reel → Wrestle → Breach QTE → Wrestle → Final reel. Server-wide announcement on catch. |

**UI for boss encounters:**

- Full-screen darkened vignette.
- Boss name in `Playfair Display`, `48px`, with a dramatic slide-in animation.
- Unique tension bar skin per boss (color-coded).
- On catch: a **server-wide notification** broadcast to all 400 players: `"[username] has landed [Leviathan name]! [weight] lbs!"`

**Balance:**

- Leviathans require a rod of tier 3+ (see §4.2). Attempting with a lower rod auto-snaps the line after 5 seconds.
- Grant 10x XP and a guaranteed legendary loot drop (see §3.6).
- Cooldown: only one Leviathan can be active per server at a time. 5-minute cooldown between Leviathan spawns.

### 3.3 Expanded Fish & Crab Variety

**Current fish pool:** ~10–15 species (inferred from encyclopedia).

**Target:** 50+ species across 5 rarity tiers.

| Tier | Color Code | Catch Rate | Examples |
|---|---|---|---|
| **Common** | White | 45% | Bluegill, Perch, Sardine, Catfish, Carp, Sunfish, Anchovy, Herring |
| **Uncommon** | Green `#44dd88` | 25% | Bass, Trout, Pike, Walleye, Red Snapper, Flounder, Tilapia |
| **Rare** | Blue `#4488ff` | 15% | Swordfish, Marlin, Tuna, Electric Eel, King Crab, Lobster, Octopus |
| **Legendary** | Purple `#aa44ff` | 8% | Golden Koi, Ghost Shark, Plutonium Pufferfish, Radioactive Crab, Abyssal Angler |
| **Mythic** | Gold `#ffd700` | 2% | Leviathans (see §3.2), The Philosopher Fish, The Fish That Grants Wishes (heals all stats) |

**Crab expansion (6 new species):**

- 🦀 **Blue Crab** (Common) — standard, 2–5 lbs
- 🦀 **King Crab** (Rare) — 15–30 lbs, powerful fight
- 🦀 **Coconut Crab** (Uncommon) — found near islands, 5–10 lbs
- 🦀 **Spider Crab** (Rare) — deep water only, 10–20 lbs, long legs render hilariously
- 🦀 **Radioactive Crab** (Legendary) — glows green, caught only with uranium bait, 8–15 lbs, gives radiation status
- 🦀 **Hermit Crab** (Common) — 0.5–2 lbs, sometimes contains a trinket inside its shell

**Bait affinity:** Each species has preferred bait types that multiply catch rate by 2x–3x. Displayed in the encyclopedia once discovered.

### 3.4 Bait System with Exotic Variants

**Current state:** Tackle box (`#tackle-box-ui`) has 10 bait types as buttons.

**New system — Bait Slider + Exotic Crafting:**

Replace the button grid with a **categorized bait selector**:

```
[Standard Bait] ←slider→ [Exotic Bait]

Standard:  🪱 Worm | 🐟 Minnow | 🧀 Cheese | 🌽 Corn | 🥩 Steak
Advanced:  ✨ Fancy Lure | 💡 Glowstick | 👻 Ectoplasm | 🗑️ Trash
Exotic:    ☢️ Uranium | ☢️ Plutonium | ⚡ Charged Uranium | 🔥 Enriched Plutonium
```

**UI redesign:**

- Top of tackle box: a horizontal **category slider** (segmented control) with three stops: `Standard → Advanced → Exotic`.
- Sliding to a category reveals its bait options below as a grid.
- Each bait shows: icon, name, quantity owned, and a 1-line effect description on hover.

**Exotic bait effects:**

| Bait | Source | Effect |
|---|---|---|
| ☢️ **Uranium** | World loot / crafting | 3x rare fish chance. Gives player "Irradiated" status (screen greenish tint, -1 HP/10s for 60s). |
| ☢️ **Plutonium** | World loot / crafting (rarer) | 5x legendary fish chance. "Critical Irradiation" status — screen flickers, controls randomly invert for 0.5s bursts over 90s. |
| ⚡ **Charged Uranium** | Craft: Uranium + Beer | 3x rare + attracts Electric Eel exclusively. Sparks particle effect on the line. |
| 🔥 **Enriched Plutonium** | Craft: Plutonium + Plutonium | 8x mythic chance, but 20% chance per cast the bait **detonates** (mini explosion, player dies, nearby fish scatter for 30s). |

### 3.5 Beer Fishing (50% Chance)

**Mechanic:**

- On every cast, before the fish-species roll, a coin flip occurs (50% chance).
- If beer: skip the normal bite sequence entirely. After a 2–4 second "wait" (bobber animation), the line auto-reels and the player hauls up a **🍺 Beer**.
- Catching beer is instant — no fight, no tension.

**Beer effect — Full Stat Restore:**

- All 7 survival gauges (Hunger, Thirst, Fatigue, Stress, Warmth, Blood Sugar, Sobriety) reset to optimal values.
- Sobriety gauge specifically goes to **0%** (completely drunk). This triggers:
  - Camera sway (sinusoidal offset, ±10px, 0.5 Hz)
  - Movement input has a 150ms delay
  - Slight color distortion (hue rotate ±15°)
  - Lasts 60 seconds, then sobriety linearly recovers

**UI feedback:**

- Catch display shows: `🍺` (96px emoji), "BEER!" in gold 48px text, "All stats restored!" in green.
- A satisfying "glug glug" notification sound cue.
- Sobriety gauge on the analog dashboard immediately slams to 0 with a needle-whip animation.

**Balance:**

- Beer cannot be stored in inventory — it's consumed immediately on catch.
- At Chaos difficulty, beer only restores 50% of each stat (see §2.4).
- The 50% beer rate means fishing is roughly half-productive for actual fish — this is intentional for the game's chaotic tone.

### 3.6 Random Loot Fishing

**Mechanic:**

After the beer coin flip (if not beer), a second roll determines if the catch is a **fish** or **random loot**. Distribution:

| Outcome | Chance | Details |
|---|---|---|
| Fish | 70% | Normal species roll based on bait, depth, weather |
| Random loot | 25% | See loot table below |
| Excrement | 5% | Triggers defecation event (see §3.7) |

**Random loot table:**

| Loot | Weight in table | Description |
|---|---|---|
| 🎣 **Rod** | 15% | Random rod tier (see §4.2). Equippable immediately. |
| 🪝 **Hook** | 15% | Hook attachment. +10–30% catch rate bonus depending on rarity. |
| 📦 **Chest** | 20% | Contains 2–5 random items (gold, trinkets, bait, or a rod). |
| 🔫 **Weapon** | 10% | Random gun (see §4.3). |
| 💎 **Trinket** | 10% | Passive equippable. Effects like "+15% rare fish chance" or "Immune to radiation". |
| 🪵 **Junk** | 20% | Boot, tire, seaweed, tin can — sell for small gold or discard. |
| ☢️ **Uranium/Plutonium** | 5% | Raw exotic bait material. |
| 💣 **Nuclear Bomb** | 5% | See §6.3. Usable weapon. |

**UI:** The catch display (`#catch-display`) already handles fish — extend it to show loot items with appropriate icons, names, rarity borders, and an "Added to Inventory" confirmation.

### 3.7 Defecation Event

**Trigger:** 5% chance when fishing (see §3.6). Player fishes up a `💩`.

**Mechanic — "The Defecation Event":**

1. **Announcement:** Full-screen text: `💩 DEFECATION EVENT 💩` in brown (`#7a4010`), `48px`, with screen shake.
2. **Minigame:** A **rhythm-based mashing game** lasting 8 seconds:
   - A progress bar appears (styled like the fight bar but brown-themed).
   - The player must **alternate pressing O and P** in rhythm with a pulsing indicator.
   - A metronome-like visual pulse (circle expanding/contracting at 2 Hz). Press on the beat = +10% progress. Off-beat = +3%.
   - Must reach 100% within 8 seconds or the event "fails."
3. **Success:** The shit meter resets to 0%. Player receives a random **"Fertilizer" item** (consumable bait that attracts rare bottom-feeders at 4x rate). A triumphant fanfare notification: `"Magnificent."` in gold italic.
4. **Failure:** The shit meter stays full. Player's movement speed is reduced by 30% for 30 seconds ("Soiled" status effect). Nearby players within 50 units see a brown cloud particle effect around the afflicted player.

**Server broadcast:** When a defecation event triggers, all players on the server receive a subtle notification: `"[username] is having a moment..."` in brown text.

### 3.8 More Chest Loot Spawns

**Current state:** Chests exist but are sparse.

**Changes:**

- Increase world chest density by **3x**. Target: 1 chest per ~500 square units of terrain.
- Chests respawn 5 minutes after being looted.
- **Chest tiers:**

| Tier | Appearance | Spawn Rate | Contents |
|---|---|---|---|
| Wooden | 📦 Brown, small | 60% | 1–2 common items, small gold |
| Iron | 🗄️ Gray, medium | 25% | 2–3 items (uncommon+), medium gold |
| Gold | ✨ Gold, large | 10% | 3–5 items (rare+), large gold, possible rod |
| Radioactive | ☢️ Green glow | 5% | 1 guaranteed exotic bait + random legendary item |

- Chests are visible on the minimap as small dot icons (color-coded by tier).
- In multiplayer: chests are first-come-first-served. Once opened, gone for all players until respawn.

---

## 4. Inventory & Equipment

### 4.1 God Loadout (Full Inventory Spawn)

**Mechanic:**

- **Toggle in settings:** "God Loadout" checkbox in both the main menu settings and pause menu.
- When enabled, players spawn with:
  - One of each rod tier (5 rods)
  - One of each bait type (10 units each)
  - One of each weapon (see §4.3)
  - 5 beers (pre-stocked, unlike fished beer these are inventory items)
  - 3 nuclear bombs
  - Full survival stats
  - Max-tier hook and attachments

- **Default state:** OFF in Normal+ difficulty, ON in Peaceful/Easy.
- In multiplayer: host controls whether god loadout is available. It's a server-wide setting, not per-player, to prevent imbalance.

**UI toggle:**

```html
<label class="gfx-toggle" style="margin-top:12px;">
  <input type="checkbox" id="god-loadout-toggle" onchange="toggleGodLoadout(this.checked)">
  ⚡ God Loadout (spawn with everything)
</label>
```

### 4.2 Rods, Hooks, and Attachments

**Rod tiers (5 tiers):**

| Tier | Name | Icon | Reel Speed | Line Strength | Special |
|---|---|---|---|---|---|
| 1 | Twig Rod | 🪵 | 1.0x | 100% tension cap | Starting rod |
| 2 | Fiberglass Rod | 🎣 | 1.3x | 115% tension cap | Unlocked at level 5 or found in chests |
| 3 | Carbon Fiber Rod | ⚫ | 1.6x | 130% tension cap | Required for Leviathans |
| 4 | Titanium Rod | 🔩 | 2.0x | 150% tension cap | Rare chest or Leviathan drop |
| 5 | The Omega Rod | 👑 | 3.0x | 200% tension cap | 0.5% drop from Mythic fish only. Glows gold in inventory. |

**Hooks (equippable attachment slot):**

| Hook | Effect | Source |
|---|---|---|
| Basic Hook | Default, no bonus | Starting |
| Barbed Hook | Fish can't unhook below 10% tension (removes that fail condition) | Uncommon loot |
| Weighted Hook | +20% depth, access deeper fish | Found in chests |
| Lure Hook | +15% bite frequency | Crafted or looted |
| Radioactive Hook | +30% rare/legendary chance, but line degrades 2x faster | Crafted with Uranium |
| The Meathook | +50% damage in fish brawl phase, -10% reel speed | Legendary drop |

**Attachments (additional slot):**

- **Bobber upgrades:** Change the visual and add +10% bite detection range.
- **Line material:** Monofilament (default), Braided (+15% strength), Fluorocarbon (invisible to fish, +10% bite rate).
- **Reel type:** Manual (default), Spinning (+20% reel speed), Electric (+40% reel speed, consumes battery item).

**Equip UI:** Add a dedicated **"Equipment"** sub-panel inside the inventory (tab already exists: `#tab-equipment`). Display 4 slots in a column: Rod, Hook, Attachment, Line. Click a slot to see available options from inventory.

### 4.3 Expanded Gun Variety

**Design note:** Guns in this game are primarily for chaotic PvP fun and fish-punching escalation, not tactical shooter mechanics.

**New weapons (8 additions to existing pool):**

| Weapon | Icon | Damage | Fire Rate | Range | Special |
|---|---|---|---|---|---|
| Flare Gun | 🔫 | 10 | Slow | Medium | Lights area, scares fish away in 100-unit radius for 30s |
| Harpoon Gun | 🏹 | 40 | Very slow | Long | Can catch fish without a rod (no fight, just aim and shoot into water). 10% accuracy. |
| Shotgun | 💥 | 60 (spread) | Slow | Short | Knocks players back 20 units. Kills fish in shallow water in a 30-unit cone. |
| Minigun | 🔥 | 8/tick | Continuous | Medium | Spin-up time of 1.5s. Reduces movement to 20% while firing. |
| RPG | 🚀 | 100 (AOE) | Very slow | Long | 15-unit explosion radius. Destroys nearby chests. Kills all fish in blast zone. |
| Water Gun | 🔫💧 | 0 | Fast | Short | Does no damage. Fills the target player's thirst gauge. A tool of kindness. |
| Tranquilizer | 💉 | 5 | Medium | Long | Hit player falls asleep for 5 seconds (can't move/act). Fish put to sleep are auto-caught. |
| Nuke Launcher | ☢️ | ∞ | Once | Global | See §6.3 |

**Balance:**

- Weapons have limited ammo. Ammo found in chests or fished up.
- PvP damage is reduced by 50% at Peaceful/Easy difficulty.
- Players respawn after 5 seconds on death, losing 25% of inventory (random items).
- No friendly fire on a player's own fishing line.

---

## 5. World & Terrain

### 5.1 Procedural Terrain Expansion

**Current state:** Terrain is generated procedurally (inferred from canvas rendering). Likely uses noise functions for height/water.

**Expansions:**

**New biome types (6 biomes):**

| Biome | Visual | Unique Fish | Features |
|---|---|---|---|
| **Lake** (existing) | Blue water, green shores | Bass, Bluegill, Catfish | Starting area, gentle |
| **Swamp** | Dark green water, mangroves | Electric Eel, Old Ironskin | Mosquitoes, fog, reduced visibility |
| **Ocean** | Deep blue, waves | Tuna, Marlin, Sharks | Requires boat, deep-water fish |
| **Volcanic Springs** | Red/orange tint, steam | Magma Fish, Obsidian Crab | Heat damage without warmth gear, Plutonium spawns |
| **Frozen Lake** | White/ice, snowfall | Ice Pike, Crystal Trout | Must break ice to fish (click interaction), cold damage |
| **Abyss** | Pitch black, bioluminescence | Abyssal Angler, Kraken | Only accessible at night, terrifying ambient sounds |

**Islands:**

- Generate 5–15 islands per world (Perlin noise threshold islands).
- Each island has: 1–3 chest spawns, possible rod shop, and a unique fishing hotspot.
- Islands are visible on the minimap.

**Boats:**

- **Rowboat:** Found at docks on shores. Player enters with **E**, uses WASD to row. Allows fishing in deep water. Slow, stable.
- **Motorboat:** Rare spawn or crafted. Fast, noisy (scares fish within 50 units while engine on). Toggle engine with **E** while aboard.
- **Raft:** Craftable from junk items (3x 🪵 Junk). Slow, fragile (sinks after 3 minutes), but silent.

**Cars:**

- Spawn on roads/paths connecting shore areas.
- **Pickup Truck:** Press E to enter. WASD to drive. Top speed 3x player run speed. Honk with **H** (scares fish, alerts players). Can drive off cliffs for physics chaos.
- **Golf Cart:** Slower but spawns more frequently. Silent. Good for lake-side cruising.
- Cars have fuel (displayed as a small gauge when driving). Fuel depletes over time. Refuel at gas stations (static world POIs).

### 5.2 Environmental Density

**Additions to increase world feel:**

- **Ambient wildlife:** Birds (canvas sprites flying overhead), frogs near water edges (small hopping dots), fireflies at night (particle system, small yellow dots with fade-in/out).
- **Vegetation:** Procedurally placed trees, bushes, tall grass (rendered as colored shapes on canvas). Dense near shores, sparse on islands.
- **Structures:** Abandoned cabins (1–2 per world), fishing docks (3–5 per world), gas stations (1–2), a general store NPC (sells basic bait and ammo).
- **Weather particles:** Enhance existing weather system with visible rain (line particles), snow (dot particles with drift), fog (opacity layer that scales with distance).
- **Sound cues:** (if audio added) Crickets at night, wind, water lapping, distant thunder during storms.

---

## 6. Chaos & Game Feel

### 6.1 Physics Launch Bug → Feature

**Current state:** A bug causes players to be launched skyward.

**Resolution — make it a feature:**

- **Root cause fix:** Identify collision resolution code that over-corrects penetration between player and terrain/objects. Clamp vertical velocity to `maxVerticalSpeed = 50` to prevent unintentional launches.
- **"Geyser" feature (deliberate launches):**
  - Spawn 3–5 **geyser vents** per world (visual: bubbling water spot with steam particles).
  - Walking onto a geyser launches the player **200 units** into the air with a `1.5s` hang time.
  - While airborne: player can cast their rod downward for a "sky fishing" bonus (2x rare chance for the cast).
  - Fall damage: none (this is a fun game). Player lands with a satisfying screen-shake and dust particle burst.
- **Toggle:** "Physics Chaos" toggle in settings. When ON, the old launch bug behavior is restored as-is — random launches from collisions. When OFF, only geysers launch players.

### 6.2 Heart Attack Event (Every 10 Minutes)

**Mechanic:**

- Server maintains a 10-minute repeating timer.
- On each tick: every connected player independently rolls a **50% chance** of suffering a heart attack.
- **Heart attack sequence (for affected players):**
  1. Screen instantly tints red with `rgba(200,0,0,0.4)` overlay.
  2. A dramatic `💀 HEART ATTACK 💀` text in `64px` red, center screen, with the `shake` animation.
  3. A flatline sound effect (if audio exists) or a visual EKG line that goes flat across the screen.
  4. Player dies after a 2-second dramatic pause. Camera slowly tilts. Controls disabled.

- **Server restart trigger:** If **any** player dies from a heart attack, the server initiates a **15-second countdown** visible to all players:
  - `⚠️ CARDIAC EVENT DETECTED — SERVER RESTART IN 15...14...13...`
  - At 0: all players are killed simultaneously. The server state resets (fish respawn, chests respawn, loot resets).
  - Players automatically respawn with their persistent inventory (rods, hooks, achievements) intact, but lose any un-stored fish and on-ground loot.

**UI elements:**

```html
<div id="heart-attack-overlay" style="position:fixed;inset:0;background:rgba(200,0,0,0.4);
  display:none;z-index:9999;pointer-events:none;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    font-family:'Playfair Display',serif;font-size:64px;color:#ff0000;
    text-shadow:0 0 40px rgba(255,0,0,0.8);animation:shake 0.2s infinite;">
    💀 HEART ATTACK 💀
  </div>
</div>

<div id="server-restart-banner" style="position:fixed;top:20%;left:50%;transform:translateX(-50%);
  display:none;z-index:9998;font-family:'Playfair Display',serif;font-size:36px;color:#ff4040;
  text-shadow:0 0 20px rgba(255,0,0,0.6);text-align:center;animation:pulse 0.5s infinite;">
  ⚠️ CARDIAC EVENT DETECTED<br>
  <span id="restart-countdown" style="font-size:72px;">15</span>
</div>
```

**Balance:**

- At Peaceful difficulty: heart attacks are disabled.
- At Easy: 25% chance instead of 50%.
- Server restart preserves player XP, level, rod collection, and encyclopedia progress. Only transient state (current catch, on-ground items) is lost.
- The 10-minute cycle creates natural "seasons" of play — players know a reckoning may come and should bank important items.

### 6.3 Nuclear Bombs

**Acquisition:**

- 5% chance from random loot fishing (see §3.6).
- Found in Radioactive chests.
- 3 included in God Loadout.
- Crafted: `2x Enriched Plutonium + 1x Chest (any tier)`.

**Usage — Nuke Launcher weapon (see §4.3):**

1. Player equips the Nuke Launcher (or uses the bomb from inventory with **USE** action).
2. Aiming shows a **red target circle** on the ground (200-unit radius).
3. On fire: a 3-second flight animation (projectile arcs across the sky).
4. **Detonation sequence:**
   - **Visual:** Blinding white flash (full-screen `#fff` at `opacity:0.9`, fades over 2 seconds). Then a mushroom cloud particle effect (expanding brown/orange circle with billowing animation).
   - **Gameplay effect:**
     - All players within 200 units: **instant death**.
     - All players within 400 units: **75% HP damage**, knocked back 50 units, "Irradiated" status for 120s.
     - All fish within 500 units: killed. Their corpses float to the surface and can be collected (auto-caught, no fight).
     - All chests within 200 units: destroyed (no loot).
     - Terrain within 200 units: becomes a **"crater biome"** for 5 minutes (visual: scorched ground, no fish spawns, Uranium ore nodes appear).
   - **Server-wide announcement:** `"☢️ [username] HAS DETONATED A NUCLEAR DEVICE ☢️"`
   - **Fallout:** For 2 minutes after detonation, a 600-unit radius has green-tinted air (overlay) and all fishing in that area yields Radioactive variants of fish (worth 5x gold, give radiation status).

**Balance:**

- Nukes are **loud, expensive, and double-edged** — they destroy the user's nearby loot too.
- Max inventory: 3 nukes. Cannot stack beyond that.
- 60-second global cooldown between nuke uses (per-player).
- Disabled at Peaceful and Easy difficulty.
- Friendly fire: YES. You can nuke yourself.

### 6.4 Elemental Plutonium & Uranium Variants

**Resource nodes (world spawns):**

In addition to fishing up uranium/plutonium, these materials spawn as **harvestable nodes** in the world:

| Resource | Visual | Spawn Location | Harvest Method | Respawn Time |
|---|---|---|---|---|
| ☢️ **Raw Uranium Ore** | Greenish-yellow glowing rock | Crater biomes, random shores | Walk up, press E, 3-second channel | 5 min |
| ☢️ **Raw Plutonium Ore** | Deep purple glowing rock | Volcanic Springs, Abyss biome | Walk up, press E, 5-second channel | 10 min |
| ⚡ **Charged Uranium** | Crackling blue-green crystal | Near geysers, during thunderstorms only | Walk up, press E, 3-second channel (takes 10 HP) | Storm-dependent |
| 🔥 **Enriched Plutonium** | Molten orange-red mass | Volcanic Springs only, very rare | Walk up, press E, 8-second channel (takes 25 HP, Irradiated status) | 20 min |

**Crafting recipes:**

| Input | Output | Station |
|---|---|---|
| 2x Raw Uranium + 1x Beer | ⚡ Charged Uranium | Any campfire |
| 2x Raw Plutonium | 🔥 Enriched Plutonium | Volcanic Springs only |
| 1x Enriched Plutonium + 1x Raw Uranium | ☢️ **Fusion Bait** (10x mythic chance, guaranteed detonation on use) | Volcanic Springs |
| 2x Enriched Plutonium + 1x Chest | 💣 Nuclear Bomb | Any campfire |

**Effects as bait (recap from §3.4):**

- Uranium bait: +3x rare chance, mild radiation.
- Plutonium bait: +5x legendary chance, severe radiation.
- Charged Uranium: +3x rare, exclusive Electric Eel attraction.
- Enriched Plutonium: +8x mythic, 20% self-detonation risk.
- Fusion Bait: +10x mythic, 100% detonation on reel-in (catches the fish AND kills the player).

**Radiation status effect tiers:**

| Tier | Source | Duration | Effect |
|---|---|---|---|
| Mild Irradiation | Uranium bait/ore | 60s | Green screen tint, -1 HP/10s |
| Severe Irradiation | Plutonium bait/ore | 90s | Green tint + screen flicker, controls randomly invert for 0.5s every 10s, -2 HP/10s |
| Critical Irradiation | Enriched Plutonium / nuke proximity | 120s | All of the above + character model glows green, nearby players within 20 units also get Mild Irradiation (contagious!), -5 HP/10s |

---

## Implementation Priority

| Priority | Feature | Effort | Dependencies |
|---|---|---|---|
| **P0 — Core** | WebSocket server architecture (§1.1) | High | None — foundation for all MP features |
| **P0 — Core** | Username system (§1.2) | Medium | §1.1 |
| **P1 — Gameplay** | Reeling overhaul (§3.1) | Medium | None |
| **P1 — Gameplay** | Beer fishing + random loot (§3.5, §3.6) | Medium | None |
| **P1 — Gameplay** | Bait system redesign (§3.4) | Medium | None |
| **P1 — Gameplay** | Expanded fish/crab variety (§3.3) | Medium | §3.1 |
| **P2 — Content** | Boss-tier fish (§3.2) | High | §3.1, §3.3 |
| **P2 — Content** | Rod/hook/attachment system (§4.2) | Medium | §3.1 |
| **P2 — Content** | Gun expansion (§4.3) | Medium | None |
| **P2 — Content** | World terrain + biomes (§5.1) | High | None |
| **P2 — Content** | Elemental resources (§6.4) | Medium | §3.4, §5.1 |
| **P3 — Social** | Text chat (§1.2) | Low | §1.1 |
| **P3 — Social** | Skin tone slider (§1.3) | Low | §1.1 |
| **P3 — Social** | Player count display (§1.4) | Low | §1.1 |
| **P3 — UX** | Tutorial overlay (§2.1) | Low | None |
| **P3 — UX** | Larger menus (§2.2) | Low | None |
| **P3 — UX** | Bite visual indicator (§2.3) | Low | None |
| **P3 — UX** | Difficulty slider (§2.4) | Low | None |
| **P4 — Chaos** | Heart attack event (§6.2) | Medium | §1.1 |
| **P4 — Chaos** | Nuclear bombs (§6.3) | Medium | §4.3, §6.4 |
| **P4 — Chaos** | Defecation event (§3.7) | Low | None |
| **P4 — Chaos** | Physics launch → geysers (§6.1) | Low | None |
| **P4 — Content** | God loadout (§4.1) | Low | §4.2, §4.3 |
| **P4 — Content** | Chest expansion (§3.8) | Low | §5.1 |
| **P4 — Content** | Environmental density (§5.2) | Medium | §5.1 |
