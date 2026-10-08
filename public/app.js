// Fantasy LPF · sitio público (Firebase Auth + Firestore)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, runTransaction, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ===================== Catálogo =====================
const POSN = { P: 'POR', D: 'DEF', M: 'MED', F: 'DEL' };
const POSL = { P: 'Arquero', D: 'Defensor', M: 'Mediocampista', F: 'Delantero' };
const TEAMS = window.TEAMS; const FMDATA = window.FMDATA;
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
const FORMATIONS = { '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2], '3-4-3': [3, 4, 3], '3-5-2': [3, 5, 2], '4-5-1': [4, 5, 1], '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1] };
function slotsFor(f) { const [d, m, a] = FORMATIONS[f] || FORMATIONS['4-3-3']; return ['P', ...Array(d).fill('D'), ...Array(m).fill('M'), ...Array(a).fill('F')]; }
const DEFAULTS = { auto: true, minManagers: 2, intervalHours: 24, startCash: 10000000, marketSize: 14, maxManagers: 16 };

// ===================== Firebase =====================
const cfg = window.FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).includes('COMPLETAR');
let auth = null, fdb = null;
if (configured) { const app = initializeApp(cfg); auth = getAuth(app); fdb = getFirestore(app, cfg.databaseId || '(default)'); }

// ===================== Estado =====================
let me = null, meUser = null, authReady = false;
let route = { name: 'home' };
let myLeagues = [], myLeaguesLoaded = false;
let league = null, leagueId = null, members = {}, bids = {};
let stats = {}, calendar = null;
let unsubs = [];
let tab = 'equipo';
try { const t = localStorage.getItem('fla-tab'); if (t) tab = t; } catch (e) {}
let modal = null;
const ui = { q: '', club: '', pos: '', sort: 'val', limit: 60, mpos: '', valQ: '', round: null };

const settings = () => ({ ...DEFAULTS, ...(league?.settings || {}) });
const state = () => league?.state || null;
const price = id => (state()?.prices?.[id]) || PL[id].base;
const prevPrice = id => (state()?.prev?.[id]) || price(id);
const trend = id => { const p = price(id), q = prevPrice(id); return q ? (p - q) / q : 0; };
const myDoc = () => (me && members[me]) || null;
const myBids = () => { const b = bids[me]; return b && state() && b.round === state().round ? (b.bids || {}) : {}; };
const owners = () => league?.owned || {};
const isOwner = () => league && me && league.owner === me;
function teamValue(m) { return (m.squad || []).reduce((s, pid) => s + (PL[pid] ? price(pid) : 0), 0); }

// ===================== Formato =====================
const nf = new Intl.NumberFormat('es-AR');
function fmtM(v) { if (v >= 1e6) return (v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' M€'; return Math.round(v / 1e3) + ' mil €'; }
const fmtFull = v => nf.format(Math.round(v)) + ' €';
function fmtPct(x) { if (Math.abs(x) < 0.0005) return '='; return (x > 0 ? '▲ ' : '▼ ') + Math.abs(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%'; }
const tcls = x => Math.abs(x) < 0.0005 ? 'flat' : x > 0 ? 'up' : 'down';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(t) { const s = (Date.now() - t) / 1000; if (s < 60) return 'recién'; if (s < 3600) return Math.floor(s / 60) + ' min'; if (s < 86400) return Math.floor(s / 3600) + ' h'; return Math.floor(s / 86400) + ' d'; }
function shortName(n) { const p = n.split(' '); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; }

// ===================== Escudos y camisetas =====================
function pattern(t, w, h) {
  const { c2, style } = t;
  if (style === 'stripes') { let r = ''; for (let x = w / 8; x < w; x += w / 4) r += `<rect x="${x}" y="0" width="${w / 8}" height="${h}" fill="${c2}"/>`; return r; }
  if (style === 'sash') return `<polygon points="0,${h * .62} 0,${h * .84} ${w},${h * .2} ${w},0" fill="${c2}"/>`;
  if (style === 'band') return `<rect x="0" y="${h * .36}" width="${w}" height="${h * .24}" fill="${c2}"/>`;
  if (style === 'halves') return `<rect x="${w / 2}" y="0" width="${w / 2}" height="${h}" fill="${c2}"/>`;
  if (style === 'chevron') return `<path d="M0 ${h * .12} L${w / 2} ${h * .58} L${w} ${h * .12}" stroke="${c2}" stroke-width="${w * .16}" fill="none"/>`;
  return '';
}
function crest(tid, cls = 'crest') {
  const t = TEAM[tid]; if (!t) return '';
  return `<svg class="${cls}" viewBox="0 0 40 46" aria-label="${esc(t.name)}" role="img"><defs><clipPath id="cc-${t.id}"><path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z"/></clipPath></defs><g clip-path="url(#cc-${t.id})"><rect width="40" height="46" fill="${t.c1}"/>${pattern(t, 40, 46)}</g><path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><text x="20" y="28" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="11" fill="${t.txt}" stroke="rgba(0,0,0,.25)" stroke-width=".6" paint-order="stroke">${t.short}</text></svg>`;
}
const SHIRT = 'M12 3 L3 9 L7 18 L11 16 V41 H29 V16 L33 18 L37 9 L28 3 C26 7 14 7 12 3Z';
function shirt(tid, empty = false) {
  if (empty || !tid) return `<svg class="shirt" viewBox="0 0 40 44"><path d="${SHIRT}" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.6)" stroke-dasharray="3 2"/><text x="20" y="31" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="13" fill="#fff">+</text></svg>`;
  const t = TEAM[tid];
  return `<svg class="shirt" viewBox="0 0 40 44"><defs><clipPath id="sh-${t.id}"><path d="${SHIRT}"/></clipPath></defs><g clip-path="url(#sh-${t.id})"><rect width="40" height="44" fill="${t.c1}"/>${pattern(t, 40, 44)}</g><path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="1"/></svg>`;
}
const posTag = p => `<span class="pos pos-${p}">${POSN[p]}</span>`;

// ===================== Puntos automáticos =====================
// Con estadísticas detalladas (atajadas, despejes, quites, pases clave, tiros, regates) cada puesto suma por lo suyo.
// Si un partido no trae el detalle, la valoración del partido pesa más para cubrir esa parte.
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
let ptsByRound = {}, seasonPts = {}, playerLog = {};
function computePoints() {
  ptsByRound = {}; seasonPts = {}; playerLog = {};
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
}
function roundsInfo() {
  const ms = calendar?.matches ? Object.entries(calendar.matches).map(([id, m]) => ({ id, ...m })) : [];
  const R = {};
  for (const m of ms) { const r = (R[m.r] = R[m.r] || { r: m.r, list: [], first: Infinity }); r.list.push(m); if (m.k) r.first = Math.min(r.first, m.k); }
  return Object.values(R).sort((a, b) => a.r - b.r);
}
function openFecha() { const rs = roundsInfo(); const now = Date.now(); const nx = rs.find(r => r.first > now && r.list.some(m => m.st !== 'done')); return nx ? nx.r : (rs.length ? rs[rs.length - 1].r + 1 : 1); }
function liveFecha() { const rs = roundsInfo(); const now = Date.now(); const started = rs.filter(r => r.first <= now); const cur = started.slice().reverse().find(r => r.list.some(m => m.st !== 'done' && m.st !== 'post')); return cur ? cur.r : (started.length ? started[started.length - 1].r : openFecha()); }

// ===================== UI básica =====================
const $ = s => document.querySelector(s);
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3400); }
let renderQ = false;
function render() { if (renderQ) return; renderQ = true; requestAnimationFrame(() => { renderQ = false; doRender(); }); }
const GOOGLE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

function doRender() {
  const v = $('#view');
  const inLeague = route.name === 'league' && league;
  const m = inLeague ? myDoc() : null;
  $('#tabs').hidden = !(inLeague && m);
  $('#wallet').hidden = !m;
  $('#teamname').textContent = inLeague ? `${league.name}${m ? ' · ' + m.name : ''}` : (meUser ? (meUser.displayName || '') : '');
  if (m) { $('#w-cash').textContent = fmtM(m.cash || 0); $('#w-val').textContent = fmtM(teamValue(m)); }
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  $('#tab-mercado').classList.toggle('dot', Object.keys(myBids()).length > 0);
  if (!configured) { v.innerHTML = `<div class="panel pad"><b>Falta configurar Firebase.</b><p class="muted small">Completá <code>public/firebase-config.js</code> con la configuración de tu proyecto.</p></div>`; return; }
  if (!authReady) { v.innerHTML = `<div class="empty">Cargando…</div>`; return; }
  if (!me) { v.innerHTML = landingView(); return; }
  if (route.name === 'home') { v.innerHTML = homeView(); renderModal(); return; }
  if (route.name === 'league') {
    if (!league) { v.innerHTML = leagueId && leagueMissing ? `<div class="panel empty">Esta liga no existe o el link está incompleto. <a href="#/">Volver a mis ligas</a></div>` : `<div class="empty">Cargando la liga…</div>`; return; }
    if (!m) { v.innerHTML = joinView(); return; }
    if (tab === 'equipo') v.innerHTML = teamView();
    else if (tab === 'mercado') v.innerHTML = marketView();
    else if (tab === 'jugadores') { v.innerHTML = playersView(); renderPlayerList(); }
    else if (tab === 'liga') v.innerHTML = leagueView();
    else v.innerHTML = moreView();
  }
  renderModal();
}

// ===================== Inicio / ligas =====================
function landingView() {
  const wall = TEAMS.map(t => crest(t.id, '')).join('');
  const inviting = route.invite;
  return `<section class="join">
    <div class="hero">
      <h2>La Liga Profesional, <em>en tu bolsillo</em></h2>
      <p class="muted" style="max-width:56ch;margin:0">${inviting ? 'Te invitaron a una liga. Entrá con tu cuenta de Google para armar tu equipo.' : `Fantasy gratis con los ${ALL.length} jugadores de los 30 clubes. Creá tu liga, compartí el link con tus amigos y competí con puntos reales de cada fecha.`}</p>
    </div>
    <div class="crestwall" aria-hidden="true">${wall}</div>
    <div><button class="gbtn" data-act="login">${GOOGLE} Entrar con Google</button></div>
    <section class="panel pad rules"><h2 class="sec" style="font-size:20px">Cómo se juega</h2>
      <p>Cada mánager arranca con 15 jugadores sorteados y saldo para fichar. Todos los días sale un mercado con jugadores libres: pujás a ciegas y al cierre gana la oferta más alta.</p>
      <p>Los puntos se cargan solos al terminar cada partido, según las estadísticas reales de cada jugador y su posición. Los precios suben y bajan según la demanda de tu liga y el rendimiento en la cancha.</p></section>
  </section>`;
}
function homeView() {
  const list = myLeaguesLoaded ? (myLeagues.length ? myLeagues.map(l => `<a class="lcard" href="#/liga/${encodeURIComponent(l.id)}" style="color:inherit;text-decoration:none"><span><b>${esc(l.name)}</b><span class="small muted">${l.members} mánager${l.members === 1 ? '' : 'es'}${l.owner ? ' · sos el creador' : ''}</span></span><span class="muted">›</span></a>`).join('') : `<div class="empty">Todavía no estás en ninguna liga. Creá una o pedile el link a un amigo.</div>`) : `<div class="empty">Cargando tus ligas…</div>`;
  return `<div class="home">
    <div class="sec-row"><h2 class="sec">Mis ligas</h2><button class="userchip" data-act="logout" title="Cerrar sesión"><span class="small muted">${esc(meUser?.email || '')}</span>${meUser?.photoURL ? `<img src="${esc(meUser.photoURL)}" alt="" referrerpolicy="no-referrer">` : ''}</button></div>
    <section class="panel">${list}</section>
    <form class="panel pad joinform" id="createform">
      <h2 class="sec" style="font-size:20px">Crear una liga</h2>
      <div class="field"><label for="lname">Nombre de la liga</label><input id="lname" maxlength="32" placeholder="Ej: Los del asado" required autocomplete="off"></div>
      <div class="field"><label for="tname">Nombre de tu equipo</label><input id="tname" maxlength="28" placeholder="Ej: Deportivo Sábado" required autocomplete="off"></div>
      <button class="btn pri" type="submit" id="createbtn">Crear liga y sortear mi equipo</button>
      <p class="small muted" style="margin:0">Después compartís el link de invitación para que se sumen tus amigos.</p>
    </form>
  </div>`;
}
function joinView() {
  const n = (league.members || []).length; const full = n >= settings().maxManagers;
  return `<section class="join">
    <a class="back" href="#/">‹ Mis ligas</a>
    <div class="hero"><h2>${esc(league.name)}</h2><p class="muted" style="margin:0">${n} mánager${n === 1 ? '' : 'es'} · creada por ${esc(league.ownerName || 'un amigo')}</p></div>
    ${full ? `<div class="panel pad">Esta liga está completa (${settings().maxManagers} mánagers).</div>` : `<form class="joinform panel pad" id="joinform">
      <div class="field"><label for="tname">Nombre de tu equipo</label><input id="tname" maxlength="28" placeholder="Ej: Los Pibes de Boedo" required autocomplete="off"></div>
      <p class="small muted" style="margin:0">Recibís 15 jugadores al azar y ${fmtM(settings().startCash)} para fichar.</p>
      <button class="btn pri" id="joinbtn" type="submit">Sumarme a la liga</button></form>`}
  </section>`;
}

// ===================== Vista: equipo =====================
function currentLineup(m) {
  const f = m.formation || '4-3-3'; const slots = slotsFor(f);
  const lu = (m.lineup || []).slice(0, 11); const squad = new Set(m.squad || []);
  return slots.map((p, i) => (lu[i] && squad.has(lu[i]) && PL[lu[i]] && PL[lu[i]].pos === p) ? lu[i] : null);
}
function teamView() {
  const m = myDoc(); const f = m.formation || '4-3-3'; const lu = currentLineup(m);
  const [d, mm, a] = FORMATIONS[f];
  const rows = [['F', a, 16], ['M', mm, 42], ['D', d, 67], ['P', 1, 88]];
  const idx = { P: 0, D: 1, M: 1 + d, F: 1 + d + mm };
  const pitchRows = rows.map(([p, n, y]) => {
    let s = ''; for (let k = 0; k < n; k++) { const i = idx[p] + k; const pid = lu[i];
      const lp = pid ? (playerLog[pid] || []).slice(-1)[0] : null;
      s += pid ? `<button class="slot" data-slot="${i}">${shirt(PL[pid].team)}<span class="nm">${esc(shortName(PL[pid].name))}</span><span class="pr num">${lp ? `<span class="ptsbadge ${lp.total >= 0 ? '' : 'neg'}">${lp.total}</span> ` : ''}${fmtM(price(pid))}</span></button>`
        : `<button class="slot emptyslot" data-slot="${i}">${shirt(null, true)}<span class="nm">${POSN[p]}</span></button>`; }
    return `<div class="row" style="top:${y}%">${s}</div>`;
  }).join('');
  const inXI = new Set(lu.filter(Boolean));
  const bench = (m.squad || []).filter(pid => PL[pid] && !inXI.has(pid)).sort((x, y) => 'PDMF'.indexOf(PL[x].pos) - 'PDMF'.indexOf(PL[y].pos) || price(y) - price(x));
  const pts = myPoints(m);
  return `<div class="view">
    <div class="sec-row"><h2 class="sec">Mi equipo</h2><span class="muted small">Esta alineación juega la fecha ${openFecha()}${pts.total ? ` · ${pts.total} pts en total` : ''}</span></div>
    <div class="pitch-wrap">
      <div class="team-tools">
        <label class="small muted" for="formation">Formación</label>
        <select class="select" id="formation" style="flex:1;max-width:160px">${Object.keys(FORMATIONS).map(k => `<option ${k === f ? 'selected' : ''}>${k}</option>`).join('')}</select>
        <button class="btn sm" data-act="autoxi">Armar el mejor XI</button>
      </div>
      <div class="pitch">
        <svg class="lines" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".5"><rect x="4" y="3" width="92" height="114"/><circle cx="50" cy="3" r="11"/><rect x="24" y="97" width="52" height="20"/><rect x="38" y="110" width="24" height="7"/><path d="M41 97 A10 10 0 0 1 59 97"/></g></svg>
        ${pitchRows}
      </div>
    </div>
    <section class="panel">
      <div class="pad sec-row" style="padding-bottom:6px"><h2 class="sec" style="font-size:20px">Suplentes y reservas</h2><span class="muted small">${(m.squad || []).length} jugadores en el plantel</span></div>
      <div class="plist">${bench.length ? bench.map(pid => prow(pid)).join('') : `<div class="empty">Todo tu plantel está en la cancha. Fichá en el mercado para tener recambio.</div>`}</div>
    </section>
  </div>`;
}
function prow(pid, extra = '') {
  const p = PL[pid]; const t = trend(pid);
  if (seasonPts[pid] !== undefined) extra += `<span class="chip num">${seasonPts[pid]} pts</span>`;
  return `<button class="prow" data-player="${pid}">${shirt(p.team)}<span class="who"><b>${esc(p.name)}</b><span class="meta">${posTag(p.pos)}${crest(p.team)}<span>${esc(TEAM[p.team].name)}</span>${extra}</span></span><span class="val"><b class="num">${fmtM(price(pid))}</b><small class="${tcls(t)} num">${fmtPct(t)}</small></span></button>`;
}
function autoXI(m, f) {
  const slots = slotsFor(f); const used = new Set();
  const byPos = p => (m.squad || []).filter(x => PL[x] && PL[x].pos === p && !used.has(x)).sort((a, b) => price(b) - price(a));
  return slots.map(p => { const c = byPos(p)[0]; if (c) used.add(c); return c || null; });
}
const memberRef = (uid = me) => doc(fdb, 'leagues', leagueId, 'members', uid);
const leagueRef = (id = leagueId) => doc(fdb, 'leagues', id);
async function saveLineup(formation, lineup) {
  try { await updateDoc(memberRef(), { formation, lineup, ['lineups.f' + openFecha()]: lineup.filter(Boolean) }); }
  catch (e) { console.error(e); toast('No se pudo guardar la alineación.'); }
}

// ===================== Vista: mercado =====================
function marketStatus() {
  const s = settings(); const nM = (league.members || []).length;
  const next = state() ? (state().lastUpdate || 0) + s.intervalHours * 3600e3 : 0;
  const enough = nM >= s.minManagers;
  return { nM, next, enough, auto: s.auto && enough };
}
function countdown(ms) { if (ms <= 0) return 'en instantes'; const h = Math.floor(ms / 3600e3), mi = Math.floor(ms % 3600e3 / 60e3); return h ? `${h} h ${mi} min` : `${mi} min`; }
function marketView() {
  const st = marketStatus(); const mb = myBids(); const own = owners(); const s = settings();
  const list = (state()?.market || []).filter(pid => PL[pid] && !own[pid]);
  const bidCount = {}; for (const b of Object.values(bids)) if (b.round === state()?.round) for (const pid of Object.keys(b.bids || {})) bidCount[pid] = (bidCount[pid] || 0) + 1;
  const filt = ui.mpos ? list.filter(pid => PL[pid].pos === ui.mpos) : list;
  const totalBid = Object.values(mb).reduce((a, b) => a + b.a, 0); const m = myDoc();
  const pill = st.auto ? `<span class="status-pill on"><i></i>Actualización automática</span>` : st.enough ? `<span class="status-pill wait"><i></i>Actualiza el creador de la liga</span>` : `<span class="status-pill wait"><i></i>Faltan ${s.minManagers - st.nM} mánager${s.minManagers - st.nM > 1 ? 'es' : ''} para el modo automático</span>`;
  const lastAw = (state()?.lastAwards || []);
  return `<div class="view">
    <section class="panel pad clock">
      <div style="flex:1;min-width:200px"><div class="muted small">${st.auto ? 'El mercado cierra y los precios se actualizan en' : 'Mercado abierto · ronda ' + (state()?.round || 1)}</div><div class="big num">${st.auto ? countdown(st.next - Date.now()) : 'Pujas abiertas'}</div></div>
      ${pill}
    </section>
    <div class="sec-row"><h2 class="sec">Mercado del día</h2>
      <div class="seg" role="group" aria-label="Filtrar por posición">${['', 'P', 'D', 'M', 'F'].map(p => `<button data-mpos="${p}" aria-pressed="${ui.mpos === p}">${p ? POSN[p] : 'Todos'}</button>`).join('')}</div></div>
    ${Object.keys(mb).length ? `<div class="panel pad small" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>Tenés <b>${Object.keys(mb).length}</b> puja${Object.keys(mb).length > 1 ? 's' : ''} por <b class="num">${fmtM(totalBid)}</b></span><span class="muted">Disponible después de pujar: <b class="num" style="color:var(--sun)">${fmtM((m.cash || 0) - totalBid)}</b></span></div>` : ''}
    ${filt.length ? `<div class="mgrid">${filt.map(pid => mcard(pid, mb[pid], bidCount[pid] || 0)).join('')}</div>` : `<div class="panel empty">${list.length ? 'No hay jugadores de esa posición hoy.' : 'El mercado se renueva con la próxima actualización.'}</div>`}
    ${lastAw.length ? `<section class="panel"><div class="pad" style="padding-bottom:4px"><h2 class="sec" style="font-size:20px">Fichajes de la última ronda</h2></div><div class="feed">${lastAw.map(a => `<div><span>${esc(members[a.uid]?.name || 'Un mánager')} se quedó con <b>${esc(PL[a.pid]?.name || '')}</b> por <b class="num">${fmtM(a.a)}</b></span></div>`).join('')}</div></section>` : ''}
    <p class="small muted" style="margin:0">Las pujas son ciegas: nadie ve tu monto. Al cierre gana la oferta más alta y los precios se recalculan con la demanda de la liga y el rendimiento en la cancha.</p>
  </div>`;
}
function mcard(pid, myb, n) {
  const p = PL[pid]; const t = trend(pid);
  return `<button class="mcard ${myb ? 'hasbid' : ''}" data-player="${pid}" style="text-align:left">${shirt(p.team)}<span class="info"><b>${esc(p.name)}</b><span class="meta" style="display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--muted)">${posTag(p.pos)}${crest(p.team)}${esc(TEAM[p.team].name)}</span></span>
    <span class="foot"><span><span class="price num">${fmtM(price(pid))}</span> <small class="${tcls(t)} num" style="font-weight:700">${fmtPct(t)}</small></span><span style="text-align:right">${myb ? `<span class="mybid num">Tu puja: ${fmtM(myb.a)}</span>` : `<span class="small muted">${n ? n + (n > 1 ? ' pujas' : ' puja') : 'Sin pujas'}</span>`}</span></span></button>`;
}

// ===================== Vista: jugadores =====================
function playersView() {
  return `<div class="view">
    <div class="sec-row"><h2 class="sec">Jugadores</h2><span class="muted small">${ALL.length} jugadores · 30 clubes</span></div>
    <div class="filters">
      <input type="search" id="q" placeholder="Buscar jugador" value="${esc(ui.q)}" aria-label="Buscar jugador">
      <select class="select" id="club" aria-label="Club"><option value="">Todos los clubes</option>${[...TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${t.id}" ${ui.club === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <select class="select" id="sort" aria-label="Ordenar"><option value="val" ${ui.sort === 'val' ? 'selected' : ''}>Mayor valor</option><option value="pts" ${ui.sort === 'pts' ? 'selected' : ''}>Más puntos</option><option value="up" ${ui.sort === 'up' ? 'selected' : ''}>Más subieron</option><option value="down" ${ui.sort === 'down' ? 'selected' : ''}>Más bajaron</option><option value="free" ${ui.sort === 'free' ? 'selected' : ''}>Libres primero</option></select>
      <div class="seg" role="group" aria-label="Posición">${['', 'P', 'D', 'M', 'F'].map(p => `<button data-ppos="${p}" aria-pressed="${ui.pos === p}">${p ? POSN[p] : 'Todos'}</button>`).join('')}</div>
    </div>
    <section class="panel"><div class="plist" id="plist"></div></section>
  </div>`;
}
function renderPlayerList() {
  const el = $('#plist'); if (!el) return;
  const own = owners(); const q = slug(ui.q);
  const arr = ALL.filter(p => (!ui.club || p.team === ui.club) && (!ui.pos || p.pos === ui.pos) && (!q || slug(p.name).includes(q)));
  const s = ui.sort;
  arr.sort((a, b) => s === 'up' ? trend(b.id) - trend(a.id) : s === 'down' ? trend(a.id) - trend(b.id) : s === 'pts' ? (seasonPts[b.id] || 0) - (seasonPts[a.id] || 0) : s === 'free' ? ((own[a.id] ? 1 : 0) - (own[b.id] ? 1 : 0)) || price(b.id) - price(a.id) : price(b.id) - price(a.id));
  const shown = arr.slice(0, ui.limit);
  el.innerHTML = shown.length ? shown.map(p => prow(p.id, own[p.id] ? `<span class="chip">${esc(members[own[p.id]]?.name || 'Fichado')}</span>` : `<span class="chip" style="color:var(--up)">Libre</span>`)).join('') + (arr.length > ui.limit ? `<div class="pad" style="text-align:center"><button class="btn sm" data-act="more">Ver ${Math.min(60, arr.length - ui.limit)} más de ${arr.length}</button></div>` : '') : `<div class="empty">No hay jugadores con esos filtros.</div>`;
}

// ===================== Vista: liga =====================
function lineupFor(m, f) { const L = m.lineups || {}; for (let k = f; k >= 1; k--) if (L['f' + k]) return L['f' + k]; return []; }
function myPoints(m) {
  let total = 0, last = 0, lastR = 0;
  for (const [r, pt] of Object.entries(ptsByRound)) { if (+r < (m.firstRound || 0)) continue; const s = lineupFor(m, +r).reduce((a, pid) => a + (+pt[pid] || 0), 0); total += s; if (+r >= lastR) { lastR = +r; last = s; } }
  return { total, last, lastR };
}
function fixturesHTML() {
  const rs = roundsInfo(); if (!rs.length) return `<div class="empty">El calendario se carga con la primera sincronización de estadísticas.</div>`;
  const r = ui.round ?? liveFecha(); const info = rs.find(x => x.r === r) || rs[0];
  const list = info.list.slice().sort((a, b) => (a.k || 9e15) - (b.k || 9e15));
  const dfmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rows = list.map(mt => { const d = stats['m' + mt.id]; const done = mt.st === 'done' && d; const H = TEAM[mt.h], A = TEAM[mt.a];
    const mid = done ? `<b class="num score">${d.hs} - ${d.as_}</b>` : mt.st === 'post' ? '<span class="chip">Postergado</span>' : mt.st === 'live' ? '<span class="chip" style="color:var(--up)">En juego</span>' : `<span class="small muted num">${mt.k ? dfmt.format(mt.k) : 'A confirmar'}</span>`;
    return `<div class="fx">${H ? `<span class="tm">${esc(H.name)} ${crest(H.id)}</span>` : '<span class="tm muted">Por definir</span>'}<span class="mid">${mid}</span>${A ? `<span class="tm a">${crest(A.id)} ${esc(A.name)}</span>` : '<span class="tm a muted">Por definir</span>'}</div>`; }).join('');
  const i = rs.findIndex(x => x.r === info.r);
  return `<div class="pad sec-row" style="padding-bottom:6px"><button class="btn sm" data-round="${rs[i - 1]?.r ?? ''}" ${i > 0 ? '' : 'disabled'} aria-label="Fecha anterior">‹</button><h2 class="sec" style="font-size:20px">Fecha ${info.r}</h2><button class="btn sm" data-round="${rs[i + 1]?.r ?? ''}" ${i < rs.length - 1 ? '' : 'disabled'} aria-label="Fecha siguiente">›</button></div><div class="fxlist">${rows}</div>`;
}
function leagueView() {
  const rows = Object.entries(members).map(([uid, m]) => ({ uid, m, v: teamValue(m), ...myPoints(m) }));
  const anyPts = rows.some(r => r.total);
  rows.sort((a, b) => anyPts ? (b.total - a.total) || (b.v - a.v) : b.v - a.v);
  const log = (state()?.log || []).slice().reverse();
  return `<div class="view">
    <section class="panel">${fixturesHTML()}</section>
    <div class="sec-row"><h2 class="sec">Clasificación</h2><span class="muted small">${anyPts ? 'Suman los 11 alineados en cada fecha' : 'Por valor de equipo hasta que se jueguen partidos'}</span></div>
    <section class="panel rank">${rows.map((r, i) => `<div class="rrow ${r.uid === me ? 'me' : ''}"><span class="n">${i + 1}</span><span style="min-width:0"><span class="tn">${esc(r.m.name)}</span><span class="small muted">${esc(r.m.manager || '')}${r.lastR ? ` · fecha ${r.lastR}: ${r.last} pts` : ''}</span></span><span class="k"><b class="num">${r.total}</b><span>Pts</span></span><span class="k"><b class="num">${fmtM(r.v)}</b><span>Valor</span></span></div>`).join('')}</section>
    <div class="sec-row"><h2 class="sec">Actividad</h2></div>
    <section class="panel feed">${log.length ? log.slice(0, 30).map(e => `<div><time>${ago(e.t)}</time><span>${esc(e.x)}</span></div>`).join('') : `<div class="empty">Acá van a aparecer los fichajes, las ventas y las subidas del mercado.</div>`}</section>
  </div>`;
}

// ===================== Vista: más =====================
function inviteLink() { return `${location.origin}${location.pathname}#/liga/${leagueId}`; }
function moreView() {
  const s = settings(); const st = marketStatus();
  const invite = `<section class="panel pad" style="display:grid;gap:10px"><h2 class="sec" style="font-size:20px">Invitar amigos</h2>
    <p class="small muted" style="margin:0">Compartí este link. Quien lo abra entra con Google y se suma a ${esc(league.name)}.</p>
    <div class="invite"><input id="invlink" readonly value="${esc(inviteLink())}" aria-label="Link de invitación"><button class="btn pri sm" data-act="copyinvite">Copiar</button></div>
    <a class="btn sm" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Sumate a mi liga "${league.name}" en Fantasy LPF: ${inviteLink()}`)}">Compartir por WhatsApp</a></section>`;
  const table = `<div class="ptable" role="table" aria-label="Tabla de puntos">
      <div class="ph" role="row"><span role="columnheader"></span><span role="columnheader">POR</span><span role="columnheader">DEF</span><span role="columnheader">MED</span><span role="columnheader">DEL</span></div>
      <div role="row"><span role="cell">Gol</span><span class="num">+7</span><span class="num">+6</span><span class="num">+5</span><span class="num">+4</span></div>
      <div role="row"><span role="cell">Asistencia</span><span class="num">+3</span><span class="num">+3</span><span class="num">+3</span><span class="num">+3</span></div>
      <div role="row"><span role="cell">Valla invicta (60' o más)</span><span class="num">+4</span><span class="num">+3</span><span class="num">+1</span><span class="num">0</span></div>
      <div role="row"><span role="cell">Gol recibido</span><span class="num">−1</span><span class="num">−1 c/2</span><span class="num">0</span><span class="num">0</span></div>
      <div role="row"><span role="cell">Atajadas</span><span class="num">+1 c/2</span><span>–</span><span>–</span><span>–</span></div>
      <div role="row"><span role="cell">Despejes</span><span>–</span><span class="num">+1 c/3</span><span>–</span><span>–</span></div>
      <div role="row"><span role="cell">Quites e intercepciones</span><span>–</span><span class="num">+1 c/3</span><span class="num">+1 c/3</span><span>–</span></div>
      <div role="row"><span role="cell">Pases clave</span><span>–</span><span>–</span><span class="num">+1 c/2</span><span class="num">+1 c/2</span></div>
      <div role="row"><span role="cell">Tiros al arco</span><span>–</span><span>–</span><span class="num">+1 c/2</span><span class="num">+1 c/2</span></div>
      <div role="row"><span role="cell">Gambetas exitosas</span><span>–</span><span>–</span><span>–</span><span class="num">+1 c/3</span></div>
    </div>`;
  const howto = `<section class="panel pad rules"><h2 class="sec" style="font-size:20px">Cómo funciona</h2>
    <p>Cada mánager arranca con 15 jugadores sorteados y ${fmtM(s.startCash)}. Cada jugador pertenece a un solo mánager de la liga.</p>
    <p><b>Mercado:</b> en cada ronda salen ${s.marketSize} jugadores libres. Pujás a ciegas (mínimo, su valor actual) y gana la oferta más alta que el mánager pueda pagar. También podés vender a la liga al instante.</p>
    <p><b>Precios:</b> suben con las pujas, los fichajes y los puntos; bajan con las ventas a la liga y cuando el jugador no suma minutos y su equipo sí jugó.</p>
    <p><b>Puntos:</b> se cargan solos al terminar cada partido. Suman los 11 que tenías alineados cuando arrancó la fecha.</p>
    ${table}
    <p class="small muted">Para todos: jugar 1 a 59 minutos +1, 60 o más +2 · valoración del partido: (nota − 6,5) × 1,5, entre −4 y +6 · figura +2 · amarilla −1 · roja −3 · gol en contra −2 · penal errado −2 · penal atajado +5. Si un partido no trae el detalle de atajadas o despejes, la valoración pesa el doble.</p></section>`;
  const vq = slug(ui.valQ); const vlist = vq.length >= 2 ? ALL.filter(p => slug(p.name).includes(vq)).slice(0, 8) : [];
  const admin = isOwner() ? `<div class="grid2">
      <section class="panel pad" style="display:grid;gap:14px">
        <h3 style="margin:0;font-family:var(--display);font-size:20px;text-transform:uppercase">Ajustes de la liga</h3>
        <p class="small muted" style="margin:0">Ronda ${state()?.round || 1} · ${st.nM} mánager${st.nM === 1 ? '' : 'es'} · última actualización ${state()?.lastUpdate ? 'hace ' + ago(state().lastUpdate) : 'nunca'}</p>
        <button class="btn gold" data-act="forceupdate">Cerrar mercado y actualizar precios ahora</button>
        <label class="toggle"><input type="checkbox" id="s-auto" ${s.auto ? 'checked' : ''}> Actualización automática</label>
        <div class="field"><label for="s-min">Mánagers necesarios para el modo automático</label><input id="s-min" type="number" min="1" max="50" value="${s.minManagers}"></div>
        <div class="field"><label for="s-int">Horas entre actualizaciones</label><input id="s-int" type="number" min="1" max="168" value="${s.intervalHours}"></div>
        <div class="field"><label for="s-size">Jugadores por mercado</label><input id="s-size" type="number" min="4" max="30" value="${s.marketSize}"></div>
        <div class="field"><label for="s-cash">Saldo inicial para los que se sumen (€)</label><input id="s-cash" type="number" min="0" step="500000" value="${s.startCash}"></div>
        <div class="field"><label for="s-max">Máximo de mánagers</label><input id="s-max" type="number" min="2" max="30" value="${s.maxManagers}"></div>
        <button class="btn pri" data-act="savesettings">Guardar ajustes</button>
      </section>
      <section class="panel pad" style="display:grid;gap:12px">
        <h3 style="margin:0;font-family:var(--display);font-size:20px;text-transform:uppercase">Corregir valores</h3>
        <input class="select" id="valq" placeholder="Buscar jugador" value="${esc(ui.valQ)}" aria-label="Buscar jugador">
        <div id="vallist">${valListHTML(vlist)}</div>
      </section></div>` : '';
  return `<div class="view"><a class="back" href="#/">‹ Mis ligas</a>${invite}${admin}${howto}
    <p class="small muted" style="margin:0">Estadísticas: FotMob · ${calendar?.updated ? `última sincronización hace ${ago(calendar.updated)}` : 'esperando la primera sincronización'}.</p>
    <button class="btn danger sm" data-act="logout" style="justify-self:start">Cerrar sesión</button></div>`;
}
function valListHTML(vlist) { return vlist.map(p => `<div class="ptsrow" style="grid-template-columns:minmax(0,1fr) 120px auto"><span>${esc(p.name)} <span class="muted small">${esc(TEAM[p.team].short)}</span></span><input data-val="${p.id}" type="number" step="50000" value="${price(p.id)}" aria-label="Valor de ${esc(p.name)}"><button class="btn sm" data-setval="${p.id}">Fijar</button></div>`).join(''); }

// ===================== Modales =====================
function renderModal() {
  const root = $('#modal');
  if (!modal || !league) { root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${modal.type === 'player' ? playerModal(modal.pid) : slotModal(modal.slot)}</div>`;
}
function spark(pid) {
  const h = ((state()?.hist?.[pid]) || []).concat([price(pid)]);
  if (h.length < 2) return `<p class="small muted" style="margin:0">El gráfico de evolución aparece después de la primera actualización del mercado.</p>`;
  const W = 300, H = 70, mn = Math.min(...h), mx = Math.max(...h), r = mx - mn || 1;
  const pts = h.map((v, i) => [i / (h.length - 1) * (W - 8) + 4, H - 8 - (v - mn) / r * (H - 18)]);
  const col = h[h.length - 1] >= h[0] ? 'var(--up)' : 'var(--down)';
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Evolución del valor"><line x1="0" x2="${W}" y1="${H - 8}" y2="${H - 8}" stroke="var(--line)"/><path d="${d} L${pts[pts.length - 1][0]} ${H - 8} L${pts[0][0]} ${H - 8}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3.5" fill="${col}"/></svg>`;
}
function matchesHTML(pid) {
  const L = (playerLog[pid] || []).slice(-3).reverse(); if (!L.length) return '';
  return `<div class="mlog">${L.map((x, i) => `<details ${i === 0 ? 'open' : ''}><summary><span>Fecha ${x.r} · vs ${esc(TEAM[x.opp]?.name || '')} <span class="muted num">${x.gf}-${x.ga}</span></span><b class="num ${x.total >= 0 ? 'up' : 'down'}">${x.total > 0 ? '+' : ''}${x.total} pts</b></summary>${x.parts.map(([l, v]) => `<div class="pl"><span>${esc(l)}</span><span class="num ${v >= 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v}</span></div>`).join('')}</details>`).join('')}</div>`;
}
function playerModal(pid) {
  const p = PL[pid]; const own = owners(); const o = own[pid]; const m = myDoc(); const t = trend(pid);
  const inMarket = (state()?.market || []).includes(pid) && !o;
  const mine = o === me; const mb = myBids()[pid];
  let actions = '';
  if (m && mine) actions = modal.confirmSell ? `<button class="btn danger" data-act="sellconfirm">Confirmar venta por ${fmtM(price(pid))}</button><button class="btn" data-act="sellcancel">Cancelar</button>` : `<button class="btn danger" data-act="sell">Vender a la liga por ${fmtM(price(pid))}</button>`;
  else if (m && inMarket) {
    const v = modal.bid ?? (mb ? mb.a : price(pid));
    actions = `<div class="bidbox"><button class="btn" data-act="bidminus" aria-label="Bajar 100 mil">−</button><input id="bidamt" type="number" step="100000" min="${price(pid)}" value="${v}" aria-label="Monto de la puja en euros"><button class="btn" data-act="bidplus" aria-label="Subir 100 mil">+</button></div>
      <div class="small muted num" style="text-align:center">${fmtFull(v)} · saldo ${fmtM(m.cash || 0)}</div>
      <button class="btn gold" data-act="bid">${mb ? 'Cambiar puja' : 'Pujar'}</button>${mb ? `<button class="btn danger" data-act="unbid">Retirar puja</button>` : ''}`;
  }
  const status = o ? (mine ? 'En tu plantel' : 'De ' + esc(members[o]?.name || 'otro mánager')) : inMarket ? 'En el mercado de hoy' : 'Libre';
  return `<div class="mhead">${shirt(p.team)}<div style="min-width:0"><div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">${posTag(p.pos)}${crest(p.team)}<span class="small muted">${esc(TEAM[p.team].name)}</span></div><h3>${esc(p.name)}</h3></div><button class="x" data-act="close" aria-label="Cerrar">×</button></div>
    <div class="stats"><div><span>Valor</span><b class="num">${fmtM(price(pid))}</b></div><div><span>Última act.</span><b class="num ${tcls(t)}">${fmtPct(t)}</b></div><div><span>Puntos</span><b class="num">${seasonPts[pid] || 0}</b></div></div>
    ${spark(pid)}${matchesHTML(pid)}
    <p class="small muted" style="margin:10px 0 0">${POSL[p.pos]} · ${status} · 2026: ${p.min ? nf.format(p.min) + "'" : 'menos de 315 minutos'}${p.rt ? ', nota ' + p.rt.toFixed(2).replace('.', ',') : ''}</p>
    ${actions ? `<div class="actions">${actions}</div>` : ''}`;
}
function slotModal(i) {
  const m = myDoc(); const f = m.formation || '4-3-3'; const pos = slotsFor(f)[i]; const lu = currentLineup(m);
  const cands = (m.squad || []).filter(pid => PL[pid] && PL[pid].pos === pos).sort((a, b) => price(b) - price(a));
  return `<div class="sec-row" style="margin-bottom:10px"><h3 style="margin:0;font-family:var(--display);font-size:24px;text-transform:uppercase">Elegí ${POSL[pos].toLowerCase()}</h3><button class="x" data-act="close" aria-label="Cerrar">×</button></div>
    <div class="plist panel">${cands.length ? cands.map(pid => { const at = lu.indexOf(pid); return `<button class="prow" data-pick="${pid}">${shirt(PL[pid].team)}<span class="who"><b>${esc(PL[pid].name)}</b><span class="meta">${crest(PL[pid].team)}${esc(TEAM[PL[pid].team].name)}${at === i ? ' · <b style="color:var(--sky)">En este lugar</b>' : at >= 0 ? ' · Titular' : ''}</span></span><span class="val"><b class="num">${fmtM(price(pid))}</b></span></button>`; }).join('') : `<div class="empty">No tenés ${POSN[pos]} en el plantel. Buscalos en el mercado.</div>`}</div>
    <div class="actions">${lu[i] ? `<button class="btn" data-pick="">Dejar vacío</button><button class="btn" data-player="${lu[i]}">Ver ficha de ${esc(shortName(PL[lu[i]].name))}</button>` : ''}</div>`;
}

// ===================== Eventos =====================
document.addEventListener('click', async e => {
  const b = e.target.closest('button, .modal-bg'); if (!b) return;
  if (b.id === 'modal' && e.target === b) { modal = null; renderModal(); return; }
  if (b.dataset.tab) { tab = b.dataset.tab; try { localStorage.setItem('fla-tab', tab); } catch (err) {} window.scrollTo(0, 0); render(); return; }
  if (b.dataset.round !== undefined) { if (b.dataset.round !== '') { ui.round = +b.dataset.round; render(); } return; }
  if (b.dataset.mpos !== undefined) { ui.mpos = b.dataset.mpos; render(); return; }
  if (b.dataset.ppos !== undefined) { ui.pos = b.dataset.ppos; ui.limit = 60; document.querySelectorAll('[data-ppos]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderPlayerList(); return; }
  if (b.dataset.player) { modal = { type: 'player', pid: b.dataset.player }; renderModal(); return; }
  if (b.dataset.slot !== undefined) { modal = { type: 'slot', slot: +b.dataset.slot }; renderModal(); return; }
  if (b.dataset.pick !== undefined) { const m = myDoc(); const f = m.formation || '4-3-3'; const lu = currentLineup(m); const pid = b.dataset.pick || null; const j = pid ? lu.indexOf(pid) : -1; if (j >= 0) lu[j] = lu[modal.slot]; lu[modal.slot] = pid; modal = null; renderModal(); await saveLineup(f, lu); return; }
  if (b.dataset.setval) { const id = b.dataset.setval; const v = Math.round(+document.querySelector(`[data-val="${id}"]`).value); if (!(v >= 50000)) return toast('Ingresá un valor de al menos 50.000 €.'); await setPrice(id, v); return; }
  const act = b.dataset.act; if (!act) return;
  if (act === 'login') { const prov = new GoogleAuthProvider(); try { await signInWithPopup(auth, prov); } catch (err) { if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, prov); else if (err.code !== 'auth/popup-closed-by-user') toast('No se pudo iniciar sesión. Probá de nuevo.'); } }
  else if (act === 'logout') { await signOut(auth); location.hash = '#/'; }
  else if (act === 'close') { modal = null; renderModal(); }
  else if (act === 'more') { ui.limit += 60; renderPlayerList(); }
  else if (act === 'copyinvite') { const inp = $('#invlink'); try { await navigator.clipboard.writeText(inp.value); toast('Link copiado.'); } catch (err) { inp.select(); toast('Seleccioná el link y copialo.'); } }
  else if (act === 'autoxi') { const m = myDoc(); const f = m.formation || '4-3-3'; await saveLineup(f, autoXI(m, f)); toast('Alineación armada con tus jugadores más valiosos.'); }
  else if (act === 'bidplus' || act === 'bidminus') { let v = +$('#bidamt').value || price(modal.pid); v += act === 'bidplus' ? 100000 : -100000; modal.bid = Math.max(price(modal.pid), v); renderModal(); }
  else if (act === 'bid') await placeBid(modal.pid, Math.round(+$('#bidamt').value));
  else if (act === 'unbid') await removeBid(modal.pid);
  else if (act === 'sell') { modal.confirmSell = true; renderModal(); }
  else if (act === 'sellcancel') { modal.confirmSell = false; renderModal(); }
  else if (act === 'sellconfirm') await sellPlayer(modal.pid);
  else if (act === 'forceupdate') { b.disabled = true; b.textContent = 'Actualizando…'; await runMarketUpdate(true); }
  else if (act === 'savesettings') await saveSettings();
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'createform') { const ln = $('#lname').value.trim(), tn = $('#tname').value.trim(); if (!ln || !tn) return; const btn = $('#createbtn'); btn.disabled = true; btn.textContent = 'Creando…'; try { const id = await createLeague(ln, tn); location.hash = '#/liga/' + id; } catch (err) { console.error(err); toast('No se pudo crear la liga.'); btn.disabled = false; btn.textContent = 'Crear liga y sortear mi equipo'; } }
  if (e.target.id === 'joinform') { const tn = $('#tname').value.trim(); if (!tn) return; const btn = $('#joinbtn'); btn.disabled = true; btn.textContent = 'Sorteando tu plantel…'; try { await joinLeague(tn); tab = 'equipo'; toast('¡Listo! Este es tu plantel inicial.'); } catch (err) { console.error(err); toast(err.message === 'full' ? 'La liga está completa.' : 'No se pudo sumar a la liga.'); btn.disabled = false; btn.textContent = 'Sumarme a la liga'; } }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { ui.q = t.value; ui.limit = 60; renderPlayerList(); }
  if (t.id === 'valq') { ui.valQ = t.value; const vq = slug(ui.valQ); $('#vallist').innerHTML = valListHTML(vq.length >= 2 ? ALL.filter(p => slug(p.name).includes(vq)).slice(0, 8) : []); }
  if (t.id === 'bidamt' && modal) modal.bid = +t.value;
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'club') { ui.club = t.value; ui.limit = 60; renderPlayerList(); }
  if (t.id === 'sort') { ui.sort = t.value; renderPlayerList(); }
  if (t.id === 'formation') { const m = myDoc(); await saveLineup(t.value, autoXI(m, t.value)); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal) { modal = null; renderModal(); } });

// ===================== Lógica del juego =====================
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pushLog = (st, x) => { st.log = (st.log || []).concat([{ t: Date.now(), x }]).slice(-60); };
function genMarket(own, n, P = price) {
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
function newMember(name, squad, cash) {
  const d = { name, manager: meUser?.displayName || '', cash, squad, formation: '4-3-3', joined: Date.now(), sells: [], firstRound: openFecha() };
  d.lineup = autoXI(d, '4-3-3'); d.lineups = { ['f' + openFecha()]: d.lineup.filter(Boolean) };
  return d;
}
async function createLeague(name, teamName) {
  const ref = doc(collection(fdb, 'leagues'));
  const own = {}; const P = id => PL[id].base;
  const squad = randomSquad(own, new Set(), P); for (const pid of squad) own[pid] = me;
  const st = { round: 1, lastUpdate: Date.now(), market: genMarket(own, DEFAULTS.marketSize, P), prices: {}, prev: {}, hist: {}, log: [], lastAwards: [] };
  pushLog(st, `Se creó la liga. ${teamName} es el primer equipo.`);
  await runTransaction(fdb, async tx => {
    tx.set(ref, { name, owner: me, ownerName: meUser?.displayName || '', members: [me], createdAt: Date.now(), settings: { ...DEFAULTS }, state: st, owned: own });
    tx.set(doc(fdb, 'leagues', ref.id, 'members', me), newMember(teamName, squad, DEFAULTS.startCash));
  });
  await setDoc(doc(fdb, 'users', me), { leagues: arrayUnion(ref.id) }, { merge: true });
  return ref.id;
}
async function joinLeague(teamName) {
  await runTransaction(fdb, async tx => {
    const snap = await tx.get(leagueRef()); if (!snap.exists()) throw new Error('missing');
    const L = snap.data(); if ((L.members || []).includes(me)) return;
    const s = { ...DEFAULTS, ...(L.settings || {}) };
    if ((L.members || []).length >= s.maxManagers) throw new Error('full');
    const P = id => L.state?.prices?.[id] || PL[id].base;
    const own = { ...(L.owned || {}) };
    const squad = randomSquad(own, new Set(L.state?.market || []), P); for (const pid of squad) own[pid] = me;
    const st = { ...L.state }; pushLog(st, `${teamName} se sumó a la liga.`);
    tx.update(leagueRef(), { members: [...L.members, me], owned: own, state: st });
    tx.set(memberRef(), newMember(teamName, squad, s.startCash));
  });
  await setDoc(doc(fdb, 'users', me), { leagues: arrayUnion(leagueId) }, { merge: true });
}
async function placeBid(pid, amt) {
  const m = myDoc(); if (!m) return;
  if (!(amt >= price(pid))) return toast(`La puja mínima es ${fmtFull(price(pid))}.`);
  const mb = { ...myBids() }; const others = Object.entries(mb).filter(([k]) => k !== pid).reduce((s, [, b]) => s + b.a, 0);
  if (others + amt > (m.cash || 0)) return toast(`No te alcanza: con tus otras pujas comprometés ${fmtM(others + amt)} y tenés ${fmtM(m.cash || 0)}.`);
  mb[pid] = { a: amt, t: Date.now() };
  try { await setDoc(doc(fdb, 'leagues', leagueId, 'bids', me), { round: state().round, bids: mb }); toast(`Puja de ${fmtM(amt)} por ${PL[pid].name}.`); modal = null; render(); }
  catch (e) { console.error(e); toast('No se pudo registrar la puja.'); }
}
async function removeBid(pid) {
  const mb = { ...myBids() }; delete mb[pid];
  try { await setDoc(doc(fdb, 'leagues', leagueId, 'bids', me), { round: state().round, bids: mb }); toast('Puja retirada.'); modal = null; render(); } catch (e) { toast('No se pudo retirar la puja.'); }
}
async function sellPlayer(pid) {
  try {
    const v = await runTransaction(fdb, async tx => {
      const [ls, ms] = await Promise.all([tx.get(leagueRef()), tx.get(memberRef())]);
      const L = ls.data(), m = ms.data(); if (!(m.squad || []).includes(pid)) throw new Error('notmine');
      const v = L.state?.prices?.[pid] || PL[pid].base;
      const own = { ...(L.owned || {}) }; delete own[pid];
      tx.update(leagueRef(), { owned: own });
      tx.update(memberRef(), { squad: m.squad.filter(x => x !== pid), lineup: (m.lineup || []).map(x => x === pid ? null : x), cash: (m.cash || 0) + v, sells: (m.sells || []).concat([{ pid, r: L.state.round, v }]).slice(-80) });
      return v;
    });
    toast(`Vendiste a ${PL[pid].name} por ${fmtM(v)}.`); modal = null; render();
  } catch (e) { console.error(e); toast('No se pudo completar la venta.'); }
}
async function setPrice(id, v) {
  try { await updateDoc(leagueRef(), { ['state.prices.' + id]: v }); toast(`${PL[id].name}: ${fmtFull(v)}.`); } catch (e) { console.error(e); toast('No se pudo guardar el valor.'); }
}
async function saveSettings() {
  const s = { ...settings(), auto: $('#s-auto').checked, minManagers: Math.max(1, +$('#s-min').value || 1), intervalHours: Math.max(1, +$('#s-int').value || 24), marketSize: Math.min(30, Math.max(4, +$('#s-size').value || 14)), startCash: Math.max(0, +$('#s-cash').value || 0), maxManagers: Math.min(30, Math.max(2, +$('#s-max').value || 16)) };
  try { await updateDoc(leagueRef(), { settings: s }); toast('Ajustes guardados.'); } catch (e) { console.error(e); toast('No se pudieron guardar los ajustes.'); }
}

// Motor del mercado: una transacción resuelve pujas, mueve precios y abre el mercado nuevo.
let updating = false;
async function runMarketUpdate(force) {
  if (updating) return; updating = true;
  try {
    const done = await runTransaction(fdb, async tx => {
      const ls = await tx.get(leagueRef()); const L = ls.data(); const st = JSON.parse(JSON.stringify(L.state || {}));
      const s = { ...DEFAULTS, ...(L.settings || {}) };
      if (!force && Date.now() < (st.lastUpdate || 0) + s.intervalHours * 3600e3 - 30000) return false;
      const ids = L.members || [];
      const msnaps = await Promise.all(ids.map(uid => tx.get(doc(fdb, 'leagues', leagueId, 'members', uid))));
      const bsnaps = await Promise.all(ids.map(uid => tx.get(doc(fdb, 'leagues', leagueId, 'bids', uid))));
      const mg = {}; msnaps.forEach((d, i) => { if (d.exists()) mg[ids[i]] = d.data(); });
      const bd = {}; bsnaps.forEach((d, i) => { if (d.exists()) bd[ids[i]] = d.data(); });
      const P = id => st.prices?.[id] || PL[id].base;
      const round = st.round || 1;
      const own = { ...(L.owned || {}) };
      // 1) Pujas
      const offers = {}, bidders = {};
      for (const [uid, b] of Object.entries(bd)) { if (b.round !== round || !mg[uid]) continue;
        for (const [pid, o] of Object.entries(b.bids || {})) { if (!PL[pid]) continue; bidders[pid] = (bidders[pid] || 0) + 1; if ((st.market || []).includes(pid) && !own[pid]) (offers[pid] = offers[pid] || []).push({ uid, a: o.a, t: o.t || 0 }); } }
      const budget = {}; for (const [uid, m] of Object.entries(mg)) budget[uid] = m.cash || 0;
      const order = Object.keys(offers).sort((x, y) => Math.max(...offers[y].map(o => o.a)) - Math.max(...offers[x].map(o => o.a)));
      const awards = [];
      for (const pid of order) { const w = offers[pid].sort((x, y) => y.a - x.a || x.t - y.t).find(o => budget[o.uid] >= o.a); if (w) { budget[w.uid] -= w.a; own[pid] = w.uid; awards.push({ pid, uid: w.uid, a: w.a }); } }
      // 2) Ventas de la ronda
      const sold = {}; for (const m of Object.values(mg)) for (const x of (m.sells || [])) if (x.r === round) sold[x.pid] = (sold[x.pid] || 0) + 1;
      // 3) Rendimiento desde la última actualización
      const perf = {}; const teamsPlayed = new Set();
      for (const d of Object.values(stats)) if ((d.ts || 0) > (st.lastUpdate || 0)) { teamsPlayed.add(d.h); teamsPlayed.add(d.a); }
      for (const [pid, Lg] of Object.entries(playerLog)) for (const x of Lg) if (x.ts > (st.lastUpdate || 0)) perf[pid] = (perf[pid] || 0) + x.total;
      // 4) Precios
      const prices = {}, prevSlim = {}, hist = st.hist || {}; const won = new Set(awards.map(a => a.pid)); const moves = [], benched = [];
      for (const p of ALL) {
        const old = P(p.id);
        let pct = 0.03 * (bidders[p.id] || 0) + (won.has(p.id) ? 0.02 : 0) - 0.03 * (sold[p.id] || 0) + (own[p.id] ? 0.004 : -0.003);
        if (perf[p.id] !== undefined) pct += Math.max(-0.08, Math.min(0.15, (perf[p.id] - 4) * 0.012));
        else if (teamsPlayed.has(p.team)) { pct -= 0.07; if (old >= 2e6) benched.push(p.id); }
        const ratio = old / p.base; if (ratio > 1.8) pct -= 0.01; if (ratio < 0.5) pct += 0.01;
        pct = Math.max(-0.15, Math.min(0.2, pct));
        const nv = Math.max(50000, Math.round(old * (1 + pct) / 1000) * 1000);
        if (nv !== p.base) prices[p.id] = nv;
        if (old !== nv) { prevSlim[p.id] = old; moves.push([p.id, (nv - old) / old]); hist[p.id] = (hist[p.id] || []).concat([old]).slice(-14); }
      }
      // 5) Aplicar fichajes a cada mánager
      for (const a of awards) { const m = mg[a.uid]; m.squad = [...new Set((m.squad || []).concat([a.pid]))]; m.cash = (m.cash || 0) - a.a; }
      for (const uid of new Set(awards.map(a => a.uid))) tx.update(doc(fdb, 'leagues', leagueId, 'members', uid), { squad: mg[uid].squad, cash: mg[uid].cash });
      const ns = { ...st, round: round + 1, lastUpdate: Date.now(), prices, prev: prevSlim, hist, market: genMarket(own, s.marketSize, id => prices[id] || PL[id].base), lastAwards: awards };
      for (const a of awards) pushLog(ns, `${mg[a.uid].name} fichó a ${PL[a.pid].name} por ${fmtM(a.a)}.`);
      for (const [pid, n] of Object.entries(sold)) pushLog(ns, `${PL[pid].name} fue vendido a la liga${n > 1 ? ` (${n} veces)` : ''}.`);
      const stars = Object.entries(perf).sort((x, y) => y[1] - x[1]).slice(0, 3).filter(x => x[1] >= 8);
      if (stars.length) pushLog(ns, `Suben por rendimiento: ${stars.map(([id, v]) => `${PL[id].name} (${v} pts)`).join(', ')}.`);
      if (benched.length) pushLog(ns, `Bajan por no jugar: ${benched.slice(0, 4).map(id => PL[id].name).join(', ')}${benched.length > 4 ? ` y ${benched.length - 4} más` : ''}.`);
      pushLog(ns, `Cerró la ronda ${round}: ${awards.length} fichaje${awards.length === 1 ? '' : 's'}, nuevo mercado.`);
      tx.update(leagueRef(), { state: ns, owned: own });
      return true;
    });
    if (force) toast(done ? 'Mercado actualizado.' : 'El mercado ya estaba actualizado.');
  } catch (e) { console.error(e); if (force) toast('No se pudo actualizar el mercado.'); }
  finally { updating = false; render(); }
}
function autoCheck() {
  if (!league || !myDoc()) return;
  const st = marketStatus();
  if (st.auto && Date.now() >= st.next) runMarketUpdate(false);
}

// ===================== Navegación y suscripciones =====================
let leagueMissing = false;
function stopLeague() { unsubs.forEach(u => u()); unsubs = []; league = null; members = {}; bids = {}; leagueMissing = false; }
function openLeague(id) {
  if (leagueId === id && unsubs.length) return;
  stopLeague(); leagueId = id;
  unsubs.push(onSnapshot(leagueRef(id), s => { if (!s.exists()) { leagueMissing = true; league = null; } else league = s.data(); render(); }, err => { console.error(err); leagueMissing = true; render(); }));
  unsubs.push(onSnapshot(collection(fdb, 'leagues', id, 'members'), q => { members = {}; q.docs.forEach(d => members[d.id] = d.data()); render(); }, err => console.error(err)));
  unsubs.push(onSnapshot(collection(fdb, 'leagues', id, 'bids'), q => { bids = {}; q.docs.forEach(d => bids[d.id] = d.data()); render(); }, () => {}));
}
async function loadMyLeagues() {
  myLeaguesLoaded = false; render();
  try {
    const u = await getDoc(doc(fdb, 'users', me)); const ids = u.exists() ? (u.data().leagues || []) : [];
    const ls = await Promise.all(ids.map(id => getDoc(leagueRef(id)).catch(() => null)));
    myLeagues = ls.filter(s => s && s.exists() && (s.data().members || []).includes(me)).map(s => ({ id: s.id, name: s.data().name, members: (s.data().members || []).length, owner: s.data().owner === me }));
  } catch (e) { console.error(e); myLeagues = []; }
  myLeaguesLoaded = true; render();
}
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, ''); const parts = h.split('/');
  if (parts[0] === 'liga' && parts[1]) return { name: 'league', id: decodeURIComponent(parts[1]), invite: true };
  return { name: 'home' };
}
function onRoute() {
  route = parseRoute(); modal = null;
  if (!me) { render(); return; }
  if (route.name === 'league') openLeague(route.id);
  else { stopLeague(); leagueId = null; loadMyLeagues(); }
  render();
}
window.addEventListener('hashchange', onRoute);
if (configured) {
  onAuthStateChanged(auth, u => { me = u ? u.uid : null; meUser = u; authReady = true; onRoute(); });
  // Estadísticas y calendario compartidos por todas las ligas
  onSnapshot(collection(fdb, 'stats'), q => { stats = {}; q.docs.forEach(d => stats[d.id] = d.data()); computePoints(); render(); }, err => console.error(err));
  onSnapshot(doc(fdb, 'meta', 'calendar'), s => { calendar = s.exists() ? s.data() : null; render(); }, err => console.error(err));
  setTimeout(autoCheck, 5000); setInterval(() => { autoCheck(); if (tab === 'mercado' && !modal && route.name === 'league') render(); }, 60000);
} else render();
