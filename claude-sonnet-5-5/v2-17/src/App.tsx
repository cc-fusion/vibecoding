import { useEffect, useRef, useState } from "react";
import { BOON_IDS, DIFFICULTIES, PERKS, REALMS, TRAITS, WEAPONS, baseMods, buildingCost, type DifficultyId, type StatKey, type WeaponId } from "./game/data";
import {
  addRelic, advanceYears, bl, birthAfterExpedition, blessCost, cleanseCost, crownHeir, diffMult, dynastyScore, heroMods, keepRate, logEvent, makeSuitors, marksFor, newDynasty,
  rebirthCost, relicSlots, retireHero, riteTraitFor, statCap, suitorCost, trainCost, type Dynasty, type Hero,
} from "./game/lineage";
import { loadSave, writeSave, type SaveData, type Settings } from "./game/save";
import { audio } from "./game/audio";
import type { RunConfig } from "./game/engine";
import { HelpModal, Legacy, NewDynasty, SettingsModal, Title } from "./ui/Menus";
import { Homestead, type Actions } from "./ui/Homestead";
import { RunScreen, type RunResult } from "./ui/RunScreen";
import { EndScreen, ReportScreen, SuccessionScreen, type Report } from "./ui/Screens";
import { Btn, Modal } from "./ui/common";

type Screen = "title" | "new" | "legacy" | "home" | "run" | "report" | "succession" | "end";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function buildCfg(d: Dynasty): RunConfig {
  const m = heroMods(d, d.hero);
  const dm = diffMult(d);
  const n = Math.floor((bl(d, "shrine") + 1) / 2);
  const ids = BOON_IDS.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const startBoons: Record<string, number> = {};
  for (const id of ids) startBoons[id] = 1;
  return {
    name: d.hero.name, hue: d.hero.hue, gen: d.gen, ancestors: d.ancestors.length, mods: m, weapon: d.weapon, potions: m.potions,
    diff: { hp: dm.hp, dmg: dm.dmg, gold: dm.gold, spd: dm.spd }, startBoons,
  };
}
function tutorialCfg(): RunConfig {
  const m = baseMods();
  m.hpBase = 150; m.potions = 1;
  return { name: "Recruit", hue: 40, gen: 1, ancestors: 4, mods: m, weapon: "blade", potions: 1, diff: { hp: 1, dmg: 1, gold: 1, spd: 1 }, startBoons: {}, tutorial: true };
}

export default function App() {
  const saveRef = useRef<SaveData>(loadSave());
  const [save, setSave] = useState<SaveData>(saveRef.current);
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<{ cfg: RunConfig; realm: number; tutorial: boolean; key: number } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [endInfo, setEndInfo] = useState<{ d: Dynasty; won: boolean; marks: number } | null>(null);
  const [modal, setModal] = useState<"settings" | "help" | "menu" | "askTut" | "retire" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const tutReturn = useRef<"home" | "title">("title");

  const persist = (s: SaveData) => { saveRef.current = s; writeSave(s); setSave(s); };
  const mutate = <R,>(fn: (d: Dynasty) => R): R | undefined => {
    const s = saveRef.current;
    if (!s.dynasty) return undefined;
    const d = clone(s.dynasty);
    const r = fn(d);
    persist({ ...s, dynasty: d });
    return r;
  };
  const say = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  // audio setup
  useEffect(() => { audio.applySettings(save.settings); }, [save.settings]);
  useEffect(() => {
    const init = () => audio.init();
    window.addEventListener("pointerdown", init);
    window.addEventListener("keydown", init);
    return () => { window.removeEventListener("pointerdown", init); window.removeEventListener("keydown", init); };
  }, []);
  useEffect(() => {
    if (screen === "run") return;
    const realm = Math.min(4, saveRef.current.dynasty?.realmsCleared ?? 0);
    if (screen === "end" && endInfo) {
      audio.setMood(endInfo.won ? "victory" : "defeat");
      const t = window.setTimeout(() => audio.setMood("hub", 0), 4200);
      return () => clearTimeout(t);
    }
    audio.setMood("hub", screen === "home" || screen === "report" || screen === "succession" ? realm : 0);
  }, [screen, endInfo]);
  useEffect(() => {
    if (screen !== "home") return;
    const d = saveRef.current.dynasty;
    if (d && !d.spouse && d.suitors.length === 0) mutate((dd) => { dd.suitors = makeSuitors(dd); });
  }, [screen]);

  const setSettings = (s: Settings) => persist({ ...saveRef.current, settings: s });

  // ---------- dynasty lifecycle ----------
  const startNew = (house: string, diff: DifficultyId, mods: string[]) => {
    const d = newDynasty(house, diff, mods, saveRef.current.perks);
    persist({ ...saveRef.current, dynasty: d });
    audio.sfx("select");
    if (!saveRef.current.tutorialDone) setModal("askTut");
    else setScreen("home");
  };
  const startTutorial = (ret: "home" | "title") => {
    tutReturn.current = ret;
    setModal(null);
    setRun({ cfg: tutorialCfg(), realm: 0, tutorial: true, key: Date.now() });
    setScreen("run");
  };
  const finalizeEnd = (d: Dynasty, won: boolean) => {
    const s = saveRef.current;
    const marks = marksFor(d);
    const entry = { house: d.house, result: won ? ("won" as const) : ("lost" as const), reason: won ? "Hollow King slain" : d.endReason || "Line ended", gens: d.gen, years: d.year, bosses: d.stats.bosses, difficulty: DIFFICULTIES[d.difficulty].name, score: dynastyScore(d) };
    persist({ ...s, dynasty: won ? d : null, marks: s.marks + marks, hall: [entry, ...s.hall].slice(0, 30) });
    setEndInfo({ d, won, marks });
  };

  const onRunEnd = (res: RunResult) => {
    setRun(null);
    if (res.outcome === "tutorial") {
      persist({ ...saveRef.current, tutorialDone: true });
      setScreen(tutReturn.current === "home" && saveRef.current.dynasty ? "home" : "title");
      return;
    }
    const s = saveRef.current;
    if (!s.dynasty) { setScreen("title"); return; }
    const d = clone(s.dynasty);
    const r = res.run;
    const keep = res.outcome === "died" ? keepRate(d) : 1;
    const goldKept = Math.floor(r.gold * keep);
    d.gold += goldKept;
    d.stats.runs++; d.stats.kills += r.kills; d.stats.rooms += r.rooms; d.stats.bosses += r.bosses; d.stats.goldEarned += goldKept; d.stats.damage += r.damage;
    const renown = Math.floor((r.rooms * 2 + r.bosses * 15 + r.kills / 12) * diffMult(d).renown);
    d.renown += renown;
    const prevRealms = d.realmsCleared;
    d.realmsCleared = Math.max(d.realmsCleared, res.bosses);
    for (const id of res.relics) addRelic(d, id);
    logEvent(d, `${d.hero.name} ${res.outcome === "died" ? "fell" : res.outcome === "victory" ? "slew the Hollow King" : "returned"} (${r.rooms} rooms, ${r.bosses} bosses).`);
    if (d.realmsCleared > prevRealms) logEvent(d, `${REALMS[d.realmsCleared - 1].name} is conquered.`);
    const born = birthAfterExpedition(d);
    advanceYears(d, 4);
    let next: Report["next"] = "home";
    let note = res.outcome === "died" ? `${d.hero.name} met their end in ${REALMS[Math.min(4, res.realm)].name}.` : res.outcome === "victory" ? "Your line has done what none thought possible." : `${d.hero.name} returns home with tales and treasure.`;
    let won = false;
    if (res.outcome === "victory" && !d.victory) { d.victory = true; won = true; next = "end"; }
    else if (res.outcome === "died") {
      const sr = retireHero(d, `fell in ${REALMS[Math.min(4, res.realm)].name}`);
      next = sr.lost ? "end" : "succession";
    } else if (d.hero.age >= 62) {
      const sr = retireHero(d, `passed peacefully at age ${d.hero.age}`);
      note = `${d.hero.name} has grown old and passes the blade.`;
      next = sr.lost ? "end" : "succession";
    }
    setReport({ outcome: res.outcome === "died" ? "died" : res.outcome === "victory" ? "victory" : "retreat", run: r, bosses: res.bosses, relics: res.relics, realm: res.realm, room: res.room, goldKept, renown, born, note, next });
    if (next === "end") {
      if (won) { persist({ ...s, dynasty: d }); finalizeEnd(d, true); }
      else finalizeEnd(d, false);
    } else persist({ ...s, dynasty: d });
    setScreen("report");
  };

  // ---------- homestead actions ----------
  const findHero = (d: Dynasty, id: number): Hero | undefined => (d.hero.id === id ? d.hero : d.children.find((c) => c.id === id));
  const act: Actions = {
    train: (id, k: StatKey) => {
      const ok = mutate((d) => {
        const h = findHero(d, id);
        if (!h) return false;
        const cost = trainCost(d, h, k);
        if (d.gold < cost || h.stats[k] >= statCap(d)) return false;
        d.gold -= cost; h.stats[k]++;
        return true;
      });
      if (ok) audio.sfx("build"); else audio.sfx("error");
    },
    marry: (id) => {
      const ok = mutate((d) => {
        const s = d.suitors.find((x) => x.id === id);
        if (!s || d.gold < suitorCost(s) || d.spouse) return false;
        d.gold -= suitorCost(s); d.spouse = s; d.suitors = [];
        logEvent(d, `${d.hero.name} weds ${s.name}.`);
        return true;
      });
      if (ok) { audio.sfx("marry"); say("A wedding! Children will be born after your next expedition."); } else audio.sfx("error");
    },
    refreshSuitors: () => {
      mutate((d) => { if (d.gold >= 20) { d.gold -= 20; d.suitors = makeSuitors(d); } });
      audio.sfx("select");
    },
    upgrade: (id) => {
      const ok = mutate((d) => {
        const lv = bl(d, id), c = buildingCost(lv);
        if (lv >= 5 || d.gold < c.gold || d.renown < c.renown) return false;
        d.gold -= c.gold; d.renown -= c.renown; d.buildings[id] = lv + 1;
        logEvent(d, `The ${id} is upgraded to level ${lv + 1}.`);
        return true;
      });
      if (ok) { audio.sfx("build"); say("Estate upgraded!"); } else audio.sfx("error");
    },
    buyWeapon: (id: WeaponId) => {
      const ok = mutate((d) => {
        const w = WEAPONS[id];
        if (d.weapons.includes(id) || d.gold < w.cost) return false;
        d.gold -= w.cost; d.weapons.push(id); d.weapon = id;
        return true;
      });
      if (ok) { audio.sfx("build"); say("Weapon forged and equipped."); } else audio.sfx("error");
    },
    equipWeapon: (id) => { mutate((d) => { if (d.weapons.includes(id)) d.weapon = id; }); audio.sfx("select"); },
    toggleRelic: (uid) => {
      mutate((d) => {
        if (d.equipped.includes(uid)) d.equipped = d.equipped.filter((x) => x !== uid);
        else if (d.equipped.length < relicSlots(d)) d.equipped.push(uid);
      });
      audio.sfx("relic");
    },
    rite: (kind, heroId, idx) => {
      const msg = mutate((d) => {
        const h = findHero(d, heroId);
        if (!h) return null;
        if (kind === "reroll") {
          const c = rebirthCost(d);
          if (d.gold < c) return null;
          d.gold -= c;
          const nt = riteTraitFor(d, h, idx);
          h.traits[idx] = nt;
          return `${h.name} is reborn as ${TRAITS[nt].name}.`;
        }
        if (kind === "cleanse") {
          const c = cleanseCost(d);
          if (d.gold < c) return null;
          d.gold -= c;
          const old = h.traits.splice(idx, 1)[0];
          return `${TRAITS[old]?.name ?? "A trait"} is cleansed from ${h.name}.`;
        }
        const c = blessCost(d);
        if (h.traits.length >= 3 || d.gold < c || d.renown < 10) return null;
        d.gold -= c; d.renown -= 10;
        const nt = riteTraitFor(d, h, -1);
        h.traits.push(nt);
        return `${h.name} is blessed with ${TRAITS[nt].name}.`;
      });
      if (msg) { audio.sfx("relic"); say(msg); } else audio.sfx("error");
    },
    depart: (realm) => {
      const d = saveRef.current.dynasty;
      if (!d) return;
      setRun({ cfg: buildCfg(d), realm, tutorial: false, key: Date.now() });
      setScreen("run");
    },
    menu: () => setModal("menu"),
    settings: () => setModal("settings"),
    help: () => setModal("help"),
  };

  const d = save.dynasty;
  const buyPerk = (id: string) => {
    const p = PERKS.find((x) => x.id === id);
    if (!p) return;
    const s = saveRef.current;
    const lv = s.perks[id] || 0;
    const cost = p.costs[lv];
    if (cost === undefined || s.marks < cost) { audio.sfx("error"); return; }
    persist({ ...s, marks: s.marks - cost, perks: { ...s.perks, [id]: lv + 1 } });
    audio.sfx("relic");
  };

  const toTitle = () => { setModal(null); setScreen("title"); };
  const retire = () => {
    const s = saveRef.current;
    if (!s.dynasty) return;
    const dd = clone(s.dynasty);
    dd.status = "lost";
    dd.endReason = `House ${dd.house} retired from the contest.`;
    setModal(null);
    finalizeEnd(dd, false);
    setScreen("end");
  };

  return (
    <div className="h-full w-full relative bg-black text-violet-100">
      {screen === "title" && (
        <Title
          save={save}
          onContinue={() => { audio.sfx("select"); setScreen("home"); }}
          onNew={() => { audio.sfx("select"); setScreen("new"); }}
          onTutorial={() => startTutorial("title")}
          onLegacy={() => setScreen("legacy")}
          onHelp={() => setModal("help")}
          onSettings={() => setModal("settings")}
        />
      )}
      {screen === "new" && <NewDynasty marks={save.marks} onStart={startNew} onBack={() => setScreen("title")} />}
      {screen === "legacy" && <Legacy save={save} onBuy={buyPerk} onBack={() => setScreen("title")} />}
      {screen === "home" && d && <Homestead d={d} act={act} />}
      {screen === "home" && !d && <Title save={save} onContinue={() => {}} onNew={() => setScreen("new")} onTutorial={() => startTutorial("title")} onLegacy={() => setScreen("legacy")} onHelp={() => setModal("help")} onSettings={() => setModal("settings")} />}
      {screen === "run" && run && (
        <RunScreen
          key={run.key}
          cfg={run.cfg}
          startRealm={run.realm}
          tutorial={run.tutorial}
          settings={save.settings}
          onSettings={setSettings}
          onEnd={onRunEnd}
          keepPct={run.tutorial || !d ? 1 : keepRate(d)}
        />
      )}
      {screen === "report" && report && d && (
        <ReportScreen
          r={report}
          d={d}
          onContinue={() => {
            if (report.next === "end") setScreen("end");
            else if (report.next === "succession") setScreen("succession");
            else setScreen("home");
          }}
        />
      )}
      {screen === "report" && report && !d && endInfo && (
        <ReportScreen r={report} d={endInfo.d} onContinue={() => setScreen("end")} />
      )}
      {screen === "succession" && d && <SuccessionScreen d={d} onCrown={(id) => { mutate((dd) => crownHeir(dd, id)); audio.sfx("marry"); setScreen("home"); }} />}
      {screen === "end" && endInfo && (
        <EndScreen
          d={endInfo.d}
          won={endInfo.won}
          marks={endInfo.marks}
          onNew={() => setScreen("new")}
          onTitle={() => setScreen("title")}
          onContinue={endInfo.won ? () => setScreen("home") : undefined}
        />
      )}

      {modal === "settings" && <SettingsModal settings={save.settings} onChange={setSettings} onClose={() => setModal(null)} />}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "menu" && (
        <Modal title="Menu" onClose={() => setModal(null)}>
          <div className="grid gap-2">
            <p className="text-xs text-violet-300">Your dynasty saves automatically after every action.</p>
            <Btn variant="primary" onClick={toTitle}>💾 Save & Return to Title</Btn>
            <Btn onClick={() => setModal("settings")}>⚙️ Settings</Btn>
            <Btn onClick={() => setModal("help")}>❓ How to Play</Btn>
            <Btn variant="danger" onClick={() => setModal("retire")}>🏳️ Retire this Dynasty</Btn>
          </div>
        </Modal>
      )}
      {modal === "retire" && (
        <Modal title="Retire the dynasty?" onClose={() => setModal(null)}>
          <p className="mb-4 text-violet-100">The house ends here. Your achievements still earn Legacy Marks and a place in the Hall of Fame.</p>
          <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" onClick={retire}>Retire</Btn></div>
        </Modal>
      )}
      {modal === "askTut" && (
        <Modal title="Training Grounds?">
          <p className="mb-4 text-violet-100">Would you like a quick interactive tutorial before founding your dynasty? You can replay it any time from the title screen.</p>
          <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => { setModal(null); setScreen("home"); }}>Skip</Btn><Btn variant="primary" onClick={() => startTutorial("home")}>🎓 Yes, train me</Btn></div>
        </Modal>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-full bg-amber-300 text-stone-900 font-bold px-5 py-2 shadow-lg anim-pop">{toast}</div>}
    </div>
  );
}
