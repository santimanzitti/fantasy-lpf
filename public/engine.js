// Motor compartido por el sitio y los procesos del servidor: catálogo, valor inicial, puntos y sorteos.
(function (G) {
const POSN = { P: 'POR', D: 'DEF', M: 'MED', F: 'DEL' };
const POSL = { P: 'Arquero', D: 'Defensor', M: 'Mediocampista', F: 'Delantero' };
const TEAMS = G.TEAMS; const FMDATA = G.FMDATA;
const TEAM = {}; const PL = {}; const ALL = [];
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const FM = {}, FMLAST = {};
for (const line of FMDATA.split('\n')) { const [n, mi, r] = line.split(';'); if (!n) continue; const k = slug(n); const e = { k, min: +mi || 0, rt: r ? +r : null }; FM[k] = e; const last = k.split('-').pop(); (FMLAST[last] = FMLAST[last] || []).push(e); }
function fmLookup(name) {
  const k = slug(name); if (FM[k]) return FM[k];
  const t = k.split('-'); const list = FMLAST[t[t.length - 1]] || [];
  const c = list.filter(e => { const f = e.k.split('-')[0]; return f === t[0] || (f[0] === t[0][0] && list.length === 1); });
  return c.length === 1 ? c[0] : null;
}
// Valor fantasy: minutos y nota de 2026; la cotización real suma como máximo 600 mil €.
function fantasyValue(e, tm) {
  const min = e ? e.min : 0; const share = Math.min(1, min / 2700);
  const r = e && e.rt ? e.rt : (min >= 315 ? 6.55 : 6.3);
  const perf = Math.max(0, Math.min(1, (r - 6.2) / 1.4));
  const score = Math.pow(share, 1.15) * (0.3 + 0.7 * Math.pow(perf, 1.2));
  return Math.round((0.15 + 11.5 * Math.pow(score, 1.5) + Math.min(0.06 * (tm || 0), 0.6)) * 100) * 10000;
}
for (const t of TEAMS) {
  TEAM[t.id] = t;
  for (const [n, p, v] of t.players) {
    const id = t.id + '-' + slug(n); const fe = fmLookup(n);
    const pl = { id, name: n, pos: p, base: fantasyValue(fe, v), min: fe ? fe.min : 0, rt: fe ? fe.rt : null, team: t.id };
    PL[id] = pl; ALL.push(pl);
  }
}
const RULES = {
  goal: { P: 7, D: 6, M: 5, F: 4 }, assist: { P: 3, D: 3, M: 3, F: 3 },
  cleanSheet: { P: 4, D: 3, M: 1, F: 0 }, conceded: { P: 1, D: 0.5, M: 0, F: 0 },
  ratingDetailed: { P: 1.5, D: 1.5, M: 1.5, F: 1.5 }, ratingOnly: { P: 3, D: 2.5, M: 2, F: 2 },
  motm: 2, yellow: -1, red: -3, ownGoal: -2, penMissed: -2, penSaved: 5,
};
function scoreLine(pos, s, conceded) {
  const parts = []; const add = (l, v) => { if (v) parts.push([l, v]); };
  const min = +s.min || 0; if (min <= 0) return { total: 0, parts };
  const det = !!s.det;
  add(min >= 60 ? `Jugó ${min}'` : `Entró ${min}'`, min >= 60 ? 2 : 1);
  if (s.g) add(s.g > 1 ? `${s.g} goles` : 'Gol', s.g * RULES.goal[pos]);
  if (s.a) add(s.a > 1 ? `${s.a} asistencias` : 'Asistencia', s.a * RULES.assist[pos]);
  if (min >= 60 && conceded === 0) add('Valla invicta', RULES.cleanSheet[pos]);
  if (min >= 60 && conceded > 0) add(`${conceded} gol${conceded > 1 ? 'es' : ''} recibido${conceded > 1 ? 's' : ''}`, -Math.floor(conceded * RULES.conceded[pos]));
  if (det) {
    const def = (+s.tkl || 0) + (+s.int || 0);
    if (pos === 'P') add(`${s.sv || 0} atajadas`, Math.floor((+s.sv || 0) / 2));
    if (pos === 'D') { add(`${s.clr || 0} despejes`, Math.floor((+s.clr || 0) / 3)); add(`${def} quites e intercepciones`, Math.floor(def / 3)); }
    if (pos === 'M') { add(`${s.kp || 0} pases clave`, Math.floor((+s.kp || 0) / 2)); add(`${def} quites e intercepciones`, Math.floor(def / 3)); add(`${s.sot || 0} tiros al arco`, Math.floor((+s.sot || 0) / 2)); }
    if (pos === 'F') { add(`${s.sot || 0} tiros al arco`, Math.floor((+s.sot || 0) / 2)); add(`${s.kp || 0} pases clave`, Math.floor((+s.kp || 0) / 2)); add(`${s.drb || 0} gambetas`, Math.floor((+s.drb || 0) / 3)); }
  }
  if (s.r && min >= 10) { const k = (det ? RULES.ratingDetailed : RULES.ratingOnly)[pos]; add(`Valoración ${(+s.r).toFixed(1).replace('.', ',')}`, Math.max(-4, Math.min(6, Math.round((s.r - 6.5) * k)))); }
  if (s.motm) add('Figura del partido', RULES.motm);
  if (s.yc) add('Amarilla', RULES.yellow * s.yc);
  if (s.rc) add('Roja', RULES.red * s.rc);
  if (s.og) add('Gol en contra', RULES.ownGoal * s.og);
  if (s.pkm) add('Penal errado', RULES.penMissed * s.pkm);
  if (s.pks) add('Penal atajado', RULES.penSaved * s.pks);
  return { total: parts.reduce((a, [, v]) => a + v, 0), parts };
}
const FMPOS = { GK: 'P', DF: 'D', MF: 'M', FW: 'F' };
let byTeam = null;
function teamIndex() { if (byTeam) return byTeam; byTeam = {}; for (const p of ALL) (byTeam[p.team] = byTeam[p.team] || []).push(p); return byTeam; }
function resolvePlayer(team, name, fpos) {
  if (!TEAM[team] || !name) return null;
  const sn = slug(name); const exact = team + '-' + sn; if (PL[exact]) return exact;
  const tk = sn.split('-'); const last = tk[tk.length - 1];
  const list = teamIndex()[team] || [];
  const cand = list.filter(p => { const pt = slug(p.name).split('-'); const pl = pt[pt.length - 1]; return (pl === last || tk.includes(pl) || pt.includes(last)) && (pt[0] === tk[0] || pt[0][0] === tk[0][0]); });
  if (cand.length === 1) return cand[0].id;
  const fe = fmLookup(name);
  const pl = { id: exact, name, pos: FMPOS[fpos] || 'M', base: fantasyValue(fe, 0), min: fe ? fe.min : 0, rt: fe ? fe.rt : null, team, extra: true };
  PL[exact] = pl; ALL.push(pl); byTeam = null; return exact;
}
function computePoints(stats) {
  const ptsByRound = {}, seasonPts = {}, playerLog = {};
  for (const d of Object.values(stats).sort((a, b) => (a.ko || 0) - (b.ko || 0))) {
    for (const s of (d.players || [])) {
      const pid = resolvePlayer(s.t, s.n, s.pos); if (!pid) continue;
      const own = s.t === d.h ? d.hs : d.as_; const opp = s.t === d.h ? d.as_ : d.hs;
      const sc = scoreLine(PL[pid].pos, s, opp);
      const R = (ptsByRound[d.r] = ptsByRound[d.r] || {}); R[pid] = (R[pid] || 0) + sc.total;
      seasonPts[pid] = (seasonPts[pid] || 0) + sc.total;
      (playerLog[pid] = playerLog[pid] || []).push({ mid: d.id, r: d.r, opp: s.t === d.h ? d.a : d.h, gf: own, ga: opp, ...sc, ts: d.ts || 0 });
    }
  }
  return { ptsByRound, seasonPts, playerLog };
}
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pushLog = (st, x) => { st.log = (st.log || []).concat([{ t: Date.now(), x }]).slice(-60); };
function genMarket(own, n, P) {
  const free = ALL.filter(p => !own[p.id]); const out = new Set(); let guard = 0;
  while (out.size < Math.min(n, free.length) && guard++ < 5000) { const c = pick(free); if (Math.random() < 0.35 + Math.min(0.65, Math.sqrt(P(c.id) / 4e6))) out.add(c.id); }
  return [...out];
}
function randomSquad(own, exclude, P) {
  const need = { P: 2, D: 5, M: 5, F: 3 }; let best = null;
  for (let tries = 0; tries < 80; tries++) {
    const sq = []; let total = 0, stars = 0, ok = true;
    for (const [pos, n] of Object.entries(need)) {
      const pool = ALL.filter(p => p.pos === pos && !own[p.id] && !exclude.has(p.id));
      for (let k = 0; k < n; k++) {
        const cands = pool.filter(p => !sq.includes(p.id) && (stars < 1 || P(p.id) <= 3e6));
        if (!cands.length) { ok = false; break; }
        const c = pick(cands); sq.push(c.id); total += P(c.id); if (P(c.id) > 3e6) stars++;
      }
    }
    if (!ok) continue;
    if (total >= 12e6 && total <= 22e6) return sq;
    if (!best || Math.abs(total - 17e6) < Math.abs(best.t - 17e6)) best = { sq, t: total };
  }
  return best ? best.sq : [];
}

// Próximo cierre de mercado: todos los días a las 20:00 de Argentina (23:00 UTC).
function nextClose(now = Date.now()) { const d = new Date(now); d.setUTCHours(23, 0, 0, 0); if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); }
G.ENGINE = { POSN, POSL, TEAMS, TEAM, PL, ALL, slug, fmLookup, fantasyValue, RULES, scoreLine, resolvePlayer, computePoints, genMarket, randomSquad, pick, nextClose };
})(typeof window !== 'undefined' ? window : globalThis);
