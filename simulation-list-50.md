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

1. **City Builder and Infrastructure**
   Build a growing city by zoning residential, commercial, and industrial areas. Manage roads, traffic, electricity, water, waste, police, fire protection, healthcare, education, taxation, pollution, land value, and citizen happiness. Add disasters, population milestones, landmarks, and budget reports.

2. **Ecosystem Evolution**
   Manage a procedurally generated ecosystem containing plants, herbivores, predators, decomposers, weather, seasons, disease, and habitat changes. Introduce or remove species and observe population cycles, food-web collapse, biodiversity, migration, and ecological recovery.

3. **Mars Colony Management**
   Establish a settlement on Mars. Balance oxygen, water, food, energy, shelter, morale, research, mining, radiation protection, rover exploration, and supply launches. Manage dust storms, equipment failure, colonist skills, and the long-term goal of becoming self-sufficient.

4. **Railway Logistics Network**
   Design a railway network connecting mines, farms, factories, ports, and cities. Manage tracks, signals, trains, cargo priorities, fuel or electricity, maintenance, congestion, schedules, and economic demand. Expand from a local line into a regional logistics system.

5. **Small Farm and Soil Simulation**
   Operate a farm across multiple seasons. Manage soil nutrients, crop rotation, irrigation, weather, pests, livestock, machinery, labor, storage, contracts, and market prices. Long-term soil health should affect yield and profitability.

6. **Hospital Operations**
   Manage a hospital with departments, beds, doctors, nurses, equipment, triage, patient queues, supplies, finances, staff fatigue, infection control, and emergency surges. Improve reputation and outcomes while avoiding burnout and insolvency.

7. **Aquarium Ecosystem**
   Design and operate a public aquarium. Balance tank capacity, species compatibility, water chemistry, temperature, filtration, feeding, breeding, disease, visitors, ticket pricing, staff, conservation programs, and operating costs.

8. **Wildlife Reserve**
   Create and manage a protected reserve. Allocate habitats, water sources, ranger patrols, conservation funds, visitor facilities, anti-poaching operations, fire management, and reintroduction programs. Track animal populations and biodiversity over time.

9. **Factory Production Planner**
   Build a manufacturing operation with extraction, processing, assembly, storage, transport, power consumption, worker shifts, machine maintenance, quality control, contracts, and fluctuating demand. Optimize throughput while handling breakdowns and supply shortages.

10. **Coastal Port Authority**
    Manage a busy port with berths, cranes, warehouses, customs, truck routes, ships, storms, labor, fuel, safety, and international trade. Improve throughput and revenue without causing congestion, pollution, or accidents.

11. **Disaster Response Coordinator**
    Coordinate emergency response after earthquakes, floods, wildfires, storms, or industrial accidents. Deploy rescue teams, shelters, medical units, supplies, utilities, volunteers, and evacuation routes while conditions change dynamically.

12. **University Management**
    Run a university with students, faculty, departments, housing, research grants, tuition, scholarships, campus facilities, academic reputation, student wellbeing, and staffing. Balance short-term finances against long-term educational and research outcomes.

13. **Renewable Energy Grid**
    Build and operate a regional energy network using solar, wind, hydro, batteries, backup generators, and transmission lines. Balance generation and demand as weather changes, while managing costs, blackouts, maintenance, storage, and emissions.

14. **Ant Colony Simulation**
    Guide an ant colony through exploration, food gathering, nest construction, brood care, defense, pheromone trails, caste specialization, predators, seasonal changes, and colony expansion. The colony should develop emergent behavior from simple agents.

15. **Restaurant and Supply Chain**
    Manage a restaurant from kitchen layout through menu design, ingredient sourcing, staffing, recipes, preparation times, customer preferences, food waste, reviews, pricing, and expansion. Supply disruptions and changing trends should affect the business.

16. **Island Civilization**
    Develop a small island society from a fishing village into a modern settlement. Manage population, food, housing, trade, education, industry, natural resources, politics, culture, pollution, and climate threats.

17. **Water Utility Simulator**
    Design a municipal water system with reservoirs, wells, treatment plants, pumps, pipes, leakage, demand, droughts, contamination events, maintenance, pricing, and emergency conservation policies.

18. **Space Station Operations**
    Maintain a space station with crew schedules, oxygen, water, food, power, experiments, docking, repairs, radiation, morale, waste, and module expansion. Handle emergencies and prioritize limited resources.

19. **Stock Market and Business Economy**
    Simulate a simplified economy with companies, sectors, consumers, interest rates, commodities, news events, employment, inflation, investment, and bankruptcy. Allow the user to operate a fund, company, or regulatory agency.

20. **Museum Management**
    Operate a museum by acquiring exhibits, managing conservation, arranging galleries, setting ticket prices, attracting visitors, running educational programs, handling staff, securing funding, and responding to public interest trends.

21. **Traffic and Public Transit**
    Design bus, tram, subway, and road networks for a growing metropolitan area. Model passenger demand, commuting patterns, congestion, delays, maintenance, fares, accessibility, and emissions.

22. **Beekeeping and Pollination**
    Manage apiaries, hives, queens, worker populations, forage areas, weather, disease, pesticides, honey production, pollination contracts, winter survival, and hive breeding.

23. **Archaeological Expedition**
    Lead an expedition across a procedural dig site. Manage funding, equipment, researchers, excavation priorities, artifact preservation, weather, permits, local communities, academic reputation, and uncertain discoveries.

24. **Hotel and Resort Management**
    Build and operate a hotel with rooms, restaurants, amenities, staff, bookings, guest preferences, cleanliness, maintenance, events, seasonal demand, reviews, and expansion decisions.

25. **Forest Management**
    Manage a forest over decades. Balance timber production, replanting, biodiversity, fire risk, pests, wildlife corridors, recreation, carbon storage, weather, and conservation regulations.

26. **Political Campaign and Public Policy**
    Run a campaign or govern a region while tracking demographics, public opinion, budgets, media narratives, interest groups, legislation, services, scandals, crises, and election outcomes.

27. **Airport Operations**
    Manage runways, gates, baggage handling, security, airlines, passenger flows, staffing, fuel, delays, weather, maintenance, and terminal expansion. Optimize safety, satisfaction, and profit.

28. **Aquaculture Facility**
    Operate a fish farm by managing tanks, water quality, feed, breeding, disease, growth rates, harvest schedules, energy, waste, environmental regulations, and market prices.

29. **Robot Factory and Research Lab**
    Develop robot designs, research technologies, assign production lines, manage components, test prototypes, handle failures, meet contracts, and compete against changing market demands.

30. **Village-to-Kingdom Settlement**
    Guide a settlement through several eras. Manage food, housing, labor, defense, trade, culture, technology, social classes, public order, diplomacy, and environmental limits while unlocking new institutions.

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
