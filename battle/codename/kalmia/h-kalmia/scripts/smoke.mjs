// DOM smoke test: drive the real app.js in jsdom.
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.Element = dom.window.Element;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;

const { mountSmartEditor } = await import("/tmp/ste-app-test.mjs");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ✓", msg); } else { fail++; console.log("  ✗", msg); } };

const root = document.getElementById("root");
const dispose = mountSmartEditor(root);
const ta = root.querySelector(".ste-input");
const mirror = root.querySelector(".ste-mirror");
const chips = () => [...root.querySelectorAll(".ste-chip")];
const ghost = () => root.querySelector(".ste-ghost")?.textContent ?? null;

const type = (text, caret = text.length) => {
  ta.value = text;
  ta.setSelectionRange(caret, caret);
  ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
};
const key = (k) => ta.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

ok(ta && mirror, "editor + mirror mounted");
ok(root.querySelector(".ste-placeholder"), "placeholder on empty doc");
ok(root.querySelectorAll(".ste-angle button").length === 2, "rad/deg quick switch present");
ok(root.querySelector(".ste-unit").hidden, "unit dropdown hidden without unit suggestion");

type("1+1");
ok(ghost() === "=2", "ghost '=2' for 1+1");
ok(chips().length === 1 && chips()[0].textContent.includes("=2"), "one chip '=2'");
ok(ta.value === "1+1", "text unchanged before accept");
key("Tab");
ok(ta.value === "1+1=2", "Tab accepts completion");
ok(ghost() === null, "no ghost after complete result");

type("sin(30)=");
ok(chips().length === 2, "two angle candidates");
ok(ghost() === "-0.988", "radians default");
ok(chips()[1].textContent.includes("deg"), "deg badge on alternative");
key("ArrowRight");
ok(ghost() === "0.5", "ArrowRight cycles ghost to alternative");
key("ArrowLeft");
ok(ghost() === "-0.988", "ArrowLeft cycles back");
key("ArrowRight");
key("Tab");
ok(ta.value === "sin(30)=0.5", "Tab accepts selected alternative");
ok(root.querySelector('.ste-angle button[data-angle="deg"]').classList.contains("is-active"), "angle mode switched to deg");

type("pi=3.142");
ok(ghost() === "15", "replacement continuation ghost");
ok(root.querySelector(".ste-replace")?.textContent === "2", "replaced digit shown struck");
key("Tab");
ok(ta.value === "pi=3.1415", "targeted replacement applied");

type("1km to mi");
ok(ghost() === " = 0.6214mi", "conversion ghost");
ok(!root.querySelector(".ste-unit").hidden, "unit dropdown visible for unit suggestion");
root.querySelector(".ste-unit-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const items = [...root.querySelectorAll(".ste-unit-item")];
ok(items.length > 3, "dropdown lists convertible units");
const ft = items.find((i) => i.dataset.expr === "ft");
ft?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(ghost() === " = 3281ft", "dropdown switch → ft");

type("hello world");
ok(chips().length === 0 && ghost() === null, "no suggestions for prose");

// settings overlay
root.querySelector(".ste-gear").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(root.querySelector(".ste-panel").classList.contains("is-open"), "settings panel opens");
ok(root.querySelector(".ste-overlay").classList.contains("is-open"), "overlay (blur) active");
const darkBtn = root.querySelector('.ste-seg[data-key="theme"] button[data-val="dark"]');
darkBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(root.dataset.theme === "dark", "dark theme applied");
root.querySelector(".ste-overlay").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(!root.querySelector(".ste-panel").classList.contains("is-open"), "outside click closes panel");
ok(JSON.parse(localStorage.getItem("ste:settings")).theme === "dark", "settings saved on close");

// developer tools
root.querySelector(".ste-gear").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const devToggle = root.querySelector('input[data-key="dev"]');
devToggle.checked = true;
devToggle.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
ok(!root.querySelector(".ste-dev").hidden, "developer section visible");
ok(root.querySelector(".ste-json").value.includes('"kg"'), "unit JSON prefilled");
const json = JSON.parse(root.querySelector(".ste-json").value);
json.km.coef = "1000";
root.querySelector(".ste-json").value = JSON.stringify(json);
root.querySelector('[data-act="apply-units"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(root.querySelector(".ste-json-msg").classList.contains("ok"), "unit JSON applied");
root.querySelector(".ste-json").value = "{ broken";
root.querySelector('[data-act="apply-units"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
ok(root.querySelector(".ste-json-msg").classList.contains("err"), "invalid JSON rejected");
ok(root.querySelector(".ste-log").textContent.length > 0, "console log has entries");

// Escape dismisses, caret move restores
type("2+2");
ok(ghost() === "=4", "suggestion active");
key("Escape");
ok(ghost() === null && chips().length === 0, "Escape dismisses");
type("2+2", 1);
ok(ghost() === null, "mid-expression caret → nothing");

dispose();
ok(root.innerHTML === "", "dispose cleans up");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
