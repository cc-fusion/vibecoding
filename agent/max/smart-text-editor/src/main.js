import { createEditor } from './controller.js';

// Native DOM entry point; no framework, virtual DOM, or runtime loader.
createEditor({
  ta: document.getElementById('ed'),
  mirror: document.getElementById('mirror'),
  mi: document.getElementById('mi'),
  bar: document.getElementById('bar'),
  chipsEl: document.getElementById('chips')
});
