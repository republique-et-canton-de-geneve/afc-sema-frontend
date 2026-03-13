# Spécifications - Application d'exploitation Inbox/Outbox

## Architecture Technique

### 1 Stack Technique

#### Backend SEMA
- **Framework** : Spring Boot
- **Langage** : Java
- **API** : REST (exposition via OpenAPI)
- **Accès données** : Spring Data / Hibernate (connexion JDBC directe à la base du domaine)
- **Pool de connexions** : HikariCP

#### Frontend
- **Framework** : Vue.js 3
- **Composants** : Vuetify
- **Communication** : Fetch API

#### Déploiement
- **Platform** : OpenShift
- **Containerisation** : Docker
- **Configuration** : ConfigMap / Secrets Kubernetes

---

### 2 Schéma des Tables

Les tables inbox et outbox ont une structure fixe. SEMA y accède directement via JDBC. Les noms de tables sont fixes et identiques sur toutes les bases du SI.

#### Table Outbox

```sql
CREATE TABLE EVT_T_DOMAIN_EVENT_OUTBOX
(
    DEO_ID                 INTEGER           NOT NULL,
    DEO_IDENTIFIANT        VARCHAR2(36)      NOT NULL UNIQUE,
    DEO_TYPE_MESSAGE       VARCHAR2(100)     NOT NULL,
    DEO_PAYLOAD            CLOB              NOT NULL,
    DEO_DATE_INSERTION     TIMESTAMP         NOT NULL,
    DEO_DATE_PUBLICATION   TIMESTAMP,
    DEO_UTILISATEUR        VARCHAR2(100)     NOT NULL,
    DEO_STATUS             VARCHAR2(40)      NOT NULL,
    DEO_NB_TENTATIVE_ENVOI INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT EVT_PK_DEO PRIMARY KEY (DEO_ID)
);
```

| Colonne | Description |
|---------|-------------|
| `DEO_ID` | Id technique (PK, alimenté via séquence) |
| `DEO_IDENTIFIANT` | Identifiant UUID du message (UNIQUE) |
| `DEO_TYPE_MESSAGE` | Type fonctionnel du message |
| `DEO_PAYLOAD` | Payload du message (**non affiché** dans l'application) |
| `DEO_DATE_INSERTION` | Date d'insertion dans la table |
| `DEO_DATE_PUBLICATION` | Date de publication dans RabbitMQ (nullable) |
| `DEO_UTILISATEUR` | Utilisateur à l'origine du message |
| `DEO_STATUS` | Statut : `A_TRAITER`, `EN_TRAITEMENT`, `TRAITE`, `EN_ERREUR` |
| `DEO_NB_TENTATIVE_ENVOI` | Nombre de tentatives d'envoi automatique |

#### Table Inbox

```sql
CREATE TABLE EVT_T_DOMAIN_EVENT_INBOX
(
    DEI_TYPE_IDENTIFIANT VARCHAR2(36)  NOT NULL,
    DEI_TYPE_MESSAGE     VARCHAR2(100) NOT NULL,
    DEI_PAYLOAD          CLOB          NOT NULL,
    DEI_DATE_RECEPTION   TIMESTAMP     NOT NULL,
    DEI_UTILISATEUR      VARCHAR2(100) NOT NULL,
    DEI_STATUS           VARCHAR2(40)  NOT NULL,
    CONSTRAINT INBOX_PK PRIMARY KEY (DEI_TYPE_IDENTIFIANT)
);
```

| Colonne | Description |
|---------|-------------|
| `DEI_TYPE_IDENTIFIANT` | Identifiant UUID du message (PK) |
| `DEI_TYPE_MESSAGE` | Type fonctionnel du message |
| `DEI_PAYLOAD` | Payload du message (**non affiché** dans l'application) |
| `DEI_DATE_RECEPTION` | Date de réception du message |
| `DEI_UTILISATEUR` | Utilisateur à l'origine du message |
| `DEI_STATUS` | Statut : `A_TRAITER`, `EN_TRAITEMENT`, `TRAITE`, `EN_ERREUR` |

> **Note V0** : Aucune colonne `message_erreur` dans les tables actuelles. Elle sera ajoutée en phase ultérieure via ALTER TABLE.

#### Colonnes absentes en V0 et comportement attendu

| Donnée | Comportement V0 |
|--------|-----------------|
| Message d'erreur | Non affiché |

---

### 3 Configuration de la Datasource

SEMA se connecte à **une seule datasource** : la base de l'application du domaine dans lequel il est déployé. La configuration est injectée via ConfigMap et Secrets Kubernetes.

#### Configuration

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
- `producer` : table outbox uniquement
- `consumer` : table inbox uniquement

#### Pool de connexions (HikariCP)
- Taille du pool : 2-5 connexions (lectures ponctuelles, pas de charge continue)
- Timeout de connexion : 5s
- Credentials stockés dans Secrets Kubernetes/OpenShift

---

### 4 Authentification

- **V0** : Aucune authentification — application accessible sur réseau interne
- Authentification SEMA (SSO/OIDC/Keycloak) : reportée en phase ultérieure

---

### 5 Architecture API REST (SEMA → Frontend)

Le backend SEMA accède directement à la datasource du domaine et expose une API REST au frontend.

#### Endpoints principaux

**Résumé inbox/outbox**
- `GET /api/summary`
- Retourne les compteurs par statut pour inbox et/ou outbox selon le `role` configuré
- Réponse :
  ```json
  {
    "role": "both",
    "inbox":  { "A_TRAITER": 3, "EN_TRAITEMENT": 1, "TRAITE": 120, "EN_ERREUR": 5 },
    "outbox": { "A_TRAITER": 0, "EN_TRAITEMENT": 0, "TRAITE": 98,  "EN_ERREUR": 2 }
  }
  ```
- `inbox` est `null` si `role=producer`, `outbox` est `null` si `role=consumer`

**Types de messages disponibles**
- `GET /api/message-types`
- Retourne les types de messages distincts présents dans les tables, avec le rôle configuré

**Liste des messages**
- `GET /api/messages`
- Paramètres : `direction` (`inbox`|`outbox`), `statuses` (multi-valeur), `types` (multi-valeur), `page`, `pageSize`
- Retourne les métadonnées paginées (pas le payload)

**Détail d'un message**
- `GET /api/messages/{messageId}`
- Retourne toutes les métadonnées (pas le payload)

**Rejeu unitaire**
- `POST /api/messages/{messageId}/replay`
- Effectue `UPDATE ... SET status = 'A_TRAITER' WHERE id = ?`

**Rejeu par lot**
- `POST /api/messages/replay`
- Body : `{ "ids": ["uuid1", "uuid2"] }`

**Rejeu par filtre**
- `POST /api/messages/replay-by-filter`
- Body : `{ "direction": "inbox", "statuses": ["EN_ERREUR"], "types": ["ORDER_CREATED"] }`
- Effectue un `UPDATE ... WHERE` sans limite de pagination

---

### 6 Stratégie de Requêtage

#### Résumé
- Requête SQL directe : `SELECT status, COUNT(*) FROM inbox_table GROUP BY status`
- Appelée au montage de page et à chaque auto-refresh
- Timeout de requête : 5s

#### Liste détaillée
- Requête avec filtres et pagination
- Index requis sur colonnes : status, timestamp

#### Rejeu
- UPDATE SQL exécuté directement sur la base du domaine
- Réponse synchrone : retourne 200 OK une fois les UPDATE effectués

---

### 7 Gestion des Erreurs

#### Base de données inaccessible
- Retourner une erreur HTTP 503 avec message explicite
- Afficher un message d'erreur dans le frontend

#### Timeout
- Timeout de requête configuré à 5s

#### Erreurs de rejeu
- Code HTTP approprié (4xx/5xx)
- Message d'erreur explicite côté frontend
