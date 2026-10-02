# Objective

Select a game from the list in the Context & Scope block. Design and build it as a complete, playable, feature-rich game delivered either using HTML or React.

Treat the selected idea as a launchpad. Expand it with deep interlocking mechanics, progression, and polish so the result feels like a finished commercial indie title, not a prototype.

---

# Context & Scope

## Background
- Every idea below is intentionally multi-system. Implement the core loop plus at least the secondary systems named in the description, then add your own.
- Make all design decisions yourself (mechanics, balance, controls, difficulty curve, art direction, sound direction). Do not ask clarifying questions, pause for confirmation, or stop partway.

## Minimum Feature Bar
The finished game must include all of the following:
- **Core loop**: a moment-to-moment loop that is fun within 30 seconds.
- **Systems depth**: at least 4 interacting systems, where changing one visibly affects the others.
- **Progression**: a meta layer such as upgrades, unlocks, a tech tree, a campaign map, or a lineage. It must persist within the session and, where sensible, via `localStorage`.
- **Difficulty scaling**: escalating waves, levels, or events, plus at least 3 selectable difficulty settings or modifiers.
- **Content variety**: at least 5 distinct enemy, obstacle, puzzle, or scenario types, and at least 1 boss, climax, or capstone challenge.
- **Onboarding**: an interactive tutorial or a clear in-game help screen, plus a controls reference.
- **Game feel**: screen shake, particle effects, animation easing, hit feedback, and floating text or UI juice.
- **Audio**: fully synthesized sound (Web Audio API) for effects and reactive or ambient music, with a mute/volume control.
- **UI/UX**: a title screen, pause menu, settings, HUD, game-over screen, victory screen, and restart flow. The layout must be responsive to window size.
- **Input**: keyboard and mouse supported. Add touch or gamepad support if feasible.
- **Win and lose states**: both reachable and clearly communicated, with a stats summary at the end.

## Game Ideas List

<game_ideas>
1. **Minecraft Lite**: A first-person 3D voxel sandbox with block placement and destruction, crafting recipes, a day/night cycle, hostile mobs (zombie, skeleton, spider, creeper, enderman), passive mobs (pig, cow, sheep, chicken), biome generation, inventory management, tool tiers (wood → stone → iron → diamond), hunger, health, smelting, enchanting basics, farming, and an Ender Dragon boss fight. Simplify by removing multiplayer, redstone complexity, the Nether/End dimensions (keep the boss as a surface encounter), and commands. Use Three.js or similar for 3D rendering.

2. **Terraria Simplified**: A 2D side-scrolling sandbox with procedural world generation, digging, building, an NPC housing system, ore tiers, boss progression (Eye of Cthulhu, Skeletron, Wall of Flesh equivalent, and 2+ hardmode bosses), crafting stations, loot variety, day/night cycle, biome-specific enemies, and event invasions. Simplify by reducing total item count, removing multiplayer, and condensing biome types to ~6. Keep the core loop of explore → mine → craft → fight → upgrade.

3. **Factorio Express**: A top-down factory automation game with resource extraction (iron, copper, coal, stone, oil), belt conveyors, inserters, assembling machines, research labs, a tech tree of 20+ technologies, power generation (steam, solar), logistics bots (simplified), pollution mechanics attracting enemy biters that attack in escalating waves, and a rocket launch win condition. Simplify by using 2D sprites, reducing recipe depth, and removing trains and circuits. Keep the satisfying belt-building and factory-scaling loop.

4. **Stardew Valley Pocket**: A top-down farming sim with crop planting and seasons (spring, summer, fall, winter), fishing minigame, mining dungeon with combat, NPC relationships and gift-giving, town events and festivals, livestock management, cooking, foraging, a crafting system, tool upgrades, and a Community Center bundle completion goal. Simplify by reducing NPC count to ~8, crop variety to ~15, and removing marriage. Keep the daily time loop and seasonal progression.

5. **Civilization Micro**: A turn-based 4X strategy game on a hex grid with city founding, tile improvements, unit production (warrior, archer, horseman, swordsman, catapult, musketeer, tank, and 2+ unique units), a tech tree of 30+ nodes across ancient to modern eras, diplomacy (trade, alliances, war declarations), culture and border expansion, wonders, resource management (food, production, gold, science, culture), barbarian camps, and domination/science/culture victory conditions. Simplify by reducing map size, removing religion, and limiting to 3 AI opponents.

6. **Tetris Ultimate**: Classic Tetris with modern features: hold piece, next-piece preview (3 pieces), ghost piece, T-spins, back-to-back bonuses, combos, a marathon mode (reach level 15), sprint mode (clear 40 lines), ultra mode (2-minute score attack), and an AI battle mode. Include a progressive gravity curve, lock delay, wall kicks (SRS rotation), leaderboards via localStorage, and a zen/endless mode. Add particle effects, line-clear animations, and adaptive background music that intensifies with level.

7. **Plants vs. Zombies Garden**: A lane-based tower defense with sun economy, 12+ plant types (peashooter, sunflower, wall-nut, cherry bomb, snow pea, repeater, chomper, potato mine, jalapeno, lily pad, squash, tall-nut), 8+ zombie types (basic, cone, bucket, pole-vaulting, newspaper, screen-door, football, Zomboss), day/night levels, conveyor-belt levels, a Zen Garden side mode, plant upgrade paths, and a 5×9 grid lawn. Include fog and pool lane variants for variety.

8. **Pokémon Battle Tower**: A turn-based RPG monster battler with 30+ creatures across 8 types (fire, water, grass, electric, ground, flying, psychic, dark), type effectiveness chart, 4-move movesets, stat stages, abilities, held items, evolution, a team of 6, wild encounters, trainer battles, gym leader progression (8 gyms), and an Elite Four final challenge. Simplify by removing overworld exploration (use a menu-based map), breeding, and limiting to Gen-1-inspired creatures. Keep the deep battle system.

9. **Binding of Isaac Lite**: A top-down roguelite dungeon crawler with procedurally generated floor layouts, tear-based shooting, item pickups that visually modify the character, stat upgrades (damage, speed, range, fire rate, health), shop rooms, treasure rooms, boss rooms per floor, 6+ floor themes, 15+ distinct items with synergies, 8+ boss types, devil/angel room deals, and a final boss. Include permadeath, run seeding, and unlockable characters with different starting stats.

10. **Slay the Spire Express**: A roguelite deckbuilder with a 3-act map featuring branching paths (combat, elite, shop, rest, event nodes), 3 playable characters with distinct 60+ card pools, energy system, relic collection (20+ relics with passive effects), potion slots, elite enemies, 3 act bosses, card upgrades at rest sites, and a final heart boss. Include deck viewing, discard/draw tracking, and procedurally generated enemy encounters with visible intent icons.

11. **RimWorld Colony**: A top-down colony management sim with 3+ colonists, skill systems (shooting, melee, construction, cooking, medicine, growing, mining, crafting, social, art), mood and mental break mechanics, room impressiveness, research tree, trade caravans, raider attacks scaling with colony wealth, seasons and temperature, food spoilage, power systems (wind, solar, batteries), medical system with injuries and diseases, and a ship-building escape goal. Simplify by reducing map size and removing ideology/royalty systems.

12. **FTL Micro**: A roguelite spaceship management game with a sector map of branching nodes, real-time-with-pause combat, system management (shields, weapons, engines, medbay, O2, piloting, doors, sensors), crew members with species and skills, enemy ship encounters, shops, events with choices, fuel/missile/drone resource management, 8 sectors of escalating difficulty, and a multi-phase Rebel Flagship boss. Include ship unlocks and layout variants.

13. **Vampire Survivors Clone**: An auto-attacking top-down survival action game with a 30-minute run timer, XP gems, level-up weapon/passive choices, 8+ weapons (whip, magic wand, knife, axe, fire wand, garlic, holy water, cross), weapon evolutions via passive item pairings, enemy waves that escalate in density and type, elite enemies, a Death boss at 30 minutes, chest drops, character selection (4+ characters with unique starting weapons), and a meta-progression gold shop for permanent stat upgrades.

14. **Clash Royale Tactics**: A real-time card-based arena battler on a two-lane field with towers (two princess towers + king tower per side), elixir generation, 20+ troop/spell/building cards with rarity tiers, deck building (8-card deck), AI opponents with escalating difficulty, card upgrade system using gold and duplicate cards, chest rewards with unlock timers, and a trophy-based ladder with 10+ arenas. Simplify by making it single-player vs AI only.

15. **SimCity Pocket**: A city-building simulation with zoning (residential, commercial, industrial), road networks, power grid, water supply, police/fire/health service coverage, education, taxation with adjustable rates, population happiness, traffic simulation (simplified), natural disasters (earthquake, tornado, fire, flood), budget management, landmark unlocks at population milestones, and terrain with water features. Use a tile-based grid system.

16. **Celeste Tribute**: A precision 2D platformer with dash, wall-jump, wall-slide, and climb (stamina-limited) mechanics. Include 7+ chapter-themed worlds with distinct mechanics (wind, dream blocks, moving platforms, dash crystals, feathers, bumpers), collectible strawberries, B-side harder variants, a narrative delivered through dialogue, screen-by-screen level design, death counter, and a final summit chapter. Focus on tight responsive controls and generous coyote time.

17. **Diablo Dungeon**: An action RPG with procedurally generated dungeon floors, click-to-move combat, 3 classes (warrior, mage, ranger), skill trees with 6+ active skills per class, randomized loot with rarity tiers (common, magic, rare, legendary), item affixes, inventory management, gold economy, town hub with vendors, health/mana potions, 10+ enemy types, champion/elite packs with affixes, and a floor-20 boss. Include stat allocation (STR, DEX, INT, VIT) on level-up.

18. **Candy Crush Quest**: A match-3 puzzle game with a 60+ level campaign across a world map, level objectives (score targets, collect specific pieces, clear jelly, drop ingredients), special gems from 4-matches (striped) and 5-matches (color bomb), L/T-match (wrapped gem), combo effects between specials, limited moves per level, 3-star rating, boosters (hammer, extra moves, shuffle), and lives system with regeneration timer. Include procedural board layouts that ensure solvability.

19. **Age of Empires Skirmish**: A real-time strategy game with resource gathering (food, wood, gold, stone), villager workers, 4 age advancements (Dark → Feudal → Castle → Imperial), building construction (town center, barracks, archery range, stable, siege workshop, castle, market, farm), 10+ military unit types, rock-paper-scissors unit counters, fog of war, minimap, AI opponent with difficulty scaling, and a relic or wonder victory condition alongside military conquest. Simplify with a small map and 1v1 only.

20. **Bejeweled Blitz**: A classic match-3 with a twist: timed mode (60 seconds), moves mode, and endless zen mode. Include cascading combos, special gems (flame gem for 2×2 clear, star gem for row+column, hypercube for all-of-one-color), score multiplier chains, daily challenge puzzles, power-ups (scramble, +5 seconds, hint), progressive level system with increasingly complex board shapes and blockers (ice, chains, locks), and high-score leaderboards.

21. **Super Mario Maker Lite**: A 2D platformer with a built-in level editor. Include a set of 30+ placeable elements (ground, brick, question block, pipe, coin, goomba, koopa, piranha plant, thwomp, spike, platform, spring, fire bar, lava, checkpoint, star, mushroom, fire flower, door, key, P-switch, conveyor, ice, cloud platform, bill blaster, chain chomp, lakitu, bowser), a play-test button, 10 pre-built levels, and the ability to save/load custom levels via localStorage. Physics should include momentum, variable jump height, and enemy stomping.

22. **Civilization Revolution**: A streamlined 4X game playable in under an hour. Hex grid, 4 civilizations with unique bonuses, city management (food, production, trade), military units (5+ types), technology research (20+ techs), great people, diplomacy (peace, war, alliance), barbarian threats, and 4 victory types (domination, technology, culture, economic). Faster pace than full Civ with auto-managed cities and simplified combat.

23. **Oregon Trail Revival**: A resource management and decision-making journey game. Lead a party of 5 along a trail with hunting minigames, river crossing events, trading posts, random encounters (disease, weather, theft, broken equipment), resource tracking (food, ammunition, medicine, spare parts, cash), pace and ration settings, party member health and morale, branching trail paths, landmarks, and a scoring system based on survival and supplies at journey's end.

24. **Pac-Man Championship**: Classic Pac-Man with extended features: the original maze plus 5+ additional maze layouts, ghost AI personalities (Blinky chase, Pinky ambush, Inky unpredictable, Clyde patrol), power pellets, fruit bonuses, a championship mode with timed score attack, a campaign with 20+ stages introducing new maze elements (teleporters, one-way gates, speed zones, dark fog), ghost train mechanic from CE, and leaderboards. Add modern juice: ghost-eat combos, chain bonuses, screen effects.

25. **Among Us Solo**: A social deduction puzzle game adapted for single-player. You're a crewmate on a space station completing task minigames (wiring, card swipe, asteroid shooting, reactor stabilization, navigation, fuel, scan) while deducing which NPCs are impostors based on movement patterns, alibis, body discovery locations, and security camera logs. Includes voting rounds, 3 maps, adjustable impostor count, emergency meetings, sabotage events, and a detective notebook for tracking suspicions.

26. **Angry Birds Physics**: A physics-based projectile puzzle game with a slingshot launcher, destructible structures (wood, stone, glass with different durability), 5+ bird types with special abilities (speed boost, split shot, bomb, boomerang, egg drop), 60+ levels across 5 themed worlds, a 3-star scoring system, boss pig levels every 12 stages, and bonus golden egg hidden levels. Include realistic 2D physics for toppling, bouncing, and chain reactions using a physics engine.

27. **Tower Defense Classic (Bloons-style)**: A path-based tower defense with 10+ tower types (dart, tack, sniper, bomb, ice, glue, super, wizard, ninja, engineer, banana farm), tower upgrades (3 tiers per path, 2 paths), round-based waves of 50+ rounds with varied enemy types (basic, fast, camo, lead, ceramic, MOAB-class), special abilities, a map selection of 5+ maps with varying difficulty, and a free-play endless mode after round 50. Include tower targeting priorities and a sell/upgrade economy.

28. **Geometry Dash Runner**: A rhythm-based auto-scrolling platformer with tap-to-jump (and hold-to-fly in ship/UFO segments), mode switches (cube, ship, ball, UFO, wave), practice mode with checkpoints, a level editor, 8+ built-in levels with synchronized music, speed portals (1x–4x), gravity portals, size portals, collectible coins (3 per level), custom color schemes, and a level completion percentage tracker. Synthesize chiptune-style level music.

29. **Chess Plus**: A full chess implementation with legal move highlighting, check/checkmate/stalemate detection, castling, en passant, pawn promotion, move history with algebraic notation, undo, AI opponent with 5 difficulty levels (minimax with alpha-beta pruning at varying depths), opening book, timed modes (bullet 1min, blitz 5min, rapid 10min, classical 30min), puzzle mode with 20+ tactical puzzles (forks, pins, skewers, discovered attacks, mate-in-2/3), and a rating system that adjusts based on AI difficulty beaten.

30. **Snake Evolution**: The classic snake game expanded with power-ups (speed boost, slow-mo, magnet, shield, double points), obstacle types (walls, moving barriers, portals, shrink zones), 10+ arena layouts, boss battles every 10 levels (a rival AI snake, a pattern-based guardian), evolution mechanic where the snake gains permanent abilities at length milestones, a campaign of 30+ levels with distinct objectives (reach length X, survive timer, collect specific items, navigate mazes), and an endless survival mode.

31. **2048 Infinity**: The sliding number puzzle extended with power-up tiles (bomb to clear, freeze to lock, wildcard to match any), multiple board sizes (4×4, 5×5, 6×6), timed challenge mode, campaign mode with 25+ levels with pre-placed obstacle tiles and target goals, an undo system (limited uses), combo chains for consecutive merges, a zen/endless mode, tile skin themes, and statistics tracking (best tile, total merges, games played). Include smooth tile animations and particle effects on merges.

32. **Flappy Bird Odyssey**: The one-tap flying mechanic expanded into a full game with 8+ themed worlds (forest, cave, ocean, sky, volcano, ice, neon, space), each introducing new obstacle types (moving pipes, rotating barriers, wind gusts, gravity shifts, breakable walls, homing missiles), collectible coins for a shop with bird skins and abilities (double jump, slow fall, tiny mode, shield), boss encounters every 5 worlds, and a daily challenge mode with seeded obstacles.

33. **Minesweeper Pro**: Classic minesweeper with beginner/intermediate/expert/custom grid sizes, flagging, chord-clicking, a campaign of 30+ puzzle boards with unique shapes (L-shaped, donut, cross, scattered islands), a no-guess guarantee mode, daily challenges, statistics tracking, a hint system with limited uses, a speed-run timer with leaderboards, and an adventure mode where clearing boards unlocks map regions with escalating mine density and special tiles (question blocks that may or may not be mines, shifting mines that move on flag).

34. **Crossy Road Journey**: An endless hopper game with procedural terrain (roads with cars, rivers with logs, train tracks, grass with obstacles), character unlocks (30+ pixel characters via coins), themed biomes that change the visual and obstacle sets every ~50 tiles, special event obstacles (stampede, flood, night fog), a daily challenge, high-score leaderboards, near-miss bonus scoring, and a gradual speed increase. Include idle coin generation for unlocked characters.

35. **Fruit Ninja Slice**: A touch/mouse slicing game with classic mode (3 lives, miss a fruit = life lost, hit a bomb = game over), zen mode (90 seconds, no bombs), arcade mode (60 seconds with special bananas for bonuses), 8+ fruit types with different point values and slice physics, critical hit zones for bonus points, combo multipliers for multi-fruit slices, power-ups (freeze, frenzy, double points), blade and background unlockables, and a campaign mode with 20+ stages with target scores and special rules.

36. **Space Invaders Remastered**: The classic shoot-em-up with expanded features: 5 enemy formation types, shield barriers that degrade, power-ups (rapid fire, spread shot, laser, shield, bomb), 20+ waves with increasing enemy speed and new enemy behaviors, a boss every 5 waves with attack patterns, a ship upgrade system between waves (speed, fire rate, damage, shield capacity), combo scoring for rapid kills, and an endless survival mode. Include star-field parallax backgrounds and explosion particles.

37. **Wordle Unlimited**: The 5-letter word guessing game with unlimited plays, 6 guesses, color-coded feedback (green/yellow/gray), a hard mode (must use revealed hints), a daily challenge with shareable results, statistics tracking (games played, win %, streak, guess distribution), word length variants (4, 5, 6, 7 letters), a time attack mode (solve as many as possible in 5 minutes), themed word lists (science, geography, food, animals), and a versus mode against an AI that also tries to guess your word.

38. **Breakout Saga**: A brick-breaking game with 50+ levels, paddle power-ups (wide, laser, magnetic, multi-ball, fireball), brick types (normal, hardened, explosive, indestructible, moving, regenerating), level layouts forming pictures and patterns, boss levels with a moving target that fights back, ball physics with spin based on paddle hit position, a level editor, combo scoring, and a lives/continue system. Include a campaign map and 5 themed worlds.

39. **Doodle Jump Ascent**: A vertical auto-scrolling platformer with tilt/arrow-key movement, platform types (normal, moving, breakable, spring, vanishing, conveyor, explosive), enemies to jump on or shoot, power-ups (jetpack, propeller hat, spring shoes, shield, magnet), themed zones every 1000 points (jungle, space, ice, underwater, lava), boss encounters, character unlocks, and a high-score system. Include procedural platform generation with difficulty scaling based on height.

40. **Frogger Freeway**: The classic road/river crossing game expanded with 30+ levels, traffic patterns of increasing complexity, log/turtle river mechanics, bonus flies and items, level-specific hazards (trains, alligators, snakes, hawks), a time limit per level, warp zones, 3 lives with extra life pickups, a boss level where you cross a dynamic obstacle course, and an endless mode. Include seasonal/themed visual variants and a star rating per level.

41. **Galaga Assault**: A fixed-screen space shooter with enemy dive-bombing formations, tractor beam capture/rescue mechanic, 30+ stages with boss stages every 5 levels, challenging stages for bonus points, power-ups (dual shot, triple shot, shield, speed, bomb), enemy types with distinct movement patterns (8+), ship upgrades between stages, a combo system for perfect-round bonuses, and a final multi-phase mothership boss at stage 30. Include star-field effects and formation entry animations.

42. **Harvest Moon Day**: A simplified farming/life sim day loop. Plant crops (12+ types with different grow times, seasons, and sell prices), raise animals (chicken, cow, sheep with care mechanics), befriend 6 NPCs with dialogue and gift preferences, upgrade tools (5 tiers), expand your farm, fish in 3 locations, mine in a 20-floor dungeon, participate in 4 seasonal festivals, cook recipes from gathered ingredients, manage stamina, and complete a year-one community goal to win. Use a top-down pixel art style.

43. **Katamari Roll**: A collection-rolling game where you control a growing ball that picks up objects. Start small (thumbtacks, candy, dice) and grow through furniture, cars, buildings, and landmarks. Include 10+ levels with size targets and time limits, a score based on final size, unlockable cousins/characters with different rolling stats, a hub area, object variety (100+ distinct items organized by size category), and a "Make a Star" culminating level. Physics should handle growth-based collision radius changes.

44. **Peggle Blitz**: A pachinko-style ball-dropping puzzle game. Clear all orange pegs on each board in limited shots. Include 10+ characters with unique special abilities (multiball, fireball, zen ball guide, spooky ball return, etc.), 50+ level layouts, green pegs that trigger abilities, purple bonus pegs, a free ball bucket at the bottom, fever bonus on final orange peg, score multipliers, and a duel mode vs AI. Include satisfying Ode to Joy on level completion.

45. **Bomberman Arena**: A grid-based bomb-placement action game. Place bombs to destroy soft blocks and opponents. Include power-ups (fire range, extra bombs, speed, kick, punch, remote detonator, shield), 8+ arena layouts, AI opponents with 3 difficulty levels, a campaign with 20+ stages introducing hazards (conveyor belts, teleporters, trampolines, ice), boss battles, multiplayer-sim vs 3 AI bots, and a survival mode with escalating enemy waves.

46. **Cooking Mama Kitchen**: A collection of cooking minigames (chop, stir, fry, boil, roll, knead, decorate, plate, season, pour, peel, grate) assembled into full recipes. Include 15+ recipes of increasing complexity, a rating system (bronze to gold to platinum based on accuracy), a kitchen upgrade system, unlockable utensils that make minigames easier, timed challenge mode, a cookbook collection, and a free cook mode. Each minigame should have distinct input mechanics.

47. **Worms Battle**: A turn-based artillery game with destructible 2D terrain, projectile physics affected by wind, 8+ weapons (bazooka, grenade, shotgun, air strike, dynamite, banana bomb, holy hand grenade, ninja rope, blowtorch, teleport), team customization (names, 4 worms per team), health bars, crate drops with random weapons, water rising over time, AI opponents, 5+ terrain themes, and a campaign with scripted mission objectives. Include terrain deformation and ragdoll-like worm knockback.

48. **Lemmings Rescue**: A puzzle game where you assign roles to auto-walking creatures to guide them to an exit. Roles include climber, floater (umbrella), bomber, blocker, builder, basher, miner, digger. Include 50+ levels with increasing complexity, a save percentage target per level, destructible terrain, hazard types (lava, water, traps, crushers), a fast-forward button, nuke option, limited role assignments per level, and a level rating system. Terrain should visually deform when dug/bashed.

49. **Tycoon Tower (SimTower)**: Build and manage a skyscraper. Place floors and fill them with offices, condos, restaurants, shops, hotel rooms, a lobby, elevators, stairs, and a cinema. Manage tenant satisfaction, elevator wait times, rent income, maintenance costs, noise complaints, fire safety, pest control, VIP visitors, and population capacity. Reach star ratings (1–5 stars) by hitting population and satisfaction milestones. Include a day/night cycle affecting foot traffic, quarterly financial reports, and random events (power outages, celebrity visits, protests).

50. **Portal Puzzle 2D**: A 2D puzzle-platformer inspired by Portal. Place two linked portals on valid surfaces to redirect your character, objects, and energy beams. Include momentum conservation through portals, weighted cubes, pressure plates, turrets, energy pellets and catchers, goo surfaces (speed gel, bounce gel), companion cube escort levels, a 30+ level campaign with progressive mechanic introduction, timed challenge modes, and a GLaDOS-style narrator providing commentary. Physics-accurate portal momentum is essential.
</game_ideas>

---

# Tools & Action Boundaries

## Allowed
- Any design, mechanic, art style, or system expansion that improves the game.
- Procedural generation, Canvas 2D, WebGL, or SVG rendering, and the Web Audio API for synthesized audio.
- External libraries via standard CDN links (e.g., Three.js, Phaser, Matter.js, Tone.js) if they load reliably from a single file. Vanilla JS is equally acceptable.
- Combining or modifying ideas from the list, as long as the selected game stays the clear foundation.
- Procedural or code-drawn graphics and emoji, in place of image assets.

## Not Allowed
- Placeholder comments, TODO stubs, unimplemented menu items, or dead buttons.
- External asset files that require separate hosting (images, audio, fonts), except reliably loading CDN libraries or web fonts with a system-font fallback.
- Asking for clarification or delivering partial work.

## Priority Order (if constraints conflict)
1. A fully working, complete game.
2. Feature richness and depth.
3. Code brevity.

---

# Output

## Deliverable
- Either HTML, CSS, and JavaScript, or React.
- A brief summary after the code (maximum 150 words, in bullet points) covering: the selected game, the controls, the core systems, and the progression structure.

## Definition of Done (verify each item before presenting)
- [ ] **Launch**: the file opens with no console errors, and the title screen appears and responds to input.
- [ ] **Start → play**: starting a new game initializes all state correctly, with tutorial or help accessible.
- [ ] **Core loop**: the main gameplay loop runs continuously with no soft-locks and no unreachable UI states.
- [ ] **Systems**: every secondary system named in the selected idea is implemented and measurably affects gameplay.
- [ ] **Progression**: upgrades, unlocks, or campaign advancement work, and their effects are applied in play.
- [ ] **Win state**: it is reachable, triggers the victory screen, and offers continue or restart.
- [ ] **Lose state**: it is reachable, triggers the game-over screen with stats, and offers retry.
- [ ] **Restart**: restarting fully resets state, timers, listeners, and audio with no leaks or duplicate loops.
- [ ] **Pause/Settings**: pause, resume, volume or mute, and difficulty settings all work mid-game.
- [ ] **Performance**: the game uses `requestAnimationFrame` with delta-time, stays smooth under heavy particle or entity counts, and handles window resize.
- [ ] **Robustness**: edge cases are guarded (empty arrays, division by zero, rapid input, tab blur, `localStorage` unavailable).

Build idea #1
