#!/usr/bin/env python3
"""Optional, dependency-free packager for this project's plain JS modules.

Run after editing src/*.js or styles.css. The delivered index.html is already
self-contained: opening or serving it requires no build, packages, or network.
This deliberately supports only the simple import/export forms used here.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
modules = {}
chunks = []
imports = re.compile(r"^import\s+(.+?)\s+from\s+['\"](.+?)['\"];\s*$", re.M)
exports = re.compile(r"\bexport\s+(?:const|let|var|function)\s+(\w+)")


def collect(path):
    path = path.resolve()
    if path in modules:
        return modules[path]
    name = 'module_' + path.stem
    modules[path] = name
    text = path.read_text()
    exported = exports.findall(text)

    def resolve(m):
        binding, source = m.groups()
        if source.endswith('/vendor/decimal.mjs'):
            return 'const Decimal = window.Decimal;'
        dep = collect(path.parent / source)
        return f'const {binding} = {dep};'

    text = imports.sub(resolve, text)
    text = re.sub(r'\bexport\s+(?=const|let|var|function)', '', text)
    chunks.append(f'// ---- {path.relative_to(ROOT)} ----\nconst {name} = (() => {{\n{text}\nreturn {{ {", ".join(exported)} }};\n}})();')
    return name


collect(ROOT / 'src/main.js')
css = (ROOT / 'styles.css').read_text()
vendor = (ROOT / 'vendor/decimal.js').read_text()
script = vendor + '\n;(() => {\n"use strict";\n' + '\n\n'.join(chunks) + '\n})();\n'
assert '</script' not in script.lower()
html = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="A private, offline calculation notepad with inline math and unit conversions.">
  <title>Smart Text Editor</title>
  <style>
''' + css + '''
  </style>
</head>
<body>
  <div id="mirror" aria-hidden="true"><div id="mi"></div></div>
  <textarea id="ed" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="Notes" aria-describedby="hint"></textarea>
  <div id="bar">
    <div id="chips" role="group" aria-label="Calculation suggestions"></div>
    <div id="hint">Tab accept · ←→ switch</div>
  </div>
  <noscript>This editor needs JavaScript enabled to calculate suggestions.</noscript>
  <script>
''' + script + '''  </script>
</body>
</html>
'''
(ROOT / 'index.html').write_text(html)
print(f'Wrote self-contained index.html ({len(html.encode()):,} bytes)')
