# THE LAKE — V2.1 MEGA EXPANSION Design Specification

> **Game:** THE LAKE (Stillwater Fishing Simulator)
> **Version:** v2.1 Mega Expansion
> **Date:** 2026-03-26
> **Status:** Implementation-Ready
> **Companion to:** `GAME_DESIGN_SPEC.md` (v2.0 base expansion)

---

## Table of Contents

1. [Animation System](#1-animation-system)
2. [Expanded Fish Bestiary (120+ Species)](#2-expanded-fish-bestiary)
3. [Boss & Leviathan Encounters (20 Bosses)](#3-boss--leviathan-encounters)
4. [Rod & Tackle Expansion (15 Rods)](#4-rod--tackle-expansion)
5. [Biome Expansion (16 Biomes)](#5-biome-expansion)
6. [Vegetation & Flora System](#6-vegetation--flora-system)
7. [Weapon Arsenal (30+ Weapons)](#7-weapon-arsenal)
8. [UI/UX Expansion](#8-uiux-expansion)
9. [Color & Visual Identity System](#9-color--visual-identity-system)
10. [Emotes, Achievements & Cosmetics](#10-emotes-achievements--cosmetics)
11. [Weather & Time-of-Day Expansion](#11-weather--time-of-day-expansion)
12. [NPC & Questline System](#12-npc--questline-system)
13. [Audio & Music System](#13-audio--music-system)
14. [Status Effects Master List](#14-status-effects-master-list)

---

## 1. Animation System

Every player action has a corresponding animation with clear visual feedback. All animations use CSS keyframes on DOM overlays, canvas sprite state changes, or both. Each has an **entry**, **active loop** (if applicable), and **exit** phase.

### 1.1 Movement Animations

| Action | Keyframe | Duration | Details |
|---|---|---|---|
| **Idle** | `idleBob` | 2s loop | Subtle bob ±2px. Breathing rhythm. |
| **Walk (WASD)** | `walkCycle` | 0.6s loop | Tilt ±3°. Dust particles at feet every 0.3s. |
| **Run (Shift+WASD)** | `runCycle` | 0.35s loop | Tilt ±6°. 3 trailing afterimages at 30% opacity, fade 200ms. |
| **Sprint (Double-W)** | `sprintCycle` | 0.25s loop | Motion blur trail (3 prev frames at 15% opacity). FOV widens 5%. |
| **Stop** | `skidStop` | 0.3s | Slides 5px past stop point. 6 dust particles, radial burst. |
| **Pivot** | `pivotTurn` | 0.2s | Body lags 100ms behind camera, snaps. Squash on model. |
| **Swim** | `swimStroke` | 0.8s loop | Ripple rings every 0.4s. Arms alternate. Bob ±4px. |
| **Crouch (Ctrl)** | `crouchDown` | 0.2s | Compress to 70% height. Speed halved. |
| **Climb** | `climbCycle` | 0.5s loop | Hand-over-hand. Rock particles fall from contact. |

```css
@keyframes idleBob {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
}
@keyframes walkCycle {
  0%, 100% { transform: rotate(0deg) translateY(0px); }
  25% { transform: rotate(-3deg) translateY(-2px); }
  75% { transform: rotate(3deg) translateY(-2px); }
}
@keyframes runCycle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg) translateY(-3px); }
  75% { transform: rotate(6deg) translateY(-3px); }
}
@keyframes skidStop {
  0% { transform: translateX(5px) scaleX(0.9); }
  60% { transform: translateX(-2px) scaleX(1.05); }
  100% { transform: translateX(0) scaleX(1); }
}
@keyframes swimStroke {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-4px) rotate(-5deg); }
  75% { transform: translateY(4px) rotate(5deg); }
}
```

### 1.2 Fishing Animations

| Action | Duration | Details |
|---|---|---|
| **Cast charge** | Variable | Rod rotates 0° to -60°. Player leans back. Sparks at rod tip >80% power. |
| **Cast release** | 0.3s | Rod whips -60° to +30° with elastic overshoot. Bezier line extends. 8 water splash droplets on landing. |
| **Perfect cast** | 0.5s | Golden starburst at landing (12 ray particles). "⭐ PERFECT" floats up. Gold sparkle trail 1s. |
| **Weak cast** | 0.3s | Rod barely moves. Single sad water drop. "😐" floats up. |
| **Overshoot** | 0.3s | Rod overshoots +60°. Red flash. "TOO FAR" in red. |
| **Bobber idle** | 3s loop | Sinusoidal bob ±3px Y, ±1px X. Tiny ripple rings every 2s. |
| **Fish nibble** | 0.2s × 1–3 | Bobber dips 8px, returns. Small ripple. Yellow "?" above bobber. |
| **Fish bite** | 0.4s | Bobber yanks 20px down. 3 gold ripple rings. "!" burst red 64px. Gold screen flash. Camera micro-zoom 2%. |
| **Hook set (Space)** | 0.15s | Rod snaps up 15°. Line taut. Tension bar springs in. "HOOKED!" scales 0→1.2→1.0. |
| **Reel tap (R)** | 0.1s/press | Rod oscillates ±5°. Line shortens. Reel handle rotates 30°. Water spray at line entry. |
| **Reel hold (R)** | Continuous | Smooth oscillation 3Hz. Steady spray. Reel spins smooth. |
| **Fish surge** | 0.5s | Rod yanked 20° forward. Screen shakes ±6px. "⚠️ SURGE!" in orange. Splash 12 particles. |
| **Give slack** | 0.3s | Rod drops to 0°. Line droops. Tension drops green flash. "Slack given" teal text. |
| **Line snap** | 0.5s | Line breaks at midpoint, ends whip apart. Rod recoils +40°. Shake ±10px. "SNAP!" red 72px + 8 fragment particles. |
| **Fish escape** | 0.4s | Shadow darts away. Splash. Line limp. "ESCAPED" gray italic fades 1s. |
| **Land fish** | 0.8s | Rod arcs overhead. Fish emoji arcs to center. 16 gold sparkles. Weight counts up 0→final over 0.5s. BG dims 30%. |
| **Punch fish (F)** | 0.2s | Lunge 5px. Impact star scales 0→1.5→0. Micro-shake ±3px. Damage number floats red. |
| **Wrestle (Phase 2)** | 0.5s loop | Models shake in opposition. Red/orange flashes. Splash every 0.3s. |
| **Breach QTE** | 1.0s | Fish launches up off-screen, crashes back. 20 splash particles. Slow-mo 0.5x for 0.8s. QTE key pulses. |

```css
@keyframes castWhip {
  0% { transform: rotate(-60deg); }
  60% { transform: rotate(35deg); }
  80% { transform: rotate(25deg); }
  100% { transform: rotate(30deg); }
}
@keyframes hookSet {
  0% { transform: scale(0) rotate(-10deg); }
  60% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes lineSnap {
  0% { opacity: 1; transform: scaleX(1); }
  30% { opacity: 1; transform: scaleX(1.1); }
  50% { opacity: 0.8; clip-path: inset(0 50% 0 0); }
  100% { opacity: 0; transform: scaleX(0.5) translateY(20px); }
}
@keyframes fishLand {
  0% { transform: translate(0, 100px) scale(0.5); opacity: 0; }
  50% { transform: translate(0, -20px) scale(1.3); opacity: 1; }
  70% { transform: translate(0, 5px) scale(0.95); }
  100% { transform: translate(0, 0) scale(1); }
}
@keyframes surgeWarning {
  0% { transform: translateX(0); color: #ff8040; }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); color: #ff4040; }
  75% { transform: translateX(-4px); }
  100% { transform: translateX(0); color: #ff8040; }
}
```

### 1.3 Combat & Weapon Animations

| Action | Duration | Details |
|---|---|---|
| **Equip weapon** | 0.3s | Icon slides from bottom-right. Metallic glint flash. |
| **Unequip** | 0.25s | Icon slides down and out. |
| **Pistol fire** | 0.15s | Muzzle flash 20px yellow-white circle 0.05s. Recoil kick 8px up. Shell casing ejects right. Shake ±2px. |
| **Shotgun fire** | 0.3s | Flash 40px orange. Kick 15px. 6 spread lines. Shake ±8px. Knockback 3px. |
| **Minigun spin-up** | 1.5s | Icon rotates with increasing speed. Concentric circles at barrel. Vibration at full speed. |
| **Minigun fire** | Continuous | Flickering flash. Brass stream particles right. Constant vibration ±3px. |
| **RPG fire** | 0.3s + 1.5s flight | Orange backblast cone 0.2s. Red glowing dot with 10 smoke puffs/sec along path. Orange expanding circle 0→100px on impact. Gray smoke cloud 2s. |
| **Harpoon fire** | 0.4s | Arm sweeps. Line extends to impact. Water: splash + fishing trigger. Player: star + knockback 10px. |
| **Flare fire** | 0.2s + 3s arc | Pop flash. Red-orange dot arcs up then descends. Light radius 0→200px. Spark trail 5/sec. |
| **Water gun** | Continuous | Blue sine-wave particle stream. Splash on impact. Target gets blue tint 3s. |
| **Tranquilizer** | 0.2s | White puff at muzzle. Dart line projectile. Purple "💤" above target, float up, fade 5s. Target grays out and slumps. |
| **Nuke launch** | 5s total | Red pulsing border siren. Smoke cloud at feet. White dot arcs across sky 3s. White screen → mushroom cloud → shockwave ring → green fog. |
| **Melee punch** | 0.15s | Fist extends. White star burst. Knockback 5px. |
| **Taking damage** | 0.2s | White flash 1 frame → red tint 0.15s. Damage number floats red. Screen edge pulses red. |
| **Critical hit** | 0.3s | Damage flash + slow-mo 0.2s + "CRITICAL" yellow scale-up + 48px impact star + zoom 5% snap-back. |
| **Dodge** | 0.25s | Shift 20px. Afterimage ghost at 30% opacity fades 0.3s. Speed lines. |
| **Death** | 1.0s | Shrink 60%, rotate 90°, drop 10px. Desaturate 0→100% over 0.5s. "YOU DIED" red 48px fade-in. Ghost 👻 rises and fades. |
| **Respawn** | 0.8s | Sparkles coalesce. Fade 0→100%. Golden ring expands 50px. Invincibility shimmer 3s. |
| **Kill confirm** | 0.5s | 💀 center-screen scales 0→1.5→1.0. Kill feed slides from right. "+XP" gold floats. Streak counter + fire particles if applicable. |

```css
@keyframes muzzleFlash {
  0% { transform: scale(0); opacity: 1; }
  30% { transform: scale(1.5); opacity: 0.9; }
  100% { transform: scale(2); opacity: 0; }
}
@keyframes shellCasing {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(30px, 40px) rotate(180deg); opacity: 0; }
}
@keyframes deathCollapse {
  0% { transform: scale(1) rotate(0deg); opacity: 1; filter: saturate(1); }
  50% { transform: scale(0.8) rotate(45deg); opacity: 0.8; filter: saturate(0.3); }
  100% { transform: scale(0.6) rotate(90deg) translateY(10px); opacity: 0.5; filter: saturate(0); }
}
@keyframes respawnMaterialize {
  0% { transform: scale(0.3); opacity: 0; filter: brightness(3); }
  50% { transform: scale(1.1); opacity: 0.8; filter: brightness(1.5); }
  100% { transform: scale(1); opacity: 1; filter: brightness(1); }
}
@keyframes killConfirm {
  0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
  50% { transform: translate(-50%,-50%) scale(1.5); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
}
```

### 1.4 Survival & Bodily Function Animations

| Action | Duration | Details |
|---|---|---|
| **Eat (E)** | 0.4s | Food emoji shrinks 32→0 with bite marks. "nom nom" green text. Hunger gauge needle whips. Green +heal particles. |
| **Drink (V)** | 0.35s | Bottle tips. Blue droplets. "glug" blue text. Thirst bar rises like liquid fill. |
| **Beer chug** | 0.8s | Beer tilts 90°. Foam overflow particles. Sway starts. "🍺 CHEERS" gold 36px. All gauges whip simultaneously with spring overshoot. Sobriety slams zero with 3-bounce needle. |
| **Piss (P)** | 2s loop | Yellow arc stream particles. Steam on ground contact. Meter drains. Puddle grows 0→20px yellow circle. Other players near puddle slip. |
| **Shit (O)** | 1.5s | Crouch 70%. Red strain lines pulse. 💩 drops behind player. Meter drains. "Ahh..." relief-green. Nearby players get "Disgusted" green face 5s. |
| **Fart (G)** | 0.3s | Green-brown cloud 0→40px behind player, fades 0.5s. Nearby screens get green tint 0.3s. 10% campfire ignition chance (orange explosion, 5 dmg). |
| **Heart attack** | 2.0s | EKG line across screen: normal→irregular→flatline. Clutch chest (shrink+tilt). Red pulse rings ×3. Camera Dutch-tilts 15°. Heartbeat pulses then stops. |
| **Drowning** | 3.0s | Blue tint 0→80%. Bubbles rise from bottom. O2 bar depletes. Model bobs then sinks. Shake ±2px. "DROWNED" blue. |
| **Freezing** | Gradual | Blue tint increases. Frost crystals grow from screen edges. Shiver ±1px at 10Hz below 20%. Breath puffs every 2s. At 0: freeze solid, turn blue, shatter (ice particles). |
| **Overheating** | Gradual | Heat haze distortion. Sweat droplets. Red tint. Smoke wisps. At 0: spontaneous combustion (fire particles, death). |
| **Drunk** | 60s | Sinusoidal camera ±10px 0.5Hz. Hue rotate ±15° 2s cycle. Ghost cursor 150ms lag. Hiccup every 8–12s. Walking veers ±15°. Double vision (20% ghost offset 10px). |
| **Sit (T)** | 0.5s | Compress 50% height. Musical notes ♪ float up. Stress drains. "Ahh, peaceful..." soft blue italic after 3s. |

```css
@keyframes heartbeatLine {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes freezeShatter {
  0% { transform: scale(1); filter: hue-rotate(200deg) brightness(1.3); }
  50% { transform: scale(1.05); }
  51% { transform: scale(0); opacity: 0; }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes drunkSway {
  0% { transform: translateX(0) rotate(0deg); filter: hue-rotate(0deg); }
  25% { transform: translateX(10px) rotate(1deg); filter: hue-rotate(15deg); }
  50% { transform: translateX(0) rotate(0deg); filter: hue-rotate(0deg); }
  75% { transform: translateX(-10px) rotate(-1deg); filter: hue-rotate(-15deg); }
  100% { transform: translateX(0) rotate(0deg); filter: hue-rotate(0deg); }
}
@keyframes strainPulse {
  0%, 100% { transform: scale(1); border-color: #ff4040; }
  50% { transform: scale(1.03); border-color: #ff0000; }
}
```

### 1.5 Vehicle Animations

| Action | Duration | Details |
|---|---|---|
| **Enter vehicle** | 0.3s | Slide to vehicle. Door-open visual. Vehicle squash 95%, spring back. |
| **Exit vehicle** | 0.3s | Pop out to side. Vehicle bobs up. |
| **Driving** | Continuous | Vibrate ±1px. Exhaust gray puffs 3/sec. Tire dust on dirt. Speed lines at high speed. |
| **Braking** | 0.5s | Tire screech marks (black on ground). Vehicle pitches 3° forward. Dust cloud on dirt. |
| **Honk (H)** | 0.3s | Semicircle waves emanate forward ×3. "HONK" white bold, scale up, fade. Nearby entities get "!" reaction. |
| **Off cliff** | Variable | Slow rotation in air. Arms-up emoji. Impact: 20 dust particles, bounce (squash 70%, spring ×2). Water: 30 splash particles, model sinks to 0 over 3s. |
| **Rowing** | 0.7s loop | Alternating oar dips. V-wake behind. Boat rocks ±3°. |
| **Motorboat** | Continuous | Large V-wake. Spray at bow. Vibration. Rooster tail spray at stern. |
| **Raft** | Gentle | Drift rotation ±5° over 10s. No wake. Creak lines on edges. Blue water seep particles. |
| **Vehicle explode** | 1.5s | Fire 0→80px. Black smoke billows 30s. 6 debris particles fly outward. Player ejected up. Burning wreck 60s. |

### 1.6 UI & Menu Animations

| Action | Duration | Details |
|---|---|---|
| **Menu open** | 0.3s | Scale 0.92→1.0. Backdrop blur 0→8px. Opacity 0→1. |
| **Menu close** | 0.25s | Reverse. Snappier. |
| **Button hover** | 0.3s | translateX(5–10px). Border gold. BG lightens. Gold shimmer sweep (::before). |
| **Button click** | 0.1s | Scale 0.95, flash bright, scale back 1.0. |
| **Tab switch** | 0.2s | Old slides left, new slides from right. Active tab gold fill left-to-right wipe. |
| **Notification** | 0.25s in, 4s hold, 1s out | Slide up from +10px, opacity 0→1, overshoot -3px. Auto-fade. |
| **XP gain** | 0.5s | Bar fills smooth. "+XP" gold pops. Level up: bar flashes, resets, "LEVEL UP!" 28px + 12 gold sparkles. |
| **Achievement** | 1.5s in, 5s hold | Dark banner from top 80px tall. Icon bounces. Gold border shimmer. Auto-slides out. |
| **Item pickup** | 0.3s | Icon scales 0→1.2→1.0 in slot. Border flashes gold. "+1" pops. |
| **Item use** | 0.3s | Icon shrinks to 0. Sparkles replace. Slot dims. |
| **Gauge needle** | 0.4s | Spring physics: overshoot 10%, oscillate back 3× with decreasing amplitude. |
| **Stat bar** | 0.3s | Smooth width transition. Gaining: green flash. Losing: red flash. Critical <20%: blinks. |
| **Minimap ping** | 0.6s | Concentric circles expand from location. Gold=chest, red=danger, blue=player, green=fish. |
| **Countdown** | 1s/tick | Number scales 10% per tick. <5: red, faster pulse, edge tint. 0: white flash, trigger. |
| **Chat message** | 0.2s | Slide from left, opacity 0→1. Username gold. Body cream. Auto-fades 8s. |
| **Kill feed** | 0.3s | Slide from right. 💀 between names. Fades 5s. |
| **Server announce** | 0.5s in, 5s, 0.5s out | Center text, dramatic font. Dark band BG. Gold border top/bottom. Pulse while visible. |

### 1.7 Environmental & Particle Animations

| Effect | Details |
|---|---|
| **Rain** | 200 line particles (2×15px, blue). Fall 45° angle. Splash dots on water. Ground darkens 10%. |
| **Snow** | 150 circle particles (3px, white, 60% opacity). Sinusoidal drift. Ground whitens over 5 min. |
| **Fog** | Layered semi-transparent rects (20–60% opacity). Moves 0.5px/frame left-to-right. Thicker near water. |
| **Thunder** | White flash 0.05s. Shake ±4px 0.5s. Jagged lightning bolt white line 0.1s with 3 branches. |
| **Wind** | 30 white streak particles horizontal. Speed = wind strength. Trees lean. Water ripples align. |
| **Aurora** | Wavy green/purple/blue bands top 20% screen. Undulate 0.1Hz. Hue shifts. 10% opacity. |
| **Fireflies** | 20–40 yellow dots (2px). Independent sinusoidal paths. 6px glow halo 20% opacity. Blink 1–3s intervals. |
| **Campfire** | Orange-yellow triangle particles rise. Random height flicker. Ember dots rise and fade. Light radius pulses ±10%. Gray smoke circles rise/expand/fade. |
| **Geyser idle** | Blue bubble particles rise. White steam wisps. Every 30s: minor burst (particles accelerate 0.5s). |
| **Geyser erupt** | 50-particle water column 0.5s. Steam cloud 0→200px at top. Spray falls parabolically. Shake ±6px 1s. |
| **Water surface** | White highlight patches 5% opacity slow drift. Reflection: flipped draw + sine distortion. |
| **Lava** | Orange-red surface + dark moving Perlin patches. Bubbles expand/pop 0→10px 0.5s. Warm glow radius. Heat shimmer above. |
| **Bioluminescence** | Scattered glow spots pulse independently 0.5–2s. Teal/purple/blue. Fish leave glow trails. |
| **Nuke cloud** | Phase 1: white flash 0.5s. Phase 2: fireball 0→100px 1.5s. Phase 3: stem rises + cap expands 3s. Phase 4: smoke dissipates 25s. Shockwave ring across screen 1s. |
| **Radioactive glow** | Green outline pulse 1s (50–100% opacity). 3–5 orbiting green particles. Ground green tint. |

### 1.8 Screen Transitions

| Transition | Duration | Details |
|---|---|---|
| **Game start** | 1.0s | Black fades to transparent. Title fades out. Idle animation begins. |
| **Respawn** | 0.5s+0.5s | Fade to white, reposition, fade back. Sparkle burst. |
| **Biome change** | 2.0s | Sky/water/ground colors cross-fade. Old particles fade, new fade in. |
| **Day→Night** | 120s game | Sky blue→orange→purple→black. Stars fade in. Moon rises. Shadows lengthen. |
| **Night→Day** | 120s game | Pink-orange dawn glow. Birds fly. Stars fade. Fog may form. |
| **Server restart** | 3.0s | Glitch (row displacement 0.5s). Static noise 1s. "RESTARTING..." 1s. Clean fade in. |
| **Enter building** | 0.5s | Circular mask closes in. Interior revealed with own lighting. |
| **Pause** | 0.3s | Freeze frame. Dark overlay 50%. Menu slides in. |

---

## 2. Expanded Fish Bestiary

**Total species: 127** across all biomes and 5 rarity tiers. Expands v2.0 §3.3.

### 2.1 Common Fish (Tier 1 — White — 45% catch rate) — 25 Species

| # | Name | Icon | Weight | Biome | Bait | Fight | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Bluegill | 🐟 | 0.5–3 lb | Lake | Worm | ★☆☆☆☆ | Starter. Barely fights. |
| 2 | Perch | 🐟 | 1–5 lb | Lake | Corn | ★☆☆☆☆ | 30% chance catch 2. |
| 3 | Sardine | 🐟 | 0.2–1 lb | Ocean | Minnow | ★☆☆☆☆ | 50% chance of 3. |
| 4 | Catfish | 🐱 | 3–15 lb | Lake, Swamp | Cheese | ★★☆☆☆ | Night-active. |
| 5 | Carp | 🐟 | 5–25 lb | Lake | Corn | ★★☆☆☆ | Mud cloud on catch. |
| 6 | Sunfish | 🌞 | 0.3–2 lb | Lake | Worm | ★☆☆☆☆ | Gold sparkle on catch. |
| 7 | Anchovy | 🐟 | 0.1–0.5 lb | Ocean | Trash | ★☆☆☆☆ | Schools of 5. |
| 8 | Herring | 🐟 | 0.5–2 lb | Ocean, Fjord | Minnow | ★☆☆☆☆ | Silver flash. |
| 9 | Tilapia | 🐟 | 1–4 lb | Lake, Tropical | Corn | ★☆☆☆☆ | Good XP/lb. |
| 10 | Smelt | 🐟 | 0.1–0.4 lb | Frozen Lake | Worm | ★☆☆☆☆ | Ice holes only. |
| 11 | Goby | 🐟 | 0.2–1 lb | Coral Reef | Trash | ★☆☆☆☆ | Hides in coral. |
| 12 | Mullet | 🐟 | 1–6 lb | Mangrove, Swamp | Minnow | ★☆☆☆☆ | Jumps when hooked. |
| 13 | Shad | 🐟 | 0.5–3 lb | River | Minnow | ★☆☆☆☆ | More common in rain. |
| 14 | Chub | 🐟 | 1–4 lb | River, Lake | Cheese | ★☆☆☆☆ | Eats anything. |
| 15 | Dace | 🐟 | 0.3–2 lb | River | Worm | ★☆☆☆☆ | Fast, weak. |
| 16 | Bream | 🐟 | 1–6 lb | Lake | Corn | ★★☆☆☆ | Bottom feeder. Better w/ weighted hook. |
| 17 | Gudgeon | 🐟 | 0.1–0.3 lb | River | Worm | ★☆☆☆☆ | Tiniest. "Really?" on catch. |
| 18 | Rudd | 🐟 | 0.5–3 lb | Lake | Corn | ★☆☆☆☆ | Gold-red coloring. |
| 19 | Roach | 🐟 | 0.3–2 lb | River, Lake | Worm | ★☆☆☆☆ | Everywhere. The pigeon of fish. |
| 20 | Minnow (catch) | 🐟 | 0.05–0.2 lb | All freshwater | Worm | ★☆☆☆☆ | Usable as bait after catch. Recursive fishing. |
| 21 | Blue Crab | 🦀 | 2–5 lb | Lake, Ocean | Steak | ★★☆☆☆ | Pinches (+5% tension per pinch). |
| 22 | Hermit Crab | 🐚 | 0.5–2 lb | Beach, Tropical | Trash | ★☆☆☆☆ | 15% chance trinket inside. |
| 23 | Crawdad | 🦞 | 0.3–1 lb | Swamp, River | Steak | ★☆☆☆☆ | Mud-colored. |
| 24 | Frog | 🐸 | 0.3–1.5 lb | Swamp, Lake | Worm | ★☆☆☆☆ | Hops out. "Ribbit" text. |
| 25 | Sea Snail | 🐌 | 0.2–0.8 lb | Ocean, Coral | Trash | ★☆☆☆☆ | Slow reel. 10% shell trinket. |

### 2.2 Uncommon Fish (Tier 2 — Green `#44dd88` — 25% catch rate) — 30 Species

| # | Name | Icon | Weight | Biome | Bait | Fight | Notes |
|---|---|---|---|---|---|---|---|
| 26 | Largemouth Bass | 🐟 | 3–12 lb | Lake | Fancy Lure | ★★☆☆☆ | Classic. Jumps during fight. |
| 27 | Smallmouth Bass | 🐟 | 2–8 lb | River, Lake | Minnow | ★★☆☆☆ | Faster than largemouth. |
| 28 | Rainbow Trout | 🌈 | 2–10 lb | River, Frozen | Fancy Lure | ★★☆☆☆ | Rainbow sparkle on catch. |
| 29 | Brown Trout | 🐟 | 3–15 lb | River | Minnow | ★★★☆☆ | Sneaky. Low bite, bigger. |
| 30 | Northern Pike | 🐟 | 5–25 lb | Lake, Frozen | Minnow | ★★★☆☆ | Aggressive surges. Teeth visual. |
| 31 | Walleye | 🐟 | 3–15 lb | Lake | Fancy Lure | ★★☆☆☆ | Night-active. Glowing eyes. |
| 32 | Red Snapper | 🔴 | 4–20 lb | Ocean, Coral | Steak | ★★☆☆☆ | Red flash on catch. |
| 33 | Flounder | 🐟 | 2–12 lb | Ocean | Minnow | ★★☆☆☆ | Flat. Slides along bottom. Weird visual. |
| 34 | Striped Bass | 🐟 | 5–30 lb | Ocean, River | Fancy Lure | ★★★☆☆ | Strong. Line-stripes visual. |
| 35 | Drum | 🥁 | 5–20 lb | Lake, River | Steak | ★★☆☆☆ | Drumming sound cue on bite. |
| 36 | Crappie | 🐟 | 0.5–3 lb | Lake | Minnow | ★★☆☆☆ | Paper-thin. Sideways fight. |
| 37 | Muskie | 🐟 | 10–40 lb | Lake | Fancy Lure | ★★★☆☆ | "Fish of 10,000 casts." Rare bite, huge reward. |
| 38 | Yellowtail | 🟡 | 5–25 lb | Ocean | Minnow | ★★★☆☆ | Fast. Burns stamina quick. |
| 39 | Grouper | 🐟 | 10–50 lb | Ocean, Coral | Steak | ★★★☆☆ | Heavy. Dives into rocks (tension spikes). |
| 40 | Barracuda | 🐟 | 5–20 lb | Tropical, Coral | Glowstick | ★★★☆☆ | Speed bursts. Bites weak line. |
| 41 | Coconut Crab | 🥥 | 5–10 lb | Tropical | Steak | ★★☆☆☆ | Island shores. Crunching visual. |
| 42 | Salmon | 🍣 | 5–30 lb | River, Frozen | Fancy Lure | ★★★☆☆ | Leaps upstream. Autumn seasonal. |
| 43 | Mackerel | 🐟 | 2–8 lb | Ocean | Minnow | ★★☆☆☆ | Fast. 40% double catch. |
| 44 | Sea Bass | 🐟 | 3–15 lb | Ocean | Steak | ★★☆☆☆ | Solid fighter. Reliable XP. |
| 45 | Piranha | 🦷 | 0.5–3 lb | Jungle River | Steak | ★★★☆☆ | Swarms of 3–5. Each fought briefly. Can damage line. |
| 46 | Gar | 🐊 | 5–30 lb | Swamp, River | Minnow | ★★★☆☆ | Ancient. Armor-plated (longer fight). |
| 47 | Sturgeon | 🐟 | 10–60 lb | River, Lake | Worm | ★★★☆☆ | Dinosaur fish. Bottom hugger. Needs weighted hook. |
| 48 | Koi | 🎏 | 3–15 lb | Lake (buildings) | Corn | ★★☆☆☆ | Multiple color variants. Collector's fish. |
| 49 | Pufferfish | 🐡 | 1–5 lb | Tropical, Coral | Trash | ★★☆☆☆ | Inflates 3x on catch. 10% poison. |
| 50 | Seahorse | 🦄 | 0.1–0.5 lb | Coral, Tropical | Ectoplasm | ★☆☆☆☆ | Magical sparkle trail. |
| 51 | Snapping Turtle | 🐢 | 10–35 lb | Swamp | Steak | ★★★☆☆ | Bites hook hard (+20% instant tension). Shell armor in brawl. |
| 52 | Paddlefish | 🏓 | 20–60 lb | River | Minnow | ★★★☆☆ | Bizarre snout. Bites rarely but worth it. |
| 53 | Tench | 🐟 | 2–10 lb | Lake, Swamp | Worm | ★★☆☆☆ | Slimy. Harder to grip in brawl (-15% brawl damage). |
| 54 | Arctic Char | ❄️ | 3–15 lb | Frozen Lake, Fjord | Minnow | ★★☆☆☆ | Cold-water only. Ice crystal particles. |
| 55 | Dorado | ✨ | 10–40 lb | Tropical, Ocean | Fancy Lure | ★★★☆☆ | Brilliant gold-green. "Mahi-mahi" in catch log. Jumps repeatedly. |

### 2.3 Rare Fish (Tier 3 — Blue `#4488ff` — 15% catch rate) — 30 Species

| # | Name | Icon | Weight | Biome | Bait | Fight | Notes |
|---|---|---|---|---|---|---|---|
| 56 | Swordfish | ⚔️ | 50–200 lb | Deep Ocean | Steak | ★★★★☆ | Charges (+30% tension instant). |
| 57 | Blue Marlin | 🏆 | 100–500 lb | Deep Ocean | Fancy Lure | ★★★★☆ | Multiple breach QTEs. Trophy. |
| 58 | Bluefin Tuna | 🔵 | 50–300 lb | Ocean | Steak | ★★★★☆ | Sustained runs drain tension capacity. |
| 59 | Electric Eel | ⚡ | 10–40 lb | Swamp, Abyss | Charged Uranium | ★★★★☆ | Shocks player (-10HP, screen static). |
| 60 | King Crab | 👑 | 15–30 lb | Frozen, Deep Ocean | Steak | ★★★☆☆ | Crush attacks in brawl. |
| 61 | Lobster | 🦞 | 3–15 lb | Ocean | Steak | ★★★☆☆ | Tail-flip escapes. |
| 62 | Octopus | 🐙 | 5–30 lb | Ocean, Abyss | Ectoplasm | ★★★☆☆ | Ink cloud (2s dark). Eight-arm QTE. |
| 63 | Manta Ray | 🦅 | 30–100 lb | Ocean, Tropical | Minnow | ★★★★☆ | Wide sweeping runs. Beautiful catch. |
| 64 | Hammerhead | 🔨 | 50–200 lb | Ocean | Steak | ★★★★☆ | Damages boat. |
| 65 | Moray Eel | 🐍 | 5–25 lb | Coral, Abyss | Steak | ★★★☆☆ | Ambush. Venomous (poison status). |
| 66 | Stingray | ⚠️ | 10–50 lb | Tropical, Ocean | Minnow | ★★★☆☆ | Sting in brawl (-15HP). Sand burial. |
| 67 | Arapaima | 🐟 | 50–200 lb | Jungle River | Steak | ★★★★☆ | Massive freshwater. Armor scales. Dramatic breach. |
| 68 | Coelacanth | 🦴 | 30–80 lb | Abyss | Ectoplasm | ★★★★☆ | Living fossil. 10x gold value. |
| 69 | Anglerfish | 💡 | 5–20 lb | Abyss | Glowstick | ★★★☆☆ | Lure visual. Jumpscare (mouth opens wide). |
| 70 | Sailfish | ⛵ | 30–100 lb | Tropical | Fancy Lure | ★★★★☆ | Fastest fish. Burns tension insanely. Spectacular sail. |
| 71 | Oarfish | 📏 | 20–80 lb | Deep Ocean, Abyss | Ectoplasm | ★★★★☆ | Extremely long visual. "Sea serpent." |
| 72 | Giant Squid | 🦑 | 40–150 lb | Abyss | Ectoplasm | ★★★★☆ | Tentacle QTEs. Ink escape. |
| 73 | Wolffish | 🐺 | 10–40 lb | Frozen, Deep Ocean | Steak | ★★★☆☆ | Terrifying teeth. Aggressive brawl. |
| 74 | Nautilus | 🐚 | 2–5 lb | Abyss | Ectoplasm | ★★★☆☆ | Spiral shell. High collector gold. |
| 75 | Jellyfish | 🪼 | 1–10 lb | Ocean, Tropical | Glowstick | ★★☆☆☆ | Stings (-5HP). Translucent glow. |
| 76 | Spider Crab | 🕷️ | 10–20 lb | Deep Ocean | Steak | ★★★☆☆ | Absurd long legs. Hilarious visual. |
| 77 | Ocean Sunfish | 🌞 | 50–200 lb | Ocean | Trash | ★★★☆☆ | Enormous, stupid. Low fight, massive weight. Derpy. |
| 78 | Flying Fish | ✈️ | 1–3 lb | Tropical | Fancy Lure | ★★★☆☆ | Launches airborne during fight. Reel while flying. |
| 79 | Lionfish | 🦁 | 1–5 lb | Coral, Tropical | Glowstick | ★★★☆☆ | Venomous spines. Beautiful. Poison on catch. |
| 80 | Tiger Shark | 🐯 | 50–250 lb | Ocean, Tropical | Steak | ★★★★☆ | Ambush predator. Bites at line directly. |
| 81 | Mako Shark | 🦈 | 40–200 lb | Deep Ocean | Steak | ★★★★☆ | Fastest shark. Speed surges. |
| 82 | Giant Catfish | 🐱 | 40–150 lb | Swamp, River | Cheese | ★★★★☆ | Enormous. Drags player into water (camera shift). |
| 83 | Greenland Shark | 🧊 | 50–200 lb | Frozen, Abyss | Steak | ★★★★☆ | Slowest shark but strongest. Centuries old. |
| 84 | Mantis Shrimp | 🦐 | 0.5–2 lb | Coral | Steak | ★★★★☆ | Punches with 1500N force. Instant +40% tension. Rainbow visual. |
| 85 | Giant Isopod | 🐛 | 2–5 lb | Abyss | Trash | ★★★☆☆ | Deep-sea pillbug. Curls into ball during brawl (immune to damage 3s). |

### 2.4 Legendary Fish (Tier 4 — Purple `#aa44ff` — 8% catch rate) — 22 Species

| # | Name | Icon | Weight | Biome | Bait | Fight | Notes |
|---|---|---|---|---|---|---|---|
| 86 | Golden Koi | ✨ | 5–20 lb | Lake (sacred pool) | Corn | ★★★★☆ | +50% XP 5 min. Gold particle trail. |
| 87 | Ghost Shark | 👻 | 30–100 lb | Abyss (night) | Ectoplasm | ★★★★★ | Semi-transparent. Phase-shifts (line passes through; time reels). |
| 88 | Plutonium Pufferfish | ☢️ | 3–10 lb | Volcanic, Crater | Plutonium | ★★★★☆ | Green glow. 5% mini-nuke on catch. |
| 89 | Radioactive Crab | ☢️ | 8–15 lb | Crater, Volcanic | Uranium | ★★★★☆ | Critical Irradiation on catch. Radiation brawl damage. |
| 90 | Abyssal Angler | 🌑 | 10–40 lb | Abyss | Glowstick | ★★★★☆ | Hypnotic light (screen sway). Terrifying. |
| 91 | Frost Wyrm | 🧊 | 40–120 lb | Frozen (deep) | Charged Uranium | ★★★★★ | Freezes line (can't reel 2s periodic). Ice particles. |
| 92 | Magma Eel | 🔥 | 15–50 lb | Volcanic | Enriched Plut. | ★★★★★ | Burns line (-20% tension cap). Fire particles. Melts hooks. |
| 93 | Phantom Sailfish | 👤 | 50–150 lb | Ocean (fog only) | Ectoplasm | ★★★★★ | Vanishes/reappears. Teleport surges. |
| 94 | Diamond Sturgeon | 💎 | 30–100 lb | River (deep) | Fancy Lure | ★★★★☆ | Crystalline scales. Drops diamond trinket. |
| 95 | Void Octopus | 🕳️ | 20–60 lb | Abyss | Ectoplasm | ★★★★★ | Ink is a portal (swaps your position randomly). 8-phase QTE. |
| 96 | Storm Marlin | ⛈️ | 100–400 lb | Ocean (storms) | Charged Uranium | ★★★★★ | Only during thunderstorms. Lightning strikes line periodically (-20HP). |
| 97 | Coral Titan | 🪸 | 80–200 lb | Coral (deep) | Steak | ★★★★★ | Covered in living coral. Each surge spawns small fish that distract (fake bite indicators). |
| 98 | Lava Crab | 🌋 | 15–40 lb | Volcanic | Enriched Plut. | ★★★★★ | Shell is molten rock. Burns line. Immune to brawl for first 5s. |
| 99 | Chrono Trout | ⏰ | 5–15 lb | Lake (dawn/dusk only) | Fancy Lure | ★★★★☆ | Reverses time: undoes last 10s of fight progress. Must outpace it. |
| 100 | Prism Jellyfish | 🌈 | 3–8 lb | Ocean | Glowstick | ★★★★☆ | Refracts light (rainbow particles everywhere). Heals player 25HP on catch. |
| 101 | Bone Fish | 💀 | 1–5 lb | Swamp (night) | Ectoplasm | ★★★★☆ | Undead fish. Keeps fighting after stamina hits 0 (second health bar). |
| 102 | Thunder Eel | ⛈️ | 20–60 lb | Swamp (storms) | Charged Uranium | ★★★★★ | AOE shock (all nearby players take 10HP). Charges the water. |
| 103 | Mimic Chest Fish | 📦 | 10–30 lb | All | Any | ★★★★☆ | Looks like a chest loot pull — surprise! It's a fish. Bites back. |
| 104 | Plague Carp | 🦠 | 5–25 lb | Swamp | Trash | ★★★★☆ | Contagious: "Plague" status spreads to nearby players for 60s (-2HP/10s to all). |
| 105 | Gilded Whale Shark | 👑 | 200–600 lb | Deep Ocean | Steak | ★★★★★ | Gentle giant. Doesn't fight hard but takes 5+ min to reel due to mass. |
| 106 | Moonfish | 🌙 | 10–30 lb | All (full moon) | Ectoplasm | ★★★★☆ | Only on full moon nights. Silver glow. +100% XP. |
| 107 | Cursed Catfish | 😈 | 5–40 lb | Swamp | Ectoplasm | ★★★★☆ | On catch: random negative status effect (drunk, irradiated, soiled, or freezing). |

### 2.5 Mythic Fish (Tier 5 — Gold `#ffd700` — 2% catch rate) — 20 Species

| # | Name | Icon | Weight | Biome | Bait | Fight | Notes |
|---|---|---|---|---|---|---|---|
| 108 | The Philosopher Fish | 🧠 | 1 lb | Lake (center) | None (thinks) | ★☆☆☆☆ | Auto-catches after 60s of idle fishing. Grants permanent +10% XP. Speaks in chat: random philosophy quote. |
| 109 | The Wish Fish | 🌟 | 0.5 lb | Sacred Pool | Corn | ★☆☆☆☆ | Heals all stats, cures all status effects, refills all ammo, repairs all gear. Once-per-server catch. |
| 110 | The Leviathan's Tooth | 🦷 | 500 lb | Abyss (floor) | Enriched Plut. | ★★★★★ | Not a fish. Literal tooth. Equippable as melee weapon (1-hit kill). |
| 111 | Elder Kraken Spawn | 🦑 | 100–300 lb | Abyss | Fusion Bait | ★★★★★ | Baby kraken. 3-phase fight. Drops "Kraken Ink" (unlimited stealth item). |
| 112 | Solar Flare Fish | ☀️ | 10–30 lb | Volcanic (noon) | Enriched Plut. | ★★★★★ | Blinds all players on server for 3s on catch. Drops "Sunstone" trinket (+50% warmth). |
| 113 | Nuclear Whale | ☢️ | 1000–3000 lb | Crater biome | Fusion Bait | ★★★★★ | A whale mutated by nuclear fallout. Fight lasts 10+ min. On catch: clears all radiation on server. |
| 114 | The Golden God | 👑 | 7777 lb | Any (0.01% base) | Any | ★★★★★ | Rarest fish. Server-wide golden rain for 5 min. All players get +200% XP. Title unlocked: "God Fisher." |
| 115 | Dimensional Trout | 🌀 | 3–∞ lb | Abyss (midnight) | Ectoplasm | ★★★★★ | Weight changes randomly during fight (oscillates wildly). Final weight determines tier retroactively. |
| 116 | Beer Fish | 🍺 | 5–15 lb | Any | Any | ★★★★★ | A fish literally made of beer. Full stat restore + 30s drunk + drops 5 beer items. Server message: "It's... beautiful." |
| 117 | Anti-Fish | ⬛ | -10 lb | Abyss | Nothing equipped | ★★★★★ | Negative weight. Removes 10 lbs from total. But grants "Void Walker" title + permanent dark vision. |
| 118 | The Tax Fish | 💰 | 1 lb | Lake (near buildings) | Corn | ★★★★☆ | Takes 50% of your gold. But grants a "Tax Exempt" trinket (permanent +100% gold from all sources). |
| 119 | Mecha-Shark | 🤖 | 200–500 lb | Ocean | Charged Uranium | ★★★★★ | Cybernetic. Fires lasers during fight (dodge QTEs). Drops "Laser Rod" attachment. |
| 120 | The Grandpa Fish | 👴 | 2 lb | Lake | Worm | ★☆☆☆☆ | Ancient. Tells a story in chat (3 lines of procedural lore). Grants "Wisdom" buff: +25% all stats for 10 min. |
| 121 | Plague Leviathan | 🦠 | 500–1500 lb | Swamp (deep) | Ectoplasm | ★★★★★ | Everyone on server gets Plague. Only cure: catching it. 5-phase fight. |
| 122 | The Fish of Tomorrow | 🔮 | ??? lb | Any (2% at dawn) | Any | ★★★★★ | Reveals all fish locations on minimap for 10 min. Weight = player level × 10. |
| 123 | Uranium Leviathan | ☢️ | 800–2000 lb | Crater | Fusion Bait | ★★★★★ | Irradiates a 500-unit radius permanently. Drops 10x Enriched Plutonium. |
| 124 | Ghost of Catches Past | 👻 | = your best fish weight | Any (night) | Ectoplasm | ★★★★★ | A phantom of your previous best catch. Beating it grants permanent +1 rod tier effective bonus. |
| 125 | The Immortal Jellyfish | ♾️ | 0.01 lb | Ocean (deep) | Glowstick | ★★★★★ | Grants "Immortal" status: next death is negated (consumed on use). |
| 126 | Cosmic Whale | 🌌 | 10000 lb | Abyss (max depth) | Fusion Bait | ★★★★★ | The final fish. 20-min fight. On catch: credits roll. Then game continues. Permanent title: "Master of the Lake." |
| 127 | The Perfectly Normal Fish | 🐟 | 3 lb | Lake | Worm | ★☆☆☆☆ | Looks completely normal. Description: "Something is wrong with this fish." Nothing happens. Or does it? (Hidden: +1% to all stats permanently, stackable, no notification.) |

---

## 3. Boss & Leviathan Encounters

**20 total bosses.** Expands v2.0 §3.2 from 5 to 20. Each boss has a unique multi-phase fight, dedicated UI, and server-wide impact.

### 3.1 Biome Bosses (One per biome — 16 Bosses)

| # | Boss | Biome | Weight | Stamina | Phases | Special Mechanic | Drop |
|---|---|---|---|---|---|---|---|
| 1 | 🐋 **The Ancient Whale** | Deep Ocean | 2000–5000 lb | 500 | 3 | Drags camera underwater. Must surface (W) or drown. Tail slam QTE every 20s. | Whale Bone Rod (Tier 6) |
| 2 | 🦑 **Kraken of the Depths** | Abyss | 800–2000 lb | 400 | 4 | Tentacle QTEs (press displayed key within 1.5s). Ink blinds screen 3s. Grabs line and pulls. | Kraken Ink (stealth consumable) |
| 3 | 🐊 **Old Ironskin** | Swamp | 600–1200 lb | 350 | 2 | Charges shore (dodge A/D 0.8s). Armor plating = first 30% of fight deals 50% reduced damage. | Ironscale Hook |
| 4 | 🦈 **The Crimson Fin** | Open Water | 400–900 lb | 300 | 2 | Cuts line if tension >60% for 3s. Blood trail in water (attracts smaller sharks that nip line). | Crimson Lure (+50% shark catch) |
| 5 | 🐉 **Loch Ness Larry** | Lake Center | 3000–8000 lb | 600 | 5 | Reel→Wrestle→Breach QTE→Wrestle→Final Reel. Server-wide earthquake (screen shake all players). | Larry's Scale (trinket, +30% all fish weight) |
| 6 | 🧊 **The Glacier Serpent** | Frozen Lake | 1500–3000 lb | 450 | 3 | Freezes water around player (movement locked 3s periodic). Ice wall phase: must break ice blocks (mash R) before reeling. Blizzard intensifies during fight. | Frostbite Line (never snaps from cold) |
| 7 | 🌋 **Magma Leviathan** | Volcanic Springs | 2000–4000 lb | 500 | 4 | Lava eruptions during fight (dodge zones on screen). Line catches fire periodically (reel through fire = -5HP/s). Molten armor phase: immune until cooled (press V to splash water). | Magma Core (craft ingredient, +200% enriched plutonium yield) |
| 8 | 🌊 **The Tsunami Eel** | Fjord | 800–1800 lb | 350 | 3 | Creates massive waves (screen tilts 20° periodic). Tidal surge pulls player toward water (mash W to resist). Electric discharge + water = AOE 50 units. | Storm Rod (Tier 7, lightning damage) |
| 9 | 🦠 **The Plague Mother** | Toxic Marsh | 500–1000 lb | 300 | 3 | Spawns plague clouds (green zones on screen, avoid or take -3HP/s). Splits into 3 smaller fish at 30% HP (fight all three simultaneously). Infects server with mild plague. | Plague Cure (cures all status effects server-wide) |
| 10 | 🌸 **The Blossom Koi** | Sacred Grove | 400–800 lb | 250 | 2 | Pacifist boss: doesn't attack. Instead, heals itself +5% HP every 3s. Pure DPS check. Petal particles obscure vision. Beauty increases stress relief. | Cherry Rod (heals 1HP per fish caught) |
| 11 | 🏜️ **The Sand Leviathan** | Desert Oasis | 1000–2500 lb | 400 | 3 | Burrows underground. Sandstorm phase: can't see line. Earthquake tremors (random tension spikes). Breaches from sand, not water. | Desert Hook (works on land — can fish from sand) |
| 12 | 🪸 **The Coral Colossus** | Coral Reef | 1500–3000 lb | 450 | 4 | Covered in living reef. Spawns defensive fish swarms (must punch through). Coral spikes periodically = +15% tension. At 50% HP, retreats into reef (must navigate maze QTE). | Coral Crown (trinket, +2x fish in coral biome) |
| 13 | 🌿 **The Kelp Titan** | Kelp Forest | 600–1400 lb | 350 | 3 | Wraps line in kelp (must mash R to tear through). Camouflage phase: fish disappears into kelp, must find real one among 5 decoys (click correct one). | Kelp Line (regenerates 1% durability/10s) |
| 14 | 🌌 **The Void Leviathan** | Abyss (max depth) | 5000–10000 lb | 800 | 6 | The hardest boss. Complete darkness. Only see by bioluminescence pulses every 2s. Gravity inverts periodically. Dimensional tears swap your controls. Final phase: must reel in complete darkness with inverted controls while dodge-QTEing. | Void Rod (Tier 8 — the ultimate rod) |
| 15 | ☢️ **The Nuclear Titan** | Crater Biome | 3000–6000 lb | 600 | 4 | Irradiates everything in 300 units (Critical Irradiation to all). Mini-nuke detonations during fight (dodge red circles). At 25% HP: self-destruct countdown (30s to finish or server-wide nuke). | Titan Core (craft 3 nukes instantly) |
| 16 | 🏝️ **The Island Turtle** | Tropical Islands | 8000–15000 lb | 1000 | 5 | A turtle so large it IS an island. Players on the island don't know they're standing on it. Phase 1: the island moves. Phase 2: it dives (all players on it fall into water). Phase 3–5: standard but at enormous scale. Longest fight in game (15–20 min). | Turtle Shell Armor (reduces all damage 50%) |

### 3.2 World Bosses (4 Server-Wide Event Bosses)

These spawn on a server-wide timer and require **multiple players** cooperating to defeat.

| # | Boss | Trigger | Weight | HP | Players Needed | Mechanic | Reward (all participants) |
|---|---|---|---|---|---|---|---|
| 17 | 🌊 **The World Serpent** | Every 60 min | 50000 lb | 10000 | 10+ | A serpent that circles the entire world map. Multiple fishing spots along its body. Each player hooks a different segment. Must coordinate reeling to pull it in simultaneously. Server-wide water level rises during fight. | "Serpent Slayer" title, 1000 gold, Legendary rod |
| 18 | ☄️ **The Meteor Fish** | Random (2% per hour) | 25000 lb | 5000 | 5+ | A fish falls from the sky. Impact creates new crater biome. Must be hooked mid-air during descent (1 player) then all others help reel. Flaming throughout fight. | "Starfall" title, Meteor Rod (fire damage), 5 Enriched Plutonium |
| 19 | 👹 **Cthulhu's Nephew, Steve** | Midnight on Friday (real time) | 100000 lb | 20000 | 20+ | Tentacles erupt from every body of water simultaneously. Each player fights a tentacle. When enough tentacles are subdued, Steve surfaces at the Abyss for a final confrontation. Insanity mechanic: screen distorts more the longer you fight. | "Sanity Optional" title, Eldritch Rod (drives nearby fish insane — auto-catch radius), 10000 gold |
| 20 | 💀 **Death Itself** | When server heart attack kills 100 total players | 666 lb | 6666 | 1 (solo) | A skeletal fish that only one player can fight. Everyone else spectates. The chosen player is whoever died most recently to a heart attack. Death phases: Denial (controls inverted), Anger (screen shakes constantly), Bargaining (fish offers to let you win if you give up your best rod), Depression (all color drains), Acceptance (normal fight, you win). | "Cheated Death" title, Immortality Trinket (immune to heart attacks permanently), All stats permanently maxed |

### 3.3 Boss UI Framework

Every boss encounter activates a dedicated boss UI overlay:

```css
#boss-overlay {
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%);
  z-index: 600; pointer-events: none;
}
#boss-nameplate {
  position: fixed; top: 8%; left: 50%; transform: translateX(-50%);
  font-family: 'Playfair Display', serif; font-size: 42px; font-style: italic;
  text-shadow: 0 0 30px currentColor; animation: bossNameIn 1s ease;
}
#boss-hp-bar {
  position: fixed; top: 14%; left: 20%; width: 60%; height: 24px;
  background: rgba(0,0,0,0.6); border: 2px solid currentColor;
}
#boss-hp-fill {
  height: 100%; transition: width 0.3s;
  background: linear-gradient(90deg, var(--boss-color-dark), var(--boss-color-light));
}
#boss-phase-indicator {
  position: fixed; top: 18%; left: 50%; transform: translateX(-50%);
  font-size: 14px; letter-spacing: 3px;
}
@keyframes bossNameIn {
  0% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); }
  60% { opacity: 1; transform: translateX(-50%) translateY(5px) scale(1.05); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
```

Each boss has a unique `--boss-color-dark` and `--boss-color-light`:

| Boss | Dark | Light | Nameplate Color |
|---|---|---|---|
| Ancient Whale | `#1a3a5a` | `#4a8acc` | `#6ab4ff` |
| Kraken | `#2a1a3a` | `#8a4acc` | `#b46aff` |
| Old Ironskin | `#3a2a1a` | `#8a6a4a` | `#cc9966` |
| Crimson Fin | `#5a1a1a` | `#cc4a4a` | `#ff6666` |
| Loch Ness Larry | `#1a3a2a` | `#4acc6a` | `#66ff88` |
| Glacier Serpent | `#1a2a3a` | `#8ac4e8` | `#b0e0ff` |
| Magma Leviathan | `#3a1a0a` | `#ff6a20` | `#ff9040` |
| Tsunami Eel | `#0a2a3a` | `#30a0d0` | `#50d0ff` |
| Plague Mother | `#1a2a10` | `#6aaa30` | `#90dd40` |
| Blossom Koi | `#3a1a2a` | `#e090b0` | `#ffb0d0` |
| Sand Leviathan | `#3a2a10` | `#d4a040` | `#ffc850` |
| Coral Colossus | `#2a1a1a` | `#e06060` | `#ff8888` |
| Kelp Titan | `#0a2a1a` | `#40a060` | `#60cc80` |
| Void Leviathan | `#0a0a1a` | `#4040aa` | `#6060ff` |
| Nuclear Titan | `#1a2a0a` | `#a0cc30` | `#c0ff40` |
| Island Turtle | `#1a2a20` | `#60b080` | `#80dda0` |
| World Serpent | `#1a1a2a` | `#6060cc` | `#8888ff` |
| Meteor Fish | `#2a1a0a` | `#e08020` | `#ffa040` |
| Steve | `#1a0a2a` | `#9030a0` | `#c040dd` |
| Death Itself | `#0a0a0a` | `#606060` | `#ffffff` |

---

## 4. Rod & Tackle Expansion

**15 rod tiers** (up from 5 in v2.0 §4.2), plus 12 hooks and 10 line types.

### 4.1 Rod Tiers

| Tier | Name | Icon | Reel Speed | Tension Cap | Cast Range | Special | Source |
|---|---|---|---|---|---|---|---|
| 1 | Twig Rod | 🪵 | 1.0x | 100% | 50 units | None. It's a stick. | Starting |
| 2 | Bamboo Rod | 🎋 | 1.1x | 105% | 60 units | Slightly flexible. +5% bite rate. | Crafted (3x Junk) |
| 3 | Fiberglass Rod | 🎣 | 1.3x | 115% | 75 units | Reliable. Unlocks medium fish fights. | Level 5 / Chests |
| 4 | Graphite Rod | ⚫ | 1.5x | 125% | 90 units | Lightweight. +10% reel speed when fatigued. | Level 10 / Chests |
| 5 | Carbon Fiber Rod | 🖤 | 1.7x | 135% | 100 units | Required for Leviathans. Excellent all-around. | Level 15 / Rare chests |
| 6 | Whale Bone Rod | 🦴 | 1.9x | 145% | 110 units | Ancient Whale drop. +20% damage to boss fish. | Boss drop |
| 7 | Storm Rod | ⛈️ | 2.0x | 150% | 120 units | Tsunami Eel drop. Casts call down lightning (stuns fish 1s). | Boss drop |
| 8 | Titanium Rod | 🔩 | 2.2x | 160% | 130 units | Unbreakable line. Tension cap cannot be reduced by effects. | Legendary chests |
| 9 | Crystal Rod | 💎 | 2.4x | 170% | 140 units | Transparent. Fish can't see rod (+25% bite rate). | Craft (Diamond Sturgeon scale + Titanium Rod) |
| 10 | Magma Rod | 🌋 | 2.6x | 180% | 150 units | Burns fish on contact (-10% fish stamina/s passive). Immune to freeze effects. | Magma Leviathan drop |
| 11 | Cherry Rod | 🌸 | 2.0x | 140% | 100 units | Blossom Koi drop. Heals 1HP per fish caught. Stress -50% while equipped. | Boss drop |
| 12 | Eldritch Rod | 🐙 | 2.8x | 190% | 160 units | Steve drop. Auto-catches common fish in 30-unit radius. Whispers during use. | Boss drop |
| 13 | Meteor Rod | ☄️ | 3.0x | 200% | 175 units | Meteor Fish drop. Fire trail on cast. Fish take burn damage. Casts are visually spectacular. | Boss drop |
| 14 | Void Rod | 🕳️ | 3.5x | 250% | 200 units | Void Leviathan drop. The ultimate rod. Can fish in any biome as if you're in every biome simultaneously. Casts create mini black holes that pull fish. | Boss drop |
| 15 | The Omega Rod | 👑 | 4.0x | 300% | 250 units | 0.1% drop from Cosmic Whale only. Glows gold. Guaranteed legendary+ catch every 10th cast. Fish bow before it. | Mythic drop |

### 4.2 Hooks (12 Types)

| Hook | Effect | Source |
|---|---|---|
| Basic Hook | No bonus. | Starting |
| Barbed Hook | Fish can't unhook below 10% tension. | Uncommon loot |
| Weighted Hook | +20% depth access. | Chests |
| Lure Hook | +15% bite frequency. | Crafted/loot |
| Radioactive Hook | +30% rare/legendary chance, line degrades 2x. | Craft w/ Uranium |
| The Meathook | +50% brawl damage, -10% reel speed. | Legendary drop |
| Ironscale Hook | Old Ironskin drop. +25% tension cap. | Boss drop |
| Frost Hook | Slows fish movement 20%. Ice particles on line. | Frozen chests |
| Venom Hook | Poison tick on fish (-2% stamina/s). Green drip visual. | Coral/Swamp loot |
| Golden Hook | +50% gold from all catches. Shiny. | Gold chests rare |
| Quantum Hook | 5% chance to catch 2 fish at once (any tier). | Dimensional Trout drop |
| Void Hook | Ignores fish armor phases. Bypasses boss immunities for 2s. | Craft w/ Void Rod fragment |

### 4.3 Line Types (10 Types)

| Line | Strength | Visibility | Speed | Special | Source |
|---|---|---|---|---|---|
| Monofilament | 100% | Normal | 1.0x | Default. | Starting |
| Braided | 130% | High | 1.0x | Stronger but fish see it easier (-10% bite). | Shop |
| Fluorocarbon | 110% | Low | 1.0x | Invisible to fish (+15% bite rate). | Shop |
| Steel Leader | 200% | Very high | 0.8x | Shark-proof. Required for shark species. | Chests |
| Spider Silk | 150% | Very low | 1.2x | Best all-around. Rare. | Tropical loot |
| Kelp Line | 120% | Low | 1.0x | Kelp Titan drop. Regenerates 1% durability/10s. | Boss drop |
| Frostbite Line | 140% | Normal | 1.0x | Glacier Serpent drop. Immune to cold/freeze. | Boss drop |
| Magma Wire | 160% | High | 0.9x | Immune to fire/burn. Glows red. | Volcanic loot |
| Quantum String | 180% | None | 1.3x | Exists in superposition. 3% chance to phase through obstacles. | Abyss rare |
| Void Thread | 250% | None | 1.5x | Cannot break. Period. Only obtainable once. | Void Leviathan drop |

### 4.4 Reel Types (6 Types)

| Reel | Speed | Special | Source |
|---|---|---|---|
| Manual Crank | 1.0x | Default. Reliable. | Starting |
| Spinning Reel | 1.25x | Smoother tension management (±5% dampening). | Shop/Chests |
| Baitcaster | 1.4x | Higher speed but backlash risk (5% chance per cast to tangle, 2s to fix). | Level 8 |
| Electric Reel | 1.6x | Auto-reels at base speed. Consumes battery item. | Rare chests |
| Hydraulic Reel | 2.0x | Can reel in boss fish at normal speed. Very heavy (-15% cast range). | Boss loot |
| Quantum Reel | 2.5x | Reels fish backward through time (fight progress doesn't decay). | Chrono Trout drop |

---

## 5. Biome Expansion

**16 total biomes** (up from 6 in v2.0 §5.1). Each biome has unique visuals, color palette, fish pools, environmental hazards, vegetation, weather patterns, and a boss.

### 5.1 Biome Master Table

| # | Biome | Sky Color | Water Color | Ground Color | Ambient | Hazard | Unique Resource | Boss |
|---|---|---|---|---|---|---|---|---|
| 1 | **Lake** | `#87CEEB` | `#4A90C4` | `#3A5A2A` | Birds, crickets | None | Worm bait | Loch Ness Larry |
| 2 | **Swamp** | `#5A6A50` | `#2A4A20` | `#3A3A20` | Frogs, mosquitoes, fog | Mosquito drain (-1HP/30s) | Ectoplasm | Old Ironskin |
| 3 | **Ocean** | `#6AB4E8` | `#1A4A8A` | `#D4C8A0` (sand) | Waves, gulls | Drowning risk | Pearls | Crimson Fin |
| 4 | **Deep Ocean** | `#3A5A7A` | `#0A2A4A` | N/A (no ground) | Whale songs | Pressure (-1HP/10s deep) | Abyssal Pearls | Ancient Whale |
| 5 | **Volcanic Springs** | `#8A4A30` | `#6A2A10` | `#2A1A0A` | Rumbling, hissing | Heat damage (-2HP/10s) | Plutonium | Magma Leviathan |
| 6 | **Frozen Lake** | `#C0D8E8` | `#8AB0C8` | `#E8E8F0` | Wind howl, ice creak | Cold damage (-1HP/10s) | Ice Crystals | Glacier Serpent |
| 7 | **Abyss** | `#0A0A1A` | `#050510` | `#0A0A0A` | Silence + distant groans | Total darkness, pressure | Void Fragments | Void Leviathan |
| 8 | **Coral Reef** | `#70C8E8` | `#30A0C0` | `#E8D0A0` (sand) | Bubbles, fish chatter | Coral cuts (-3HP on collision) | Coral Fragments | Coral Colossus |
| 9 | **River** | `#80B8D0` | `#4080A0` | `#4A6A3A` | Rushing water, birds | Current pushes player | River Stones | None (shared) |
| 10 | **Tropical Islands** | `#60D0F0` | `#20B0D0` | `#E8D8A0` (beach) | Parrots, waves | Sunburn (+heat over time) | Coconuts | Island Turtle |
| 11 | **Fjord** | `#7090A0` | `#3060A0` | `#5A5A4A` (rock) | Wind, echoes | Avalanche events (dodge) | Viking Artifacts | Tsunami Eel |
| 12 | **Toxic Marsh** | `#4A5A30` | `#3A4A10` (sickly) | `#2A3A10` | Bubbling, coughing | Poison gas clouds (-3HP/5s) | Toxic Sludge | Plague Mother |
| 13 | **Desert Oasis** | `#E8C880` | `#60A080` (turquoise) | `#D4B060` (sand) | Wind, distant thunder | Dehydration (thirst drains 2x) | Desert Glass | Sand Leviathan |
| 14 | **Sacred Grove** | `#90C0A0` | `#60A880` (jade) | `#305030` | Chimes, wind through leaves | None (peaceful) | Sacred Petals | Blossom Koi |
| 15 | **Kelp Forest** | `#4080A0` | `#204020` (dark green) | `#2A3A2A` | Creaking, bubbles | Kelp entanglement (slow) | Kelp Fiber | Kelp Titan |
| 16 | **Crater Biome** | `#6A8A40` (green haze) | `#40603A` (irradiated) | `#3A3A30` (scorched) | Geiger clicks, wind | Radiation (all tiers) | Enriched Plutonium | Nuclear Titan |

### 5.2 Biome Transition Zones

Between biomes, there are **gradient zones** (50-unit wide strips) where:
- Colors interpolate between adjacent biome palettes over the zone
- Fish from both biomes can appear
- Weather transitions smoothly
- Vegetation cross-fades

### 5.3 Biome Weather Interactions

Each biome modifies the global weather system:

| Biome | Clear | Rain | Storm | Fog | Snow | Heat Wave |
|---|---|---|---|---|---|---|
| Lake | Default | +30% fish | +Boss chance | +Rare chance | Converts to Frozen | +Sunburn |
| Swamp | +Mosquitoes | +Fog chain | +Elec. Eel chance | Default | N/A | +Poison gas |
| Ocean | Calm seas | Rough waves | Massive waves, -50% visibility | Ghost fish appear | N/A | +Tropical fish |
| Frozen | Ice thickens | Ice melts (easier fishing) | Blizzard (-80% vis) | Ice fog | Default | Thaw event (unique fish) |
| Volcanic | Eruption risk | Steam explosions | Lava rain (dodge!) | Toxic steam | N/A | Default |
| Abyss | Biolum. active | Current surge | Pressure waves | Ink cloud | N/A | Thermal vents active |
| Sacred Grove | Cherry blossoms | Healing rain (+1HP/10s) | Dramatic but harmless | Mystical (see spirits) | Magical snow (XP+) | Bloom event (+rare) |
| Crater | Green aurora | Acid rain (-1HP/5s) | Nuclear storm (radiation++) | Fallout fog | N/A | Meltdown risk |

---

## 6. Vegetation & Flora System

**42 vegetation types** rendered as canvas shapes with per-biome palettes, procedurally placed via noise density maps.

### 6.1 Trees (12 Types)

| Name | Biome(s) | Size | Interactive | Notes |
|---|---|---|---|---|
| Oak Tree | Lake, River | 40px | Shade reduces sunburn | Birds land on it |
| Pine Tree | Frozen, Fjord, Lake | 45px | Blocks wind | Snow on branches |
| Willow Tree | Lake, Swamp | 50px | Stress relief aura | Fronds sway in wind |
| Dead Tree | Swamp, Crater | 30px | None | Crows perch. Spooky. |
| Mangrove | Swamp, Tropical | 35px | +10% bite near roots | Roots above/below water |
| Palm Tree | Tropical, Desert | 40px | Coconut drops (E = food) | Sways in wind extra |
| Bamboo Cluster | Sacred Grove, Tropical | 25px | Harvestable (Bamboo Rod craft) | 3–5 per cluster |
| Cherry Blossom | Sacred Grove | 40px | Petal particles in wind | Most beautiful tree |
| Birch Tree | Lake, Frozen, Fjord | 35px | Bark = kindling | White trunk |
| Petrified Tree | Crater, Desert | 35px | Harvestable (stone) | Ancient stone tree |
| Bonsai Tree | Sacred Grove | 8px | Decoration | Near buildings |
| Sunflower Tree | Lake | 20px | Follows sun direction | Bees orbit it |

### 6.2 Ground Cover & Flowers (15 Types)

| Name | Biome(s) | Interactive | Notes |
|---|---|---|---|
| Tall Grass | Lake, River, Swamp | Crouch = stealth +20% | Sways, rustles |
| Cattails | Lake, Swamp, River | Harvestable (kindling) | Water's edge only |
| Fern | Lake, River, Tropical | None | Lush ground cover |
| Moss | Swamp, Frozen, Fjord | Slippery (-10% control) | Covers rocks/tree bases |
| Mushroom | Swamp, Sacred Grove | Food (10% hallucination) | Glows in dark |
| Glowing Mushroom | Abyss, Swamp (night) | Light source | Main Abyss visibility |
| Toxic Flower | Toxic Marsh | -1HP/10s proximity | Poison puffs every 5s |
| Sacred Lotus | Sacred Grove | Sit for 2x stress relief | On Sacred pools only |
| Water Lily | Lake, Sacred Grove | Harvestable (Sacred Petals) | Glows at dusk |
| Lily Pads | Lake, Swamp | +5% bite underneath | Frogs sit on them |
| Lavender | Lake, Sacred Grove | -1 stress/10s aura | Purple particles |
| Radioactive Weed | Crater | Mild radiation proximity | Mutated, weird shapes |
| Snow Drift | Frozen | -20% movement speed | Accumulates in snowfall |
| Tumbleweed | Desert | Physics object (blows with wind) | Rolls across screen |
| River Reeds | River | +10% bite nearby | Along riverbanks |

### 6.3 Aquatic & Underwater Flora (8 Types)

| Name | Biome(s) | Interactive | Notes |
|---|---|---|---|
| Kelp Stalk | Kelp Forest, Ocean | Blocks line of sight | 60px tall, sways with current |
| Seaweed | Ocean, Kelp Forest | Fish hide in it | Floats at surface |
| Coral (Brain) | Coral Reef | -2HP collision | Bioluminescent at night |
| Coral (Staghorn) | Coral Reef | +15% bite rate nearby | Branches sway |
| Coral (Fan) | Coral Reef | Blocks current | Purple fan shape |
| Bioluminescent Algae | Abyss, Ocean (night) | Light source | Pulses gently |
| Driftwood | Beach, Lake shore | Harvestable (Junk/kindling) | Washed up on shores |
| Vine Tangle | Tropical, Swamp | Obscures vision | Hangs from tall trees |

### 6.4 Mineral & Special (7 Types)

| Name | Biome(s) | Interactive | Notes |
|---|---|---|---|
| Crystal Formation | Frozen, Abyss | Harvestable (Ice Crystal) | Refracts light, prismatic |
| Obsidian Spike | Volcanic, Crater | -5HP collision | Reflects firelight |
| Volcanic Vent Plant | Volcanic | Heat source (+warmth) | Red-black twisted |
| Cactus (Saguaro) | Desert | -3HP collision (needles) | Classic silhouette |
| Cactus (Barrel) | Desert | Water inside (thirst item) | 1 water charge |
| Sand Dune | Desert | Blocks line of sight | Wind reshapes over time |
| Hanging Icicle | Frozen, Fjord | -3HP if walked under (falls) | Drips. Dangles from overhangs. |

### 6.5 Rendering

```javascript
// Density: perlinNoise(x*0.01, y*0.01) * biomeDensityMultiplier
// Culling: only render within player view radius
// Wind: canopy/stalk offsets = windStrength * sin(time * windFreq) * flexibility
// Season: spring=bright, summer=deep, autumn=orange/red, winter=bare/snow
```

---

## 7. Weapon Arsenal

**32 total weapons** across 6 categories (up from 8 in v2.0).

### 7.1 Pistols (5)

| Weapon | Dmg | Rate | Range | Ammo | Special |
|---|---|---|---|---|---|
| Starter Pistol 🔫 | 10 | Med | Med | 30 | Default. Reliable. |
| Revolver 🤠 | 25 | Slow | Med | 6 | Long reload (spin anim). |
| Desert Eagle 🦅 | 35 | Slow | Long | 7 | Massive recoil. Gold variant cosmetic. |
| Dual Pistols 🔫🔫 | 8×2 | V.Fast | Med | 60 | Akimbo. Volume over precision. |
| Water Pistol 💧 | 0 | Fast | Short | ∞ | Fills target thirst. Kindness weapon. |

### 7.2 Shotguns (4)

| Weapon | Dmg | Rate | Range | Ammo | Special |
|---|---|---|---|---|---|
| Pump Shotgun 💥 | 60 | Slow | Short | 8 | Knockback 20u. Kills shallow fish 30u cone. |
| Double Barrel 🪓 | 80 | V.Slow | Short | 2 | Both barrels at once. |
| Auto Shotgun 🔥 | 40 | Fast | Short | 12 | Less per shot, fires quickly. |
| Blunderbuss 🏴‍☠️ | 90 | V.Slow | V.Short | 1 | Fires random junk. Knockback 30u. Pirate themed. |

### 7.3 Rifles (5)

| Weapon | Dmg | Rate | Range | Ammo | Special |
|---|---|---|---|---|---|
| Hunting Rifle 🎯 | 50 | Slow | V.Long | 5 | Scope 3x. +100% dmg to surfaced fish. |
| Assault Rifle 🪖 | 15 | V.Fast | Long | 30 | 3-round burst mode. |
| Sniper Rifle 🔭 | 100 | V.Slow | Max | 3 | Scope 5x. One-shot full HP. Tracer visible. |
| Harpoon Rifle 🏹 | 40 | V.Slow | Long | 5 | Catches fish without rod (10% accuracy). |
| Tranq Rifle 💉 | 5 | Med | Long | 10 | Sleep 5s. Sleeping fish = auto-caught. |

### 7.4 Heavy Weapons (6)

| Weapon | Dmg | Rate | Range | Ammo | Special |
|---|---|---|---|---|---|
| Minigun 🔥 | 8/tick | Cont. | Med | 200 | 1.5s spin-up. Movement 20%. |
| RPG 🚀 | 100 AOE | V.Slow | Long | 3 | 15u explosion. Destroys chests. |
| Flamethrower 🔥🔥 | 5/tick+burn | Cont. | Short | 100 fuel | Sets fire 3HP/s for 5s. Ignites vegetation. Cooks fish. |
| Grenade Launcher 💣 | 70 AOE | Slow | Med | 6 | Bounces once. 10u radius. |
| Railgun ⚡ | 150 | V.Slow (3s charge) | Infinite | 5 cells | Pierces all in line. Beam lingers 0.5s. |
| Nuke Launcher ☢️ | ∞ | Once | Global | 1 nuke | See v2.0 §6.3. |

### 7.5 Melee Weapons (6)

| Weapon | Dmg | Speed | Special |
|---|---|---|---|
| Fists 👊 | 5 | Fast | Default. Can punch fish. |
| Fishing Rod (melee) 🎣 | 8 | Med | Whip attack. Damages rod durability. |
| Machete 🔪 | 20 | Fast | Cuts vegetation. +50% plant dmg. |
| Anchor ⚓ | 40 | V.Slow | Knockback 40u. Ground slam AOE 5u. |
| Leviathan's Tooth 🦷 | 999 | Med | One-hit kill. Mythic drop only. |
| Beer Bottle 🍺 | 15 | Fast | Breaks on impact (single use). "SMASH!" |

### 7.6 Special Weapons (6)

| Weapon | Dmg | Special |
|---|---|---|
| Flare Gun 🔴 | 10 | Illuminates 200u for 30s. Scares fish 100u. Signals on minimap. |
| Grappling Hook 🪝 | 0 | Attaches to terrain/vehicles. Pull yourself toward it. Mobility only. |
| Fishing Net 🥅 | 0 | Catches all common/uncommon fish in 20u radius. No fight. 3 uses. |
| Smoke Grenade 💨 | 0 | 30u smoke cloud 15s. Blocks vision. No bites in smoke. |
| Portable Campfire 🔥 | 0 | Warmth 20u radius. Cooks fish. Craft station. 5 min duration. |
| Radar Gun 📡 | 0 | Point at water: shows fish species/depth 10s. Recharges 30s. |

---

## 8. UI/UX Expansion

### 8.1 New HUD Panels

**Compass Bar (top center):**
```css
#compass-bar {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  width: 400px; height: 28px; background: var(--ui-bg);
  border: 1px solid var(--border); overflow: hidden;
  font-size: 10px; color: var(--cream); display: flex;
  align-items: center; justify-content: center;
}
```
- N/S/E/W markers scroll as player rotates.
- POI markers (chests, bosses, players, shops) as colored pips.
- Biome name below: "LAKE" → "SWAMP" transitions as you move.

**Health Bar (below compass):**
```css
#health-bar-wrap {
  position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
  width: 300px; height: 14px; background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,80,80,0.4);
}
#health-fill {
  height: 100%; background: linear-gradient(90deg, #ff4040, #ff8040);
  transition: width 0.3s;
}
```
- 100 HP max base. Flashes red when hit. Pulses at <20%.

**Hotbar (bottom center):**
```css
#hotbar {
  position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px; z-index: 200;
}
.hotbar-slot {
  width: 52px; height: 52px; background: var(--ui-bg);
  border: 2px solid var(--border); display: flex;
  align-items: center; justify-content: center; font-size: 28px;
  position: relative;
}
.hotbar-slot.active { border-color: var(--gold); box-shadow: 0 0 10px rgba(201,168,76,0.4); }
.hotbar-slot .slot-key {
  position: absolute; top: 2px; left: 4px; font-size: 9px; color: var(--gold);
}
```
- 8 slots (keys 1–8): rod, weapon, bait, consumables.
- Active slot = gold border glow. Scroll wheel cycles.

**Kill Feed (top right):**
```css
#kill-feed {
  position: fixed; top: 60px; right: 16px; width: 280px;
  display: flex; flex-direction: column; gap: 4px; z-index: 200;
}
.kill-entry {
  background: rgba(0,0,0,0.6); padding: 4px 10px; font-size: 11px;
  color: var(--cream); animation: killSlideIn 0.3s ease;
  border-left: 3px solid #ff4040;
}
```
- Shows kills, boss defeats, nukes, heart attacks. Auto-remove after 5s.

**Depth Meter (deep water):**
```css
#depth-meter {
  position: fixed; left: 16px; top: 50%; transform: translateY(-50%);
  width: 24px; height: 300px; background: var(--ui-bg);
  border: 1px solid var(--border);
}
```
- Vertical bar for current depth. Pressure danger = red zone at bottom.
- Fish silhouettes at depth levels when Radar Gun active.

### 8.2 Expanded Menu System

**Crafting Menu (press B):**
```css
#crafting-menu {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 650px; height: 500px; padding: 20px;
  background: linear-gradient(135deg, #1a1410, #2a1a10);
  border: 2px solid #d4a574; z-index: 300;
}
```
- Left panel: ingredient slots (drag from inventory).
- Right panel: available recipes based on current ingredients.
- Categories: Rods, Bait, Ammo, Tools, Nuclear.
- Craftable items glow gold. Missing = gray.

**Leaderboard (press L):**
- Tabs: Fish Caught, Biggest Fish, Total Weight, Bosses Killed, Deaths, Nukes Launched, Times Pissed.
- Top 10 per category. Your rank highlighted gold.

**Map Screen (press Tab):**
- Full-screen map: discovered biomes, POIs, chests, player positions.
- Fog-of-war for unexplored. Custom markers (up to 5) by clicking.
- Biome labels in their respective colors.

**Fishing Journal (press J):**
- Personal records: biggest per species, total per species, first catch dates.
- Completion % per biome. "Completionist" achievement for all 127.

### 8.3 Notification Toast System

```css
#toast-container {
  position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  pointer-events: none; z-index: 400;
}
.toast {
  padding: 8px 20px; font-size: 12px; color: var(--cream);
  background: var(--ui-bg); border: 1px solid var(--border);
  animation: toastIn 0.25s ease, toastOut 0.5s ease 3.5s forwards;
}
.toast-fish { border-left: 3px solid #4488ff; }
.toast-loot { border-left: 3px solid #ffd700; }
.toast-danger { border-left: 3px solid #ff4040; }
.toast-social { border-left: 3px solid #44dd88; }
.toast-boss { border-left: 3px solid #aa44ff; }
@keyframes toastIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; } }
@keyframes toastOut { from { opacity: 1; } to { opacity: 0; transform: translateY(-10px); } }
```

Types: fish catch, loot, damage, status, boss spawn, server announcement, join/leave, achievement, level up.

### 8.4 Radial Quick Menu (hold Q)

- 8 segments in circle around cursor.
- Segments: **Eat**, **Drink**, **Bait Select**, **Emote**, **Sit**, **Map Ping**, **Drop Item**, **Quick Craft**.
- Mouse over to highlight, release Q to select.
- 0.2s expand animation on open.

---

## 9. Color & Visual Identity System

### 9.1 Master Color Palette

```css
:root {
  /* Core */
  --gold: #c9a84c;
  --cream: #f0e8d0;
  --ui-bg: rgba(8, 16, 28, 0.88);
  --border: rgba(201, 168, 76, 0.35);

  /* Rarity tiers */
  --common: #cccccc;
  --uncommon: #44dd88;
  --rare: #4488ff;
  --legendary: #aa44ff;
  --mythic: #ffd700;

  /* Status effects */
  --health-red: #ff4040;
  --health-orange: #ff8040;
  --poison-green: #40cc40;
  --ice-blue: #80d0ff;
  --fire-orange: #ff6020;
  --radiation-green: #80ff40;
  --void-purple: #6040cc;

  /* Biome accents */
  --lake-blue: #4a90c4;
  --swamp-green: #4a6a30;
  --ocean-deep: #1a4a8a;
  --volcanic-red: #8a2a10;
  --frozen-white: #c0d8e8;
  --abyss-black: #0a0a1a;
  --coral-pink: #e06080;
  --tropical-cyan: #20b0d0;
  --desert-gold: #d4b060;
  --sacred-jade: #60a880;
  --crater-toxic: #6a8a40;
  --fjord-steel: #7090a0;
  --marsh-sickly: #4a5a30;
  --kelp-dark: #204020;

  /* Bodily functions */
  --piss: #e8d020;
  --shit: #7a4010;
  --blood: #8a1010;
  --vomit: #7a8a20;

  /* UI states */
  --hover-glow: rgba(201, 168, 76, 0.2);
  --active-glow: rgba(201, 168, 76, 0.4);
  --danger-glow: rgba(255, 64, 64, 0.3);
  --success-glow: rgba(68, 221, 136, 0.3);

  /* Time of day */
  --dawn-pink: #e8a0a0;
  --noon-bright: #fffff0;
  --dusk-orange: #e8a060;
  --midnight-deep: #0a0a20;
  --moonlight-silver: #c0c8d8;
}
```

### 9.2 Rarity Color Treatment

| Tier | Text | Border | BG Tint | Glow | Particle | Name Style |
|---|---|---|---|---|---|---|
| Common | `#ccc` | `rgba(200,200,200,0.3)` | None | None | White | Normal |
| Uncommon | `#44dd88` | `rgba(68,221,136,0.4)` | `rgba(68,221,136,0.05)` | Subtle green | Green sparkle | Normal |
| Rare | `#4488ff` | `rgba(68,136,255,0.5)` | `rgba(68,136,255,0.08)` | Blue pulse | Blue shimmer | Bold |
| Legendary | `#aa44ff` | `rgba(170,68,255,0.5)` | `rgba(170,68,255,0.1)` | Purple aura | Purple+gold | Bold+italic |
| Mythic | `#ffd700` | `rgba(255,215,0,0.6)` | `rgba(255,215,0,0.12)` | Golden radiance | Gold starburst | Bold+italic+glow |

### 9.3 Time-of-Day Color Grading

| Time | Sky Gradient | Water Tint | Shadow | Overlay |
|---|---|---|---|---|
| Dawn (5–7) | `#1a1040`→`#e8a0a0`→`#ffd0a0` | `+rgba(200,100,80,0.05)` | Purple | Pink wash |
| Morning (7–10) | `#80c0e8`→`#a0d8f0` | Clear | Blue | None |
| Noon (10–14) | `#60b0e8`→`#4090d0` | Clear | Dark | Slight bloom |
| Afternoon (14–17) | `#70a8d0`→`#e8c880` | `+rgba(200,160,60,0.03)` | Long warm | Golden hour |
| Dusk (17–19) | `#e8a060`→`#a04060`→`#402060` | `+rgba(200,80,40,0.08)` | Deep purple | Orange-red |
| Night (19–5) | `#0a0a20`→`#1a1a40` | `+rgba(40,60,100,0.1)` | Black | Dark blue, stars |

### 9.4 Damage Number Colors

| Source | Color | Animation |
|---|---|---|
| Normal | `#ff4040` | Float up, fade |
| Critical | `#ffd700` | Float up, scale 1.5x, shake |
| Poison | `#40cc40` | Float up, drip |
| Fire | `#ff8020` | Float up, embers |
| Ice | `#80d0ff` | Float up, snowflake |
| Radiation | `#80ff40` | Float up, glow pulse |
| Healing | `#44dd88` | Float up, + prefix |
| XP gain | `#ffd700` | Float up, star prefix |
| Gold gain | `#c9a84c` | Float up, coin prefix |

---

## 10. Emotes, Achievements & Cosmetics

### 10.1 Emote System (press Y to open wheel)

| # | Emote | Key | Visual | Duration |
|---|---|---|---|---|
| 1 | Wave | Y→1 | Hand wave. "👋" overhead. | 1.5s |
| 2 | Dance | Y→2 | Rhythmic bounce. "💃" + musical notes. | Loop |
| 3 | Laugh | Y→3 | Player shakes. "😂" overhead. | 2s |
| 4 | Cry | Y→4 | Blue tears stream. "😢" overhead. | 3s |
| 5 | Flex | Y→5 | Player expands 10%. "💪" overhead. | 2s |
| 6 | Salute | Y→6 | Player stands rigid. "🫡" overhead. | 1.5s |
| 7 | Sit | Y→7 | Same as T key sit. | Until cancelled |
| 8 | Point | Y→8 | Arrow toward cursor. "👉" overhead. | 2s |
| 9 | Celebrate | Y→9 | Confetti burst. "🎉" overhead. | 3s |
| 10 | Thumbs Up | Y→0 | "👍" overhead. | 1.5s |
| 11 | Vomit | Y→V | Green particle stream. "🤮". Nearby: Disgusted status. | 2s |
| 12 | Sleep | Y→Z | Player lies down. "💤" floats up. | Until cancelled |

### 10.2 Achievement System (50 Achievements)

| # | Achievement | Condition | Reward |
|---|---|---|---|
| 1 | First Catch | Catch first fish | 50 gold |
| 2 | Centurion | Catch 100 fish | 500 gold, "Centurion" title |
| 3 | Thousand Club | Catch 1000 fish | 2000 gold, "Fisher King" title |
| 4 | Perfect Cast | Land a perfect cast | 100 gold |
| 5 | Perfectionist | 100 perfect casts | Golden cast trail cosmetic |
| 6 | Size Matters | Catch fish >100 lbs | 300 gold |
| 7 | Whale Hunter | Catch fish >1000 lbs | "Whale Hunter" title |
| 8 | Completionist | All 127 species | "Master Angler" title, Rainbow rod skin |
| 9 | Boss Slayer | Defeat any boss | 500 gold |
| 10 | Boss Rush | All 16 biome bosses | "Boss Slayer" title, Boss trophy set |
| 11 | World Saver | World Boss kill participation | 1000 gold |
| 12 | Steve Survivor | Survive Cthulhu's Nephew | "Sanity Optional" title |
| 13 | Cheated Death | Defeat Death Itself | Immortality Trinket |
| 14 | Nuclear Option | Detonate a nuke | "Mad Scientist" title |
| 15 | Self-Nuker | Nuke yourself | "Einstein" title |
| 16 | Beer Run | Catch 50 beers | "Alcoholic" title, golden beer skin |
| 17 | Always Drunk | 30 min continuous drunk | Permanent slight sway toggle |
| 18 | Heart Survivor | Survive heart attack roll | 200 gold |
| 19 | Serial Pooper | 10 defecation events | "The Regular" title |
| 20 | Pacifist | 100 fish, 0 player kills | "Pacifist" title, dove familiar |
| 21 | Mass Murderer | Kill 100 players | "Menace" title, red name |
| 22 | Speedrun | Legendary fish in <10 min | "Speedrunner" title |
| 23 | Explorer | Visit all 16 biomes | Permanent POI reveal on map |
| 24 | Hoarder | 50 items simultaneously | Inventory +25 slots |
| 25 | Poverty | 0 gold, 0 items | "Rock Bottom" title, 100 pity gold |
| 26 | Radiation King | All 3 radiation tiers in 1 life | "Glowing" title, green tint toggle |
| 27 | Fish Puncher | Punch 50 fish | "Bare Knuckle" title, +10% punch dmg |
| 28 | Vehicle Enthusiast | Drive every vehicle type | "Road Warrior" title |
| 29 | Cliff Diver | Drive car off cliff into water | "Send It" title |
| 30 | Social Butterfly | 500 chat messages | "Chatty" title, gold chat text |
| 31 | Night Fisher | 50 fish between midnight–5AM | "Night Owl" title, dark vision |
| 32 | Storm Chaser | Fish during every weather type | "Storm Chaser" title |
| 33 | The One That Got Away | Lose a Mythic fish | "Haunted" title (ghost follows 10 min) |
| 34 | Full Collection | Own every rod tier | "Rod Collector" title, rainbow trail |
| 35 | Alchemist | Craft 50 items | "Alchemist" title, +10% yield |
| 36 | Bait Master | Use every bait type | All bait +10% effectiveness |
| 37 | Untouchable | Survive 10 heart attacks in a row | "Immortal Heart" title |
| 38 | Double Kill | 2 player kills within 3s | "Efficient" title |
| 39 | Team Player | Boss kill with 5+ players | "Team Player" title |
| 40 | Gross | Piss+shit+fart+vomit in 10s | "Disgusting" title, brown name |
| 41 | Pyromaniac | Set 20 things on fire | "Pyromaniac" title, fire trail |
| 42 | Deep Diver | Max Abyss depth | "Abyssal" title, bioluminescent outline |
| 43 | God Fisher | Catch The Golden God | "God Fisher" title, golden aura |
| 44 | Master of the Lake | Catch Cosmic Whale | "Master of the Lake" title |
| 45 | Secret Keeper | 10 Perfectly Normal Fish | "Something's Wrong" title |
| 46 | Philosopher | Catch The Philosopher Fish | Daily philosophy quote in chat |
| 47 | Immune | Use Immortality Trinket | "Second Chance" title |
| 48 | Serial Nuker | Detonate 10 nukes | "Oppenheimer" title, mushroom hat |
| 49 | Plaguebringer | Spread Plague to 20 players | "Patient Zero" title |
| 50 | **THE END** | All Mythic fish caught | "Legend" title, all stats +50%, golden everything |

### 10.3 Cosmetic System

**Hat Cosmetics (above player):**

| Hat | Source | Visual |
|---|---|---|
| None | Default | — |
| Fishing Hat | Starting | Small brim |
| Crown | "God Fisher" | Gold crown with gems |
| Viking Helm | Fjord exploration | Horned helmet |
| Mushroom Cap | Eat 10 mushrooms | Red spotted mushroom |
| Halo | "Pacifist" | Floating gold ring |
| Devil Horns | "Mass Murderer" | Red horns |
| Mushroom Cloud | "Serial Nuker" | Tiny nuke cloud |
| Void Crown | Void Leviathan kill | Purple-black pulsing |
| Santa Hat | December (real time) | Red with white trim |
| Party Hat | Achievement #50 | Striped cone |

**Trail Cosmetics (behind player while moving):**

| Trail | Source | Visual |
|---|---|---|
| None | Default | — |
| Dust | Default (on dirt) | Brown puffs |
| Sparkle | Uncommon rod+ equipped | Gold/silver sparkles |
| Rainbow | "Completionist" | Rainbow arc |
| Fire | "Pyromaniac" | Flame particles |
| Ice | Frozen biome mastery | Snowflake trail |
| Void | Void Rod equipped | Purple distortion |
| Bubbles | Underwater | Blue circles rising |

---

## 11. Weather & Time-of-Day Expansion

### 11.1 Weather Types (12)

| # | Weather | Duration | Freq | Visual | Gameplay Effect |
|---|---|---|---|---|---|
| 1 | ☀️ Clear | 5–15 min | 30% | Blue sky, bright | Default. No modifier. |
| 2 | ☁️ Cloudy | 5–10 min | 20% | Gray sky, dimmer | -10% sunburn. +5% common fish. |
| 3 | 🌧️ Rain | 3–8 min | 15% | Rain particles, dark, puddles | +30% bite rate. -20% visibility. Wet status. |
| 4 | ⛈️ Thunderstorm | 3–6 min | 8% | Rain+lightning+wind | +50% rare fish. Lightning strikes (-20HP). Electric fish +100%. |
| 5 | 🌫️ Fog | 5–10 min | 10% | Visibility → 50 units | Ghost fish appear. +Rare chance. Stealth +50%. |
| 6 | ❄️ Snow | 5–10 min | 5% | Snowflakes, white ground | Cold dmg ramp. Frozen fish. Movement -10%. |
| 7 | 🌪️ Tornado | 1–3 min | 2% | Funnel, debris | Players/vehicles thrown. Fish flee. Chests scattered. |
| 8 | 🌡️ Heat Wave | 5–10 min | 5% | Screen haze, bright | Heat dmg. Dehydration 2x. Volcanic fish migrate. |
| 9 | 🌊 Tsunami | 30s | 1% | Water rises 50 units | Shore players swim or retreat. Deep fish in shallows. |
| 10 | 🌈 Rainbow | 2–5 min | 3% (after rain) | Rainbow arc | +100% XP. +Mythic chance. Stress -2x. |
| 11 | ☄️ Meteor Shower | 2–4 min | 1% | Streaks across sky | Mini craters (uranium). Large impact = Meteor Fish boss. |
| 12 | ☢️ Nuclear Fallout | 3–5 min | Player-triggered | Green sky, radiation | All outdoor: radiation. Forces indoors/vehicles. |

### 11.2 Day/Night Cycle

- **Full cycle:** 24 in-game min = 24 real min (1 real min = 1 game hour).
- **Dawn (5–7):** Pink-orange sky. Bite rate ramps 50%→100%.
- **Day (7–17):** Normal. Peak bite at noon.
- **Dusk (17–19):** Orange-red. Nocturnal fish begin.
- **Night (19–5):** Dark. Stars, moon. Nocturnal/ghost/abyss fish active. Predators aggressive. Fireflies. Bioluminescence.
- **Moon phases:** Cycle every 7 real days. Full moon = Moonfish + 50% mythic chance.

---

## 12. NPC & Questline System

### 12.1 NPCs (8 Types)

| NPC | Location | Function | Dialogue Style |
|---|---|---|---|
| 🧔 Old Man Henderson | Lake dock | Tutorial, lore, hints | Grumpy but wise. Cryptic. |
| 🏪 Shop Keeper | General Store | Buy/sell bait, ammo, basic gear | Cheerful. Overcharges. |
| 🔧 Rod Smith | Workshop (Lake) | Repair, upgrade, craft rods | Technical. Loves rods. |
| 🧪 Dr. Isotope | Crater lab | Exotic bait, nuclear recipes | Mad scientist. Cackles. |
| 🏴‍☠️ Captain Hooks | Ocean dock | Boats, ocean gear, shark info | Pirate speak. Untrustworthy. |
| 🧘 The Sage | Sacred Grove | Meditation quests, lore | Peaceful. Koan-like. |
| 👻 The Ghost Fisher | Random (night) | Ghost quests, mythic hints | Sad. Wants "the one that got away." |
| 🤖 Robo-Vendor | Crater/Volcanic | Advanced tech, railgun ammo | Monotone. Glitches mid-sentence. |

### 12.2 Quest System (20 Quests)

| # | Quest | Giver | Objective | Reward |
|---|---|---|---|---|
| 1 | The First Cast | Henderson | Catch any fish | 50 gold, Bamboo Rod |
| 2 | Not Trash | Henderson | Catch a non-junk item | 100 gold |
| 3 | Bigger Fish | Henderson | Catch fish >10 lbs | 200 gold, Fiberglass Rod |
| 4 | Into the Deep | Captain Hooks | Fish in Deep Ocean | 300 gold, Steel Leader |
| 5 | Shock Therapy | Dr. Isotope | Catch Electric Eel | 500 gold, 5 Charged Uranium |
| 6 | Nuclear Ambitions | Dr. Isotope | Craft Enriched Plutonium | 1000 gold, Nuke blueprint |
| 7 | Peace and Quiet | The Sage | Sit 5 continuous min | 200 gold, Stress -20% permanent |
| 8 | Ghost Story | Ghost Fisher | Catch Ghost Shark | 800 gold, Ectoplasm ×20 |
| 9 | The One That Got Away | Ghost Fisher | Catch Cosmic Whale | Ghost passes on. Permanent ghost familiar. |
| 10 | Coral Collection | Shop Keeper | Bring 10 Coral Fragments | 400 gold, Coral Crown recipe |
| 11 | Rod Mastery | Rod Smith | Upgrade to Tier 5 | 500 gold, free Tier 6 upgrade |
| 12 | Arms Race | Captain Hooks | Own 5 weapons | 300 gold, Blunderbuss |
| 13 | Sacred Waters | The Sage | Catch Golden Koi | 600 gold, Sacred Lotus bait |
| 14 | Extinction Event | Dr. Isotope | Nuke every biome | 2000 gold, "Destroyer of Worlds" title |
| 15 | Iron Chef | Henderson | Cook 20 fish | 400 gold, cooking speed +50% |
| 16 | Plumber | Henderson | 5 defecation events | 300 gold, "The Regular" title |
| 17 | Vehicle Collector | Robo-Vendor | Drive every vehicle | 500 gold, custom paint job |
| 18 | Biome Mastery | The Sage | Catch boss in every biome | 5000 gold, "World Champion" title |
| 19 | Social Credit | Shop Keeper | Chat with 20 players | 200 gold, "Popular" title |
| 20 | **THE FINAL QUEST** | All NPCs (chain) | All 127 fish + all 20 bosses + all 16 biomes | "Legend of the Lake" title, custom rod skin, permanent stat bonuses |

---

## 13. Audio & Music System

### 13.1 Music Tracks (12)

| # | Track | Trigger | Style | Tempo | Instruments |
|---|---|---|---|---|---|
| 1 | "Still Waters" | Lake (day) | Gentle acoustic | 80 BPM | Guitar, piano, soft strings |
| 2 | "Midnight Cast" | Lake (night) | Ambient, haunting | 60 BPM | Piano, synth pad, crickets |
| 3 | "Bayou Blues" | Swamp | Slide guitar, murky | 70 BPM | Slide guitar, harmonica, bass |
| 4 | "Open Sea" | Ocean | Adventurous, sweeping | 100 BPM | Orchestral, brass, percussion |
| 5 | "Into the Void" | Abyss | Dark ambient, drones | 40 BPM | Sub-bass, reverb, distant echoes |
| 6 | "Frozen Horizon" | Frozen | Sparse, crystalline | 55 BPM | Celeste, strings, wind samples |
| 7 | "Magma Flow" | Volcanic | Intense, tribal | 110 BPM | Drums, bass, distorted guitar |
| 8 | "Cherry Petals" | Sacred Grove | Serene, Japanese-inspired | 65 BPM | Koto, flute, wind chimes |
| 9 | "Leviathan Rises" | Boss fight (any) | Epic, dramatic | 130 BPM | Full orchestra, choir, drums |
| 10 | "Cardiac Event" | Heart attack/restart | Flatline + chaos | Accel. | EKG beeps, alarms, distortion |
| 11 | "The Lake Theme" | Main menu | Nostalgic, warm | 75 BPM | Acoustic guitar, harmonica |
| 12 | "Credits Roll" | Cosmic Whale catch | Triumphant, emotional | 90 BPM | Full orchestra, building climax |

### 13.2 Sound Effects (40+)

**Fishing:**
| Sound | Trigger |
|---|---|
| Cast whoosh | Cast release |
| Water splash (light) | Bobber landing |
| Water splash (heavy) | Large fish breach |
| Line tension creak | Tension >70% |
| Line snap | Line break |
| Reel click | Each R press |
| Fish splash | Fish surface |
| Bite plunk | Fish bites |
| Victory fanfare (short) | Catch fish |
| Victory fanfare (epic) | Catch rare+ |

**Combat:**
| Sound | Trigger |
|---|---|
| Gunshot (per weapon type) | Fire weapon |
| Bullet impact | Hit player |
| Explosion (small) | Grenade/RPG |
| Explosion (nuclear) | Nuke detonation |
| Punch thwack | Melee hit |
| Siren | Nuke incoming |

**Survival:**
| Sound | Trigger |
|---|---|
| Eating crunch | Eat food |
| Drinking gulp | Drink |
| Beer chug + burp | Beer consumed |
| Piss stream | Piss action |
| Fart (3 variants) | Fart action |
| Heartbeat | Low health |
| Flatline | Heart attack |
| Freezing shiver | Cold damage |
| Fire crackle | Near campfire |

**Ambient:**
| Sound | Trigger |
|---|---|
| Birds (day) | Lake, River |
| Crickets (night) | Most biomes |
| Frogs | Swamp |
| Waves | Ocean, Tropical |
| Wind (varies) | All biomes |
| Thunder | Storm weather |
| Rain | Rain weather |
| Geiger counter | Crater biome |
| Whale song | Deep Ocean |
| Bubbles | Underwater |

**UI:**
| Sound | Trigger |
|---|---|
| Menu open | Open any menu |
| Button click | Click button |
| Item pickup | Loot acquired |
| Achievement jingle | Achievement unlock |
| Level up fanfare | Level up |
| Toast notification | New toast |

---

## 14. Status Effects Master List (30)

| # | Effect | Icon | Duration | Visual | Gameplay Impact | Cure |
|---|---|---|---|---|---|---|
| 1 | Healthy | ❤️ | Permanent | None | Default | — |
| 2 | Drunk | 🍺 | 60s | Camera sway, hue shift, double vision | Movement lag 150ms, veer ±15° | Wait |
| 3 | Mild Irradiation | ☢️ | 60s | Green tint | -1 HP/10s | Plague Cure, wait |
| 4 | Severe Irradiation | ☢️☢️ | 90s | Green tint + flicker | -2 HP/10s, controls invert 0.5s/10s | Plague Cure |
| 5 | Critical Irradiation | ☢️☢️☢️ | 120s | Green glow + flicker | -5 HP/10s, contagious 20u, inverts | Plague Cure or Wish Fish |
| 6 | Poisoned | 🐍 | 30s | Purple tint edges | -3 HP/5s | Antidote (craft) or campfire |
| 7 | Burning | 🔥 | 5s | Fire particles on player | -3 HP/s | Jump in water |
| 8 | Freezing | 🧊 | Until warm | Blue tint, frost edges | Movement -20%, HP drain at <10% warmth | Campfire, warm biome |
| 9 | Starving | 😫 | Until fed | Desaturated, edge dark | HP drain at 0 hunger, speed -30% | Eat food |
| 10 | Dehydrated | 🏜️ | Until drink | Yellow tint, blur | HP drain at 0 thirst, vision blur | Drink water |
| 11 | Exhausted | 😴 | Until rest | Dim overlay | Speed -50%, cast power max -50% | Sit, sleep, coffee |
| 12 | Stressed | 😰 | Until relieved | Screen pulse, shake | QTEs 20% faster (harder), bite -20% | Sit, Sacred Grove, beer |
| 13 | Soiled | 💩 | 30s | Brown cloud particles | Movement -30%, nearby: Disgusted | Wait |
| 14 | Disgusted | 🤢 | 5s | Green face tint | No eating, slight nausea sway | Wait |
| 15 | Sunburned | 🌞 | Until shade | Red skin tint | Heat drains faster, -10% all | Shade, clothing, night |
| 16 | Wet | 💧 | 30s post-water | Blue droplet overlay | Cold drains faster, +10% electric dmg taken | Campfire, wait |
| 17 | Caffeinated | ☕ | 30s | High contrast, jitter | Speed +20%, QTEs easier. Crash after: -20% 10s | Wait |
| 18 | Sugar Rush | 🍬 | 20s | Rainbow trail, bright | Speed +30%, sparkle. Crash: -20% 10s | Wait |
| 19 | Stung | 🪼 | 15s | Red spot | -5 HP initial, -1 HP/5s | Antidote |
| 20 | Asleep | 💤 | 5s | Gray, "💤" floating | Cannot move, act, or reel | Hit by player or wait |
| 21 | Insane | 🌀 | During Steve fight | Screen distortion ↑ | UI shifts, names scramble, controls shuffle | End the fight |
| 22 | Blessed | ✨ | 300s | Gold particle aura | +25% positive effects, -25% negative | — (buff) |
| 23 | Cursed | 😈 | 120s | Purple particle aura | Random negative effect every 30s | Wish Fish or Plague Cure |
| 24 | Plague | 🦠 | 60s | Green mist around player | -2 HP/10s, contagious 30u, contact spread | Plague Cure, Wish Fish, Plague Mother |
| 25 | Invincible | 🛡️ | 3s (respawn) | Gold shimmer outline | Cannot take damage | — (auto-expires) |
| 26 | Immortal | ♾️ | Until triggered | Faint golden outline | Next lethal damage negated (one-time) | — (consumed) |
| 27 | Void Walker | 🕳️ | Permanent | Dark purple tint option | Permanent dark vision, see in Abyss | — (permanent) |
| 28 | Wisdom | 🧠 | 600s | Faint blue aura | +25% all stats (from Grandpa Fish) | — (buff) |
| 29 | Tax Exempt | 💰 | Permanent | Gold coin orbits | +100% gold from all sources | — (permanent) |
| 30 | On Fire (literal) | 🔥🔥 | 10s | Full fire particle coverage | -10 HP/s, ignites vegetation, 3 HP/s to nearby players | Jump in water |

---

## 15. Implementation Priority Matrix

| Priority | Section | Effort | Dependencies |
|---|---|---|---|
| 🔴 **P0 — Core** | Animation system (§1) | High | Existing render loop |
| 🔴 **P0 — Core** | Fish bestiary first 50 (§2.1–2.2) | Medium | Fish spawn system |
| 🔴 **P0 — Core** | Rod tiers 1–5 (§4.1) | Low | Existing rod shop |
| 🔴 **P0 — Core** | Biomes 1–6 (§5.1) | High | Terrain generation |
| 🟠 **P1 — High** | Boss encounters 1–5 (§3.1) | High | Fish fight system, boss UI |
| 🟠 **P1 — High** | Weapons 1–15 (§7.1–7.3) | Medium | Combat system |
| 🟠 **P1 — High** | HUD panels (§8.1) | Medium | Canvas/DOM overlay |
| 🟠 **P1 — High** | Status effects 1–15 (§14) | Medium | Player state system |
| 🟡 **P2 — Medium** | Remaining fish 51–127 (§2.3–2.5) | High | §2.1–2.2 complete |
| 🟡 **P2 — Medium** | Boss encounters 6–16 (§3.1) | High | §3.1 first 5 |
| 🟡 **P2 — Medium** | Rod tiers 6–15 (§4.1) | Medium | Boss drops |
| 🟡 **P2 — Medium** | Vegetation system (§6) | Medium | Biome system |
| 🟡 **P2 — Medium** | Color system (§9) | Low | CSS variables |
| 🟡 **P2 — Medium** | Weather system (§11) | High | Time system, biomes |
| 🟢 **P3 — Low** | World bosses (§3.2) | Very high | Multiplayer, boss system |
| 🟢 **P3 — Low** | Emotes (§10.1) | Low | Player animation |
| 🟢 **P3 — Low** | Achievements (§10.2) | Medium | All game systems |
| 🟢 **P3 — Low** | Cosmetics (§10.3) | Low | Player rendering |
| 🟢 **P3 — Low** | NPC & Quests (§12) | High | Dialogue system, all biomes |
| 🟢 **P3 — Low** | Audio system (§13) | Medium | Web Audio API |
| 🟢 **P3 — Low** | Menus: crafting, leaderboard, map, journal (§8.2) | High | Inventory, fish log |
| ⚪ **P4 — Polish** | Remaining status effects 16–30 (§14) | Low | Status system |
| ⚪ **P4 — Polish** | Toast system (§8.3) | Low | Event system |
| ⚪ **P4 — Polish** | Radial menu (§8.4) | Low | Input system |
| ⚪ **P4 — Polish** | Hooks, lines, reels (§4.2–4.4) | Medium | Rod system |

---

## 16. Content Totals Summary

| Category | Count |
|---|---|
| **Fish species** | 127 |
| **Boss encounters** | 20 (16 biome + 4 world) |
| **Rod tiers** | 15 |
| **Hook types** | 12 |
| **Line types** | 10 |
| **Reel types** | 6 |
| **Biomes** | 16 |
| **Vegetation types** | 42 |
| **Weapons** | 32 |
| **Weather types** | 12 |
| **Emotes** | 12 |
| **Achievements** | 50 |
| **Hat cosmetics** | 11 |
| **Trail cosmetics** | 8 |
| **NPCs** | 8 |
| **Quests** | 20 |
| **Music tracks** | 12 |
| **Sound effects** | 40+ |
| **Status effects** | 30 |
| **Animation categories** | 12 (with 60+ individual animations) |
| **CSS keyframe definitions** | 30+ |
| **UI panels** | 15+ |
| **Color variables** | 50+ |

**Total new content items: 500+**

---

*This document is a companion to GAME_DESIGN_SPEC.md (v2.0). Both documents together form the complete design specification for THE LAKE.*
