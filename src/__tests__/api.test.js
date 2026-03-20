import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchSummary,
  fetchMessageTypes,
  fetchMessages,
  fetchMessage,
  replaySingle,
  replayBatch,
  replayByFilter,
} from '../services/api.js'

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(body, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

// ── fetchSummary ─────────────────────────────────────────────────────────────

describe('fetchSummary', () => {
  it('returns parsed JSON on success', async () => {
    const data = { role: 'BOTH', inbox: {}, outbox: {} }
    mockFetch(data)
    const result = await fetchSummary()
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/summary')
  })

  it('throws on HTTP error', async () => {
    mockFetch({ error: 'Not Found' }, false, 404)
    await expect(fetchSummary()).rejects.toThrow('Not Found')
  })

  it('throws generic message when error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
    })
    await expect(fetchSummary()).rejects.toThrow('HTTP 500')
  })
})

// ── fetchMessageTypes ────────────────────────────────────────────────────────

describe('fetchMessageTypes', () => {
  it('calls correct endpoint', async () => {
    mockFetch({ role: 'PRODUCER', types: ['TypeA'] })
    await fetchMessageTypes()
    expect(fetch).toHaveBeenCalledWith('/api/message-types')
  })
})

// ── fetchMessages ────────────────────────────────────────────────────────────

describe('fetchMessages', () => {
  it('builds query string with defaults', async () => {
    mockFetch({ content: [] })
    await fetchMessages()
    const url = fetch.mock.calls[0][0]
    expect(url).toContain('page=0')
    expect(url).toContain('pageSize=50')
  })

  it('appends statuses and types', async () => {
    mockFetch({ content: [] })
    await fetchMessages({ statuses: ['EN_ERREUR', 'TRAITE'], direction: 'INBOX', types: ['T1'] })
    const url = fetch.mock.calls[0][0]
    expect(url).toContain('statuses=EN_ERREUR')
    expect(url).toContain('statuses=TRAITE')
    expect(url).toContain('direction=INBOX')
    expect(url).toContain('types=T1')
  })
})

// ── fetchMessage ─────────────────────────────────────────────────────────────

describe('fetchMessage', () => {
  it('calls correct endpoint with id', async () => {
    mockFetch({ id: '42' })
    await fetchMessage('42')
    expect(fetch).toHaveBeenCalledWith('/api/messages/42')
  })
})

// ── replaySingle ─────────────────────────────────────────────────────────────

describe('replaySingle', () => {
  it('sends POST to correct endpoint', async () => {
    mockFetch({ replayed: 1 })
    await replaySingle('42')
    expect(fetch).toHaveBeenCalledWith('/api/messages/42/replay', expect.objectContaining({
      method: 'POST',
    }))
  })
})

// ── replayBatch ──────────────────────────────────────────────────────────────

describe('replayBatch', () => {
  it('sends ids in body', async () => {
    mockFetch({ replayed: 2 })
    await replayBatch(['1', '2'])
    const [, opts] = fetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ ids: ['1', '2'] })
  })
})

// ── replayByFilter ───────────────────────────────────────────────────────────

describe('replayByFilter', () => {
  it('sends filter in body', async () => {
    mockFetch({ replayed: 5 })
    await replayByFilter({ direction: 'OUTBOX', statuses: ['EN_ERREUR'], types: ['T1'] })
    const [, opts] = fetch.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({
      direction: 'OUTBOX',
      statuses: ['EN_ERREUR'],
      types: ['T1'],
    })
  })

  it('sends null for empty arrays', async () => {
    mockFetch({ replayed: 0 })
    await replayByFilter({})
    const [, opts] = fetch.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({
      direction: null,
      statuses: null,
      types: null,
    })
  })
})
