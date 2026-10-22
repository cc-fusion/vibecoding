I'll build a single index.html with a clean, sectioned architecture: developer config, shaders, a FluidSimulation class (with read/write, pipeline stages, custom fields, events, and plugins), example extensions, and a plain-HTML dev panel generated from a schema.


Created index.html
Next, I'll swap the &gt; entities in the API cheat sheet for plain > characters.


Edited index.html
+5
-5
I've built the fluid simulation as a single index.html using plain HTML and JavaScript, with no React or Vite. It follows the method of PavelDoGreat/WebGL-Fluid-Simulation and drops the bloom and sunrays effects. I haven't run it in a browser yet, so it's untested.

The script is split into six labelled sections:

Developer settings: all the tunable values sit in one commented object at the top of the script (grid size, how fast colour and motion fade, swirliness, pressure, splat size and force, shading, background colour, which field to display). You can also override any of them when you create the simulation.
Shaders: every fragment shader, including ones you write yourself, gets a shared header automatically. It provides the pixel position (vUv), the four neighbours and texelSize, so a new shader can be just a few lines long.
Utilities: small helpers for colours and number conversion.
The FluidSimulation class:
Running it: start, stop, step(dt), render, destroy.
Settings: config can be changed live; setConfig rebuilds the GPU buffers when you change a resolution.
Adding fluid: splat(x, y, dx, dy, color, {radius}), randomSplats, clear.
Reading and writing state: readField and writeField
