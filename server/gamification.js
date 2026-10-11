// Moteur de gamification : transforme les changements observés dans Pipedrive
// (affaires avancées, gagnées, activités terminées, impayés résolus...) en XP,
// niveaux, badges, missions quotidiennes et classement.
import fs from 'node:fs';
import path from 'node:path';
import { DEAL_FIELDS } from './fields.js';
import { classifyPipeline } from './fields.js';

export const XP_RULES = {
  deal_created: { xp: 20, label: 'Nouvelle affaire créée', icon: '🆕' },
  stage_advanced: { xp: 15, label: 'Affaire avancée dans le pipeline', icon: '⏩' },
  deal_won: { xp: 100, label: 'Affaire gagnée', icon: '🏆' },
  deal_lost: { xp: 5, label: 'Affaire clôturée (perdue) — pipeline propre', icon: '🧹' },
  activity_call: { xp: 15, label: 'Appel passé', icon: '📞' },
  activity_meeting: { xp: 25, label: 'Rendez-vous réalisé', icon: '🤝' },
  activity_done: { xp: 10, label: 'Activité terminée', icon: '✅' },
  note_added: { xp: 5, label: 'Note ajoutée', icon: '📝' },
  impaye_progress: { xp: 20, label: 'Dossier impayé qui progresse', icon: '🚑' },
  impaye_resolved: { xp: 60, label: 'Impayé régularisé — contrat sauvé', icon: '🛟' },
  sinistre_progress: { xp: 15, label: 'Sinistre qui progresse', icon: '🔧' },
  sinistre_closed: { xp: 40, label: 'Sinistre clôturé', icon: '🏁' },
  renewal: { xp: 50, label: 'Contrat reconduit', icon: '🔁' },
  portfolio_progress: { xp: 10, label: 'Suivi de portefeuille', icon: '📂' },
  quest_completed: { xp: 30, label: 'Mission accomplie', icon: '🎯' },
  weekly_quest: { xp: 150, label: 'Mission hebdomadaire accomplie', icon: '🌟' },
  streak_bonus: { xp: 10, label: 'Bonus de série', icon: '🔥' },
};

export const LEVEL_TITLES = [
  'Stagiaire', 'Conseiller junior', 'Conseiller', 'Chargé de clientèle', 'Courtier confirmé',
  'Courtier senior', 'Expert IARD', 'Maître courtier', 'Stratège du risque', 'Légende du cabinet',
];

export function levelFromXp(xp) {
  // Niveau n atteint à 100 * (n-1)^2 XP : 0, 100, 400, 900, 1600, 2500...
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  const current = 100 * (level - 1) ** 2;
  const next = 100 * level ** 2;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xp, xpInLevel: xp - current, xpForLevel: next - current, next,
    progress: Math.min(1, (xp - current) / (next - current)),
  };
}

export const BADGES = [
  { id: 'first_win', name: 'Première signature', icon: '🥇', desc: 'Gagner votre première affaire', check: (s) => s.won >= 1 },
  { id: 'win_5', name: 'Closer', icon: '🎯', desc: 'Gagner 5 affaires', check: (s) => s.won >= 5 },
  { id: 'win_25', name: 'Machine à signer', icon: '🚀', desc: 'Gagner 25 affaires', check: (s) => s.won >= 25 },
  { id: 'rcd_5', name: 'Maître décennale', icon: '🏗️', desc: 'Placer 5 contrats RC Décennale', check: (s) => s.wonRcd >= 5 },
  { id: 'big_deal', name: 'Gros risque', icon: '💎', desc: 'Gagner une affaire de plus de 3 000 € de prime', check: (s) => s.maxWonValue >= 3000 },
  { id: 'calls_20', name: 'Standardiste', icon: '📞', desc: 'Passer 20 appels', check: (s) => s.calls >= 20 },
  { id: 'meetings_10', name: 'Terrain', icon: '🤝', desc: 'Réaliser 10 rendez-vous', check: (s) => s.meetings >= 10 },
  { id: 'activities_50', name: 'Infatigable', icon: '⚡', desc: 'Terminer 50 activités', check: (s) => s.activities >= 50 },
  { id: 'streak_3', name: 'Échauffement', icon: '🔥', desc: '3 jours d’activité consécutifs', check: (s) => s.bestStreak >= 3 },
  { id: 'streak_7', name: 'Marathonien', icon: '🏃', desc: '7 jours d’activité consécutifs', check: (s) => s.bestStreak >= 7 },
  { id: 'streak_30', name: 'Inarrêtable', icon: '🌋', desc: '30 jours d’activité consécutifs', check: (s) => s.bestStreak >= 30 },
  { id: 'impaye_1', name: 'Sauveteur', icon: '🛟', desc: 'Régulariser un premier impayé', check: (s) => s.impayesResolved >= 1 },
  { id: 'impaye_10', name: 'Garde-côte', icon: '⚓', desc: 'Régulariser 10 impayés', check: (s) => s.impayesResolved >= 10 },
  { id: 'sinistre_1', name: 'Réparateur', icon: '🔧', desc: 'Clôturer un premier sinistre', check: (s) => s.sinistresClosed >= 1 },
  { id: 'renew_5', name: 'Fidélisation', icon: '🔁', desc: 'Reconduire 5 contrats', check: (s) => s.renewals >= 5 },
  { id: 'notes_25', name: 'Mémoire du cabinet', icon: '📝', desc: 'Rédiger 25 notes', check: (s) => s.notes >= 25 },
  { id: 'quests_10', name: 'Chasseur de missions', icon: '🗺️', desc: 'Accomplir 10 missions du jour', check: (s) => s.quests >= 10 },
  { id: 'level_5', name: 'Courtier confirmé', icon: '🎓', desc: 'Atteindre le niveau 5', check: (s) => s.level >= 5 },
  { id: 'level_10', name: 'Légende', icon: '👑', desc: 'Atteindre le niveau 10', check: (s) => s.level >= 10 },
  { id: 'clean_pipeline', name: 'Pipeline impeccable', icon: '✨', desc: 'Aucune affaire pourrie dans le pipeline commercial', check: (s) => s.rottenNow === 0 && s.openCommercial >= 3 },
];

const QUEST_TEMPLATES = [
  { id: 'activities_3', name: 'Terminer 3 activités', icon: '✅', target: 3, metric: 'activities' },
  { id: 'calls_2', name: 'Passer 2 appels', icon: '📞', target: 2, metric: 'calls' },
  { id: 'advance_2', name: 'Faire avancer 2 affaires', icon: '⏩', target: 2, metric: 'advanced' },
  { id: 'deal_1', name: 'Créer 1 nouvelle affaire', icon: '🆕', target: 1, metric: 'created' },
  { id: 'notes_2', name: 'Rédiger 2 notes de suivi', icon: '📝', target: 2, metric: 'notes' },
  { id: 'rotten_1', name: 'Relancer 1 affaire en sommeil', icon: '🧟', target: 1, metric: 'rottenHandled' },
  { id: 'impaye_1', name: 'Faire avancer 1 dossier impayé', icon: '🚑', target: 1, metric: 'impayes' },
  { id: 'meeting_1', name: 'Réaliser 1 rendez-vous', icon: '🤝', target: 1, metric: 'meetings' },
];
const WEEKLY_QUEST = { id: 'weekly_win', name: 'Gagner 1 affaire cette semaine', icon: '🌟', target: 1, metric: 'won' };

const today = () => new Date().toISOString().slice(0, 10);
const weekKey = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil(((date - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function emptyUser() {
  return { xp: 0, events: [], badges: {}, streak: 0, bestStreak: 0, lastActiveDate: null, questsCompleted: 0, completedQuests: {} };
}

export class GamificationEngine {
  constructor({ dataDir, fields = DEAL_FIELDS }) {
    this.file = path.join(dataDir, 'gamification.json');
    this.fields = fields;
    this.state = this.load();
  }

  load() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { users: {}, snapshot: null, quests: {}, lastSync: null }; }
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state));
  }
  user(id) { return (this.state.users[id] ||= emptyUser()); }

  award(userId, type, { ref, label, bonus = 0, when } = {}) {
    const rule = XP_RULES[type];
    if (!rule || !userId) return null;
    const u = this.user(userId);
    const ev = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, xp: rule.xp + bonus, label: label || rule.label, icon: rule.icon, ref: ref || null, at: when || new Date().toISOString() };
    const before = levelFromXp(u.xp).level;
    u.xp += ev.xp;
    u.events.unshift(ev);
    if (u.events.length > 500) u.events.length = 500;
    this.touchStreak(u, ev.at.slice(0, 10));
    const after = levelFromXp(u.xp).level;
    if (after > before) ev.levelUp = levelFromXp(u.xp);
    return ev;
  }

  touchStreak(u, day) {
    if (u.lastActiveDate === day) return;
    if (u.lastActiveDate && daysBetween(u.lastActiveDate, day) === 1) u.streak += 1;
    else if (!u.lastActiveDate || daysBetween(u.lastActiveDate, day) > 1) u.streak = 1;
    u.lastActiveDate = day;
    u.bestStreak = Math.max(u.bestStreak, u.streak);
  }

  // Compare l'état Pipedrive courant au dernier instantané et attribue l'XP.
  sync({ deals, activities, stages, pipelines, userIds }) {
    const stageById = Object.fromEntries(stages.map((s) => [s.id, s]));
    const pipeKind = Object.fromEntries(pipelines.map((p) => [p.id, classifyPipeline(p.name)]));
    const prev = this.state.snapshot;
    const events = [];
    const first = !prev; // premier lancement : on construit l'instantané sans récompenser le passé
    const snap = { deals: {}, activities: {}, at: new Date().toISOString() };

    for (const d of deals) {
      snap.deals[d.id] = { stage: d.stage_id, status: d.status, pipeline: d.pipeline_id, value: d.value, stageChange: d.stage_change_time };
      if (first) continue;
      const p = prev.deals[d.id];
      const kind = pipeKind[d.pipeline_id] || 'commercial';
      const owner = d.owner_id;
      const title = d.title;
      if (!p) {
        if (d.status === 'open') events.push(this.award(owner, 'deal_created', { ref: { deal: d.id }, label: `Nouvelle affaire : ${title}` }));
        continue;
      }
      if (p.status !== d.status) {
        if (d.status === 'won') {
          if (kind === 'impayes') events.push(this.award(owner, 'impaye_resolved', { ref: { deal: d.id }, label: `Impayé régularisé : ${title}` }));
          else if (kind === 'sinistres') events.push(this.award(owner, 'sinistre_closed', { ref: { deal: d.id }, label: `Sinistre clôturé : ${title}` }));
          else if (kind === 'portefeuille') events.push(this.award(owner, 'renewal', { ref: { deal: d.id }, label: `Contrat reconduit : ${title}` }));
          else {
            const bonus = Math.min(200, Math.floor((Number(d.value) || 0) / 10));
            events.push(this.award(owner, 'deal_won', { ref: { deal: d.id, value: d.value }, bonus, label: `Affaire gagnée : ${title}` }));
          }
        } else if (d.status === 'lost') {
          events.push(this.award(owner, 'deal_lost', { ref: { deal: d.id }, label: `Affaire perdue clôturée : ${title}` }));
        }
      } else if (p.stage !== d.stage_id && d.status === 'open') {
        const from = stageById[p.stage], to = stageById[d.stage_id];
        const forward = !from || !to || from.pipeline_id !== to.pipeline_id || (to.order_nr ?? 0) > (from.order_nr ?? 0);
        if (forward) {
          const wasRotten = from?.days_to_rotten && p.stageChange && daysBetween(p.stageChange, new Date()) > from.days_to_rotten;
          const map = { commercial: 'stage_advanced', impayes: 'impaye_progress', sinistres: 'sinistre_progress', portefeuille: 'portfolio_progress' };
          const ev = this.award(owner, map[kind], { ref: { deal: d.id, rotten: !!wasRotten, stage: d.stage_id }, label: `${title} → ${to?.name || 'étape suivante'}` });
          events.push(ev);
          if (kind === 'portefeuille' && /reconduit/i.test(to?.name || '')) events.push(this.award(owner, 'renewal', { ref: { deal: d.id }, label: `Contrat reconduit : ${title}` }));
          if (kind === 'sinistres' && /cl[ôo]tur/i.test(to?.name || '')) events.push(this.award(owner, 'sinistre_closed', { ref: { deal: d.id }, label: `Sinistre clôturé : ${title}` }));
        }
      }
    }

    for (const a of activities) {
      snap.activities[a.id] = { done: !!a.done };
      if (first) continue;
      const p = prev.activities[a.id];
      if (a.done && !(p && p.done)) {
        const t = a.type === 'call' ? 'activity_call' : a.type === 'meeting' || a.type === 'lunch' ? 'activity_meeting' : 'activity_done';
        events.push(this.award(a.owner_id, t, { ref: { activity: a.id, deal: a.deal_id, type: a.type }, label: `${XP_RULES[t].label} : ${a.subject}` }));
      }
    }

    this.state.snapshot = snap;
    this.state.lastSync = snap.at;
    const out = events.filter(Boolean);
    for (const id of new Set([...userIds, ...out.map((e) => e.ref?.owner).filter(Boolean)])) this.ensureQuests(id);
    for (const id of Object.keys(this.state.users)) out.push(...this.checkQuests(Number(id)));
    const stats = this.computeStatsContext({ deals, stages, pipeKind });
    for (const id of Object.keys(this.state.users)) out.push(...this.checkBadges(Number(id), stats));
    this.save();
    return out;
  }

  noteAdded(userId, dealId, title) {
    const ev = this.award(userId, 'note_added', { ref: { deal: dealId }, label: `Note ajoutée : ${title || dealId}` });
    const extra = [...this.checkQuests(userId), ...this.checkBadges(userId, this.lastStatsContext || {})];
    this.save();
    return [ev, ...extra];
  }

  // ---- Missions ----
  ensureQuests(userId) {
    const day = today();
    const q = (this.state.quests[userId] ||= {});
    if (q.date !== day) {
      // Sélection déterministe de 3 missions selon le jour (variété d'un jour à l'autre)
      const seed = Number(day.replace(/-/g, '')) + Number(userId);
      const pool = [...QUEST_TEMPLATES];
      const picked = [];
      let s = seed;
      while (picked.length < 3 && pool.length) { s = (s * 9301 + 49297) % 233280; picked.push(pool.splice(s % pool.length, 1)[0]); }
      q.date = day; q.daily = picked.map((t) => ({ ...t, completed: false }));
    }
    if (q.week !== weekKey()) { q.week = weekKey(); q.weekly = { ...WEEKLY_QUEST, completed: false }; }
  }

  todayMetrics(userId, since) {
    const u = this.user(userId);
    const m = { activities: 0, calls: 0, meetings: 0, advanced: 0, created: 0, notes: 0, rottenHandled: 0, impayes: 0, won: 0 };
    for (const e of u.events) {
      if (e.at < since) break;
      if (e.type.startsWith('activity_')) m.activities++;
      if (e.type === 'activity_call') m.calls++;
      if (e.type === 'activity_meeting') m.meetings++;
      if (e.type === 'stage_advanced') { m.advanced++; if (e.ref?.rotten) m.rottenHandled++; }
      if (e.type === 'deal_created') m.created++;
      if (e.type === 'note_added') m.notes++;
      if (e.type === 'impaye_progress' || e.type === 'impaye_resolved') m.impayes++;
      if (e.type === 'deal_won') m.won++;
    }
    return m;
  }

  questsFor(userId) {
    this.ensureQuests(userId);
    const q = this.state.quests[userId];
    const daily = this.todayMetrics(userId, q.date + 'T00:00:00');
    const weekStart = (() => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10) + 'T00:00:00'; })();
    const weekly = this.todayMetrics(userId, weekStart);
    return {
      date: q.date,
      daily: q.daily.map((t) => ({ ...t, progress: Math.min(t.target, daily[t.metric] || 0), reward: XP_RULES.quest_completed.xp })),
      weekly: { ...q.weekly, progress: Math.min(q.weekly.target, weekly[q.weekly.metric] || 0), reward: XP_RULES.weekly_quest.xp },
    };
  }

  checkQuests(userId) {
    const out = [];
    const q = this.questsFor(userId);
    const stored = this.state.quests[userId];
    const u = this.user(userId);
    q.daily.forEach((t, i) => {
      if (!t.completed && t.progress >= t.target) {
        stored.daily[i].completed = true; u.questsCompleted++;
        out.push(this.award(userId, 'quest_completed', { ref: { quest: t.id }, label: `Mission accomplie : ${t.name}` }));
      }
    });
    if (!q.weekly.completed && q.weekly.progress >= q.weekly.target) {
      stored.weekly.completed = true; u.questsCompleted++;
      out.push(this.award(userId, 'weekly_quest', { ref: { quest: q.weekly.id }, label: `Mission hebdo accomplie : ${q.weekly.name}` }));
    }
    return out;
  }

  // ---- Badges ----
  computeStatsContext({ deals, stages, pipeKind }) {
    const stageById = Object.fromEntries(stages.map((s) => [s.id, s]));
    const ctx = { perUser: {} };
    for (const d of deals) {
      const u = (ctx.perUser[d.owner_id] ||= { won: 0, wonRcd: 0, maxWonValue: 0, rottenNow: 0, openCommercial: 0 });
      const kind = pipeKind[d.pipeline_id];
      if (d.status === 'won' && kind === 'commercial') {
        u.won++; u.maxWonValue = Math.max(u.maxWonValue, Number(d.value) || 0);
        if (Number(d.custom_fields?.[this.fields.typeGarantie]) === 53) u.wonRcd++;
      }
      if (d.status === 'open' && kind === 'commercial') {
        u.openCommercial++;
        const st = stageById[d.stage_id];
        if (st?.days_to_rotten && d.stage_change_time && daysBetween(d.stage_change_time, new Date()) > st.days_to_rotten) u.rottenNow++;
      }
    }
    this.lastStatsContext = ctx;
    return ctx;
  }

  statsFor(userId, ctx = this.lastStatsContext || { perUser: {} }) {
    const u = this.user(userId);
    const count = (t) => u.events.filter((e) => e.type === t).length;
    const base = ctx.perUser?.[userId] || { won: 0, wonRcd: 0, maxWonValue: 0, rottenNow: 0, openCommercial: 0 };
    return {
      ...base,
      won: Math.max(base.won, count('deal_won')),
      calls: count('activity_call'), meetings: count('activity_meeting'),
      activities: u.events.filter((e) => e.type.startsWith('activity_')).length,
      notes: count('note_added'), impayesResolved: count('impaye_resolved'), sinistresClosed: count('sinistre_closed'), renewals: count('renewal'),
      quests: u.questsCompleted, bestStreak: u.bestStreak, streak: u.streak, level: levelFromXp(u.xp).level,
    };
  }

  checkBadges(userId, ctx) {
    const u = this.user(userId);
    const s = this.statsFor(userId, ctx);
    const out = [];
    for (const b of BADGES) {
      if (!u.badges[b.id] && b.check(s)) {
        u.badges[b.id] = new Date().toISOString();
        out.push({ id: `badge-${b.id}-${Date.now()}`, type: 'badge', badge: b.id, xp: 0, label: `Badge débloqué : ${b.name}`, icon: b.icon, at: u.badges[b.id] });
      }
    }
    return out;
  }

  profile(userId, users = []) {
    const u = this.user(userId);
    const lvl = levelFromXp(u.xp);
    const stats = this.statsFor(userId);
    const todayXp = u.events.filter((e) => e.at.slice(0, 10) === today()).reduce((a, e) => a + e.xp, 0);
    const weekStart = (() => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10); })();
    const weekXp = u.events.filter((e) => e.at.slice(0, 10) >= weekStart).reduce((a, e) => a + e.xp, 0);
    return {
      userId, ...lvl, streak: u.streak, bestStreak: u.bestStreak, todayXp, weekXp,
      badges: BADGES.map((b) => ({ id: b.id, name: b.name, icon: b.icon, desc: b.desc, unlockedAt: u.badges[b.id] || null })),
      quests: this.questsFor(userId),
      recentEvents: u.events.slice(0, 30),
      stats,
      leaderboard: users.map((usr) => {
        const uu = this.state.users[usr.id] || emptyUser();
        const wk = uu.events.filter((e) => e.at.slice(0, 10) >= weekStart).reduce((a, e) => a + e.xp, 0);
        return { id: usr.id, name: usr.name, xp: uu.xp, weekXp: wk, level: levelFromXp(uu.xp).level, title: levelFromXp(uu.xp).title, streak: uu.streak, badges: Object.keys(uu.badges).length, me: usr.id === userId };
      }).sort((a, b) => b.weekXp - a.weekXp || b.xp - a.xp),
    };
  }
}
