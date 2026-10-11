async function call(method, url, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}
export const api = {
  bootstrap: () => call('GET', '/api/bootstrap'),
  state: (force) => call('GET', `/api/state${force ? '?force=1' : ''}`),
  sync: () => call('POST', '/api/sync'),
  updateDeal: (id, patch) => call('PATCH', `/api/deals/${id}`, patch),
  createDeal: (data) => call('POST', '/api/deals', data),
  updateActivity: (id, patch) => call('PATCH', `/api/activities/${id}`, patch),
  createActivity: (data) => call('POST', '/api/activities', data),
  notes: (dealId) => call('GET', `/api/deals/${dealId}/notes`),
  addNote: (dealId, content) => call('POST', `/api/deals/${dealId}/notes`, { content }),
};
