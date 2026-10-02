import { useState } from "react";
import {
  BOSSES, BUILDINGS, BUILDING_MAX, DIFFICULTIES, DYN_MODS, MAX_RELIC_LVL, REALMS, RELICS, STAT_INFO, STAT_KEYS, WEAPONS, WEAPON_IDS, TRAITS, buildingCost, maxHpOf, relicScale,
  type StatKey, type WeaponId,
} from "../game/data";
import {
  ageGroup, bl, blessCost, cleanseCost, diffMult, effStats, heroMods, heroTitle, keepRate, maxChildren, rebirthCost, relicSlots, statCap, suitorCost, trainCost, type Dynasty, type Hero,
} from "../game/lineage";
import { Btn, Portrait, StatPips, TraitChip } from "./common";

export interface Actions {
  train(id: number, k: StatKey): void;
  marry(id: number): void;
  refreshSuitors(): void;
  upgrade(id: string): void;
  buyWeapon(id: WeaponId): void;
  equipWeapon(id: WeaponId): void;
  toggleRelic(uid: number): void;
  rite(kind: "reroll" | "cleanse" | "bless", heroId: number, idx: number): void;
  depart(realm: number): void;
  menu(): void;
  settings(): void;
  help(): void;
}

const TABS = [
  { id: "hall", label: "Hall", icon: "🏰" },
  { id: "family", label: "Family", icon: "👪" },
  { id: "estate", label: "Estate", icon: "🔨" },
  { id: "armory", label: "Armory", icon: "🗡️" },
  { id: "shrine", label: "Shrine", icon: "⛩️" },
  { id: "chronicle", label: "Chronicle", icon: "📜" },
  { id: "delve", label: "Delve", icon: "🚪" },
];

function HeroCard({ d, h, role, act, canTrain = true }: { d: Dynasty; h: Hero; role: string; act: Actions; canTrain?: boolean }) {
  const cap = statCap(d);
  const eff = effStats(h);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex gap-3 items-center">
        <Portrait hero={h} size={52} />
        <div className="min-w-0 flex-1">
          <div className="font-title text-lg text-amber-100 leading-tight truncate">{heroTitle(h)}</div>
          <div className="text-xs text-violet-300">{role} · {ageGroup(h.age)} (age {h.age}) · Gen {h.gen}{h.parents.length ? ` · child of ${h.parents.join(" & ")}` : ""}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 my-2 min-h-[24px]">
        {h.traits.length === 0 && <span className="text-xs text-violet-400">No traits</span>}
        {h.traits.map((t) => <TraitChip key={t} id={t} />)}
      </div>
      <div className="space-y-1">
        {STAT_KEYS.map((k) => {
          const cost = trainCost(d, h, k);
          const maxed = h.stats[k] >= cap;
          return (
            <div key={k} className="flex items-center justify-between gap-2">
              <StatPips k={k} value={h.stats[k]} cap={cap} eff={role === "Hero" ? eff[k] : undefined} />
              {canTrain && (
                <Btn variant="ghost" className="!px-2 !py-0.5 !text-xs" disabled={maxed || d.gold < cost} onClick={() => act.train(h.id, k)}>
                  {maxed ? "MAX" : `+1 · ${cost}g`}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel p-4 ${className}`}>
      {title && <h3 className="font-title text-xl text-amber-200 mb-2">{title}</h3>}
      {children}
    </div>
  );
}

function HallTab({ d, setTab }: { d: Dynasty; setTab: (t: string) => void }) {
  const m = heroMods(d, d.hero);
  const lim = diffMult(d).gens;
  const heirs = d.children.length;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Current Hero">
        <div className="flex gap-3 items-center mb-2">
          <Portrait hero={d.hero} size={72} />
          <div>
            <div className="font-title text-2xl text-amber-100">{heroTitle(d.hero)}</div>
            <div className="text-sm text-violet-300">House {d.house} · Generation {d.gen} · {ageGroup(d.hero.age)}, age {d.hero.age}</div>
            <div className="text-sm text-violet-300">Weapon: {WEAPONS[d.weapon].icon} {WEAPONS[d.weapon].name}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">{d.hero.traits.map((t) => <TraitChip key={t} id={t} />)}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>❤️ Health <b className="text-amber-100">{maxHpOf(m)}</b></div>
          <div>⚔️ Damage <b className="text-amber-100">{Math.round(16 * m.dmg)}</b></div>
          <div>🎯 Crit <b className="text-amber-100">{Math.round(m.crit * 100)}%</b></div>
          <div>💨 Speed <b className="text-amber-100">{Math.round(m.move * 100)}%</b></div>
          <div>⚡ Attack rate <b className="text-amber-100">{Math.round(m.atkSpd * 100)}%</b></div>
          <div>🪙 Gold <b className="text-amber-100">{Math.round(m.gold * 100)}%</b></div>
          <div>📢 Roar charge <b className="text-amber-100">{Math.round(m.special * 100)}%</b></div>
          <div>🧪 Potions <b className="text-amber-100">{m.potions} ({Math.round(m.potionHeal * 100)}%)</b></div>
        </div>
        <div className="mt-3 text-xs text-violet-300">Equipped heirlooms: {d.equipped.length === 0 ? "none" : d.equipped.map((u) => { const r = d.relics.find((x) => x.uid === u); return r ? `${RELICS[r.id].icon} ${RELICS[r.id].name} Lv${r.lvl}` : ""; }).join(", ")}</div>
      </Card>
      <div className="space-y-4">
        <Card title="The Dynasty's Goal">
          <p className="text-sm text-violet-200 mb-2">Slay <b className="text-purple-300">The Hollow King</b> within <b>{lim}</b> generations. You are on generation <b className="text-amber-200">{d.gen}</b>.</p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-amber-300 to-red-400" style={{ width: `${Math.min(100, (d.gen / lim) * 100)}%` }} /></div>
          <div className="flex gap-2">
            {REALMS.map((r, i) => (
              <div key={r.name} title={r.name} className={`flex-1 rounded-lg p-2 text-center text-xs border ${i < d.realmsCleared ? "border-emerald-300/60 bg-emerald-400/10" : i === d.realmsCleared ? "border-amber-300/70 bg-amber-300/10 anim-glow" : "border-white/10 bg-white/5 opacity-60"}`}>
                <div className="text-lg">{i < d.realmsCleared ? "✅" : i === d.realmsCleared ? "⚔️" : "🔒"}</div>
                <div className="truncate">{BOSSES[r.boss].name.split(" ").slice(-1)[0]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Counsel">
          <ul className="text-sm space-y-1 text-violet-100">
            {!d.spouse && heirs === 0 && <li className="text-red-300">⚠️ You are unwed with no heirs. If you fall, the line ends{bl(d, "nursery") >= 1 ? " (distant kin will answer)" : ""}. <button className="underline text-amber-200 cursor-pointer" onClick={() => setTab("family")}>Find a spouse</button></li>}
            {!d.spouse && heirs > 0 && <li className="text-amber-200">💍 No spouse: no new children will be born. <button className="underline cursor-pointer" onClick={() => setTab("family")}>Marry</button></li>}
            {d.spouse && heirs < maxChildren(d) && <li>👶 A child will be born after your next expedition.</li>}
            {d.gold >= 60 && <li>🔨 You have {d.gold} gold. Upgrade the <button className="underline text-amber-200 cursor-pointer" onClick={() => setTab("estate")}>Estate</button> or train an heir.</li>}
            {d.hero.age >= 50 && <li className="text-amber-200">🧓 Your hero is an Elder (age {d.hero.age}); retirement comes at 62.</li>}
            <li>📜 Gold kept on death: <b>{Math.round(keepRate(d) * 100)}%</b>. Return home from any door to keep all of it.</li>
          </ul>
        </Card>
        <Card title="Recent Chronicle">
          <div className="text-xs text-violet-300 space-y-1">{d.log.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>
        </Card>
      </div>
    </div>
  );
}

function FamilyTab({ d, act }: { d: Dynasty; act: Actions }) {
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <HeroCard d={d} h={d.hero} role="Hero" act={act} />
        {d.spouse ? <HeroCard d={d} h={d.spouse} role="Spouse" act={act} canTrain={false} /> : (
          <Card title="Seek a Spouse">
            <p className="text-xs text-violet-300 mb-2">Marriage lets children be born after each expedition. Their traits and stats blend both parents. Better suitors cost more.</p>
            <div className="space-y-2">
              {d.suitors.map((s) => (
                <div key={s.id} className="rounded-lg bg-white/5 border border-white/10 p-2">
                  <div className="flex items-center gap-2">
                    <Portrait hero={s} size={40} />
                    <div className="flex-1 min-w-0"><div className="font-bold text-sm text-amber-100">{s.name}, {s.age}</div><div className="flex flex-wrap gap-1">{s.traits.map((t) => <TraitChip key={t} id={t} />)}</div></div>
                    <Btn variant="primary" className="!py-1 !text-xs" disabled={d.gold < suitorCost(s) || d.hero.age < 16} onClick={() => act.marry(s.id)}>Wed · {suitorCost(s)}g</Btn>
                  </div>
                  <div className="text-xs text-violet-300 mt-1">{STAT_KEYS.map((k) => `${STAT_INFO[k].icon}${s.stats[k]}`).join("  ")}</div>
                </div>
              ))}
            </div>
            <Btn variant="ghost" className="mt-2 !py-1 !text-xs" disabled={d.gold < 20} onClick={act.refreshSuitors}>🔄 Find new suitors · 20g</Btn>
          </Card>
        )}
      </div>
      <Card title={`Children (${d.children.length}/${maxChildren(d)})`}>
        {d.children.length === 0 ? <p className="text-sm text-violet-300">No children yet. {d.spouse ? "One will be born after your next expedition." : "Marry first."}</p> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{d.children.map((c) => <HeroCard key={c.id} d={d} h={c} role="Heir" act={act} />)}</div>
        )}
      </Card>
    </div>
  );
}

function EstateTab({ d, act }: { d: Dynasty; act: Actions }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {BUILDINGS.map((b) => {
        const lv = bl(d, b.id);
        const maxed = lv >= BUILDING_MAX;
        const cost = buildingCost(lv);
        return (
          <Card key={b.id}>
            <div className="flex justify-between items-center"><h3 className="font-title text-xl text-amber-200">{b.icon} {b.name}</h3><span className="text-xs text-violet-300">Lv {lv}/{BUILDING_MAX}</span></div>
            <p className="text-xs text-violet-300 my-1">{b.desc}</p>
            <div className="flex gap-1 my-2">{Array.from({ length: BUILDING_MAX }).map((_, i) => <div key={i} className={`h-2 flex-1 rounded ${i < lv ? "bg-amber-300" : "bg-white/10"}`} />)}</div>
            <ul className="text-xs space-y-0.5 mb-3">
              {b.levels.map((t, i) => <li key={i} className={i < lv ? "text-emerald-300" : i === lv ? "text-amber-100" : "text-violet-500"}>{i < lv ? "✔" : "•"} Lv {i + 1}: {t}</li>)}
            </ul>
            <Btn variant="primary" className="w-full" disabled={maxed || d.gold < cost.gold || d.renown < cost.renown} onClick={() => act.upgrade(b.id)}>
              {maxed ? "Fully built" : `Upgrade · ${cost.gold}g${cost.renown ? ` + ${cost.renown} renown` : ""}`}
            </Btn>
          </Card>
        );
      })}
    </div>
  );
}

function ArmoryTab({ d, act }: { d: Dynasty; act: Actions }) {
  const slots = relicSlots(d);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Weapons">
        <div className="space-y-2">
          {WEAPON_IDS.map((id) => {
            const w = WEAPONS[id];
            const owned = d.weapons.includes(id);
            const eq = d.weapon === id;
            return (
              <div key={id} className={`rounded-lg border p-3 flex items-center gap-3 ${eq ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                <div className="text-3xl">{w.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-amber-100">{w.name}</div>
                  <div className="text-xs text-violet-300">{w.desc}</div>
                  <div className="text-xs text-violet-400">Damage ×{w.dmg} · Speed {(1 / w.cd).toFixed(1)}/s · {w.type === "ranged" ? "Ranged" : `Reach ${w.range}`}</div>
                </div>
                {owned ? <Btn variant={eq ? "good" : "secondary"} disabled={eq} onClick={() => act.equipWeapon(id)} className="!py-1">{eq ? "Equipped" : "Equip"}</Btn> : <Btn variant="primary" disabled={d.gold < w.cost} onClick={() => act.buyWeapon(id)} className="!py-1">Forge · {w.cost}g</Btn>}
              </div>
            );
          })}
        </div>
      </Card>
      <Card title={`Heirlooms (${d.equipped.length}/${slots} equipped)`}>
        <p className="text-xs text-violet-300 mb-2">Relics are found from elite guardians and bosses. Equipped heirlooms gain a level each time the hero falls and passes them on (max {MAX_RELIC_LVL}). Duplicates add 2 levels. More slots unlock at Vault levels 3 and 5.</p>
        {d.relics.length === 0 && <p className="text-sm text-violet-400">No relics yet. Defeat an Elite Guardian or a realm boss.</p>}
        <div className="space-y-2">
          {d.relics.map((r) => {
            const def = RELICS[r.id];
            const eq = d.equipped.includes(r.uid);
            return (
              <div key={r.uid} className={`rounded-lg border p-2 flex items-center gap-3 ${eq ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                <div className="text-2xl">{def.icon}</div>
                <div className="flex-1"><div className="font-bold text-amber-100 text-sm">{def.name} <span className="text-violet-300">Lv {r.lvl} (×{relicScale(r.lvl).toFixed(1)})</span></div><div className="text-xs text-violet-300">{def.desc}</div></div>
                <Btn variant={eq ? "good" : "secondary"} className="!py-1 !text-xs" disabled={!eq && d.equipped.length >= slots} onClick={() => act.toggleRelic(r.uid)}>{eq ? "Unequip" : "Equip"}</Btn>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ShrineTab({ d, act }: { d: Dynasty; act: Actions }) {
  const people: Hero[] = [d.hero, ...d.children];
  const [sel, setSel] = useState(d.hero.id);
  const h = people.find((p) => p.id === sel) || d.hero;
  const lv = bl(d, "shrine");
  const boons = Math.floor((lv + 1) / 2);
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Blood Rites" className="lg:col-span-2">
        {lv < 1 ? <p className="text-sm text-violet-300">Build the Ancestral Shrine in the Estate tab to perform rites on your bloodline.</p> : (
          <>
            <p className="text-xs text-violet-300 mb-2">Choose a family member. <b>Reroll</b> replaces a trait ({rebirthCost(d)}g), <b>Cleanse</b> removes one ({cleanseCost(d)}g), and <b>Bless</b> grants a new trait to an open slot ({blessCost(d)}g + 10 renown). Higher shrine levels improve the odds of good traits.</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {people.map((p) => <button key={p.id} onClick={() => setSel(p.id)} className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-sm cursor-pointer ${sel === p.id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"}`}><Portrait hero={p} size={28} />{p.name}</button>)}
            </div>
            <div className="space-y-2">
              {h.traits.map((t, i) => (
                <div key={t + i} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 p-2">
                  <TraitChip id={t} />
                  <span className="text-xs text-violet-300 flex-1 hidden sm:block">{TRAITS[t].desc}</span>
                  <Btn variant="secondary" className="!py-1 !text-xs" disabled={d.gold < rebirthCost(d)} onClick={() => act.rite("reroll", h.id, i)}>🎲 Reroll</Btn>
                  <Btn variant="danger" className="!py-1 !text-xs" disabled={d.gold < cleanseCost(d)} onClick={() => act.rite("cleanse", h.id, i)}>✂️ Cleanse</Btn>
                </div>
              ))}
              {h.traits.length < 3 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 p-2">
                  <span className="text-xs text-violet-300 flex-1">Open trait slot</span>
                  <Btn variant="good" className="!py-1 !text-xs" disabled={d.gold < blessCost(d) || d.renown < 10} onClick={() => act.rite("bless", h.id, -1)}>✨ Bless</Btn>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <Card title="Ancestral Favor">
        <p className="text-sm text-violet-200">Shrine level <b className="text-amber-200">{lv}</b>: every expedition begins with <b className="text-amber-200">{boons}</b> random boon{boons === 1 ? "" : "s"}.</p>
        <p className="text-xs text-violet-300 mt-2">Renown: <b className="text-amber-200">{d.renown}</b>. It comes from clearing rooms, slaying bosses and winning kills. Renown gates the higher Estate upgrades and blessings.</p>
      </Card>
    </div>
  );
}

function ChronicleTab({ d }: { d: Dynasty }) {
  const all = [...d.ancestors, d.hero];
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="The Bloodline" className="lg:col-span-2">
        <div className="space-y-2">
          {all.map((h, i) => {
            const cur = i === all.length - 1;
            return (
              <div key={h.id} className={`flex gap-3 items-center rounded-lg border p-2 ${cur ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                <div className="font-title text-2xl text-amber-200 w-8 text-center">{h.gen}</div>
                <Portrait hero={h} size={40} dead={!cur} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-amber-100 text-sm truncate">{heroTitle(h)}{cur ? " (living)" : ""}</div>
                  <div className="flex flex-wrap gap-1">{h.traits.map((t) => <TraitChip key={t} id={t} />)}</div>
                  <div className="text-xs text-violet-300">{cur ? "Leads the house today" : `Age ${h.age}, ${h.cause ?? "passed on"}`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Dynasty Record">
          <ul className="text-sm space-y-1">
            <li>Year <b>{d.year}</b></li><li>Expeditions <b>{d.stats.runs}</b></li><li>Foes slain <b>{d.stats.kills}</b></li><li>Bosses slain <b>{d.stats.bosses}</b></li><li>Rooms cleared <b>{d.stats.rooms}</b></li><li>Gold earned <b>{Math.floor(d.stats.goldEarned)}</b></li><li>Heirs fallen <b>{d.ancestors.length}</b></li>
            <li>Difficulty <b>{DIFFICULTIES[d.difficulty].name}</b></li>
            {d.mods.length > 0 && <li>Curses <b>{d.mods.map((m) => DYN_MODS.find((x) => x.id === m)?.name).join(", ")}</b></li>}
          </ul>
        </Card>
        <Card title="Annals"><div className="text-xs text-violet-300 space-y-1 max-h-60 scroll-y">{d.log.map((l, i) => <div key={i}>{l}</div>)}</div></Card>
      </div>
    </div>
  );
}

function DelveTab({ d, act }: { d: Dynasty; act: Actions }) {
  const maxRealm = Math.min(REALMS.length - 1, d.realmsCleared);
  const [realm, setRealm] = useState(maxRealm);
  const r = REALMS[Math.min(realm, maxRealm)];
  const rid = Math.min(realm, maxRealm);
  const boss = BOSSES[r.boss];
  const boons = Math.floor((bl(d, "shrine") + 1) / 2);
  const m = heroMods(d, d.hero);
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-2">
        {REALMS.map((rr, i) => {
          const locked = i > maxRealm;
          return (
            <button key={rr.name} disabled={locked} onClick={() => setRealm(i)} className={`w-full text-left rounded-xl border p-3 transition cursor-pointer disabled:cursor-not-allowed ${rid === i ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"} ${locked ? "opacity-40" : ""}`} style={{ borderLeft: `6px solid ${rr.accent}` }}>
              <div className="flex justify-between items-center">
                <b className="font-title text-xl text-amber-100">{locked ? "🔒" : i < d.realmsCleared ? "✅" : "⚔️"} {i + 1}. {rr.name}</b>
                <span className="text-xs text-violet-300">Boss: {BOSSES[rr.boss].name}</span>
              </div>
              <div className="text-xs text-violet-300 italic">{rr.intro}</div>
              <div className="text-xs mt-1" style={{ color: rr.accent }}>⚠ {rr.hazardText}</div>
            </button>
          );
        })}
      </div>
      <Card title="Expedition">
        <div className="text-sm space-y-1 mb-3">
          <div>Realm: <b style={{ color: r.accent }}>{r.name}</b></div>
          <div>Boss: <b className="text-red-300">{boss.name}</b> <span className="text-violet-300">— {boss.title}</span></div>
          <div>Hero: <b>{d.hero.name}</b> ({maxHpOf(m)} HP)</div>
          <div>Weapon: {WEAPONS[d.weapon].icon} {WEAPONS[d.weapon].name}</div>
          <div>Potions: 🧪 {m.potions} · Starting boons: 🌟 {boons}</div>
          <div>Foes: ×{diffMult(d).hp.toFixed(2)} HP, ×{diffMult(d).dmg.toFixed(2)} damage</div>
          <div className="text-xs text-violet-300">4 rooms and a boss. An expedition costs 4 years for everyone.</div>
        </div>
        {!d.spouse && d.children.length === 0 && <p className="text-xs text-red-300 mb-2">⚠️ No spouse and no heir. Falling here would end your line{bl(d, "nursery") >= 1 ? " (distant kin may answer)" : ""}.</p>}
        <Btn variant="primary" className="w-full !py-3 text-lg" onClick={() => act.depart(rid)}>🚪 Depart</Btn>
      </Card>
    </div>
  );
}

export function Homestead({ d, act }: { d: Dynasty; act: Actions }) {
  const [tab, setTab] = useState("hall");
  return (
    <div className="h-full w-full flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a4a 0%, #0d0916 65%)" }}>
      <header className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/30">
        <div className="font-title text-xl sm:text-2xl text-amber-200 mr-auto">🏰 House {d.house}</div>
        <div className="text-xs sm:text-sm flex flex-wrap gap-x-3 gap-y-1 text-violet-200">
          <span>📅 Year <b>{d.year}</b></span>
          <span>👑 Gen <b>{d.gen}</b>/{diffMult(d).gens}</span>
          <span className="text-amber-300">🪙 <b>{d.gold}</b></span>
          <span className="text-purple-300">🏅 <b>{d.renown}</b></span>
        </div>
        <Btn variant="ghost" className="!py-1 !px-2" onClick={act.help}>❓</Btn>
        <Btn variant="ghost" className="!py-1 !px-2" onClick={act.settings}>⚙️</Btn>
        <Btn variant="ghost" className="!py-1 !px-2" onClick={act.menu}>☰ Menu</Btn>
      </header>
      <nav className="shrink-0 flex gap-1 px-2 pt-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-t-lg text-sm font-bold whitespace-nowrap cursor-pointer transition ${tab === t.id ? "bg-amber-300 text-stone-900" : "bg-white/5 text-violet-200 hover:bg-white/10"} ${t.id === "delve" && tab !== "delve" ? "anim-glow" : ""}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 scroll-y p-3 sm:p-4">
        <div key={tab} className="anim-up max-w-6xl mx-auto">
          {tab === "hall" && <HallTab d={d} setTab={setTab} />}
          {tab === "family" && <FamilyTab d={d} act={act} />}
          {tab === "estate" && <EstateTab d={d} act={act} />}
          {tab === "armory" && <ArmoryTab d={d} act={act} />}
          {tab === "shrine" && <ShrineTab d={d} act={act} />}
          {tab === "chronicle" && <ChronicleTab d={d} />}
          {tab === "delve" && <DelveTab d={d} act={act} />}
        </div>
      </main>
    </div>
  );
}
