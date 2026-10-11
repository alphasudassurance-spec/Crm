// Clés des champs personnalisés Pipedrive du cabinet (récupérées via l'API).
// Le serveur recharge dynamiquement la liste via /v1/dealFields ; ces clés
// servent de valeurs par défaut et de raccourcis pour l'interface.
export const DEAL_FIELDS = {
  assureur: '39cd37a05e14759403c896bbada55b6df94cbf75',
  dateEffet: 'eb102d5b5046c7df851547e4dea636af071a99c7',
  numContrat: '0589fac50fb010dabedeef60ccdec223d06bec5a',
  dateEcheance: '32549d35cececdd20178afeed920cff06b120d48',
  grossiste: 'd89c0432c3a49c6e3c2abdf278d1d03cfed4fd82',
  typeGarantie: '1ad27453ce4541a24ccd8fa5142a32ce90b5dabf',
  fractionnement: '5a918e668ccae001ef318a799bdad090edad5ea0',
  primeAnnuelle: 'ab491250238cba765d53dff49a1a926e23c3528d',
  sourceSignalement: '473044ed6b35d46bc80d9c2a899af2a49fe09334',
  dateSignalement: 'ba2752578c14dd0bb34df5d5075d0b0dbb84ce5d',
  dateEcheancePrime: '5973fb7817113dd6be9375126b0426d71496ca6b',
  montantImpaye: '88d71b6a1ff2da532ee3afa513dcaef6b1b6c6ca',
  recueilBesoins: '9d4f1cdc9d73551654a7b04f58bb62d0238d1795',
  ipidRemis: '55ad0e6c08598e0c35b2ed930e35a0399db848ae',
  declarationAdequation: 'f97a490e3c466bb780052778985cdebc0405ee74',
  lettreMission: '0a988b1b4035d7bb889e48166d23e0225ec9cef1',
};

export const ORG_FIELDS = {
  siret: '7d8454ed6d611d2f5e5fec9b550a47ccb798eadc',
  formeJuridique: '261e680976ed9e1c02e38953331d613aff230a8d',
  statutPaiement: 'fb010bfcda043b243405a23cf5d8772d877f80e5',
  encoursImpaye: '8a3299d6fde1b0598fdd124746498c7099ba9db7',
  antecedents: '6009829d83a980f47cb4271dde9a7a1c8dc5298f',
  activites: 'f189fac880fe1c2a9105a5690fae80db0ac09ef7',
};

// Options connues (utilisées en mode démo et en secours si l'API ne répond pas)
export const DEFAULT_FIELD_OPTIONS = {
  [DEAL_FIELDS.assureur]: { name: 'Assureur (porteur du risque)', options: { 83: 'AXA', 84: 'MAAF', 85: 'MMA', 86: 'Generali', 87: 'Allianz', 88: 'Groupama', 89: 'MACIF', 90: 'GMF', 91: 'Matmut', 92: 'SMABTP', 93: 'Autre' } },
  [DEAL_FIELDS.grossiste]: { name: 'Courtier grossiste / Plateforme', options: { 58: 'Entoria', 59: 'Apri', 60: 'CBA', 61: 'NETVOX', 62: 'SPRING ASSUR', 63: 'ORUS', 64: 'KASE', 65: 'D2P', 66: 'ZEPHIR', 67: 'SOLLY AZAR' } },
  [DEAL_FIELDS.typeGarantie]: { name: 'Type de garantie', options: { 53: 'RC Décennale', 54: 'RC Pro', 55: 'TRC', 56: 'DO', 57: 'Multirisque Pro', 82: 'MRH', 94: 'Auto', 102: 'Mutuelle santé', 103: 'Prévoyance', 104: 'RC Exploitation', 105: 'Protection juridique', 106: 'Flotte automobile' } },
  [DEAL_FIELDS.fractionnement]: { name: 'Fractionnement', options: { 68: 'Annuel', 69: 'Semestriel', 70: 'Trimestriel', 71: 'Mensuel' } },
  [DEAL_FIELDS.sourceSignalement]: { name: 'Source du signalement', options: { 72: 'Extranet', 73: 'Mail gestionnaire', 74: 'Bordereau', 75: 'Appel', 76: 'Client' } },
  [DEAL_FIELDS.dateEffet]: { name: "Date d'effet" },
  [DEAL_FIELDS.numContrat]: { name: 'N° de contrat' },
  [DEAL_FIELDS.dateEcheance]: { name: "Date d'échéance" },
  [DEAL_FIELDS.primeAnnuelle]: { name: 'Prime annuelle TTC' },
  [DEAL_FIELDS.dateSignalement]: { name: 'Date du signalement' },
  [DEAL_FIELDS.dateEcheancePrime]: { name: "Date d'échéance de prime" },
  [DEAL_FIELDS.montantImpaye]: { name: 'Montant impayé' },
  [DEAL_FIELDS.recueilBesoins]: { name: 'Recueil des besoins' },
  [DEAL_FIELDS.ipidRemis]: { name: 'IPID remis' },
  [DEAL_FIELDS.declarationAdequation]: { name: "Déclaration d'adéquation" },
  [DEAL_FIELDS.lettreMission]: { name: 'Lettre de mission signée' },
};

// Identifiants des pipelines du cabinet (valeurs par défaut, remplacées par l'API)
export const PIPELINE_KINDS = {
  commercial: 'Commerciale',
  impayes: 'Alertes impayés',
  portefeuille: 'Portefeuille',
  sinistres: 'Sinistres',
};

export function classifyPipeline(name = '') {
  const n = name.toLowerCase();
  if (n.includes('impay')) return 'impayes';
  if (n.includes('portefeuille') || n.includes('échéance') || n.includes('echeance')) return 'portefeuille';
  if (n.includes('sinistre')) return 'sinistres';
  return 'commercial';
}
