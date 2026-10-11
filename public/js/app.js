import { api } from './api.js';
import { confetti } from './confetti.js';
import { esc, eur, eur2, fmtDate, fmtDateTime, today, daysBetween, daysUntil, initials, money, relTime, ACT_ICONS, ACT_LABELS, LOST_REASONS } from './util.js';

const S = { boot: null, state: null, view: 'qg', pipeline: null, drawer: null, notes: {}, sort: { key: 'echeance', dir: 1 }, polling: null, busy: false };
const $ = (sel, root = document) => root.querySelector(sel);
const F = () => S.boot.fieldKeys.deal;

// ------------------------------------------------------------------ Démarrage
async function init() {
  try {
    S.boot = await api.bootstrap();
    const badge = $('#mode-badge');
    badge.textContent = S.boot.mode === 'demo' ? 'Mode démo · données fictives' : `Pipedrive · ${S.boot.me?.company_name || 'connecté'}`;
    badge.className = 'brand-sub ' + (S.boot.mode === 'demo' ? 'demo' : 'live');
    if (!S.pipeline) S.pipeline = S.boot.pipelines[0]?.id;
    await refresh(false, true);
    S.polling = setInterval(() => refresh(false), S.boot.syncInterval || 60000);
  } catch (e) {
    $('#view').innerHTML = `<div class="banner err">Impossible de joindre le serveur : ${esc(e.message)}</div>`;
  }
}

async function refresh(force = false, first = false) {
  try {
    const st = await api.state(force);
    S.state = st;
    buildMaps();
    if (st.lastError) toast({ kind: 'err', icon: '⚠️', label: `Synchronisation Pipedrive : ${st.lastError}` });
    if (!first) handleEvents(st.events);
    render();
  } catch (e) { toast({ kind: 'err', icon: '⚠️', label: e.message }); }
}

function buildMaps() {
  const b = S.boot, st = S.state;
  S.m = {
    deal: Object.fromEntries(st.deals.map((d) => [d.id, d])),
    person: Object.fromEntries(st.persons.map((p) => [p.id, p])),
    org: Object.fromEntries(st.orgs.map((o) => [o.id, o])),
    stage: Object.fromEntries(b.stages.map((s) => [s.id, s])),
    pipeline: Object.fromEntries(b.pipelines.map((p) => [p.id, p])),
    user: Object.fromEntries(b.users.map((u) => [u.id, u])),
    stagesOf: (pid) => b.stages.filter((s) => s.pipeline_id === pid),
  };
}

// ------------------------------------------------------------------ Aides métier
const pipeKind = (id) => S.m.pipeline[id]?.kind || 'commercial';
const pipeByKind = (kind) => S.boot.pipelines.find((p) => p.kind === kind);
function rottenDays(d) {
  const s = S.m.stage[d.stage_id];
  if (!s?.days_to_rotten || d.status !== 'open' || !d.stage_change_time) return 0;
  const age = daysBetween(d.stage_change_time);
  return age > s.days_to_rotten ? age - s.days_to_rotten : 0;
}
const isRotten = (d) => rottenDays(d) > 0;
function fieldLabel(key, value) {
  if (value === null || value === undefined || value === '') return null;
  const f = S.boot.fields[key];
  if (f?.options) return f.options[value] ?? f.options[Number(value)] ?? String(value);
  if (typeof value === 'object') return eur2(value.value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return fmtDate(value);
  return String(value);
}
const cf = (d, k) => d.custom_fields?.[F()[k]];
const garantie = (d) => fieldLabel(F().typeGarantie, cf(d, 'typeGarantie'));
const assureur = (d) => fieldLabel(F().assureur, cf(d, 'assureur'));
const prime = (d) => money(cf(d, 'primeAnnuelle')) ?? d.value;
const echeance = (d) => cf(d, 'dateEcheance') || cf(d, 'dateEcheancePrime') || d.expected_close_date;
const contactName = (d) => S.m.org[d.org_id]?.name || S.m.person[d.person_id]?.name || '';
const openDeals = () => S.state.deals.filter((d) => d.status === 'open');
const dealsIn = (kind) => openDeals().filter((d) => pipeKind(d.pipeline_id) === kind);
const openActs = () => S.state.activities.filter((a) => !a.done);

// ------------------------------------------------------------------ Événements / toasts
function handleEvents(events = []) {
  for (const e of events) {
    if (e.type === 'badge') { toast({ kind: 'badge', icon: e.icon, label: e.label, xp: '🏅' }); confetti({ count: 80, power: 10 }); }
    else toast({ icon: e.icon, label: e.label, xp: `+${e.xp} XP` });
    if (e.type === 'deal_won') confetti({ count: 220, power: 16, spread: 90 });
    if (e.type === 'weekly_quest' || e.type === 'quest_completed') confetti({ count: 60, origin: { x: 0.85, y: 0.9 }, power: 12, spread: 60 });
    if (e.levelUp) setTimeout(() => levelUpModal(e.levelUp), 400);
  }
}
function toast({ kind = '', icon = '✨', label, xp = '' }) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="t-icon">${icon}</span><span class="t-label">${esc(label)}</span><span class="t-xp">${esc(xp)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, kind === 'err' ? 7000 : 4500);
}
function levelUpModal(lvl) {
  confetti({ count: 300, power: 18, spread: 120 });
  modal(`<div class="levelup"><div class="lu-icon">🎉</div><div class="muted">NIVEAU SUPÉRIEUR</div><h2>Niveau ${lvl.level} — ${esc(lvl.title)}</h2><p>Continuez comme ça ! Prochain palier à ${lvl.next} XP.</p><button class="btn primary" data-action="close-modal">Continuer</button></div>`);
}

// ------------------------------------------------------------------ Rendu général
function render() {
  if (!S.state) return;
  renderProfile();
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === S.view));
  const views = { qg: renderQG, pipeline: renderPipeline, agenda: renderAgenda, portefeuille: renderPortefeuille, trophees: renderTrophees };
  $('#view').innerHTML = (views[S.view] || renderQG)();
  if (S.view === 'pipeline') bindKanban();
  if (S.drawer) renderDrawer();
}

function renderProfile() {
  const g = S.state.gamification;
  $('#profile-chip').innerHTML = `
    <div class="streak" title="Jours consécutifs d'activité">🔥 ${g.streak}<small>série</small></div>
    <div class="avatar">${esc(initials(S.boot.me?.name))}<span class="lvl">${g.level}</span></div>
    <div class="profile-info">
      <div class="profile-title"><span>${esc(g.title)}</span><small>+${g.todayXp} XP auj.</small></div>
      <div class="xpbar"><i style="width:${Math.round(g.progress * 100)}%"></i></div>
      <div class="xp-text"><span>${g.xp} XP</span><span>Niv. ${g.level + 1} à ${g.next}</span></div>
    </div>
    <button class="sync-btn" data-action="sync" title="Synchroniser avec Pipedrive">🔄</button>`;
}

// ------------------------------------------------------------------ QG
function renderQG() {
  const g = S.state.gamification;
  const com = dealsIn('commercial');
  const weighted = com.reduce((a, d) => a + (Number(d.value) || 0) * ((S.m.stage[d.stage_id]?.deal_probability ?? 100) / 100), 0);
  const total = com.reduce((a, d) => a + (Number(d.value) || 0), 0);
  const monthStart = today().slice(0, 7) + '-01';
  const wonMonth = S.state.deals.filter((d) => d.status === 'won' && pipeKind(d.pipeline_id) === 'commercial' && (d.won_time || '') >= monthStart);
  const closed90 = S.state.deals.filter((d) => (d.status === 'won' || d.status === 'lost') && pipeKind(d.pipeline_id) === 'commercial');
  const conv = closed90.length ? Math.round(100 * closed90.filter((d) => d.status === 'won').length / closed90.length) : 0;
  const rotten = com.filter(isRotten);
  const impayes = dealsIn('impayes');
  const impayesMontant = impayes.reduce((a, d) => a + (Number(money(cf(d, 'montantImpaye'))) || 0), 0);
  const late = openActs().filter((a) => a.due_date < today());
  const todayActs = openActs().filter((a) => a.due_date === today());
  const ech90 = dealsIn('portefeuille').filter((d) => echeance(d) && daysUntil(echeance(d)) <= 90 && daysUntil(echeance(d)) >= 0);
  const rank = g.leaderboard.findIndex((r) => r.me) + 1;
  const q = g.quests;
  const unlocked = g.badges.filter((b) => b.unlockedAt);

  return `
  <div class="hero">
    <div class="avatar">${esc(initials(S.boot.me?.name))}<span class="lvl">${g.level}</span></div>
    <div>
      <h1>Bonjour ${esc((S.boot.me?.name || '').split(' ')[0])} 👋 <span class="rank">${esc(g.title)}</span></h1>
      <div class="muted small">Niveau ${g.level} · ${g.xp} XP · encore ${g.next - g.xp} XP avant le niveau ${g.level + 1}</div>
      <div class="xpbar"><i style="width:${Math.round(g.progress * 100)}%"></i></div>
      <div class="stats">
        <span class="chip">🔥 Série <b>${g.streak} j</b></span>
        <span class="chip">🏅 Badges <b>${unlocked.length}/${g.badges.length}</b></span>
        <span class="chip">🏆 Rang <b>#${rank || 1}</b> cette semaine</span>
        <span class="chip">🎯 Missions <b>${q.daily.filter((d) => d.completed).length}/${q.daily.length}</b></span>
      </div>
    </div>
    <div class="today"><div class="big">+${g.weekXp}</div><small>XP cette semaine</small></div>
  </div>

  ${S.state.lastError ? `<div class="banner err">⚠️ Dernière synchronisation Pipedrive en échec : ${esc(S.state.lastError)}</div>` : ''}

  <div class="grid kpis" style="margin-bottom:16px">
    ${kpi('Pipeline commercial', eur(total), `${com.length} affaires · pondéré ${eur(weighted)}`, '🧭')}
    ${kpi('Gagné ce mois', eur(wonMonth.reduce((a, d) => a + (Number(d.value) || 0), 0)), `${wonMonth.length} contrat${wonMonth.length > 1 ? 's' : ''} signé${wonMonth.length > 1 ? 's' : ''}`, '🏆', 'good')}
    ${kpi('Taux de conversion', `${conv} %`, `sur ${closed90.length} affaires clôturées`, '📈')}
    ${kpi('À relancer', rotten.length, 'affaires en sommeil', '🧟', rotten.length ? 'bad' : 'good')}
    ${kpi('Impayés en cours', impayes.length, `${eur(impayesMontant)} à régulariser`, '🚑', impayes.length ? 'warn' : 'good')}
    ${kpi('Échéances < 90 j', ech90.length, 'contrats à préparer', '📂', ech90.length ? 'warn' : '')}
    ${kpi('Agenda', `${todayActs.length} / ${late.length}`, 'aujourd’hui / en retard', '📅', late.length ? 'bad' : '')}
  </div>

  <div class="grid two">
    <div class="grid" style="align-content:start">
      <div class="card">
        <h2>🎯 Missions du jour <small>${fmtDate(q.date)} · +${q.daily[0]?.reward || 30} XP par mission</small></h2>
        ${q.daily.map(quest).join('')}
        <div style="margin-top:8px">${quest(q.weekly, true)}</div>
      </div>
      <div class="card">
        <h2>🧟 Affaires à relancer <small>pourries dans le pipeline commercial</small></h2>
        ${rotten.length ? rotten.sort((a, b) => rottenDays(b) - rottenDays(a)).slice(0, 6).map((d) => `
          <div class="feed-row" data-action="open-deal" data-id="${d.id}" style="cursor:pointer">
            <span class="f-icon">⏳</span><span class="f-label"><b>${esc(d.title)}</b> · ${esc(S.m.stage[d.stage_id]?.name || '')}</span>
            <span class="pill red">+${rottenDays(d)} j</span></div>`).join('') : '<div class="empty">✨ Pipeline impeccable, rien à relancer.</div>'}
      </div>
      <div class="card">
        <h2>📅 Aujourd'hui <small>${todayActs.length + late.length} activité(s)</small></h2>
        ${[...late, ...todayActs].slice(0, 6).map(actRow).join('') || '<div class="empty">Rien de prévu aujourd’hui. Créez une activité !</div>'}
        <div class="row" style="margin-top:10px"><button class="btn sm" data-action="new-activity">+ Activité</button><a class="btn sm ghost" href="#/agenda">Voir l’agenda →</a></div>
      </div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card">
        <h2>🏆 Classement de la semaine <small>XP gagnés depuis lundi</small></h2>
        <div class="lb">${g.leaderboard.map((r, i) => `
          <div class="lb-row ${r.me ? 'me' : ''}"><span class="pos ${i === 0 ? 'gold' : ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
          <div class="avatar">${esc(initials(r.name))}</div>
          <div class="name">${esc(r.name)}<small>Niv. ${r.level} · ${esc(r.title)} · 🔥 ${r.streak}</small></div>
          <div class="pts">${r.weekXp} XP<small>${r.xp} au total</small></div></div>`).join('')}</div>
      </div>
      <div class="card">
        <h2>🏅 Derniers badges <small><a href="#/trophees">tout voir →</a></small></h2>
        <div class="badges mini">${(unlocked.length ? unlocked.slice(-6) : g.badges.slice(0, 6)).map((b) => `<div class="badge ${b.unlockedAt ? 'on' : ''}" title="${esc(b.desc)}"><div class="b-icon">${b.icon}</div><div class="b-name">${esc(b.name)}</div></div>`).join('')}</div>
      </div>
      <div class="card">
        <h2>⚡ Flux d'activité</h2>
        <div class="feed">${g.recentEvents.length ? g.recentEvents.map((e) => `<div class="feed-row"><span class="f-icon">${e.icon}</span><span class="f-label" title="${esc(e.label)}">${esc(e.label)}</span><span class="f-xp">${e.xp ? '+' + e.xp : ''}</span><span class="f-time">${relTime(e.at)}</span></div>`).join('') : '<div class="empty">Vos actions dans Pipedrive apparaîtront ici et rapporteront des XP.</div>'}</div>
      </div>
    </div>
  </div>`;
}
const kpi = (label, value, hint, icon, cls = '') => `<div class="card kpi ${cls}"><span class="icon">${icon}</span><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`;
const quest = (t, weekly = false) => `
  <div class="quest ${t.completed ? 'done' : ''} ${weekly ? 'weekly' : ''}"><div class="q-icon">${t.icon}</div>
    <div class="q-body"><div class="q-name"><span>${t.completed ? '✔ ' : ''}${esc(t.name)}${weekly ? ' <small>(hebdo)</small>' : ''}</span><small>${t.progress}/${t.target}</small></div>
    <div class="bar"><i style="width:${Math.round(100 * t.progress / t.target)}%"></i></div></div>
    <span class="reward">${t.completed ? '✅' : '+' + t.reward + ' XP'}</span></div>`;

// ------------------------------------------------------------------ Pipeline (kanban)
function renderPipeline() {
  const pid = S.pipeline;
  const p = S.m.pipeline[pid];
  const stages = S.m.stagesOf(pid);
  const deals = openDeals().filter((d) => d.pipeline_id === pid);
  const total = deals.reduce((a, d) => a + (Number(d.value) || 0), 0);
  return `
  <div class="page-head"><div><h1>🧭 Pipeline</h1><p>Glissez-déposez les affaires pour les faire avancer : chaque étape franchie rapporte des XP, chaque signature déclenche la fête.</p></div>
    <div class="actions"><button class="btn primary" data-action="new-deal">+ Nouvelle affaire</button></div></div>
  <div class="pipe-tabs">${S.boot.pipelines.map((pp) => `<button class="pipe-tab ${pp.id === pid ? 'active ' + pp.kind : ''}" data-action="pipeline" data-id="${pp.id}">${esc(pp.name)} <span class="muted">· ${openDeals().filter((d) => d.pipeline_id === pp.id).length}</span></button>`).join('')}</div>
  <div class="row small muted" style="margin-bottom:10px"><span>${deals.length} affaires ouvertes · ${eur(total)}</span><span class="spacer"></span><span>🧟 = en sommeil depuis plus de ${p?.kind === 'commercial' ? 'la durée autorisée dans l’étape' : '…'} · Cliquez une carte pour le détail</span></div>
  <div class="kanban">${stages.map((s) => {
    const ds = deals.filter((d) => d.stage_id === s.id).sort((a, b) => rottenDays(b) - rottenDays(a) || (b.update_time > a.update_time ? 1 : -1));
    const sum = ds.reduce((a, d) => a + (Number(d.value) || 0), 0);
    return `<div class="col" data-stage="${s.id}"><div class="col-head"><div class="c-name">${esc(s.name)}</div><div class="c-meta"><span>${ds.length} · ${eur(sum)}</span>${s.deal_probability != null && p?.kind === 'commercial' ? `<span class="c-prob">${s.deal_probability}%</span>` : ''}</div></div>
      <div class="col-body">${ds.map(dealCard).join('') || '<div class="empty">Déposer ici</div>'}</div></div>`;
  }).join('')}</div>`;
}
function dealCard(d) {
  const rot = rottenDays(d);
  const age = d.stage_change_time ? daysBetween(d.stage_change_time) : 0;
  const g = garantie(d), a = assureur(d);
  const next = openActs().filter((x) => x.deal_id === d.id).sort((x, y) => x.due_date.localeCompare(y.due_date))[0];
  const kind = pipeKind(d.pipeline_id);
  const extra = kind === 'impayes' ? `<span class="tag rot">${eur2(money(cf(d, 'montantImpaye')) || 0)} impayé</span>` : kind === 'portefeuille' && echeance(d) ? `<span class="tag ${daysUntil(echeance(d)) <= 90 ? 'hot' : 'ok'}">Éch. ${fmtDate(echeance(d))}</span>` : '';
  return `<div class="deal ${rot ? 'rotten' : ''}" draggable="true" data-id="${d.id}" data-action="open-deal">
    <div class="d-title">${esc(d.title)}</div><span class="d-age" title="Jours dans l'étape">${rot ? '🧟 ' : ''}${age} j</span>
    <div class="d-person">${esc(contactName(d) || '—')}</div>
    <div class="d-tags">${g ? `<span class="tag">${esc(g)}</span>` : ''}${a ? `<span class="tag ins">${esc(a)}</span>` : ''}${extra}</div>
    <div class="d-meta"><span class="d-value">${eur(d.value)}</span><span class="muted small">${d.owner_id !== S.boot.me?.id ? esc(initials(S.m.user[d.owner_id]?.name || '?')) : ''}</span></div>
    ${next ? `<div class="d-foot">${ACT_ICONS[next.type] || '📋'} ${next.due_date < today() ? '<span style="color:var(--red)">en retard · </span>' : ''}${esc(next.subject)}</div>` : `<div class="d-foot muted">Aucune activité planifiée</div>`}
  </div>`;
}
function bindKanban() {
  const root = $('.kanban'); if (!root) return;
  let dragId = null;
  root.querySelectorAll('.deal').forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragId = Number(card.dataset.id); card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); root.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over')); });
  });
  root.querySelectorAll('.col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('over'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('over');
      const id = dragId || Number(e.dataTransfer.getData('text/plain'));
      const stage = Number(col.dataset.stage);
      const d = S.m.deal[id];
      if (!d || d.stage_id === stage) return;
      // Mise à jour optimiste
      const prevStage = d.stage_id; d.stage_id = stage; d.stage_change_time = new Date().toISOString(); render();
      await mutate(() => api.updateDeal(id, { stage_id: stage }), () => { d.stage_id = prevStage; });
    });
  });
}

// ------------------------------------------------------------------ Agenda
function renderAgenda() {
  const acts = openActs().sort((a, b) => a.due_date.localeCompare(b.due_date) || String(a.due_time || '').localeCompare(String(b.due_time || '')));
  const t = today();
  const late = acts.filter((a) => a.due_date < t), now = acts.filter((a) => a.due_date === t), soon = acts.filter((a) => a.due_date > t);
  const doneToday = S.state.activities.filter((a) => a.done && (a.marked_as_done_time || a.update_time || '').slice(0, 10) === t);
  return `
  <div class="page-head"><div><h1>📅 Agenda</h1><p>Cochez une activité pour la terminer dans Pipedrive : appel +15 XP, rendez-vous +25 XP, tâche +10 XP.</p></div>
    <div class="actions"><button class="btn primary" data-action="new-activity">+ Nouvelle activité</button></div></div>
  <div class="agenda-cols">
    <div class="card"><h2>⏰ En retard <small>${late.length}</small></h2>${late.map(actRow).join('') || '<div class="empty">Aucun retard, bravo !</div>'}</div>
    <div class="card"><h2>☀️ Aujourd'hui <small>${now.length}</small></h2>${now.map(actRow).join('') || '<div class="empty">Journée libre.</div>'}
      ${doneToday.length ? `<h2 style="margin-top:16px">✅ Terminées aujourd'hui <small>${doneToday.length}</small></h2>${doneToday.map(actRow).join('')}` : ''}</div>
    <div class="card"><h2>📆 À venir <small>${soon.length}</small></h2>${soon.slice(0, 30).map(actRow).join('') || '<div class="empty">Rien de planifié.</div>'}</div>
  </div>`;
}
function actRow(a) {
  const d = a.deal_id ? S.m.deal[a.deal_id] : null;
  const who = S.m.person[a.person_id]?.name || S.m.org[a.org_id]?.name || '';
  const late = !a.done && a.due_date < today();
  const when = a.due_date === today() ? "aujourd'hui" + (a.due_time ? ' ' + a.due_time.slice(0, 5) : '') : fmtDate(a.due_date) + (a.due_time ? ' ' + a.due_time.slice(0, 5) : '');
  return `<div class="act ${a.done ? 'done' : ''} ${late ? 'late' : ''}">
    <input type="checkbox" data-action="toggle-activity" data-id="${a.id}" ${a.done ? 'checked' : ''} title="${a.done ? 'Rouvrir' : 'Marquer comme terminée'}">
    <span class="a-type" title="${ACT_LABELS[a.type] || a.type}">${ACT_ICONS[a.type] || '📋'}</span>
    <div class="a-body"><div class="a-subject">${esc(a.subject)}</div>
      <div class="a-meta"><span class="when">${when}</span>${who ? `<span>👤 ${esc(who)}</span>` : ''}${d ? `<a href="#" data-action="open-deal" data-id="${d.id}">💼 ${esc(d.title)}</a>` : ''}${a.note ? `<span title="${esc(a.note)}">📝</span>` : ''}</div></div>
  </div>`;
}

// ------------------------------------------------------------------ Portefeuille
function renderPortefeuille() {
  const port = dealsIn('portefeuille');
  const impayes = dealsIn('impayes');
  const sinistres = dealsIn('sinistres');
  const primes = port.reduce((a, d) => a + (Number(prime(d)) || 0), 0);
  const ech = port.filter((d) => echeance(d)).map((d) => ({ d, j: daysUntil(echeance(d)) }));
  const ech90 = ech.filter((x) => x.j >= 0 && x.j <= 90).length;
  const impMontant = impayes.reduce((a, d) => a + (Number(money(cf(d, 'montantImpaye'))) || 0), 0);
  const sortKey = S.sort.key, dir = S.sort.dir;
  const rows = port.map((d) => ({ d, client: contactName(d) || d.title, garantie: garantie(d) || '', assureur: assureur(d) || '', prime: Number(prime(d)) || 0, echeance: echeance(d) || '9999', contrat: cf(d, 'numContrat') || '', stage: S.m.stage[d.stage_id]?.name || '' }))
    .sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * dir);
  const th = (key, label, cls = '') => `<th class="${cls}" data-action="sort" data-key="${key}">${label} ${sortKey === key ? (dir > 0 ? '▲' : '▼') : ''}</th>`;
  const echPill = (e) => { if (!e || e === '9999') return '<span class="pill grey">—</span>'; const j = daysUntil(e); return j < 0 ? `<span class="pill red">échu ${-j} j</span>` : j <= 30 ? `<span class="pill red">J-${j}</span>` : j <= 90 ? `<span class="pill amber">J-${j}</span>` : `<span class="pill green">J-${j}</span>`; };
  return `
  <div class="page-head"><div><h1>📂 Portefeuille & suivi</h1><p>Contrats actifs, échéances à préparer, impayés à sauver et sinistres en cours. Reconduire un contrat rapporte +50 XP, sauver un impayé +60 XP.</p></div></div>
  <div class="grid kpis" style="margin-bottom:16px">
    ${kpi('Contrats actifs', port.length, `${eur(primes)} de primes annuelles`, '📂')}
    ${kpi('Échéances < 90 j', ech90, 'points clients à planifier', '⏳', ech90 ? 'warn' : 'good')}
    ${kpi('Impayés en cours', impayes.length, `${eur2(impMontant)} à régulariser`, '🚑', impayes.length ? 'bad' : 'good')}
    ${kpi('Sinistres ouverts', sinistres.length, 'dossiers à suivre', '🔧')}
  </div>
  <div class="card" style="margin-bottom:16px"><h2>📑 Contrats en portefeuille <small>${port.length} contrats · cliquez pour ouvrir</small></h2>
    <div style="overflow:auto"><table><thead><tr>${th('client', 'Client')}${th('garantie', 'Garantie')}${th('assureur', 'Assureur')}${th('contrat', 'N° contrat')}${th('stage', 'Suivi')}${th('prime', 'Prime annuelle', 'num')}${th('echeance', 'Échéance')}</tr></thead>
    <tbody>${rows.map((r) => `<tr class="clickable" data-action="open-deal" data-id="${r.d.id}"><td><b>${esc(r.client)}</b><div class="muted small">${esc(r.d.title)}</div></td><td>${esc(r.garantie)}</td><td>${esc(r.assureur)}</td><td class="muted">${esc(r.contrat)}</td><td><span class="pill blue">${esc(r.stage)}</span></td><td class="num">${eur2(r.prime)}</td><td>${fmtDate(r.echeance === '9999' ? null : r.echeance)} ${echPill(r.echeance)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun contrat dans le pipeline Portefeuille.</td></tr>'}</tbody></table></div></div>
  <div class="grid two">
    <div class="card"><h2>🚑 Alertes impayés <small>${impayes.length} dossiers</small></h2>
      ${impayes.map((d) => `<div class="feed-row" data-action="open-deal" data-id="${d.id}" style="cursor:pointer"><span class="f-icon">💸</span><span class="f-label"><b>${esc(d.title)}</b><br><span class="muted small">${esc(S.m.stage[d.stage_id]?.name || '')}${cf(d, 'dateSignalement') ? ' · signalé le ' + fmtDate(cf(d, 'dateSignalement')) : ''}</span></span><span class="pill red">${eur2(money(cf(d, 'montantImpaye')) || 0)}</span></div>`).join('') || '<div class="empty">Aucun impayé en cours 🎉</div>'}</div>
    <div class="card"><h2>🔧 Sinistres en cours <small>${sinistres.length} dossiers</small></h2>
      ${sinistres.map((d) => `<div class="feed-row" data-action="open-deal" data-id="${d.id}" style="cursor:pointer"><span class="f-icon">🛠️</span><span class="f-label"><b>${esc(d.title)}</b><br><span class="muted small">${esc(S.m.stage[d.stage_id]?.name || '')} · ${esc(assureur(d) || '')}</span></span><span class="pill amber">${eur(d.value)}</span></div>`).join('') || '<div class="empty">Aucun sinistre ouvert.</div>'}</div>
  </div>`;
}

// ------------------------------------------------------------------ Trophées
function renderTrophees() {
  const g = S.state.gamification;
  const s = g.stats;
  const rules = Object.entries(S.boot.xpRules);
  return `
  <div class="page-head"><div><h1>🏆 Trophées & progression</h1><p>Vos succès, vos statistiques de courtier et le barème d'expérience.</p></div></div>
  <div class="grid kpis" style="margin-bottom:16px">
    ${kpi('Niveau', `${g.level} · ${esc(g.title)}`, `${g.xp} XP cumulés`, '🎖️')}
    ${kpi('Meilleure série', `${g.bestStreak} j`, `série actuelle ${g.streak} j`, '🔥')}
    ${kpi('Affaires gagnées', s.won, `${s.wonRcd} RC Décennale · record ${eur(s.maxWonValue)}`, '🏆', 'good')}
    ${kpi('Activités', s.activities, `${s.calls} appels · ${s.meetings} RDV · ${s.notes} notes`, '⚡')}
    ${kpi('Sauvetages', s.impayesResolved, `${s.sinistresClosed} sinistres clôturés · ${s.renewals} reconductions`, '🛟')}
    ${kpi('Missions', s.quests, 'missions accomplies', '🎯')}
  </div>
  <div class="card" style="margin-bottom:16px"><h2>🏅 Badges <small>${g.badges.filter((b) => b.unlockedAt).length} / ${g.badges.length} débloqués</small></h2>
    <div class="badges">${g.badges.map((b) => `<div class="badge ${b.unlockedAt ? 'on' : ''}"><div class="b-icon">${b.icon}</div><div class="b-name">${esc(b.name)}</div><div class="b-desc">${esc(b.desc)}</div>${b.unlockedAt ? `<div class="b-date">Obtenu le ${fmtDate(b.unlockedAt)}</div>` : ''}</div>`).join('')}</div></div>
  <div class="grid two">
    <div class="card"><h2>📜 Barème d'expérience</h2><table><tbody>${rules.map(([k, r]) => `<tr><td>${r.icon} ${esc(r.label)}</td><td class="num"><b style="color:var(--accent)">+${r.xp} XP</b>${k === 'deal_won' ? '<div class="muted small">+ bonus jusqu’à 200 XP selon la prime</div>' : ''}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h2>📈 Niveaux</h2><table><tbody>${Array.from({ length: 10 }, (_, i) => i + 1).map((l) => `<tr class="${l === g.level ? 'me' : ''}"><td>${l === g.level ? '👉 ' : ''}Niveau ${l}</td><td>${esc(['Stagiaire', 'Conseiller junior', 'Conseiller', 'Chargé de clientèle', 'Courtier confirmé', 'Courtier senior', 'Expert IARD', 'Maître courtier', 'Stratège du risque', 'Légende du cabinet'][l - 1])}</td><td class="num muted">${100 * (l - 1) ** 2} XP</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

// ------------------------------------------------------------------ Tiroir affaire
async function openDeal(id) {
  S.drawer = Number(id);
  renderDrawer();
  if (!S.notes[id]) {
    try { S.notes[id] = (await api.notes(id)).notes || []; } catch { S.notes[id] = []; }
    if (S.drawer === Number(id)) renderDrawer();
  }
}
function closeDrawer() { S.drawer = null; $('#drawer-root').innerHTML = ''; }
function renderDrawer() {
  const d = S.m.deal[S.drawer];
  if (!d) return closeDrawer();
  const stages = S.m.stagesOf(d.pipeline_id);
  const idx = stages.findIndex((s) => s.id === d.stage_id);
  const kind = pipeKind(d.pipeline_id);
  const person = S.m.person[d.person_id], org = S.m.org[d.org_id];
  const acts = S.state.activities.filter((a) => a.deal_id === d.id).sort((a, b) => Number(a.done) - Number(b.done) || a.due_date.localeCompare(b.due_date));
  const notes = S.notes[d.id];
  const rot = rottenDays(d);
  const fields = ['typeGarantie', 'assureur', 'grossiste', 'primeAnnuelle', 'fractionnement', 'numContrat', 'dateEffet', 'dateEcheance', 'montantImpaye', 'dateSignalement', 'sourceSignalement', 'dateEcheancePrime', 'recueilBesoins', 'ipidRemis', 'declarationAdequation', 'lettreMission']
    .map((k) => [S.boot.fields[F()[k]]?.name || k, fieldLabel(F()[k], cf(d, k))]).filter(([, v]) => v);
  const wonLabel = { commercial: '🏆 Gagnée', impayes: '🛟 Régularisé', portefeuille: '🔁 Reconduit', sinistres: '🏁 Clôturé' }[kind];
  const statusPill = d.status === 'won' ? '<span class="pill green">Gagnée</span>' : d.status === 'lost' ? `<span class="pill red">Perdue${d.lost_reason ? ' · ' + esc(d.lost_reason) : ''}</span>` : rot ? `<span class="pill red">🧟 En sommeil +${rot} j</span>` : '<span class="pill blue">En cours</span>';
  $('#drawer-root').innerHTML = `
  <div class="drawer-back" data-action="close-drawer"></div>
  <aside class="drawer">
    <div class="drawer-head"><button class="close" data-action="close-drawer">✕</button>
      <h2>${esc(d.title)}</h2>
      <div class="row small"><b style="color:var(--accent);font-size:16px">${eur2(d.value)}</b>${statusPill}<span class="muted">${esc(S.m.pipeline[d.pipeline_id]?.name || '')}</span></div>
    </div>
    <div class="drawer-body">
      <div class="section"><h3>Étape · ${esc(S.m.stage[d.stage_id]?.name || '')}</h3>
        <div class="stage-steps">${stages.map((s, i) => `<span class="${i < idx ? 'on' : i === idx ? 'cur' : ''}" title="${esc(s.name)}" data-action="move-stage" data-id="${d.id}" data-stage="${s.id}"></span>`).join('')}</div>
        <div class="row" style="margin-top:10px">
          <select data-action="move-stage-select" data-id="${d.id}" ${d.status !== 'open' ? 'disabled' : ''}>${stages.map((s) => `<option value="${s.id}" ${s.id === d.stage_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        </div>
        <div class="row" style="margin-top:10px">
          ${d.status === 'open' ? `<button class="btn success" data-action="win-deal" data-id="${d.id}">${wonLabel}</button><button class="btn danger" data-action="lose-deal" data-id="${d.id}">✖ Perdue</button>` : `<button class="btn" data-action="reopen-deal" data-id="${d.id}">↩ Rouvrir</button>`}
          <span class="spacer"></span><button class="btn sm" data-action="new-activity" data-deal="${d.id}">+ Activité</button>
        </div>
      </div>
      <div class="section"><h3>Client</h3><div class="kv">
        ${org ? `<div><b>Entreprise</b>${esc(org.name)}</div>` : ''}
        ${person ? `<div><b>Contact</b>${esc(person.name)}</div>` : ''}
        ${person?.phones?.[0]?.value ? `<div><b>Téléphone</b><a href="tel:${esc(person.phones[0].value)}">${esc(person.phones[0].value)}</a></div>` : ''}
        ${person?.emails?.[0]?.value ? `<div><b>E-mail</b><a href="mailto:${esc(person.emails[0].value)}">${esc(person.emails[0].value)}</a></div>` : ''}
        <div><b>Responsable</b>${esc(S.m.user[d.owner_id]?.name || '—')}</div>
        <div><b>Créée le</b>${fmtDate(d.add_time)}</div>
      </div></div>
      ${fields.length ? `<div class="section"><h3>Contrat & garanties</h3><div class="kv">${fields.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div></div>` : ''}
      <div class="section"><h3>Activités (${acts.length})</h3>${acts.map(actRow).join('') || '<div class="empty">Aucune activité. Planifiez la prochaine action !</div>'}</div>
      <div class="section"><h3>Notes</h3>
        <form class="inline" data-form="note" data-id="${d.id}"><div class="field full"><textarea name="content" placeholder="Compte rendu d'appel, pièces reçues, prochaine étape… (+5 XP)" required></textarea></div><button class="btn sm primary">Ajouter la note</button></form>
        <div style="margin-top:10px">${notes ? (notes.map((n) => `<div class="note">${esc(n.content.replace(/<[^>]+>/g, ''))}<small>${fmtDateTime(n.add_time)}</small></div>`).join('') || '<div class="empty">Aucune note.</div>') : '<div class="empty">Chargement des notes…</div>'}</div>
      </div>
      ${S.boot.mode !== 'demo' && S.boot.me?.company_domain ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://${esc(S.boot.me.company_domain)}.pipedrive.com/deal/${d.id}">Ouvrir dans Pipedrive ↗</a>` : ''}
    </div>
  </aside>`;
}

// ------------------------------------------------------------------ Modales
function modal(html) { $('#modal-root').innerHTML = `<div class="modal-back" data-action="close-modal-back"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modal-root').innerHTML = ''; }
function newDealModal() {
  const pid = S.pipeline || S.boot.pipelines[0].id;
  const fo = (k) => Object.entries(S.boot.fields[F()[k]]?.options || {}).map(([id, l]) => `<option value="${id}">${esc(l)}</option>`).join('');
  modal(`<div class="modal-head">🆕 Nouvelle affaire <span class="muted small">+20 XP</span></div>
  <form data-form="deal"><div class="modal-body">
    <div class="row"><div class="field full"><label>Titre *</label><input type="text" name="title" required placeholder="Ex. DUPONT RÉNOVATION - RCD - 11/2026"></div></div>
    <div class="row"><div class="field"><label>Pipeline</label><select name="pipeline_id" data-action="deal-pipeline">${S.boot.pipelines.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Étape</label><select name="stage_id">${S.m.stagesOf(pid).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field"><label>Prime annuelle TTC (€)</label><input type="number" name="value" min="0" step="0.01" placeholder="0"></div>
      <div class="field"><label>Type de garantie</label><select name="typeGarantie"><option value="">—</option>${fo('typeGarantie')}</select></div>
      <div class="field"><label>Assureur</label><select name="assureur"><option value="">—</option>${fo('assureur')}</select></div></div>
    <div class="row"><div class="field"><label>Entreprise existante</label><select name="org_id"><option value="">— aucune / nouvelle —</option>${S.state.orgs.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Ou nouvelle entreprise</label><input type="text" name="org_name" placeholder="Raison sociale"></div></div>
    <div class="row"><div class="field"><label>Contact existant</label><select name="person_id"><option value="">— aucun / nouveau —</option>${S.state.persons.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Ou nouveau contact</label><input type="text" name="person_name" placeholder="Prénom Nom"></div></div>
    <div class="row"><div class="field"><label>Téléphone</label><input type="text" name="person_phone"></div><div class="field"><label>E-mail</label><input type="text" name="person_email"></div><div class="field"><label>Clôture prévue</label><input type="date" name="expected_close_date"></div></div>
  </div><div class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button><button class="btn primary">Créer l'affaire</button></div></form>`);
}
function newActivityModal(dealId) {
  modal(`<div class="modal-head">📅 Nouvelle activité</div>
  <form data-form="activity"><div class="modal-body">
    <div class="row"><div class="field full"><label>Sujet *</label><input type="text" name="subject" required placeholder="Ex. Relancer le devis RCD"></div></div>
    <div class="row"><div class="field"><label>Type</label><select name="type">${Object.entries(ACT_LABELS).map(([k, l]) => `<option value="${k}">${ACT_ICONS[k]} ${l}</option>`).join('')}</select></div>
      <div class="field"><label>Date</label><input type="date" name="due_date" value="${today()}"></div><div class="field"><label>Heure</label><input type="time" name="due_time"></div></div>
    <div class="row"><div class="field full"><label>Affaire liée</label><select name="deal_id"><option value="">— aucune —</option>${openDeals().sort((a, b) => a.title.localeCompare(b.title)).map((d) => `<option value="${d.id}" ${d.id === Number(dealId) ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field full"><label>Note</label><textarea name="note"></textarea></div></div>
  </div><div class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button><button class="btn primary">Planifier</button></div></form>`);
}
function loseModal(dealId) {
  modal(`<div class="modal-head">✖ Marquer comme perdue</div>
  <form data-form="lose" data-id="${dealId}"><div class="modal-body"><div class="field"><label>Motif</label><select name="lost_reason">${LOST_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
  <p class="muted small">Clôturer proprement une affaire perdue rapporte quand même +5 XP : un pipeline propre, c'est un pipeline qui gagne.</p></div>
  <div class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button><button class="btn danger">Confirmer</button></div></form>`);
}

// ------------------------------------------------------------------ Mutations
async function mutate(fn, rollback) {
  if (S.busy) return;
  S.busy = true;
  try {
    const r = await fn();
    if (r?.gamification) S.state.gamification = r.gamification;
    handleEvents(r?.events || []);
    await refresh(false);
    return r;
  } catch (e) {
    rollback?.();
    toast({ kind: 'err', icon: '⚠️', label: e.message });
    render();
  } finally { S.busy = false; }
}

// ------------------------------------------------------------------ Interactions
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'close-modal-back' && e.target !== el) return; // clic à l'intérieur de la modale
  if (['open-deal', 'close-drawer', 'close-modal', 'close-modal-back', 'new-deal', 'new-activity', 'pipeline', 'sync', 'sort', 'win-deal', 'lose-deal', 'reopen-deal', 'move-stage'].includes(a)) e.preventDefault();
  switch (a) {
    case 'open-deal': return openDeal(id);
    case 'close-drawer': return closeDrawer();
    case 'close-modal': case 'close-modal-back': return closeModal();
    case 'new-deal': return newDealModal();
    case 'new-activity': return newActivityModal(el.dataset.deal);
    case 'pipeline': S.pipeline = Number(id); return render();
    case 'sort': S.sort = { key: el.dataset.key, dir: S.sort.key === el.dataset.key ? -S.sort.dir : 1 }; return render();
    case 'sync': el.classList.add('spin'); await mutate(() => api.sync()); return;
    case 'win-deal': return mutate(() => api.updateDeal(id, { status: 'won' }));
    case 'reopen-deal': return mutate(() => api.updateDeal(id, { status: 'open' }));
    case 'lose-deal': return loseModal(id);
    case 'move-stage': return mutate(() => api.updateDeal(id, { stage_id: Number(el.dataset.stage) }));
    case 'toggle-activity': {
      const act = S.state.activities.find((x) => x.id === Number(id));
      if (!act) return;
      const done = el.checked;
      act.done = done; act.marked_as_done_time = done ? new Date().toISOString() : null;
      return mutate(() => api.updateActivity(id, { done }), () => { act.done = !done; });
    }
  }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'move-stage-select') mutate(() => api.updateDeal(el.dataset.id, { stage_id: Number(el.value) }));
  if (el.dataset.action === 'deal-pipeline') {
    const sel = el.form.querySelector('[name=stage_id]');
    sel.innerHTML = S.m.stagesOf(Number(el.value)).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const btn = form.querySelector('button.btn:not([type=button])'); if (btn) btn.disabled = true;
  switch (form.dataset.form) {
    case 'note': {
      const id = Number(form.dataset.id);
      const r = await mutate(() => api.addNote(id, data.content));
      if (r) { S.notes[id] = (await api.notes(id).catch(() => ({ notes: S.notes[id] }))).notes || []; renderDrawer(); }
      break;
    }
    case 'deal': { const r = await mutate(() => api.createDeal(data)); if (r) { closeModal(); S.view = 'pipeline'; S.pipeline = Number(data.pipeline_id); location.hash = '#/pipeline'; render(); openDeal(r.result.id); } break; }
    case 'activity': { const r = await mutate(() => api.createActivity(data)); if (r) closeModal(); break; }
    case 'lose': { const r = await mutate(() => api.updateDeal(form.dataset.id, { status: 'lost', lost_reason: data.lost_reason })); if (r) closeModal(); break; }
  }
  if (btn) btn.disabled = false;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });

function route() {
  const v = (location.hash.replace('#/', '') || 'qg').split('/')[0];
  S.view = ['qg', 'pipeline', 'agenda', 'portefeuille', 'trophees'].includes(v) ? v : 'qg';
  render();
}
addEventListener('hashchange', route);
route();
init();
