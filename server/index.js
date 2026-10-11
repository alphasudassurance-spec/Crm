import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PipedriveClient } from './pipedrive.js';
import { MockClient } from './mock.js';
import { GamificationEngine, XP_RULES, BADGES } from './gamification.js';
import { DEAL_FIELDS, ORG_FIELDS, classifyPipeline } from './fields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Chargement minimal du fichier .env (sans dépendance)
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* pas de .env */ }

const PORT = Number(process.env.PORT) || 3000;
const DEMO = process.env.DEMO_MODE === '1' || !process.env.PIPEDRIVE_API_TOKEN;
const SYNC_INTERVAL = Math.max(30, Number(process.env.SYNC_INTERVAL) || 60) * 1000;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

const client = DEMO
  ? new MockClient()
  : new PipedriveClient({ token: process.env.PIPEDRIVE_API_TOKEN, domain: process.env.PIPEDRIVE_COMPANY_DOMAIN });
const engine = new GamificationEngine({ dataDir: path.join(DATA_DIR, DEMO ? 'demo' : 'live') });

// ---- Cache des données de référence et de l'état courant ----
const ref = { me: null, users: [], pipelines: [], stages: [], fields: {}, loadedAt: 0 };
const cache = { deals: [], activities: [], persons: [], orgs: [], at: 0, syncing: null, lastError: null };
const CLOSED_WINDOW_DAYS = 120;

async function loadReference(force = false) {
  if (!force && ref.loadedAt && Date.now() - ref.loadedAt < 30 * 60 * 1000) return ref;
  const [me, users, pipelines, stages, fields] = await Promise.all([
    client.getMe(), client.getUsers().catch(() => []), client.getPipelines(), client.getStages(), client.getDealFields(),
  ]);
  ref.me = me;
  ref.users = (users.length ? users : [me]).filter((u) => u.active_flag !== false);
  ref.pipelines = pipelines.sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0)).map((p) => ({ ...p, kind: classifyPipeline(p.name) }));
  ref.stages = stages.sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0));
  ref.fields = fields;
  ref.loadedAt = Date.now();
  return ref;
}

async function sync() {
  if (cache.syncing) return cache.syncing;
  cache.syncing = (async () => {
    try {
      await loadReference();
      const since = new Date(Date.now() - CLOSED_WINDOW_DAYS * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const [deals, activities, persons, orgs] = await Promise.all([
        client.getDeals({ since }), client.getActivities({ since }), client.getPersons(), client.getOrganizations(),
      ]);
      cache.deals = deals; cache.activities = activities; cache.persons = persons; cache.orgs = orgs; cache.at = Date.now();
      cache.lastError = null;
      const events = engine.sync({ deals, activities, stages: ref.stages, pipelines: ref.pipelines, userIds: ref.users.map((u) => u.id) });
      pendingEvents.push(...events);
      return events;
    } catch (e) {
      cache.lastError = e.message;
      console.error('[sync]', e.message);
      return [];
    } finally { cache.syncing = null; }
  })();
  return cache.syncing;
}

// Événements non encore envoyés au client (pour afficher les toasts)
const pendingEvents = [];
function drainEvents() { return pendingEvents.splice(0, pendingEvents.length); }

// ---- Application ----
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(e.status && e.status >= 400 && e.status < 600 ? e.status : 500).json({ error: e.message, details: e.details });
});

app.get('/api/bootstrap', wrap(async (req, res) => {
  await loadReference();
  res.json({
    mode: client.mode, me: ref.me, users: ref.users, pipelines: ref.pipelines, stages: ref.stages, fields: ref.fields,
    fieldKeys: { deal: DEAL_FIELDS, org: ORG_FIELDS }, xpRules: XP_RULES, badges: BADGES.map(({ check, ...b }) => b),
    syncInterval: SYNC_INTERVAL,
  });
}));

app.get('/api/state', wrap(async (req, res) => {
  const force = req.query.force === '1';
  if (force || !cache.at || Date.now() - cache.at > SYNC_INTERVAL) await sync();
  const me = ref.me;
  res.json({
    syncedAt: cache.at, lastError: cache.lastError, mode: client.mode,
    deals: cache.deals, activities: cache.activities, persons: cache.persons, orgs: cache.orgs,
    gamification: engine.profile(me.id, ref.users),
    events: drainEvents(),
  });
}));

app.post('/api/sync', wrap(async (req, res) => {
  await loadReference(true);
  await sync();
  res.json({ ok: true, syncedAt: cache.at, events: drainEvents() });
}));

// Après chaque mutation, on resynchronise pour attribuer l'XP immédiatement.
async function afterMutation(res, result) {
  await sync();
  res.json({ result, events: drainEvents(), gamification: engine.profile(ref.me.id, ref.users) });
}

app.patch('/api/deals/:id', wrap(async (req, res) => {
  const allowed = ['stage_id', 'status', 'lost_reason', 'title', 'value', 'expected_close_date', 'person_id', 'org_id', 'owner_id', 'custom_fields', 'pipeline_id'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  if (patch.stage_id) patch.stage_id = Number(patch.stage_id);
  if (patch.value !== undefined) patch.value = Number(patch.value);
  const result = await client.updateDeal(Number(req.params.id), patch);
  await afterMutation(res, result);
}));

app.post('/api/deals', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title) throw Object.assign(new Error('Le titre est obligatoire'), { status: 400 });
  let person_id = b.person_id ? Number(b.person_id) : undefined;
  let org_id = b.org_id ? Number(b.org_id) : undefined;
  if (!org_id && b.org_name) org_id = (await client.createOrganization({ name: b.org_name })).id;
  if (!person_id && b.person_name) {
    person_id = (await client.createPerson({ name: b.person_name, org_id, emails: b.person_email ? [{ value: b.person_email, primary: true }] : undefined, phones: b.person_phone ? [{ value: b.person_phone, primary: true }] : undefined })).id;
  }
  const custom_fields = {};
  if (b.typeGarantie) custom_fields[DEAL_FIELDS.typeGarantie] = Number(b.typeGarantie);
  if (b.assureur) custom_fields[DEAL_FIELDS.assureur] = Number(b.assureur);
  if (b.value) custom_fields[DEAL_FIELDS.primeAnnuelle] = { value: Number(b.value), currency: 'EUR' };
  const data = { title: b.title, value: Number(b.value) || 0, currency: 'EUR', pipeline_id: Number(b.pipeline_id) || undefined, stage_id: Number(b.stage_id) || undefined, person_id, org_id, owner_id: ref.me.id, expected_close_date: b.expected_close_date || undefined };
  if (Object.keys(custom_fields).length) data.custom_fields = custom_fields;
  const result = await client.createDeal(data);
  await afterMutation(res, result);
}));

app.patch('/api/activities/:id', wrap(async (req, res) => {
  const allowed = ['done', 'subject', 'due_date', 'due_time', 'note', 'type'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  const result = await client.updateActivity(Number(req.params.id), patch);
  await afterMutation(res, result);
}));

app.post('/api/activities', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.subject) throw Object.assign(new Error('Le sujet est obligatoire'), { status: 400 });
  const deal = b.deal_id ? cache.deals.find((d) => d.id === Number(b.deal_id)) : null;
  const result = await client.createActivity({
    subject: b.subject, type: b.type || 'task', due_date: b.due_date || new Date().toISOString().slice(0, 10), due_time: b.due_time || undefined,
    deal_id: deal?.id, person_id: b.person_id ? Number(b.person_id) : deal?.person_id || undefined, org_id: b.org_id ? Number(b.org_id) : deal?.org_id || undefined,
    note: b.note || undefined, owner_id: ref.me.id,
  });
  await afterMutation(res, result);
}));

app.get('/api/deals/:id/notes', wrap(async (req, res) => {
  res.json({ notes: await client.getNotes(Number(req.params.id)) });
}));

app.post('/api/deals/:id/notes', wrap(async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (!content) throw Object.assign(new Error('La note est vide'), { status: 400 });
  const result = await client.addNote(Number(req.params.id), content);
  const deal = cache.deals.find((d) => d.id === Number(req.params.id));
  const events = engine.noteAdded(ref.me.id, Number(req.params.id), deal?.title).filter(Boolean);
  res.json({ result, events, gamification: engine.profile(ref.me.id, ref.users) });
}));

app.get('/api/health', (req, res) => res.json({ ok: true, mode: client.mode, syncedAt: cache.at }));

app.listen(PORT, async () => {
  console.log(`\n  ⚔️  Alpha Sud CRM Arena — http://localhost:${PORT}`);
  console.log(`  Mode : ${DEMO ? 'DÉMO (données fictives)' : 'PIPEDRIVE (' + (process.env.PIPEDRIVE_COMPANY_DOMAIN || 'api.pipedrive.com') + ')'}\n`);
  await sync();
  setInterval(sync, SYNC_INTERVAL).unref();
});
