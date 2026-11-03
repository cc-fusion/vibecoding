// Progression: achievements + lifetime statistics.
import { B, I } from './blocks.js';

export const ADVANCEMENTS = [
  { id: 'wood', title: 'Getting Wood', desc: 'Harvest a log from a tree', icon: B.LOG },
  { id: 'table', title: 'Benchmarking', desc: 'Craft a crafting table', icon: B.CRAFTING_TABLE },
  { id: 'pick', title: 'Time to Mine', desc: 'Craft a wooden pickaxe', icon: I.WOOD_PICKAXE },
  { id: 'stone', title: 'Stone Age', desc: 'Mine cobblestone', icon: B.COBBLE },
  { id: 'upgrade', title: 'Getting an Upgrade', desc: 'Craft a stone pickaxe', icon: I.STONE_PICKAXE },
  { id: 'torch', title: 'Light It Up', desc: 'Place a torch', icon: B.TORCH },
  { id: 'furnace', title: 'Hot Topic', desc: 'Craft a furnace', icon: B.FURNACE },
  { id: 'iron', title: 'Acquire Hardware', desc: 'Smelt an iron ingot', icon: I.IRON_INGOT },
  { id: 'ironpick', title: 'Isn\'t It Iron Pick', desc: 'Craft an iron pickaxe', icon: I.IRON_PICKAXE },
  { id: 'diamond', title: 'Diamonds!', desc: 'Find a diamond', icon: I.DIAMOND },
  { id: 'cook', title: 'Bon Appétit', desc: 'Eat some cooked food', icon: I.COOKED_BEEF },
  { id: 'hunter', title: 'Monster Hunter', desc: 'Defeat a hostile monster', icon: I.IRON_SWORD },
  { id: 'sleep', title: 'Sweet Dreams', desc: 'Sleep through the night in a bed', icon: B.BED },
  { id: 'depth', title: 'Into the Depths', desc: 'Descend below layer 14', icon: B.DEEPSLATE },
  { id: 'peak', title: 'On Top of the World', desc: 'Climb above layer 100', icon: B.SNOW },
  { id: 'explorer', title: 'Explorer', desc: 'Travel 400 blocks from your spawn', icon: B.GRASS },
  { id: 'boom', title: 'Boom!', desc: 'Survive an explosion', icon: B.TNT },
  { id: 'builder', title: 'Master Builder', desc: 'Place 200 blocks', icon: B.BRICKS },
  { id: 'survivor', title: 'Survivor', desc: 'Live through 3 days', icon: B.SANDSTONE },
];

export class Advancements {
  constructor(game) {
    this.game = game;
    this.done = new Set();
    this.stats = { mined: 0, placed: 0, kills: 0, deaths: 0, distance: 0, playTime: 0 };
  }

  grant(id) {
    if (this.done.has(id)) return;
    const a = ADVANCEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.done.add(id);
    this.game.ui.toastAdvancement(a);
    this.game.audio.play('achievement', { vol: 0.8 });
  }

  onObtain(id) {
    switch (id) {
      case B.LOG: case B.BIRCH_LOG: case B.SPRUCE_LOG: this.grant('wood'); break;
      case B.COBBLE: this.grant('stone'); break;
      case I.DIAMOND: this.grant('diamond'); break;
      case I.IRON_INGOT: this.grant('iron'); break;
      case B.CRAFTING_TABLE: this.grant('table'); break;
      case B.FURNACE: this.grant('furnace'); break;
      case I.WOOD_PICKAXE: this.grant('pick'); break;
      case I.STONE_PICKAXE: this.grant('upgrade'); break;
      case I.IRON_PICKAXE: this.grant('ironpick'); break;
      default: break;
    }
  }

  tick(dt) {
    const g = this.game, p = g.player;
    this.stats.playTime += dt;
    if (p.dead) return;
    if (p.y < 14) this.grant('depth');
    if (p.y > 100) this.grant('peak');
    if (p.spawn0 && Math.hypot(p.x - p.spawn0.x, p.z - p.spawn0.z) > 400) this.grant('explorer');
    if (g.day >= 3) this.grant('survivor');
  }

  serialize() { return { done: [...this.done], stats: this.stats }; }
  load(s) {
    if (!s) return;
    this.done = new Set(s.done || []);
    Object.assign(this.stats, s.stats || {});
  }
}
