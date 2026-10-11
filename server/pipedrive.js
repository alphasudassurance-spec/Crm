// Client Pipedrive (API v2 + quelques endpoints v1) basé sur fetch natif.
import { DEFAULT_FIELD_OPTIONS } from './fields.js';

export class PipedriveClient {
  constructor({ token, domain }) {
    if (!token) throw new Error('PIPEDRIVE_API_TOKEN manquant');
    this.token = token;
    this.base = domain ? `https://${domain}.pipedrive.com` : 'https://api.pipedrive.com';
    this.mode = 'live';
  }

  async request(method, path, { query, body } = {}) {
    const url = new URL(path, this.base);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      method,
      headers: { 'x-api-token': this.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok || json.success === false) {
      const err = new Error(json.error || json.error_info || `Pipedrive ${method} ${path} → HTTP ${res.status}`);
      err.status = res.status;
      err.details = json;
      throw err;
    }
    return json;
  }

  // Parcourt toutes les pages (curseur v2 ou start/limit v1)
  async paginate(path, query = {}, { v1 = false, max = 2000 } = {}) {
    const out = [];
    if (v1) {
      let start = 0;
      for (;;) {
        const r = await this.request('GET', path, { query: { ...query, start, limit: 500 } });
        out.push(...(r.data || []));
        const p = r.additional_data?.pagination;
        if (!p?.more_items_in_collection || out.length >= max) break;
        start = p.next_start;
      }
      return out;
    }
    let cursor;
    for (;;) {
      const r = await this.request('GET', path, { query: { ...query, limit: 500, cursor } });
      out.push(...(r.data || []));
      cursor = r.additional_data?.next_cursor;
      if (!cursor || out.length >= max) break;
    }
    return out;
  }

  async getMe() { return (await this.request('GET', '/v1/users/me')).data; }
  async getUsers() { return (await this.request('GET', '/v1/users')).data || []; }
  getPipelines() { return this.paginate('/api/v2/pipelines'); }
  getStages() { return this.paginate('/api/v2/stages', { sort_by: 'order_nr' }); }
  getPersons() { return this.paginate('/api/v2/persons'); }
  getOrganizations() { return this.paginate('/api/v2/organizations'); }

  async getDeals({ since } = {}) {
    const open = await this.paginate('/api/v2/deals', { status: 'open', include_fields: 'notes_count,undone_activities_count,next_activity_id' });
    const closed = await this.paginate('/api/v2/deals', { status: 'won,lost', updated_since: since, sort_by: 'update_time', sort_direction: 'desc' }, { max: 1000 });
    return [...open, ...closed];
  }

  async getActivities({ since } = {}) {
    const undone = await this.paginate('/api/v2/activities', { done: false });
    const done = await this.paginate('/api/v2/activities', { done: true, updated_since: since, sort_by: 'update_time', sort_direction: 'desc' }, { max: 1000 });
    return [...undone, ...done];
  }

  async getDealFields() {
    try {
      const fields = await this.paginate('/v1/dealFields', {}, { v1: true });
      const map = {};
      for (const f of fields) {
        if (!f.edit_flag && !/^[a-f0-9]{40}$/.test(f.key)) continue;
        map[f.key] = { name: f.name, type: f.field_type };
        if (f.options) map[f.key].options = Object.fromEntries(f.options.map((o) => [o.id, o.label]));
      }
      return { ...DEFAULT_FIELD_OPTIONS, ...map };
    } catch {
      return DEFAULT_FIELD_OPTIONS;
    }
  }

  async updateDeal(id, patch) { return (await this.request('PATCH', `/api/v2/deals/${id}`, { body: patch })).data; }
  async createDeal(data) { return (await this.request('POST', '/api/v2/deals', { body: data })).data; }
  async updateActivity(id, patch) { return (await this.request('PATCH', `/api/v2/activities/${id}`, { body: patch })).data; }
  async createActivity(data) { return (await this.request('POST', '/api/v2/activities', { body: data })).data; }
  async createPerson(data) { return (await this.request('POST', '/api/v2/persons', { body: data })).data; }
  async createOrganization(data) { return (await this.request('POST', '/api/v2/organizations', { body: data })).data; }
  async getNotes(dealId) { return (await this.request('GET', '/v1/notes', { query: { deal_id: dealId, sort: 'add_time DESC', limit: 50 } })).data || []; }
  async addNote(dealId, content) { return (await this.request('POST', '/v1/notes', { body: { deal_id: dealId, content } })).data; }
}
