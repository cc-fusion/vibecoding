import { useEffect, useMemo, useRef, useState } from "react";
import {
  TECH, MODS, ModId, hullById, HULLS, getSortie, ENEMIES, ENV_INFO, DIFFS, DiffKey, MOD_INFO, ModsState, doctrineNotes, resistFromMemory, CAMPAIGN_LEN, EType,
} from "../game/data";
import { analyze, emptyLayout, Analysis } from "../game/ship";
import { SaveData } from "../game/save";
import { audio } from "../game/audio";
import { Btn, ModIcon, Panel, Toggle } from "./ui";
import { Hangar, View } from "./Hangar";

/** Top-level hub tabs. */
export type Tab = "hangar" | "research" | "sorties";

interface HubProps {
  save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void; tab: Tab; setTab: (t: Tab) => void;
  sel: number; setSel: (n: number) => void; onLaunch: (n: number) => void; onSettings: () => void; onHelp: () => void; onTitle: () => void;
  tut: number; setTut: (n: number) => void;
}

const TUT = [
  "Welcome, Shipwright! Pick the SOLAR ARRAY in the module palette and click a hull cell (ideally on the outer edge) to place it. Right-click erases. Credits are refunded in full.",
  "Open the POWER view. Green modules generate power, orange ones consume it. The analysis panel shows output vs. peak demand.",
  "Switch to the HEAT view. Radiators on the hull's edge work ×1.5 — buried ones only ×0.5. Heat is the enemy of sustained fire.",
  "Open the CREW view. Crew walk through connected, non-armor modules from quarters to stations. Red-marked modules have no crew and are OFFLINE.",
  "Open the RESEARCH tab. Data (◆) from sorties unlocks hulls, modules and upgrades.",
  "Finally, open the SORTIES tab. Review the intel briefing, choose a difficulty and LAUNCH. Watch your heat, power and crew in flight!",
];

export function Hub({ save, setSave, tab, setTab, sel, setSel, onLaunch, onSettings, onHelp, onTitle, tut, setTut }: HubProps) {
  const [view, setView] = useState<View>("normal");
  const hull = hullById(save.hull);
  const layout = save.layouts[save.hull] ?? emptyLayout(hull);
  const an = useMemo(() => analyze(layout, hull, save.tech, true), [layout, hull, save.tech]);
  const solarBase = useRef(0);
  const solar = an.count.solar || 0;
  const solarNow = useRef(solar);
  solarNow.current = solar;
  useEffect(() => { if (tut === 0) solarBase.current = solarNow.current; }, [tut]);
  const advance = () => {
    audio.sfx("research");
    if (tut >= TUT.length - 1) { setTut(-1); setSave((s) => ({ ...s, settings: { ...s.settings, tutHangar: true } })); }
    else setTut(tut + 1);
  };
  const advRef = useRef(advance);
  advRef.current = advance;
  useEffect(() => {
    if (tut < 0) return;
    const conds = [solar > solarBase.current, view === "power", view === "heat", view === "crew", tab === "research", tab === "sorties"];
    if (conds[tut]) { const id = window.setTimeout(() => advRef.current(), 600); return () => window.clearTimeout(id); }
  }, [tut, solar, view, tab]);

  const tabs: { id: Tab; label: string }[] = [{ id: "hangar", label: "Hangar" }, { id: "research", label: "Research" }, { id: "sorties", label: "Sorties" }];
  return (
    <div className="h-full flex flex-col bg-[#060a18]" style={{ background: "radial-gradient(ellipse at 50% 0%, #0f1b3d 0%, #060a18 60%)" }}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/70">
        <div className="font-display font-black tracking-[0.2em] text-sm sm:text-base text-cyan-200 mr-2">STARFORGE</div>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { audio.sfx("ui"); setTab(t.id); }}
              className={"font-display text-[10px] sm:text-xs tracking-widest uppercase px-3 py-2 border-b-2 transition-colors " + (tab === t.id ? "border-cyan-400 text-cyan-200 bg-cyan-500/10" : "border-transparent text-slate-400 hover:text-white")}>
              {t.label}
              {t.id === "research" && save.data > 0 && <span className="ml-1.5 text-amber-300">●</span>}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1 font-display text-sm text-amber-300" title="Credits"><span>¢</span><span className="tabular-nums">{save.credits.toLocaleString()}</span></div>
          <div className="flex items-center gap-1 font-display text-sm text-cyan-300" title="Research data"><span>◆</span><span className="tabular-nums">{save.data}</span></div>
          <Btn small variant="gold" disabled={an.errors.length > 0} title={an.errors[0] || "Launch the selected sortie"} onClick={() => onLaunch(sel)}>Launch {sel}</Btn>
          <Btn small variant="ghost" onClick={onHelp}>Help</Btn>
          <Btn small variant="ghost" onClick={onSettings}>Settings</Btn>
          <Btn small variant="ghost" onClick={onTitle}>Title</Btn>
        </div>
      </header>
      <main className="flex-1 min-h-0 relative">
        {tab === "hangar" && <Hangar save={save} setSave={setSave} an={an} view={view} setView={setView} />}
        {tab === "research" && <Research save={save} setSave={setSave} />}
        {tab === "sorties" && <Sorties save={save} setSave={setSave} an={an} sel={sel} setSel={setSel} onLaunch={onLaunch} />}
        {tut >= 0 && (
          <div className="absolute z-40 bottom-3 right-3 left-3 sm:left-auto sm:w-96 fade-up pulse-glow bg-slate-950/95 border border-cyan-400 rounded-sm p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-display text-[10px] tracking-[0.3em] text-cyan-300">TUTORIAL {tut + 1}/{TUT.length}</span>
              <button className="text-[11px] text-slate-400 hover:text-white underline" onClick={() => { setTut(-1); setSave((s) => ({ ...s, settings: { ...s.settings, tutHangar: true } })); }}>skip</button>
            </div>
            <p className="text-sm text-slate-100">{TUT[tut]}</p>
            <div className="flex justify-end mt-2"><Btn small onClick={advance}>{tut === TUT.length - 1 ? "Finish" : "Next"}</Btn></div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- Research ---------------- */
function Research({ save, setSave }: { save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void }) {
  const groups: { title: string; kinds: string[]; note: string }[] = [
    { title: "Hull Classes", kinds: ["hull"], note: "Bigger hulls hold more modules and mass." },
    { title: "Blueprints", kinds: ["module"], note: "New modules for your palette." },
    { title: "Upgrades", kinds: ["passive"], note: "Permanent improvements applied to every ship." },
  ];
  const buy = (id: string) => {
    const node = TECH.find((t) => t.id === id)!;
    const lvl = save.tech[id] || 0;
    if (lvl >= node.costs.length) return;
    const cost = node.costs[lvl];
    if (save.data < cost) { audio.sfx("error"); return; }
    audio.sfx("research");
    setSave((s) => ({ ...s, data: s.data - cost, tech: { ...s.tech, [id]: lvl + 1 } }));
  };
  return (
    <div className="h-full overflow-y-auto scroll-thin p-3 space-y-5">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className="font-display tracking-widest text-cyan-300">RESEARCH LAB</span>
        <span>You have <b className="text-cyan-300">{save.data} ◆</b> data. Earn more by clearing sorties (bosses give double).</span>
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <div className="flex items-baseline gap-3 mb-2"><h3 className="font-display text-xs tracking-[0.3em] text-amber-300 uppercase">{g.title}</h3><span className="text-xs text-slate-500">{g.note}</span></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TECH.filter((t) => g.kinds.includes(t.kind)).map((t) => {
              const lvl = save.tech[t.id] || 0;
              const max = t.costs.length;
              const done = lvl >= max;
              const missing = (t.req || []).filter((r) => !(save.tech[r] > 0));
              const cost = done ? 0 : t.costs[lvl];
              const can = !done && missing.length === 0 && save.data >= cost;
              const isMod = t.kind === "module";
              return (
                <Panel key={t.id} className={"p-3 flex gap-3 items-start " + (done ? "border-emerald-700/70" : can ? "border-cyan-500/70" : "")}>
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center border border-slate-700 rounded-sm bg-slate-950">
                    {isMod ? <ModIcon id={t.id as ModId} size={30} /> : t.kind === "hull" ? <span className="text-lg">🚀</span> : <span className="text-lg text-cyan-300">◆</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-xs tracking-wider text-slate-100">{t.name}</div>
                    <div className="text-[13px] text-slate-400 leading-tight">{t.desc}</div>
                    {isMod && <div className="text-[11px] text-slate-500 mt-0.5">{MODS[t.id as ModId].desc.slice(0, 90)}…</div>}
                    {t.kind === "hull" && <div className="text-[11px] text-slate-500 mt-0.5">{HULLS.find((h) => h.id === t.id)?.desc}</div>}
                    {max > 1 && <div className="flex gap-1 mt-1.5">{Array.from({ length: max }).map((_, i) => <span key={i} className={"w-5 h-1.5 rounded-sm " + (i < lvl ? "bg-cyan-400" : "bg-slate-700")} />)}</div>}
                    {missing.length > 0 && <div className="text-[11px] text-rose-300 mt-1">Requires: {missing.map((m) => TECH.find((x) => x.id === m)?.name).join(", ")}</div>}
                  </div>
                  <div className="shrink-0">
                    {done ? <span className="text-emerald-400 text-xs font-bold">✔ {max > 1 ? "MAX" : "OWNED"}</span> : <Btn small variant={can ? "primary" : "default"} disabled={!can} onClick={() => buy(t.id)}>{cost} ◆</Btn>}
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Sorties ---------------- */
function Sorties({ save, setSave, an, sel, setSel, onLaunch }: {
  save: SaveData; setSave: (f: (s: SaveData) => SaveData) => void; an: Analysis; sel: number; setSel: (n: number) => void; onLaunch: (n: number) => void;
}) {
  const maxN = save.cleared + 1;
  const list = Array.from({ length: maxN }, (_, i) => i + 1);
  const s = getSortie(sel);
  const profile = { shield: an.shieldCap, armor: an.armorCells, speed: an.accel, turrets: an.turrets };
  const adapt = resistFromMemory(save.adapt, sel);
  const adaptLines = (Object.keys(adapt) as (keyof typeof adapt)[]).filter((k) => adapt[k] > 0.02).map((k) => `${k} −${Math.round(adapt[k] * 100)}%`);
  const replay = sel <= save.cleared;
  const credMult = DIFFS[save.diff].cred + (Object.keys(save.mods) as (keyof ModsState)[]).reduce((a, k) => a + (save.mods[k] ? MOD_INFO[k].cred * 0.5 : 0), 0);
  const bonus = Math.round((120 + 50 * sel) * credMult * (replay ? 0.5 : 1));
  const dataReward = replay ? 0 : sel > 8 ? 2 + (s.boss ? 2 : 0) : 3 + (s.boss ? 3 : 0);
  const types: EType[] = [...s.pool];
  if (s.boss) types.push(s.boss);
  return (
    <div className="h-full grid gap-2 p-2 lg:grid-cols-[250px_minmax(0,1fr)] overflow-y-auto scroll-thin">
      <Panel title="Campaign" className="lg:overflow-y-auto scroll-thin">
        <div className="p-2 space-y-1.5">
          {list.map((n) => {
            const d = getSortie(n);
            const cleared = n <= save.cleared;
            return (
              <button key={n} onClick={() => { audio.sfx("ui"); setSel(n); }}
                className={"w-full text-left p-2 border rounded-sm transition-colors " + (sel === n ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700 hover:border-slate-500")}>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs text-slate-400 w-6">{String(n).padStart(2, "0")}</span>
                  <span className="text-sm font-bold flex-1 leading-tight">{d.name}</span>
                  {d.boss && <span className="text-fuchsia-300 text-xs">☠</span>}
                  {cleared && <span className="text-emerald-400 text-xs">✔</span>}
                </div>
                <div className="text-[11px] text-slate-500 pl-8">{ENV_INFO[d.env].name} · {d.waves} waves{save.best[n] ? ` · best ${save.best[n].toLocaleString()}` : ""}</div>
              </button>
            );
          })}
          <div className="text-[11px] text-slate-500 p-1">{save.cleared >= CAMPAIGN_LEN ? "Campaign won — Endless sorties scale forever." : `Clear sorties to unlock the next. ${CAMPAIGN_LEN - save.cleared} to go.`}</div>
        </div>
      </Panel>
      <div className="space-y-2 lg:overflow-y-auto scroll-thin">
        <Panel title={`Sortie ${sel} · Briefing`}>
          <div className="p-3 grid md:grid-cols-2 gap-3">
            <div>
              <div className="font-display text-lg tracking-wider text-cyan-100">{s.name}</div>
              <p className="text-sm text-slate-300 mt-1">{s.blurb}</p>
              <div className="mt-2 text-sm"><span className="text-sky-300 font-bold">{ENV_INFO[s.env].name}:</span> <span className="text-slate-400">{ENV_INFO[s.env].desc}</span></div>
              <div className="mt-1 text-sm text-slate-300">Waves: <b>{s.waves}</b>{s.boss && <span className="text-fuchsia-300"> · Boss: {ENEMIES[s.boss].name}</span>}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <span key={t} title={ENEMIES[t].desc} className="text-[11px] px-1.5 py-0.5 border rounded-sm" style={{ borderColor: ENEMIES[t].color, color: ENEMIES[t].color }}>{ENEMIES[t].name}</span>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="border border-slate-700 rounded-sm p-2">
                <div className="font-display text-[10px] tracking-widest text-fuchsia-300 uppercase">Fleet Intelligence</div>
                {doctrineNotes(profile).map((l) => <div key={l} className="text-slate-300 text-[13px]">• {l}</div>)}
                <div className="text-[13px] mt-1">{adaptLines.length ? <span className="text-rose-300">• Adapted resistance: {adaptLines.join(", ")}</span> : <span className="text-slate-400">• No damage resistance developed.</span>}</div>
              </div>
              <div className="border border-slate-700 rounded-sm p-2">
                <div className="font-display text-[10px] tracking-widest text-amber-300 uppercase">Reward</div>
                <div className="text-[13px] text-slate-300">Completion ≈ <b className="text-amber-200">{bonus}¢</b> + salvage {replay && <span className="text-slate-500">(replay: half pay)</span>}</div>
                <div className="text-[13px] text-slate-300">Data: <b className="text-cyan-300">{dataReward} ◆</b>{replay && <span className="text-slate-500"> (first clear only)</span>}</div>
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Difficulty & Modifiers">
          <div className="p-3 grid md:grid-cols-2 gap-3">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFS) as DiffKey[]).map((k) => (
                <button key={k} onClick={() => { audio.sfx("ui"); setSave((x) => ({ ...x, diff: k })); }}
                  className={"p-2 border rounded-sm text-left " + (save.diff === k ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700 hover:border-slate-500")}>
                  <div className="font-display text-xs tracking-widest uppercase">{DIFFS[k].name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-1">{DIFFS[k].desc}</div>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {(Object.keys(MOD_INFO) as (keyof ModsState)[]).map((k) => (
                <Toggle key={k} on={save.mods[k]} onChange={(v) => setSave((x) => ({ ...x, mods: { ...x.mods, [k]: v } }))} label={`${MOD_INFO[k].name} (+${Math.round(MOD_INFO[k].cred * 100)}%¢)`} desc={MOD_INFO[k].desc} />
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Pre-flight check">
          <div className="p-3">
            <div className="space-y-1 mb-3">
              {an.errors.map((e) => <div key={e} className="text-sm text-rose-300">⛔ {e}</div>)}
              {an.warnings.map((e) => <div key={e} className="text-sm text-amber-200">⚠ {e}</div>)}
              {!an.errors.length && !an.warnings.length && <div className="text-sm text-emerald-300">✔ Ship is flight-ready.</div>}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Btn variant="gold" disabled={an.errors.length > 0} onClick={() => onLaunch(sel)}>Launch sortie {sel}</Btn>
              {an.errors.length > 0 && <span className="text-xs text-rose-300">Fix the errors in the Hangar first.</span>}
              <span className="text-xs text-slate-500">Destroyed modules cost 30% of their price to rebuild after a win.</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
