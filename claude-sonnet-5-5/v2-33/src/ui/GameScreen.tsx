import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Game } from '../game/engine';
import type { GameCfg } from '../game/engine';
import { audio } from '../game/audio';
import {
  TABS, RES_LIST, RES_INFO, SHIPS, BOONS, DIFFS, WORLD_W, WORLD_H, fmt, fmtTime, bagUnits, SPEC_INFO,
} from '../game/data';
import type { Tab, RunResult } from '../game/data';
import type { Settings } from '../game/save';
import * as Sys from '../game/systems';
import { useTick, Bar, Modal, SettingsPanel, HelpContent, StatsGrid } from './common';
import { FleetPanel, MarketPanel, RightsPanel, CrewPanel, LabPanel, DiploPanel } from './panels';

type Menu = 'none' | 'pause' | 'help' | 'settings';

interface Props {
  cfg: GameCfg;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onBank: (g: Game, k: RunResult['kind']) => void;
  onRestart: () => void;
  onExit: () => void;
  onCampaign: () => void;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function Chip({ children, title, cls = '' }: { children: ReactNode; title?: string; cls?: string }) {
  return (
    <div title={title} className={`flex items-center gap-1 whitespace-nowrap rounded border border-cyan-400/20 bg-slate-900/70 px-2 py-0.5 text-sm tabular-nums ${cls}`}>
      {children}
    </div>
  );
}

export default function GameScreen(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const [g, setG] = useState<Game | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [menu, setMenu] = useState<Menu>('none');
  const [confirm, setConfirm] = useState<'' | 'quit' | 'restart'>('');
  const bankRef = useRef(p.onBank);
  bankRef.current = p.onBank;
  useTick(120);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game: Game = new Game(p.cfg, {
      onOver: (k) => bankRef.current(game, k),
      onPause: () => setMenu((m) => (m === 'none' ? 'pause' : m)),
    });
    setG(game);
    game.start(canvas, miniRef.current);
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(canvas);
    const blurSel = () => { const a = document.activeElement as HTMLElement | null; if (a && a.tagName === 'SELECT') a.blur(); };
    document.addEventListener('change', blurSel);
    return () => {
      ro.disconnect();
      document.removeEventListener('change', blurSel);
      game.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (g) g.miniCanvas = miniRef.current; }, [g]);
  useEffect(() => { if (g) g.cfg.settings = p.settings; }, [g, p.settings]);
  useEffect(() => { if (g) g.setPaused(menu !== 'none'); }, [g, menu]);

  const openTab = (id: Tab) => {
    if (!g) return;
    g.tabsSeen.add(id);
    audio.play('click');
    setTab((t) => (t === id ? null : id));
  };

  useEffect(() => {
    if (!g) return;
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      const k = e.key.toLowerCase();
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (g.over) return;
      if (k === 'escape') {
        if (menu === 'help' || menu === 'settings') setMenu('pause');
        else if (menu === 'pause') setMenu('none');
        else if (tab) setTab(null);
        else setMenu('pause');
        return;
      }
      if (tg && tg.tagName === 'SELECT') return;
      if (menu !== 'none') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'p') { setMenu('pause'); return; }
      if (k === 'h' || k === 'f1') { e.preventDefault(); setMenu('help'); return; }
      const t = TABS.find((x) => x.key.toLowerCase() === k);
      if (t) openTab(t.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, menu, tab]);

  const boons = useMemo(() => shuffle(BOONS).slice(0, 3), [g?.sector, g?.over]);

  const miniPtr = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!g || (e.type === 'pointermove' && e.buttons === 0)) return;
    const r = e.currentTarget.getBoundingClientRect();
    g.focusAt(((e.clientX - r.left) / r.width) * WORLD_W, ((e.clientY - r.top) / r.height) * WORLD_H);
  };

  const exitRun = (then: () => void) => {
    if (g && !g.over) g.abandon();
    then();
  };

  const timeLeft = g && g.timeLimit > 0 ? g.timeLimit - g.sectorTime : 0;
  const boss = g && g.bossId ? g.shipMap.get(g.bossId) : undefined;
  const tut = g ? Sys.tutorialText(g) : null;
  const sel = g ? g.selectedShips() : [];
  const now = g ? g.time : 0;
  const recent = g ? g.log.filter((m) => now - m.t < 14).slice(-6) : [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />
      {g && (
        <div className="pointer-events-none absolute inset-0">
          {/* ===== top bar ===== */}
          <div className="pointer-events-auto absolute left-0 right-0 top-0 flex flex-wrap items-center gap-1 bg-gradient-to-b from-black/80 to-transparent p-1">
            <Chip cls="font-title text-xs text-cyan-200" title={g.sd.blurb}>
              S{g.sector} · {g.sd.name}
            </Chip>
            {g.sd.boss ? (
              <Chip cls="text-amber-200">🐋 Haul the Leviathan home</Chip>
            ) : g.quota > 0 ? (
              <Chip cls="min-w-[170px]" title="Salvage value delivered this sector">
                <div className="w-full">
                  <div className="flex justify-between text-xs"><span>Quota</span><span>{fmt(g.delivered)}/{fmt(g.quota)}</span></div>
                  <Bar v={g.delivered} max={g.quota} color="#ffd36e" />
                </div>
              </Chip>
            ) : null}
            {g.timeLimit > 0 && (
              <Chip cls={timeLeft < 60 ? 'animate-pulse text-red-300' : ''} title="Time until the charter audit">⏱ {fmtTime(timeLeft)}</Chip>
            )}
            <Chip cls="text-amber-200" title="Credits">💰 {fmt(g.credits)}</Chip>
            <Chip title="Stock: scrap, alloy, power cores, data shards, relics" cls="gap-2 text-xs">
              {RES_LIST.map((r) => (
                <span key={r} title={RES_INFO[r].name} style={{ color: RES_INFO[r].color }}>{RES_INFO[r].icon}{fmt(g.stock[r])}</span>
              ))}
            </Chip>
            <Chip cls={g.fuel < 30 ? 'animate-pulse text-red-300' : 'text-yellow-200'} title="Fuel: ships crawl at 35% speed when empty">⛽ {fmt(g.fuel)}</Chip>
            <Chip title="Heat attracts pirate raids">
              🔥
              <div className="w-14"><Bar v={g.heat} max={100} color={g.heat > 60 ? '#ff6b57' : '#ffa44d'} /></div>
            </Chip>
            <Chip title="Station hull" cls={g.station.hp < g.station.maxHp * 0.35 ? 'animate-pulse text-red-300' : ''}>
              🏰
              <div className="w-14"><Bar v={g.station.hp} max={g.station.maxHp} color="#7dffb0" /></div>
            </Chip>
            <div className="ml-auto flex items-center gap-1">
              <button className="btn" title="Game speed (V)" onClick={() => g.cycleSpeed()}>{g.speed}×</button>
              <button className="btn" title="Mute" onClick={() => p.onSettings({ ...p.settings, muted: !p.settings.muted })}>{p.settings.muted ? '🔇' : '🔊'}</button>
              <button className="btn" title="Help (H)" onClick={() => setMenu('help')}>❓</button>
              <button className="btn" title="Pause (Esc)" onClick={() => setMenu('pause')}>⏸</button>
            </div>
          </div>

          {/* ===== boss bar ===== */}
          {boss && boss.vis && (
            <div className="absolute left-1/2 top-28 w-[min(480px,70vw)] -translate-x-1/2 xl:top-14">
              <div className="mb-0.5 flex justify-between font-title text-xs text-orange-300">
                <span>DREADNOUGHT MAW</span><span>Phase {g.bossPhase}</span>
              </div>
              <div className="h-3 overflow-hidden rounded border border-orange-400/50 bg-black/60">
                <div className="h-full bg-gradient-to-r from-orange-600 to-red-400 transition-all" style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
              </div>
            </div>
          )}

          {/* ===== tutorial ===== */}
          {tut && (
            <div className="pointer-events-auto panel anim-in absolute left-1/2 top-32 w-[min(560px,92vw)] -translate-x-1/2 rounded-lg border-amber-300/50 p-3 xl:top-20" style={{ borderColor: 'rgba(255,211,110,0.6)' }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-title text-xs text-amber-200">TRAINING {g.tutStep + 1}/{Sys.TUT.length}</span>
                <button className="btn" onClick={() => { g.tutOn = false; }}>Skip</button>
              </div>
              <div className="text-sm text-slate-100">{tut}</div>
              {g.tutStep === Sys.TUT.length - 1 && <div className="mt-1"><Bar v={g.delivered} max={g.quota} color="#ffd36e" /><div className="text-xs text-slate-400">{fmt(g.delivered)} / {fmt(g.quota)}</div></div>}
            </div>
          )}

          {/* ===== right panel ===== */}
          <div className="pointer-events-none absolute bottom-2 right-1 top-28 flex w-[min(380px,calc(100vw-8px))] flex-col items-end gap-1 xl:top-14">
            <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
              {TABS.map((t) => {
                const badge = t.id === 'rights' && g.auctions.length > 0;
                return (
                  <button key={t.id} className={`btn relative ${tab === t.id ? 'btn-gold' : ''}`} title={`${t.name} (${t.key})`} onClick={() => openTab(t.id)}>
                    {t.icon} <span className="hidden lg:inline">{t.name}</span>
                    {badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-amber-300" />}
                  </button>
                );
              })}
            </div>
            {tab && (
              <div className="panel scroll anim-in pointer-events-auto min-h-0 w-full flex-1 rounded-lg p-3">
                {tab === 'fleet' && <FleetPanel g={g} />}
                {tab === 'market' && <MarketPanel g={g} />}
                {tab === 'rights' && <RightsPanel g={g} />}
                {tab === 'crew' && <CrewPanel g={g} />}
                {tab === 'lab' && <LabPanel g={g} />}
                {tab === 'diplo' && <DiploPanel g={g} />}
              </div>
            )}
          </div>

          {/* ===== log + minimap ===== */}
          <div className="absolute bottom-[104px] left-2 w-[min(340px,60vw)] space-y-0.5 md:bottom-[146px]">
            {recent.map((m) => (
              <div key={m.id} className="rounded bg-black/55 px-2 py-0.5 text-xs md:text-sm" style={{ color: m.color, opacity: Math.min(1, (14 - (now - m.t)) / 4) }}>{m.text}</div>
            ))}
          </div>
          <div className="pointer-events-auto absolute bottom-2 left-2 flex items-end gap-1">
            <canvas
              ref={miniRef} width={240} height={160}
              className="panel h-[93px] w-[140px] cursor-pointer rounded md:h-[133px] md:w-[200px]"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); miniPtr(e); }}
              onPointerMove={miniPtr}
            />
            <div className="flex flex-col gap-1">
              <button className="btn" title="Zoom in (+)" onClick={() => g.zoomBy(1.2)}>＋</button>
              <button className="btn" title="Zoom out (-)" onClick={() => g.zoomBy(1 / 1.2)}>－</button>
              <button className="btn" title="Centre on station (Space)" onClick={() => { g.sel = []; g.focusSel(); }}>🏰</button>
            </div>
          </div>

          {/* ===== selection ===== */}
          <div className="pointer-events-auto panel absolute bottom-2 left-[170px] right-2 rounded-lg p-2 md:left-[250px] md:right-auto md:w-[500px]">
            {sel.length === 0 ? (
              <div className="text-xs text-slate-300 md:text-sm">
                <b className="text-cyan-200">Select</b> ships (click / drag), then <b className="text-cyan-200">right-click</b> a wreck to tow or cut it, an enemy to attack, or empty space to move. <b>Q</b> = auto mode.
                <button className="btn ml-2" onClick={() => g.selectAll()}>Select all</button>
              </div>
            ) : sel.length === 1 ? (
              (() => {
                const s = sel[0];
                const d = SHIPS[s.kind];
                const c = g.crewOf(s);
                const cap = g.cargoCap(s);
                return (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-2xl">{d.icon}</span>
                    <div className="min-w-[150px] flex-1">
                      <div className="flex justify-between"><b style={{ color: d.color }}>{d.name}</b><span className="text-xs text-slate-400">“{s.name}”</span></div>
                      <Bar v={s.hp} max={s.maxHp} color={s.hp / s.maxHp > 0.5 ? '#7dffb0' : '#ff6b57'} />
                      <div className="text-xs text-slate-400">
                        {c ? `${SPEC_INFO[c.spec].icon} ${c.name} ★${c.skill} · morale ${Math.round(c.morale)}` : <span className="text-orange-300">No captain: hire crew (C)</span>}
                      </div>
                      {cap > 0 && <div className="text-xs text-amber-200">Cargo {Math.round(bagUnits(s.cargo))}/{Math.round(cap)}</div>}
                      {s.kind === 'tug' || s.kind === 'hauler' ? <div className="text-xs text-cyan-200">Tow power {Math.round(g.towCap(s))}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button className={`btn ${s.auto ? 'btn-gold' : ''}`} onClick={() => g.toggleAuto()}>Auto (Q)</button>
                      <button className="btn" onClick={() => g.stopSel()}>Stop (X)</button>
                      <button className="btn" onClick={() => g.returnSel()}>Dock (R)</button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex flex-1 flex-wrap gap-1">
                  {Object.entries(sel.reduce<Record<string, number>>((a, s) => { a[s.kind] = (a[s.kind] || 0) + 1; return a; }, {})).map(([k, n]) => (
                    <span key={k} className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5">{SHIPS[k as keyof typeof SHIPS].icon} ×{n}</span>
                  ))}
                  <span className="text-xs text-slate-400">{sel.length} selected · Tow power {Math.round(sel.reduce((a, s) => a + g.towCap(s), 0))}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button className="btn" onClick={() => g.toggleAuto()}>Auto (Q)</button>
                  <button className="btn" onClick={() => g.stopSel()}>Stop (X)</button>
                  <button className="btn" onClick={() => g.returnSel()}>Dock (R)</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== menus ===== */}
      {g && menu === 'pause' && !g.over && (
        <Modal title="⏸ Paused" onClose={() => setMenu('none')}>
          <div className="grid gap-3">
            <button className="btn btn-big btn-gold" onClick={() => setMenu('none')}>Resume</button>
            <div>
              <div className="mb-1 text-xs uppercase tracking-widest text-slate-400">Difficulty (applies live)</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(DIFFS).map((d) => (
                  <button key={d.id} className={`btn ${g.diff.id === d.id ? 'btn-gold' : ''}`} title={d.desc} onClick={() => { g.diff = d; g.cfg.diff = d.id; g.quota = Math.round(g.sd.quota * d.quota); audio.play('click'); }}>
                    {d.name}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-400">{g.diff.desc}{g.mods.size > 0 ? ` Modifiers: ${[...g.mods].join(', ')}.` : ''}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => setMenu('settings')}>⚙ Settings</button>
              <button className="btn" onClick={() => setMenu('help')}>❓ Help &amp; controls</button>
            </div>
            {confirm === '' ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-red" onClick={() => setConfirm('restart')}>↻ Restart run</button>
                <button className="btn btn-red" onClick={() => setConfirm('quit')}>⏏ Quit to title</button>
              </div>
            ) : (
              <div className="rounded border border-red-400/50 bg-red-950/40 p-2 text-sm">
                This ends the current run (renown earned so far is kept). Are you sure?
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-red" onClick={() => exitRun(confirm === 'quit' ? p.onExit : p.onRestart)}>Yes, {confirm === 'quit' ? 'quit' : 'restart'}</button>
                  <button className="btn" onClick={() => setConfirm('')}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
      {g && menu === 'settings' && (
        <Modal title="⚙ Settings" onClose={() => setMenu('pause')}>
          <SettingsPanel s={p.settings} onChange={p.onSettings} />
        </Modal>
      )}
      {g && menu === 'help' && (
        <Modal title="❓ Field manual" wide onClose={() => setMenu(g.over ? 'none' : 'pause')}>
          <HelpContent />
        </Modal>
      )}

      {/* ===== end states ===== */}
      {g && g.over === 'sector' && g.result && (
        <Modal title={`✅ Sector ${g.sector} cleared: ${g.sd.name}`}>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">Quota met with {fmtTime(Math.max(0, g.timeLimit - g.sectorTime))} to spare. The syndicate board awards <b className="text-amber-200">+{g.result.renown} Renown</b> (spend it in the Archives).</div>
            <StatsGrid stats={g.result.stats} time={g.result.time} />
            <div>
              <div className="mb-1 font-title text-sm text-amber-200">Choose a boon for the next sector</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {boons.map((b) => (
                  <button key={b.id} className="panel rounded p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_0_18px_rgba(255,211,110,0.4)]" onClick={() => { setTab(null); g.nextSector(b.id); }}>
                    <div className="text-2xl">{b.icon}</div>
                    <div className="font-semibold text-amber-200">{b.name}</div>
                    <div className="text-xs text-slate-300">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-400">Next: Sector {g.sector + 1}. Ships, crew, research, credits and relations carry over.</div>
          </div>
        </Modal>
      )}
      {g && g.over === 'won' && g.result && (
        <Modal title="🏆 VICTORY: The Leviathan is yours!">
          <div className="space-y-3">
            <div className="text-sm text-slate-300">You hauled the dead titan home. The salvage wars are over, and your syndicate rules the wreck fields.</div>
            <div className="flex gap-4 text-sm"><span>Score <b className="text-amber-200">{fmt(g.result.score)}</b></span><span>Renown <b className="text-amber-200">+{g.result.renown}</b></span><span>MAW {g.stats.bossKilled ? <b className="text-emerald-300">destroyed</b> : <b className="text-slate-300">evaded</b>}</span></div>
            <StatsGrid stats={g.result.stats} time={g.result.time} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-big btn-gold" onClick={() => g.continueEndless()}>Continue: endless mode</button>
              <button className="btn btn-big" onClick={p.onRestart}>New campaign</button>
              <button className="btn btn-big" onClick={p.onExit}>Title</button>
            </div>
          </div>
        </Modal>
      )}
      {g && g.over === 'lost' && g.result && (
        <Modal title="💀 DEFEAT: The syndicate has fallen">
          <div className="space-y-3">
            <div className="text-sm text-red-200">{g.result.reason}</div>
            <div className="flex gap-4 text-sm"><span>Score <b className="text-amber-200">{fmt(g.result.score)}</b></span><span>Sector <b className="text-amber-200">{g.result.sector}</b></span><span>Renown <b className="text-amber-200">+{g.result.renown}</b></span></div>
            <StatsGrid stats={g.result.stats} time={g.result.time} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-big btn-gold" onClick={p.onRestart}>↻ Retry</button>
              <button className="btn btn-big" onClick={p.onExit}>Title</button>
            </div>
          </div>
        </Modal>
      )}
      {g && g.over === 'trained' && g.result && (
        <Modal title="🎓 Training complete">
          <div className="space-y-3">
            <div className="text-sm text-slate-300">You know the ropes, Chief. Ready for the real thing?</div>
            <StatsGrid stats={g.result.stats} time={g.result.time} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-big btn-gold" onClick={p.onCampaign}>Start campaign</button>
              <button className="btn btn-big" onClick={p.onExit}>Title</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
