# Objective

Select a simulation from the list in the Context & Scope block. Design and build it as a complete, interactive, feature-rich simulation using standard HTML, CSS, and JavaScript for the main body. React is only permitted as an outer wrapper if required for deployment; do not write the core simulation logic or main body of the application using React or TypeScript.

Treat the selected concept as a launchpad. Expand it with believable interacting systems, meaningful decisions, progression, visualization, feedback, and polish so the result feels like a finished commercial interactive simulation rather than a static demo.

The simulation should be understandable within the first minute, but offer increasing strategic or systemic depth over time. Prioritize an active model with visible cause-and-effect relationships over menus that only display numbers.

Do not ask clarifying questions, pause for confirmation, or stop partway. Make all design decisions yourself and deliver a complete working implementation.

---

# Context & Scope

## Background

Every idea below is intentionally multi-system. Implement the primary simulation loop plus the secondary systems named in the description, then add your own complementary mechanics.

The selected simulation may be:
- A management or tycoon simulation
- An ecosystem or natural-process simulation
- A logistics or production simulation
- A social, political, or economic simulation
- A scientific or engineering simulation
- A life, farming, colony, or settlement simulation
- A city, transport, or infrastructure simulation
- A procedural sandbox with emergent behavior

The result should feel interactive and alive. The user must be able to change inputs, observe consequences, respond to events, and improve outcomes.

## Minimum Feature Bar

The finished simulation must include all of the following:

- **Core interaction loop:** A meaningful action-observe-adjust loop that becomes engaging within 60 seconds.
- **Systems depth:** At least 4 interacting systems where changing one visibly affects the others.
- **Simulation model:** Time progression, state updates, resource flows, population/entity behavior, or another continuously updating model.
- **Progression:** A persistent meta layer such as unlocked technologies, infrastructure, policies, reputation, research, milestones, scenarios, or expanding map regions.
- **Difficulty or scenario scaling:** At least 3 selectable difficulties, scenarios, starting conditions, or simulation modifiers.
- **Content variety:** At least 5 distinct entity, resource, event, building, process, environment, or scenario types.
- **Capstone objective:** At least one demanding long-term goal, crisis, milestone, target state, or end-of-scenario challenge.
- **Onboarding:** An interactive tutorial, guided first scenario, or clear in-app help screen with explanations and controls.
- **Visualization:** The simulation must clearly show changing state through maps, charts, diagrams, animated entities, meters, dashboards, or other visual feedback.
- **System feedback:** Include animations, particles or visual effects where appropriate, easing, alerts, floating values, event notifications, and clear cause-and-effect feedback.
- **Audio:** Use fully synthesized Web Audio API effects and reactive or ambient audio. Include mute and volume controls.
- **UI/UX:** Include a title screen, scenario selection, pause/resume controls, settings, main simulation HUD, help screen, success/end-state screen, failure or crisis-state screen where applicable, and restart/reset flow.
- **Input:** Support keyboard and mouse. Add touch support where feasible.
- **Time controls:** Include pause, play, and at least one simulation-speed option such as 0.5×, 1×, 2×, or 4×.
- **Persistence:** Save meaningful progress and settings using `localStorage` where sensible, while safely handling unavailable storage.
- **End states:** The simulation must have clearly communicated success, failure, stability, bankruptcy, collapse, completion, or scenario-resolution states as appropriate.
- **Statistics:** Provide a summary of performance, trends, milestones, resource efficiency, population outcomes, or other relevant metrics.

## Design Expectations

- Every major system should affect at least one other system.
- Values should have understandable consequences rather than changing arbitrarily.
- Avoid purely decorative buttons or fake dashboards.
- Use deterministic or seeded procedural generation when useful.
- Include tooltips, labels, legends, and contextual explanations for complex systems.
- Balance realism against clarity. The simulation may be simplified, but its rules must be consistent.
- Prefer an approachable visual model over excessive text.
- The simulation should remain usable on desktop and smaller responsive screens.

---

# Simulation Ideas List

1. **Voxel Biosphere**: A 3D sandbox ecosystem on a procedurally generated voxel world with biomes, soil/water/rock layers, a day–night and seasonal cycle, weather, plant growth and seed dispersal, and animal agents (herbivore, carnivore, scavenger, pollinator, decomposer) driven by hunger, thirst, energy, and reproduction. Add heritable genomes with mutation, food-web dynamics, population and biomass graphs, extinction and recovery, god-tools (terraform, seed, cull, climate dial, release disease), and an invasive apex-predator crisis event. Simplify by removing multiplayer and first-person combat; use an orbit/free-fly camera. Use Three.js or similar for 3D rendering.

2. **Ant Colony Pheromone Lab**: A top-down agent simulation of thousands of ants over diffusing, evaporating home/food pheromone fields. Include a nest with brood, larvae, and a queen, caste assignment (forager, nurse, soldier, digger), depleting food sources, tunnel excavation through granular soil, rival colony raids, humidity affecting pheromone decay, and predators. Simplify by batching agents in typed arrays. Keep emergent trail formation and shortest-path discovery as the headline behavior.

3. **Supply Chain Flow Sim**: A top-down logistics and production simulation with extraction nodes, belts/trucks/lanes, buffers, multi-input recipes, machine uptime, bottleneck detection with a throughput heat map, demand forecasting, breakdowns and maintenance crews, labor shifts, pollution, and full cost accounting. Escalating customer orders drive difficulty; the capstone is sustaining a fill rate on a huge contract. Simplify with discrete tick-based item movement.

4. **Agronomy Field Sim**: A tile-based farm simulation with soil layers tracking N-P-K, moisture, pH, and organic matter; crop growth via growing-degree-days, root depth, and water stress; irrigation and fertilizer with runoff; weather and seasons; pests and disease with integrated pest management; crop rotation and cover crops; machinery and labor scheduling; and commodity prices with forward contracts. Run over multiple years and score yield against soil health.

5. **Settlement Civilization Sim**: An agent-based society on a resource map with individual needs, jobs, skills, households, births and deaths; food/wood/stone/tool production chains; storage and barter price discovery; technology diffusion; migration; epidemics; governance levers (taxes, laws, rationing) driving unrest; and warfare with neighboring settlements. Capstone: complete a monument before collapse. Limit to one continent and roughly 300 agents.

6. **Eulerian Fluid Lab**: A stable-fluids solver with velocity and dye fields, pressure projection, vorticity confinement, buoyancy and temperature coupling, paintable obstacles, inflow/outflow sources, and viscosity control. Include smoke, water, and ink modes, streamline/pressure/vorticity visualizations, and wind-tunnel scenarios (airfoil, cylinder vortex street, chimney plume, room ventilation) with measurement probes.

7. **Epidemiology Policy Lab**: A hybrid agent-based and compartmental outbreak simulation on a city map with households, workplaces, schools, and transit; contact networks; SEIR states; mutating variants; vaccination with waning immunity; testing, tracing, and isolation; hospital and ICU capacity; the economic cost of restrictions; and misinformation reducing compliance. Show live R_t estimation. Win by ending the outbreak under death and budget caps.

8. **Evolution Arena**: Physics-lite creatures whose genomes encode body plan, senses, and a small neural-network brain. Include food, hazards, predators, metabolism, reproduction with crossover and mutation, speciation, a browsable lineage tree, fitness-landscape charts, and environmental shifts (ice age, drought, new predator) that force adaptation. Allow saving and reloading champion genomes.

9. **Orbital Mechanics Mission Lab**: A solar-system simulation with gravity integration, a maneuver-node planner, delta-v budgeting via the rocket equation, Hohmann and bi-elliptic transfers, gravity assists, atmospheric drag and orbital decay, and spacecraft subsystems (power, thermal, comms, fuel). Add mission contracts, adjustable time warp, trajectory prediction, and a grand-tour capstone.

10. **Traffic Flow Simulator**: A road-network editor with intelligent-driver-model car following and lane-change logic, signalized intersections, roundabouts and stop signs, adjustable signal phases, origin-destination demand matrices with rush hours, accidents and roadworks, buses and bike lanes, and emissions. Include fundamental-diagram and queue-length charts. Goal: cut average travel time as demand grows each stage.

11. **Power Grid Operator**: A node-and-line grid with coal, gas, nuclear, hydro, wind, and solar generation; daily load curves; frequency and voltage stability; merit-order dispatch and market pricing; transmission thermal limits; batteries and demand response; weather-driven renewables; cascading failures and blackouts; maintenance outages; and emissions caps. Capstone: a heatwave plus an unplanned plant trip.

12. **Mesoscale Weather Sim**: A gridded atmosphere with temperature, pressure, humidity, and wind advection; convection, condensation, and precipitation; terrain and sea-surface forcing; frontal boundaries; layered cloud rendering; storm-cell formation and lightning; and a forecast-versus-reality scoring mode where you commit predictions and are graded. Capstone: a supercell or hurricane.

13. **Wildfire Spread Lab**: A cellular fire model over terrain with fuel type, load, and moisture; slope and wind effects; ember spotting; fire-line intensity; and suppression resources (hand crews, engines, dozers, air tankers, retardant lines). Add evacuation of settlements, shifting weather, containment percentage, and post-fire regrowth. Ship a campaign of escalating scenario maps.

14. **Morphogenesis Lab**: A reaction–diffusion sandbox (Gray-Scott and relatives) with multiple chemical species, a clickable parameter-space map, anisotropy and advection fields, masks and obstacles, and preset regimes (spots, stripes, mazes, mitosis, coral). Use WebGL fragment-shader stepping for speed, and include pattern-matching challenges scored by image similarity.

15. **Swarm Intelligence Lab**: Boids with separation, alignment, and cohesion plus predators, obstacles, wind, and goal fields. Support multiple species with distinct parameter sets, order-parameter and nearest-neighbor metrics, and alternative swarm tasks (ant colony optimization, particle swarm optimization over a visible landscape, foraging, herding). Capstone: a sheepdog scenario with a time limit.

16. **Cellular Automata Workshop**: A rule explorer covering Life-like B/S rules, Langton's ant, WireWorld, Brian's Brain, abelian sandpiles, elementary CA, and a continuous Lenia-style mode. Include a pattern library, drawing and stamping tools, population and entropy charts, rule mutation search, and puzzle scenarios (build an oscillator, a glider gun, a working wire circuit).

17. **Market Microstructure Sim**: A limit order book with depth chart and time-and-sales tape, populated by market makers, momentum traders, mean-reverters, noise traders, informed traders, and HFT agents. Model a latent fundamental value with news shocks, spread and slippage, volatility clustering, flash crashes, and circuit breakers. Include a player-trader mode with P&L, inventory risk, and margin calls.

18. **Mars Habitat Life Support**: A closed-loop ECLSS simulation tracking O2, CO2, and N2 partial pressures, water recycling, electrolysis and Sabatier reactors, power (solar, RTG, batteries) under dust accumulation, thermal control, crop modules and food stores, and crew agents with health, sleep, stress, and skills. Add component wear, failure cascades, EVA missions, and resupply windows. Capstone: a long dust storm.

19. **Reactor Control Room**: A point-kinetics plus thermal-hydraulics reactor with control rods, neutron flux, delayed neutrons, reactivity coefficients, xenon-135 poisoning, coolant loops, steam generators, turbine load following, pumps and valves, an alarm panel, and SCRAM logic. Include fault injection and an escalating incident campaign from startup to a station blackout.

20. **Erosion & Watershed Sim**: A heightfield with rainfall, hydraulic and thermal erosion, sediment transport and deposition, river and lake formation, groundwater, and vegetation that stabilizes soil. Let the user build dams, levees, and terraces, then run flood events and geological time-lapses. Score on farmland preserved and flood damage avoided.

21. **Tectonic Planet Builder**: A deep-time planet simulation with mantle convection, plate motion, spreading ridges, subduction, orogeny, volcanism, hotspots, and isostasy, feeding into erosion, climate bands, and ocean currents derived from the resulting geography. Include million-year time-lapse playback, a cross-section view, and a supercontinent-cycle capstone.

22. **Crowd Evacuation Sim**: Social-force pedestrians in editable venues (stadium, metro station, mall) with exits, signage, bottlenecks, panic contagion, injury and crush risk, staff marshals, spreading fire and smoke, and mixed-mobility agents. Provide density heat maps, evacuation-time curves, and a design-test-iterate loop scored against code-compliance targets.

23. **Approach Control Sim**: A radar-scope air traffic control simulation with arrivals and departures, heading/speed/altitude commands, separation minima with conflict alerts, holding stacks, ILS sequencing, runway occupancy, wake-turbulence categories, fuel states and emergencies, weather and go-arounds, and handoffs. Traffic volume escalates per shift.

24. **Rail Network Dispatcher**: A block-signalled railway with interlockings, points, timetables, freight versus passenger priority, realistic acceleration and braking, station dwell times, single-track meets, delay propagation, maintenance possessions, and breakdowns. Score punctuality KPIs across escalating service patterns and a storm-disruption capstone.

25. **Immune Response Sim**: A tissue arena with pathogens (bacteria, virus, fungus) and immune agents (macrophage, neutrophil, dendritic cell, helper and cytotoxic T cells, B cells, antibodies), diffusing cytokine fields, lymph-node clonal selection, memory formation, inflammation damage, fever, vaccination, and failure modes such as sepsis, immunosuppression, and autoimmunity. Campaign of repeated and evolving infections.

26. **Spiking Neural Lab**: Izhikevich or leaky-integrate-and-fire neurons with excitatory/inhibitory balance, STDP learning, configurable topologies (random, small-world, modular), stimulation electrodes, raster plots, population-rate and oscillation spectra, and failure states (seizure, silence). Include tasks: pattern memory, central pattern generator, and a simple classifier.

27. **Forest Dynamics Sim**: An individual-tree forest with species traits (shade tolerance, growth rate, longevity), light competition, soil water and nutrients, seed dispersal, and centuries-long succession. Add disturbances (fire, windthrow, beetle outbreak, drought), wildlife, and management actions (thinning, planting, harvest rotation), scored on timber yield, biodiversity, and carbon storage.

28. **Coral Reef Sim**: A reef benthos model with coral species, macroalgae, herbivorous fish, predators, urchins, nutrient loading, turbidity, sea-surface temperature with marine heatwaves, bleaching and recovery, acidification, crown-of-thorns outbreaks, fishing pressure, and marine-protected-area zoning. Score decade-scale reef resilience.

29. **Fishery Commons Sim**: An age-structured multi-species stock model over a sea map with recruitment, migration, and competing AI fleets that invest in effort and technology. Include quotas, seasons, enforcement and poaching, fuel and market prices, dependent port economies, bycatch, and collapse/recovery dynamics. Score across stakeholder perspectives simultaneously.

30. **Genetics Breeding Lab**: Diploid organisms with multiple loci, dominance, codominance, epistasis, linkage and recombination, sex linkage, polygenic traits with heritability, mutation, drift in small populations, and inbreeding depression. Provide a pedigree viewer, Punnett and Hardy–Weinberg tools, selection programs, and breeding-target challenges with limited generations.

31. **Soft Body Physics Lab**: A Verlet mass-spring sandbox with tearable pinned cloth, pressurized soft bodies, ropes, rigid composites, collisions and friction, wind and buoyancy, and live stiffness/damping controls. Add cutting tools, stress coloring, structural members that fail under load, and engineering challenges such as bridge-under-load and crane-lift.

32. **Granular Matter Lab**: A particle-based grain simulation covering angle of repose, avalanches, hopper discharge with arching and jamming, silo wall pressure, Brazil-nut segregation, compaction, cohesion from moisture, and industrial equipment (conveyors, mixers, screens). Include throughput-target scenarios and a silo-collapse failure mode.

33. **Rocket Ascent Lab**: A multi-stage launch simulation with thrust curves, mass flow and staging, atmospheric density and drag, max-Q, gravity-turn guidance (manual or tunable PID autopilot), aerodynamic stability, engine-out failures, abort modes, and orbital insertion accuracy. Include a vehicle designer whose choices feed directly into the flight model.

34. **Water Network Sim**: A municipal water system with reservoirs, pumps, pressure zones, a pipe network with head loss, storage tanks, diurnal demand patterns, leaks and main bursts, chlorine decay and water quality, contamination events, and a maintenance budget. Score pressure and quality compliance across city-growth scenarios.

35. **Warehouse Robotics Sim**: A grid warehouse with shelf-lifting robots, multi-agent pathfinding, deadlock detection and resolution, incoming order streams, pick stations, battery charging, inventory slotting strategies, and congestion analytics. Include a layout editor, robot failures, and a peak-season throughput capstone.

36. **ER Triage Sim**: An emergency-department queueing simulation with stochastic arrivals, acuity triage, beds, doctors and nurses on fatiguing shifts, shared lab and imaging resources, treatment pathways, admissions and boarding, and outcome statistics (length of stay, left-without-being-seen, mortality). Make staffing and budget decisions between shifts; capstone is a mass-casualty incident.

37. **Opinion Dynamics Sim**: A social network of agents with opinions, confidence, and stubbornness under bounded-confidence, voter, and threshold models. Add a recommendation algorithm shaping exposure, influencers and bot accounts, misinformation with fact-checking, polarization metrics, and cluster visualization. Interventions (moderation, friction, feed diversity) trade engagement against polarization.

38. **Cultural Evolution Sim**: Populations on a map transmitting traits, words, and technologies with innovation, copying error, prestige bias, conformity, migration, trade routes, and isolation. Visualize dialect trees and trait phylogenies, trait extinction, and environment-driven selection. Capstone: reconstruct a hidden ground-truth tree from observed data.

39. **Molecular Dynamics Lab**: A Lennard-Jones particle simulation with thermostats, pressure and volume control, solid/liquid/gas phase transitions, radial distribution function, energy and temperature traces, diffusion-coefficient measurement, binary mixtures, surface tension, and nucleation. Frame progression as a series of lab assignments with measurement tolerances.

40. **Building Thermal Lab**: Heat transfer through a building cross-section with conduction via R-values, convection, solar gain by sun angle and season, thermal mass, infiltration, and HVAC including thermostat hysteresis and heat-pump COP versus outdoor temperature. Simulate occupants and appliances over a weather year, scoring energy cost and thermal comfort, with a retrofit upgrade tree.

41. **Climate Sandbox**: A latitude-banded energy-balance climate model with ice-albedo feedback, greenhouse forcing, a carbon cycle across atmosphere, ocean, biosphere, and fossil reserves, ocean heat uptake lag, emissions scenarios and policy levers, tipping points (ice sheets, permafrost, AMOC), and an economic damage function. Challenge: hit a temperature target under political and budget constraints.

42. **Pollinator Network Sim**: A landscape of flower patches with bloom phenology and bee colonies whose foragers scout, exploit, and recruit via waggle dance. Model nectar and pollen economies, colony energy and brood cycles, pesticide exposure with sublethal effects, varroa and disease, habitat fragmentation, and crop pollination yield, with colony collapse as the failure state.

43. **Physarum Network Lab**: A slime-mold transport-network model combining agent deposition on a diffusing, decaying trail field with a tube-adaptation flow model. Include food nodes, network pruning, efficiency-versus-robustness metrics, obstacles and repellents, scenario maps (recreate a city rail network), and comparison against shortest-path and minimum-spanning-tree baselines.

44. **Bioreactor & Resistance Lab**: A chemostat and petri-dish simulation with bacterial strains, Monod growth kinetics, nutrient limitation, mutation to antibiotic resistance, plasmids and horizontal gene transfer, dosing schedules, biofilms, spatial antibiotic gradients (MEGA-plate), contamination, and phage therapy. Challenge: clear the infection without breeding a superbug.

45. **Match Engine Sim**: A tactical football simulation with 22 agents carrying attributes (pace, passing, decision, stamina), formations and roles, pressing triggers and defensive lines, off-ball runs, a possession and expected-goals model, substitutions, fatigue and injury, weather and pitch condition, and mid-match manager instructions. Include a commentary feed, heat maps, pass networks, and a season campaign.

46. **Evolved Walkers Lab**: Two-dimensional rigid-body creatures with evolvable morphology (segments, joints, limits) and controllers (coupled oscillators or neural nets), optimized by a genetic algorithm with elitism, crossover, and mutation. Include multiple fitness functions (distance, jump height, carry, climb), varied terrain, population and fitness charts, manual breeding, and hall-of-fame playback.

47. **Galaxy Formation Sim**: A Barnes–Hut N-body simulation with a dark-matter halo, gas particles with cooling, density-threshold star formation, supernova feedback, stellar aging and color, spiral density waves, galaxy mergers, and central black-hole accretion. Include scenarios (disk formation, collision, cluster assembly) and conservation-of-energy telemetry.

48. **Aquaponics Loop Sim**: A closed system coupling a fish tank (stocking density, feed, growth, ammonia excretion), a biofilter running the nitrogen cycle (ammonia → nitrite → nitrate), and plant beds consuming nitrate, with pH, dissolved oxygen, and temperature coupling, pumps and power, disease outbreaks, harvest scheduling, and market sales. Features cascade-failure scenarios and a year-long profitability goal.

49. **Macroeconomy Sandbox**: An agent-based economy with households (labor supply, consumption, savings), firms (production, pricing, hiring, inventories), banks (lending, interest, defaults), a central bank (rate policy, inflation targeting), and a government (taxes, spending, debt), interacting through goods, labor, and credit markets. Generate endogenous business cycles, apply shocks (oil, pandemic, technology), and chart Phillips and Lorenz curves under policy-steering challenges.

50. **Data Center Ops Sim**: Racks of servers running workloads with CPU utilization driving heat, an airflow and CRAC cooling model with hot/cold aisles, power draw and PUE, UPS and generator failover, load balancing and autoscaling, latency and SLA tracking, hardware failure rates, maintenance windows, and cost accounting. Capstone events: a traffic spike during a cooling failure.

51. **Ecosystem Dynamics**: A 2D world with grass, rabbits, foxes, and scavengers driven by energy budgets, reproduction, aging, hunger, and genetic traits (speed, vision, metabolism) that mutate across generations. Include seasons affecting plant growth, droughts, disease outbreaks, carrying capacity, territory behavior, and population graphs showing predator-prey oscillations. User tools: spawn/cull species, plant food, trigger disasters, tag and follow an individual. Capstone scenario: survive 20 generations through an ice age without extinction.

52. **Ant Colony**: Agent-based ants with pheromone trail deposition and evaporation, foraging, nest building, brood care, castes (worker, soldier, queen), food sources that deplete and respawn, predators, rain washing away trails, tunnel digging, and inter-colony warfare with 2+ rival colonies. Visualize pheromone heatmaps. User tools: place food, obstacles, and rival nests.

53. **Traffic Flow**: A road network with car agents using car-following and lane-change models, traffic lights (fixed vs. adaptive timing), intersections, roundabouts, highway on-ramps, phantom traffic jams emerging from density, accidents and rubbernecking, rush-hour demand curves, pedestrians, and an emissions overlay. User tools: edit roads, retime lights, drop incidents. Measure average commute time and throughput.

54. **Epidemic Spread**: An SEIR-style disease moving through an agent population with homes, workplaces, schools, and social hubs; viral mutation strains, incubation, asymptomatic carriers, immunity waning, hospital capacity, deaths, and interventions (masks, lockdowns, vaccines, quarantine, contact tracing) each with compliance rates and economic cost. Charts: curves per strain, Rt over time. Capstone: eradicate a mutating pathogen before health system collapse.

55. **Weather & Climate Cell**: A grid-based atmosphere with temperature, pressure, humidity, wind vectors, evaporation, cloud formation, precipitation, and terrain (mountains forcing rain shadows, oceans moderating temperature). Include a day/night cycle, seasons, storm cells, flooding, drought, and a long-term CO₂ slider shifting the climate baseline. Overlays for each field. User tools: seed clouds, raise terrain, heat regions.

56. **Orbital Mechanics Sandbox**: N-body gravity with planets, moons, asteroids, and comets; stable orbits, slingshot maneuvers, Lagrange-point behavior, collisions with merging and debris, tidal disruption near massive bodies, and a launch tool with velocity vector preview and trajectory prediction lines. Scenarios: build a stable solar system, binary stars, capture a rogue planet, deflect an asteroid headed for an inhabited world.

57. **Evolution Lab**: Creatures with genomes encoding body size, limbs/speed, diet, camouflage, and behavior weights; natural selection via food scarcity, predation, climate zones, sexual selection with mate choice, speciation when populations isolate, and a family-tree/phylogeny view. User tools: split continents, change climate, introduce invasive species, selectively breed. Track trait distributions over generations with histograms.

58. **Fluid Dynamics Playground**: A real-time 2D fluid solver (grid-based or SPH) with velocity, density, and dye advection; obstacles, fans, sources/sinks, buoyancy from temperature, vortex shedding, multiple immiscible fluids with different viscosity/density, and pressure visualization. Scenarios: wind tunnel around user-drawn shapes, lava lamp, dam break, smoke stack. User draws walls and injects fluid with the mouse.

59. **City Growth**: An emergent urban model where residents, businesses, and industry locate themselves based on land value, road access, jobs, pollution, and rent — no direct zoning by the user. Include road network growth, density gradients, gentrification waves, sprawl vs. infill, commute simulation feeding congestion back into land value, and era progression (1900 → 2050). User tools: build roads/transit/parks, set tax policy, and watch the city respond.

60. **Market Economy**: Agent-based producers, consumers, and traders with supply/demand price discovery per good (food, fuel, tools, luxury), production chains, labor market and wages, banks with credit and interest, inflation, boom-bust cycles, bankruptcies, and external shocks (crop failure, resource discovery). Charts: price history, GDP, inequality (Gini). User tools: set central-bank rate, taxes, subsidies, print money — then watch consequences.

61. **Flocking & Swarms**: Boids with separation/alignment/cohesion plus predator avoidance, obstacle fields, wind, goal seeking, species with different flock parameters (starlings, fish schools, insect swarms), predators that learn to attack stragglers, energy and rest mechanics, and murmuration pattern emergence. User tools: steer a predator, place roosts and obstacles, tune each rule weight live with visible behavioral shifts.

62. **Wildfire**: A terrain grid with vegetation types (grass, shrub, forest, dead fuel) each with moisture, fuel load, and flammability; wind direction/strength, slope effects, ember spotting ahead of the front, humidity and weather fronts, firebreaks, backburns, air tankers, and evacuation of settlements. Scenarios from controlled burn to megafire. Score: acres saved, structures protected, suppression budget.

63. **Planet Forge (Geology)**: A planet cross-section/surface with plate tectonics (drift, subduction, rifting), mountain building, volcanism, erosion by rain and rivers, sediment deposition, sea level, ice caps, and a deep-time clock (millions of years per second). Watch continents drift, collide, and split. Overlays: elevation, plate boundaries, rock age, biome potential. Capstone: evolve a supercontinent cycle.

64. **Neural Evolution Arena**: Agents with small neural-network brains learning to navigate, forage, and avoid hazards via genetic algorithms — selection, crossover, mutation rate control, fitness functions the user can edit, generation-by-generation improvement graphs, a brain visualizer (live neuron activations for a selected agent), and escalating obstacle courses. Capstone: evolve agents that complete a gauntlet no hand-coded policy solves.

65. **Slime Mold Network**: Physarum-style particle agents depositing and sensing trails, forming efficient transport networks between food nodes; nutrient flow along established tubes, network pruning, obstacle avoidance, and comparison mode overlaying the real Tokyo-rail-style optimal network. User tools: place food (cities), hazards (lakes), and light (repellent). Measure network efficiency vs. total length.

66. **Crowd Evacuation**: A building floor plan with pedestrian agents using social-force movement, exits with capacity limits, bottleneck congestion, panic contagion raising speed and shoving, smoke spreading and reducing visibility, trampling risk at high density, signage and lighting affecting route choice, and staff agents directing flow. User tools: edit walls/exits/signs, start fires, run drills. Score: evacuation time and casualties across 5+ venue layouts.

67. **Power Grid**: Generators (coal, gas, nuclear, wind, solar, hydro) with ramp rates and costs, transmission lines with capacity and losses, demand curves by hour and weather, frequency stability, battery storage, blackout cascades when lines trip, renewable intermittency, and a carbon tracker. User tools: build/dispatch plants, set prices. Scenarios: heatwave peak, storm damage, 100%-renewable transition without a blackout.

68. **Terrain & Erosion**: Procedural heightmap sculpted by hydraulic erosion (rainfall, river carving, sediment transport and deposition), thermal weathering, deltas and alluvial fans, lakes with outflow, vegetation stabilizing slopes, and glaciers carving valleys. Time-lapse controls, cross-section view, flow-accumulation overlay. User tools: raise/lower land, change rainfall patterns, plant forests, dam rivers.

69. **Beehive**: A hive cross-section plus foraging field; bees with roles (forager, nurse, builder, guard, queen) switching by colony need, waggle-dance information sharing directing foragers to flower patches with varying nectar quality, comb construction, brood rearing, honey stores vs. winter survival, swarming when crowded, wasrespiders, pesticide-exposed zones, and seasonal bloom cycles. Capstone: survive two winters and successfully swarm.

70. **Coral Reef**: Coral polyps competing for substrate with growth, bleaching under heat stress, symbiotic algae, herbivorous fish controlling seaweed, predators (crown-of-thorns outbreaks), spawning events, ocean temperature and acidity sliders, storms breaking structure, and reef recovery dynamics. Biodiversity index and coral-cover charts. User tools: restock fish, shade/cool water, cull predators, transplant coral.

71. **Galaxy Formation**: Tens of thousands of star particles under gravity (Barnes-Hut or similar) forming spiral arms, galactic collisions and mergers, star formation in dense gas regions, stellar lifecycle colors (blue young → red old), supernovae enriching nearby gas, central black hole dynamics, and dark-matter halo toggle showing rotation-curve differences. Scenarios: two-galaxy collision, cluster dance, lone spiral over 10 Gyr.

72. **Cellular Automata Lab**: Conway's Life plus a rule editor (any B/S rule), multi-state automata (Wireworld, Brian's Brain, Langton's Ant, forest-fire CA), a pattern library (gliders, guns, oscillators) with stamp placement, hex-grid variant, statistics (population, entropy, activity), speed/step controls, and a challenge mode: engineer a pattern that reaches a target cell or survives N generations. Include a rule-space explorer that mutates rules and shows thumbnails.

73. **Chemistry Sandbox**: Particle-based elements with bonds, temperature-driven states (solid/liquid/gas), reactions with activation energy (combustion, acid+base, oxidation, polymerization), catalysts, exo/endothermic heat feedback, pressure in sealed containers, and emergent phenomena (crystallization, explosions, diffusion). User tools: pour elements, heat/cool regions, seal vessels. A reaction log identifies compounds formed; a periodic-palette of 12+ substances.

74. **Food Web Cascade**: A multi-trophic network (plants, 3+ herbivores, 2+ mesopredators, apex predator, decomposers) where removing or boosting any node cascades through the web; nutrient cycling through soil, population dynamics per species, invasive-species introduction, keystone-species discovery, and a live network diagram with flow thickness showing energy transfer. Scenarios: Yellowstone wolf reintroduction, invasive cane toad, fishery collapse.

75. **Migration Journey**: A continental map with migratory bird flocks navigating via energy reserves, stopover habitat quality, weather systems (headwinds, storms), predation, daylight cues triggering departure, habitat loss over years, and population tracking across breeding/wintering grounds. User tools: protect/restore stopover sites, alter climate, tag a flock. Capstone: keep three species' populations stable for 10 migratory years.

76. **Stock Market Agents**: Trader agents with strategies (value, momentum, noise, contrarian, market-maker) buying/selling 5+ securities; order-book price formation, bubbles and crashes emerging from herding, leverage and margin calls, news shocks, circuit breakers, a strategy-performance leaderboard, and the ability for the user to design a bot (parameterized strategy) and inject it. Charts: candlesticks, volume, volatility, strategy P&L.

77. **Volcano**: A magma chamber with pressure buildup from gas content and recharge rate, conduit dynamics, eruption styles (effusive lava flows vs. explosive plinian columns) determined by viscosity and gas, lava flow over terrain, ash clouds with wind dispersal, pyroclastic flows, lahars when ash meets rain, a seismograph with precursor signals, and towns needing evacuation calls. Score: lives saved vs. false-alarm cost across 5+ volcano profiles.

78. **River Delta**: Water and sediment flowing into a basin, channel formation, avulsion (channels jumping course), levee building, floodplain deposition, vegetation stabilizing banks, sea-level change, upstream dams starving sediment, and human levees constraining the river with consequent land loss. Time-lapse delta growth with age-colored deposits. Scenarios: Mississippi-style management dilemma, natural wild delta.

79. **Garden Growth (L-Systems)**: Plants grown from L-system grammars with genes for branching angle, growth rate, leaf shape, and flowering; sunlight competition with real shadow casting, water and nutrients in soil voxels, pollinators moving genes between plants, pests and companion planting, seasons, grafting, and selective breeding toward user goals (tallest, most flowers, strangest shape). A genome editor for direct grammar tinkering.

80. **Ocean Gyre & Plastic**: Ocean current simulation with wind-driven gyres, thermohaline flow, plastic particles entering from river mouths, degradation into microplastics, accumulation into garbage patches, marine life ingestion affecting the food chain (link to a simple ecosystem layer), cleanup technologies (booms, vessels, river interceptors) with costs, and policy levers reducing input. Charts: patch mass over decades, wildlife impact.

81. **Falling-Sand World**: A large-grid particle simulation with 15+ materials (sand, water, oil, fire, lava, steam, ice, plant, acid, gunpowder, metal, wood, salt, gas, virus-ish "spore") and rich pairwise interactions (fire ignites oil, water+lava→stone+steam, acid dissolves metal, plants grow toward water, spores infect plants). Temperature field, pressure, electricity through metal, and user drawing tools with brush sizes. Scenario puzzles: route water to a target, extinguish a spreading fire, grow a garden in a cave.

82. **Rocket Flight**: Full launch-to-orbit physics — thrust curves, fuel mass depletion, staging, atmospheric drag with density falloff, gravity turn, orbital insertion, apoapsis/periapsis display, re-entry heating, parachutes, and a vehicle assembly screen (engines, tanks, fairings with mass/cost tradeoffs). Scenarios: reach orbit, geostationary transfer, rescue a stranded satellite, land a booster back on the pad. Delta-v budget readout.

83. **Demographics Century**: A population pyramid evolving over 100+ years from fertility, mortality by age, immigration, education affecting fertility, pension/dependency ratios, epidemics, baby booms, urbanization, and policy levers (childcare support, retirement age, immigration quotas) with lagged effects. Compare 3 countries side-by-side. Capstone: steer an aging society through the demographic transition without pension collapse.

84. **Language Spread**: A map of communities speaking evolving languages; word mutation and borrowing on contact, trade routes accelerating exchange, prestige dialects spreading from cities, geographic barriers creating divergence, writing systems slowing change, conquests imposing languages, extinction of minority tongues, and a family-tree view of language phylogeny with a sample-word tracker ("water" across 500 years).

85. **Supply Chain**: Factories, warehouses, ports, trucks, and ships moving 5+ goods through a network with lead times, inventory holding costs, the bullwhip effect amplifying demand noise upstream, port congestion, disruptions (strikes, storms, canal blockage), just-in-time vs. buffer-stock strategies, and perishable goods. User tools: place facilities, set reorder policies, reroute. Score: service level vs. total cost over a simulated year of shocks.

86. **Immune System**: A tissue-level battle — pathogens (bacteria, 2+ virus types, parasite) replicating with mutation vs. innate immunity (macrophages, inflammation, fever) and adaptive immunity (T-cells, B-cells, antibodies, memory cells), vaccination priming, autoimmune malfunction risk, antibiotic tools with resistance evolution, and nutrient/oxygen logistics via blood flow. Zoomable view; infection charts. Capstone: clear a mutating virus without destroying the host tissue.

87. **Ice Age Engine**: A hemisphere with ice sheets growing/retreating from temperature, albedo feedback (ice reflects → cools → more ice), Milankovitch-style orbital cycles, sea level falling as ice locks water (land bridges appear), ecosystems and megafauna shifting with the ice line, human band migration across exposed bridges, and CO₂ as a lever. Deep-time scrubber across 200k years; overlays for ice, biome, sea level.

88. **Termite Architects**: Stigmergy-based construction — termites deposit pheromone-laced soil pellets, and deposition probability rises near existing pellets, producing emergent pillars, walls, arches, and ventilated mounds; include humidity regulation, fungus farming chambers, queen chamber, predator breaches (anteater attacks) requiring repair, rain erosion, and colony energy budget. 3D or layered-2D mound view. Compare emergent mound forms across parameter settings.

89. **Predator Territories**: Wolf packs on a landscape with elk herds; pack formation, alpha dynamics, territorial scent marking and border conflicts between packs, hunting success vs. prey vigilance, elk grazing pressure shaping vegetation (trophic cascade — streamside willows recover where elk fear wolves), winter severity, dispersal of young wolves founding new packs, and ranger/poaching pressure. Map overlays: territories, vegetation health, kill sites.

90. **Aquarium Keeper**: A closed-tank ecosystem with the nitrogen cycle (ammonia → nitrite → nitrate via bacteria colonies), fish species with compatibility, aggression, and bioload, plants consuming nitrates and producing O₂ by light cycle, algae blooms, temperature/pH drift, feeding and overfeeding consequences, disease spread, filtration and water changes, and breeding. The tank runs continuously; neglect compounds. Capstone: a self-sustaining balanced tank for 60 simulated days.

91. **Opinion Dynamics**: A social network of agents with beliefs on 3+ topics, influence along edges, confirmation bias (reject distant opinions), echo-chamber formation, influencer nodes, recommendation-algorithm settings that rewire the network toward similarity or diversity, misinformation seeds with fact-check countermeasures, polarization metrics, and cascades of viral content. User tools: edit the algorithm, seed messages, add bridges between clusters. Watch consensus, fragmentation, or polarization emerge.

92. **Election Nation**: A map of districts with voter agents having multi-issue preferences; candidates positioning on issues, campaigning with limited budgets shifting local opinion, turnout driven by enthusiasm and weather, polling with sampling error vs. ground truth, media events and scandals, districting tools demonstrating gerrymandering effects on seat/vote ratios, and comparison of electoral systems (FPTP, proportional, ranked choice) on identical electorates.

93. **Petri Dish Resistance**: Bacteria colonies on a nutrient gradient growing, mutating, and competing; antibiotic application zones with concentration gradients, resistance mutations surviving and sweeping, horizontal gene transfer, bacteriophage predators co-evolving, biofilm formation protecting colonies, and the classic "mega-plate" experiment recreated (stepwise antibiotic bands). User tools: dose antibiotics, inoculate strains, introduce phages. Charts: resistance-allele frequency over time.

94. **Stellar Lifecycles**: A star-forming nebula where gas clumps collapse into stars whose mass determines color, lifetime, and fate — red dwarfs smolder, sun-likes bloom into red giants and white dwarfs, massive stars supernova leaving neutron stars/black holes and shockwaves triggering new star formation; binary interactions, planetary nebulae, metallicity enrichment across generations, and an H-R diagram plotting every star live. Scrub millions of years; click any star for its biography.

95. **Quake & Tsunami**: A subduction zone accumulating strain, stick-slip earthquake rupture with magnitude distribution (Gutenberg-Richter emerges), seismic wave propagation shaking coastal cities (building codes matter), tsunami generation and ocean propagation with shoaling at coasts, inundation over terrain, warning-system sensors buying evacuation time, and aftershock sequences. User tools: invest in codes/sensors/seawalls/drills with a fixed budget, then face a century of events. Score: casualties and cost.

96. **Pollination Web**: A meadow with 6+ flower species and 5+ pollinator species (honeybee, bumblebee, butterfly, moth, hummingbird) with trait matching (tongue length vs. flower depth, color preference, activity time), nectar economics, flowering schedules across the season, pesticide drift, habitat fragmentation, invasive flowers monopolizing pollinators, and co-extinction cascades when links break. Live bipartite network diagram. Capstone: restore a collapsed web to full connectivity.

97. **Living Soil Farm**: A field cross-section with soil layers — organic matter, nitrogen/phosphorus/potassium pools, water table, soil microbes and earthworms, crop rotation (legumes fixing nitrogen), cover crops, tillage destroying structure, erosion from rain on bare soil, fertilizer runoff causing downstream algae blooms, pests and beneficial insects, and multi-year yield consequences. Manage 10 seasons; short-term yield vs. long-term soil health tension is the core dilemma.

98. **Chaos Laboratory**: A gallery of chaotic systems — double pendulum (with N-pendulum option), three-body problem, Lorenz attractor, logistic map with bifurcation diagram, magnetic pendulum basins of attraction — each with butterfly-effect demos (run 100 near-identical copies and watch divergence), Lyapunov time readouts, phase-space views, parameter sweeps rendering fractal structure, and a prediction mini-challenge: guess the outcome, learn why you can't.

99. **Microbial Mat (Origin of Life)**: A chemical soup where simple particles form bonds into chains, some chains catalyze copying of similar chains (autocatalysis), replication with errors creating variation, resource competition selecting efficient replicators, membranes forming protocells that divide, parasitic sequences exploiting hosts driving an arms race, and environmental cycling (wet/dry, hot vents) as the engine. Watch evolution bootstrap from chemistry; lineage tracker from first replicator onward.

100. **Mars Habitat**: A closed-loop life-support colony sim — O₂/CO₂ balance via algae and scrubbers, water recycling, greenhouse crops with grow lights, solar power vs. dust storms, battery reserves, habitat heat loss at night, equipment wear and spare parts, crew health/morale/workload scheduling, EVA risks (radiation, suit damage), resupply windows every 26 months, and cascading failures (a dust storm cuts power → heaters fail → crops die → O₂ drops). Capstone: reach self-sufficiency before resupply ends.

---

# Tools & Action Boundaries

## Allowed

- Standard HTML, CSS, and JavaScript.
- Canvas 2D, SVG, WebGL, DOM-based interfaces, or a combination.
- External libraries through reliable CDN links, such as Three.js, Phaser, Matter.js, or Chart.js.
- Procedural graphics, icons, emoji, CSS shapes, and code-generated visual assets.
- Web Audio API for all sounds and ambient audio.
- `localStorage` for progress, preferences, settings, scenarios, and statistics.
- Deterministic random seeds for reproducible simulations.
- Responsive layouts and accessible controls.

## Not Allowed

- Placeholder comments, TODO stubs, fake systems, or unimplemented menu items.
- Dead buttons or controls that do nothing.
- External asset files requiring separate hosting, except reliable CDN libraries or web fonts with system fallbacks.
- Asking for clarification.
- Delivering a partial implementation.
- Using React or TypeScript for the core simulation logic or main application body.
- Presenting static charts or numbers that are not connected to the simulation state.

## Priority Order

If constraints conflict, follow this order:

1. A fully working, complete simulation.
2. Correct and understandable system interactions.
3. Feature richness and meaningful decisions.
4. Clear visualization and feedback.
5. Presentation polish and additional content.

---

# Technical Requirements

- Use `requestAnimationFrame` for the main update and rendering loop.
- Use delta time so simulation behavior remains stable across frame rates.
- Separate simulation updates from rendering where practical.
- Support pause, resume, and multiple simulation speeds.
- Handle browser tab blur by pausing or safely reducing simulation speed.
- Handle window resizing without breaking the layout or simulation.
- Guard against empty arrays, invalid values, division by zero, runaway populations, and unavailable `localStorage`.
- Avoid duplicate animation loops, event listeners, timers, and audio nodes after restarting.
- Ensure all major buttons and keyboard shortcuts work.
- Include a seeded reset or reproducible scenario where appropriate.
- Keep performance stable with many entities, particles, events, or chart updates.

---

# Required Interface States

The application must include:

- Title screen
- Scenario or difficulty selection
- New simulation flow
- Interactive onboarding or help screen
- Main simulation interface
- Pause menu
- Settings panel
- Audio mute and volume controls
- Simulation speed controls
- Save/load or persistent progress behavior
- Event log or notification system
- Statistics and charts
- Success, completion, stability, or milestone screen
- Failure, collapse, bankruptcy, or crisis screen where appropriate
- Restart and return-to-title flows

The exact end states may vary by simulation. For example:

- A city may reach a population or happiness target.
- A colony may become self-sufficient.
- An ecosystem may recover biodiversity.
- A business may reach a valuation goal.
- A disaster scenario may be successfully stabilized.
- A factory may fulfill a major contract.
- A failure state may involve bankruptcy, extinction, collapse, contamination, or loss of public trust.

---

# Output

Deliver the complete implementation as HTML, CSS, and JavaScript. A single self-contained HTML file is preferred unless multiple files are clearly necessary.

After the code, include a brief summary of no more than 150 words covering:

- The selected simulation
- The controls
- The core interacting systems
- The progression and scenario structure
- The main success and failure conditions

---

# Definition of Done

Verify each item before presenting the implementation:

- [ ] Launch: the file opens without console errors and displays a responsive title screen.
- [ ] Start: starting a simulation initializes all state correctly.
- [ ] Onboarding: tutorial or help is accessible and explains the controls and major systems.
- [ ] Core loop: the user can take actions, advance time, observe consequences, and respond.
- [ ] Systems: at least four interconnected systems visibly influence one another.
- [ ] Simulation: entities, resources, processes, events, or populations update continuously.
- [ ] Progression: upgrades, research, milestones, unlocks, or scenario advancement function correctly.
- [ ] Variety: at least five distinct entities, resources, events, facilities, processes, or scenarios exist.
- [ ] Scaling: at least three difficulty settings, scenarios, or modifiers change the simulation.
- [ ] Capstone: a reachable long-term target, crisis, milestone, or scenario objective exists.
- [ ] Success: completion triggers a clear success or milestone screen with statistics.
- [ ] Failure: collapse, loss, or failure is reachable where appropriate and clearly communicated.
- [ ] Restart: restarting fully resets state, timers, listeners, entities, and audio without leaks.
- [ ] Pause/settings: pause, resume, speed, volume, mute, and difficulty controls work.
- [ ] Persistence: settings and appropriate progression persist through `localStorage`.
- [ ] Audio: synthesized sound and ambient or reactive audio work with mute/volume controls.
- [ ] Feedback: animations, easing, alerts, floating values, charts, or visual effects communicate changes.
- [ ] Performance: the simulation uses `requestAnimationFrame` with delta time and remains responsive.
- [ ] Robustness: edge cases, invalid values, unavailable storage, resizing, and tab switching are handled.
- [ ] Responsive UX: the interface remains usable across desktop and smaller window sizes.

Build simulation idea #1.
