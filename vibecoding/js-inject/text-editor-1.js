(() => {
  const IFRAME_URL = "https://cc-fusion.github.io/tools/text-editor.html";
  const INITIAL_WIDTH = 420;
  const MIN_WIDTH = 0;
  const TAB_SIZE = 46;

  document.getElementById("__right_iframe_dock__")?.remove();
  document.getElementById("__right_iframe_style__")?.remove();
  document.getElementById("__right_iframe_tab__")?.remove();
  document.getElementById("__right_iframe_drag_overlay__")?.remove();

  /* ── save original body margin so we can restore on destroy ── */
  const originalBodyMarginRight = document.body.style.marginRight;

  const style = document.createElement("style");
  style.id = "__right_iframe_style__";
  style.textContent = `
    #__right_iframe_dock__ {
      position: fixed;
      top: 0;
      right: 0;
      height: 100dvh;
      width: var(--dock-width, ${INITIAL_WIDTH}px);
      z-index: 2147483000;
      display: flex;
      flex-direction: row;
      background: #fff;
      box-shadow: -2px 0 8px rgba(0,0,0,.12);
      box-sizing: border-box;
      overflow: visible;
      transition: none;
    }

    #__right_iframe_dock__ .dock-grip {
      position: absolute;
      left: -6px;
      top: 0;
      width: 12px;
      height: 100%;
      cursor: col-resize;
      background: transparent;
      touch-action: none;
      z-index: 3;
    }

    #__right_iframe_dock__ .dock-grip::after {
      content: "";
      position: absolute;
      top: 45%;
      left: 3px;
      width: 5px;
      height: 70px;
      border-radius: 5px;
      background: #8993a3;
      opacity: .65;
    }

    #__right_iframe_dock__ .dock-frame {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: white;
      flex: 1;
      min-width: 0;
    }

    #__right_iframe_tab__ {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: ${TAB_SIZE / 2}px;
      height: ${TAB_SIZE}px;
      border: 0;
      border-radius: ${TAB_SIZE}px 0 0 ${TAB_SIZE}px;
      background: #263449;
      color: white;
      z-index: 2147483001;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font: bold 22px sans-serif;
      padding: 0;
      box-shadow: none;
      touch-action: none;
    }

    #__right_iframe_tab__.visible {
      display: flex;
    }

    #__right_iframe_drag_overlay__ {
      position: fixed;
      inset: 0;
      z-index: 2147483002;
      display: none;
      cursor: col-resize;
      background: transparent;
      touch-action: none;
    }
  `;
  document.head.appendChild(style);

  const dock = document.createElement("div");
  dock.id = "__right_iframe_dock__";
  dock.style.setProperty("--dock-width", INITIAL_WIDTH + "px");

  const frame = document.createElement("iframe");
  frame.className = "dock-frame";
  frame.src = IFRAME_URL;
  frame.title = "Side panel";
  frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

  const grip = document.createElement("div");
  grip.className = "dock-grip";
  grip.title = "Drag to resize or hide";

  dock.append(frame, grip);
  document.body.appendChild(dock);

  const tab = document.createElement("button");
  tab.id = "__right_iframe_tab__";
  tab.textContent = "‹";
  tab.title = "Show side panel";
  tab.setAttribute("aria-label", "Show side panel");
  document.body.appendChild(tab);

  const overlay = document.createElement("div");
  overlay.id = "__right_iframe_drag_overlay__";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  let width = INITIAL_WIDTH;
  let dragging = false;
  let startX = 0;
  let startWidth = width;
  let pointerId = null;

  function setWidth(value) {
    width = Math.max(MIN_WIDTH, Math.min(window.innerWidth, value));

    dock.style.setProperty("--dock-width", width + "px");

    /* ── push main document content instead of overlaying it ── */
    document.body.style.marginRight = width + "px";

    tab.classList.toggle("visible", width === 0);
    dock.style.pointerEvents = width === 0 ? "none" : "auto";
  }

  /* apply initial margin immediately */
  setWidth(INITIAL_WIDTH);

  function showDock() {
    if (width === 0) {
      setWidth(Math.min(INITIAL_WIDTH, window.innerWidth));
    }
  }

  function hideDock() {
    setWidth(0);
  }

  tab.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    dragging = true;
    startX = event.clientX;
    startWidth = width;
    pointerId = event.pointerId;

    overlay.style.display = "block";

    try {
      overlay.setPointerCapture(pointerId);
    } catch (_) {}
  });

  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    event.preventDefault();
    event.stopPropagation();

    dragging = true;
    startX = event.clientX;
    startWidth = width;
    pointerId = event.pointerId;

    overlay.style.display = "block";

    try {
      overlay.setPointerCapture(pointerId);
    } catch (_) {}
  });

  function onMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    setWidth(startWidth + startX - event.clientX);
  }

  function finishDrag() {
    if (!dragging) return;

    dragging = false;
    overlay.style.display = "none";

    try {
      if (pointerId !== null && overlay.hasPointerCapture(pointerId)) {
        overlay.releasePointerCapture(pointerId);
      }
    } catch (_) {}

    pointerId = null;
  }

  overlay.addEventListener("pointermove", onMove);
  overlay.addEventListener("pointerup", finishDrag);
  overlay.addEventListener("pointercancel", finishDrag);
  overlay.addEventListener("lostpointercapture", finishDrag);

  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerup", finishDrag, true);

  window.addEventListener("resize", () => {
    setWidth(Math.min(width, window.innerWidth));
  });

  window.__rightIframeDock = {
    show: showDock,
    hide: hideDock,
    setWidth,
    destroy() {
      finishDrag();
      document.body.style.marginRight = originalBodyMarginRight;   /* restore */
      dock.remove();
      tab.remove();
      overlay.remove();
      style.remove();
      delete window.__rightIframeDock;
    }
  };

  console.log("Right iframe dock installed.", window.__rightIframeDock);
})();
