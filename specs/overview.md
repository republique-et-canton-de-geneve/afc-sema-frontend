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
