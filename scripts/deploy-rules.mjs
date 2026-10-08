// Publica firestore.rules en la base de Firestore del proyecto (incluso si no se llama "(default)").
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const project = sa.project_id; const database = process.env.FIRESTORE_DATABASE || 'default';
const gha = !!process.env.GITHUB_ACTIONS; const out = (k, m) => console.log((gha ? `::${k}::` : '') + m);
const { access_token } = await admin.credential.cert(sa).getAccessToken();
const api = async (method, path, body) => {
  const r = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, { method, headers: { authorization: 'Bearer ' + access_token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j.error?.message || ''}`); return j;
};
try {
  const rs = await api('POST', `projects/${project}/rulesets`, { source: { files: [{ name: 'firestore.rules', content: readFileSync('firestore.rules', 'utf8') }] } });
  const name = `projects/${project}/releases/cloud.firestore/${database}`;
  try { await api('PATCH', name, { release: { name, rulesetName: rs.name } }); }
  catch (e) { await api('POST', `projects/${project}/releases`, { name, rulesetName: rs.name }); }
  out('notice', `Reglas publicadas en la base "${database}" (${rs.name.split('/').pop()}).`);
} catch (e) { out('error', 'No se pudieron publicar las reglas: ' + e.message); process.exit(1); }
