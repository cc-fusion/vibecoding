function renderOps() {
  const pane = $('#pane-ops');
  const S = SCENARIOS[G.scn];
  const pols = [
    { id: 'random', name: 'Random', ok: true, desc: 'Free default. Pods hold random SKUs.' },
    { id: 'velocity', name: 'Velocity', ok: perk('slot_velocity'), desc: 'Fast movers go nearest stations: shorter trips.' },
    { id: 'zoned', name: 'Zoned', ok: perk('slot_zoned'), desc: 'Families grouped along aisles: fewer long crossings.' }
  ];
  const cur = G.pendingPolicy || G.policy;
  const key = [cur, G.trafficAI, G.chargers.length, G.docks.length, G.repairs.length, G.techs.length, G.stations.length,
    perk('slot_velocity'), perk('slot_zoned'), G.gridCap, G.scn].join('|');
  if (pane._key !== key) {
    pane._key = key;
    const polHTML = pols.map(p => '<button data-policy="' + p.id + '" class="' + (cur === p.id ? 'on' : '') + '" ' + (p.ok ? '' : 'disabled') + ' title="' + esc(p.desc) + '">' + (p.ok ? '' : '🔒 ') + p.name + '</button>').join('');
    pane.innerHTML =
      '<div class="panel" style="padding:10px 12px">' +
      '<div class="row"><b>On-time fill</b><span class="spacer"></span><b data-v="fill"></b><span class="muted small" data-v="fillT"></span></div>' +
      '<div class="mini" style="height:9px"><i data-v="fillBar" style="width:0%;background:linear-gradient(90deg,#38bdf8,#34d399)"></i></div>' +
      '<div class="small muted" style="margin-top:6px" data-v="burn"></div></div>' +
      '<h3>Slotting policy</h3><div class="row" style="gap:6px">' + polHTML + '</div>' +
      '<div class="small muted" style="margin-top:4px">' + esc(pols.find(p => p.id === cur).desc) + ' Applies overnight at the next shift start.</div>' +
      '<h3>Maintenance</h3>' +
      '<div class="field"><label class="small">Service robots above <b data-v="pmVal">' + G.pmThreshold + '%</b> wear</label><input type="range" min="40" max="95" step="5" value="' + G.pmThreshold + '" data-slider="pm"></div>' +
      '<div class="small muted">Lower = fewer breakdowns, more robots in the bay. Higher = more breakdowns in the aisles.</div>' +
      '<h3>Charging</h3>' +
      '<div class="field"><label class="small">Idle robots charge below <b data-v="chVal">' + G.chargeAt + '%</b></label><input type="range" min="10" max="60" step="5" value="' + G.chargeAt + '" data-slider="charge"></div>' +
      '<div class="small muted" data-v="power"></div>' +
      '<h3>Crew</h3>' +
      '<div class="row"><button data-act="crew">Crew handover ($150)</button></div>' +
      '<div class="small muted">Resets picker fatigue but pauses picking for 4 minutes. Fatigue slows stations and backs robots up.</div>' +
      '<h3>Traffic</h3>' +
      '<div class="small" data-v="traffic"></div>' +
      '<h3>Floor stats</h3>' +
      '<table class="kv">' +
      '<tr><td>Pods</td><td data-v="pods"></td></tr>' +
      '<tr><td>Stations / chargers / docks / bays</td><td data-v="fac"></td></tr>' +
      '<tr><td>Technicians</td><td data-v="tech"></td></tr>' +
      '<tr><td>Deadlocks this shift</td><td data-v="dl"></td></tr>' +
      '<tr><td>Breakdowns this shift</td><td data-v="fails"></td></tr>' +
      '<tr><td>Revenue this shift</td><td class="good" data-v="rev"></td></tr></table>';
  }
  const q = k => pane.querySelector('[data-v="' + k + '"]');
  const put = (k, v) => { const el = q(k); if (el && el.textContent !== String(v)) el.textContent = v; };
  const f = computeFill(G), tgt = shiftTarget(G);
  const working = G.robots.filter(r => r.state !== 'idle' && r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'charging').length;
  const burn = S.rent + G.stations.reduce((a, s) => a + s.workers, 0) * PICKER_WAGE + G.techs.length * TECH_WAGE + G.robots.length * ROBOT_UPKEEP;
  put('fill', pct(f.fill));
  put('fillT', '/ ' + pct(tgt));
  const fb = q('fillBar'); if (fb) { fb.style.width = clamp(f.fill * 100, 0, 100) + '%'; fb.style.background = f.fill >= tgt ? 'linear-gradient(90deg,#34d399,#22c55e)' : 'linear-gradient(90deg,#38bdf8,#fbbf24)'; }
  put('burn', 'Burn rate ' + money(-burn) + '/min · Working ' + working + '/' + G.robots.length);
  put('power', 'Chargers: ' + G.chargers.length + ' · full-rate slots: ' + G.gridCap + ' · live scale ' + Math.round(G.chargeScale * 100) + '%' + (G.t < G.brownUntil ? ' (brownout)' : ''));
  put('traffic', G.trafficAI ? 'Traffic Control AI online: deadlocks clear instantly; routes avoid busy aisles.' : 'Manual traffic: deadlocks clear after ~2.5 minutes. Buy Traffic Control AI in the shop.');
  put('pods', G.shelves.filter(s => s).length);
  put('fac', G.stations.length + ' / ' + G.chargers.length + ' / ' + G.docks.length + ' / ' + G.repairs.length);
  put('tech', G.techs.length + (G.techs.some(t => t.busy >= 0) ? ' (busy)' : ' (free)'));
  put('dl', G.stat.deadlocks);
  put('fails', G.stat.fails);
  put('rev', money(G.stat.revenue));
  const crew = pane.querySelector('[data-act="crew"]'); if (crew) crew.disabled = G.cash < 150;
  const pmv = q('pmVal'); if (pmv) pmv.textContent = G.pmThreshold + '%';
  const chv = q('chVal'); if (chv) chv.textContent = G.chargeAt + '%';
}
function renderFleet() {
  const pane = $('#pane-fleet');
  const key = G.robots.map(r => r.id).join(',');
  if (pane._key !== key) {
    pane._key = key;
    pane.innerHTML = '<div class="small muted" style="margin-bottom:8px">Click a robot to inspect and focus the camera.</div>' +
      G.robots.map(r => '<div class="fleet-item" data-robot="' + r.id + '"><span class="dot"></span><div>' +
        '<div class="row" style="gap:6px"><b>' + robotName(r) + '</b><span class="small muted f-state"></span></div>' +
        '<div class="mini"><i class="f-bat"></i></div><div class="mini"><i class="f-wear"></i></div></div>' +
        '<div class="small muted f-num" style="text-align:right"></div></div>').join('');
  }
  const rows = $$('[data-robot]', pane);
  rows.forEach((row, i) => {
    const r = G.robots[i]; if (!r) return;
    row.classList.toggle('sel', !!(UI.selected && UI.selected.kind === 'robot' && UI.selected.id === r.id));
    const dot = row.querySelector('.dot'); if (dot) dot.style.background = STATE_COLOR[r.state] || '#94a3b8';
    const st = row.querySelector('.f-state'); const stxt = STATE_LABEL[r.state] || r.state; if (st.textContent !== stxt) st.textContent = stxt;
    const bat = row.querySelector('.f-bat'); bat.style.width = clamp(r.battery, 0, 100) + '%'; bat.style.background = r.battery < 25 ? '#f87171' : '#34d399';
    const wr = row.querySelector('.f-wear'); wr.style.width = clamp(r.wear, 0, 100) + '%'; wr.style.background = r.wear >= G.pmThreshold ? '#f87171' : '#fbbf24';
    const num = row.querySelector('.f-num'); const ntxt = Math.round(r.battery) + '%<br>' + Math.round(r.wear) + '%';
    if (num.innerHTML !== ntxt) num.innerHTML = ntxt;
  });
}
