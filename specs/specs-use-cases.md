# Spécifications - Application d'exploitation Inbox/Outbox

## 1. Contexte et Objectifs

### Contexte
L'entreprise dispose d'un Système d'Information distribué avec de nombreuses applications communiquant via :
- API REST (contrats OpenAPI)
- Messages asynchrones (RabbitMQ)

Chaque application utilise le pattern inbox/outbox pour garantir la fiabilité des échanges asynchrones :
- **Inbox** : Messages entrants à traiter
- **Outbox** : Messages sortants à envoyer

SEMA est déployé **au sein de chaque domaine applicatif**, au plus près de la base de données de l'application. Chaque instance accède directement à **une seule datasource** : la base de l'application du domaine.

### Objectifs
Développer un outil d'exploitation du domaine permettant de **visualiser à la demande** l'état des messages dans les tables inbox/outbox de l'application, notamment :
- Nombre de messages par statut (A_TRAITER, EN_TRAITEMENT, TRAITE, EN_ERREUR, etc.)
- Consultation détaillée des messages en erreur
- Rejeu manuel des messages (unitaire ou par lot)

**Note importante** : Il ne s'agit PAS d'un monitoring temps réel continu mais d'un outil de consultation et d'administration à la demande.

---

## 2. Périmètre Fonctionnel

### 2.1 Visualisation des Données

#### Résumé inbox/outbox
- Cards KPI affichées dès l'arrivée sur la page
- Compteurs par statut (A_TRAITER, EN_TRAITEMENT, TRAITE, EN_ERREUR) pour chaque direction active
- Clic sur un compteur → ouvre la liste avec le filtre correspondant pré-sélectionné
- Rafraîchissement automatique indépendant de l'état de la liste

#### Liste des messages (dépliable)
- Consultation de la liste des messages de l'application
- Filtrage par direction (inbox / outbox), statut, type de message
- Affichage des **métadonnées uniquement** :
  - Identifiant (`DEO_IDENTIFIANT` / `DEI_TYPE_IDENTIFIANT`)
  - User (`DEO_UTILISATEUR` / `DEI_UTILISATEUR`)
  - Timestamp (`DEO_DATE_INSERTION` / `DEI_DATE_RECEPTION`)
  - Type de message (`DEO_TYPE_MESSAGE` / `DEI_TYPE_MESSAGE`)
  - Statut (`DEO_STATUS` / `DEI_STATUS`)
  - Compteur de rejeux manuels (`nbRejeux`)
- Pagination (50-100 lignes par page)
- Tri par timestamp (plus récents en premier)

#### Détail d'un message (Niveau 2)
- Ouverture modal/drawer au clic sur une ligne
- Affichage de toutes les métadonnées du message
- **V1** : Pas de message d'erreur détaillé (colonne absente en base)

### 2.2 Fonctionnalités d'Administration

#### Rejeu de messages
- **Rejeu unitaire** : Bouton sur le détail d'un message
- **Rejeu par lot** : Sélection multiple via checkboxes dans le tableau (limité à la page affichée)
- **Rejeu par filtre** : Bouton "Rejouer tous les résultats (N)" visible dès qu'au moins un filtre est actif (statut et/ou type de message) et que le total est > 0 — rejoue l'intégralité des messages correspondants, indépendamment de la pagination

> Le rejeu par filtre est particulièrement utile lorsque le volume de messages en erreur dépasse la taille d'une page. Le backend applique les critères comme un `UPDATE ... WHERE`, sans nécessiter de connaître les IDs individuels.

#### Mécanisme de rejeu
Le rejeu consiste simplement à :
1. Effectuer un UPDATE SQL : `SET DEO_STATUS = 'A_TRAITER'` (outbox) / `SET DEI_STATUS = 'A_TRAITER'` (inbox)
2. Le scheduler applicatif existant retraite automatiquement ces messages

**Pas de publication directe dans RabbitMQ** : on s'appuie sur les mécanismes existants.

#### Gestion des droits
- **V1** : Aucune authentification — application accessible librement (réseau interne)
- Gestion des rôles (visualisation vs administration) : reportée en phase ultérieure

#### Traçabilité
- **V1** : Logs applicatifs uniquement (qui a déclenché le rejeu et sur quel message)
- Compteur de rejeux en base : reporté en phase ultérieure

### 2.3 Rafraîchissement des données

#### Approche retenue (phase 1)
- **Pas de polling continu** quand personne ne consulte
- Rafraîchissement automatique (polling 5-10s) uniquement si :
  - La page est ouverte dans le navigateur
  - L'utilisateur n'a pas mis en pause le refresh
- Indicateur visuel : badge "Auto-refresh actif" avec possibilité de pause

#### Évolution possible (phase 2)
- Migration vers WebSocket/STOMP pour notifications temps réel
- Publication des changements de statut via `/topic/inbox-outbox`
- Mise à jour automatique du dashboard sans polling

---

## 3. Architecture Technique

### 3.1 Stack Technique

#### Backend
- **Framework** : Spring Boot
- **Langage** : Java
- **API** : REST (exposition via OpenAPI)
- **Accès données** : Spring Data / Hibernate (connexion JDBC directe)
- **Pool de connexions** : HikariCP

#### Frontend
- **Framework** : Vue.js 3
- **Composants** : Vuetify
- **Communication** : Fetch API

#### Déploiement
- **Platform** : OpenShift
- **Containerisation** : Docker
- **Configuration** : ConfigMap / Secrets Kubernetes

### 3.2 Configuration de la Datasource

SEMA se connecte à **une seule datasource** : la base de l'application du domaine dans lequel il est déployé.

```yaml
# ConfigMap SEMA (par déploiement domaine)
sema:
  datasource:
    jdbc-url: "jdbc:oracle:thin:@host:1521:sid"
    username: "${DB_USER}"
    password: "${DB_PASSWORD}"
    role: "both"   # both | producer | consumer
```

Le champ `role` indique quelles tables sont présentes :
- `both` (défaut) : tables inbox **et** outbox présentes
- `producer` : table outbox uniquement (pas d'inbox)
- `consumer` : table inbox uniquement (pas d'outbox)

Credentials stockés dans Secrets Kubernetes/OpenShift.

### 3.3 Architecture API REST

#### Endpoints principaux

**Résumé inbox/outbox**
- `GET /api/summary`
- Retourne les compteurs par statut pour inbox et/ou outbox selon le `role`
- Appelé au montage de la page et à chaque auto-refresh

**Types de messages disponibles**
- `GET /api/message-types`

**Liste des messages**
- `GET /api/messages?direction={direction}&statuses={status}&types={type}&page={n}&pageSize={n}`
- Retourne les métadonnées paginées

**Détail d'un message**
- `GET /api/messages/{messageId}`

**Rejeu de messages**
- `POST /api/messages/{messageId}/replay` (unitaire)
- `POST /api/messages/replay` avec body `{ ids: [...] }` (par lot)
- `POST /api/messages/replay-by-filter` avec body `{ direction?, statuses?, types? }` (par filtre)

### 3.4 Stratégie de Requêtage

#### Vue d'ensemble
- Requête SQL directe sur la datasource du domaine
- Temps de réponse attendu : <1s
- Timeout de requête : 5s

#### Liste détaillée
- Requête avec filtres et pagination
- Index requis sur colonnes : status, timestamp

#### Rejeu
- UPDATE SQL exécuté directement sur la base du domaine
- Réponse synchrone après exécution des UPDATE

### 3.5 Gestion des Erreurs

#### Base de données inaccessible
- Retourner une erreur HTTP 503 avec message explicite
- Afficher un message d'erreur dans le frontend

#### Timeout
- Timeout de requête configuré à 5s

#### Erreurs de rejeu
- Retourner un code HTTP approprié (4xx/5xx)
- Message d'erreur explicite côté frontend

---

## 4. Cas d'Usage Détaillés

### CU1 : Consulter l'état de l'application

**Acteur** : Opérateur, Administrateur

**Préconditions** : Aucune (pas d'authentification en V1)

**Scénario nominal** :
1. L'utilisateur accède à l'application
2. Le système affiche les cards de résumé inbox/outbox avec les compteurs par statut
3. La liste des messages est repliée par défaut
4. Les compteurs se rafraîchissent automatiquement toutes les 10s

**Scénario alternatif** :
- La base de données est inaccessible → afficher un message d'erreur explicite

### CU2 : Consulter les messages en erreur

**Acteur** : Opérateur, Administrateur

**Préconditions** : Liste des messages affichée

**Scénario nominal** :
1. L'utilisateur sélectionne le filtre statut `EN_ERREUR`
2. La liste se met à jour et n'affiche que les messages en erreur
3. Pour chaque message : identifiant, user, timestamp, type, statut, nb rejeux
4. L'utilisateur peut affiner les filtres, paginer

### CU3 : Consulter le détail d'un message

**Acteur** : Opérateur, Administrateur

**Préconditions** : Liste de messages affichée

**Scénario nominal** :
1. L'utilisateur clique sur une ligne du tableau
2. Ouverture d'un modal/drawer
3. Affichage de toutes les métadonnées du message
4. **V1** : Pas de message d'erreur détaillé (colonne absente en base)

### CU4 : Rejouer un message en erreur

**Acteur** : Administrateur

**Préconditions** : Utilisateur avec droits admin, message en erreur sélectionné

**Scénario nominal** :
1. L'utilisateur clique sur "Rejouer" dans le détail du message
2. Confirmation demandée
3. Le système exécute : `UPDATE ... SET DEO_STATUS='A_TRAITER'` (outbox) / `SET DEI_STATUS='A_TRAITER'` (inbox)
4. Message de succès affiché
5. Le tableau se rafraîchit et le message disparaît de la liste EN_ERREUR
6. Le scheduler applicatif retraite automatiquement le message

**Scénario alternatif** :
- Le message a déjà été rejoué entre-temps → erreur de concurrence

### CU5 : Rejouer plusieurs messages en lot (sélection manuelle)

**Acteur** : Administrateur

**Préconditions** : Utilisateur avec droits admin, liste de messages affichée

**Scénario nominal** :
1. L'utilisateur sélectionne N messages via checkboxes (sur la page courante)
2. L'utilisateur clique sur "Rejouer la sélection (N)"
3. Confirmation avec nombre de messages
4. Le système effectue les UPDATE en batch via `POST .../messages/replay` avec la liste d'IDs
5. Retour immédiat (200 OK)
6. Le tableau se rafraîchit

**Limite** : La sélection est restreinte aux messages de la page affichée. Pour rejouer un volume supérieur à la taille de page, utiliser CU6.

### CU6 : Rejouer tous les messages correspondant aux filtres actifs

**Acteur** : Administrateur

**Préconditions** : Utilisateur avec droits admin, au moins un filtre actif (statut et/ou type de message), total > 0

**Scénario nominal** :
1. L'utilisateur filtre par type (ex. `INVOICE_RECEIVED`) et/ou statut (ex. `EN_ERREUR`)
2. Le système affiche le total correspondant (ex. 345 messages)
3. Le bouton "Rejouer tous les résultats (345)" apparaît
4. L'utilisateur clique sur ce bouton
5. Un dialog de confirmation récapitule les filtres appliqués et le volume concerné, et avertit que l'action dépasse la page affichée
6. L'utilisateur confirme
7. Le système appelle `POST .../messages/replay-by-filter` avec `{ direction?, statuses, types }` — le backend applique les filtres et effectue les UPDATE sans limite de pagination
8. Le tableau se rafraîchit depuis la page 1

**Scénario alternatif** :
- Le volume est très élevé (milliers de messages) → le backend traite en une seule transaction ou en batch interne, le frontend attend le retour 200 OK

---

## 5. Problématiques et Solutions

### 5.1 Sécurité

**Problématique** : Accès à la base de données sans exposer les credentials

**Solutions** :
- Secrets Kubernetes/OpenShift
- Éventuellement HashiCorp Vault pour rotation automatique
- Pas de credentials dans le code ou logs

### 5.2 Expérience Utilisateur

**Problématique** : Fluidité de navigation lors du rejeu de messages

**Solutions** :
- Mise à jour optimiste de l'interface après rejeu unitaire
- Loader visible lors des appels (rejeu par filtre sur gros volumes)
- Rafraîchissement auto intelligent (pause possible)
- Évolution possible : WebSocket pour temps réel

### 5.3 Concurrence sur les rejeux

**Problématique** : Deux utilisateurs rejouent le même message

**Solutions** :
- Vérification du statut avant UPDATE
- Gestion optimiste des conflits
- Message d'erreur explicite si déjà traité

---

## 6. Choix Technologiques et Justifications

### 6.1 Polling vs WebSocket (Phase 1)

**Choix retenu** : Polling avec auto-refresh

**Justifications** :
- Implémentation immédiate plus simple
- Suffisant pour les besoins actuels
- Migration vers WebSocket possible sans refonte majeure
- Charge serveur acceptable (refresh ciblé)

**Évolution prévue** : WebSocket en phase 2 si nécessaire

### 6.2 Affichage Metadata vs Payload

**Choix retenu** : Métadonnées uniquement

**Justifications** :
- Métadonnées suffisantes pour diagnostiquer 90% des erreurs
- Évite problèmes de volumétrie et performance
- Interface plus claire et utilisable
- Payload consultable ultérieurement si vraiment nécessaire

---

## 7. Points d'Attention et Risques

### 7.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Base de données inaccessible | Faible | Élevé | Message d'erreur explicite, retry possible |
| Tables inbox/outbox non indexées | Moyenne | Élevé | Vérifier index avant déploiement |
| Timeout sur gros volumes de rejeu | Faible | Moyen | UPDATE batch interne, timeout configurable |

### 7.2 Risques Fonctionnels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Rejeu multiple du même message | Moyenne | Moyen | Vérification statut + compteur rejeux |
| Absence de droits d'administration | Faible | Élevé | Implémenter gestion des rôles en phase 2 |
| Volumétrie excessive de messages | Moyenne | Moyen | Pagination + filtres + archivage des anciennes données |

### 7.3 Dépendances

- Accès en lecture/écriture à la base de données du domaine (credentials à obtenir)
- Structure des tables inbox/outbox validée (homogène avec le reste du SI)
- Coordination avec l'équipe propriétaire du scheduler applicatif
- Infrastructure OpenShift prête (namespace, ressources)

---

## 8. Plan de Déploiement et Phases

### Phase 1 : MVP (1-2 sprints)
- Cards résumé inbox/outbox (page d'accueil)
- Liste des messages dépliable avec filtres direction, statut, type de message
- Détail d'un message
- Rejeu unitaire (CU4)
- Rafraîchissement automatique (polling)

### Phase 2 : Administration complète (2 sprints)
- Rejeu par lot — sélection multiple (CU5)
- Rejeu par filtre — tous les messages correspondants en une action (CU6)
- Gestion des droits (visualisation vs administration)
- Traçabilité des rejeux (compteur en base)

### Phase 3 : Optimisations (1 sprint)
- Migration vers WebSocket pour temps réel
- Cache léger (Redis) si nécessaire
- Métriques et monitoring de l'application elle-même

### Phase 4 : Évolutions (optionnel)
- Vue cross-domaines (agrégation de plusieurs instances SEMA — architecture à définir)
- Affichage du payload sur demande
- Export CSV des messages
- Statistiques et graphiques (évolution dans le temps)
- Archivage automatique des anciens messages

---

## 9. Indicateurs de Succès

- Temps de réponse vue d'ensemble < 1s dans 99% des cas
- Temps de réponse liste des messages < 2s dans 95% des cas
- Disponibilité > 99% (hors indisponibilité de la base source)
- Aucun impact sur les performances de l'application métier
- Adoption par les équipes d'exploitation (> 5 utilisateurs réguliers)
- Réduction du temps de diagnostic des erreurs de 50%

---

## 10. Documentation et Formation

### Documentation à produire
- Guide d'utilisation pour opérateurs
- Guide d'administration (rejeux)
- Documentation technique (architecture, APIs)
- Runbook pour l'équipe de production

### Formation
- Session de présentation pour les équipes d'exploitation
- Tutoriel vidéo pour les cas d'usage courants
- Documentation des bonnes pratiques de rejeu
