/* WebGL2 renderer for the WASM MPM solver output (2D orthographic / 3D orbit). */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function ortho(l, r, b, t) {
  return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -1, 0, -(r + l) / (r - l), -(t + b) / (t - b), 0, 1]);
}
function lookAt(eye, target, up) {
  const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

const POINT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
uniform mat4 uMVP; uniform float uSize; uniform bool uPersp;
out vec4 vColor;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); gl_PointSize = uPersp ? uSize / gl_Position.w : uSize; vColor = aColor; }`;
const POINT_FS = `#version 300 es
precision highp float;
in vec4 vColor; uniform bool uPersp; out vec4 o;
void main(){
  vec2 c = gl_PointCoord*2.0-1.0; float r2 = dot(c,c); if (r2 > 1.0) discard;
  vec3 col = vColor.rgb;
  if (uPersp) { vec3 n = vec3(c.x,-c.y,sqrt(1.0-r2)); vec3 l = normalize(vec3(0.35,0.8,0.55));
    float d = max(dot(n,l),0.0); float s = pow(max(dot(reflect(-l,n),vec3(0,0,1)),0.0),24.0);
    col = col*(0.3+0.8*d) + vec3(0.22*s);
  } else { col *= 0.86 + 0.14*(1.0-r2); }
  o = vec4(col,1.0);
}`;
const FLAT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aColor;
uniform mat4 uMVP; out vec4 vColor;
void main(){ gl_Position = uMVP*vec4(aPos,1.0); vColor = aColor; }`;
const FLAT_FS = `#version 300 es
precision highp float; in vec4 vColor; out vec4 o; void main(){ o = vColor; }`;
const MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN; layout(location=2) in vec4 aColor;
uniform mat4 uMVP; out vec3 vN; out vec3 vP; out vec4 vColor;
void main(){ gl_Position = uMVP*vec4(aPos,1.0); vN = aN; vP = aPos; vColor = aColor; }`;
const MESH_FS = `#version 300 es
precision highp float; in vec3 vN; in vec3 vP; in vec4 vColor; uniform vec3 uEye; out vec4 o;
void main(){ vec3 n = normalize(vN); vec3 v = normalize(uEye - vP); if (dot(n,v) < 0.0) n = -n;
  vec3 l = normalize(vec3(0.35,0.8,0.55)); float d = max(dot(n,l),0.0); float rim = pow(1.0-max(dot(n,v),0.0),2.0);
  o = vec4(vColor.rgb*(0.38+0.68*d) + 0.12*rim, vColor.a); }`;
const TEX_VS = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV; uniform mat4 uMVP; out vec2 vUV;
void main(){ gl_Position = uMVP*vec4(aPos,0.0,1.0); vUV = aUV; }`;
const TEX_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; out vec4 o; void main(){ o = texture(uTex, vUV); }`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.lsTexture = null;
    this.info = null;
    this.decor = [];
    this.count = 0;
    this.rigids = new Float32Array(1);
    this.blocks = null;
    this.blockSize = 8;
    this.raf = 0;
    this.options = { showRigids: true, showBlocks: false, pointScale: 1 };
    this.camera = { target: [0.5, 0.35, 0.5], distance: 1.4, yaw: 30, pitch: 22 };
    this.defaultCamera = { ...this.camera };

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.pPoint = this.program(POINT_VS, POINT_FS, ['uMVP', 'uSize', 'uPersp']);
    this.pFlat = this.program(FLAT_VS, FLAT_FS, ['uMVP']);
    this.pMesh = this.program(MESH_VS, MESH_FS, ['uMVP', 'uEye']);
    this.pTex = this.program(TEX_VS, TEX_FS, ['uMVP', 'uTex']);
    // particles: [x y z f32][rgba u8]
    this.vaoPoints = gl.createVertexArray();
    this.vboPoints = gl.createBuffer();
    gl.bindVertexArray(this.vaoPoints);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPoints);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 16, 12);
    // flat: [x y z][r g b a]
    this.vaoFlat = gl.createVertexArray();
    this.vboFlat = gl.createBuffer();
    gl.bindVertexArray(this.vaoFlat);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboFlat);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    // mesh: [x y z][nx ny nz][r g b a]
    this.vaoMesh = gl.createVertexArray();
    this.vboMesh = gl.createBuffer();
    gl.bindVertexArray(this.vaoMesh);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboMesh);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    // textured quad
    this.vaoTex = gl.createVertexArray();
    this.vboTex = gl.createBuffer();
    gl.bindVertexArray(this.vaoTex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboTex);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.attachControls();
    this.resize();
  }

  program(vs, fs, uniforms) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
    const u = {};
    for (const n of uniforms) u[n] = gl.getUniformLocation(prog, n);
    return { prog, u };
  }

  attachControls() {
    let dragging = false, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.info?.dim !== 3) return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.camera.yaw -= (e.clientX - lx) * 0.4;
      this.camera.pitch = Math.max(-5, Math.min(85, this.camera.pitch + (e.clientY - ly) * 0.3));
      lx = e.clientX;
      ly = e.clientY;
      this.requestRender();
    });
    const end = () => (dragging = false);
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      if (this.info?.dim !== 3) return;
      e.preventDefault();
      this.camera.distance = Math.max(0.4, Math.min(4, this.camera.distance * Math.exp(e.deltaY * 0.001)));
      this.requestRender();
    }, { passive: false });
    this.canvas.addEventListener('dblclick', () => {
      this.camera = { ...this.defaultCamera, target: [...this.defaultCamera.target] };
      this.requestRender();
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.requestRender();
  }

  setScene(info, camera, decor = []) {
    this.info = info;
    this.decor = decor;
    this.count = 0;
    this.rigids = new Float32Array(1);
    this.blocks = null;
    if (camera) {
      this.camera = { target: [...camera.target], distance: camera.distance, yaw: camera.yaw, pitch: camera.pitch };
      this.defaultCamera = { ...this.camera, target: [...this.camera.target] };
    } else {
      this.camera = { target: [0.5, 0.35, 0.5], distance: 1.4, yaw: 30, pitch: 22 };
      this.defaultCamera = { ...this.camera, target: [...this.camera.target] };
    }
    // levelset texture
    const gl = this.gl;
    if (this.lsTexture) {
      gl.deleteTexture(this.lsTexture);
      this.lsTexture = null;
    }
    const ls = info.levelset;
    if (ls && ls.data && ls.nx > 0 && info.dim === 2) {
      const nx = ls.nx, ny = ls.ny;
      const tex = gl.createTexture();
      this.lsTexture = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const rgba = new Uint8Array(nx * ny * 4);
      for (let i = 0; i < nx * ny; i++) {
        const v = ls.data[i];
        const a = Math.max(0, Math.min(1, 0.5 - v * 8));
        // encode signed distance as grayscale + alpha
        const c = v < 0 ? 60 : 200;
        rgba[i * 4] = c;
        rgba[i * 4 + 1] = c;
        rgba[i * 4 + 2] = c;
        rgba[i * 4 + 3] = Math.round(a * 40);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nx, ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const dx = 1 / info.res;
      const x0 = -0.5 * dx, x1 = (nx - 0.5) * dx, y0 = -0.5 * dx, y1 = (ny - 0.5) * dx;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboTex);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, 0, 0, x1, y0, 1, 0, x1, y1, 1, 1, x0, y0, 0, 0, x1, y1, 1, 1, x0, y1, 0, 1]), gl.STATIC_DRAW);
    }
    this.requestRender();
  }

  setFrame(particles, count, rigids, blocks, blockSize) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPoints);
    gl.bufferData(gl.ARRAY_BUFFER, particles, gl.DYNAMIC_DRAW);
    this.count = count;
    this.rigids = rigids;
    this.blocks = blocks;
    this.blockSize = blockSize;
    this.requestRender();
  }

  requestRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  view2D() {
    const w = this.canvas.width, h = this.canvas.height, a = w / h;
    const m = 0.52;
    if (a >= 1) return { mvp: ortho(0.5 - m * a, 0.5 + m * a, 0.5 - m, 0.5 + m), ppu: h / (2 * m) };
    return { mvp: ortho(0.5 - m, 0.5 + m, 0.5 - m / a, 0.5 + m / a), ppu: w / (2 * m) };
  }

  view3D() {
    const c = this.camera;
    const yaw = (c.yaw * Math.PI) / 180, pitch = (c.pitch * Math.PI) / 180;
    const eye = [c.target[0] + c.distance * Math.cos(pitch) * Math.sin(yaw), c.target[1] + c.distance * Math.sin(pitch), c.target[2] + c.distance * Math.cos(pitch) * Math.cos(yaw)];
    const proj = perspective((40 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.02, 20);
    return { mvp: mul(proj, lookAt(eye, c.target, [0, 1, 0])), eye, proj11: proj[5] };
  }

  drawFlat(data, mode, mvp) {
    if (!data.length) return;
    const gl = this.gl;
    gl.useProgram(this.pFlat.prog);
    gl.uniformMatrix4fv(this.pFlat.u.uMVP, false, mvp);
    gl.bindVertexArray(this.vaoFlat);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboFlat);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW);
    gl.drawArrays(mode, 0, data.length / 7);
  }

  parseRigids(cb) {
    const r = this.rigids;
    if (!r.length) return;
    const u32 = new Uint32Array(r.buffer, r.byteOffset, r.length);
    const dim = this.info?.dim ?? 2;
    let off = 1;
    for (let k = 0; k < r[0]; k++) {
      const nElem = r[off + 1];
      const c = u32[off + 2];
      const rgb = [(c & 255) / 255, ((c >> 8) & 255) / 255, ((c >> 16) & 255) / 255];
      const codim = r[off + 3] > 0.5;
      const len = nElem * dim * dim;
      cb(Array.from(r.subarray(off + 4, off + 4 + len)), nElem, rgb, codim);
      off += 4 + len;
    }
  }

  render() {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.043, 0.059, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.info) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (this.info.dim === 2) this.render2D();
    else this.render3D();
  }

  render2D() {
    const gl = this.gl;
    const info = this.info;
    const { mvp, ppu } = this.view2D();
    const dx = 1 / info.res;
    gl.disable(gl.DEPTH_TEST);
    const lines = [];
    const rect = (x0, y0, x1, y1, c) => {
      const p = [[x0, y0], [x1, y0], [x1, y0], [x1, y1], [x1, y1], [x0, y1], [x0, y1], [x0, y0]];
      for (const q of p) lines.push(q[0], q[1], 0, ...c);
    };
    rect(0, 0, 1, 1, [0.35, 0.42, 0.55, 0.9]);
    const b = 7 * dx;
    rect(b, b, 1 - b, 1 - b, [0.9, 0.35, 0.35, 0.18]);
    if (this.options.showBlocks && this.blocks) {
      const bs = this.blockSize * dx;
      for (let i = 0; i + 2 < this.blocks.length; i += 3) {
        const rigid = this.blocks[i + 2] > 0.5;
        rect(this.blocks[i], this.blocks[i + 1], this.blocks[i] + bs, this.blocks[i + 1] + bs, rigid ? [1, 0.6, 0.2, 0.45] : [0.3, 0.8, 1, 0.22]);
      }
    }
    if (this.lsTexture) {
      gl.useProgram(this.pTex.prog);
      gl.uniformMatrix4fv(this.pTex.u.uMVP, false, mvp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.lsTexture);
      gl.uniform1i(this.pTex.u.uTex, 0);
      gl.bindVertexArray(this.vaoTex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    this.drawFlat(lines, gl.LINES, mvp);
    if (this.count > 0) {
      gl.useProgram(this.pPoint.prog);
      gl.uniformMatrix4fv(this.pPoint.u.uMVP, false, mvp);
      gl.uniform1f(this.pPoint.u.uSize, Math.max(1.5, ppu * dx * 0.62 * this.options.pointScale));
      gl.uniform1i(this.pPoint.u.uPersp, 0);
      gl.bindVertexArray(this.vaoPoints);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }
    if (this.options.showRigids) {
      const tris = [];
      const hw = (1.6 * (window.devicePixelRatio || 1)) / ppu;
      this.parseRigids((v, n, rgb, codim) => {
        let cx = 0, cy = 0;
        for (let e = 0; e < n * 2; e++) {
          cx += v[e * 2];
          cy += v[e * 2 + 1];
        }
        cx /= n * 2;
        cy /= n * 2;
        for (let e = 0; e < n; e++) {
          const ax = v[e * 4], ay = v[e * 4 + 1], bx = v[e * 4 + 2], by = v[e * 4 + 3];
          if (!codim) tris.push(cx, cy, 0, ...rgb, 0.45, ax, ay, 0, ...rgb, 0.45, bx, by, 0, ...rgb, 0.45);
          const l = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (-(by - ay) / l) * hw, ny = ((bx - ax) / l) * hw;
          const ex = ((bx - ax) / l) * hw * 0.5, ey = ((by - ay) / l) * hw * 0.5;
          const c = [Math.min(1, rgb[0] * 1.15 + 0.08), Math.min(1, rgb[1] * 1.15 + 0.08), Math.min(1, rgb[2] * 1.15 + 0.08), 1];
          const p0 = [ax + nx - ex, ay + ny - ey], p1 = [ax - nx - ex, ay - ny - ey], p2 = [bx - nx + ex, by - ny + ey], p3 = [bx + nx + ex, by + ny + ey];
          for (const q of [p0, p1, p2, p0, p2, p3]) tris.push(q[0], q[1], 0, ...c);
        }
      });
      this.drawFlat(tris, gl.TRIANGLES, mvp);
    }
  }

  render3D() {
    const gl = this.gl;
    const info = this.info;
    const { mvp, eye, proj11 } = this.view3D();
    const dx = 1 / info.res;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    const tris = [];
    const lines = [];
    const L = (a, b, c) => lines.push(a[0], a[1], a[2], ...c, b[0], b[1], b[2], ...c);
    const box = (lo, hi, c) => {
      const p = (i) => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
      for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) L(p(a), p(b), c);
    };
    box([0, 0, 0], [1, 1, 1], [0.35, 0.42, 0.55, 0.35]);
    for (const d of this.decor) {
      if (d.kind === 'floor' || d.kind === 'box') {
        const y = d.kind === 'floor' ? d.y : d.lower[1];
        const lo = d.kind === 'floor' ? [0, 0] : [d.lower[0], d.lower[2]];
        const hi = d.kind === 'floor' ? [1, 1] : [d.upper[0], d.upper[2]];
        const fc = [0.16, 0.2, 0.28, 1];
        tris.push(lo[0], y, lo[1], ...fc, hi[0], y, lo[1], ...fc, hi[0], y, hi[1], ...fc, lo[0], y, lo[1], ...fc, hi[0], y, hi[1], ...fc, lo[0], y, hi[1], ...fc);
        for (let i = 0; i <= 10; i++) {
          const tx = lo[0] + ((hi[0] - lo[0]) * i) / 10, tz = lo[1] + ((hi[1] - lo[1]) * i) / 10;
          L([tx, y + 0.001, lo[1]], [tx, y + 0.001, hi[1]], [0.3, 0.38, 0.5, 0.5]);
          L([lo[0], y + 0.001, tz], [hi[0], y + 0.001, tz], [0.3, 0.38, 0.5, 0.5]);
        }
        if (d.kind === 'box') box(d.lower, d.upper, [0.55, 0.65, 0.8, 0.6]);
      } else if (d.kind === 'cylinder') {
        const n = 48;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
          const p = (a, y) => [d.center[0] + d.radius * Math.cos(a), y, d.center[2] + d.radius * Math.sin(a)];
          L(p(a0, d.y0), p(a1, d.y0), [0.55, 0.65, 0.8, 0.7]);
          L(p(a0, d.y1), p(a1, d.y1), [0.55, 0.65, 0.8, 0.7]);
          if (i % 6 === 0) L(p(a0, d.y0), p(a0, d.y1), [0.55, 0.65, 0.8, 0.35]);
        }
      }
    }
    this.drawFlat(tris, gl.TRIANGLES, mvp);
    if (this.count > 0) {
      gl.useProgram(this.pPoint.prog);
      gl.uniformMatrix4fv(this.pPoint.u.uMVP, false, mvp);
      gl.uniform1f(this.pPoint.u.uSize, dx * 0.62 * this.options.pointScale * proj11 * this.canvas.height);
      gl.uniform1i(this.pPoint.u.uPersp, 1);
      gl.bindVertexArray(this.vaoPoints);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }
    if (this.options.showRigids) {
      const mesh = [];
      this.parseRigids((v, n, rgb) => {
        for (let e = 0; e < n; e++) {
          const a = [v[e * 9], v[e * 9 + 1], v[e * 9 + 2]], b = [v[e * 9 + 3], v[e * 9 + 4], v[e * 9 + 5]], c = [v[e * 9 + 6], v[e * 9 + 7], v[e * 9 + 8]];
          const nn = norm(cross(sub(b, a), sub(c, a)));
          for (const p of [a, b, c]) mesh.push(...p, ...nn, ...rgb, 1);
        }
      });
      if (mesh.length) {
        gl.useProgram(this.pMesh.prog);
        gl.uniformMatrix4fv(this.pMesh.u.uMVP, false, mvp);
        gl.uniform3fv(this.pMesh.u.uEye, eye);
        gl.bindVertexArray(this.vaoMesh);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboMesh);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 10);
      }
    }
    this.drawFlat(lines, gl.LINES, mvp);
  }

  dispose() {
    this.ro.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
