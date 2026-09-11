import type { FileRecord } from "./ProjectManager";

const now = () => Date.now();

const files: Record<string, string> = {
  "/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Forge IDE Preview</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="card">
      <h1>Hello from the sandboxed preview</h1>
      <p>This page loads <code>style.css</code> and <code>script.js</code> from the virtual project.</p>
      <button id="counter" type="button">Clicked 0 times</button>
      <p class="hint">Edit any of the three files — auto refresh re-renders the preview.</p>
      <p><a href="about.html">Go to about.html →</a></p>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`,
  "/about.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>About</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="card">
      <h1>About</h1>
      <p>Project-relative navigation works inside the sandbox.</p>
      <p><a href="index.html">← Back to index.html</a></p>
    </main>
  </body>
</html>
`,
  "/style.css": `:root {
  color-scheme: light;
  font-family: system-ui, sans-serif;
}
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f4f6fb;
  color: #1c2333;
}
.card {
  background: #fff;
  padding: 32px 36px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(20, 30, 60, 0.12);
  max-width: 460px;
}
h1 {
  margin-top: 0;
  font-size: 22px;
}
button {
  font: inherit;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #3b6fe0;
  background: #3b6fe0;
  color: #fff;
  cursor: pointer;
}
button:hover {
  background: #2f5cc4;
}
.hint {
  color: #6b7280;
  font-size: 13px;
}
`,
  "/script.js": `// Runs inside the sandboxed preview iframe when index.html is previewed,
// or inside an isolated Web Worker when you press Run on this file.
const isBrowserPage = typeof document !== "undefined";

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

if (isBrowserPage) {
  const button = document.getElementById("counter");
  let clicks = 0;
  button.addEventListener("click", () => {
    clicks += 1;
    button.textContent = \`Clicked \${clicks} time\${clicks === 1 ? "" : "s"}\`;
  });
  console.log("script.js loaded in the preview sandbox");
} else {
  console.log("Running script.js in a Web Worker");
  console.info("fib(20) =", fib(20));
  console.warn("This is a warning");
  console.table !== undefined && console.log({ nested: { ok: true }, list: [1, 2, 3] });
}
`,
  "/main.ts": `import { mean, type Stats } from "./lib/math";

interface Reading {
  sensor: string;
  values: number[];
}

const readings: Reading[] = [
  { sensor: "temp", values: [21.4, 22.1, 21.9] },
  { sensor: "humidity", values: [40, 42, 39, 41] },
];

function summarize(reading: Reading): Stats {
  const avg = mean(reading.values);
  return { sensor: reading.sensor, mean: Number(avg.toFixed(2)), samples: reading.values.length };
}

for (const r of readings) {
  console.log(summarize(r));
}

// Try introducing a type error, e.g.  const x: number = "text";
`,
  "/lib/math.ts": `export interface Stats {
  sensor: string;
  mean: number;
  samples: number;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
`,
  "/main.py": `import math
from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)


def primes(limit: int):
    sieve = [True] * (limit + 1)
    for n in range(2, limit + 1):
        if sieve[n]:
            yield n
            for m in range(n * n, limit + 1, n):
                sieve[m] = False


if __name__ == "__main__":
    a, b = Point(0, 0), Point(3, 4)
    print(f"distance = {a.distance_to(b)}")
    print("primes <= 50:", list(primes(50)))
    # Uncomment to see a traceback in the Output panel:
    # raise ValueError("boom")
`,
  "/assembly/index.ts": `// AssemblyScript — compiled to WebAssembly by the real asc compiler in a Worker.
// Files inside assembly/ (or named *.as.ts) are treated as AssemblyScript.

export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function fib(n: i32): i32 {
  let a: i32 = 0, b: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const t = a + b;
    a = b;
    b = t;
  }
  return a;
}

export function main(): i32 {
  console.log("Hello from WebAssembly");
  console.log("fib(30) = " + fib(30).toString());
  return add(40, 2);
}
`,
  "/main.cpp": `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> values{1, 2, 3, 4, 5};
    int sum = std::accumulate(values.begin(), values.end(), 0);
    std::cout << "sum = " << sum << std::endl;
    return 0;
}
`,
  "/Program.cs": `using System;
using System.Linq;

class Program
{
    static void Main()
    {
        var squares = Enumerable.Range(1, 5).Select(n => n * n);
        Console.WriteLine($"squares: {string.Join(", ", squares)}");
    }
}
`,
  "/Main.java": `import java.util.stream.IntStream;

public class Main {
    public static void main(String[] args) {
        int total = IntStream.rangeClosed(1, 10).sum();
        System.out.println("total = " + total);
    }
}
`,
  "/data/config.json": `{
  "name": "forge-ide-sample",
  "version": "1.0.0",
  "features": ["autosave", "monaco", "workers"]
}
`,
};

export function createDefaultProject(): FileRecord[] {
  const t = now();
  const records: FileRecord[] = [
    { path: "/lib", type: "dir", updatedAt: t },
    { path: "/assembly", type: "dir", updatedAt: t },
    { path: "/data", type: "dir", updatedAt: t },
  ];
  for (const [path, content] of Object.entries(files)) {
    records.push({ path, type: "file", content, language: null, updatedAt: t });
  }
  return records;
}

export const DEFAULT_OPEN_FILE = "/index.html";
