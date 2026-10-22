I'll build #11 Power Grid Operator as a single file: a live map of the transmission network, plants dispatched cheapest-first, frequency changes, line overloads that can cascade, weather, the electricity market, a tech tree, 5 scenarios and a heatwave capstone.


Created index.html
Next I'm fixing the right-hand panel: it refreshes several times a second, which could make its buttons miss clicks. I'll skip that refresh while the pointer is over the panel.


Edited index.html
+1
-2

Edited index.html
+1
-1
I built GridOps: Power Grid Operator (#11) as a single file, index.html. I haven't run it in a browser, so I haven't confirmed it loads without console errors or checked the game balance. After writing it, I fixed one bug: the right-hand panel refreshed several times a second and could make its buttons miss clicks, so it now pauses refreshing while the pointer is over it.

Controls: Click or tap plants, cities and lines to inspect them. To build, pick a plant type, then click an empty site. Space pauses, 1–4 set speed (½×–4×), D toggles demand response, L toggles line labels, H opens help, M mutes, Esc opens the menu. The pause menu has save, settings, restart and return to title.
Systems: Daily demand curves that rise with heat; cheapest-first dispatch with limited ramp rates; grid frequency tied to inertia, with automatic load shedding; power flow across the network, where overloaded lines heat up and trip, spreading the load and splitting off cities; weather driving wind, solar and hydro; plant wear, faults and maintenance; money, market price and carbon tax.
Progression: Five scenarios: tutorial, Boomtown, Storm Season, Carbon Cap and a Heatwave capstone with a nuclear trip at peak demand. Three difficulties, seeded runs, and a tech tree that carries over between runs, paid for with points earned by finishing scenarios.
Win: survive every day at the target reliability. Lose: a total blackout, bankruptcy, going over the carbon cap, or missing the reliability target.
