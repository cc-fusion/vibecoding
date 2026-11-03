// Weather state machine (clear / rain / thunderstorm / snow) with GPU-cheap precipitation and lightning.
import * as THREE from 'three';

export class Weather {
  constructor(game) {
    this.game = game;
    this.rain = 0;          // smoothed intensity 0..1
    this.target = 0;
    this.storm = false;
    this.timer = 400 + Math.random() * 500;
    this.flash = 0;
    this.snowing = false;
    this.strikeTimer = 10;
    this.pending = [];       // delayed thunder
    const N = 900;
    this.N = N;
    this.drops = new Float32Array(N * 3);
    this.active = new Uint8Array(N);
    this.rainPos = new Float32Array(N * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.55, fog: true }));
    this.rainMesh.frustumCulled = false;
    this.snowPos = new Float32Array(N * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snowMesh = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, sizeAttenuation: true, fog: true }));
    this.snowMesh.frustumCulled = false;
    game.scene.add(this.rainMesh, this.snowMesh);
    this.rainMesh.visible = this.snowMesh.visible = false;
    for (let i = 0; i < N; i++) this.drops[i * 3 + 1] = -1000;
    // lightning
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false });
    this.bolt = new THREE.Group();
    game.scene.add(this.bolt);
    this.boltT = 0;
  }

  serialize() { return { rain: this.rain, target: this.target, storm: this.storm, timer: this.timer }; }
  load(s) { if (s) { this.rain = s.rain || 0; this.target = s.target || 0; this.storm = !!s.storm; this.timer = s.timer || 300; } }
  clearWeather() { this.target = 0; this.storm = false; this.timer = 500 + Math.random() * 500; }

  startStrike() {
    const g = this.game, p = g.player;
    const a = Math.random() * 6.283, d = 25 + Math.random() * 70;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    let y = 60;
    for (let yy = 127; yy > 0; yy--) if (g.world.getBlock(Math.floor(x), yy, Math.floor(z))) { y = yy + 1; break; }
    // build jagged bolt
    for (const c of [...this.bolt.children]) { this.bolt.remove(c); c.geometry.dispose(); }
    let cx = x, cz = z, cy = 150;
    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const ny = cy + (y - 150) / segs;
      const nx = cx + (Math.random() - 0.5) * 9, nz = cz + (Math.random() - 0.5) * 9;
      const len = Math.hypot(nx - cx, ny - cy, nz - cz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, len), this.boltMat);
      m.position.set((cx + nx) / 2, (cy + ny) / 2, (cz + nz) / 2);
      m.lookAt(nx, ny, nz);
      this.bolt.add(m);
      cx = nx; cy = ny; cz = nz;
    }
    this.boltT = 0.28;
    this.flash = 1;
    this.pending.push({ t: d / 60, x, y, z, d });
    g.particles.explosion(x, y + 1, z, 0.4);
    // strikes can ignite nothing but do scare nearby creepers; keep it atmospheric
  }

  update(dt, cam) {
    const g = this.game;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.target === 0) {
        this.target = 1; this.storm = Math.random() < 0.35; this.timer = 150 + Math.random() * 300;
      } else { this.target = 0; this.storm = false; this.timer = 420 + Math.random() * 600; }
    }
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), dt / 18);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.flash > 0.45 && Math.random() < dt * 5) this.flash = Math.min(1, this.flash + 0.3);
    if (this.boltT > 0) { this.boltT -= dt; this.bolt.visible = this.boltT > 0; }
    if (this.storm && this.rain > 0.6) {
      this.strikeTimer -= dt;
      if (this.strikeTimer <= 0) { this.strikeTimer = 7 + Math.random() * 18; this.startStrike(); }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const t = this.pending[i];
      t.t -= dt;
      if (t.t <= 0) { g.audio.play('thunder', { vol: Math.max(0.25, 1 - t.d / 120) }); this.pending.splice(i, 1); }
    }

    // precipitation type from local climate
    const [temp] = g.world.getClimate(Math.floor(cam.position.x), Math.floor(cam.position.z));
    this.snowing = temp < -0.2;
    const act = this.rain > 0.02;
    this.rainMesh.visible = act && !this.snowing;
    this.snowMesh.visible = act && this.snowing;
    if (!act) return;
    const N = this.N, w = g.world;
    const count = Math.floor(N * Math.min(1, 0.25 + this.rain * 0.75));
    const R = 15;
    const fall = this.snowing ? 2.2 : 24;
    for (let i = 0; i < N; i++) {
      const b = i * 3;
      if (i >= count) { this.drops[b + 1] = -1000; continue; }
      let y = this.drops[b + 1];
      let x = this.drops[b], z = this.drops[b + 2];
      if (y < -500 || y < cam.position.y - 12 || Math.abs(x - cam.position.x) > R || Math.abs(z - cam.position.z) > R) {
        x = cam.position.x + (Math.random() * 2 - 1) * R; z = cam.position.z + (Math.random() * 2 - 1) * R;
        y = cam.position.y + 4 + Math.random() * 14;
        const top = w.columnTop(Math.floor(x), Math.floor(z));
        if (top >= y - 1) y = -1000; // sheltered column
      } else {
        y -= fall * dt * (this.snowing ? 1 : 0.9 + (i % 7) * 0.03);
        if (this.snowing) { x += Math.sin(g.time * 1.3 + i) * dt * 0.5; z += Math.cos(g.time * 1.1 + i * 1.7) * dt * 0.5; }
        const top = w.columnTop(Math.floor(x), Math.floor(z));
        if (y < top + 1.0 && top >= 0) {
          if (!this.snowing && Math.random() < 0.12 && Math.hypot(x - cam.position.x, z - cam.position.z) < 11) g.particles.rainSplash(x, top + 1, z);
          y = -1000;
        }
      }
      this.drops[b] = x; this.drops[b + 1] = y; this.drops[b + 2] = z;
      if (this.snowing) { this.snowPos[b] = x; this.snowPos[b + 1] = y; this.snowPos[b + 2] = z; }
      else {
        const o = i * 6;
        this.rainPos[o] = x; this.rainPos[o + 1] = y; this.rainPos[o + 2] = z;
        this.rainPos[o + 3] = x - 0.05; this.rainPos[o + 4] = y + 0.7; this.rainPos[o + 5] = z - 0.02;
        if (y < -500) { this.rainPos[o + 1] = this.rainPos[o + 4] = -1000; }
      }
    }
    if (this.snowing) {
      for (let i = 0; i < N; i++) if (this.drops[i * 3 + 1] < -500) this.snowPos[i * 3 + 1] = -1000;
      this.snowMesh.geometry.attributes.position.needsUpdate = true;
    } else this.rainMesh.geometry.attributes.position.needsUpdate = true;
    this.rainMesh.material.opacity = 0.25 + this.rain * 0.35;
  }

  dispose() {
    this.game.scene.remove(this.rainMesh, this.snowMesh, this.bolt);
  }
}
