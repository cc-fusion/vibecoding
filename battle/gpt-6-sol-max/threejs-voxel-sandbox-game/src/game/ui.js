import { ITEMS, RECIPES, MILESTONES, itemIcon } from "./blocks.js";

const icon = (name, size = 20) => {
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    close: '<path d="M5 5l14 14M19 5 5 19"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    bag: '<path d="M5 8h14l1 12H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2"/>',
    sound: '<path d="M4 10v4h4l5 4V6l-5 4H4Zm12-2c1.5 1 2 2.3 2 4s-.5 3-2 4m2-11c2.5 1.8 3 4.1 3 7s-.5 5.2-3 7"/>',
    muted: '<path d="M4 10v4h4l5 4V6l-5 4H4Zm12-1 5 6m0-6-5 6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    heart: '<path d="M20.8 5.6a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2L12 21l8.8-8.2a5.1 5.1 0 0 0 0-7.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    rain: '<path d="M6 16a4 4 0 0 1 0-8 6 6 0 0 1 11.3-1A4.5 4.5 0 1 1 19 16H6Zm2 2-1 3m6-3-1 3m6-3-1 3"/>',
    moon: '<path d="M20.2 15.1A8 8 0 0 1 8.9 3.8 8 8 0 1 0 20.2 15.1Z"/>',
    shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3m-4-4 4 4-4 4M4 17h3c1.5 0 2.5-.8 3.3-2M14 9c.8-1.2 1.8-2 3-2h3m-4-4 4 4-4 4"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};

const brandMark = `<svg viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M21 3 38 21 21 39 4 21 21 3Z" stroke="currentColor" stroke-width="1.4"/><path d="M21 9 31 21 21 33 11 21 21 9Z" stroke="currentColor" stroke-width="1.4"/><path d="M21 13v16M15 21h12" stroke="currentColor" stroke-width="1.4"/></svg>`;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export class GameUI {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.mode = "menu";
    this.screen = "title";
    this.returnScreen = "title";
    this.tab = "backpack";
    this.selectedItem = null;
    this.root.innerHTML = `
      <div class="game" id="game" data-screen="title">
        <div class="scene-wrap"><canvas id="world-canvas" aria-label="Mossbound voxel world"></canvas></div>
        <div class="scene-vignette" aria-hidden="true"></div>
        <div class="screen-menu" id="screen-menu">
          <div class="menu-shade" aria-hidden="true"></div>
          <header class="menu-header">
            <div class="small-brand">${brandMark}<span>MOSSBOUND</span></div>
            <button class="bare-icon menu-sound" data-action="sound" aria-label="Toggle sound" title="Toggle sound">${icon("sound", 21)}</button>
          </header>
          <div class="menu-content">
            <div class="hero-eyebrow"><span class="eyebrow-rule"></span> AN OPEN WORLD IN MINIATURE</div>
            <h1>Moss<span>bound.</span></h1>
            <p class="hero-copy">Gather what the land gives.<br>Build somewhere you belong.</p>
            <div class="menu-actions">
              <button class="button-primary" data-action="primary"><span id="primary-label">Begin exploring</span><span class="button-arrow">${icon("arrow", 21)}</span></button>
              <div class="menu-links">
                <button class="text-button" data-action="new-world" id="menu-new">Create with a seed</button>
                <button class="text-button" data-action="worlds" id="menu-worlds" hidden>Choose a world</button>
                <button class="text-button" data-action="help">How to play</button>
              </div>
              <div class="menu-last-world" id="menu-last-world" hidden></div>
            </div>
          </div>
          <footer class="menu-footer"><span>THE WORLD IS YOURS TO SHAPE</span><span class="footer-coordinate">01 / WILDERNESS</span></footer>
        </div>

        <div class="hud" id="hud">
          <header class="hud-header">
            <div class="hud-brand">${brandMark}<span>MOSSBOUND</span></div>
            <div class="hud-status"><span id="hud-biome">WINDWARD MEADOW</span><span class="status-divider"></span><span id="hud-time">DAY 01 &nbsp; 08:00</span><span id="hud-weather-icon" class="weather-icon">${icon("sun", 16)}</span></div>
            <button class="hud-menu-button" data-action="pause" aria-label="Pause game" title="Pause game">${icon("menu", 21)}</button>
          </header>
          <div class="aim-ui" id="aim-ui">
            <svg class="mine-ring" viewBox="0 0 52 52" aria-hidden="true"><circle class="ring-track" cx="26" cy="26" r="21"/><circle id="mine-progress" class="ring-progress" cx="26" cy="26" r="21"/></svg>
            <div class="crosshair" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <div class="target-name" id="target-name"></div>
            <div class="target-action" id="target-action"></div>
          </div>
          <div class="toast-stack" id="toast-stack" aria-live="polite"></div>
          <div class="hud-footer">
            <div class="health-wrap"><span class="hud-caption">VITALITY</span><div class="hearts" id="hearts"></div></div>
            <div class="hotbar" id="hotbar" role="toolbar" aria-label="Quick inventory"></div>
            <div class="hud-shortcuts"><div><kbd>E</kbd><span>PACK</span></div><div><kbd>ESC</kbd><span>PAUSE</span></div></div>
          </div>
          <div class="mobile-controls" id="mobile-controls"><div class="touch-joystick" id="touch-joystick"><div class="joystick-knob"></div></div><div class="touch-actions"><button data-action="mobile-jump" aria-label="Jump">JUMP</button><button data-action="mobile-mine" aria-label="Mine">MINE</button><button data-action="mobile-place" aria-label="Place block">PLACE</button><button data-action="open-pack" aria-label="Open backpack">PACK</button></div></div>
        </div>

        <div class="overlay pause-overlay" id="pause-overlay">
          <div class="pause-content"><div class="panel-eyebrow">A MOMENT TO BREATHE</div><h2>The world<br><em>can wait.</em></h2><p id="pause-world-name">Your world is saved as you go.</p>
            <div class="pause-actions"><button class="button-primary" data-action="resume"><span>Keep exploring</span><span class="button-arrow">${icon("arrow", 21)}</span></button><button class="text-button" data-action="save">Save world</button><button class="text-button" data-action="settings">Settings</button><button class="text-button" data-action="title">Return to title</button></div>
          </div>
          <div class="pause-side-note">TAKE YOUR TIME. THERE IS NO RUSH.</div>
        </div>

        <div class="overlay dialog-overlay" id="dialog-overlay">
          <div class="dialog-backdrop" data-action="close"></div>
          <section class="journal-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
            <header class="panel-header"><div class="panel-eyebrow" id="panel-eyebrow">FIELD NOTES</div><button class="close-button" data-action="close" aria-label="Close">${icon("close", 20)}</button></header>
            <h2 id="panel-title">Field pack<span>.</span></h2>
            <div class="panel-tabs" id="panel-tabs">
              <button data-action="tab" data-tab="backpack" class="active">Backpack</button>
              <button data-action="tab" data-tab="crafting">Crafting</button>
              <button data-action="tab" data-tab="journal">Field notes</button>
            </div>
            <div class="panel-body" id="panel-body"></div>
            <div class="panel-foot" id="panel-foot">Click an item to put it in your selected hotbar slot.</div>
          </section>
        </div>

        <div class="overlay simple-overlay" id="simple-overlay">
          <div class="dialog-backdrop" data-action="close"></div>
          <section class="simple-panel" role="dialog" aria-modal="true" aria-labelledby="simple-title">
            <header class="panel-header"><div class="panel-eyebrow" id="simple-eyebrow">A NEW BEGINNING</div><button class="close-button" data-action="close" aria-label="Close">${icon("close", 20)}</button></header>
            <h2 id="simple-title">A world of your own<span>.</span></h2>
            <div id="simple-body"></div>
          </section>
        </div>

        <div class="sleep-fade" id="sleep-fade"></div>
      </div>`;
    this.el = (selector) => this.root.querySelector(selector);
    this.game = this.el("#game");
    this.panelBody = this.el("#panel-body");
    this.root.addEventListener("click", this.onClick = (event) => this.handleClick(event));
  }

  handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "primary") this.callbacks.primary?.();
    else if (action === "new-world") this.callbacks.newWorld?.();
    else if (action === "worlds") this.callbacks.worlds?.();
    else if (action === "help") this.callbacks.help?.();
    else if (action === "resume") this.callbacks.resume?.();
    else if (action === "pause") this.callbacks.pause?.();
    else if (action === "save") this.callbacks.save?.();
    else if (action === "settings") this.callbacks.settings?.();
    else if (action === "title") this.callbacks.title?.();
    else if (action === "close") this.callbacks.close?.();
    else if (action === "create") this.callbacks.create?.(this.el("#world-name")?.value, this.el("#world-seed")?.value);
    else if (action === "random-seed") this.el("#world-seed").value = String(Math.floor(Math.random() * 900000000) + 100000000);
    else if (action === "play-world") this.callbacks.playWorld?.(button.dataset.id);
    else if (action === "delete-world") this.callbacks.deleteWorld?.(button.dataset.id);
    else if (action === "slot") this.callbacks.slot?.(Number(button.dataset.slot));
    else if (action === "assign") this.callbacks.assign?.(button.dataset.item);
    else if (action === "eat") this.callbacks.eat?.(button.dataset.item);
    else if (action === "craft") this.callbacks.craft?.(button.dataset.recipe);
    else if (action === "tab") { this.tab = button.dataset.tab; this.callbacks.tab?.(this.tab); }
    else if (action === "sound") this.callbacks.sound?.();
    else if (action === "mobile-jump" || action === "mobile-mine" || action === "mobile-place" || action === "open-pack") this.callbacks.mobile?.(action);
  }

  show(mode, screen) {
    this.mode = mode;
    this.screen = screen;
    this.game.dataset.screen = screen;
    this.game.classList.toggle("menu-mode", mode === "menu");
    this.game.classList.toggle("play-mode", mode === "play");
    this.game.classList.toggle("dialog-open", ["inventory", "create", "worlds", "help", "settings"].includes(screen));
    this.game.classList.toggle("is-playing", screen === "playing");
    this.game.classList.toggle("is-paused", screen === "pause");
    this.game.classList.toggle("has-journal", screen === "inventory");
    this.game.classList.toggle("has-simple", ["create", "worlds", "help", "settings"].includes(screen));
  }

  open(screen) {
    this.returnScreen = this.screen;
    this.show(this.mode, screen);
  }

  close() {
    this.show(this.mode, this.returnScreen);
  }

  setMenu(worlds) {
    const latest = worlds[0];
    this.el("#primary-label").textContent = latest ? "Continue exploring" : "Begin exploring";
    this.el("#menu-new").textContent = latest ? "New world" : "Create with a seed";
    this.el("#menu-worlds").hidden = !latest;
    const last = this.el("#menu-last-world");
    last.hidden = !latest;
    if (latest) last.textContent = `LAST VISITED  /  ${latest.name.toUpperCase()}`;
  }

  updateStatus(biome, day, time, weather, isNight) {
    this.el("#hud-biome").textContent = biome.toUpperCase();
    this.el("#hud-time").textContent = `DAY ${String(day).padStart(2, "0")}   ${time}`;
    this.el("#hud-weather-icon").innerHTML = icon(weather === "rain" ? "rain" : isNight ? "moon" : "sun", 16);
    this.el("#hud-weather-icon").title = weather === "rain" ? "Passing rain" : weather === "mist" ? "Morning mist" : isNight ? "Night sky" : "Clear skies";
  }

  updateHealth(health) {
    this.el("#hearts").innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="health-heart ${i < health ? "full" : "empty"}">${icon("heart", 14)}</span>`).join("");
    this.el("#hearts").setAttribute("aria-label", `${health} of 10 health`);
  }

  updateHotbar(inventory, hotbar, selected, durability = {}) {
    this.el("#hotbar").innerHTML = Array.from({ length: 9 }, (_, i) => {
      const id = hotbar[i];
      const item = ITEMS[id];
      const count = inventory[id] || 0;
      const percent = item?.durability ? Math.max(0, (durability[id] ?? item.durability) / item.durability * 100) : 0;
      return `<button class="hotbar-slot ${i === selected ? "selected" : ""} ${!item || !count ? "empty" : ""}" data-action="slot" data-slot="${i}" aria-label="Slot ${i + 1}${item && count ? `: ${item.name}, ${count}` : ": empty"}"><span class="slot-number">${i + 1}</span>${item && count ? `<img src="${itemIcon(id)}" alt="" draggable="false"><span class="slot-count">${count > 1 ? count : ""}</span>${item.durability ? `<span class="durability"><i style="width:${percent}%"></i></span>` : ""}` : ""}</button>`;
    }).join("");
  }

  updateTarget(name = "", action = "", progress = 0) {
    this.el("#target-name").textContent = name;
    this.el("#target-action").textContent = action;
    this.el("#aim-ui").classList.toggle("has-target", Boolean(name));
    this.el("#aim-ui").classList.toggle("mining", progress > 0);
    this.el("#mine-progress").style.strokeDashoffset = String(132 - Math.min(1, progress) * 132);
  }

  toast(message, type = "normal") {
    const stack = this.el("#toast-stack");
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    stack.appendChild(node);
    requestAnimationFrame(() => node.classList.add("visible"));
    setTimeout(() => { node.classList.remove("visible"); setTimeout(() => node.remove(), 350); }, 3300);
    while (stack.children.length > 3) stack.firstElementChild.remove();
  }

  renderInventory(state) {
    this.inventoryState = state;
    this.el("#panel-title").innerHTML = this.tab === "backpack" ? "Field pack<span>.</span>" : this.tab === "crafting" ? "Make things<span>.</span>" : "Field notes<span>.</span>";
    this.el("#panel-eyebrow").textContent = this.tab === "journal" ? state.worldName.toUpperCase() : "A POCKETFUL OF POSSIBILITIES";
    this.root.querySelectorAll("#panel-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === this.tab));
    this.el("#panel-foot").textContent = this.tab === "backpack" ? "Choose an item to equip it in the highlighted hotbar slot." : this.tab === "crafting" ? "Everything here can be made by hand, wherever you are." : "Every small discovery is part of your story.";
    if (this.tab === "backpack") this.renderBackpack(state);
    else if (this.tab === "crafting") this.renderCrafting(state);
    else this.renderJournal(state);
  }

  renderBackpack(state) {
    const owned = Object.keys(ITEMS).filter((id) => state.inventory[id] > 0);
    if (!owned.includes(this.selectedItem)) this.selectedItem = owned[0] || null;
    const selected = ITEMS[this.selectedItem];
    const grid = owned.length ? owned.map((id) => `<button class="pack-item ${id === this.selectedItem ? "active" : ""}" data-action="assign" data-item="${id}" title="Equip ${ITEMS[id].name}"><img src="${itemIcon(id)}" alt=""><span>${escapeHTML(ITEMS[id].name)}</span><strong>${state.inventory[id]}</strong></button>`).join("") : '<div class="empty-pack">Nothing here yet.<br>There is a whole world to gather from.</div>';
    this.panelBody.innerHTML = `<div class="pack-layout"><div class="pack-left"><div class="section-heading">YOUR GATHERINGS <span>${owned.length} KINDS</span></div><div class="pack-grid">${grid}</div></div><aside class="item-detail">${selected ? `<div class="detail-icon"><img src="${itemIcon(this.selectedItem)}" alt=""></div><div class="detail-overline">IN YOUR PACK  /  ${state.inventory[this.selectedItem]}</div><h3>${escapeHTML(selected.name)}</h3><p>${escapeHTML(selected.description)}</p><div class="detail-actions"><button class="small-primary" data-action="assign" data-item="${this.selectedItem}">Equip in slot ${state.selectedSlot + 1} ${icon("arrow", 16)}</button>${selected.food ? `<button class="small-secondary" data-action="eat" data-item="${this.selectedItem}">Eat berries</button>` : ""}</div>` : '<div class="detail-empty">Your next discovery is waiting outside.</div>'}</aside></div>`;
  }

  renderCrafting(state) {
    this.panelBody.innerHTML = `<div class="craft-list">${RECIPES.map((recipe) => {
      const item = ITEMS[recipe.id];
      const ingredients = Object.entries(recipe.ingredients);
      const canMake = ingredients.every(([id, count]) => (state.inventory[id] || 0) >= count) && (!item.durability || !(state.inventory[recipe.id] > 0));
      return `<div class="recipe-row"><div class="recipe-icon"><img src="${itemIcon(recipe.id)}" alt=""></div><div class="recipe-info"><div class="recipe-title">${escapeHTML(item.name)} <span>${recipe.output > 1 ? `x${recipe.output}` : ""}</span></div><div class="recipe-note">${recipe.note}</div><div class="recipe-ingredients">${ingredients.map(([id, count]) => `<span class="${(state.inventory[id] || 0) >= count ? "has" : "missing"}">${escapeHTML(ITEMS[id].name)} ${state.inventory[id] || 0}/${count}</span>`).join("<b>+</b>")}</div></div><button class="craft-button" data-action="craft" data-recipe="${recipe.id}" ${canMake ? "" : "disabled"} aria-label="Craft ${item.name}">${canMake ? "MAKE" : "NEED"} ${icon("arrow", 15)}</button></div>`;
    }).join("")}</div>`;
  }

  renderJournal(state) {
    const achieved = MILESTONES.filter((entry) => state.milestones[entry.id]).length;
    this.panelBody.innerHTML = `<div class="journal-intro"><div class="journal-big-number">${String(achieved).padStart(2, "0")}<span> / ${String(MILESTONES.length).padStart(2, "0")}</span></div><p>There is no finish line out here.<br>Just the things you find along the way.</p></div><div class="milestone-list">${MILESTONES.map((entry, index) => `<div class="milestone ${state.milestones[entry.id] ? "done" : ""}"><span class="milestone-index">${String(index + 1).padStart(2, "0")}</span><span class="milestone-copy"><strong>${entry.title}</strong><small>${entry.description}</small></span><span class="milestone-check">${state.milestones[entry.id] ? icon("check", 17) : ""}</span></div>`).join("")}</div>`;
  }

  showCreate(defaultName = "New Wilderness") {
    this.el("#simple-eyebrow").textContent = "A NEW BEGINNING";
    this.el("#simple-title").innerHTML = "A world of your own<span>.</span>";
    this.el("#simple-body").innerHTML = `<div class="create-copy">Give it a name. Give it a seed. See what grows.</div><div class="form-field"><label for="world-name">WORLD NAME</label><input id="world-name" maxlength="28" autocomplete="off" value="${escapeHTML(defaultName)}" placeholder="Your wilderness"></div><div class="form-field"><label for="world-seed">WORLD SEED <span>LEAVE BLANK TO SURPRISE YOURSELF</span></label><div class="seed-field"><input id="world-seed" maxlength="40" autocomplete="off" placeholder="A number or a word"><button data-action="random-seed" type="button" title="Random seed" aria-label="Random seed">${icon("shuffle", 20)}</button></div></div><button class="button-primary create-submit" data-action="create"><span>Grow this world</span><span class="button-arrow">${icon("arrow", 20)}</span></button>`;
    this.open("create");
    setTimeout(() => this.el("#world-name")?.focus(), 50);
  }

  showWorlds(worlds) {
    this.el("#simple-eyebrow").textContent = "YOUR SAVED WILDERNESSES";
    this.el("#simple-title").innerHTML = "Your worlds<span>.</span>";
    const rows = worlds.map((world) => `<div class="world-row"><div class="world-row-main"><div class="world-row-mark">${brandMark}</div><div><strong>${escapeHTML(world.name)}</strong><small>SEED ${escapeHTML(String(world.seed))} &nbsp; / &nbsp; DAY ${String(world.day || 1).padStart(2, "0")}</small></div></div><div class="world-row-actions"><button data-action="play-world" data-id="${escapeHTML(world.id)}">ENTER ${icon("arrow", 16)}</button><button data-action="delete-world" data-id="${escapeHTML(world.id)}" class="delete-world" aria-label="Delete ${escapeHTML(world.name)}">${icon("close", 16)}</button></div></div>`).join("");
    this.el("#simple-body").innerHTML = `<div class="world-list">${rows || '<p class="empty-worlds">No worlds yet. The first one is waiting for you.</p>'}</div><button class="world-create-link" data-action="new-world">+ &nbsp; CREATE A NEW WORLD</button>`;
    this.open("worlds");
  }

  showHelp() {
    this.el("#simple-eyebrow").textContent = "THE FIELD GUIDE";
    this.el("#simple-title").innerHTML = "Find your way<span>.</span>";
    this.el("#simple-body").innerHTML = `<p class="help-intro">There are no quests to chase. Start with a tree, follow your curiosity, and make the world your own.</p><div class="help-groups"><div class="help-group"><h3>WANDER</h3><div><kbd>W A S D</kbd><span>Move around</span></div><div><kbd>MOUSE</kbd><span>Look around</span></div><div><kbd>SPACE</kbd><span>Jump or swim</span></div><div><kbd>SHIFT</kbd><span>Sprint</span></div></div><div class="help-group"><h3>MAKE</h3><div><kbd>HOLD CLICK</kbd><span>Gather blocks</span></div><div><kbd>RIGHT CLICK</kbd><span>Place or interact</span></div><div><kbd>1 - 9</kbd><span>Choose a hotbar slot</span></div><div><kbd>E</kbd><span>Backpack and crafting</span></div></div></div><div class="help-tip">Try gathering a log, turning it into planks, then crafting a wooden pickaxe. Mosslings share their wool if you meet one.</div>`;
    this.open("help");
  }

  showSettings(settings) {
    this.el("#simple-eyebrow").textContent = "MAKE IT FEEL RIGHT";
    this.el("#simple-title").innerHTML = "Settings<span>.</span>";
    this.el("#simple-body").innerHTML = `<div class="settings-list"><label class="setting-row"><span><strong>Look sensitivity</strong><small>How quickly your view turns</small></span><div><input id="setting-sensitivity" type="range" min="0.35" max="2.2" step="0.05" value="${settings.sensitivity}"><output id="sensitivity-value">${Math.round(settings.sensitivity * 100)}%</output></div></label><label class="setting-row"><span><strong>Sound volume</strong><small>Little sounds of the wilderness</small></span><div><input id="setting-volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><output id="volume-value">${Math.round(settings.volume * 100)}%</output></div></label><label class="setting-row"><span><strong>View distance</strong><small>How far the world grows around you</small></span><select id="setting-distance"><option value="2" ${settings.renderDistance === 2 ? "selected" : ""}>Near</option><option value="3" ${settings.renderDistance === 3 ? "selected" : ""}>Balanced</option><option value="4" ${settings.renderDistance === 4 ? "selected" : ""}>Far</option></select></label><label class="setting-row"><span><strong>Sun shadows</strong><small>More detail on powerful devices</small></span><input id="setting-shadows" type="checkbox" ${settings.shadows ? "checked" : ""}></label><label class="setting-row"><span><strong>Reduced motion</strong><small>Turn off camera bobbing</small></span><input id="setting-motion" type="checkbox" ${settings.reducedMotion ? "checked" : ""}></label></div><p class="settings-note">Changes are saved automatically.</p>`;
    this.open("settings");
    this.el("#setting-sensitivity").addEventListener("input", (e) => { this.el("#sensitivity-value").textContent = `${Math.round(e.target.value * 100)}%`; this.callbacks.setting?.("sensitivity", Number(e.target.value)); });
    this.el("#setting-volume").addEventListener("input", (e) => { this.el("#volume-value").textContent = `${Math.round(e.target.value * 100)}%`; this.callbacks.setting?.("volume", Number(e.target.value)); });
    this.el("#setting-distance").addEventListener("change", (e) => this.callbacks.setting?.("renderDistance", Number(e.target.value)));
    this.el("#setting-shadows").addEventListener("change", (e) => this.callbacks.setting?.("shadows", e.target.checked));
    this.el("#setting-motion").addEventListener("change", (e) => this.callbacks.setting?.("reducedMotion", e.target.checked));
  }

  setSound(muted) {
    this.el(".menu-sound").innerHTML = icon(muted ? "muted" : "sound", 21);
    this.el(".menu-sound").title = muted ? "Turn sound on" : "Mute sound";
  }

  setWorldName(name) { this.el("#pause-world-name").textContent = `${name} is saved as you go.`; }

  sleepFade(callback) {
    const layer = this.el("#sleep-fade");
    layer.classList.add("visible");
    setTimeout(() => { callback(); layer.classList.remove("visible"); }, 850);
  }

  dispose() {
    this.root.removeEventListener("click", this.onClick);
    this.root.replaceChildren();
  }
}