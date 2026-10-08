// Cierre diario de mercado (20:00 de Argentina) para TODAS las ligas:
// 1) resuelve las pujas de cada liga y abre un mercado nuevo,
// 2) recalcula un único precio por jugador con la demanda de todo el juego y el rendimiento en la cancha.
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = getFirestore(admin.app(), process.env.FIRESTORE_DATABASE || 'default');
const gha = !!process.env.GITHUB_ACTIONS;
const note = m => console.log((gha ? '::notice::' : '') + m);
const FORCE = process.env.FORCE === 'true';
const DRY = process.env.DRY === 'true'; // prueba: calcula todo sin guardar nada

// Motor compartido con el sitio (catálogo, valor inicial, puntos, sorteo de mercado)
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data.js', 'fmdata.js', 'engine.js']) vm.runInContext(readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const E = ctx.ENGINE; const { PL, ALL } = E;

// Reglas de precio (por cierre diario)
const RULE = { perBidder: 0.015, perBuy: 0.03, perSell: 0.035, noMinutes: -0.07, maxMove: 0.25 };
const perfPct = pts => Math.max(-0.08, Math.min(0.15, (pts - 4) * 0.012));

async function main() {
  const now = Date.now();
  const gRef = db.doc('market/global');
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : { prices: {}, prev: {}, hist: {}, lastUpdate: now - 24 * 3600e3, log: [] };
  const since = g.lastUpdate || 0;
  if (!FORCE && !DRY && now - since < 20 * 3600e3) { note(`El mercado ya se cerró hace ${Math.round((now - since) / 36e5)} h; no se repite.`); return; }

  // Estadísticas: suma jugadores nuevos al catálogo y calcula puntos
  const statsSnap = await db.collection('stats').get();
  const stats = {}; statsSnap.forEach(d => stats[d.id] = d.data());
  const { playerLog } = E.computePoints(stats);
  const P = id => (g.prices && g.prices[id]) || PL[id].base;

  // 1) Cada liga: pujas, fichajes y mercado nuevo
  const bidders = {}, buys = {}, sells = {};
  const leagues = await db.collection('leagues').get();
  let nAwards = 0;
  for (const lg of leagues.docs) {
    try {
      const res = await db.runTransaction(async tx => {
        const ls = await tx.get(lg.ref); const L = ls.data(); if (!L) return null;
        const ids = L.members || [];
        const mRefs = ids.map(u => lg.ref.collection('members').doc(u)), bRefs = ids.map(u => lg.ref.collection('bids').doc(u));
        const snaps = ids.length ? await tx.getAll(...mRefs, ...bRefs) : [];
        const mg = {}, bd = {};
        ids.forEach((u, i) => { if (snaps[i].exists) mg[u] = snaps[i].data(); if (snaps[ids.length + i].exists) bd[u] = snaps[ids.length + i].data(); });
        const st = L.state || {}; const round = st.round || 1; const own = { ...(L.owned || {}) };
        const local = { bidders: {}, buys: {}, sells: {} };
        const offers = {};
        for (const [u, b] of Object.entries(bd)) { if (b.round !== round || !mg[u]) continue;
          for (const [pid, o] of Object.entries(b.bids || {})) { if (!PL[pid]) continue; local.bidders[pid] = (local.bidders[pid] || 0) + 1; if ((st.market || []).includes(pid) && !own[pid]) (offers[pid] = offers[pid] || []).push({ uid: u, a: o.a, t: o.t || 0 }); } }
        const budget = {}; for (const [u, m] of Object.entries(mg)) budget[u] = m.cash || 0;
        const order = Object.keys(offers).sort((x, y) => Math.max(...offers[y].map(o => o.a)) - Math.max(...offers[x].map(o => o.a)));
        const awards = [];
        for (const pid of order) { const w = offers[pid].sort((x, y) => y.a - x.a || x.t - y.t).find(o => budget[o.uid] >= o.a && o.a >= P(pid)); if (w) { budget[w.uid] -= w.a; own[pid] = w.uid; awards.push({ pid, uid: w.uid, a: w.a }); local.buys[pid] = (local.buys[pid] || 0) + 1; } }
        for (const m of Object.values(mg)) for (const x of (m.sells || [])) if ((x.t ? x.t > since : x.r === round)) local.sells[x.pid] = (local.sells[x.pid] || 0) + 1;
        for (const a of awards) { const m = mg[a.uid]; m.squad = [...new Set((m.squad || []).concat([a.pid]))]; m.cash = (m.cash || 0) - a.a; }
        for (const u of new Set(awards.map(a => a.uid))) { if (!DRY) tx.update(lg.ref.collection('members').doc(u), { squad: mg[u].squad, cash: mg[u].cash }); }
        const s = { marketSize: 14, ...(L.settings || {}) };
        const ns = { ...st, round: round + 1, lastUpdate: now, market: E.genMarket(own, s.marketSize, P), lastAwards: awards };
        delete ns.prices; delete ns.prev; delete ns.hist;
        const log = (ns.log || []).slice();
        for (const a of awards) log.push({ t: now, x: `${mg[a.uid].name} fichó a ${PL[a.pid].name} por ${(a.a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M€.` });
        log.push({ t: now, x: `Cierre de las 20:00: ${awards.length} fichaje${awards.length === 1 ? '' : 's'} y mercado nuevo.` });
        ns.log = log.slice(-60);
        if (!DRY) tx.update(lg.ref, { state: ns, owned: own });
        return { local, n: awards.length };
      });
      if (res) { nAwards += res.n; for (const k of ['bidders', 'buys', 'sells']) for (const [pid, c] of Object.entries(res.local[k])) ({ bidders, buys, sells })[k][pid] = (({ bidders, buys, sells })[k][pid] || 0) + c; }
    } catch (e) { console.log((gha ? '::warning::' : '') + `Liga ${lg.id}: ${e.message}`); }
  }

  // 2) Precio único para todas las ligas
  const teamsPlayed = new Set(); for (const d of Object.values(stats)) if ((d.ts || 0) > since) { teamsPlayed.add(d.h); teamsPlayed.add(d.a); }
  const perf = {}; for (const [pid, L] of Object.entries(playerLog)) for (const x of L) if (x.ts > since) perf[pid] = (perf[pid] || 0) + x.total;
  const prices = {}, prev = {}, hist = g.hist || {}; const moves = [];
  for (const p of ALL) {
    const old = P(p.id);
    let pct = RULE.perBidder * (bidders[p.id] || 0) + RULE.perBuy * (buys[p.id] || 0) - RULE.perSell * (sells[p.id] || 0);
    if (perf[p.id] !== undefined) pct += perfPct(perf[p.id]);
    else if (teamsPlayed.has(p.team)) pct += RULE.noMinutes;
    pct = Math.max(-RULE.maxMove, Math.min(RULE.maxMove, pct));
    const nv = Math.max(50000, Math.round(old * (1 + pct) / 1000) * 1000);
    if (nv !== p.base) prices[p.id] = nv;
    if (nv !== old) { prev[p.id] = old; hist[p.id] = (hist[p.id] || []).concat([old]).slice(-14); moves.push([p.id, (nv - old) / old]); }
  }
  moves.sort((x, y) => y[1] - x[1]);
  const fmt = ([id, x]) => `${PL[id].name} ${x > 0 ? '+' : ''}${(x * 100).toFixed(1).replace('.', ',')}%`;
  const ups = moves.filter(m => m[1] > 0).slice(0, 5), downs = moves.filter(m => m[1] < 0).slice(-5).reverse();
  const log = (g.log || []).concat([{ t: now, x: `Suben: ${ups.map(fmt).join(', ') || 'nadie'}. Bajan: ${downs.map(fmt).join(', ') || 'nadie'}.` }]).slice(-30);
  if (!DRY) await gRef.set({ prices, prev, hist, lastUpdate: now, log, demand: { bidders, buys, sells } });
  note(`${DRY ? '[PRUEBA, sin guardar] ' : ''}Cierre listo: ${leagues.size} ligas, ${nAwards} fichajes, ${Object.values(sells).reduce((a, b) => a + b, 0)} ventas, ${moves.length} precios cambiados.`);
  if (ups.length) note('Suben: ' + ups.map(fmt).join(', '));
  if (downs.length) note('Bajan: ' + downs.map(fmt).join(', '));
}
try { await main(); process.exit(0); }
catch (e) { console.log((gha ? '::error::' : '') + 'El cierre de mercado falló: ' + (e.details || e.message)); process.exit(1); }
