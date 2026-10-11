// Client de démonstration : reproduit la structure réelle du compte Pipedrive
// (pipelines, étapes, champs) avec des données fictives, et accepte les
// modifications en mémoire pour que l'interface soit entièrement interactive.
import { DEAL_FIELDS, ORG_FIELDS, DEFAULT_FIELD_OPTIONS } from './fields.js';

const ME = { id: 1, name: 'Alpha Sud Assurance', email: 'contact@alphasudassurance.fr', default_currency: 'EUR', locale: 'fr_FR', timezone_name: 'Europe/Paris', company_name: 'alpha sud assurance', company_domain: 'alphasudassurance' };
const USERS = [
  ME,
  { id: 2, name: 'Sarah Benali', email: 'sarah@alphasudassurance.fr', active_flag: true },
  { id: 3, name: 'Mehdi Roux', email: 'mehdi@alphasudassurance.fr', active_flag: true },
];

const PIPELINES = [
  { id: 3, name: 'Commerciale', order_nr: 1, is_deal_probability_enabled: true },
  { id: 4, name: 'Alertes impayés — sauvegarde contrat', order_nr: 2 },
  { id: 5, name: 'Portefeuille & échéances', order_nr: 3 },
  { id: 6, name: 'Sinistres', order_nr: 4 },
];
const STAGES = [
  { id: 13, pipeline_id: 3, order_nr: 1, name: 'Contact entrant / à qualifier', deal_probability: 10, is_deal_rot_enabled: true, days_to_rotten: 3 },
  { id: 14, pipeline_id: 3, order_nr: 2, name: 'Recueil des besoins', deal_probability: 25, is_deal_rot_enabled: true, days_to_rotten: 5 },
  { id: 15, pipeline_id: 3, order_nr: 3, name: 'Étude & placement compagnie', deal_probability: 40, is_deal_rot_enabled: true, days_to_rotten: 7 },
  { id: 16, pipeline_id: 3, order_nr: 4, name: 'Proposition remise', deal_probability: 60, is_deal_rot_enabled: true, days_to_rotten: 7 },
  { id: 17, pipeline_id: 3, order_nr: 5, name: 'Relance / négociation', deal_probability: 75, is_deal_rot_enabled: true, days_to_rotten: 5 },
  { id: 27, pipeline_id: 3, order_nr: 6, name: 'Formalités & signature (lettre de mission, mandat, RIB)', deal_probability: 90, is_deal_rot_enabled: true, days_to_rotten: 10 },
  { id: 18, pipeline_id: 4, order_nr: 1, name: 'Impayé signalé (rejet de prélèvement, avis compagnie)', deal_probability: 100 },
  { id: 19, pipeline_id: 4, order_nr: 2, name: 'Client joint — cause identifiée', deal_probability: 100 },
  { id: 20, pipeline_id: 4, order_nr: 3, name: 'Solution engagée', deal_probability: 100 },
  { id: 21, pipeline_id: 4, order_nr: 4, name: 'MED reçue', deal_probability: 100 },
  { id: 22, pipeline_id: 4, order_nr: 5, name: 'Fenêtre finale avant suspension', deal_probability: 100 },
  { id: 23, pipeline_id: 5, order_nr: 1, name: 'Contrat actif', deal_probability: 100 },
  { id: 24, pipeline_id: 5, order_nr: 2, name: 'Échéance J-90', deal_probability: 100 },
  { id: 25, pipeline_id: 5, order_nr: 3, name: 'Point client réalisé', deal_probability: 100 },
  { id: 26, pipeline_id: 5, order_nr: 4, name: 'Reconduit', deal_probability: 100 },
  { id: 28, pipeline_id: 6, order_nr: 1, name: 'Sinistre déclaré', deal_probability: 100 },
  { id: 29, pipeline_id: 6, order_nr: 2, name: 'Dossier transmis à la compagnie', deal_probability: 100 },
  { id: 30, pipeline_id: 6, order_nr: 3, name: 'Expertise en cours', deal_probability: 100 },
  { id: 31, pipeline_id: 6, order_nr: 4, name: 'Indemnisation', deal_probability: 100 },
  { id: 32, pipeline_id: 6, order_nr: 5, name: 'Clôturé', deal_probability: 100 },
];

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const dateOnly = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const inDays = (n) => daysAgo(-n);

const ORGS = [
  ['ATLAS RÉNOVATION', 'SARL', 'Maçonnerie / gros œuvre'], ['BÂTI SUD PROVENCE', 'SAS', 'Couverture'], ['MENUISERIE CARDINAL', 'EURL', 'Menuiserie bois'],
  ['ÉLEC PLUS 13', 'SASU', 'Qualifelec'], ['PEINTURE DU LITTORAL', 'SARL', 'Peinture / ravalement'], ['TOITURES MARSEILLAISES', 'SAS', 'Zinguerie'],
  ['CARRELAGE ARTISAN', 'Micro-entreprise', 'Carrelage / faïence'], ['ISOL&CO', 'SARL', "Isolation thermique par l'extérieur"], ['CHARPENTE DES CALANQUES', 'SARL', 'Charpente'],
  ['PLÂTRERIE MODERNE', 'EURL', 'Plâtrerie / cloisons'], ['SUD PISCINES', 'SAS', 'Maçonnerie / gros œuvre'], ['TRANSPORTS AZUR', 'SARL', 'Flotte'],
  ['BOULANGERIE LE FOURNIL', 'SARL', 'Commerce'], ['GARAGE DU PORT', 'SAS', 'Automobile'], ['AGENCE IMMO MÉDITERRANÉE', 'SAS', 'Services'],
].map(([name, forme, act], i) => ({ id: 100 + i, name, owner_id: 1, custom_fields: { [ORG_FIELDS.formeJuridique]: forme, [ORG_FIELDS.activites]: act, [ORG_FIELDS.statutPaiement]: 48 } }));

const PERSONS = [
  ['Karim Haddad', 100], ['Julie Martin', 101], ['Paul Cardinal', 102], ['Nadia Ferhat', 103], ['Luc Moreau', 104], ['Yanis Belkacem', 105],
  ['Sofia Costa', 106], ['Marc Lefèvre', 107], ['Élodie Garnier', 108], ['Samir Oukil', 109], ['Thomas Blanc', 110], ['Inès Rahmani', 111],
  ['Hugo Petit', 112], ['Camille Durand', 113], ['Léa Fontaine', 114], ['Omar Zidane', null], ['Chloé Mercier', null], ['Amine Taleb', null],
].map(([name, org], i) => ({
  id: 200 + i, name, org_id: org, owner_id: 1,
  emails: [{ value: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@exemple.fr', primary: true }],
  phones: [{ value: `06 ${String(10 + i).padStart(2, '0')} 4${i % 10}2 5${(i * 3) % 10}1 7${(i * 7) % 10}`, primary: true }],
}));

const F = DEAL_FIELDS;
let dealSeq = 1000;
function deal({ title, value, pipeline_id, stage_id, person_id, org_id, owner_id = 1, status = 'open', ageDays = 2, stageDays = ageDays, garantie, assureur, prime, echeance, impaye, contrat, wonDaysAgo, lostDaysAgo, lost_reason }) {
  const add = daysAgo(ageDays);
  const d = {
    id: dealSeq++, title, value, currency: 'EUR', pipeline_id, stage_id, person_id, org_id, owner_id, creator_user_id: owner_id, status,
    add_time: iso(add), update_time: iso(daysAgo(Math.min(ageDays, stageDays))), stage_change_time: iso(daysAgo(stageDays)),
    probability: null, lost_reason: lost_reason || null, won_time: null, lost_time: null, close_time: null, expected_close_date: null, label_ids: [], is_deleted: false,
    notes_count: Math.floor(Math.random() * 3), undone_activities_count: 0,
    custom_fields: {
      [F.typeGarantie]: garantie ?? null, [F.assureur]: assureur ?? null, [F.primeAnnuelle]: prime ? { value: prime, currency: 'EUR' } : null,
      [F.dateEcheance]: echeance ? dateOnly(inDays(echeance)) : null, [F.montantImpaye]: impaye ? { value: impaye, currency: 'EUR' } : null,
      [F.numContrat]: contrat ?? null, [F.fractionnement]: 71, [F.dateEffet]: contrat ? dateOnly(daysAgo(ageDays)) : null,
    },
  };
  if (wonDaysAgo !== undefined) { d.status = 'won'; d.won_time = iso(daysAgo(wonDaysAgo)); d.close_time = d.won_time; }
  if (lostDaysAgo !== undefined) { d.status = 'lost'; d.lost_time = iso(daysAgo(lostDaysAgo)); d.close_time = d.lost_time; }
  return d;
}

function buildDeals() {
  return [
    // Pipeline commerciale
    deal({ title: 'ATLAS RÉNOVATION - RCD - 10/2026', value: 2450, pipeline_id: 3, stage_id: 13, person_id: 200, org_id: 100, ageDays: 1, garantie: 53, assureur: 92, prime: 2450 }),
    deal({ title: 'Boulangerie Le Fournil - Multirisque Pro', value: 1180, pipeline_id: 3, stage_id: 13, person_id: 212, org_id: 112, ageDays: 5, stageDays: 5, garantie: 57, assureur: 83, prime: 1180 }),
    deal({ title: 'BÂTI SUD PROVENCE - RCD - 11/2026', value: 3890, pipeline_id: 3, stage_id: 14, person_id: 201, org_id: 101, ageDays: 4, stageDays: 2, garantie: 53, assureur: 84, prime: 3890 }),
    deal({ title: 'Omar Zidane - Auto', value: 720, pipeline_id: 3, stage_id: 14, person_id: 215, ageDays: 9, stageDays: 8, garantie: 94, assureur: 89, prime: 720 }),
    deal({ title: 'MENUISERIE CARDINAL - RC Pro', value: 1560, pipeline_id: 3, stage_id: 15, person_id: 202, org_id: 102, ageDays: 12, stageDays: 3, garantie: 54, assureur: 87, prime: 1560, owner_id: 2 }),
    deal({ title: 'ÉLEC PLUS 13 - RCD - 12/2026', value: 2980, pipeline_id: 3, stage_id: 15, person_id: 203, org_id: 103, ageDays: 15, stageDays: 9, garantie: 53, assureur: 92, prime: 2980 }),
    deal({ title: 'PEINTURE DU LITTORAL - RCD', value: 1740, pipeline_id: 3, stage_id: 16, person_id: 204, org_id: 104, ageDays: 20, stageDays: 4, garantie: 53, assureur: 86, prime: 1740 }),
    deal({ title: 'Chloé Mercier - MRH', value: 410, pipeline_id: 3, stage_id: 16, person_id: 216, ageDays: 11, stageDays: 6, garantie: 82, assureur: 88, prime: 410, owner_id: 3 }),
    deal({ title: 'TOITURES MARSEILLAISES - TRC chantier Prado', value: 5200, pipeline_id: 3, stage_id: 17, person_id: 205, org_id: 105, ageDays: 25, stageDays: 2, garantie: 55, assureur: 87, prime: 5200 }),
    deal({ title: 'TRANSPORTS AZUR - Flotte automobile', value: 6400, pipeline_id: 3, stage_id: 17, person_id: 211, org_id: 111, ageDays: 30, stageDays: 7, garantie: 106, assureur: 83, prime: 6400, owner_id: 2 }),
    deal({ title: 'CARRELAGE ARTISAN - RCD - 10/2026', value: 1320, pipeline_id: 3, stage_id: 27, person_id: 206, org_id: 106, ageDays: 33, stageDays: 1, garantie: 53, assureur: 92, prime: 1320 }),
    deal({ title: 'Amine Taleb - Mutuelle santé', value: 960, pipeline_id: 3, stage_id: 27, person_id: 217, ageDays: 18, stageDays: 3, garantie: 102, assureur: 93, prime: 960 }),
    // Gagnées / perdues récentes
    deal({ title: 'ISOL&CO - RCD - 09/2026', value: 2210, pipeline_id: 3, stage_id: 27, person_id: 207, org_id: 107, ageDays: 40, garantie: 53, assureur: 92, prime: 2210, wonDaysAgo: 3 }),
    deal({ title: 'CHARPENTE DES CALANQUES - RCD', value: 3100, pipeline_id: 3, stage_id: 27, person_id: 208, org_id: 108, ageDays: 45, garantie: 53, assureur: 84, prime: 3100, wonDaysAgo: 9, owner_id: 2 }),
    deal({ title: 'GARAGE DU PORT - Multirisque Pro', value: 1890, pipeline_id: 3, stage_id: 27, person_id: 213, org_id: 113, ageDays: 50, garantie: 57, assureur: 83, prime: 1890, wonDaysAgo: 16 }),
    deal({ title: 'Léa Fontaine - Prévoyance', value: 540, pipeline_id: 3, stage_id: 16, person_id: 214, org_id: 114, ageDays: 22, garantie: 103, assureur: 86, prime: 540, lostDaysAgo: 2, lost_reason: 'Tarif jugé trop élevé / concurrence' }),
    deal({ title: 'SUD PISCINES - RCD', value: 2700, pipeline_id: 3, stage_id: 15, person_id: 210, org_id: 110, ageDays: 35, garantie: 53, assureur: 92, prime: 2700, wonDaysAgo: 28, owner_id: 3 }),
    // Impayés
    deal({ title: 'PLÂTRERIE MODERNE - RCD - 03/2026', value: 1980, pipeline_id: 4, stage_id: 18, person_id: 209, org_id: 109, ageDays: 2, garantie: 53, assureur: 92, prime: 1980, impaye: 165, contrat: 'FR13-RCD26P01184' }),
    deal({ title: 'GARAGE DU PORT - Multirisque Pro', value: 1890, pipeline_id: 4, stage_id: 19, person_id: 213, org_id: 113, ageDays: 6, stageDays: 1, garantie: 57, assureur: 83, prime: 1890, impaye: 315, contrat: 'MRP-889214' }),
    deal({ title: 'Omar Zidane - Auto', value: 720, pipeline_id: 4, stage_id: 21, person_id: 215, ageDays: 20, stageDays: 4, garantie: 94, assureur: 89, prime: 720, impaye: 120, contrat: 'AUTO-5521' }),
    // Portefeuille
    deal({ title: 'ATLAS RÉNOVATION - RCD - 10/2025', value: 2300, pipeline_id: 5, stage_id: 23, person_id: 200, org_id: 100, ageDays: 300, garantie: 53, assureur: 92, prime: 2300, echeance: 32, contrat: 'FR13-RCD25P02073' }),
    deal({ title: 'MENUISERIE CARDINAL - RCD - 01/2026', value: 1650, pipeline_id: 5, stage_id: 24, person_id: 202, org_id: 102, ageDays: 280, stageDays: 10, garantie: 53, assureur: 84, prime: 1650, echeance: 61, contrat: 'FR13-RCD26P00412' }),
    deal({ title: 'ISOL&CO - RCD - 09/2026', value: 2210, pipeline_id: 5, stage_id: 23, person_id: 207, org_id: 107, ageDays: 3, garantie: 53, assureur: 92, prime: 2210, echeance: 362, contrat: 'FR13-RCD26P03390' }),
    deal({ title: 'CHARPENTE DES CALANQUES - RCD', value: 3100, pipeline_id: 5, stage_id: 23, person_id: 208, org_id: 108, ageDays: 9, garantie: 53, assureur: 84, prime: 3100, echeance: 356, contrat: 'FR13-RCD26P03211' }),
    deal({ title: 'SUD PISCINES - RCD', value: 2700, pipeline_id: 5, stage_id: 23, person_id: 210, org_id: 110, ageDays: 28, garantie: 53, assureur: 92, prime: 2700, echeance: 337, contrat: 'FR13-RCD26P02988' }),
    deal({ title: 'AGENCE IMMO MÉDITERRANÉE - RC Pro', value: 1420, pipeline_id: 5, stage_id: 25, person_id: 214, org_id: 114, ageDays: 330, stageDays: 3, garantie: 54, assureur: 87, prime: 1420, echeance: 18, contrat: 'RCP-220031' }),
    deal({ title: 'Julie Martin - MRH', value: 380, pipeline_id: 5, stage_id: 23, person_id: 201, ageDays: 400, garantie: 82, assureur: 88, prime: 380, echeance: 85, contrat: 'MRH-7781' }),
    deal({ title: 'TRANSPORTS AZUR - Flotte 2025', value: 6100, pipeline_id: 5, stage_id: 26, person_id: 211, org_id: 111, ageDays: 370, stageDays: 1, garantie: 106, assureur: 83, prime: 6100, echeance: 364, contrat: 'FLT-10932', owner_id: 2 }),
    deal({ title: 'Hugo Petit - Mutuelle santé', value: 1240, pipeline_id: 5, stage_id: 23, person_id: 212, org_id: 112, ageDays: 200, garantie: 102, assureur: 93, prime: 1240, echeance: 120, contrat: 'MUT-55019' }),
    // Sinistres
    deal({ title: 'BÂTI SUD PROVENCE - Dégât des eaux chantier Aubagne', value: 8500, pipeline_id: 6, stage_id: 28, person_id: 201, org_id: 101, ageDays: 1, garantie: 53, assureur: 84, contrat: 'FR13-RCD25P01877' }),
    deal({ title: 'Omar Zidane - Accrochage parking', value: 1900, pipeline_id: 6, stage_id: 30, person_id: 215, ageDays: 14, stageDays: 5, garantie: 94, assureur: 89, contrat: 'AUTO-5521' }),
    deal({ title: 'TOITURES MARSEILLAISES - Chute de tuiles', value: 4200, pipeline_id: 6, stage_id: 31, person_id: 205, org_id: 105, ageDays: 40, stageDays: 3, garantie: 53, assureur: 87, contrat: 'FR13-RCD24P00921', owner_id: 3 }),
  ];
}

let actSeq = 5000;
function activity({ subject, type, due, deal_id, person_id, org_id, owner_id = 1, done = false, doneDaysAgo, note }) {
  const d = due >= 0 ? inDays(due) : daysAgo(-due);
  return {
    id: actSeq++, subject, type, owner_id, creator_user_id: owner_id, deal_id: deal_id ?? null, person_id: person_id ?? null, org_id: org_id ?? null,
    due_date: dateOnly(d), due_time: due === 0 ? '10:30' : null, duration: null, done, busy: false, note: note ?? null, priority: null,
    marked_as_done_time: done ? iso(daysAgo(doneDaysAgo ?? 0)) : null, add_time: iso(daysAgo(Math.max(0, -due) + 2)), update_time: done ? iso(daysAgo(doneDaysAgo ?? 0)) : iso(daysAgo(1)),
    participants: person_id ? [{ person_id, primary: true }] : [], is_deleted: false,
  };
}

function buildActivities(deals) {
  const byTitle = (t) => deals.find((d) => d.title.startsWith(t))?.id;
  return [
    activity({ subject: 'Appeler Karim pour qualifier le besoin RCD', type: 'call', due: 0, deal_id: byTitle('ATLAS RÉNOVATION - RCD - 10/2026'), person_id: 200, org_id: 100 }),
    activity({ subject: 'Envoyer questionnaire activités', type: 'email', due: 0, deal_id: byTitle('BÂTI SUD'), person_id: 201, org_id: 101 }),
    activity({ subject: 'RDV signature lettre de mission', type: 'meeting', due: 0, deal_id: byTitle('CARRELAGE ARTISAN'), person_id: 206, org_id: 106 }),
    activity({ subject: 'Relancer proposition SMABTP', type: 'call', due: -2, deal_id: byTitle('PEINTURE DU LITTORAL'), person_id: 204, org_id: 104, note: 'Devis envoyé le 02/10, pas de retour.' }),
    activity({ subject: 'Transmettre devis ELEC PLUS à Apri', type: 'task', due: -1, deal_id: byTitle('ÉLEC PLUS 13'), person_id: 203, org_id: 103 }),
    activity({ subject: 'Joindre le client : rejet de prélèvement', type: 'call', due: 0, deal_id: byTitle('PLÂTRERIE MODERNE'), person_id: 209, org_id: 109 }),
    activity({ subject: 'Vérifier régularisation impayé Garage du Port', type: 'task', due: 1, deal_id: byTitle('GARAGE DU PORT - Multirisque Pro'), person_id: 213, org_id: 113 }),
    activity({ subject: "Point client échéance J-90", type: 'meeting', due: 2, deal_id: byTitle('MENUISERIE CARDINAL - RCD - 01/2026'), person_id: 202, org_id: 102 }),
    activity({ subject: 'Récupérer photos dégât des eaux', type: 'task', due: 1, deal_id: byTitle('BÂTI SUD PROVENCE - Dégât'), person_id: 201, org_id: 101 }),
    activity({ subject: 'Négociation TRC : réponse Allianz attendue', type: 'deadline', due: 3, deal_id: byTitle('TOITURES MARSEILLAISES - TRC'), person_id: 205, org_id: 105 }),
    activity({ subject: 'Déjeuner apporteur – expert-comptable Cabinet Roux', type: 'lunch', due: 4, person_id: 214, org_id: 114 }),
    activity({ subject: 'Appel qualification Omar Zidane', type: 'call', due: -3, deal_id: byTitle('Omar Zidane - Auto'), person_id: 215, done: true, doneDaysAgo: 3 }),
    activity({ subject: 'Envoi IPID + proposition', type: 'email', due: -1, deal_id: byTitle('ISOL&CO - RCD - 09/2026'), person_id: 207, done: true, doneDaysAgo: 1 }),
    activity({ subject: 'Relance mutuelle Amine', type: 'call', due: -1, deal_id: byTitle('Amine Taleb'), person_id: 217, done: true, doneDaysAgo: 1 }),
    activity({ subject: 'Préparer dossier flotte', type: 'task', due: -2, deal_id: byTitle('TRANSPORTS AZUR - Flotte automobile'), person_id: 211, owner_id: 2, done: true, doneDaysAgo: 2 }),
  ];
}

export class MockClient {
  constructor() {
    this.mode = 'demo';
    this.deals = buildDeals();
    this.activities = buildActivities(this.deals);
    this.notes = {};
    for (const d of this.deals) {
      this.notes[d.id] = [{ id: d.id * 10, deal_id: d.id, content: `Dossier ${d.title} ouvert. Pièces à réunir : Kbis, attestation précédente, questionnaire activités.`, add_time: d.add_time, user_id: 1 }];
    }
    this.noteSeq = 90000;
  }
  async getMe() { return ME; }
  async getUsers() { return USERS; }
  async getPipelines() { return PIPELINES; }
  async getStages() { return STAGES; }
  async getPersons() { return PERSONS; }
  async getOrganizations() { return ORGS; }
  async getDeals() { return this.deals.map((d) => ({ ...d })); }
  async getActivities() { return this.activities.map((a) => ({ ...a })); }
  async getDealFields() { return DEFAULT_FIELD_OPTIONS; }

  async updateDeal(id, patch) {
    const d = this.deals.find((x) => x.id === Number(id));
    if (!d) throw Object.assign(new Error('Affaire introuvable'), { status: 404 });
    const now = iso(new Date());
    if (patch.stage_id && patch.stage_id !== d.stage_id) {
      d.stage_id = patch.stage_id; d.stage_change_time = now;
      const st = STAGES.find((s) => s.id === patch.stage_id); if (st) d.pipeline_id = st.pipeline_id;
    }
    if (patch.status && patch.status !== d.status) {
      d.status = patch.status;
      if (patch.status === 'won') { d.won_time = now; d.close_time = now; }
      if (patch.status === 'lost') { d.lost_time = now; d.close_time = now; d.lost_reason = patch.lost_reason || null; }
      if (patch.status === 'open') { d.won_time = d.lost_time = d.close_time = null; }
    }
    for (const k of ['title', 'value', 'expected_close_date', 'person_id', 'org_id', 'owner_id']) if (patch[k] !== undefined) d[k] = patch[k];
    if (patch.custom_fields) Object.assign(d.custom_fields, patch.custom_fields);
    d.update_time = now;
    return { ...d };
  }
  async createDeal(data) {
    const st = STAGES.find((s) => s.id === data.stage_id) || STAGES.find((s) => s.pipeline_id === (data.pipeline_id || 3));
    const d = deal({ title: data.title, value: Number(data.value) || 0, pipeline_id: st.pipeline_id, stage_id: st.id, person_id: data.person_id, org_id: data.org_id, owner_id: data.owner_id || 1, ageDays: 0 });
    if (data.custom_fields) Object.assign(d.custom_fields, data.custom_fields);
    this.deals.unshift(d); this.notes[d.id] = [];
    return { ...d };
  }
  async updateActivity(id, patch) {
    const a = this.activities.find((x) => x.id === Number(id));
    if (!a) throw Object.assign(new Error('Activité introuvable'), { status: 404 });
    if (patch.done !== undefined) { a.done = !!patch.done; a.marked_as_done_time = a.done ? iso(new Date()) : null; }
    for (const k of ['subject', 'due_date', 'due_time', 'note', 'type']) if (patch[k] !== undefined) a[k] = patch[k];
    a.update_time = iso(new Date());
    return { ...a };
  }
  async createActivity(data) {
    const a = activity({ subject: data.subject, type: data.type || 'task', due: 0, deal_id: data.deal_id, person_id: data.person_id, org_id: data.org_id, owner_id: data.owner_id || 1, note: data.note });
    if (data.due_date) a.due_date = data.due_date;
    a.due_time = data.due_time || null;
    this.activities.push(a);
    return { ...a };
  }
  async createPerson(data) { const p = { id: 200 + PERSONS.length, name: data.name, org_id: data.org_id ?? null, owner_id: 1, emails: data.emails || [], phones: data.phones || [] }; PERSONS.push(p); return p; }
  async createOrganization(data) { const o = { id: 100 + ORGS.length, name: data.name, owner_id: 1, custom_fields: {} }; ORGS.push(o); return o; }
  async getNotes(dealId) { return [...(this.notes[dealId] || [])].reverse(); }
  async addNote(dealId, content) {
    const n = { id: this.noteSeq++, deal_id: Number(dealId), content, add_time: iso(new Date()), user_id: 1 };
    (this.notes[dealId] ||= []).push(n);
    const d = this.deals.find((x) => x.id === Number(dealId)); if (d) d.notes_count = (d.notes_count || 0) + 1;
    return n;
  }
}
