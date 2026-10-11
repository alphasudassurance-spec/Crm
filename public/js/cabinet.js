// Cabinet virtuel : vue isométrique interactive du cabinet de courtage.
// Chaque pipeline Pipedrive devient une zone du bâtiment, chaque étape un
// emplacement, chaque affaire un dossier / un client / un contrat / un véhicule
// que l'on peut glisser d'une étape à l'autre.
import { esc, eur, fmtDate, today, daysUntil, initials, money } from './util.js';

const TW = 64, TH = 32;
const iso = (x, y, z = 0) => ({ X: (x - y) * (TW / 2), Y: (x + y) * (TH / 2) - z });
const P = (x, y, z = 0) => { const p = iso(x, y, z); return `${p.X.toFixed(1)},${p.Y.toFixed(1)}`; };
const shade = (hex, f) => { // éclaircit (f>0) ou assombrit (f<0) une couleur hexadécimale
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};
const RED = '#e3262c', WHITE = '#ffffff', DARK = '#2b3245';
const KIND_COLORS = { 53: '#e3262c', 54: '#f06a2f', 55: '#9b5de5', 56: '#7a5af8', 57: '#2f6fed', 82: '#1fa971', 94: '#0ea5c6', 102: '#e0409a', 103: '#c05bd8', 104: '#f2a900', 105: '#5c6b8a', 106: '#0b7fab' };

const state = { view: null, selected: null, query: '', dragging: false, hoverZone: null };
export const cabinetBusy = () => state.dragging;

// ----------------------------------------------------------------- primitives SVG
const floor = (x, y, w, d, fill = '#f7f8fb', extra = '') => `<polygon points="${P(x, y)} ${P(x + w, y)} ${P(x + w, y + d)} ${P(x, y + d)}" fill="${fill}" ${extra}/>`;
function box(x, y, w, d, h, c = WHITE, { z = 0, stroke = 'rgba(20,28,48,.12)', cls = '', attrs = '', top, left, right } = {}) {
  const T = top || c, R = right || shade(c, -0.14), L = left || shade(c, -0.28);
  return `<g class="${cls}" ${attrs}>
    <polygon points="${P(x, y + d, z)} ${P(x + w, y + d, z)} ${P(x + w, y + d, z + h)} ${P(x, y + d, z + h)}" fill="${L}" stroke="${stroke}" stroke-width=".6"/>
    <polygon points="${P(x + w, y, z)} ${P(x + w, y + d, z)} ${P(x + w, y + d, z + h)} ${P(x + w, y, z + h)}" fill="${R}" stroke="${stroke}" stroke-width=".6"/>
    <polygon points="${P(x, y, z + h)} ${P(x + w, y, z + h)} ${P(x + w, y + d, z + h)} ${P(x, y + d, z + h)}" fill="${T}" stroke="${stroke}" stroke-width=".6"/></g>`;
}
const wall = (x1, y1, x2, y2, h = 38) => `<g pointer-events="none"><polygon points="${P(x1, y1, 0)} ${P(x2, y2, 0)} ${P(x2, y2, h)} ${P(x1, y1, h)}" fill="rgba(190,205,230,.22)" stroke="rgba(120,140,180,.5)" stroke-width=".8"/><line x1="${iso(x1, y1, h).X}" y1="${iso(x1, y1, h).Y}" x2="${iso(x2, y2, h).X}" y2="${iso(x2, y2, h).Y}" stroke="rgba(120,140,180,.8)" stroke-width="1.4"/></g>`;
const shadow = (x, y, rx = 11, ry = 5) => { const p = iso(x, y); return `<ellipse cx="${p.X}" cy="${p.Y}" rx="${rx}" ry="${ry}" fill="rgba(20,28,48,.14)"/>`; };
function person(x, y, { color = '#3b4257', me = false, name = '', cls = '', attrs = '', k = 1.25 } = {}) {
  const p = iso(x, y);
  return `<g class="person ${cls}" ${attrs}>${shadow(x, y, 9 * k, 4.5 * k)}
    <rect x="${p.X - 6 * k}" y="${p.Y - 22 * k}" width="${12 * k}" height="${17 * k}" rx="${5 * k}" fill="${color}"/>
    <circle cx="${p.X}" cy="${p.Y - 27 * k}" r="${6.5 * k}" fill="#f3c9a6" stroke="${me ? '#ffb020' : 'rgba(0,0,0,.08)'}" stroke-width="${me ? 2.5 : 1}"/>
    <path d="M${p.X - 6.5 * k} ${p.Y - 28 * k} a${6.5 * k} ${6.5 * k} 0 0 1 ${13 * k} 0 z" fill="${shade(color, -0.35)}"/>
    ${name ? `<text x="${p.X}" y="${p.Y - 38 * k}" text-anchor="middle" font-size="${9 * k}" font-weight="700" fill="${me ? RED : '#3b4257'}">${esc(name)}</text>` : ''}</g>`;
}
function car(x, y, color = '#2b3245', { attrs = '', cls = '' } = {}) {
  const b = shade(color, -0.2);
  return `<g class="${cls}" ${attrs}>${shadow(x + 0.55, y + 0.4, 20, 10)}
    <polygon class="tk-glow" points="${P(x - 0.15, y - 0.15)} ${P(x + 1.3, y - 0.15)} ${P(x + 1.3, y + 0.85)} ${P(x - 0.15, y + 0.85)}" fill="rgba(227,38,44,.22)" stroke="${RED}" stroke-width="1.5"/>
    ${box(x, y, 1.15, 0.68, 9, color, { stroke: 'rgba(0,0,0,.15)' })}
    ${box(x + 0.28, y + 0.08, 0.55, 0.52, 8, b, { z: 9, top: shade(color, 0.1), left: '#b8d3ea', right: '#cfe3f3', stroke: 'rgba(0,0,0,.12)' })}
    <circle cx="${iso(x + 0.25, y + 0.72).X}" cy="${iso(x + 0.25, y + 0.72).Y - 1}" r="3.3" fill="#1a1d27"/><circle cx="${iso(x + 0.95, y + 0.72).X}" cy="${iso(x + 0.95, y + 0.72).Y - 1}" r="3.3" fill="#1a1d27"/></g>`;
}
const tree = (x, y, r = 14) => { const p = iso(x, y); return `<g pointer-events="none">${shadow(x, y, r * .8, r * .4)}<line x1="${p.X}" y1="${p.Y}" x2="${p.X}" y2="${p.Y - r}" stroke="#8a6a4a" stroke-width="3"/><circle cx="${p.X}" cy="${p.Y - r - 4}" r="${r}" fill="#86e3a0"/><circle cx="${p.X - r * .3}" cy="${p.Y - r - 8}" r="${r * .45}" fill="#a9f0bb"/></g>`; };
const lamp = (x, y) => `<g>${box(x, y, 0.3, 0.3, 10, '#c9ced9')}<g class="lamp">${box(x + 0.03, y + 0.03, 0.24, 0.24, 7, '#ff4b4b', { z: 10, stroke: 'none' })}<circle cx="${iso(x + 0.15, y + 0.15, 17).X}" cy="${iso(x + 0.15, y + 0.15, 17).Y}" r="9" fill="rgba(255,60,60,.25)"/></g></g>`;
function desk(x, y, w = 2.2, d = 1) {
  return box(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 11, RED, { stroke: 'none' }) + box(x, y, w, d, 2.5, WHITE, { z: 11 }) +
    box(x + w * 0.35, y + 0.2, 0.5, 0.05, 7, '#2b3245', { z: 13.5, stroke: 'none' }) + box(x + w * 0.3, y + 0.15, 0.6, 0.15, 1.5, '#8a93a8', { z: 13.5, stroke: 'none' });
}
const chair = (x, y) => box(x, y, 0.45, 0.45, 6, '#3b4257', { stroke: 'none' }) + box(x, y, 0.45, 0.1, 13, '#3b4257', { z: 0, stroke: 'none' });
function shelf(x, y, len, add) {
  // Planches dessinées avant les contrats posés dessus, montants triés selon leur position
  let boards = '';
  for (let lvl = 0; lvl < 2; lvl++) boards += box(x, y, len, 0.8, 1.2, '#f2f3f6', { z: 1 + lvl * 16, stroke: 'rgba(20,28,48,.1)' });
  add(x + y + 0.2, boards);
  for (let i = 0; i <= len; i += len / 3) { const px = x + Math.min(i, len - 0.12); add(px + y + 0.3, box(px, y, 0.12, 0.12, 34, RED, { stroke: 'none' })); add(px + y + 0.95, box(px, y + 0.68, 0.12, 0.12, 34, RED, { stroke: 'none' })); }
}
function sign(x, y, text, { z = 46, color = RED, small = false } = {}) {
  const p = iso(x, y, z); const w = Math.max(60, text.length * (small ? 6 : 7.4) + 20), h = small ? 17 : 23;
  return `<g pointer-events="none"><line x1="${p.X}" y1="${p.Y + h / 2}" x2="${p.X}" y2="${iso(x, y, 0).Y}" stroke="${color}" stroke-width="1.2" opacity=".5"/><rect x="${p.X - w / 2}" y="${p.Y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" stroke="#fff" stroke-width="1.5"/><text class="sign-text" x="${p.X}" y="${p.Y + (small ? 4.5 : 5.5)}" text-anchor="middle" font-size="${small ? 9.5 : 12}">${esc(text)}</text></g>`;
}
function dossier(x, y, color, { z = 0, attrs = '', cls = '' } = {}) {
  return `<g class="${cls}" ${attrs}>${shadow(x + 0.4, y + 0.32, 14, 7)}
    <polygon class="tk-glow" points="${P(x - 0.15, y - 0.15, z)} ${P(x + 0.95, y - 0.15, z)} ${P(x + 0.95, y + 0.8, z)} ${P(x - 0.15, y + 0.8, z)}" fill="rgba(227,38,44,.25)" stroke="${RED}" stroke-width="1.5"/>
    ${box(x, y, 0.8, 0.65, 8, '#f5e7c6', { z, stroke: 'rgba(0,0,0,.1)' })}
    ${box(x, y, 0.8, 0.65, 3, color, { z: z + 8, stroke: 'none' })}
    ${box(x + 0.03, y + 0.03, 0.28, 0.16, 2, shade(color, -0.25), { z: z + 11, stroke: 'none' })}</g>`;
}
function contractBox(x, y, color, { z = 0, attrs = '', cls = '' } = {}) {
  return `<g class="${cls}" ${attrs}><polygon class="tk-glow" points="${P(x - 0.1, y - 0.1, z)} ${P(x + 0.8, y - 0.1, z)} ${P(x + 0.8, y + 0.8, z)} ${P(x - 0.1, y + 0.8, z)}" fill="rgba(227,38,44,.25)" stroke="${RED}" stroke-width="1.5"/>
    ${box(x, y, 0.7, 0.65, 11, color, { z, stroke: 'rgba(0,0,0,.1)' })}<rect x="${iso(x + 0.7, y + 0.3, z + 7).X - 7}" y="${iso(x + 0.7, y + 0.3, z + 7).Y - 2}" width="10" height="4" rx="1" fill="rgba(255,255,255,.75)"/></g>`;
}

// ----------------------------------------------------------------- construction de la scène
function tokenColor(ctx, d) {
  const g = Number(ctx.cf(d, 'typeGarantie'));
  return KIND_COLORS[g] || '#5c6b8a';
}
function echColor(ctx, d) {
  const e = ctx.echeance(d); if (!e) return '#9aa2b6';
  const j = daysUntil(e); return j < 30 ? RED : j <= 90 ? '#e8960f' : '#1fa971';
}

function buildScene(ctx) {
  const { boot, state: st, m } = ctx;
  const items = []; // { k, svg }
  const add = (k, svg) => items.push({ k, svg });
  const zones = []; // { id, name, x, y, w, d, stages: [{stage, slot}] , kind }
  const slots = []; // { stage, x, y, w, d, cols, rows, mode, z, dx, dy }
  const tokens = []; // { deal, slot, index }
  const openDeals = st.deals.filter((d) => d.status === 'open');
  const users = boot.users.length ? boot.users : [boot.me];
  const uColor = (i) => ['#3b4257', '#2f6fed', '#7a5af8', '#0ea5c6', '#1fa971', '#e0409a'][i % 6];

  const addZone = (z) => { zones.push(z); add(-1000, floor(z.x, z.y, z.w, z.d, z.fill || '#fbfbfd', `stroke="rgba(20,28,48,.12)" stroke-width="1"`)); add(-999, floor(z.x, z.y, z.w, z.d, 'url(#grid)', 'opacity=".5"'));
    add(z.x + z.y - 0.5, wall(z.x, z.y, z.x + z.w, z.y)); add(z.x + z.y - 0.5, wall(z.x, z.y, z.x, z.y + z.d));
    add(z.x + z.w + z.y + z.d + 0.5, wall(z.x + z.w, z.y, z.x + z.w, z.y + z.d)); add(z.x + z.w + z.y + z.d + 0.5, wall(z.x, z.y + z.d, z.x + z.w, z.y + z.d));
    add(-998, `<polygon class="zone-hit" data-zone="${z.id}" points="${P(z.x, z.y)} ${P(z.x + z.w, z.y)} ${P(z.x + z.w, z.y + z.d)} ${P(z.x, z.y + z.d)}"/>`);
  };
  const addSlot = (s) => { slots.push(s); add(-997, `<polygon class="slot" data-stage="${s.stage.id}" points="${P(s.x, s.y)} ${P(s.x + s.w, s.y)} ${P(s.x + s.w, s.y + s.d)} ${P(s.x, s.y + s.d)}"/>`); if (s.label !== false) add(5000 + s.x + s.y, sign(s.x + s.w / 2, s.y + 0.2, s.short, { z: 40, color: s.color || DARK, small: true })); };
  const short = (name, n = 24) => name.length > n ? name.slice(0, n - 1).trim() + '…' : name;

  const byKind = {};
  for (const p of boot.pipelines) byKind[p.kind] = p;
  let ui = 0; // index d'utilisateur pour placer les avatars

  // ---------- Pipeline commercial : accueil, plateau conseillers, salle de signature
  const com = byKind.commercial;
  if (com) {
    const stages = m.stagesOf(com.id);
    const first = stages[0], last = stages[stages.length - 1], mid = stages.slice(1, -1);
    addZone({ id: 'accueil', name: 'Accueil & salle d’attente', x: 0, y: 0, w: 8, d: 6, kind: 'commercial', stages: first ? [first] : [] });
    add(0.8 + 0.8 + 2, desk(0.8, 0.8, 2.6, 0.9)); add(1.8 + 0.15, chair(1.9, 0.1));
    add(2 + 0.4, person(2.1, 0.4, { color: uColor(ui), me: users[ui % users.length]?.id === boot.me?.id, name: initials(users[ui % users.length]?.name || '') })); ui++;
    for (let i = 0; i < 4; i++) add(6.9 + 0.8 + i, chair(6.9, 0.7 + i * 1.1));
    add(7.4 + 5.4, tree(7.4, 5.4, 12));
    if (first) addSlot({ stage: first, x: 2.6, y: 2.1, w: 4.2, d: 3.6, cols: 4, rows: 4, mode: 'person', short: short(first.name, 30), label: false });
    const px = 9.5, pw = 17;
    addZone({ id: 'plateau', name: 'Plateau conseillers', x: px, y: 0, w: pw, d: 7, kind: 'commercial', stages: mid });
    const dw = pw / Math.max(1, mid.length);
    mid.forEach((s, i) => {
      const zx = px + i * dw;
      add(zx + dw / 2 + 0.9 + 1, desk(zx + dw / 2 - 1, 0.9, 2, 0.9)); add(zx + dw / 2 + 0.2, chair(zx + dw / 2 - 0.2, 0.12));
      const u = users[ui % users.length]; add(zx + dw / 2 + 0.45, person(zx + dw / 2, 0.42, { color: uColor(ui), me: u?.id === boot.me?.id, name: initials(u?.name || ''), cls: `p${(ui % 3) + 1}` })); ui++;
      addSlot({ stage: s, x: zx + 0.25, y: 2.3, w: dw - 0.5, d: 4.4, cols: Math.max(2, Math.floor((dw - 0.5) / 1.05)), rows: 5, mode: 'dossier', short: short(s.name, 26), color: RED });
      if (i < mid.length - 1) add(zx + dw + 7, wall(zx + dw, 2.2, zx + dw, 7, 20));
    });
    addZone({ id: 'signature', name: 'Salle de signature', x: 28, y: 0, w: 7, d: 6, kind: 'commercial', stages: last ? [last] : [] });
    add(29.2 + 0.9 + 2.6, box(29.2, 0.9, 2.6, 1.6, 12, '#f2f3f6', { stroke: 'rgba(20,28,48,.15)' }) + box(29.4, 1.1, 2.2, 1.2, 1.5, WHITE, { z: 12 }));
    add(29.6 + 0.15, chair(29.7, 0.15)); add(31.2 + 0.15, chair(31.1, 0.15));
    add(33.4 + 1.2, person(33.4, 1.2, { color: uColor(ui), me: users[ui % users.length]?.id === boot.me?.id, name: initials(users[ui % users.length]?.name || ''), cls: 'p2' })); ui++;
    add(34.4 + 5.4, tree(34.4, 5.4, 12));
    if (last) addSlot({ stage: last, x: 28.3, y: 2.9, w: 6.4, d: 2.8, cols: 6, rows: 3, mode: 'dossier', short: short(last.name, 26), color: '#1fa971' });
  }

  // ---------- Impayés : cellule recouvrement
  const imp = byKind.impayes;
  if (imp) {
    const stages = m.stagesOf(imp.id);
    addZone({ id: 'recouvrement', name: 'Cellule recouvrement — impayés', x: 0, y: 8.5, w: 12, d: 7, kind: 'impayes', stages, fill: '#fff7f7' });
    const sw = 12 / Math.max(1, stages.length);
    stages.forEach((s, i) => {
      const zx = i * sw;
      add(zx + sw / 2 + 8.8, lamp(zx + sw / 2 - 0.15, 8.8));
      addSlot({ stage: s, x: zx + 0.2, y: 9.7, w: sw - 0.4, d: 5.5, cols: Math.max(1, Math.floor((sw - 0.4) / 1.0)), rows: 6, mode: 'dossier', short: short(s.name, 22), color: '#2b3245' });
      if (i < stages.length - 1) add(zx + sw + 15.5, wall(zx + sw, 9.6, zx + sw, 15.5, 14));
    });
  }

  // ---------- Portefeuille : rayonnages de contrats
  const port = byKind.portefeuille;
  if (port) {
    const stages = m.stagesOf(port.id);
    addZone({ id: 'rayonnages', name: 'Archives — contrats en portefeuille', x: 13.5, y: 8.5, w: 14, d: 9, kind: 'portefeuille', stages });
    const len = 12.4;
    stages.forEach((s, i) => {
      const sy = 9.1 + i * (7.8 / Math.max(stages.length, 1));
      shelf(14.2, sy, len, add);
      addSlot({ stage: s, x: 13.9, y: sy - 0.25, w: len + 0.6, d: 1.5, cols: 12, rows: 2, mode: 'contract', short: `Rayon ${String.fromCharCode(65 + i)} · ${short(s.name.trim(), 22)}`, color: RED, z: [1.5, 17.5], dx: 1.0, dy: 0, startX: 14.4, startY: sy + 0.07 });
    });
  }

  // ---------- Sinistres : atelier
  const sin = byKind.sinistres;
  if (sin) {
    const stages = m.stagesOf(sin.id);
    addZone({ id: 'atelier', name: 'Atelier sinistres', x: 29, y: 8.5, w: 10.5, d: 8, kind: 'sinistres', stages, fill: '#f6f6f9' });
    const bw = 10.5 / Math.max(1, stages.length);
    stages.forEach((s, i) => {
      const zx = 29 + i * bw;
      add(zx + 0.3 + 8.9, box(zx + 0.3, 8.9, bw - 0.6, 0.16, 4, RED, { stroke: 'none' }));
      add(zx + 0.3 + 16.3, box(zx + 0.3, 16.2, bw - 0.6, 0.16, 4, RED, { stroke: 'none' }));
      addSlot({ stage: s, x: zx + 0.25, y: 9.5, w: bw - 0.5, d: 6.6, cols: Math.max(1, Math.floor((bw - 0.5) / 1.2)), rows: 6, mode: 'sinistre', short: short(s.name, 22), color: '#7a5af8' });
      if (i < stages.length - 1) add(zx + bw + 16.5, wall(zx + bw, 9.3, zx + bw, 16.5, 12));
    });
    add(38.6 + 15.4, box(38.5, 15.3, 0.9, 0.9, 6, '#1a1d27', { stroke: 'none' }) + box(38.5, 15.3, 0.9, 0.9, 6, '#1a1d27', { z: 6, stroke: 'none' }) + box(38.5, 15.3, 0.9, 0.9, 6, '#1a1d27', { z: 12, stroke: 'none' }));
  }

  // ---------- Parking des contrats signés (affaires gagnées récentes)
  const won = st.deals.filter((d) => d.status === 'won' && ctx.pipeKind(d.pipeline_id) === 'commercial').sort((a, b) => (b.won_time || '').localeCompare(a.won_time || '')).slice(0, 14);
  add(-1001, floor(-1, 19, 42, 4.5, '#e3e5ec', 'stroke="rgba(20,28,48,.1)"'));
  for (let i = 0; i < 15; i++) add(-996, `<line x1="${iso(-0.2 + i * 2.9, 19.4).X}" y1="${iso(-0.2 + i * 2.9, 19.4).Y}" x2="${iso(-0.2 + i * 2.9, 22.2).X}" y2="${iso(-0.2 + i * 2.9, 22.2).Y}" stroke="#fff" stroke-width="2"/>`);
  add(5000, sign(20, 19.1, `Parking clients — ${won.length} contrat${won.length > 1 ? 's' : ''} signé${won.length > 1 ? 's' : ''}`, { z: 40, color: '#1fa971' }));
  won.forEach((d, i) => tokens.push({ deal: d, x: 0.6 + i * 2.9, y: 20.2, mode: 'car', color: tokenColor(ctx, d) }));
  add(-995, floor(-1, 23.8, 42, 1, '#dfe2ea'));
  [[-1.5, 7.6], [12.7, 7.4], [27.8, 7.4], [40.5, 7.6], [12.7, 18.2], [27.8, 18.1], [-1.6, 17.2], [40.6, 17.6], [40.8, 24.6], [-1.6, 24.6], [20, 24.6]].forEach(([x, y]) => add(x + y + 0.5, tree(x, y, 14)));

  // ---------- Placement des affaires dans les emplacements
  const rank = (d) => (ctx.rottenDays(d) > 0 ? -1000 - ctx.rottenDays(d) : 0) - (Number(d.value) || 0) / 1e6;
  for (const s of slots) {
    const ds = openDeals.filter((d) => d.stage_id === s.stage.id).sort((a, b) => rank(a) - rank(b));
    const cap = s.cols * s.rows;
    ds.slice(0, cap).forEach((d, i) => {
      const col = i % s.cols, row = Math.floor(i / s.cols);
      let x, y, z = 0;
      if (s.mode === 'contract') { x = s.startX + col * s.dx; y = s.startY; z = s.z[row] ?? 0; }
      else { const cw = s.w / s.cols, ch = s.d / s.rows; x = s.x + col * cw + cw / 2 - 0.4; y = s.y + row * ch + ch / 2 - 0.32; }
      tokens.push({ deal: d, x, y, z, mode: s.mode, color: s.mode === 'contract' ? echColor(ctx, d) : tokenColor(ctx, d), slot: s });
    });
    if (ds.length > cap) add(5000, sign(s.x + s.w / 2, s.y + s.d - 0.4, `+${ds.length - cap} autres`, { z: 30, color: '#5c6b8a', small: true }));
    s.count = ds.length; s.cap = cap;
  }
  for (const z of zones) {
    const count = slots.filter((sl) => z.stages.some((st2) => st2.id === sl.stage.id)).reduce((a, sl) => a + (sl.count || 0), 0);
    add(6000 + z.x + z.y, sign(z.x + z.w / 2, z.y + 0.3, `${z.name} · ${count}`, { z: 98 }));
  }
  for (const t of tokens) {
    const d = t.deal; const rot = ctx.rottenDays(d);
    const attrs = `data-deal="${d.id}" data-stage="${d.stage_id}"`;
    const cls = `token ${state.selected === d.id ? 'sel' : ''} ${state.query && !matches(ctx, d, state.query) ? 'dim' : ''}`;
    let svg;
    if (t.mode === 'person') svg = `<g class="${cls}" ${attrs}><circle class="tk-glow" cx="${iso(t.x + 0.4, t.y + 0.3).X}" cy="${iso(t.x + 0.4, t.y + 0.3).Y - 18}" r="22" fill="rgba(227,38,44,.18)" stroke="${RED}" stroke-width="1.5"/>${person(t.x + 0.4, t.y + 0.3, { color: t.color, cls: `p${(d.id % 3) + 1}` })}</g>`;
    else if (t.mode === 'car') svg = car(t.x, t.y, t.color, { cls, attrs });
    else if (t.mode === 'contract') svg = contractBox(t.x, t.y, t.color, { z: t.z, cls, attrs });
    else if (t.mode === 'sinistre' && [94, 106].includes(Number(ctx.cf(d, 'typeGarantie')))) svg = car(t.x - 0.15, t.y - 0.05, t.color, { cls, attrs });
    else svg = dossier(t.x, t.y, t.color, { z: t.z, cls, attrs });
    if (rot) { const p = iso(t.x + 0.4, t.y + 0.3, t.z + 28); const dy = t.mode === 'person' ? 30 : 0; svg += `<g pointer-events="none"><circle cx="${p.X + 11}" cy="${p.Y - dy}" r="7" fill="${RED}" stroke="#fff" stroke-width="1.5"/><text x="${p.X + 11}" y="${p.Y - dy + 3.5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff">!</text></g>`; }
    add(t.x + t.y + 0.7 + (t.mode === 'contract' ? 0.8 : 0), svg);
  }
  items.sort((a, b) => a.k - b.k);
  const pts = [iso(-2, -1), iso(41, -1), iso(41, 25), iso(-2, 25)];
  const minX = Math.min(...pts.map((p) => p.X)), maxX = Math.max(...pts.map((p) => p.X)), minY = Math.min(...pts.map((p) => p.Y)) - 80, maxY = Math.max(...pts.map((p) => p.Y)) + 20;
  const full = { minX, minY, w: maxX - minX, h: maxY - minY };
  // Vue initiale : recadrée sur le bâtiment (les coins vides du losange isométrique sont coupés)
  const k = 0.8, initial = { w: full.w * k, h: full.h * k, minX: full.minX + full.w * (1 - k) / 2, minY: full.minY + full.h * (1 - k) / 2 - 70 };
  return { svg: items.map((i) => i.svg).join(''), bounds: initial, full, zones, slots, tokens };
}

function matches(ctx, d, q) {
  q = q.toLowerCase();
  return [d.title, ctx.contactName(d), ctx.garantie(d), ctx.assureur(d), ctx.cf(d, 'numContrat'), ctx.m.person[d.person_id]?.phones?.[0]?.value, ctx.m.person[d.person_id]?.emails?.[0]?.value].some((v) => v && String(v).toLowerCase().includes(q));
}

// ----------------------------------------------------------------- rendu HTML
export function renderCabinet(ctx) {
  const scene = buildScene(ctx);
  state.scene = scene;
  const vb = state.view || scene.bounds;
  const g = ctx.state.gamification;
  const com = ctx.state.deals.filter((d) => d.status === 'open' && ctx.pipeKind(d.pipeline_id) === 'commercial');
  const rotten = com.filter((d) => ctx.rottenDays(d) > 0).length;
  const onTime = com.length ? Math.round(100 * (com.length - rotten) / com.length) : 100;
  const ym = today().slice(0, 7), prev = new Date(); prev.setMonth(prev.getMonth() - 1); const ypm = prev.toISOString().slice(0, 7);
  const wonIn = (p) => ctx.state.deals.filter((d) => d.status === 'won' && ctx.pipeKind(d.pipeline_id) === 'commercial' && (d.won_time || '').startsWith(p));
  const wm = wonIn(ym), wpm = wonIn(ypm);
  const sum = (a) => a.reduce((x, d) => x + (Number(d.value) || 0), 0);
  const trend = sum(wpm) ? Math.round(100 * (sum(wm) - sum(wpm)) / sum(wpm)) : null;
  const target = ctx.boot.monthlyTarget || 10000;
  return `<div class="cabinet" id="cabinet">
    <svg viewBox="${vb.minX} ${vb.minY} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet">
      <defs><pattern id="grid" width="${TW}" height="${TH}" patternUnits="userSpaceOnUse" patternTransform="translate(0 0)"><path d="M${TW / 2} 0 L${TW} ${TH / 2} L${TW / 2} ${TH} L0 ${TH / 2} Z" fill="none" stroke="rgba(20,28,48,.06)"/></pattern></defs>
      <g id="scene">${scene.svg}</g>
    </svg>
    <div class="ov cab-search"><input type="search" id="cab-q" placeholder="Rechercher affaires, clients, contrats, téléphones…" value="${esc(state.query)}" autocomplete="off"><div class="cab-results" id="cab-results" hidden></div></div>
    <div class="ov cab-kpis">
      <div class="cab-kpi"><div class="ck-icon">⏱</div><div class="ck-label">Dossiers à jour</div><div class="ck-value">${onTime} %<small class="${rotten ? 'down' : ''}">${rotten ? '↓ ' + rotten + ' en sommeil' : '↑ aucun retard'}</small></div><div class="ck-hint">pipeline commercial · ${com.length} affaires</div></div>
      <div class="cab-kpi"><div class="ck-icon">📈</div><div class="ck-label">Primes signées ce mois</div><div class="ck-value">${eur(sum(wm))}${trend !== null ? `<small class="${trend < 0 ? 'down' : ''}">${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)} %</small>` : ''}</div><div class="ck-hint">${wm.length} contrat${wm.length > 1 ? 's' : ''} · objectif ${eur(target)}</div></div>
      <div class="cab-kpi"><div class="ck-icon">⚡</div><div class="ck-label">Votre progression</div><div class="ck-value">+${g.todayXp} XP<small>niv. ${g.level} · 🔥 ${g.streak} j</small></div><div class="ck-hint">${esc(g.title)} · ${g.quests.daily.filter((q) => q.completed).length}/${g.quests.daily.length} missions du jour</div></div>
    </div>
    <div class="cab-zone" id="cab-zone" hidden></div>
    <div class="ov cab-tools" id="cab-tools"><button data-cab="zoom-in" title="Zoom avant">+</button><button data-cab="zoom-out" title="Zoom arrière">−</button><button data-cab="fit" title="Recentrer">⤢</button></div>
    <div class="ov cab-legend"><span><i style="background:${RED}"></i>RC Décennale</span><span><i style="background:#2f6fed"></i>Multirisque</span><span><i style="background:#0ea5c6"></i>Auto</span><span><i style="background:#e0409a"></i>Santé</span><span><i style="background:#1fa971"></i>Échéance &gt; 90 j</span><span><i style="background:#e8960f"></i>Échéance &lt; 90 j</span><span>🔴 ! = en sommeil</span></div>
    <div class="cab-hint">Glissez un dossier vers une autre étape · cliquez pour le suivre · double-clic pour ouvrir la fiche</div>
    ${state.selected ? renderTrack(ctx) : ''}
  </div>`;
}

function renderTrack(ctx) {
  const d = ctx.m.deal[state.selected];
  if (!d) { state.selected = null; return ''; }
  const stages = ctx.m.stagesOf(d.pipeline_id);
  const idx = stages.findIndex((s) => s.id === d.stage_id);
  const kind = ctx.pipeKind(d.pipeline_id);
  const wonLabel = { commercial: '🏆 Gagnée', impayes: '🛟 Régularisé', portefeuille: '🔁 Reconduit', sinistres: '🏁 Clôturé' }[kind];
  return `<div class="ov cab-track" id="cab-track">
    <button class="ct-close" data-cab="deselect">✕</button>
    <div class="ct-head"><span class="ct-ref">#${d.id} · ${esc(ctx.m.pipeline[d.pipeline_id]?.name || '')}</span><b>${esc(d.title)}</b><small>${esc(ctx.contactName(d) || '—')} · ${eur(d.value)}${ctx.garantie(d) ? ' · ' + esc(ctx.garantie(d)) : ''}${ctx.assureur(d) ? ' · ' + esc(ctx.assureur(d)) : ''}</small></div>
    <div class="ct-steps">${stages.map((s, i) => {
      const cls = d.status === 'won' ? 'on done-all' : i < idx ? 'on' : i === idx ? 'cur' : 'future';
      const date = i === 0 ? fmtDate(d.add_time) : i === idx ? fmtDate(d.stage_change_time) : d.status === 'won' && i === stages.length - 1 ? fmtDate(d.won_time) : '';
      return `<div class="ct-step ${cls}"><div class="ct-dot" data-action="move-stage" data-id="${d.id}" data-stage="${s.id}" title="Déplacer vers ${esc(s.name)}">${i < idx || d.status === 'won' ? '✓' : ''}</div><div class="ct-name">${esc(s.name.length > 28 ? s.name.slice(0, 27) + '…' : s.name)}</div><div class="ct-date">${date}</div></div>`;
    }).join('')}</div>
    <div class="ct-actions">${d.status === 'open' ? `<button class="btn sm success" data-action="win-deal" data-id="${d.id}">${wonLabel}</button>` : ''}<button class="btn sm" data-action="new-activity" data-deal="${d.id}">+ Activité</button><button class="btn sm primary" data-action="open-deal" data-id="${d.id}">Fiche</button></div>
  </div>`;
}

// ----------------------------------------------------------------- interactions
export function bindCabinet(ctx) {
  const root = document.getElementById('cabinet'); if (!root) return;
  const svg = root.querySelector('svg');
  const toSvg = (cx, cy) => { const p = new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y }; };
  const getVB = () => { const [x, y, w, h] = svg.getAttribute('viewBox').split(' ').map(Number); return { minX: x, minY: y, w, h }; };
  const setVB = (v) => { state.view = v; svg.setAttribute('viewBox', `${v.minX} ${v.minY} ${v.w} ${v.h}`); };
  const zoom = (f, cx, cy) => { const v = getVB(); const p = cx !== undefined ? toSvg(cx, cy) : { x: v.minX + v.w / 2, y: v.minY + v.h / 2 }; const w = Math.min(Math.max(v.w / f, 500), 5000), h = v.h * (w / v.w); setVB({ minX: p.x - (p.x - v.minX) * (w / v.w), minY: p.y - (p.y - v.minY) * (h / v.h), w, h }); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  root.querySelector('#cab-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-cab]'); if (!b) return; if (b.dataset.cab === 'zoom-in') zoom(1.3); if (b.dataset.cab === 'zoom-out') zoom(1 / 1.3); if (b.dataset.cab === 'fit') setVB(state.scene.full); });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-cab=deselect]')) { state.selected = null; root.querySelectorAll('.token.sel').forEach((t) => t.classList.remove('sel')); root.querySelector('#cab-track')?.remove(); } });

  // Panoramique + glisser-déposer des dossiers
  let pan = null, drag = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const token = e.target.closest('.token');
    if (token) { drag = { el: token, id: Number(token.dataset.deal), stage: Number(token.dataset.stage), sx: e.clientX, sy: e.clientY, start: toSvg(e.clientX, e.clientY), moved: false }; token.setPointerCapture?.(e.pointerId); }
    else { pan = { sx: e.clientX, sy: e.clientY, vb: getVB() }; svg.classList.add('panning'); }
  });
  svg.addEventListener('pointermove', (e) => {
    if (pan) { const v = pan.vb, k = v.w / svg.clientWidth; setVB({ ...v, minX: v.minX - (e.clientX - pan.sx) * k, minY: v.minY - (e.clientY - pan.sy) * k }); return; }
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      if (!drag.moved) { drag.moved = true; state.dragging = true; drag.el.classList.add('dragging'); drag.el.parentNode.appendChild(drag.el); }
      const p = toSvg(e.clientX, e.clientY);
      drag.el.setAttribute('transform', `translate(${p.x - drag.start.x} ${p.y - drag.start.y})`);
      const slot = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('slot'));
      root.querySelectorAll('.slot.over').forEach((s) => { if (s !== slot) s.classList.remove('over'); });
      if (slot) slot.classList.add('over');
    }
  });
  const endDrag = async (e) => {
    if (pan) { pan = null; svg.classList.remove('panning'); }
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) { select(d.id); return; }
    state.dragging = false; d.el.classList.remove('dragging');
    const slot = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('slot'));
    root.querySelectorAll('.slot.over').forEach((s) => s.classList.remove('over'));
    const stage = slot ? Number(slot.dataset.stage) : null;
    if (stage && stage !== d.stage) { state.selected = d.id; await ctx.moveDeal(d.id, stage); }
    else d.el.removeAttribute('transform');
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', (e) => { const t = e.target.closest('.token'); if (t) ctx.openDeal(Number(t.dataset.deal)); });

  function select(id) {
    state.selected = id;
    root.querySelectorAll('.token').forEach((t) => t.classList.toggle('sel', Number(t.dataset.deal) === id));
    root.querySelector('#cab-track')?.remove();
    root.insertAdjacentHTML('beforeend', renderTrack(ctx));
  }

  // Survol des zones → panneau d'information
  const zoneBox = root.querySelector('#cab-zone');
  svg.addEventListener('pointerover', (e) => {
    const sl = e.target.closest('.slot'), zh = e.target.closest('.zone-hit');
    const zone = sl ? state.scene.zones.find((x) => x.stages.some((st) => st.id === Number(sl.dataset.stage))) : zh ? state.scene.zones.find((x) => x.id === zh.dataset.zone) : null;
    if (!zone) return;
    const slots = state.scene.slots.filter((s) => zone.stages.some((st) => st.id === s.stage.id));
    const count = slots.reduce((a, s) => a + (s.count || 0), 0), cap = slots.reduce((a, s) => a + (s.cap || 0), 0) || 1;
    const value = ctx.state.deals.filter((d) => d.status === 'open' && zone.stages.some((st) => st.id === d.stage_id)).reduce((a, d) => a + (Number(d.value) || 0), 0);
    zoneBox.hidden = false;
    zoneBox.innerHTML = `<span class="cz-tag">${esc(zone.name.slice(0, 2).toUpperCase())}</span><b>${esc(zone.name)}</b>${Math.round(100 * count / cap)} % d’occupation · ${count} dossier${count > 1 ? 's' : ''} · ${eur(value)}<div class="cz-bar"><i style="width:${Math.min(100, Math.round(100 * count / cap))}%"></i></div>`;
  });

  // Recherche
  const q = root.querySelector('#cab-q'), results = root.querySelector('#cab-results');
  const applyQuery = () => {
    state.query = q.value.trim();
    const open = ctx.state.deals.filter((d) => d.status === 'open');
    root.querySelectorAll('.token').forEach((t) => { const d = ctx.m.deal[Number(t.dataset.deal)]; t.classList.toggle('dim', !!state.query && !(d && matches(ctx, d, state.query))); });
    if (!state.query) { results.hidden = true; return; }
    const found = open.filter((d) => matches(ctx, d, state.query)).slice(0, 8);
    results.hidden = false;
    results.innerHTML = found.map((d) => `<div data-sel="${d.id}"><b>${esc(d.title)}</b><small>${esc(ctx.contactName(d))} · ${esc(ctx.m.stage[d.stage_id]?.name || '')} · ${eur(d.value)}</small></div>`).join('') || '<div class="muted">Aucun résultat</div>';
  };
  q.addEventListener('input', applyQuery);
  results.addEventListener('click', (e) => { const r = e.target.closest('[data-sel]'); if (!r) return; const id = Number(r.dataset.sel); select(id); results.hidden = true; const t = root.querySelector(`.token[data-deal="${id}"]`); if (t) { const b = t.getBBox(); const v = getVB(); setVB({ ...v, minX: b.x + b.width / 2 - v.w / 2, minY: b.y + b.height / 2 - v.h / 2 }); } });
  if (state.query) applyQuery();
  setTimeout(() => root.querySelector('.cab-hint')?.remove(), 6000);
}
