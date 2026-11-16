import { readLocal, writeLocal } from '../storage/local'
import { postApi } from './api'
import { isOnlineConfigured } from './supabase'
import type { UploadStatus } from './uploadQueue'

// 서버가 확인하는 랭킹 올리기 (사용자 요청 2026-11-16 — 점수를 지어내 올리지 못하게).
// 판을 시작하기 전에 서버에서 시드가 든 입장권(티켓)을 받아 그 시드로 경기하고, 끝나면 티켓 + 입력 기록을 보낸다.
// 서버(src/server)가 같은 규칙 코드로 판을 다시 돌려 점수를 직접 매긴다. 실패하면 기기에 두었다가 다시 보낸다.

export type Ticket = { id: string; game: string; uid: string; seed: number; exp: number; sig: string }

/** 미리 받아 둔 티켓 (게임마다 하나). 판을 시작할 때 꺼내 쓰고 바로 다음 것을 받아 둔다 */
const ready = new Map<string, Ticket>()
const loading = new Map<string, Promise<void>>()

/** 다음 판 티켓을 미리 받아 둔다 (시작 화면에서). 오프라인이면 조용히 실패 */
export function prefetchTicket(game: string): Promise<void> {
  if (!isOnlineConfigured() || ready.has(game)) return Promise.resolve()
  let p = loading.get(game)
  if (!p) {
    p = (async () => {
      try {
        const res = await postApi('/api/ticket', { game })
        if (res.ok) ready.set(game, ((await res.json()) as { ticket: Ticket }).ticket)
      } catch (e) {
        console.warn('[ticket] 받기 실패', game, e)
      } finally {
        loading.delete(game)
      }
    })()
    loading.set(game, p)
  }
  return p
}

/** 이번 판에 쓸 티켓 (없으면 null → 그 판은 랭킹에 안 올라감). 꺼내면서 다음 것을 받아 둔다 */
export function takeTicket(game: string): Ticket | null {
  const t = ready.get(game) ?? null
  ready.delete(game)
  if (t && t.exp < Date.now() + 60_000) return takeTicket(game)
  void prefetchTicket(game)
  return t
}

type Pending = { game: string; ticket: Ticket; nickname: string; data: unknown }

/** game: 서버 검사 이름, storageKey: 못 보낸 기록을 기기에 둘 키 */
export function createVerifiedQueue(storageKey: string) {
  const load = (): Pending[] => {
    try {
      const x: unknown = JSON.parse(readLocal(storageKey) ?? '[]')
      return Array.isArray(x) ? (x as Pending[]) : []
    } catch {
      return []
    }
  }
  const save = (rows: Pending[]) => writeLocal(storageKey, JSON.stringify(rows))

  /** 보내고, 서버가 거부해 버린 티켓 id들 */
  async function send(): Promise<string[]> {
    const dropped: string[] = []
    if (!isOnlineConfigured()) return dropped
    const left: Pending[] = []
    for (const row of load()) {
      try {
        const res = await postApi('/api/submit', row)
        if (res.ok || res.status === 409) continue
        if (res.status === 400 || Date.now() > row.ticket.exp) {
          console.warn('[submit] 서버가 받지 않은 기록', row.game, res.status, await res.text().catch(() => ''))
          dropped.push(row.ticket.id)
          continue
        }
        left.push(row)
      } catch {
        left.push(row)
      }
    }
    save(left)
    return dropped
  }

  return {
    async submit(row: Pending): Promise<Exclude<UploadStatus, 'saving'>> {
      save([...load(), row])
      const dropped = await send()
      if (dropped.includes(row.ticket.id)) return 'rejected'
      return load().some((r) => r.ticket.id === row.ticket.id) ? 'queued' : 'saved'
    },
    async flush(): Promise<number> {
      await send()
      return load().length
    },
  }
}
