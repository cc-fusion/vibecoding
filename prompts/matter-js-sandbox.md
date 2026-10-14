Create a comprehensive, production-grade 2D physics sandbox using Matter.js. The goal is to build an interactive laboratory that exposes the full capability of the Matter.js engine through a polished, intuitive UI.

UI: A responsive canvas viewport on the left side, and a tabbed control/properties panel on the right.
Implement save/load slots. Save states in localStorage

### Physics Engine Integration (Expose All Matter.js Features)
1. **Rigid Bodies:** Canvas tools to spawn, drag, resize, rotate, duplicate, and delete standard shapes (rectangles, circles, trapezoids) and custom concave/convex polygons (utilizing `Matter.Svg` or vertex arrays).
2. **Composite Objects:** Ability to group multiple bodies into a single composite structure.
3. **Constraints & Springs:** Tools to visually link bodies or pin them to the world using rigid links, elastic springs, and revolving pivots (`Matter.Constraint`).
4. **World Properties:** Global controls for gravity (X/Y vectors), time scale, speed, and spatial bounds.
5. **Material Properties:** Real-time property inspectors for selected bodies to modify mass, density, friction (static, air, kinetic), and restitution (bounciness).
6. **Advanced Engine Features:** Integrate and expose collision filtering (categories/masks), sensors (non-colliding triggers), sleeping bodies, and continuous collision detection (CCD) settings.

### User Interaction & Tools
- **Toolbar:** Select/Move, Spawn Shape, Draw Custom Polygon, Create Constraint, and Delete.
- **Mouse Constraints:** Fully integrated `Matter.MouseConstraint` allowing users to naturally drag, toss, and interact with objects during active simulation.
- **Simulation Controls:** Global Play, Pause, Step-Frame, and Reset buttons.

Deliver a fully functional, self-contained single-file implementation (HTML with embedded CSS and modern JavaScript). Ensure the UI is clean, modern, and built for a seamless user experience.
