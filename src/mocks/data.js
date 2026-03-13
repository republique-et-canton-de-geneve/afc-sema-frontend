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

// ─── Générateur de messages ───────────────────────────────────────────────────
let msgId = 1

function makeMessage(direction, status, forceType = null) {
  const id       = `MSG-${String(msgId++).padStart(5, '0')}`
  const typePool = direction === 'INBOX' ? INBOX_TYPES : OUTBOX_TYPES
  const type     = forceType ?? typePool[Math.floor(Math.random() * typePool.length)]
  const user     = USERS[Math.floor(Math.random() * USERS.length)]

  const maxAge = status === 'EN_ERREUR' ? 2 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000
  const ts     = new Date(Date.now() - Math.floor(Math.random() * maxAge)).toISOString()

  const base = {
    id,
    direction,
    type,
    statut: status,
    utilisateur: user,
    timestamp: ts,
    nbRejeux: status === 'EN_ERREUR' ? Math.floor(Math.random() * 5) : 0,
  }

  if (direction === 'OUTBOX') {
    base.nbTentativesEnvoi = Math.floor(Math.random() * 4)
    base.datePublication   = status === 'TRAITE' ? new Date(Date.now() - Math.random() * 3600000).toISOString() : null
  }

  return base
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

export function getMessages({ statuses = [], direction, types = [], page = 0, pageSize = 50 } = {}) {
  let messages = [...db]
  if (statuses?.length) messages = messages.filter(m => statuses.includes(m.statut))
  if (direction)        messages = messages.filter(m => m.direction === direction)
  if (types?.length)    messages = messages.filter(m => types.includes(m.type))

  const total = messages.length
  const start = page * pageSize
  const items = messages.slice(start, start + pageSize)
  return { items, total, page, pageSize }
}

export function getMessage(id) {
  return db.find(m => m.id === id) ?? null
}

export function replayMessage(id) {
  const msg = getMessage(id)
  if (!msg) return null
  msg.statut   = 'A_TRAITER'
  msg.nbRejeux = (msg.nbRejeux ?? 0) + 1
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
