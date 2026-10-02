import { useState } from 'react';
import { CLASSES, DIFFICULTIES, ENEMIES, GEAR, MAX_TIER, MISSIONS, MODIFIERS, PERKS, RANKS, WEATHER_INFO, XP_LEVELS, type MissionDef } from '../game/data';
import { baseStatsFor, deployCap, gearDef, maxHpFor, newRecruit, saveCampaign, type Campaign, type Meta, type RosterUnit } from '../game/campaign';
import { makeRng, shuffle } from '../game/hex';
import { audio } from '../game/audio';
import { Btn, Chip, Modal, Panel } from './ui';
import { cn } from '../utils/cn';

interface Props {
  campaign: Campaign;
  meta: Meta;
  setCampaign: (c: Campaign) => void;
  onDeploy: (m: MissionDef) => void;
  onTitle: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onCollege: () => void;
}

const OBJ_ICON: Record<string, string> = { rout: '⚔️', seize: '🚩', survive: '🛡️', boss: '👑' };
const OBJ_NAME: Record<string, string> = { rout: 'Rout', seize: 'Seize', survive: 'Survive', boss: 'Boss' };
const ROSTER_MAX = 12;

export default function Camp({ campaign: c, meta, setCampaign, onDeploy, onTitle, onHelp, onSettings, onCollege }: Props) {
  const [tab, setTab] = useState<'map' | 'company' | 'recruit' | 'armory' | 'memorial'>('map');
  const [selMission, setSelMission] = useState<number | null>(() => MISSIONS.find((m) => m.tier === c.tier)?.id ?? null);
  const [perkFor, setPerkFor] = useState<number | null>(null);
  const [dismiss, setDismiss] = useState<number | null>(null);
  const diff = DIFFICULTIES.find((d) => d.id === c.diff) || DIFFICULTIES[1];
  const cap = deployCap(meta);

  const upd = (fn: (n: Campaign) => void) => {
    const nc = JSON.parse(JSON.stringify(c)) as Campaign;
    fn(nc);
    setCampaign(nc);
    saveCampaign(nc);
  };

  const deployed = c.roster.filter((u) => u.deploy);
  const pending = c.roster.reduce((a, u) => a + u.pendingPerks, 0);

  const toggleDeploy = (id: number) => {
    const u = c.roster.find((x) => x.id === id);
    if (!u) return;
    if (!u.deploy && deployed.length >= cap) {
      audio.sfx('error');
      return;
    }
    upd((n) => {
      const x = n.roster.find((r) => r.id === id);
      if (x) x.deploy = !x.deploy;
    });
  };

  const autoSelect = () => {
    const sorted = [...c.roster].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, cap);
    const ids = new Set(sorted.map((u) => u.id));
    upd((n) => n.roster.forEach((u) => (u.deploy = ids.has(u.id))));
  };

  const mission = selMission !== null ? MISSIONS.find((m) => m.id === selMission) || null : null;
  const tiers = Array.from({ length: MAX_TIER + 1 }, (_, i) => MISSIONS.filter((m) => m.tier === i));

  const perkOptions = (u: RosterUnit) => {
    const rng = makeRng(u.id * 977 + u.level * 31 + u.perks.length * 7 + 5);
    const ranged = CLASSES[u.kind].rmax > 1;
    const pool = PERKS.filter((p) => !u.perks.includes(p.id) && (!p.ranged || ranged));
    return shuffle(pool, rng).slice(0, 3);
  };

  const choosePerk = (id: number, perk: string) => {
    audio.sfx('levelup');
    upd((n) => {
      const u = n.roster.find((x) => x.id === id);
      if (!u || u.pendingPerks <= 0) return;
      u.perks.push(perk);
      u.pendingPerks--;
    });
    setPerkFor(null);
  };

  const equip = (id: number, gear: string | null) => {
    upd((n) => {
      const u = n.roster.find((x) => x.id === id);
      if (!u) return;
      if (u.gear) n.gear.push(u.gear);
      u.gear = null;
      if (gear) {
        const i = n.gear.indexOf(gear);
        if (i >= 0) {
          n.gear.splice(i, 1);
          u.gear = gear;
        }
      }
    });
  };

  const recruit = (kind: string) => {
    const cost = CLASSES[kind].cost || 10;
    if (c.crowns < cost || c.roster.length >= ROSTER_MAX) {
      audio.sfx('error');
      return;
    }
    audio.sfx('coin');
    upd((n) => {
      n.crowns -= cost;
      const ru = newRecruit(n, kind, meta);
      ru.deploy = n.roster.filter((x) => x.deploy).length < cap;
      n.roster.push(ru);
    });
  };

  const buy = (id: string) => {
    const g = GEAR.find((x) => x.id === id);
    if (!g || c.crowns < g.cost) {
      audio.sfx('error');
      return;
    }
    audio.sfx('coin');
    upd((n) => {
      n.crowns -= g.cost;
      n.gear.push(id);
    });
  };

  const tabBtn = (id: typeof tab, label: string, badge?: number) => (
    <Btn key={id} small variant={tab === id ? 'gold' : 'default'} onClick={() => setTab(id)} className="relative">
      {label}
      {badge ? <span className="ml-1 rounded-full bg-[#ff5a5a] px-1.5 text-[10px] text-white">{badge}</span> : null}
    </Btn>
  );

  const gearCounts: Record<string, number> = {};
  c.gear.forEach((g) => (gearCounts[g] = (gearCounts[g] || 0) + 1));

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0f0b1c] to-[#1c1230]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2f2750] bg-[#120e20] px-3 py-2">
        <div className="font-display text-lg font-black text-[#f5d78a] sm:text-xl">⚔ War Room</div>
        <Chip color="#3a2f66">{diff.name}</Chip>
        {c.mods.map((m) => (
          <Chip key={m} color="#6a2f50">
            {MODIFIERS.find((x) => x.id === m)?.name}
          </Chip>
        ))}
        <Chip color="#6a5a1a">👑 {c.crowns} Crowns</Chip>
        <Chip color="#1f5a40">🌿 {meta.laurels} Laurels</Chip>
        <Chip color="#2a2342">
          Mission {Math.min(c.tier + 1, MAX_TIER + 1)}/{MAX_TIER + 1}
        </Chip>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Btn small onClick={onCollege}>
            🎓 War College
          </Btn>
          <Btn small onClick={onHelp}>
            📖 Help
          </Btn>
          <Btn small onClick={onSettings}>
            ⚙
          </Btn>
          <Btn small variant="danger" onClick={onTitle}>
            Save & Title
          </Btn>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-[#2f2750] px-3 py-2">
        {tabBtn('map', '🗺 Campaign Map')}
        {tabBtn('company', '🛡 Company', pending)}
        {tabBtn('recruit', '📜 Recruit')}
        {tabBtn('armory', '🧰 Armory')}
        {tabBtn('memorial', `🕯 Memorial (${c.fallen.length})`)}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
        {tab === 'map' && (
          <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[1.3fr_1fr]">
            <Panel className="p-3">
              <h3 className="font-display mb-2 text-lg font-extrabold text-[#f5d78a]">The Road to the Citadel</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scroll-thin">
                {tiers.map((ms, ti) => (
                  <div key={ti} className="flex min-w-[130px] flex-1 flex-col justify-center gap-2">
                    <div className="text-center text-[10px] font-bold uppercase tracking-widest text-[#7a6fa0]">Stage {ti + 1}</div>
                    {ms.map((m) => {
                      const done = c.done.includes(m.id);
                      const avail = ti === c.tier;
                      const skipped = ti < c.tier && !done;
                      return (
                        <button
                          key={m.id}
                          disabled={!avail}
                          onClick={() => {
                            audio.sfx('select');
                            setSelMission(m.id);
                          }}
                          className={cn(
                            'rounded-xl border-2 p-2 text-left transition',
                            done && 'border-[#3fa078] bg-[#143a2c] opacity-80',
                            skipped && 'border-[#2a2342] bg-[#15111f] opacity-40',
                            avail && 'border-[#f5d78a] bg-[#2a2142] hover:bg-[#382c5a] anim-glow',
                            !avail && !done && !skipped && 'border-[#2f2750] bg-[#15111f] opacity-60',
                            selMission === m.id && avail && 'ring-2 ring-white',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">{m.boss ? ENEMIES[m.boss].icon : OBJ_ICON[m.objective]}</span>
                            {done && <span className="text-[#7dff9a]">✔</span>}
                          </div>
                          <div className="text-xs font-extrabold leading-tight text-white">{m.name}</div>
                          <div className="mt-0.5 flex gap-0.5 text-[10px]">
                            {m.haz.collapse > 0 && <span>💥</span>}
                            {m.haz.flood > 0 && <span>🌊</span>}
                            {m.haz.fire > 0 && <span>🔥</span>}
                            <span className="ml-auto text-[#ffd75a]">👑{m.crowns}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-[#9a90b8]">Each stage you choose one of the available battles. The other route is lost to you. Choose by hazards and rewards.</p>
            </Panel>

            <Panel className="p-3">
              {mission ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{mission.boss ? ENEMIES[mission.boss].icon : OBJ_ICON[mission.objective]}</span>
                    <div>
                      <h3 className="font-display text-xl font-extrabold text-[#f5d78a]">{mission.name}</h3>
                      <div className="text-xs text-[#9a90b8]">
                        {OBJ_NAME[mission.objective]}
                        {mission.turns ? ` · ${mission.turns} rounds` : ''} · {mission.biome} terrain · {mission.w}×{mission.h}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#d9d1ee]">{mission.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    <Chip color="#6b5a3e">💥 Collapse {mission.haz.collapse || '–'}</Chip>
                    <Chip color="#1f5a80">🌊 Flood {mission.haz.flood || '–'}</Chip>
                    <Chip color="#8a4416">🔥 Fire {mission.haz.fire || '–'}</Chip>
                  </div>
                  <div className="text-xs text-[#cfc6ea]">Weather: {Array.from(new Set(mission.weather)).map((w) => `${WEATHER_INFO[w].icon} ${WEATHER_INFO[w].name}`).join(', ')}</div>
                  <div className="text-xs text-[#cfc6ea]">
                    Foes: {mission.boss && <b>{ENEMIES[mission.boss].icon} {ENEMIES[mission.boss].name} </b>}
                    {mission.kinds.map((k) => (
                      <span key={k} title={ENEMIES[k].name} className="mr-1">
                        {ENEMIES[k].icon}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs font-bold text-[#ffd75a]">
                    Reward: 👑 ~{Math.round(mission.crowns * diff.crowns)} + kills · 🌿 {Math.max(1, Math.ceil(mission.laurels * (diff.laurel + c.mods.reduce((a, m) => a + (MODIFIERS.find((x) => x.id === m)?.bonus || 0), 0))))}
                  </div>
                  <div className="rounded-lg border border-[#3d3460] bg-[#120e20] p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold">
                        Squad {deployed.length}/{cap}
                      </span>
                      <Btn small onClick={autoSelect}>
                        Auto-pick
                      </Btn>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {c.roster.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => toggleDeploy(u.id)}
                          className={cn('flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs', u.deploy ? 'border-[#3fa078] bg-[#173a2e]' : 'border-[#3d3460] bg-[#1b1630] opacity-70')}
                        >
                          <span className="text-base">{CLASSES[u.kind].icon}</span>
                          <span className="min-w-0 flex-1 truncate">{u.name}</span>
                          <span className="text-[#ffe14d]">L{u.level}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {pending > 0 && <p className="text-xs text-[#ffe14d]">⭐ {pending} perk choice(s) waiting in the Company tab!</p>}
                  <Btn variant="gold" className="w-full" disabled={deployed.length === 0 || deployed.length > cap} onClick={() => onDeploy(mission)}>
                    ⚔ Deploy to {mission.name}
                  </Btn>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-[#9a90b8]">Select a glowing battle on the map to review the briefing and choose your squad.</div>
              )}
            </Panel>
          </div>
        )}

        {tab === 'company' && (
          <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2 xl:grid-cols-3">
            {c.roster.map((u) => {
              const d = CLASSES[u.kind];
              const st = baseStatsFor(u);
              const nextXp = XP_LEVELS[u.level] ?? null;
              const prevXp = XP_LEVELS[u.level - 1];
              const pctx = nextXp ? ((u.xp - prevXp) / (nextXp - prevXp)) * 100 : 100;
              const g = gearDef(u.gear);
              return (
                <Panel key={u.id} className={cn('p-3', u.deploy && 'border-[#3fa078]')}>
                  <div className="flex items-start gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#8fe3ff] bg-[#1f4a66] text-2xl">{d.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-extrabold">{u.name}</div>
                      <div className="text-xs text-[#8fe3ff]">
                        {d.name} · <span className="text-[#ffe14d]">{RANKS[u.level - 1]}</span> · {u.kills} kills · {u.missions} battles
                      </div>
                    </div>
                    <Btn small variant={u.deploy ? 'green' : 'default'} onClick={() => toggleDeploy(u.id)}>
                      {u.deploy ? '✔ Squad' : 'Bench'}
                    </Btn>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-black/60" title={`XP ${u.xp}${nextXp ? '/' + nextXp : ' (max)'}`}>
                    <div className="h-full bg-gradient-to-r from-[#d89a3a] to-[#ffe14d]" style={{ width: `${Math.min(100, pctx)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-[#cfc6ea]">
                    ❤ {maxHpFor(u)} · ⚔ {st.atk} · 👣 {st.move} · 🛡 {st.armor} · 🎯 {st.rmin === st.rmax ? st.rmin : `${st.rmin}-${st.rmax}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.perks.length === 0 && <span className="text-[11px] text-[#7a6fa0]">No perks yet</span>}
                    {u.perks.map((p) => (
                      <Chip key={p} color="#4a3a7a">
                        {PERKS.find((x) => x.id === p)?.name}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-md border border-[#3d3460] bg-[#1b1630] px-2 py-1 text-xs"
                      value={u.gear || ''}
                      onChange={(e) => equip(u.id, e.target.value || null)}
                    >
                      <option value="">{g ? 'Unequip ' + g.name : 'No gear'}</option>
                      {u.gear && g && <option value={u.gear}>{g.icon} {g.name} (equipped)</option>}
                      {Object.keys(gearCounts).map((id) => {
                        const gd = gearDef(id)!;
                        return (
                          <option key={id} value={id}>
                            {gd.icon} {gd.name} ×{gearCounts[id]} — {gd.desc}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {u.pendingPerks > 0 && (
                      <Btn small variant="gold" className="anim-glow" onClick={() => setPerkFor(u.id)}>
                        ⭐ Choose perk ({u.pendingPerks})
                      </Btn>
                    )}
                    <Btn
                      small
                      variant="danger"
                      className="ml-auto"
                      disabled={c.roster.length <= 1}
                      onClick={() => {
                        if (dismiss === u.id) {
                          upd((n) => {
                            const x = n.roster.find((r) => r.id === u.id);
                            if (x?.gear) n.gear.push(x.gear);
                            n.roster = n.roster.filter((r) => r.id !== u.id);
                          });
                          setDismiss(null);
                        } else setDismiss(u.id);
                      }}
                    >
                      {dismiss === u.id ? 'Confirm dismiss' : 'Dismiss'}
                    </Btn>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}

        {tab === 'recruit' && (
          <div className="mx-auto max-w-5xl">
            <p className="mb-2 text-sm text-[#cfc6ea]">
              Company size {c.roster.length}/{ROSTER_MAX}. {meta.tech['academy'] >= 2 ? 'War Academy: recruits arrive as Veterans.' : ''}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.values(CLASSES).map((d) => (
                <Panel key={d.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{d.icon}</span>
                    <div>
                      <div className="font-display text-lg font-extrabold text-[#8fe3ff]">{d.name}</div>
                      <div className="text-[11px] text-[#9a90b8]">
                        HP {d.hp} · ATK {d.atk} · MOVE {d.move} · ARM {d.armor} · RNG {d.rmin}-{d.rmax}
                      </div>
                    </div>
                  </div>
                  <p className="my-2 text-xs text-[#cfc6ea]">{d.desc}</p>
                  {d.ability && <p className="mb-2 text-[11px] text-[#c8b6ff]">✨ {d.ability.name}: {d.ability.desc}</p>}
                  <Btn variant="gold" className="w-full" disabled={c.crowns < (d.cost || 10) || c.roster.length >= ROSTER_MAX} onClick={() => recruit(d.id)}>
                    Recruit — 👑 {d.cost}
                  </Btn>
                </Panel>
              ))}
            </div>
          </div>
        )}

        {tab === 'armory' && (
          <div className="mx-auto max-w-5xl">
            <p className="mb-2 text-sm text-[#cfc6ea]">Each unit carries one piece of gear. Buy here, then equip in the Company tab. Gear in stock: {c.gear.length ? c.gear.map((g) => gearDef(g)?.icon).join(' ') : 'none'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GEAR.map((g) => (
                <Panel key={g.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{g.icon}</span>
                    <div className="font-display text-lg font-extrabold text-[#f5d78a]">{g.name}</div>
                  </div>
                  <p className="my-2 text-xs text-[#cfc6ea]">{g.desc}</p>
                  <div className="flex items-center gap-2">
                    <Btn variant="gold" disabled={c.crowns < g.cost} onClick={() => buy(g.id)} className="flex-1">
                      Buy — 👑 {g.cost}
                    </Btn>
                    <span className="text-xs text-[#9a90b8]">stock {gearCounts[g.id] || 0}</span>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}

        {tab === 'memorial' && (
          <div className="mx-auto max-w-3xl">
            <h3 className="font-display mb-2 text-xl font-extrabold text-[#ff9aa6]">🕯 The Memorial Wall</h3>
            {c.fallen.length === 0 && <p className="text-sm text-[#9a90b8]">None have fallen. Yet.</p>}
            <div className="space-y-2">
              {c.fallen.map((f, i) => (
                <Panel key={i} className="flex items-center gap-3 p-3">
                  <span className="text-3xl grayscale">{CLASSES[f.kind]?.icon}</span>
                  <div>
                    <div className="font-bold">
                      {f.name}, {RANKS[f.level - 1]} {CLASSES[f.kind]?.name}
                    </div>
                    <div className="text-xs text-[#9a90b8]">
                      Fell at {f.mission} — {f.cause} · {f.kills} enemies slain
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}
      </div>

      {perkFor !== null &&
        (() => {
          const u = c.roster.find((x) => x.id === perkFor);
          if (!u) return null;
          return (
            <Modal title={`${u.name} — Choose a Perk`} onClose={() => setPerkFor(null)}>
              <p className="mb-3 text-sm text-[#cfc6ea]">
                {RANKS[u.level - 1]} {CLASSES[u.kind].name}. Choose one permanent perk.
              </p>
              <div className="grid gap-2">
                {perkOptions(u).map((p) => (
                  <button key={p.id} onClick={() => choosePerk(u.id, p.id)} className="rounded-xl border-2 border-[#5a4d86] bg-[#1f1936] p-3 text-left transition hover:border-[#f5d78a] hover:bg-[#2a2145]">
                    <div className="font-display text-lg font-extrabold text-[#f5d78a]">{p.name}</div>
                    <div className="text-sm text-[#d9d1ee]">{p.desc}</div>
                  </button>
                ))}
              </div>
              <Btn className="mt-3" onClick={() => setPerkFor(null)}>
                Later
              </Btn>
            </Modal>
          );
        })()}
    </div>
  );
}
