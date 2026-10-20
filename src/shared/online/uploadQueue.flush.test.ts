import { beforeEach, describe, expect, it, vi } from 'vitest'

// 가짜 서버: bad가 true인 줄은 규칙 위반(400), offline이면 통신 오류
const server = { rows: [] as { id: string }[], offline: false }
type R = { id: string; bad?: boolean }

function insert(input: R | R[]) {
  if (server.offline) return Promise.resolve({ error: { message: 'Failed to fetch' }, status: 0 })
  const rows = Array.isArray(input) ? input : [input]
  if (rows.some((r) => r.bad)) return Promise.resolve({ error: { code: '23514', message: 'violates check constraint' }, status: 400 })
  if (rows.some((r) => server.rows.some((x) => x.id === r.id))) return Promise.resolve({ error: { code: '23505', message: 'duplicate' }, status: 409 })
  server.rows.push(...rows)
  return Promise.resolve({ error: null, status: 201 })
}

vi.mock('./supabase', () => ({
  isOnlineConfigured: () => true,
  ensurePlayerId: () => Promise.resolve('me'),
  getSupabase: () => Promise.resolve({ from: () => ({ insert }) }),
  isAuthError: () => false,
  recoverSession: () => Promise.resolve(),
}))

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
})

const { createUploadQueue, lastUploadError } = await import('./uploadQueue')

beforeEach(() => {
  server.rows = []
  server.offline = false
  mem.clear()
})

describe('기록 올리기 큐', () => {
  it('서버가 거부하는 옛 기록 하나가 새 기록을 막지 않는다 (옛 것은 버림)', async () => {
    const q = createUploadQueue<R>('t', 'k')
    mem.set('mins-game:k', JSON.stringify([{ id: 'old', bad: true }, { id: 'ok1' }]))
    expect(await q.submit({ id: 'new' })).toBe('saved')
    expect(server.rows.map((r) => r.id)).toEqual(['ok1', 'new'])
    expect(await q.flush()).toBe(0)
    expect(lastUploadError()).toContain('23514')
  })

  it('이번 기록 자체가 거부되면 rejected', async () => {
    const q = createUploadQueue<R>('t', 'k')
    expect(await q.submit({ id: 'x', bad: true })).toBe('rejected')
    expect(await q.flush()).toBe(0)
  })

  it('통신이 끊기면 남겨 뒀다가 다음에 보낸다', async () => {
    const q = createUploadQueue<R>('t', 'k')
    server.offline = true
    expect(await q.submit({ id: 'a' })).toBe('queued')
    server.offline = false
    expect(await q.flush()).toBe(0)
    expect(server.rows.map((r) => r.id)).toEqual(['a'])
  })

  it('이미 올라간 기록을 다시 보내도 한 번만', async () => {
    const q = createUploadQueue<R>('t', 'k')
    server.rows.push({ id: 'dup' })
    mem.set('mins-game:k', JSON.stringify([{ id: 'dup' }]))
    expect(await q.submit({ id: 'b' })).toBe('saved')
    expect(server.rows.map((r) => r.id)).toEqual(['dup', 'b'])
  })
})
