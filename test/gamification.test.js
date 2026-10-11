import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GamificationEngine, levelFromXp } from '../server/gamification.js';
import { MockClient } from '../server/mock.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'arena-'));

test('niveaux : paliers quadratiques', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(99).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(400).level, 3);
  assert.equal(levelFromXp(899).level, 3);
  assert.equal(levelFromXp(900).level, 4);
});

async function setup() {
  const client = new MockClient();
  const engine = new GamificationEngine({ dataDir: tmp() });
  const ctx = { stages: await client.getStages(), pipelines: await client.getPipelines(), userIds: [1, 2, 3] };
  const sync = async () => engine.sync({ deals: await client.getDeals(), activities: await client.getActivities(), ...ctx });
  await sync(); // premier instantané, aucune récompense
  return { client, engine, sync };
}

test('la première synchronisation ne récompense pas le passé', async () => {
  const { engine } = await setup();
  assert.equal(engine.user(1).xp, 0);
});

test('avancer une affaire, terminer un appel et gagner rapportent des XP', async () => {
  const { client, engine, sync } = await setup();
  const deal = (await client.getDeals()).find((d) => d.stage_id === 13 && d.status === 'open');
  await client.updateDeal(deal.id, { stage_id: 14 });
  let events = await sync();
  assert.ok(events.some((e) => e.type === 'stage_advanced' && e.xp === 15));
  const act = (await client.getActivities()).find((a) => !a.done && a.type === 'call' && a.owner_id === 1);
  await client.updateActivity(act.id, { done: true });
  events = await sync();
  assert.ok(events.some((e) => e.type === 'activity_call' && e.xp === 15));
  await client.updateDeal(deal.id, { status: 'won' });
  events = await sync();
  const won = events.find((e) => e.type === 'deal_won');
  assert.ok(won);
  assert.equal(won.xp, 100 + Math.min(200, Math.floor(deal.value / 10)));
  assert.ok(engine.user(1).xp >= 130);
});

test('reculer une affaire ne rapporte rien', async () => {
  const { client, sync } = await setup();
  const deal = (await client.getDeals()).find((d) => d.stage_id === 16 && d.status === 'open');
  await client.updateDeal(deal.id, { stage_id: 14 });
  const events = await sync();
  assert.equal(events.filter((e) => e.type === 'stage_advanced').length, 0);
});

test('un impayé régularisé vaut 60 XP et débloque le badge Sauveteur', async () => {
  const { client, engine, sync } = await setup();
  const deal = (await client.getDeals()).find((d) => d.pipeline_id === 4);
  await client.updateDeal(deal.id, { status: 'won' });
  const events = await sync();
  assert.ok(events.some((e) => e.type === 'impaye_resolved' && e.xp === 60));
  assert.ok(events.some((e) => e.type === 'badge' && e.badge === 'impaye_1'));
  assert.ok(engine.user(deal.owner_id).badges.impaye_1);
});

test('les missions du jour progressent et se valident', async () => {
  const { client, engine, sync } = await setup();
  const q = engine.questsFor(1);
  assert.equal(q.daily.length, 3);
  assert.equal(q.weekly.id, 'weekly_win');
  const deal = (await client.getDeals()).find((d) => d.pipeline_id === 3 && d.status === 'open' && d.owner_id === 1);
  await client.updateDeal(deal.id, { status: 'won' });
  const events = await sync();
  assert.ok(events.some((e) => e.type === 'weekly_quest' && e.xp === 150));
  assert.equal(engine.questsFor(1).weekly.completed, true);
});

test("l'état est persisté sur disque", async () => {
  const dir = tmp();
  const client = new MockClient();
  const e1 = new GamificationEngine({ dataDir: dir });
  const ctx = { stages: await client.getStages(), pipelines: await client.getPipelines(), userIds: [1] };
  e1.sync({ deals: await client.getDeals(), activities: await client.getActivities(), ...ctx });
  e1.noteAdded(1, 1000, 'Test');
  const e2 = new GamificationEngine({ dataDir: dir });
  assert.equal(e2.user(1).xp, 5);
});
