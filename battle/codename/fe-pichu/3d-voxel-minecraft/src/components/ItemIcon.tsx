import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { Block, BLOCKS } from '../game/blocks';

let atlas: THREE.CanvasTexture | null = null;
const tileOf = (id: Block) => ({ 0: 0, 1: 1, 2: 1, 3: 3, 4: 5, 5: 5, 6: 6, 7: 7, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16, 16: 17, 17: 18, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25 } as Record<number, number>)[id] || 0;
function makeAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!;
  for (let i = 0; i < 64; i++) {
    ctx.save(); ctx.translate(i % 8 * 32, Math.floor(i / 8) * 32); ctx.beginPath(); ctx.rect(0, 0, 32, 32); ctx.clip(); ctx.fillStyle = BLOCKS[i]?.color || '#b8c8ad'; ctx.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const color = ((x * 7 + y * 13 + i * 17) % 5) - 2; ctx.fillStyle = color > 0 ? `rgba(255,255,255,${color * .045})` : `rgba(30,49,31,${-color * .04})`; ctx.fillRect(x * 8, y * 8, 7, 7); }
    if ([7, 9, 17, 21].includes(i)) { ctx.strokeStyle = '#30433026'; for (let y = 0; y < 4; y++) { for (let x = 0; x < 2; x++) ctx.strokeRect(x * 16 - (y % 2 ? 8 : 0), y * 8, 15, 7); } }
    if (i === 4 || i === 18) { ctx.fillStyle = '#463c2b44'; ctx.fillRect(0, 0, 2, 32); ctx.fillRect(12, 0, 2, 32); ctx.fillRect(25, 0, 2, 32); }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; return texture;
}
export function ItemIcon({ id, size = 40 }: { id: Block; size?: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer | null = null;
    const group = new THREE.Group(); const scene = new THREE.Scene();
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(size, size); renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.current.appendChild(renderer.domElement);
      const camera = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -1.02, .1, 20); camera.position.set(3, 2.7, 4); camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight('#fff8e9', 2)); const light = new THREE.DirectionalLight('#ffffff', 2.6); light.position.set(-3, 5, 3); scene.add(light);
      if (!atlas) atlas = makeAtlas();
      const tex = atlas;
      function material(_tile: number, color?: string) { return new THREE.MeshLambertMaterial({ map: color ? null : tex, color: color || '#ffffff' }); }
      const repeat = (tile: number) => { const t = new THREE.Vector2(tile % 8 / 8, 1 - Math.ceil((tile + 1) / 8) / 8); return [t.x, t.y + .125, t.x + .125, t.y + .125, t.x + .125, t.y, t.x, t.y]; };
      function addBox(w: number, h: number, d: number, x: number, y: number, z: number, tile: number, color?: string) {
        const geo = new THREE.BoxGeometry(w, h, d), positions: number[] = []; const materials: THREE.Material[] = [];
        for (let face = 0; face < 6; face++) { if (id === Block.Grass && face === 2) positions.push(...repeat(0)); else if (id === Block.Grass && face === 3) positions.push(...repeat(3)); else positions.push(...repeat(tile)); materials.push(material(tile, color)); }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(positions, 2)); const mesh = new THREE.Mesh(geo, materials); mesh.position.set(x, y, z); group.add(mesh); return mesh;
      }
      if (id === Block.Pickaxe || id === Block.Axe || id === Block.StoneAxe) {
        const handle = addBox(.13, 1.1, .13, .12, -.08, 0, 7, '#865d34'); handle.rotation.z = -.65;
        if (id === Block.StoneAxe) { const head = addBox(.26, .48, .3, -.43, .37, 0, 9, '#a4ada4'); head.rotation.z = -.1; }
        else { const head = addBox(.83, .16, .18, -.08, .4, 0, 9, id === Block.Pickaxe ? '#be9660' : '#a4ada4'); head.rotation.z = -.1; addBox(.16, .26, .18, -.42, .3, 0, 9, id === Block.Pickaxe ? '#be9660' : '#a4ada4'); }
        group.rotation.y = -.4; group.scale.setScalar(.94);
      } else if (id === Block.CookedCarrot || id === Block.Carrot) {
        addBox(.3, .48, .32, 0, -.22, 0, 22, '#da9545'); addBox(.2, .25, .25, -.05, -.58, 0, 22, '#ce8038'); addBox(.1, .22, .1, -.05, .25, 0, 6, '#719742'); const leaf = addBox(.4, .1, .1, -.1, .3, 0, 6, '#719742'); leaf.rotation.z = .4;
      } else if (id === Block.BirchLeaves || id === Block.BirchLog) { addBox(1.1, 1.1, .3, 0, 0, 0, tileOf(id)); for (let i = 0; i < 7; i++) addBox(.12, .03, .03, Math.sin(i * 8) * .4, -.4 + i * .13, .18, 1, '#45553e'); }
      else if (id === Block.Workbench) addBox(1.08, .15, 1.08, 0, -.48, 0, 7, '#835e3e');
      scene.add(group);
      if (id === Block.Workbench) { addBox(1.08, .15, 1.08, 0, .38, 0, 7); }
      renderer.render(scene, camera);
    } catch { const div = document.createElement('div'); div.className = 'item-fallback'; div.style.background = BLOCKS[id]?.color || '#95ae7a'; host.current.appendChild(div); }
    return () => { group.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); scene.clear(); renderer?.dispose(); renderer?.domElement.remove(); };
  }, [id, size]);
  return <div ref={host} className="item-icon" style={{ width: size, height: size }} aria-hidden="true" />;
}
