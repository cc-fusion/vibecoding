/* Builds the self contained single file solver (HTML + JS + CSS) into
   public/standalone.html so it is shipped next to the app and can also be
   opened straight from disk.                                          */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const core = read("src/solver/core.js").replace(/<\/script/gi, "<\\/script");
const app = read("src/solver/standalone-app.js").replace(/<\/script/gi, "<\\/script");
const tpl = read("src/solver/standalone-template.html");

const html = tpl
  .replace("/*__CORE__*/", () => core)
  .replace("/*__APP__*/", () => app);

mkdirSync(resolve(root, "public"), { recursive: true });
writeFileSync(resolve(root, "public/standalone.html"), html);
console.log(
  `public/standalone.html  ${(html.length / 1024).toFixed(1)} kB  (core ${(
    core.length / 1024
  ).toFixed(1)} kB + app ${(app.length / 1024).toFixed(1)} kB)`,
);
