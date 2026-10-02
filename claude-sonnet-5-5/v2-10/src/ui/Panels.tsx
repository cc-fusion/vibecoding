import type { Game, AbilityId } from '../game/engine';
import { ABIL } from '../game/engine';
import { DEFS, DEF_ORDER, KAIJU, DISTRICTS, MAX_DAY, INCIDENT_NAMES, RESEARCH, fmtK } from '../game/data';
import { audio } from '../game/audio';
import { Btn, Section, Bar, Kbd, Chip, cx } from './common';

// ----------------------------------------------------------------- top bar
export function TopBar({
  g, onHelp, onSettings, onPause, onResearch,
}: { g: Game; onHelp: () => void; onSettings: () => void; onPause: () => void; onResearch: () => void }) {
  const incName = g.day <= MAX_DAY ? INCIDENT_NAMES[g.day - 1] : 'Endless Calamity';
  const popPct = Math.round((g.livePop() / Math.max(1, g.initialPop)) * 100);
  const trustColor = g.trust > 60 ? 'bg-emerald-500' : g.trust > 30 ? 'bg-amber-500' : 'bg-rose-500';
  const canResearch = g.phase !== 'attack';
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-500/20 bg-slate-950/95 px-3 py-1.5">
      <div className="min-w-0">
        <div className="font-serif text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
          Incident {g.day}{g.day <= MAX_DAY ? ` / ${MAX_DAY}` : ' · Endless'} · {g.phase}
        </div>
        <div className="truncate font-serif text-sm font-bold text-slate-100">{incName}</div>
      </div>
      <div title="Operating capital (K = thousands)" className="text-sm">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Capital</div>
        <div className={cx('font-mono font-bold', g.cash < 0 ? 'text-rose-400' : 'text-emerald-300')}>{fmtK(g.cash)}</div>
      </div>
      <div className="w-28" title="Public trust. 0 = license revoked. Drives premium share and evacuation compliance.">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400"><span>Trust</span><span className="font-mono text-slate-200">{Math.round(g.trust)}</span></div>
        <Bar value={g.trust} max={100} color={trustColor} h="h-2.5" />
      </div>
      <div title="Living population vs. start" className="hidden text-sm sm:block">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Population</div>
        <div className="font-mono font-bold text-sky-300">{g.livePop().toLocaleString()} <span className="text-[10px] text-slate-400">({popPct}%)</span></div>
      </div>
      <div title="Research points" className="text-sm">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Research</div>
        <div className="font-mono font-bold text-violet-300">{g.rp} RP</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Btn small variant="ghost" disabled={!canResearch} onClick={onResearch} title="Research Department (R)">🔬 <span className="hidden md:inline">Research</span></Btn>
        <Btn small variant="ghost" onClick={onHelp} title="Help (H)">❓</Btn>
        <Btn small variant="ghost" onClick={() => g.setSetting({ muted: !g.settings.muted })} title="Mute (M)">{g.settings.muted ? '🔇' : '🔊'}</Btn>
        <Btn small variant="ghost" onClick={onSettings} title="Settings">⚙️</Btn>
        <Btn small onClick={onPause} title="Pause (Esc / P)">⏸</Btn>
      </div>
    </header>
  );
}

// ----------------------------------------------------------------- briefing
const TIPS = [
  'Evacuating a district nobody attacks costs money, trust and breeds "cry wolf" fatigue.',
  'Dragging a kaiju into a Decoy Beacon stuns it for 2.6 seconds — perfect for artillery.',
  'Fire Stations also make ignition much less likely nearby. Build near factories.',
  'Denying a valid, covered claim costs 3 trust and may trigger a lawsuit.',
  'Flak shreds fliers. Artillery mostly misses them.',
  'Damaged-but-unpaid buildings become blight and bleed trust every day.',
  'Every kill pays a bounty and grants a research point.',
  'Settle inflated claims at the assessed value — it is the sweet spot.',
];

export function BriefingPanel({ g, onResearch }: { g: Game; onResearch: () => void }) {
  const acc = g.accuracy();
  const comp = g.compliance();
  const sel = g.selDef;
  const steps = [
    { t: 'Deploy a Seismic Probe (F) to sharpen the forecast.', done: g.probes > 0 },
    { t: 'Pick Artillery (1) and click a road or park tile near the red zone.', done: g.defs.some((d) => d.type === 'artillery') },
    { t: 'Place a Decoy Beacon (2) to steer the monster toward empty ground.', done: g.defs.some((d) => d.type === 'beacon') },
    { t: 'Order an evacuation of a district inside the red cloud.', done: g.evacOrders.some(Boolean) },
    { t: 'Press LAUNCH (Space) and watch your plan unfold.', done: false },
  ];
  const nextStep = steps.findIndex((s) => !s.done);
  const premium = Math.round(g.premiumIncome());
  const maint = Math.round(g.maintenance());
  return (
    <div className="space-y-2.5 p-2.5">
      {g.settings.tips && g.day === 1 && (
        <Section title="Field Training">
          <ol className="space-y-1 text-xs">
            {steps.map((s, i) => (
              <li key={i} className={cx('flex gap-2 rounded px-1.5 py-1', s.done ? 'text-emerald-300/80 line-through' : i === nextStep ? 'bg-amber-500/15 text-amber-100' : 'text-slate-400')}>
                <span>{s.done ? '✔' : i === nextStep ? '▶' : '○'}</span><span>{s.t}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {g.settings.tips && g.day > 1 && <div className="rounded-lg border border-sky-700/40 bg-sky-950/40 p-2 text-xs text-sky-200">💡 {TIPS[(g.day - 2) % TIPS.length]}</div>}

      <Section title="Threat Report" right={<Chip tone={g.condTitle === 'Quiet Skies' ? 'slate' : 'amber'}>{g.condTitle}</Chip>}>
        <div className="space-y-2">
          {g.plan.map((p, i) => {
            const kd = KAIJU[p.kind];
            return (
              <div key={i} className="flex gap-2 rounded-md bg-slate-950/60 p-2">
                <div className="text-3xl leading-none">{kd.icon}</div>
                <div className="min-w-0 text-xs">
                  <div className="font-serif font-bold text-slate-100">{kd.name} <span className="font-normal text-slate-400">— {kd.title}</span></div>
                  <div className="text-slate-400">HP {Math.round(kd.hp * p.hpMul)} · speed {kd.speed.toFixed(2)} · {kd.flying ? 'flying' : p.kind === 'burrow' ? 'burrower' : 'ground'}{p.delay > 3 ? ` · arrives +${Math.round(p.delay)}s` : ''}</div>
                  <div className="mt-0.5 text-slate-300">{kd.desc}</div>
                  <div className="mt-0.5 text-emerald-300/90">Weak to: {kd.weak}</div>
                </div>
              </div>
            );
          })}
          {g.condTitle !== 'Quiet Skies' && <div className="text-xs text-amber-300/90">⚠ {g.condTitle}: {g.condText}</div>}
        </div>
      </Section>

      <Section title="Forecast" right={<span className="font-mono text-xs text-slate-300">{Math.round(acc * 100)}% accurate</span>}>
        <Bar value={acc} max={1} color="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400" h="h-2.5" />
        <p className="mt-1.5 text-[11px] text-slate-400">The red cloud is the probability the kaiju crosses a tile. Dashed lines are sampled forecasts. Better data = tighter cloud.</p>
        <Btn small className="mt-2 w-full" disabled={g.probes >= 3 || g.cash < 40} onClick={() => g.deployProbe()}>
          📡 Deploy Seismic Probe — $40K <span className="text-slate-400">({g.probes}/3)</span> <Kbd>F</Kbd>
        </Btn>
      </Section>

      <Section title="Defenses" right={<span className="text-[10px] text-slate-400">click map tile to place</span>}>
        <div className="grid grid-cols-2 gap-1.5">
          {DEF_ORDER.map((t) => {
            const info = DEFS[t];
            const unlocked = g.defUnlocked(t);
            const cost = g.defCost(t);
            const need = info.req ? RESEARCH.find((r) => r.id === info.req)?.name : '';
            return (
              <button
                key={t}
                type="button"
                onClick={() => g.selectDef(t)}
                className={cx(
                  'rounded-md border px-2 py-1.5 text-left text-xs transition',
                  sel === t ? 'border-amber-300 bg-amber-500/20' : 'border-slate-700 bg-slate-950/60 hover:bg-slate-800',
                  !unlocked && 'opacity-45',
                )}
              >
                <div className="flex items-center justify-between"><span className="text-base">{info.icon}</span><Kbd>{info.key}</Kbd></div>
                <div className="font-semibold leading-tight">{info.name}</div>
                <div className={cx('font-mono', g.cash >= cost ? 'text-emerald-300' : 'text-rose-400')}>{unlocked ? fmtK(cost) : '🔒 ' + need}</div>
              </button>
            );
          })}
        </div>
        {sel && <p className="mt-2 rounded bg-slate-950/70 p-2 text-[11px] text-slate-300">{DEFS[sel].desc} <span className="text-slate-500">Range {DEFS[sel].range} tiles · upkeep 4%/day.</span></p>}
        <div className="mt-2 flex gap-1.5">
          <Btn small variant={g.sellMode ? 'danger' : 'ghost'} className="flex-1" onClick={() => { g.sellMode = !g.sellMode; g.selDef = null; g.inspect = null; audio.sfx('click'); g.notify(); }}>
            💸 Sell tool <Kbd>X</Kbd>
          </Btn>
          {sel || g.sellMode ? <Btn small variant="ghost" onClick={() => g.cancelTool()}>Cancel <Kbd>Esc</Kbd></Btn> : null}
        </div>
        {g.inspect && (
          <div className="mt-2 flex items-center justify-between rounded bg-slate-950/70 p-2 text-xs">
            <span>{DEFS[g.inspect.type].icon} {DEFS[g.inspect.type].name}</span>
            <Btn small variant="danger" onClick={() => g.sellDef(g.inspect!)}>Sell +{fmtK(Math.round(g.defCost(g.inspect.type) * 0.5))}</Btn>
          </div>
        )}
        <div className="mt-1.5 text-[10px] text-slate-500">{g.defs.length} defenses deployed · upkeep {fmtK(maint)}/day</div>
      </Section>

      <Section title="Evacuation Orders" right={<span className="text-[11px] text-slate-300">compliance {Math.round(comp * 100)}%</span>}>
        <div className="space-y-1">
          {DISTRICTS.map((d, i) => {
            const on = g.evacOrders[i];
            const hot = (() => { let m = 0; for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) if ((i < 3 ? y < 5 : y >= 5) && Math.floor(x / 6) === i % 3) m = Math.max(m, g.heat[y * 18 + x]); return m; })();
            return (
              <button
                key={i}
                type="button"
                onClick={() => g.toggleEvac(i)}
                className={cx('flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs', on ? 'border-sky-400 bg-sky-500/20' : 'border-slate-700 bg-slate-950/60 hover:bg-slate-800')}
              >
                <span>{on ? '🚶' : '🏠'}</span>
                <span className="flex-1 truncate font-semibold">{d.name}</span>
                <span className="text-slate-400">{g.districtPop(i)} pop</span>
                <span className="font-mono text-amber-300">{fmtK(g.evacCost(i))}</span>
                <span className={cx('h-2 w-2 rounded-full', hot > 0.5 ? 'bg-rose-500' : hot > 0.15 ? 'bg-amber-400' : 'bg-slate-600')} title="forecast threat" />
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          Dot = forecast threat. {g.fatigue > 0.01 ? `Cry-wolf fatigue: −${Math.round(g.fatigue * 100)}% compliance. ` : ''}Unneeded orders cost trust.
        </p>
      </Section>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded bg-slate-900 p-1.5"><div className="text-slate-500">Evac cost</div><div className="font-mono text-amber-300">{fmtK(g.evacTotalCost())}</div></div>
        <div className="rounded bg-slate-900 p-1.5"><div className="text-slate-500">Premiums/day</div><div className="font-mono text-emerald-300">{fmtK(premium)}</div></div>
        <div className="rounded bg-slate-900 p-1.5"><div className="text-slate-500">Upkeep/day</div><div className="font-mono text-rose-300">{fmtK(maint)}</div></div>
      </div>

      <div className="sticky bottom-0 -mx-2.5 flex gap-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent px-2.5 pb-2 pt-3">
        <Btn className="flex-1" onClick={onResearch}>🔬 Research ({g.rp})</Btn>
        <Btn variant="primary" className="flex-[2] text-base!" onClick={() => g.launch()}>▶ LAUNCH INCIDENT <Kbd>Space</Kbd></Btn>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- attack
export function AttackPanel({ g }: { g: Game }) {
  const abilIds: AbilityId[] = ['flare', 'strike', 'siren'];
  let fires = 0;
  for (let i = 0; i < g.fireT.length; i++) if (g.fireT[i] > 0) fires++;
  return (
    <div className="space-y-2.5 p-2.5">
      <Section title="Live Threats">
        <div className="space-y-2">
          {g.kaiju.map((k) => {
            const kd = KAIJU[k.kind];
            const status = k.dead ? 'SLAIN' : k.gone ? 'LEFT CITY' : !k.active ? `arrives in ${Math.max(0, Math.ceil(k.delay - g.atkT))}s` : k.stun > 0 ? 'STUNNED' : k.under ? 'BURROWED' : k.cast ? 'CASTING!' : 'rampaging';
            return (
              <div key={k.id} className={cx('rounded-md bg-slate-950/60 p-2 text-xs', (k.dead || k.gone) && 'opacity-50')}>
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold">{kd.icon} {kd.name}</span>
                  <Chip tone={k.dead ? 'green' : k.cast ? 'red' : k.stun > 0 ? 'blue' : 'slate'}>{status}</Chip>
                </div>
                <Bar value={k.hp} max={k.maxHp} color="bg-gradient-to-r from-rose-600 to-amber-400" h="h-2.5" />
                <div className="mt-0.5 flex justify-between font-mono text-[10px] text-slate-400"><span>{Math.max(0, Math.round(k.hp))} / {k.maxHp}</span>{k.kind === 'boss' && <span className="text-rose-300">Phase {k.phase}/3</span>}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Emergency Actions" right={<span className="text-[10px] text-slate-400">click map to fire</span>}>
        <div className="space-y-1.5">
          {abilIds.map((a) => {
            const info = ABIL[a];
            const cd = g.abil[a];
            const armed = g.armed === a;
            return (
              <button
                key={a}
                type="button"
                disabled={cd > 0 || g.cash < info.cost}
                onClick={() => g.armAbility(a)}
                className={cx('relative w-full overflow-hidden rounded-md border px-2 py-1.5 text-left text-xs transition', armed ? 'border-amber-300 bg-amber-500/25' : 'border-slate-700 bg-slate-950/60 hover:bg-slate-800', (cd > 0 || g.cash < info.cost) && 'opacity-50')}
              >
                {cd > 0 && <div className="absolute inset-y-0 left-0 bg-slate-700/60" style={{ width: (cd / info.cd) * 100 + '%' }} />}
                <div className="relative flex items-center justify-between">
                  <span className="font-semibold">{info.icon} {info.name}</span>
                  <span className="flex items-center gap-2"><span className="font-mono text-amber-300">{fmtK(info.cost)}</span><Kbd>{info.key}</Kbd></span>
                </div>
                <div className="relative text-[11px] text-slate-400">{cd > 0 ? `Recharging ${Math.ceil(cd)}s` : info.desc}</div>
              </button>
            );
          })}
        </div>
        {g.armed && <div className="mt-1.5 text-center text-xs text-amber-300">Targeting: click the map · right-click / Esc cancels</div>}
      </Section>

      <Section title="Speed">
        <div className="flex gap-1.5">
          {[1, 2].map((s) => <Btn key={s} small variant={g.speed === s ? 'primary' : 'ghost'} className="flex-1" onClick={() => g.setSpeed(s)}>{s}× {s === 2 && <Kbd>Space</Kbd>}</Btn>)}
        </div>
      </Section>

      <Section title="Damage Control">
        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <div className="rounded bg-slate-950/60 p-1.5"><div className="text-slate-500">Destroyed</div><div className="font-mono text-lg text-rose-300">{g.inc.destroyed}</div></div>
          <div className="rounded bg-slate-950/60 p-1.5"><div className="text-slate-500">Casualties</div><div className="font-mono text-lg text-rose-400">{g.inc.casualties}</div></div>
          <div className="rounded bg-slate-950/60 p-1.5"><div className="text-slate-500">Fires</div><div className="font-mono text-lg text-orange-300">{fires}</div></div>
        </div>
      </Section>

      {g.settings.tips && g.day <= 2 && (
        <div className="rounded-lg border border-sky-700/40 bg-sky-950/40 p-2 text-xs text-sky-200">
          💡 Press <Kbd>1</Kbd> then click just ahead of the kaiju: a Flare lures it into a stun while your turrets work. Watch for the <b>coloured warning zones</b> — they show where its next attack lands.
        </div>
      )}

      <Section title="Dispatch Log">
        <div className="space-y-0.5 text-[11px]">
          {g.log.length === 0 && <div className="text-slate-500">…</div>}
          {g.log.map((l, i) => <div key={i} style={{ color: l.color, opacity: 1 - i * 0.12 }}>• {l.text}</div>)}
        </div>
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------- claims
const CAUSE_ICON: Record<string, string> = { stomp: '🦶 Stomp damage', fire: '🔥 Fire', flood: '🌊 Flood', quake: '🌋 Quake / shockwave', collateral: '💥 Defense collateral' };

export function ClaimsPanel({ g }: { g: Game }) {
  const c = g.claims[g.ci];
  if (!c) return null;
  const ratio = c.assessed > 0 ? c.claimed / c.assessed : Infinity;
  const ai = g.has('fraudai');
  const bad = (cond: boolean) => (ai && cond ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-100');
  const riderChip = (k: 'fire' | 'flood' | 'quake', label: string) => (
    <span className={cx('rounded border px-1.5 py-0.5 text-[11px] font-semibold', c.riders[k] ? 'border-emerald-600/60 bg-emerald-900/50 text-emerald-300' : 'border-rose-700/60 bg-rose-900/40 text-rose-300', c.cause === k && 'ring-2 ring-amber-300')}>
      {c.riders[k] ? '✔' : '✘'} {label}
    </span>
  );
  const cost = g.investCost();
  return (
    <div className="space-y-2.5 p-2.5">
      <Section title={`Claims Office — ${g.ci + 1} of ${g.claims.length}`} right={<span className="font-mono text-[11px] text-slate-300">streak ×{g.streak}</span>}>
        <div className="flex gap-0.5">
          {g.claims.map((cl, i) => (
            <div key={cl.id} className={cx('h-1.5 flex-1 rounded-full', cl.decision ? (cl.decision === 'deny' ? 'bg-rose-500' : 'bg-emerald-500') : i === g.ci ? 'bg-amber-400' : 'bg-slate-700')} />
          ))}
        </div>
        {g.autoCount > 0 && <p className="mt-1.5 text-[11px] text-slate-400">{g.autoCount} small claims were auto-adjudicated by the rules engine ({fmtK(g.autoPaid)} paid).</p>}
      </Section>

      <div key={c.id} className="anim-slide rounded-xl border-2 border-amber-200/40 bg-gradient-to-b from-amber-50/10 to-slate-900 p-3 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-serif text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Claim #{c.id}</div>
            <div className="font-serif text-base font-bold">{c.bType === 'landmark' ? '🏛 ' : ''}{c.bType[0].toUpperCase() + c.bType.slice(1)} · {DISTRICTS[c.district].name}</div>
          </div>
          <Chip tone="amber">{c.photo === 'rubble' ? '📷 rubble' : c.photo === 'damaged' ? '📷 damaged' : '📷 intact'}</Chip>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-slate-950/70 p-2">
            <div className="text-slate-500">Claimed amount</div>
            <div className={cx('font-mono text-lg', bad(ratio > 1.5))}>{fmtK(c.claimed)}</div>
          </div>
          <div className="rounded bg-slate-950/70 p-2">
            <div className="text-slate-500">Assessed (aerial survey)</div>
            <div className={cx('font-mono text-lg', bad(c.assessed === 0))}>{fmtK(c.assessed)}</div>
          </div>
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Claimed cause</span><span className="font-semibold">{CAUSE_ICON[c.cause]}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-slate-400">Policy riders</span>
            <span className="flex flex-wrap gap-1"><span className="rounded border border-emerald-600/60 bg-emerald-900/50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">✔ Stomp</span>{riderChip('fire', 'Fire')}{riderChip('flood', 'Flood')}{riderChip('quake', 'Quake')}</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-400">Prior claims</span><span className={bad(c.history >= 3)}>{c.history}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">In kaiju path?</span><span className={bad(!c.inPath)}>{c.inPath ? 'Yes' : 'No — outside the path'}</span></div>
          {Number.isFinite(ratio) && <div className="flex justify-between"><span className="text-slate-400">Claimed ÷ assessed</span><span className={bad(ratio > 1.5)}>{ratio.toFixed(2)}×</span></div>}
        </div>
        {!c.covered && <div className="mt-2 rounded bg-rose-950/60 p-1.5 text-[11px] text-rose-300">⚠ The claimed cause is not covered by this policy.</div>}
        {c.investigated && (
          <div className="mt-2 rounded border border-sky-600/50 bg-sky-950/60 p-2 text-xs text-sky-200">
            🕵️ <b>Investigation:</b> {c.kind === 'legit' ? 'Honest claim.' : c.kind === 'inflated' ? 'INFLATED — owner padded the figures.' : 'PHANTOM — the building was never damaged.'} True damage {fmtK(c.trueDmg)}. {c.covered ? 'Cause is covered.' : 'Cause is NOT covered.'}
          </div>
        )}
      </div>

      {g.lastResult && <div className={cx('rounded-md p-2 text-xs font-semibold', g.lastResult.startsWith('✔') ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300')}>{g.lastResult}</div>}

      <div className="grid grid-cols-3 gap-1.5">
        <Btn variant="good" onClick={() => g.decide('approve')} title="Pay the claimed amount (A)"><div>Approve <Kbd>A</Kbd></div><div className="font-mono text-[11px] opacity-80">pay {fmtK(c.claimed)}</div></Btn>
        <Btn onClick={() => g.decide('settle')} title="Pay the assessed amount (S)"><div>Settle <Kbd>S</Kbd></div><div className="font-mono text-[11px] opacity-80">pay {fmtK(c.assessed)}</div></Btn>
        <Btn variant="danger" onClick={() => g.decide('deny')} title="Deny (D)"><div>Deny <Kbd>D</Kbd></div><div className="font-mono text-[11px] opacity-80">pay $0K</div></Btn>
      </div>
      <Btn className="w-full" disabled={c.investigated || g.tokens <= 0 || g.cash < cost} onClick={() => g.investigate()}>
        🕵️ Investigate <Kbd>I</Kbd> <span className="text-slate-400">— {fmtK(cost)} · {g.tokens} left today</span>
      </Btn>
      <Btn small variant="ghost" className="w-full" onClick={() => g.fastSettle()} title="Settle every remaining covered claim at assessed value and deny the uncovered ones">⏩ Fast-process the remaining {g.claims.length - g.ci} (rules of thumb)</Btn>

      {g.settings.tips && g.stats.decided < 6 && (
        <div className="rounded-lg border border-sky-700/40 bg-sky-950/40 p-2 text-[11px] text-sky-200">
          💡 <b>Approve</b> honest, covered claims. <b>Settle</b> padded claims (claimed ≫ assessed). <b>Deny</b> uncovered causes and phantoms (intact photo, outside the path). Denying honest claims destroys trust. Unsure? Investigate.
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- idle sidebar (report phase)
export function CityPanel({ g }: { g: Game }) {
  const ruined = g.buildings.filter((b) => b.hp <= 0).length;
  return (
    <div className="space-y-2.5 p-2.5">
      <Section title="City Status">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-slate-950/60 p-2"><div className="text-slate-500">Insured value</div><div className="font-mono text-emerald-300">{fmtK(g.cityValue())}</div></div>
          <div className="rounded bg-slate-950/60 p-2"><div className="text-slate-500">Ruins</div><div className="font-mono text-rose-300">{ruined}</div></div>
        </div>
      </Section>
    </div>
  );
}
