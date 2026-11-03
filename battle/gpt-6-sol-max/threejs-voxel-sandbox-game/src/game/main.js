import * as THREE from "three";
import { B, BLOCKS, ITEMS, RECIPES, MILESTONES } from "./blocks.js";
import { World, WORLD_HEIGHT } from "./world.js";
import { Player, raycastBlocks } from "./player.js";
import { Creatures } from "./creatures.js";
import { Atmosphere } from "./atmosphere.js";
import { AudioEngine } from "./audio.js";
import { GameUI } from "./ui.js";

const INDEX_KEY = "mossbound.worlds.v1";
const SETTINGS_KEY = "mossbound.settings.v1";
const worldKey = (id) => `mossbound.world.${id}`;
const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const randomSeed = () => String(Math.floor(Math.random() * 900000000) + 100000000);
const labels = { meadow: "Windward meadow", woodland: "Deepwood", coast: "Saltwater shore", drylands: "Golden steppe", highlands: "High country" };
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

export function startGame(root) {
  const savedSettings = readJSON(SETTINGS_KEY, {});
  const settings = { sensitivity: 1, volume: 0.55, renderDistance: 3, shadows: false, reducedMotion: false, ...savedSettings };
  let worlds = readJSON(INDEX_KEY, []);
  if (!Array.isArray(worlds)) worlds = [];
  worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 320);
  const ui = new GameUI(root, {
    primary: primaryAction,
    newWorld: () => { audio.click(); ui.showCreate(worlds.length ? "Untamed Valley" : "First Light"); },
    worlds: () => { audio.click(); ui.showWorlds(worlds); },
    help: () => { audio.click(); ui.showHelp(); },
    resume: resume,
    pause: pause,
    save: () => { saveWorld(); ui.toast("World saved."); audio.click(); },
    settings: () => { audio.click(); ui.showSettings(settings); },
    title: returnToTitle,
    close: closeOverlay,
    create: createWorld,
    playWorld: loadWorld,
    deleteWorld,
    slot: selectSlot,
    assign: assignItem,
    eat: eatItem,
    craft: craftItem,
    tab: () => renderInventory(),
    sound: toggleSound,
    setting: changeSetting,
    mobile: mobileAction,
  });

  const canvas = ui.el("#world-canvas");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
  } catch (error) {
    root.innerHTML = '<div style="display:grid;place-items:center;height:100%;background:#17332f;color:#eee8d8;font:20px Georgia,serif;text-align:center;padding:30px">This wilderness needs a browser with WebGL enabled.</div>';
    console.error(error);
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.35 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x9ac1ba);
  const graphicsInfo = renderer.getContext().getExtension("WEBGL_debug_renderer_info");
  const graphicsName = graphicsInfo ? renderer.getContext().getParameter(graphicsInfo.UNMASKED_RENDERER_WEBGL) : "";
  if (/swiftshader|llvmpipe/i.test(graphicsName)) {
    if (!Object.prototype.hasOwnProperty.call(savedSettings, "renderDistance")) settings.renderDistance = 2;
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  const audio = new AudioEngine(settings.volume);
  const keys = new Set();
  const direction = new THREE.Vector3();
  const selection = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012)), new THREE.LineBasicMaterial({ color: 0xfff1ce, transparent: true, opacity: 0.92, depthTest: true }));
  selection.visible = false;
  selection.renderOrder = 4;
  scene.add(selection);
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ color: 0xe8e7bb, transparent: true, opacity: 0.22, depthWrite: false }));
  ghost.visible = false;
  ghost.renderOrder = 3;
  scene.add(ghost);
  const particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  const particleMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const particleMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, 200);
  const particleDummy = new THREE.Object3D();
  const particleColor = new THREE.Color();
  particleMesh.frustumCulled = false;
  particleDummy.position.set(0, -100, 0);
  particleDummy.scale.setScalar(0);
  particleDummy.updateMatrix();
  particleMesh.setMatrixAt(0, particleDummy.matrix);
  particleMesh.setColorAt(0, new THREE.Color("#ffffff"));
  particleMesh.count = 1;
  scene.add(particleMesh);
  const particles = [];

  let world, player, creatures, atmosphere;
  let currentId = null, currentName = "First Light";
  let inventory = {}, hotbar = Array(9).fill(null), selectedSlot = 0, durability = {}, milestones = {};
  let day = 1, timeOfDay = 0.305, weather = "clear", weatherElapsed = 0, weatherStep = 0;
  let previewBase = new THREE.Vector3(), previewLook = new THREE.Vector3();
  let targetBlock = null, targetCreature = null;
  let mining = false, miningKey = "", miningProgress = 0, miningTick = 0;
  let lastRest = -100, elapsed = 0, saveTimer = 0, statusTimer = 0;
  let lastFrame = performance.now(), frameHandle = 0, startupFrame = 0, startupTimer = 0, disposed = false;
  let touchLook = null, joystickPointer = null;
  const joystickKeys = new Set();

  function setupWorld(data) {
    if (creatures) creatures.dispose();
    if (atmosphere) atmosphere.dispose();
    if (world) world.dispose();
    particles.length = 0;
    particleMesh.count = 1;
    selection.visible = ghost.visible = false;

    currentId = data.id || null;
    currentName = data.name || "First Light";
    world = new World(scene, data.seed || "MOSSBOUND-01", data.edits || {}, settings.renderDistance);
    inventory = { dirt: 12, berry: 3, ...(data.inventory || {}) };
    hotbar = Array.isArray(data.hotbar) ? [...data.hotbar.slice(0, 9), ...Array(Math.max(0, 9 - data.hotbar.length)).fill(null)] : ["dirt", "berry", null, null, null, null, null, null, null];
    selectedSlot = Math.max(0, Math.min(8, data.selectedSlot || 0));
    durability = { ...(data.durability || {}) };
    milestones = { ...(data.milestones || {}) };
    day = data.day || 1;
    timeOfDay = Number.isFinite(data.timeOfDay) ? data.timeOfDay : 0.305;
    weather = data.weather || "clear";
    weatherElapsed = data.weatherElapsed || 0;
    weatherStep = data.weatherStep || 0;
    player = new Player(world, camera, data.player || {}, {
      onStep: (block) => audio.step(block),
      onJump: () => audio.jump(),
      onDamage: () => { audio.hurt(); ui.updateHealth(player.health); ui.toast("Ouch. Watch your step."); },
      onHeal: () => ui.updateHealth(player.health),
      onRespawn: () => { ui.updateHealth(player.health); ui.toast("A new chance to find your way."); },
    });

    const spawn = world.spawn;
    const px = spawn.x + 17.5, pz = spawn.z + 19.5;
    previewBase.set(px, Math.max(world.terrainInfo(Math.floor(px), Math.floor(pz)).height + 10, spawn.y + 13), pz);
    previewLook.set(spawn.x - 10, spawn.y + 1, spawn.z - 18);
    world.loadInitial(px, pz, settings.renderDistance > 2 ? 2 : 1);
    atmosphere = new Atmosphere(scene, world);
    atmosphere.sun.castShadow = settings.shadows;
    creatures = new Creatures(scene, world);
    setPreviewCamera();
    ui.setWorldName(currentName);
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    ui.updateHealth(player.health);
  }

  function setPreviewCamera() {
    camera.position.copy(previewBase);
    camera.position.x += Math.sin(elapsed * 0.15) * 0.6;
    camera.position.y += Math.sin(elapsed * 0.25) * 0.2;
    camera.lookAt(previewLook);
  }

  function saveWorld() {
    if (!currentId || !world || !player) return false;
    const data = {
      version: 1, id: currentId, name: currentName, seed: world.seed,
      edits: world.edits, player: player.serialize(), inventory, hotbar,
      selectedSlot, durability, milestones, day, timeOfDay,
      weather, weatherElapsed, weatherStep,
    };
    const successful = writeJSON(worldKey(currentId), data);
    if (!successful) { ui.toast("Storage is full. This world could not be saved."); return false; }
    const metadata = { id: currentId, name: currentName, seed: world.seed, day, lastPlayed: Date.now() };
    worlds = [metadata, ...worlds.filter((entry) => entry.id !== currentId)];
    writeJSON(INDEX_KEY, worlds);
    ui.setMenu(worlds);
    saveTimer = 0;
    return true;
  }

  function primaryAction() {
    audio.click();
    if (worlds.length) {
      if (currentId !== worlds[0].id) loadWorld(worlds[0].id);
      else startPlaying();
    } else {
      currentId = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      currentName = "First Light";
      ui.setWorldName(currentName);
      saveWorld();
      startPlaying();
    }
  }

  function createWorld(name, seed) {
    if (currentId) saveWorld();
    const id = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const worldName = String(name || "").trim().slice(0, 28) || "Untamed Valley";
    const worldSeed = String(seed || "").trim().slice(0, 40) || randomSeed();
    setupWorld({ id, name: worldName, seed: worldSeed });
    saveWorld();
    audio.craft();
    startPlaying();
  }

  function loadWorld(id) {
    const data = readJSON(worldKey(id), null);
    if (!data) { ui.toast("This world could not be opened."); return; }
    if (currentId) saveWorld();
    setupWorld(data);
    audio.click();
    startPlaying();
  }

  function deleteWorld(id) {
    const entry = worlds.find((item) => item.id === id);
    if (!entry || !window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    try { localStorage.removeItem(worldKey(id)); } catch { /* The list can still be updated. */ }
    worlds = worlds.filter((item) => item.id !== id);
    writeJSON(INDEX_KEY, worlds);
    if (currentId === id) setupWorld(worlds.length ? readJSON(worldKey(worlds[0].id), { seed: "MOSSBOUND-01" }) : { seed: "MOSSBOUND-01" });
    ui.setMenu(worlds);
    ui.showWorlds(worlds);
    audio.click();
  }

  function requestLock() {
    if (isTouch() || document.pointerLockElement === canvas) return;
    try { canvas.requestPointerLock()?.catch(() => ui.toast("Click the world to look around.")); }
    catch { ui.toast("Click the world to look around."); }
  }

  function startPlaying() {
    world.loadInitial(player.position.x, player.position.z);
    if (player.collides(player.position.x, player.position.y, player.position.z)) {
      for (let i = 0; i < 8 && player.collides(player.position.x, player.position.y, player.position.z); i++) player.position.y++;
      if (player.collides(player.position.x, player.position.y, player.position.z)) player.respawn();
    }
    player.updateCamera(0, false);
    ui.show("play", "playing");
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    ui.updateHealth(player.health);
    audio.start();
    requestLock();
    if (!milestones.log) ui.toast("Start with a tree. The rest is up to you.");
  }

  function pause() {
    if (ui.screen !== "playing") return;
    mining = false; miningProgress = 0; keys.clear();
    ui.show("play", "pause");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    saveWorld();
    audio.click();
  }

  function resume() {
    ui.show("play", "playing");
    audio.start();
    audio.click();
    requestLock();
  }

  function returnToTitle() {
    saveWorld();
    mining = false; keys.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    ui.show("menu", "title");
    ui.setMenu(worlds);
    world.loadInitial(previewBase.x, previewBase.z);
    setPreviewCamera();
    audio.click();
  }

  function closeOverlay() {
    audio.click();
    if (ui.mode === "menu") ui.show("menu", "title");
    else if (ui.screen === "inventory") resume();
    else ui.show("play", "pause");
  }

  function toggleSound() {
    settings.volume = settings.volume === 0 ? 0.55 : 0;
    audio.setVolume(settings.volume);
    ui.setSound(settings.volume === 0);
    writeJSON(SETTINGS_KEY, settings);
    audio.click();
  }

  function changeSetting(name, value) {
    settings[name] = value;
    writeJSON(SETTINGS_KEY, settings);
    if (name === "volume") { audio.setVolume(value); ui.setSound(value === 0); }
    if (name === "shadows") { renderer.shadowMap.enabled = value; atmosphere.sun.castShadow = value; }
    if (name === "renderDistance" && world) {
      world.renderDistance = value;
      world.centerX = Infinity;
      world.update(ui.mode === "play" ? player.position.x : previewBase.x, ui.mode === "play" ? player.position.z : previewBase.z);
    }
  }

  function selectSlot(index) {
    selectedSlot = Math.max(0, Math.min(8, index));
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    if (ui.screen === "inventory") renderInventory();
    audio.click();
  }

  function assignItem(id) {
    if (!ITEMS[id] || !inventory[id]) return;
    ui.selectedItem = id;
    const other = hotbar.findIndex((value, index) => value === id && index !== selectedSlot);
    if (other >= 0) hotbar[other] = hotbar[selectedSlot];
    hotbar[selectedSlot] = id;
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    renderInventory();
    audio.click();
  }

  function addItem(id, amount = 1, quiet = false) {
    if (!ITEMS[id]) return;
    const wasEmpty = !inventory[id];
    inventory[id] = Math.min(999, (inventory[id] || 0) + amount);
    if (wasEmpty && !hotbar.includes(id)) {
      const empty = hotbar.findIndex((slot) => slot === null || !inventory[slot]);
      if (empty >= 0) hotbar[empty] = id;
      else if (ITEMS[id].tool) hotbar[selectedSlot] = id;
    }
    if (!quiet) ui.toast(`+${amount} ${ITEMS[id].name}`);
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    if (id === "log") discover("log");
    if (id === "coal") discover("coal");
  }

  function removeItem(id, amount = 1) {
    inventory[id] = Math.max(0, (inventory[id] || 0) - amount);
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
  }

  function discover(id) {
    if (milestones[id]) return;
    milestones[id] = true;
    const entry = MILESTONES.find((item) => item.id === id);
    if (entry) ui.toast(`FIELD NOTE  /  ${entry.title}`, "milestone");
    audio.pickup();
  }

  function craftItem(id) {
    const recipe = RECIPES.find((entry) => entry.id === id);
    if (!recipe) return;
    if (ITEMS[id].durability && inventory[id]) return;
    if (!Object.entries(recipe.ingredients).every(([item, count]) => (inventory[item] || 0) >= count)) return;
    for (const [item, count] of Object.entries(recipe.ingredients)) removeItem(item, count);
    addItem(id, recipe.output, true);
    if (ITEMS[id].durability) durability[id] = ITEMS[id].durability;
    if (id === "planks") discover("planks");
    if (id.includes("pick")) discover("pick");
    ui.toast(`Made ${recipe.output > 1 ? `${recipe.output} ` : ""}${ITEMS[id].name}`);
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
    renderInventory();
    audio.craft();
    saveWorld();
  }

  function eatItem(id) {
    if (!ITEMS[id]?.food || !inventory[id]) return;
    if (player.health >= 10) { ui.toast("You are already feeling well."); return; }
    removeItem(id);
    player.heal(ITEMS[id].food);
    ui.toast("The berries are sweet. +2 vitality");
    audio.pickup();
    if (ui.screen === "inventory") renderInventory();
  }

  function openInventory(tab = "backpack") {
    if (ui.mode !== "play") return;
    mining = false; miningProgress = 0; keys.clear();
    ui.tab = tab;
    ui.show("play", "inventory");
    renderInventory();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    audio.click();
  }

  function renderInventory() {
    if (ui.screen !== "inventory") return;
    ui.renderInventory({ inventory, hotbar, selectedSlot, durability, milestones, worldName: currentName });
  }

  function equipped() {
    const id = hotbar[selectedSlot];
    return inventory[id] > 0 ? { id, ...ITEMS[id] } : null;
  }

  function canMine(block) {
    const needed = BLOCKS[block]?.tool || 0;
    const item = equipped();
    return !needed || (item?.tool === "pick" && item.power >= needed);
  }

  function miningDuration(block) {
    const item = equipped();
    const stone = [B.STONE, B.COBBLE, B.COAL_ORE, B.IRON_ORE].includes(block);
    const wood = [B.LOG, B.PLANKS].includes(block);
    const multiplier = stone && item?.tool === "pick" || wood && item?.tool === "axe" ? item.speed : 1;
    return BLOCKS[block].hardness / multiplier;
  }

  function useTool() {
    const item = equipped();
    if (!item?.durability) return;
    durability[item.id] = (durability[item.id] ?? item.durability) - 1;
    if (durability[item.id] <= 0) {
      removeItem(item.id);
      delete durability[item.id];
      ui.toast(`${item.name} wore out.`);
      audio.break(B.STONE);
    }
    ui.updateHotbar(inventory, hotbar, selectedSlot, durability);
  }

  function burst(x, y, z, block, count = 11) {
    const color = BLOCKS[block]?.color || "#c9b38a";
    for (let i = 0; i < count; i++) {
      particles.push({ x: x + Math.random(), y: y + Math.random(), z: z + Math.random(), color, size: 0.55 + Math.random() * 0.8, rotation: Math.random() * 3,
        vx: (Math.random() - 0.5) * 5, vy: 1.6 + Math.random() * 3.3, vz: (Math.random() - 0.5) * 5, life: 0.55 + Math.random() * 0.25 });
    }
    while (particles.length > 190) particles.shift();
  }

  function breakBlock(hit) {
    if (!world.setBlock(hit.x, hit.y, hit.z, B.AIR)) return;
    const id = hit.id;
    let drop = BLOCKS[id].drop;
    let amount = 1;
    if (id === B.LEAVES) drop = Math.random() > 0.54 ? "stick" : "leaves";
    if (id === B.BERRY_BUSH) amount = 2 + Math.floor(Math.random() * 2);
    if (drop) addItem(drop, amount);
    useTool();
    burst(hit.x, hit.y, hit.z, id);
    audio.break(id);
    miningProgress = 0; miningKey = ""; miningTick = 0;
  }

  function validPlacement(hit, item) {
    if (!hit || !item?.block || !hit.normal || !Object.values(hit.normal).some(Boolean)) return null;
    const x = hit.x + hit.normal.x, y = hit.y + hit.normal.y, z = hit.z + hit.normal.z;
    if (y < 1 || y >= WORLD_HEIGHT - 1 || ![B.AIR, B.WATER].includes(world.getBlock(x, y, z))) return null;
    if ([B.TORCH, B.CAMPFIRE, B.SLEEPING_ROLL].includes(item.block) && (hit.normal.y !== 1 || !BLOCKS[hit.id]?.solid)) return null;
    if (BLOCKS[item.block].solid && Math.abs(player.position.x - (x + 0.5)) < 0.81 && Math.abs(player.position.z - (z + 0.5)) < 0.81 && player.position.y < y + 1 && player.position.y + 1.76 > y) return null;
    return { x, y, z };
  }

  function interact() {
    if (ui.screen !== "playing") return;
    if (targetCreature && (!targetBlock || targetCreature.distance < targetBlock.distance + 0.25)) {
      if (creatures.gather(targetCreature.member, elapsed)) {
        addItem("wool", 1 + (Math.random() > 0.55 ? 1 : 0));
        discover("mossling");
        ui.toast("The mossling seems quite pleased.");
        audio.creature();
      } else { ui.toast("Its wool needs a little time to grow back."); audio.creature(); }
      return;
    }

    if (targetBlock?.id === B.BERRY_BUSH) {
      world.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, B.AIR);
      burst(targetBlock.x, targetBlock.y, targetBlock.z, B.BERRY_BUSH, 7);
      addItem("berry", 2 + Math.floor(Math.random() * 2));
      audio.pickup();
      return;
    }
    if (targetBlock?.id === B.CAMPFIRE) {
      if (elapsed - lastRest < 24) ui.toast("The fire needs a moment to settle.");
      else if (player.health < 10) { lastRest = elapsed; player.heal(3); ui.toast("You rest by the fire. +3 vitality"); audio.sleep(); }
      else ui.toast("A good place to take a breath.");
      return;
    }
    if (targetBlock?.id === B.SLEEPING_ROLL) {
      if (timeOfDay < 0.73 && timeOfDay > 0.24) { ui.toast("It is not quite night yet."); return; }
      const nextDay = timeOfDay >= 0.73;
      ui.sleepFade(() => {
        if (nextDay) day++;
        timeOfDay = 0.31;
        weather = "clear";
        player.heal(10);
        discover("sleep");
        ui.toast("A new morning. The world is waiting.");
        saveWorld();
      });
      audio.sleep();
      return;
    }

    const item = equipped();
    if (item?.food) { eatItem(item.id); return; }
    const position = validPlacement(targetBlock, item);
    if (!position) {
      if (item?.block) { ui.toast("There is no room to place that here."); audio.click(); }
      return;
    }
    if (!world.setBlock(position.x, position.y, position.z, item.block)) return;
    removeItem(item.id);
    if (item.block === B.TORCH) discover("torch");
    if (item.block === B.SLEEPING_ROLL) discover("home");
    burst(position.x, position.y, position.z, item.block, 5);
    audio.place();
  }

  function updateTarget() {
    camera.getWorldDirection(direction);
    targetBlock = raycastBlocks(world, camera.position, direction, 6.5);
    targetCreature = creatures.target(camera.position, direction, 4.2);
    if (targetCreature && (!targetBlock || targetCreature.distance < targetBlock.distance + 0.25)) {
      selection.visible = ghost.visible = false;
      ui.updateTarget("Mossling", targetCreature.member.shearedUntil > elapsed ? "Its wool is growing back" : "Right click to gently gather wool", 0);
      return;
    }
    selection.visible = Boolean(targetBlock);
    if (!targetBlock) { ghost.visible = false; ui.updateTarget(); return; }
    selection.position.set(targetBlock.x + 0.5, targetBlock.y + 0.5, targetBlock.z + 0.5);
    const item = equipped();
    const place = validPlacement(targetBlock, item);
    ghost.visible = Boolean(place);
    if (place) {
      const special = [B.TORCH, B.CAMPFIRE, B.SLEEPING_ROLL].includes(item.block);
      ghost.scale.set(special ? 0.68 : 1, special ? 0.5 : 1, special ? 0.68 : 1);
      ghost.position.set(place.x + 0.5, place.y + (special ? 0.25 : 0.5), place.z + 0.5);
      ghost.material.color.set(BLOCKS[item.block].color || "#e9ddba");
    }
    const block = BLOCKS[targetBlock.id];
    let action = "Hold left click to gather";
    if (!canMine(targetBlock.id)) action = block.tool === 1 ? "Needs a wooden pickaxe" : "Needs a stone pickaxe";
    else if (targetBlock.id === B.CAMPFIRE) action = "Right click to rest by the fire";
    else if (targetBlock.id === B.SLEEPING_ROLL) action = "Right click to sleep at night";
    else if (targetBlock.id === B.BERRY_BUSH) action = "Right click to pick berries";
    ui.updateTarget(block.name, action, miningProgress);
  }

  function updateMining(dt) {
    if (!mining || !targetBlock || targetCreature && targetCreature.distance < targetBlock.distance + 0.25) {
      miningProgress = 0; miningKey = "";
      return;
    }
    const key = `${targetBlock.x},${targetBlock.y},${targetBlock.z}`;
    if (key !== miningKey) { miningKey = key; miningProgress = 0; miningTick = 0; }
    if (!canMine(targetBlock.id)) {
      if (miningTick === 0) { ui.toast(BLOCKS[targetBlock.id].tool === 1 ? "Craft a wooden pickaxe first." : "A stone pickaxe can mine this."); miningTick = 1; }
      return;
    }
    miningProgress += dt / Math.max(0.12, miningDuration(targetBlock.id));
    miningTick += dt;
    if (miningTick > 0.25) { audio.mine(targetBlock.id); miningTick = 0; burst(targetBlock.x, targetBlock.y, targetBlock.z, targetBlock.id, 2); }
    if (miningProgress >= 1) breakBlock(targetBlock);
  }

  function mobileAction(action) {
    if (action === "open-pack") openInventory();
    else if (action === "mobile-place") interact();
    else if (action === "mobile-jump") { keys.add("Space"); setTimeout(() => keys.delete("Space"), 180); }
  }

  function handleKeyDown(event) {
    if (event.code === "Escape") {
      if (ui.screen === "playing") pause();
      else if (ui.screen === "pause") resume();
      else closeOverlay();
      event.preventDefault();
      return;
    }
    if (ui.screen === "create" && event.code === "Enter") {
      createWorld(ui.el("#world-name")?.value, ui.el("#world-seed")?.value);
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.code === "KeyE") {
      if (ui.screen === "playing") openInventory();
      else if (ui.screen === "inventory") resume();
      event.preventDefault();
      return;
    }
    if (event.code === "KeyJ" && ui.screen === "playing") { openInventory("journal"); event.preventDefault(); return; }
    if (ui.screen !== "playing") return;
    if (/^Digit[1-9]$/.test(event.code)) selectSlot(Number(event.code.slice(-1)) - 1);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    keys.add(event.code);
  }

  function handleKeyUp(event) { keys.delete(event.code); }
  function handleMouseMove(event) { if (ui.screen === "playing" && document.pointerLockElement === canvas) player.look(event.movementX, event.movementY, 0.00215 * settings.sensitivity); }
  function handleMouseDown(event) {
    if (ui.screen !== "playing" || isTouch()) return;
    event.preventDefault();
    if (document.pointerLockElement !== canvas) { requestLock(); return; }
    if (event.button === 0) mining = true;
    if (event.button === 2) interact();
  }
  function handleMouseUp(event) { if (event.button === 0) { mining = false; miningProgress = 0; miningKey = ""; } }
  function handleWheel(event) {
    if (ui.screen !== "playing") return;
    event.preventDefault();
    selectSlot((selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9);
  }
  function handlePointerLock() {
    if (document.pointerLockElement !== canvas && ui.screen === "playing" && !isTouch()) pause();
  }
  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(/swiftshader|llvmpipe/i.test(graphicsName) ? 1 : Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.35 : 1.65));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  function handleVisibility() { if (document.hidden) { if (ui.screen === "playing") pause(); else saveWorld(); } }
  function handleBlur() { keys.clear(); mining = false; if (ui.screen === "playing" && !isTouch()) pause(); }
  function handleTouchLook(event) {
    if (ui.screen !== "playing" || event.pointerType !== "touch") return;
    if (event.type === "pointerdown") { touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); }
    else if (touchLook?.id === event.pointerId && event.type === "pointermove") {
      player.look((event.clientX - touchLook.x) * 1.45, (event.clientY - touchLook.y) * 1.45, 0.00215 * settings.sensitivity);
      touchLook.x = event.clientX; touchLook.y = event.clientY;
    } else if (touchLook?.id === event.pointerId) touchLook = null;
  }
  function updateJoystick(event) {
    const pad = ui.el("#touch-joystick");
    const rect = pad.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / 43));
    const dy = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / 43));
    ui.el(".joystick-knob").style.transform = `translate(calc(-50% + ${dx * 32}px), calc(-50% + ${dy * 32}px))`;
    for (const code of joystickKeys) keys.delete(code);
    joystickKeys.clear();
    if (dy < -0.27) joystickKeys.add("KeyW");
    if (dy > 0.27) joystickKeys.add("KeyS");
    if (dx < -0.27) joystickKeys.add("KeyA");
    if (dx > 0.27) joystickKeys.add("KeyD");
    for (const code of joystickKeys) keys.add(code);
  }
  function handleJoystick(event) {
    if (ui.screen !== "playing") return;
    const pad = ui.el("#touch-joystick");
    if (event.type === "pointerdown") { joystickPointer = event.pointerId; pad.setPointerCapture(event.pointerId); updateJoystick(event); }
    else if (joystickPointer === event.pointerId && event.type === "pointermove") updateJoystick(event);
    else if (joystickPointer === event.pointerId) {
      joystickPointer = null;
      for (const code of joystickKeys) keys.delete(code);
      joystickKeys.clear();
      ui.el(".joystick-knob").style.transform = "translate(-50%, -50%)";
    }
  }
  function handleTouchAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button || ui.screen !== "playing") return;
    if (button.dataset.action === "mobile-mine") mining = event.type === "pointerdown";
    if (button.dataset.action === "mobile-jump") {
      if (event.type === "pointerdown") keys.add("Space");
      else keys.delete("Space");
    }
  }

  function frame(now) {
    if (disposed) return;
    const frameStart = performance.now();
    const wallDt = Math.min(0.75, Math.max(0, (now - lastFrame) / 1000));
    const dt = Math.min(0.2, wallDt);
    lastFrame = now;
    elapsed += wallDt;
    const playing = ui.screen === "playing";
    if (playing) {
      let remaining = dt;
      while (remaining > 0.0001) {
        const step = Math.min(remaining, 0.032);
        player.update(step, keys, settings);
        remaining -= step;
      }
      world.update(player.position.x, player.position.z);
      creatures.update(dt, player.position.x, player.position.z, elapsed);
      timeOfDay += wallDt / 780;
      if (timeOfDay >= 1) { timeOfDay -= 1; day++; }
      weatherElapsed += wallDt;
      if (weatherElapsed > 155) {
        weatherElapsed = 0;
        weatherStep++;
        const roll = world.hash(day, weatherStep, 920);
        const next = roll < 0.27 ? "rain" : roll < 0.42 ? "mist" : "clear";
        if (next !== weather) ui.toast(next === "rain" ? "A passing rain rolls in." : next === "mist" ? "Mist settles over the land." : "The skies are clearing.");
        weather = next;
      }
      updateTarget();
      updateMining(wallDt);
      saveTimer += wallDt;
      if (saveTimer > 16) saveWorld();
    } else if (ui.mode === "menu") {
      setPreviewCamera();
      world.update(previewBase.x, previewBase.z);
      creatures.update(dt, previewBase.x, previewBase.z, elapsed);
      targetBlock = targetCreature = null;
      selection.visible = ghost.visible = false;
    }

    const queueStart = performance.now();
    world.processQueue(dt > 0.038 ? 1 : 2);
    const queueMs = performance.now() - queueStart;
    world.waterMaterial.opacity = 0.68 + Math.sin(elapsed * 0.8) * 0.025;
    const daylight = atmosphere.update(dt, camera.position, timeOfDay, weather, settings.renderDistance);
    audio.update(elapsed, weather, daylight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) { particles.splice(i, 1); continue; }
      particle.vy -= dt * 12;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.rotation += dt * 5;
    }
    particleMesh.count = Math.max(1, particles.length);
    if (!particles.length) {
      particleDummy.position.set(0, -100, 0);
      particleDummy.rotation.set(0, 0, 0);
      particleDummy.scale.setScalar(0);
      particleDummy.updateMatrix();
      particleMesh.setMatrixAt(0, particleDummy.matrix);
    } else for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      particleDummy.position.set(particle.x, particle.y, particle.z);
      particleDummy.rotation.set(particle.rotation, 0, particle.rotation * 0.8);
      particleDummy.scale.setScalar(particle.size * Math.min(1, particle.life * 2));
      particleDummy.updateMatrix();
      particleMesh.setMatrixAt(i, particleDummy.matrix);
      particleMesh.setColorAt(i, particleColor.set(particle.color));
    }
    particleMesh.instanceMatrix.needsUpdate = true;
    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    statusTimer += dt;
    if (statusTimer > 0.35) {
      statusTimer = 0;
      const hour = Math.floor(timeOfDay * 24);
      const minute = Math.floor((timeOfDay * 24 - hour) * 60);
      const biome = world.terrainInfo(Math.floor(player.position.x), Math.floor(player.position.z)).biome;
      ui.updateStatus(labels[biome], day, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, weather, daylight < 0.24);
    }
    const renderStart = performance.now();
    renderer.render(scene, camera);
    if (import.meta.env.DEV) window.__mossboundDebug = { chunks: world.chunks.size, queued: world.queue.length, queueMs: Math.round(queueMs), renderMs: Math.round(performance.now() - renderStart), frameMs: Math.round(performance.now() - frameStart), meshes: renderer.info.render.calls, triangles: renderer.info.render.triangles, position: player.position.toArray().map((n) => Math.round(n * 10) / 10), look: [player.yaw, player.pitch], target: targetBlock && { x: targetBlock.x, y: targetBlock.y, z: targetBlock.z, id: targetBlock.id }, inventory: { ...inventory }, health: player.health, mining, miningProgress, timeOfDay };
    frameHandle = requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("resize", handleResize);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("beforeunload", saveWorld);
  document.addEventListener("pointerlockchange", handlePointerLock);
  document.addEventListener("visibilitychange", handleVisibility);
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", handleTouchLook);
  canvas.addEventListener("pointermove", handleTouchLook);
  canvas.addEventListener("pointerup", handleTouchLook);
  canvas.addEventListener("pointercancel", handleTouchLook);
  const joystick = ui.el("#touch-joystick"), touchActions = ui.el(".touch-actions");
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) joystick.addEventListener(type, handleJoystick);
  for (const type of ["pointerdown", "pointerup", "pointercancel"]) touchActions.addEventListener(type, handleTouchAction);

  ui.setMenu(worlds);
  ui.setSound(settings.volume === 0);
  ui.show("menu", "title");
  const primaryButton = ui.el('[data-action="primary"]');
  primaryButton.disabled = true;
  ui.el("#primary-label").textContent = "Growing the wilderness";
  ui.el("#menu-new").disabled = true;
  ui.el("#menu-worlds").disabled = true;
  canvas.style.opacity = "0";
  startupFrame = requestAnimationFrame(() => {
    startupTimer = window.setTimeout(() => {
      if (disposed) return;
      const latest = worlds[0] ? readJSON(worldKey(worlds[0].id), null) : null;
      setupWorld(latest || { seed: "MOSSBOUND-01" });
      primaryButton.disabled = false;
      ui.el("#menu-new").disabled = false;
      ui.el("#menu-worlds").disabled = false;
      ui.setMenu(worlds);
      canvas.style.opacity = "1";
      lastFrame = performance.now();
      frameHandle = requestAnimationFrame(frame);
    }, 0);
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    cancelAnimationFrame(startupFrame);
    clearTimeout(startupTimer);
    saveWorld();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("beforeunload", saveWorld);
    document.removeEventListener("pointerlockchange", handlePointerLock);
    document.removeEventListener("visibilitychange", handleVisibility);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("pointerdown", handleTouchLook);
    canvas.removeEventListener("pointermove", handleTouchLook);
    canvas.removeEventListener("pointerup", handleTouchLook);
    canvas.removeEventListener("pointercancel", handleTouchLook);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) joystick.removeEventListener(type, handleJoystick);
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) touchActions.removeEventListener(type, handleTouchAction);
    creatures?.dispose(); atmosphere?.dispose(); world?.dispose(); audio.dispose();
    selection.geometry.dispose(); selection.material.dispose(); ghost.geometry.dispose(); ghost.material.dispose();
    particleGeometry.dispose(); particleMaterial.dispose();
    renderer.dispose(); ui.dispose();
  };
}