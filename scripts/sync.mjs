// Sincroniza calendario y estadísticas de la Liga Profesional desde FotMob hacia Firestore.
// Corre en GitHub Actions cada 15 minutos (ver .github/workflows/estadisticas.yml).
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const DATABASE_ID = process.env.FIRESTORE_DATABASE || 'default'; // la base del proyecto se llama "default"
const db = getFirestore(admin.app(), DATABASE_ID);
const gha = !!process.env.GITHUB_ACTIONS;
const note = m => console.log((gha ? '::notice::' : '') + m);
const warn = m => console.log((gha ? '::warning::' : '') + m);

const LEAGUE_ID = 112; // Liga Profesional Argentina en FotMob
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TEAM_IDS = { 10076: 'riv', 10077: 'boc', 10078: 'ind', 10079: 'vel', 10080: 'rac', 10081: 'hur', 10082: 'lan', 10083: 'slo', 10084: 'rco', 10086: 'arg', 10087: 'ban', 10089: 'pla', 10090: 'ins', 10096: 'uni' };
const TEAM_NAMES = {
  'river-plate': 'riv', 'boca-juniors': 'boc', 'racing-club': 'rac', 'independiente': 'ind', 'san-lorenzo': 'slo', 'estudiantes': 'est', 'estudiantes-de-la-plata': 'est',
  'gimnasia-lp': 'gim', 'gimnasia-la-plata': 'gim', 'gimnasia-y-esgrima-la-plata': 'gim', 'talleres': 'tal', 'talleres-de-cordoba': 'tal', 'belgrano': 'bel', 'rosario-central': 'rco',
  'newell-s-old-boys': 'nob', 'newells-old-boys': 'nob', 'velez-sarsfield': 'vel', 'lanus': 'lan', 'argentinos-juniors': 'arg', 'huracan': 'hur', 'defensa-y-justicia': 'dyj',
  'club-atletico-platense': 'pla', 'platense': 'pla', 'barracas-central': 'bar', 'tigre': 'tig', 'union': 'uni', 'union-santa-fe': 'uni', 'instituto': 'ins',
  'independiente-rivadavia': 'irv', 'atletico-tucuman': 'atu', 'banfield': 'ban', 'sarmiento': 'sar', 'central-cordoba-de-santiago': 'ccb', 'central-cordoba': 'ccb',
  'deportivo-riestra': 'rie', 'aldosivi': 'ald', 'gimnasia-mendoza': 'gme', 'gimnasia-y-esgrima-de-mendoza': 'gme', 'estudiantes-de-rio-cuarto': 'erc',
};
const teamCode = (id, name) => TEAM_IDS[id] || TEAM_NAMES[slug(name)] || null;

async function nextData(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  const html = await r.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`Sin __NEXT_DATA__ en ${url}`);
  return JSON.parse(m[1]);
}
// Busca en profundidad el primer objeto que cumpla una condición.
function find(o, pred, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 12) return null;
  if (pred(o)) return o;
  for (const v of Object.values(o)) { const r = find(v, pred, depth + 1); if (r) return r; }
  return null;
}
function findAll(o, pred, out = [], depth = 0) {
  if (!o || typeof o !== 'object' || depth > 14) return out;
  if (pred(o)) out.push(o);
  for (const v of Object.values(o)) findAll(v, pred, out, depth + 1);
  return out;
}
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return Number.isFinite(n) ? n : 0; };

// ---------- Calendario ----------
async function discoverFixtures() {
  const nd = await nextData(`https://www.fotmob.com/leagues/${LEAGUE_ID}/fixtures/liga-profesional`);
  const ms = findAll(nd, o => o && o.home && o.away && o.status && (o.id || o.matchId) && (o.home.id || o.home.name));
  const out = {};
  const now = Date.now();
  for (const m of ms) {
    const k = Date.parse(m.status.utcTime || m.utcTime || m.time || '') || null;
    if (k && (k < now - 40 * 864e5 || k > now + 120 * 864e5)) continue;
    const h = teamCode(m.home.id, m.home.name), a = teamCode(m.away.id, m.away.name);
    if (!h || !a) continue;
    const r = parseInt(m.round ?? m.roundName ?? m.matchRound, 10) || null;
    out[String(m.id || m.matchId)] = { r, h, a, k, st: m.status.finished ? 'done?' : m.status.cancelled ? 'post' : m.status.started ? 'live' : 'pend' };
  }
  return out;
}

// ---------- Partido ----------
const POS_FROM_ID = { 0: 'GK', 1: 'DF', 2: 'MF', 3: 'FW' };
function posOf(p) {
  if (p.isGoalkeeper) return 'GK';
  for (const k of ['usualPlayingPositionId', 'positionId', 'usualPosition']) if (p[k] !== undefined && POS_FROM_ID[p[k]]) return POS_FROM_ID[p[k]];
  const role = slug(p.role || p.position || p.positionStringShort || '');
  if (/keeper|^gk/.test(role)) return 'GK'; if (/def|back|^cb|^lb|^rb/.test(role)) return 'DF'; if (/mid|^cm|^dm|^am/.test(role)) return 'MF'; if (/att|forw|wing|strik|^st|^fw/.test(role)) return 'FW';
  return null;
}
function flattenStats(p) {
  const out = {};
  for (const g of (Array.isArray(p.stats) ? p.stats : [])) {
    const entries = g && g.stats ? (Array.isArray(g.stats) ? g.stats.map(x => [x.title || x.key, x]) : Object.entries(g.stats)) : [];
    for (const [title, obj] of entries) {
      const v = obj?.stat?.value ?? obj?.value; if (v === undefined || v === null) continue;
      out[slug(title)] = v; if (obj?.key) out[slug(obj.key)] = v;
    }
  }
  return out;
}
const pickStat = (f, ...keys) => { for (const k of keys) if (f[k] !== undefined) return num(f[k]); return 0; };

async function readMatch(id) {
  const nd = await nextData(`https://www.fotmob.com/match/${id}`);
  const root = find(nd, o => o.general && o.header && o.content);
  if (!root) throw new Error('Formato de FotMob desconocido');
  const g = root.general, hd = root.header, ct = root.content;
  const leagueOk = [g.leagueId, g.parentLeagueId].map(Number).includes(LEAGUE_ID);
  const home = g.homeTeam || hd.teams?.[0], away = g.awayTeam || hd.teams?.[1];
  const h = teamCode(home?.id, home?.name), a = teamCode(away?.id, away?.name);
  const status = hd.status || {};
  const k = Date.parse(status.utcTime || g.matchTimeUTCDate || g.matchTimeUTC || '') || null;
  const r = parseInt(g.matchRound, 10) || null;
  const finished = !!(status.finished ?? g.finished);
  const st = status.cancelled ? 'post' : finished ? 'done' : (status.started ?? g.started) ? 'live' : 'pend';
  const base = { leagueOk, h, a, k, r, st };
  if (st !== 'done') return base;
  const hs = num(hd.teams?.[0]?.score), as_ = num(hd.teams?.[1]?.score);

  // Posiciones desde la formación
  const posById = {};
  for (const p of findAll(ct.lineup || {}, o => o && (o.id || o.playerId) && (o.positionId !== undefined || o.usualPlayingPositionId !== undefined || o.role || o.isGoalkeeper !== undefined))) {
    const ps = posOf(p); if (ps) posById[String(p.id || p.playerId)] = ps;
  }
  // Eventos: tarjetas, goles en contra, penales errados
  const ev = {};
  const bump = (pid, key) => { if (!pid) return; const e = (ev[pid] = ev[pid] || {}); e[key] = (e[key] || 0) + 1; };
  for (const e of findAll(ct.matchFacts?.events || {}, o => o && o.type && (o.player || o.playerId))) {
    if (e.isPenaltyShootoutEvent) continue;
    const pid = String(e.playerId || e.player?.id || '');
    if (e.type === 'Card') { const c = slug(e.card || ''); if (c === 'yellow') bump(pid, 'yc'); else if (c === 'red') bump(pid, 'rc'); else if (c.includes('yellowred') || c.includes('second')) bump(pid, 'yr'); }
    if (e.type === 'Goal' && e.ownGoal) bump(pid, 'og');
    if (/missedpenalty/i.test(e.type) || (e.type === 'Goal' && e.isPenalty && e.isMissed)) bump(pid, 'pkm');
  }
  const motm = String(ct.matchFacts?.playerOfTheMatch?.id || '');

  const players = [];
  const ps = ct.playerStats && typeof ct.playerStats === 'object' ? Object.entries(ct.playerStats) : [];
  for (const [pidRaw, p] of ps) {
    const pid = String(p.id || pidRaw); const f = flattenStats(p);
    const min = pickStat(f, 'minutes-played', 'minutes_played'.replace('_', '-'));
    if (!min) continue;
    const t = TEAM_IDS[p.teamId] || (p.teamId === home?.id ? h : p.teamId === away?.id ? a : null) || teamCode(p.teamId, p.teamName);
    if (!t) continue;
    const e = ev[pid] || {};
    const s = { n: p.name?.fullName || p.name, t, pos: p.isGoalkeeper ? 'GK' : (posById[pid] || 'MF'), min: Math.round(min), det: 1,
      g: pickStat(f, 'goals'), a: pickStat(f, 'assists'), r: pickStat(f, 'fotmob-rating', 'rating-title', 'rating'),
      sv: pickStat(f, 'saves'), clr: pickStat(f, 'clearances'), tkl: pickStat(f, 'tackles-won', 'matchstats-headers-tackles', 'tackles'),
      int: pickStat(f, 'interceptions'), kp: pickStat(f, 'chances-created', 'key-passes'), sot: pickStat(f, 'shots-on-target', 'shotsontarget'),
      drb: pickStat(f, 'successful-dribbles', 'dribbles-succeeded', 'dribbles-successful'), pks: pickStat(f, 'penalties-saved', 'saved-penalties'),
      yc: e.yr ? 0 : (e.yc || 0), rc: e.rc || e.yr ? 1 : 0, og: e.og || 0, pkm: e.pkm || 0, motm: pid === motm ? 1 : 0 };
    for (const key of Object.keys(s)) if (s[key] === 0 && key !== 'min') delete s[key];
    if (s.r) s.r = Math.round(s.r * 100) / 100;
    players.push(s);
  }
  // Respaldo si FotMob no trae playerStats: valoración y minutos desde la formación
  if (!players.length) {
    for (const side of [['homeTeam', h], ['awayTeam', a]]) {
      const tm = ct.lineup?.[side[0]]; if (!tm) continue;
      for (const [list, starter] of [[tm.starters || [], true], [tm.subs || [], false]]) for (const p of list) {
        const subs = p.performance?.substitutionEvents || [];
        const out = subs.find(x => x.type === 'subOut'), inn = subs.find(x => x.type === 'subIn');
        const min = starter ? (out ? out.time : 90) : (inn ? Math.max(1, 90 - inn.time) : 0);
        if (!min) continue; const pid = String(p.id); const e = ev[pid] || {};
        const s = { n: p.name, t: side[1], pos: posOf(p) || 'MF', min, g: p.performance?.goals || 0, a: p.performance?.assists || 0, r: num(p.performance?.rating), yc: e.yr ? 0 : (e.yc || 0), rc: e.rc || e.yr ? 1 : 0, og: e.og || 0, pkm: e.pkm || 0, motm: pid === motm ? 1 : 0 };
        for (const key of Object.keys(s)) if (s[key] === 0 && key !== 'min') delete s[key];
        players.push(s);
      }
    }
  }
  return { ...base, hs, as_, players, det: ps.length > 0 };
}

// ---------- Corrida ----------
async function main() {
  note(`Proyecto de la clave: ${sa.project_id} · cuenta: ${sa.client_email}`);
const calRef = db.doc('meta/calendar');
const snap = await calRef.get();
let cal = snap.exists ? snap.data() : JSON.parse(readFileSync(new URL('./calendar-seed.json', import.meta.url))).valueOf();
cal.matches = cal.matches || {};
const now = Date.now();
let changed = !snap.exists;

if (!cal.lastScan || now - cal.lastScan > 6 * 3600e3) {
  try {
    const found = await discoverFixtures();
    for (const [id, m] of Object.entries(found)) {
      const cur = cal.matches[id];
      if (!cur) cal.matches[id] = { ...m, st: m.st === 'done?' ? 'pend' : m.st };
      else if (cur.st !== 'done') { cal.matches[id] = { ...cur, k: m.k || cur.k, r: cur.r || m.r, h: cur.h || m.h, a: cur.a || m.a }; }
    }
    note(`Calendario: ${Object.keys(found).length} partidos encontrados en FotMob.`);
  } catch (e) { warn('No se pudo leer el fixture de la liga: ' + e.message); }
  cal.lastScan = now; changed = true;
}

const cand = Object.entries(cal.matches)
  .filter(([, m]) => (m.st !== 'done' && (!m.k || now >= m.k + 100 * 60e3) && (m.st !== 'post' || now - (m.chk || 0) > 24 * 3600e3))
    || (m.st === 'done' && !m.final && now - (m.done || 0) > 12 * 3600e3))
  .sort((x, y) => (x[1].k || 0) - (y[1].k || 0)).slice(0, 20);

for (const [id, m] of cand) {
  try {
    const d = await readMatch(id);
    if (d.leagueOk === false && d.r === null) { delete cal.matches[id]; changed = true; note(`${id}: no es de la Liga Profesional, se quita.`); continue; }
    const wasDone = m.st === 'done';
    cal.matches[id] = { ...m, r: m.r || d.r, h: m.h || d.h, a: m.a || d.a, k: d.k || m.k, st: d.st, chk: now };
    if (d.st === 'done') {
      cal.matches[id].done = m.done || now; if (wasDone) cal.matches[id].final = true;
      await db.doc(`stats/m${id}`).set({ id: +id, r: cal.matches[id].r, h: cal.matches[id].h, a: cal.matches[id].a, hs: d.hs, as_: d.as_, ko: cal.matches[id].k, ts: wasDone ? (m.ts || now) : now, src: 'fotmob', det: d.det, players: d.players });
      if (!wasDone) cal.matches[id].ts = now;
      note(`${id}: ${d.h} ${d.hs}-${d.as_} ${d.a} · ${d.players.length} jugadores${d.det ? ' con estadísticas detalladas' : ' (solo valoración)'}.`);
    } else note(`${id}: estado ${d.st}.`);
    changed = true;
  } catch (e) { warn(`${id}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 1500));
}

// Inicio de cada fecha = primer partido no postergado. Las reglas de seguridad lo usan para bloquear el 11.
const rounds = {};
for (const m of Object.values(cal.matches)) if (m.r && m.k && m.st !== 'post') rounds[m.r] = Math.min(rounds[m.r] || Infinity, m.k);
// Partidos reprogramados de una fecha vieja no reabren esa fecha: una fecha arranca a más tardar cuando arranca alguna posterior.
{ let lo = Infinity; for (const r of Object.keys(rounds).map(Number).sort((a, b) => b - a)) { lo = Math.min(lo, rounds[r]); rounds[r] = lo; } }
if (JSON.stringify(rounds) !== JSON.stringify(cal.rounds || {})) { cal.rounds = rounds; changed = true; }
const prox = Object.entries(rounds).filter(([, k]) => k > now).sort((a, b) => a[1] - b[1]).slice(0, 2);
if (prox.length) note('Próximos cierres de 11: ' + prox.map(([r, k]) => `fecha ${r} ${new Date(k - 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} (hora Argentina)`).join(' · '));
if (changed) { cal.updated = now; await calRef.set(cal); }
note(`Listo. ${cand.length} partidos revisados. Calendario con ${Object.keys(cal.matches).length} partidos.`);
}
try { await main(); process.exit(0); }
catch (e) {
  console.log((gha ? '::error::' : '') + 'La sincronización falló: ' + (e && (e.details || e.message) || e));
  try {
    const tok = await admin.credential.cert(sa).getAccessToken();
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases`, { headers: { authorization: 'Bearer ' + tok.access_token } });
    const j = await r.json();
    note('Bases de Firestore en el proyecto: ' + JSON.stringify((j.databases || []).map(d => ({ name: d.name.split('/').pop(), type: d.type, location: d.locationId }))) + (j.error ? ' · error: ' + j.error.message : ''));
  } catch (e2) { warn('No se pudieron listar las bases: ' + e2.message); }
  process.exit(1);
}
