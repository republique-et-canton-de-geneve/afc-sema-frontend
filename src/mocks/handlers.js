import { http, HttpResponse } from 'msw'
import {
  getSummary,
  getMessageTypes,
  getMessages,
  getMessage,
  replayMessage,
  replayMessages,
  replayByFilter,
} from './data.js'

const BASE = '/api'

// Petit délai simulant la latence réseau
const delay = (min = 100, max = 400) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)))

export const handlers = [

  // ── GET /api/summary ──────────────────────────────────────────────────────
  http.get(`${BASE}/summary`, async () => {
    await delay()
    return HttpResponse.json(getSummary())
  }),

  // ── GET /api/message-types ────────────────────────────────────────────────
  http.get(`${BASE}/message-types`, async () => {
    await delay(50, 150)
    return HttpResponse.json(getMessageTypes())
  }),

  // ── GET /api/messages ─────────────────────────────────────────────────────
  http.get(`${BASE}/messages`, async ({ request }) => {
    await delay()
    const url       = new URL(request.url)
    const statuses  = url.searchParams.getAll('statuses')
    const direction = url.searchParams.get('direction')
    const types     = url.searchParams.getAll('types')
    const page      = parseInt(url.searchParams.get('page')     ?? '1',  10)
    const pageSize  = parseInt(url.searchParams.get('pageSize') ?? '50', 10)

    return HttpResponse.json(getMessages({ statuses, direction, types, page, pageSize }))
  }),

  // ── GET /api/messages/:id ─────────────────────────────────────────────────
  http.get(`${BASE}/messages/:id`, async ({ params }) => {
    await delay()
    const msg = getMessage(params.id)
    if (!msg) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(msg)
  }),

  // ── POST /api/messages/replay-by-filter ───────────────────────────────────
  // Déclaré AVANT le handler /:id/replay pour éviter que ":id" matche "replay-by-filter"
  http.post(`${BASE}/messages/replay-by-filter`, async ({ request }) => {
    await delay(300, 800)
    const body    = await request.json()
    const updated = replayByFilter({
      direction: body.direction,
      statuses:  body.statuses,
      types:     body.types,
    })
    return HttpResponse.json({ replayed: updated.length, messages: updated })
  }),

  // ── POST /api/messages/replay ─────────────────────────────────────────────
  http.post(`${BASE}/messages/replay`, async ({ request }) => {
    await delay(200, 600)
    const body    = await request.json()
    const ids     = body?.ids ?? []
    const updated = replayMessages(ids)
    return HttpResponse.json({ replayed: updated.length, messages: updated })
  }),

  // ── POST /api/messages/:id/replay ─────────────────────────────────────────
  http.post(`${BASE}/messages/:id/replay`, async ({ params }) => {
    await delay()
    const updated = replayMessage(params.id)
    if (!updated) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(updated)
  }),

]
