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
1. **Tidal Forge Citadel**: Build a coastal fortress that physically changes with a simulated tide cycle. Operate sluice gates, wave-powered siege engines, and artisan workshops while managing crew morale and escalating naval assaults.
2. **Meridian Heist Syndicate**: Plan a multi-member crew heist on a blueprint, then watch the plan execute in real time. Handle specialist skills, alarm propagation, guard AI, a fence market, and a campaign-wide heat system.
3. **Cartographer's Lament**: A roguelite expedition where you draw your own map. Mapped terrain becomes safer or changes, while you manage sanity, supplies, faction relations, and landmark discovery.
4. **Plague Doctor's Quarantine**: City-scale epidemic management with a visible contact-tracing graph. Run hospitals, quarantine districts, rumor and panic dynamics, supply chains, and research toward a cure.
5. **Orbital Foundry Logistics**: Factory automation on a rotating space ring where Coriolis drift bends conveyor paths. Manage power grids, multi-tier recipes, and periodic pirate raids.
6. **Tectonic Shepherd**: A god-game where you drag tectonic plates to shape continents for competing tribes. Trigger volcanoes, earthquakes, and rising seas while tribes develop a tech tree and diplomacy.
7. **Parliament of Crows**: A political strategy game of faction voting, bribes, scandals, and bill drafting across multiple terms. Rival AI parties adapt to your reputation and coalition history.
8. **Glacier Caravan**: Lead a convoy across a moving ice sheet with crevasse physics. Customize vehicle modules, manage fuel, weather, trade, and crew relationships, and survive blizzard events.
9. **Alchemical Assembly Line**: A programming-puzzle campaign where you script robotic arms on a grid using instruction tapes to transmute materials. Score on cycles, cost, and footprint, with a 15+ puzzle campaign and leaderboards of your best runs.
10. **Kaiju Insurance Adjuster**: Predict kaiju paths on a city grid, place defenses, order evacuations, and process damage claims. Balance the budget, public trust, and a research department that unlocks countermeasures.
11. **Bullet Liturgy**: A bullet-hell deckbuilder where each card rewrites your ship's firing pattern, shield, or bomb. Fight multi-phase bosses whose attacks are readable puzzles, and build synergies across a run.
12. **Gravity Chess Tactics**: Grid tactics where every unit has mass that warps nearby movement and attack lines. Includes a campaign, terrain with gravitational anomalies, and unit promotion trees.
13. **Dungeon Lord's Ledger**: A reverse dungeon-crawler where you design rooms, traps, and monster lairs against adventurer parties with classes, morale, and loot greed. Manage a mana economy and dungeon reputation.
14. **Terraform Ledger**: A 2D atmospheric simulation where you tune gases, temperature, the water cycle, and biomes to make a dead world habitable. Support colony growth, climate disasters, and milestone unlocks.
15. **Sky Whaler Fleet**: An airship hunting and trading game with harpoon physics, fleet management, crew roles, port markets, weather fronts, and apex-creature hunts.
16. **Frontier Rail Baron**: A railway tycoon with terrain costs, a stock market, rival AI barons, sabotage, timetable management, and town growth driven by your lines.
17. **Heirloom Dynasty**: A generational action-roguelite. Each run's hero inherits traits from the previous one, and a homestead hub upgrades, marries, and trains successors toward a final dynasty goal.
18. **Mind Palace Detective**: Explore memory rooms, combine clues in a deduction graph, and run interrogations with lie-detection mechanics. Procedurally generated cases escalate in complexity.
19. **Swarm Colony RTS**: An ant-colony strategy game with pheromone trail painting, caste production, tunnel digging, weather, rival colonies, and a queen-health win/loss condition.
20. **Loop Station Zero**: A time-loop murder mystery on a space station. NPCs follow schedules, knowledge persists across loops, and gated actions must be sequenced to prevent the crime.
21. **Neon Courier Parkour**: A 2D momentum-based urban parkour game with route planning, hacking minigames, faction reputation, package-handling risk, and district-wide chase systems.
22. **Reactor Shift Supervisor**: A nuclear-plant simulation with control rods, coolant loops, xenon poisoning, grid-demand curves, component wear, and multi-scenario emergencies.
23. **Chimera Auto-Forge**: An auto-battler where anatomical body parts provide synergies and positional effects. Includes evolution, a shop economy, 3v3 formations, and a boss gauntlet.
24. **Aqueduct Architects**: A hydrology-driven city builder where you route water over terrain with gravity and pressure. Manage irrigation, sanitation, floods, droughts, and district happiness.
25. **Graveyard Shift Necropolis**: Run an undead workforce economy with shift scheduling, resource chains, and haunted-site defense against zealot raids and rival necromancers.
26. **Lockpick Dynasty**: A tactile lock-and-mechanism puzzle game with procedurally assembled multi-stage vaults, tool upgrades, a client reputation system, and timed escalation.
27. **Starforge Shipwright**: A modular spaceship builder with power, heat, mass, and crew-flow constraints, tested in real-time combat sorties against evolving enemy fleets.
28. **Weather Warden**: A tower defense where you manipulate wind, rain, lightning, and temperature across a fields map to protect crops from pests and storms. Reactions chain between elements.
29. **Sunken Archive Dive**: Underwater salvage exploration with oxygen, pressure, and light management. Includes a submersible upgrade tree, ancient machine puzzles, and a rising-threat ecosystem.
30. **Coup d'Etat Protocol**: A real-time palace intrigue sim where you recruit, blackmail, and position conspirators on a court map. Plan the coup timing against loyalty and suspicion meters.
31. **Stormcaller's Pass**: A roguelite mountain-defense game where you shape terrain walls and call elemental storms against sieging armies. Includes a spell-research tree and relic synergies.
32. **Orchestra of Automata**: A rhythm-strategy hybrid where you arrange mechanical musicians whose instrument timing generates attacks against waves of discordant foes. Includes a composition editor.
33. **Salvage Syndicate Wars**: A real-time scavenger-fleet strategy game over wreck fields. Includes tractor-beam logistics, crew hiring, faction rivalries, and a salvage-rights market.
34. **Bureau of Impossible Architecture**: A 3D-feeling isometric puzzle game with Escher-style perspective shifts for routing characters. Includes a 20+ level campaign with mechanics that layer progressively.
35. **Hexfall Commanders**: A hex-grid wargame where terrain collapses, floods, or ignites each turn. Includes squad customization, supply lines, a campaign map, and permadeath veterans.
36. **Bazaar of Whispers**: A trading and information-brokering game in a living night market. Includes NPC schedules, rumor propagation, price manipulation, and faction favor trees.
37. **Mycology Lab Tycoon**: Breed fungi with a genetic-crossing system for pharmaceuticals, food, and weapons. Manage contamination, climate rooms, contracts, and black-market risk.
38. **Phantom Orchestra Heist Runner**: A stealth-rhythm game where guard patrols and security are driven by a musical timeline you must sync with. Includes multi-floor levels and gadgets.
39. **Shipbreaker's Yard**: A physics-driven deconstruction sim. Cut, crane, and sort wrecks for materials while managing structural collapse, toxic hazards, worker safety, and contracts.
40. **Elemental Siege Cartographer**: A hybrid tower defense and map editor where you draw lane layouts, then defend them. Wave design, element synergies, and shareable seed codes are included.
41. **Rift Marshal**: An action-roguelite where you seal dimensional rifts, each with different physics rules. Build loadouts, upgrade a hub base, and fight rule-bending bosses.
42. **Archaeology of Ruin**: A grid-based excavation puzzle sim with stratigraphy layers, tool durability, artifact restoration minigames, museum curation, and a rival expedition.
43. **Ley Line Railways**: A puzzle-strategy game routing magical energy trains along shifting ley lines. Includes junction logic, cargo types, corruption spread, and escalating network demands.
44. **Gearwright Colosseum**: A build-and-battle game where you design robot fighters from parts with a visual behavior-tree editor, then watch them fight in tournament brackets with a sponsor economy.
45. **Lighthouse Network Command**: A strategy-management game linking lighthouses along a hostile coast. Includes ship traffic routing, storm forecasting, keeper staffing, and supernatural incursions.
46. **Biome Ark Curator**: A zoo-ark management game where you balance habitats, food webs, breeding genetics, visitor satisfaction, and disaster events while stabilizing endangered species.
47. **Tempest Duelist**: A one-on-one fighting roguelite with a stance system, a stamina-posture economy, an AI that learns your habits, and branching opponent routes across a tournament map.
48. **Pipe Dream Metropolis**: A real-time underground-utilities puzzle city builder. Route water, gas, power, and data under a growing city with overlay layers, failures, and repair crews.
49. **Void Choir Expedition**: An atmospheric exploration game where you decode alien signal harmonies to open gates, manage a fragile ship, and meet procedurally generated xeno-cultures with branching outcomes.
50. **Siege Engineer's Gambit**: A physics-based fortress attack and defense game. Design siege engines and fortifications with structural stress simulation across a campaign of themed castles.
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

Build game idea #1
