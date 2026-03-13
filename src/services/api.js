// Toutes les fonctions qui touchent le réseau sont ici.
// Quand le vrai backend arrive, seuls ces fichiers changent.

const BASE = '/api'

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  return res.json()
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  return res.json()
}

// ── Summary ───────────────────────────────────────────────────────────────────
// Retourne { role, inbox: StatusCounts | null, outbox: StatusCounts | null }
export function fetchSummary() {
  return fetchJSON(`${BASE}/summary`)
}

// ── Types de messages ─────────────────────────────────────────────────────────
// Retourne { role, types: string[] }
export function fetchMessageTypes() {
  return fetchJSON(`${BASE}/message-types`)
}

// ── Messages ──────────────────────────────────────────────────────────────────
export function fetchMessages({ statuses = [], direction, types = [], page = 0, pageSize = 50 } = {}) {
  const params = new URLSearchParams()
  for (const s of (statuses ?? [])) params.append('statuses', s)
  if (direction)                     params.set('direction', direction)
  for (const t of (types ?? []))     params.append('types', t)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return fetchJSON(`${BASE}/messages?${params}`)
}

export function fetchMessage(id) {
  return fetchJSON(`${BASE}/messages/${id}`)
}

// ── Replay ────────────────────────────────────────────────────────────────────
export function replaySingle(id) {
  return postJSON(`${BASE}/messages/${id}/replay`)
}

export function replayBatch(ids) {
  return postJSON(`${BASE}/messages/replay`, { ids })
}

export function replayByFilter({ direction, statuses, types } = {}) {
  return postJSON(
    `${BASE}/messages/replay-by-filter`,
    {
      direction:  direction  ?? null,
      statuses:   statuses?.length  ? statuses  : null,
      types:      types?.length     ? types     : null,
    },
  )
}
