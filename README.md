# SEMA — Suivi et Exploitation des Messages Applicatifs

SEMA est un outil interne permettant aux équipes d'exploitation de surveiller et d'administrer les files de messages asynchrones (pattern inbox/outbox) réparties sur l'ensemble du SI.

Il offre une vue de l'état des messages reçus et envoyés dans un domaine applicatif (une base de données), et permet de relancer manuellement les messages en erreur sans intervention directe en base. 

## Fonctionnalités

- Tableau de bord des messages par application et par type, avec compteurs par statut (`A_TRAITER`, `EN_TRAITEMENT`, `TRAITE`, `EN_ERREUR`)
- Consultation de la liste des messages et de leurs métadonnées
- Rejeu unitaire, par sélection ou en masse sur filtre
- Rafraîchissement automatique (polling)

## Architecture

```
frontend/       Vue.js 3 + Vuetify
backend/        Java Spring — Récupère les données d'une base de données
```

## Prérequis

### Frontend
- Node.js >= 18
- npm ou yarn

### Backend
- Java 21+
- Maven ou Gradle
 Accès JDBC à la base de données de l'application cible (Oracle ou PostgreSQL)


### Déploiement
- OpenShift / Kubernetes

## Lancement en développement

```bash
# Frontend
npm install
npm run dev
```

## Documentation

Les spécifications fonctionnelles, techniques et les contrats OpenAPI sont dans le dossier [`specs/`](specs/).
