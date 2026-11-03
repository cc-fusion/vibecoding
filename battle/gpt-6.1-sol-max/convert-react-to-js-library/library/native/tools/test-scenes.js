// Headless smoke test of the WASM solver + scene scripts (run with node after esbuild bundling)
import { MPMEngine, TextureFactory } from '../../src/core/engine.js';
import { SCENES } from '../../src/core/scenes.js';
const which = process.argv[2] ?? 'all';
const frames = Number(process.argv[3] ?? 20);
const quality = (process.argv[4] ?? 'low');
(async () => {
    const engine = await MPMEngine.create((l, lvl) => { if (lvl !== 'info' && !l.includes('Ignored'))
        console.log(`  [${lvl}] ${l}`); });
    console.log('SIMD build:', engine.simd);
    for (const s of SCENES) {
        if (which !== 'all' && s.id !== which)
            continue;
        engine.reset();
        const t0 = performance.now();
        const { frameUpdate } = s.setup({ engine, tex: new TextureFactory(engine, s.dim), quality });
        const setupMs = performance.now() - t0;
        const t1 = performance.now();
        for (let f = 0; f < frames; f++) {
            frameUpdate?.(engine.time(), s.frameDt);
            engine.beginStep(s.frameDt);
            while (!engine.advance(1000))
                ;
        }
        const ms = performance.now() - t1;
        const st = engine.exportStats();
        const p = engine.exportParticles(0);
        let nan = 0, miny = 9, maxy = -9;
        for (let i = 0; i < p.count; i++) {
            const y = p.data[i * 4 + 1];
            if (!isFinite(y))
                nan++;
            miny = Math.min(miny, y);
            maxy = Math.max(maxy, y);
        }
        const rig = engine.exportRigids();
        const n = rig[0];
        let off = 1;
        const cents = [];
        for (let k = 0; k < n; k++) {
            const ne = rig[off + 1];
            const fl = s.dim * s.dim * ne;
            let cx = 0, cy = 0;
            for (let e = 0; e < ne * s.dim; e++) {
                cx += rig[off + 4 + e * s.dim];
                cy += rig[off + 4 + e * s.dim + 1];
            }
            cents.push(`(${(cx / (ne * s.dim)).toFixed(3)},${(cy / (ne * s.dim)).toFixed(3)})`);
            off += 4 + fl;
        }
        const names = ['sort', 'rigidify', 'artic', 'rastR', 'cdf', 'p2g', 'grid', 'bc', 'g2p', 'clean', 'advR'];
        const prof = names.map((nm, i) => `${nm}:${(st[17 + i] / st[15]).toFixed(2)}`).join(' ');
        console.log(`${s.id} [${quality}] setup ${setupMs.toFixed(0)}ms | ${frames} frames ${ms.toFixed(0)}ms | t=${st[0].toFixed(3)} substeps=${st[1]} particles=${st[2]} rigidP=${st[3]} near=${st[12]} | ${(st[16] / st[15]).toFixed(2)} ms/substep | nan=${nan} y=[${miny.toFixed(3)},${maxy.toFixed(3)}] mem=${engine.memoryMB().toFixed(0)}MB`);
        console.log(`   prof ${prof}`);
        console.log(`   rigid centroids ${cents.join(' ')}`);
    }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
