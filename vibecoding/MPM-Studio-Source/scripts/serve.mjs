import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 5173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    const safe = path.resolve(root, `.${decoded}`);
    if (safe !== root && !safe.startsWith(root + path.sep)) throw new Error('Invalid path');
    let target = safe;
    if (!(await fs.stat(target).catch(() => null))) {
      const publicTarget = path.resolve(root, 'public', `.${decoded}`);
      if (publicTarget.startsWith(path.resolve(root, 'public') + path.sep) || publicTarget === path.resolve(root, 'public')) target = publicTarget;
    }
    if ((await fs.stat(target).catch(() => null))?.isDirectory()) target = path.join(target, 'index.html');
    const body = await fs.readFile(target);
    res.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
server.listen(port, '0.0.0.0', () => console.log(`MPM Studio: http://localhost:${port} (root: ${root})`));
