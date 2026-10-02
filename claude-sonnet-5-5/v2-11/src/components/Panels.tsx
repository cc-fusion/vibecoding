import { useState } from "react";
import { CARDS, DIFFS, FOES, RELICS, TYPE_META } from "../game/data";
import type { SaveData, Settings } from "../game/save";
import { audio } from "../game/audio";
import { cn } from "../utils/cn";
import CardView from "./CardView";

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 uppercase tracking-widest text-xs text-amber-200/80">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-9 text-right text-xs tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-3 text-sm flex-wrap">
      <span className="w-24 uppercase tracking-widest text-xs text-amber-200/80">{label}</span>
      <div className="flex gap-1 flex-1">
        {options.map(([v, l]) => (
          <button key={String(v)} onClick={() => { audio.sfx("ui"); onChange(v); }} className={cn("btn flex-1 !py-1 !px-2 !text-[11px]", value === v && "btn-primary")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onChange, diff, onDiff }: { settings: Settings; onChange: (s: Settings) => void; diff?: string; onDiff?: (d: string) => void }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  return (
    <div className="flex flex-col gap-3 w-full">
      <Slider label="Master" value={settings.master} onChange={(v) => set({ master: v })} />
      <Slider label="Effects" value={settings.sfx} onChange={(v) => set({ sfx: v })} />
      <Slider label="Music" value={settings.music} onChange={(v) => set({ music: v })} />
      <Seg label="Sound" value={settings.muted ? "off" : "on"} options={[["on", "On"], ["off", "Muted"]]} onChange={(v) => set({ muted: v === "off" })} />
      <Seg label="Screen shake" value={settings.shake} options={[[0, "Off"], [0.5, "Low"], [1, "Full"]]} onChange={(v) => set({ shake: v })} />
      <Seg label="Particles" value={settings.particles} options={[[0.4, "Low"], [0.7, "Medium"], [1, "High"]]} onChange={(v) => set({ particles: v })} />
      <Seg label="Hitbox ring" value={settings.hitbox ? "on" : "off"} options={[["off", "Focus only"], ["on", "Always"]]} onChange={(v) => set({ hitbox: v === "on" })} />
      <Seg label="Auto-pause" value={settings.autoPause ? "on" : "off"} options={[["on", "On"], ["off", "Off"]]} onChange={(v) => set({ autoPause: v === "on" })} />
      {diff && onDiff && (
        <div className="flex flex-col gap-1 text-sm border-t border-amber-200/20 pt-3">
          <span className="uppercase tracking-widest text-xs text-amber-200/80">Difficulty (live)</span>
          <div className="grid grid-cols-4 gap-1">
            {DIFFS.map((d) => (
              <button key={d.id} onClick={() => { audio.sfx("ui"); onDiff(d.id); }} className={cn("btn !px-1 !py-1 !text-[11px]", diff === d.id && "btn-primary")}>{d.name}</button>
            ))}
          </div>
          <span className="text-xs text-violet-200/70 font-sans">Reward multiplier uses the lowest difficulty you used this run.</span>
        </div>
      )}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["W A S D / Arrows", "Move the ship"],
  ["Mouse move", "Ship glides toward the cursor"],
  ["Touch drag", "Drag anywhere on the field to steer"],
  ["Shift / Right mouse", "Focus: slow, precise, shows hitbox, tightens patterns"],
  ["1 – 5 / click a card", "Play the card in that hand slot"],
  ["R", "Recite: pay 1 Faith to discard your hand and redraw"],
  ["Esc / P", "Pause"],
  ["Gamepad", "Stick move · A/B/X/Y/RB play cards · LB recite · LT focus · Start pause"],
];

export function Codex({ save, compact }: { save: SaveData; compact?: boolean }) {
  const [tab, setTab] = useState<"play" | "controls" | "cards" | "foes" | "relics">("play");
  const tabs: [typeof tab, string][] = [["play", "How to play"], ["controls", "Controls"], ["cards", "Cards"], ["foes", "Foes"], ["relics", "Relics"]];
  return (
    <div className="flex flex-col gap-3 w-full min-h-0">
      <div className="flex gap-1 flex-wrap">
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => { audio.sfx("ui"); setTab(t); }} className={cn("btn !py-1 !px-3 !text-[11px]", tab === t && "btn-primary")}>{l}</button>
        ))}
      </div>
      <div className={cn("overflow-y-auto pr-1 font-sans text-sm leading-relaxed text-[#ddd3f5]", compact ? "max-h-[48vh]" : "max-h-[62vh]")}>
        {tab === "play" && (
          <div className="flex flex-col gap-3">
            <p><b className="text-amber-200">Bullet Liturgy</b> is a bullet-hell deckbuilder. You pilot a tiny seraph through curtains of bullets while a <b>hand of cards</b> rewrites how you fight. Each run is three Acts: a <i>Hymn</i> (wave of foes) then a <i>Boss</i>, with rewards between stages.</p>
            <p><b className="text-cyan-200">Faith</b> is your mana. It regenerates slowly, and you earn more by <b>grazing</b> bullets (skimming close without touching) and by collecting blue motes. Cards cost Faith. Hand cards refill over time from your draw pile.</p>
            <p><b className="text-amber-200">Fervor</b> rises as you graze and kill. It multiplies score and adds up to +20% damage, but decays when idle and shatters when you are hit. Faith, Fervor and your deck are all linked: graze → Faith → cards → kills → Fervor → damage.</p>
            <p><b className="text-pink-200">Your hitbox is the tiny red dot.</b> Only it can be hit. Bosses are readable puzzles: each phase has named attacks with telegraphed beams and gaps aimed at you.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((k) => (
                <div key={k} className="border rounded p-2" style={{ borderColor: TYPE_META[k].color + "88" }}>
                  <b style={{ color: TYPE_META[k].color }}>{TYPE_META[k].label}s</b> — {TYPE_META[k].blurb}
                </div>
              ))}
            </div>
            <p><b className="text-amber-200">Synergies:</b> a Hymn sets your pattern; Glosses stack on top (pierce, homing, ricochet, burn, fission...). Playing a Hymn, a Gloss and a Ward (any three different types) within 4.5s triggers a <b>Trinity</b>: +2 Faith and +25% damage for 6s. <b>Focus</b> narrows fans and tightens halos. Relics found after bosses bend the rules further.</p>
            <p><b className="text-amber-200">Meta progression:</b> every run earns <b>Ash</b>. Spend it in the Reliquary on permanent upgrades, new Orders (starting decks) and locked cards. Higher difficulties and Vows multiply your Ash.</p>
          </div>
        )}
        {tab === "controls" && (
          <div className="flex flex-col gap-1">
            {KEYS.map(([k, d]) => (
              <div key={k} className="flex gap-3 items-baseline border-b border-white/5 py-1">
                <kbd className="px-2 py-0.5 rounded bg-black/50 border border-amber-200/40 text-amber-100 text-xs whitespace-nowrap font-mono">{k}</kbd>
                <span>{d}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "cards" && (
          <div className="flex flex-wrap gap-2 justify-center">
            {CARDS.map((c) => {
              const locked = !!c.unlock && !save.unlockedCards.includes(c.id);
              return <CardView key={c.id} inst={{ uid: 0, id: c.id, up: false }} size="big" locked={locked} />;
            })}
          </div>
        )}
        {tab === "foes" && (
          <div className="flex flex-col gap-2">
            {FOES.map((f) => (
              <div key={f.name} className="flex gap-3 items-start border border-white/10 rounded p-2 bg-black/20">
                <div className="text-2xl w-9 text-center">{f.icon}</div>
                <div><b className="text-amber-100">{f.name}</b><div>{f.text}</div></div>
              </div>
            ))}
          </div>
        )}
        {tab === "relics" && (
          <div className="grid sm:grid-cols-2 gap-2">
            {RELICS.map((r) => (
              <div key={r.id} className="flex gap-3 items-start border border-white/10 rounded p-2 bg-black/20">
                <div className="text-2xl w-9 text-center">{r.icon}</div>
                <div><b className={r.rare ? "text-yellow-200" : "text-amber-100"}>{r.name}</b><div>{r.text}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
