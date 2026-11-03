import { build } from "esbuild";
import { mkdir, copyFile, cp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

await mkdir("public/downloads", { recursive: true });
await build({
  entryPoints: ["library/src/mpm.js"],
  bundle: true,
  format: "iife",
  globalName: "MPM",
  target: "es2022",
  outfile: "public/downloads/mpm.js",
  minify: true,
  legalComments: "eof",
});
await build({
  entryPoints: ["library/src/mpm.js"],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: "public/downloads/mpm.esm.js",
  minify: true,
  legalComments: "eof",
});
await copyFile("DOCUMENTATION.md", "public/downloads/DOCUMENTATION.md");
await rm("/tmp/mpm-js-release", { recursive: true, force: true });
await mkdir("/tmp/mpm-js-release/mpm-js/dist", { recursive: true });
await cp("library/src", "/tmp/mpm-js-release/mpm-js/src", { recursive: true });
await cp("library/native", "/tmp/mpm-js-release/mpm-js/native", {
  recursive: true,
});
await cp("public/examples", "/tmp/mpm-js-release/mpm-js/examples", {
  recursive: true,
});
const example = await readFile("public/examples/index.html", "utf8");
await writeFile(
  "/tmp/mpm-js-release/mpm-js/examples/index.html",
  example
    .replaceAll("../downloads/mpm.js", "../dist/mpm.js")
    .replaceAll("../downloads/DOCUMENTATION.md", "../DOCUMENTATION.md"),
);
for (const file of ["mpm.js", "mpm.esm.js"])
  await copyFile(
    `public/downloads/${file}`,
    `/tmp/mpm-js-release/mpm-js/dist/${file}`,
  );
for (const file of ["DOCUMENTATION.md", "MIGRATION.md"])
  await copyFile(file, `/tmp/mpm-js-release/mpm-js/${file}`);
await copyFile(
  "library/UPSTREAM.json",
  "/tmp/mpm-js-release/mpm-js/UPSTREAM.json",
);
await writeFile(
  "/tmp/mpm-js-release/mpm-js/README.md",
  "# mpm.js\n\nA framework-free JavaScript interface to the original MLS-MPM + CPIC WebAssembly solver.\n\nServe this folder over HTTP, then open `examples/index.html`. No install or build step is needed. See DOCUMENTATION.md for the complete API and MIGRATION.md for conversion details.\n",
);
execFileSync(
  "zip",
  ["-qr", `${process.cwd()}/public/downloads/mpm-js-1.0.0.zip`, "mpm-js"],
  { cwd: "/tmp/mpm-js-release" },
);
console.log(
  "Built script-tag and ES module libraries, Markdown documentation, and the JavaScript source ZIP.",
);
