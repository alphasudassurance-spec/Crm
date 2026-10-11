# ⚔️ Alpha Sud Arena — CRM gamifié connecté à Pipedrive

CRM de gestion d'entreprise **gamifié** pour le cabinet de courtage en assurance
Alpha Sud Assurance. L'application se branche sur votre compte Pipedrive (lecture
et écriture) et transforme le quotidien du courtier en jeu : XP, niveaux, badges,
missions du jour, séries et classement d'équipe.

Tout ce que vous faites dans l'Arena est écrit dans Pipedrive, et tout ce que vous
faites dans Pipedrive (depuis l'application mobile, par exemple) rapporte aussi des
XP à la synchronisation suivante.

## Fonctionnalités

| Écran | Contenu |
| --- | --- |
| 🏢 **Cabinet** (écran d'accueil) | **Cabinet virtuel en vue isométrique 3D**, blanc et rouge : chaque pipeline Pipedrive est une zone du bâtiment (accueil & salle d'attente, plateau conseillers, salle de signature, cellule recouvrement, archives à rayonnages, atelier sinistres, parking des contrats signés), chaque étape un emplacement, chaque affaire un objet (prospect dans la salle d'attente, dossier sur un bureau, boîte de contrat sur une étagère colorée selon l'échéance, véhicule à l'atelier). On **glisse un dossier d'une étape à l'autre** (écrit dans Pipedrive), on clique pour afficher la **frise de suivi** du dossier en bas, double-clic pour la fiche. Recherche globale, indicateurs flottants (dossiers à jour, primes signées ce mois vs objectif, progression XP), panneau d'occupation au survol d'une zone, zoom et panoramique. Les affaires en sommeil portent un marqueur rouge « ! ». |
| 🏠 **QG** | Avatar, niveau, barre d'XP, série de jours actifs, missions du jour (+30 XP) et mission hebdo (+150 XP), KPI (pipeline pondéré, gagné ce mois, taux de conversion, affaires en sommeil, impayés, échéances < 90 j, agenda), classement de la semaine, badges, flux d'activité. |
| 🧭 **Pipeline** | Kanban **drag & drop** pour vos 4 pipelines Pipedrive (Commerciale, Alertes impayés, Portefeuille & échéances, Sinistres). Cartes avec type de garantie, assureur, prime, prochaine activité ; affaires « pourries » signalées 🧟. Création d'affaire (+ client / entreprise). |
| 📅 **Agenda** | Activités en retard / du jour / à venir. Cocher = terminé dans Pipedrive (+10 à +25 XP). Création d'activité. |
| 📂 **Portefeuille** | Contrats actifs triables (garantie, assureur, n° de contrat, prime annuelle, échéance J-xx), alertes impayés avec montants, sinistres en cours. |
| 🏆 **Trophées** | 20 badges, statistiques de courtier, barème d'XP et niveaux. |
| 💼 **Fiche affaire** | Tiroir latéral : étapes cliquables, bouton Gagnée / Perdue (avec motif) / Rouvrir, champs contrat & garanties, contact (tél, e-mail), activités liées, notes (+5 XP), lien vers Pipedrive. |

Chaque XP gagné affiche une notification, chaque affaire gagnée déclenche des
confettis, chaque passage de niveau ouvre une célébration.

## Barème d'expérience

| Action (détectée via Pipedrive) | XP |
| --- | --- |
| Nouvelle affaire créée | +20 |
| Affaire avancée d'une étape (pipeline commercial) | +15 |
| Affaire gagnée | +100 (+ bonus jusqu'à 200 selon la prime) |
| Affaire perdue clôturée proprement | +5 |
| Appel terminé / rendez-vous réalisé / autre activité | +15 / +25 / +10 |
| Note ajoutée | +5 |
| Dossier impayé qui avance / impayé régularisé (affaire gagnée dans le pipeline impayés) | +20 / +60 |
| Sinistre qui avance / sinistre clôturé | +15 / +40 |
| Contrat reconduit (étape « Reconduit » ou affaire gagnée dans le pipeline Portefeuille) | +50 |
| Mission du jour / mission hebdo | +30 / +150 |

Niveaux : le niveau *n* est atteint à `100 × (n−1)²` XP (100, 400, 900, 1 600…),
de « Stagiaire » à « Légende du cabinet ». Reculer une affaire ne rapporte rien ;
le premier lancement ne récompense pas le passé (il construit l'instantané de
référence).

## Installation

Prérequis : Node.js ≥ 20.

```bash
npm install
cp .env.example .env     # puis renseigner PIPEDRIVE_API_TOKEN
npm start                # http://localhost:3000
```

Variables d'environnement (`.env`) :

| Variable | Rôle |
| --- | --- |
| `PIPEDRIVE_API_TOKEN` | Jeton API personnel : Pipedrive → Paramètres personnels → API. |
| `PIPEDRIVE_COMPANY_DOMAIN` | Sous-domaine du compte (`alphasudassurance` pour `https://alphasudassurance.pipedrive.com`). |
| `PORT` | Port HTTP (3000 par défaut). |
| `SYNC_INTERVAL` | Intervalle de synchronisation en secondes (60 par défaut, min 30). |
| `DEMO_MODE` | `1` pour lancer avec des données fictives, sans Pipedrive. |
| `DATA_DIR` | Dossier de persistance de la gamification (`./data` par défaut). |
| `MONTHLY_TARGET` | Objectif mensuel de primes signées affiché dans le cabinet virtuel (10 000 € par défaut). |

### Mode démo

```bash
npm run demo
```

Reproduit la structure réelle du compte (pipelines, étapes, champs personnalisés)
avec des dossiers fictifs : tout est interactif, rien n'est écrit dans Pipedrive.

### Docker

```bash
docker build -t alpha-sud-arena .
docker run -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data alpha-sud-arena
```

## Architecture

```
server/
  index.js         API Express + synchronisation périodique + fichiers statiques
  pipedrive.js     Client Pipedrive (API v2 : deals, stages, pipelines, persons,
                   organizations, activities ; v1 : notes, users, dealFields)
  mock.js          Client de démonstration (mêmes méthodes, données en mémoire)
  gamification.js  Moteur : diff d'instantanés → XP, niveaux, badges, missions,
                   séries, classement ; persistance JSON dans data/
  fields.js        Clés des champs personnalisés du cabinet
public/
  index.html, css/style.css (thème clair blanc/rouge)
  js/app.js (vues QG, pipeline, agenda, portefeuille, trophées, fiche affaire)
  js/cabinet.js (cabinet virtuel isométrique en SVG : scène, dépôt, recherche, frise)
  js/api.js, js/confetti.js, js/util.js
test/
  gamification.test.js   `npm test`
```

Principe : le serveur relit Pipedrive à intervalle régulier et après chaque
action faite dans l'Arena, compare avec l'instantané précédent (étape, statut,
activités terminées) et attribue les XP au propriétaire de l'affaire ou de
l'activité. Les XP sont donc attribués même pour les actions faites directement
dans Pipedrive. L'état de gamification est stocké dans `data/<live|demo>/gamification.json`
(hors Git).

### API interne

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/bootstrap` | Utilisateur, pipelines, étapes, champs, barème, badges |
| GET | `/api/state` | Affaires, activités, contacts, profil gamifié, événements à afficher |
| POST | `/api/sync` | Force une synchronisation |
| PATCH | `/api/deals/:id` | Étape, statut (`won`/`lost`/`open`), motif de perte, valeur… |
| POST | `/api/deals` | Nouvelle affaire (création du contact / de l'entreprise si besoin) |
| PATCH | `/api/activities/:id` | Terminer / rouvrir, modifier |
| POST | `/api/activities` | Nouvelle activité |
| GET / POST | `/api/deals/:id/notes` | Notes de l'affaire |

## Champs Pipedrive exploités

Assureur (porteur du risque), Type de garantie, Prime annuelle TTC,
Fractionnement, N° de contrat, Date d'effet, Date d'échéance, Courtier grossiste,
Montant impayé, Date / source du signalement, Date d'échéance de prime,
Recueil des besoins, IPID remis, Déclaration d'adéquation, Lettre de mission signée.
Les libellés et options sont rechargés depuis l'API (`/v1/dealFields`) ; les clés
par défaut sont dans `server/fields.js`.
