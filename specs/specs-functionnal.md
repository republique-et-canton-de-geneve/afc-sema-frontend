# Spécifications - Application d'exploitation Inbox/Outbox

## Périmètre Fonctionnel

### 1 Visualisation des Données

#### Résumé inbox/outbox (affiché en permanence)
- La page d'accueil affiche d'emblée les compteurs par statut pour l'inbox et/ou l'outbox de l'application
  - Section inbox absente si `role = producer`, section outbox absente si `role = consumer`
- Présentation sous forme de cards KPI : pour chaque direction une card, chaque statut y est lisible avec son compteur
- **Clic sur un compteur** → déploie automatiquement la liste des messages avec le filtre correspondant pré-sélectionné
- Rafraîchissement automatique (polling) actif en permanence, liste ou non dépliée

#### Liste des messages (Niveau 1, dépliable)
- Consultation de la liste des messages de l'application
- Filtrage par direction (inbox / outbox), statut (focus sur les messages EN_ERREUR), type de message
- Affichage des **métadonnées uniquement** :
  - Identifiant (`DEO_IDENTIFIANT` / `DEI_TYPE_IDENTIFIANT`)
  - User (`DEO_UTILISATEUR` / `DEI_UTILISATEUR`)
  - Timestamp (`DEO_DATE_INSERTION` / `DEI_DATE_RECEPTION`)
  - Type de message (`DEO_TYPE_MESSAGE` / `DEI_TYPE_MESSAGE`)
  - Direction (`inbox` / `outbox`)
  - Statut (`DEO_STATUS` / `DEI_STATUS`)
  - Compteur de rejeux manuels (`nbRejeux`)
- **Colonnes configurables** : un sélecteur (icône tableau) permet d'afficher ou masquer chaque colonne individuellement — la sélection est persistée dans le `localStorage` du navigateur
- Pagination (50-100 lignes par page)
- Tri par timestamp (plus récents en premier)

#### Détail d'un message (Niveau 2)
- Ouverture modal/drawer au clic sur une ligne
- Affichage de toutes les métadonnées du message
- **Message d'erreur non affiché en V1** (colonne absente des tables — prévu en phase ultérieure)
- **Le payload n'est pas affiché** (seulement les métadonnées)

### 2 Fonctionnalités d'Administration

#### Rejeu de messages
- **Rejeu unitaire** : Bouton sur le détail d'un message
- **Rejeu par lot** : Sélection multiple via checkboxes dans le tableau (limité à la page affichée)
- **Rejeu par filtre** : Bouton "Rejouer tous les résultats (N)" visible dès qu'au moins un filtre est actif (statut et/ou type) et que le total est > 0 — rejoue l'intégralité des messages correspondants, indépendamment de la pagination

> Le rejeu par filtre est particulièrement utile lorsque le volume de messages en erreur dépasse la taille d'une page (ex. 345 messages `INVOICE_RECEIVED` en erreur). Le backend applique les mêmes critères de filtre qu'un `UPDATE ... WHERE`, sans nécessiter de connaître les IDs individuels.

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

### 3 Rafraîchissement des données

#### Approche retenue (phase 1)
- **Pas de polling continu** quand personne ne consulte
- Rafraîchissement automatique (polling 5-10s) uniquement si :
  - La page est ouverte dans le navigateur
  - L'utilisateur n'a pas mis en pause le refresh
- Indicateur visuel : badge "Auto-refresh actif" avec possibilité de pause

#### Évolution possible (phase 2)
- Migration vers WebSocket/STOMP pour notifications temps réel
- Publication des changements de statut via `/topic/inbox-outbox`
- Mise à jour automatique de la liste sans polling
