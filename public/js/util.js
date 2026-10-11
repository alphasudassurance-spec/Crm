export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
export const eur2 = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
export const fmtDate = (d) => d ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
export const fmtDateTime = (d) => d ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';
export const today = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (a, b = new Date()) => Math.floor((new Date(b) - new Date(a)) / 86400000);
export const daysUntil = (d) => Math.ceil((new Date(d) - new Date(today())) / 86400000);
export const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
export const money = (v) => (v && typeof v === 'object' ? v.value : v);
export function relTime(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}
export const ACT_ICONS = { call: '📞', meeting: '🤝', task: '📋', deadline: '⏰', email: '✉️', lunch: '🍽️' };
export const ACT_LABELS = { call: 'Appel', meeting: 'Rendez-vous', task: 'Tâche', deadline: 'Échéance', email: 'E-mail', lunch: 'Déjeuner' };
export const LOST_REASONS = ['Tarif jugé trop élevé / concurrence', "Fin d'activité / société liquidée", 'Résiliation compagnie (sinistralité / impayé)', 'Non-reconduction (résiliation à échéance)', "Résiliation client - changement d'assureur", 'Sans réponse du prospect', 'Autre'];
