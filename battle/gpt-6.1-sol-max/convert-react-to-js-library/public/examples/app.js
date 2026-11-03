/* A complete plain-JavaScript replacement for the original React control UI. */
(async () => {
  const sceneSelect = document.querySelector("#scene");
  const status = document.querySelector("#status");
  const playButton = document.querySelector("#play");
  const wheelButton = document.querySelector("#wheel");
  const presets = ["sand", "water", "jelly", "snow"];
  for (const id of presets)
    sceneSelect.add(new Option(id[0].toUpperCase() + id.slice(1), id));
  for (const scene of MPM.scenes)
    sceneSelect.add(
      new Option(`${scene.name} (${scene.dim}D original)`, scene.id),
    );
  const sim = await MPM.create({
    canvas: "#world",
    scene: MPM.demoScene("sand"),
    interactions: { material: "sand" },
  });
  window.sim = sim;
  const bindInteraction = () => {
    if (sim.scene.dim === 2)
      sim.enableInteractions({
        material: presets.includes(sceneSelect.value)
          ? sceneSelect.value
          : "sand",
      });
    wheelButton.disabled = sim.scene.dim !== 2;
  };
  sim.on("stats", ({ particles, time, fps, simd }) => {
    status.textContent = `${particles.toLocaleString()} particles | ${time.toFixed(2)}s simulated | ${fps} render FPS | ${simd ? "SIMD" : "Scalar"} WebAssembly`;
  });
  sim.on("statechange", ({ running }) => {
    playButton.textContent = running ? "Pause" : "Play";
  });
  sim.on("error", (error) => {
    status.textContent = error.message;
  });
  sceneSelect.addEventListener("change", () => {
    try {
      sim.loadScene(
        presets.includes(sceneSelect.value)
          ? MPM.demoScene(sceneSelect.value)
          : sceneSelect.value,
      );
      bindInteraction();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  playButton.addEventListener("click", () =>
    sim.running ? sim.pause() : sim.play(),
  );
  document.querySelector("#reset").addEventListener("click", () => {
    sim.reset();
    bindInteraction();
  });
  wheelButton.addEventListener("click", () => {
    try {
      sim.addWheel({
        center: [0.5, sim.scene.world?.[1] === 0.5 ? 0.23 : 0.35],
        radius: 0.11,
        speed: 100,
      });
    } catch (error) {
      status.textContent = error.message;
    }
  });
  let gravity = true;
  document.querySelector("#gravity").addEventListener("click", () => {
    gravity = !gravity;
    sim.setGravity(
      sim.scene.dim === 3 ? [0, gravity ? -5 : 0, 0] : [0, gravity ? -2.4 : 0],
    );
    document.querySelector("#gravity").textContent = gravity
      ? "Turn gravity off"
      : "Turn gravity on";
  });
  window.addEventListener("pagehide", () => sim.destroy(), { once: true });
})().catch((error) => {
  document.querySelector("#status").textContent =
    `Initialization failed: ${error.message}`;
});
