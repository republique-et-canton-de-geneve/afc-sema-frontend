// ─── Configuration du domaine ─────────────────────────────────────────────────
// En mock, on simule une instance SEMA déployée sur le domaine "Facturation".
// role 'both' : tables inbox ET outbox présentes
export const DOMAIN_ROLE = 'both'

// ─── Types de messages ────────────────────────────────────────────────────────
const INBOX_TYPES  = ['ORDER_CREATED', 'ORDER_CANCELLED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED']
const OUTBOX_TYPES = ['INVOICE_SENT', 'CREDIT_NOTE_ISSUED', 'REMINDER_SENT']

// ─── Distribution des statuts par direction ───────────────────────────────────
// Profil "crise" : vague d'erreurs en inbox sur ORDER_CREATED
const PROFILE = {
  inbox:  { A_TRAITER: 14, EN_TRAITEMENT: 6, TRAITE: 12, EN_ERREUR: 23 },
  outbox: { A_TRAITER: 4,  EN_TRAITEMENT: 2, TRAITE: 9,  EN_ERREUR: 11 },
  extras: [
    { direction: 'INBOX', status: 'EN_ERREUR', type: 'ORDER_CREATED', count: 345 },
  ],
}

const USERS = ['user.dupont', 'user.martin', 'user.bernard', 'user.leroy',
               'system', 'batch.job', 'api.gateway', 'scheduler']

// ─── Historique des traitements (table B) ─────────────────────────────────────
const WORKER_HOSTS = ['worker-01.internal', 'worker-02.internal', 'worker-03.internal']

const ERREUR_MESSAGES = {
  METIER: [
    'Client inconnu en base',
    'Montant négatif refusé',
    'Devise non supportée',
    "Commande déjà clôturée",
  ],
  TECHNIQUE: [
    'Timeout base de données',
    'Connexion au service de facturation perdue',
    'Erreur de sérialisation JSON',
    "File d'attente saturée",
  ],
  INATTENDUE: [
    'NullPointerException au niveau du mapper',
    'Erreur interne non catégorisée',
    "Dépassement de la pile d'exécution",
  ],
}
const ERREUR_CATEGORIES = Object.keys(ERREUR_MESSAGES)

let traitementId = 1

function randomIp() {
  return `10.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}`
}

function randomCorrelationId() {
  return `corr-${Math.random().toString(16).slice(2, 10)}`
}

// Construit une tentative de traitement (ligne de la table B), calée sur `startMs`.
function makeTraitement(numeroTentative, statut, startMs) {
  const dateCreation = startMs
  const dateDebut     = Math.min(dateCreation + 1000 + Math.random() * 4000,  Date.now())
  const dateFin       = Math.min(dateDebut     + 500  + Math.random() * 8000, Date.now())

  const traitement = {
    traitementId: traitementId++,
    numeroTentative,
    statut,
    dateCreation:     new Date(dateCreation).toISOString(),
    dateDebut:        new Date(dateDebut).toISOString(),
    dateFin:          new Date(dateFin).toISOString(),
    workerIp:         randomIp(),
    workerHostname:   WORKER_HOSTS[Math.floor(Math.random() * WORKER_HOSTS.length)],
    correlationId:    randomCorrelationId(),
    erreurCategorie:  null,
    erreurMessage:    null,
  }

  if (statut === 'ERREUR') {
    const categorie = ERREUR_CATEGORIES[Math.floor(Math.random() * ERREUR_CATEGORIES.length)]
    const messages  = ERREUR_MESSAGES[categorie]
    traitement.erreurCategorie = categorie
    traitement.erreurMessage   = messages[Math.floor(Math.random() * messages.length)]
  }

  return traitement
}

// Génère l'historique des tentatives cohérent avec le statut courant du message :
// - TRAITE        : 0 à 2 échecs puis un succès
// - EN_ERREUR     : 1 à 3 échecs (le dernier explique le statut courant)
// - A_TRAITER / EN_TRAITEMENT : 0 ou 1 échec antérieur, la tentative en cours
//   n'a pas encore de ligne tant qu'elle n'est pas terminée
function makeTraitements(status, messageTimestampIso) {
  let nbEchecsAvant
  let ajouteSucces = false

  switch (status) {
    case 'TRAITE':
      nbEchecsAvant  = Math.floor(Math.random() * 3)
      ajouteSucces   = true
      break
    case 'EN_ERREUR':
      nbEchecsAvant  = 1 + Math.floor(Math.random() * 3)
      break
    default: // A_TRAITER, EN_TRAITEMENT
      nbEchecsAvant  = Math.floor(Math.random() * 2)
  }

  const traitements = []
  let numero = 1
  let t = new Date(messageTimestampIso).getTime() + 2 * 60 * 1000 // première tentative peu après création

  for (let i = 0; i < nbEchecsAvant; i++) {
    traitements.push(makeTraitement(numero++, 'ERREUR', t))
    t += 12 * 60 * 1000
  }
  if (ajouteSucces) {
    traitements.push(makeTraitement(numero++, 'SUCCES', t))
  }

  return traitements
}

// ─── Générateur de messages ───────────────────────────────────────────────────
let msgId = 1

function makeMessage(direction, status, forceType = null) {
  const id       = `MSG-${String(msgId++).padStart(5, '0')}`
  const typePool = direction === 'INBOX' ? INBOX_TYPES : OUTBOX_TYPES
  const type     = forceType ?? typePool[Math.floor(Math.random() * typePool.length)]
  const user     = USERS[Math.floor(Math.random() * USERS.length)]

  const maxAge = status === 'EN_ERREUR' ? 2 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000
  const ts     = new Date(Date.now() - Math.floor(Math.random() * maxAge)).toISOString()

  return {
    id,
    direction,
    type,
    statut: status,
    utilisateur: user,
    timestamp: ts,
    traitements: makeTraitements(status, ts),
  }
}

// ─── Construction du jeu de données ──────────────────────────────────────────
function buildMessages() {
  const msgs = []

  for (const direction of ['inbox', 'outbox']) {
    const dist = PROFILE[direction]
    for (const [status, count] of Object.entries(dist)) {
      for (let i = 0; i < count; i++) {
        msgs.push(makeMessage(direction.toUpperCase(), status))
      }
    }
  }

  for (const extra of PROFILE.extras ?? []) {
    for (let i = 0; i < extra.count; i++) {
      msgs.push(makeMessage(extra.direction, extra.status, extra.type))
    }
  }

  return msgs.sort(() => Math.random() - 0.5)
}

// ─── Base de données en mémoire ───────────────────────────────────────────────
export const db = buildMessages()

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getSummary() {
  const zero = () => ({ A_TRAITER: 0, EN_TRAITEMENT: 0, TRAITE: 0, EN_ERREUR: 0 })
  const inbox  = zero()
  const outbox = zero()

  for (const m of db) {
    if (m.direction === 'INBOX')  inbox[m.statut]++
    if (m.direction === 'OUTBOX') outbox[m.statut]++
  }

  return {
    role:   DOMAIN_ROLE,
    inbox:  DOMAIN_ROLE === 'producer' ? null : inbox,
    outbox: DOMAIN_ROLE === 'consumer' ? null : outbox,
  }
}

export function getMessageTypes() {
  const types = [...new Set(db.map(m => m.type))].sort()
  return { role: DOMAIN_ROLE, types }
}

const SORTABLE_FIELDS = ['id', 'type', 'utilisateur', 'timestamp', 'statut']

export function getMessages({
  statuses = [], direction, types = [],
  page = 0, pageSize = 50,
  sortBy, sortDirection,
} = {}) {
  let messages = [...db]
  if (statuses?.length) messages = messages.filter(m => statuses.includes(m.statut))
  if (direction)        messages = messages.filter(m => m.direction === direction)
  if (types?.length)    messages = messages.filter(m => types.includes(m.type))

  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'timestamp'
  const dir   = sortDirection === 'asc' ? 1 : -1
  messages.sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av < bv) return -1 * dir
    if (av > bv) return  1 * dir
    return 0
  })

  const total = messages.length
  const start = page * pageSize
  // Liste = MessageSummary : ne comporte pas l'historique des traitements
  // (réservé au détail), qui n'est chargé qu'à l'ouverture d'un message.
  const items = messages.slice(start, start + pageSize).map(({ traitements, ...summary }) => summary)
  return { items, total, page, pageSize }
}

export function getMessage(id) {
  return db.find(m => m.id === id) ?? null
}

export function replayMessage(id) {
  const msg = getMessage(id)
  if (!msg) return null
  msg.statut = 'A_TRAITER'
  return msg
}

export function replayMessages(ids) {
  return ids.map(id => replayMessage(id)).filter(Boolean)
}

export function replayByFilter({ direction, statuses, types } = {}) {
  let messages = [...db]
  if (direction)       messages = messages.filter(m => m.direction === direction)
  if (statuses?.length) messages = messages.filter(m => statuses.includes(m.statut))
  if (types?.length)    messages = messages.filter(m => types.includes(m.type))
  return messages.map(m => replayMessage(m.id)).filter(Boolean)
}
