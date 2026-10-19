I've built the fluid simulation as a single `index.html` using plain HTML and JavaScript, with no React or Vite. It follows the method of PavelDoGreat/WebGL-Fluid-Simulation and drops the bloom and sunrays effects. I haven't run it in a browser yet, so it's untested.

The script is split into six labelled sections:

1. **Developer settings:** all the tunable values sit in one commented object at the top of the script (grid size, how fast colour and motion fade, swirliness, pressure, splat size and force, shading, background colour, which field to display). You can also override any of them when you create the simulation.
2. **Shaders:** every fragment shader, including ones you write yourself, gets a shared header automatically. It provides the pixel position (`vUv`), the four neighbours and `texelSize`, so a new shader can be just a few lines long.
3. **Utilities:** small helpers for colours and number conversion.
4. **The `FluidSimulation` class:**
    * **Running it:** `start`, `stop`, `step(dt)`, `render`, `destroy`.
    * **Settings:** `config` can be changed live; `setConfig` rebuilds the GPU buffers when you change a resolution.
    * **Adding fluid:** `splat(x, y, dx, dy, color, {radius})`, `randomSplats`, `clear`.
    * **Reading and writing state:** `readField` and `writeField` take raw data or a function `(u, v) => [r, g, b, a]`; `sample` reads one point; `getState` and `setState` save and restore a snapshot, and resize it if the screen size has changed.
    * **Custom shader passes:** `createProgram(src)` compiles a shader, and `runPass(program, uniforms, target)` runs it. Fields passed in are bound as textures automatically, and fields that alternate between two buffers are swapped for you.
    * **Simulation steps:** each frame runs a list of named steps. You can insert your own with `addStage(name, fn, {before|after})`, or switch steps on and off with `setStageEnabled`.
    * **Custom fields:** `addField(name, {double, resolution})` adds your own data layer, which resizes with the rest.
    * **Extensions and events:** `use(ext)`, `remove(name)` and `getExtension(name)` manage plugins. Any event (`update`, `beforeStep`, `afterStep`, `beforeRender`, `afterRender`, `splat`, `resize`, `config`, …) can be a method on an extension or a listener added with `on` and `off`.
5. **Example extensions** to copy from:
    * `pointer`: mouse and touch input is itself an extension, so you can remove it.
    * `autoSplats`: adds random splats on a timer.
    * `buoyancy`: makes bright colour rise, as a custom shader step.
    * `obstacle`: a circle that blocks the fluid, drawn on top.
    * `probe`: shows the values under the cursor.
6. **Dev panel:** it's built from a short list (`PANEL_SCHEMA`), so adding a slider means adding one line. It also has extension and step toggles, buttons (random splats, clear, pause, step once, save/load state) and an on-screen readout of speed and values.

**Coordinates:** in the main functions (`splat`, `sample`), positions run from 0 to 1 with the origin at the top-left, like the page itself. `readField` and `writeField` instead use the GPU's own layout: rows run bottom to top and upward velocity is positive.

**Device limits:**
* **Reading state** (`readField`, `sample`, Save state) needs the browser to support reading floating-point data back from the GPU. Where it doesn't, those return nothing and print a warning. This is most likely on older WebGL1 devices.
* **The probe extension** reads from the GPU every frame, which can lower the frame rate.
* **The obstacle** just wipes out the fluid inside the circle rather than making it flow around, so it's a rough effect.

The simulation is available in the browser console as `window.fluid`, along with `FluidSimulation` and `FluidExtensions`.
