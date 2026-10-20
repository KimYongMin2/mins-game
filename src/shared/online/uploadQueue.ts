import { readLocal, writeLocal } from '../storage/local'
import { ensurePlayerId, getSupabase, isAuthError, isOnlineConfigured, recoverSession } from './supabase'

// 게임 결과를 Supabase 테이블에 올리는 공용 큐.
// 올리기에 실패하면 기기(localStorage)에 쌓아 두었다가 다음에 다시 보낸다.
// 기록마다 고유 id가 있어 같은 기록을 두 번 보내도 서버에 한 번만 들어간다.

/**
 * 결과 화면에 보여줄 업로드 상태. 'queued'면 기기에 보관해 두었다가 나중에 다시 보낸다.
 * 'rejected'면 서버가 이 기록을 받지 않았다 (다시 보내도 안 돼서 버림)
 */
export type UploadStatus = 'saving' | 'saved' | 'queued' | 'rejected'

let lastError: string | null = null

/**
 * 마지막으로 기록 올리기에 실패한 이유 (짧게). 결과 화면에 작게 보여줘서
 * 콘솔을 열기 어려운 휴대폰에서도 원인을 알 수 있게 한다
 */
export function lastUploadError(): string | null {
  return lastError
}

function describeError(e: unknown): string {
  if (e && typeof e === 'object') {
    const { code, message } = e as { code?: string; message?: string }
    const text = [code, message].filter(Boolean).join(' ')
    if (text) return text.slice(0, 120)
  }
  return String(e).slice(0, 120)
}

/**
 * 기록마다 붙이는 고유 id (UUID v4). crypto.randomUUID는 https·localhost에서만 있어서
 * 같은 와이파이의 http 주소(휴대폰 테스트 등)에서는 getRandomValues로 직접 만든다.
 */
export function newRecordId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // 버전 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 변형
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export type UploadQueue<Row extends { id: string }> = {
  /** 한 줄을 큐에 넣고 바로 보내 본다 */
  submit: (row: Row) => Promise<'saved' | 'queued' | 'rejected'>
  /** 쌓여 있는 기록을 모두 보낸다. 남은 개수를 돌려준다 */
  flush: () => Promise<number>
}

/** 서버가 요청 내용 때문에 거부함 (다시 보내도 똑같이 거부된다). 401·403은 로그인 문제라 따로 본다 */
export function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 408 && status !== 429
}

/** table: Supabase 테이블 이름, storageKey: 기기에 보관할 때 쓰는 키 */
export function createUploadQueue<Row extends { id: string }>(table: string, storageKey: string): UploadQueue<Row> {
  function load(): Row[] {
    try {
      const parsed: unknown = JSON.parse(readLocal(storageKey) ?? '[]')
      return Array.isArray(parsed) ? (parsed as Row[]) : []
    } catch {
      return []
    }
  }

  function save(rows: Row[]) {
    writeLocal(storageKey, JSON.stringify(rows))
  }

  /** 남은 개수와, 서버가 거부해서 버린 기록 id */
  async function send(): Promise<{ left: number; dropped: string[] }> {
    const pending = load()
    const dropped: string[] = []
    if (pending.length === 0 || !isOnlineConfigured()) return { left: pending.length, dropped }
    try {
      await ensurePlayerId()
      const supabase = await getSupabase()
      lastError = null
      let { error, status } = await supabase.from(table).insert(pending)
      // 저장된 로그인이 만료됐으면 되살려서 한 번 더
      if (error && isAuthError({ ...error, status })) {
        console.warn('[upload] 로그인 문제로 거부됨, 다시 로그인해서 재시도', error.code, error.message)
        await recoverSession()
        ;({ error, status } = await supabase.from(table).insert(pending))
      }
      // 한꺼번에 거부되면 하나씩 보낸다. 한 줄 때문에 나머지까지 막히지 않게
      // - 23505: 이미 올라간 기록(같은 id) → 올라간 것으로 친다
      // - 서버가 내용 때문에 거부(400대): 다시 보내도 안 되니 버리고 이유를 남긴다
      // - 그 밖(통신 끊김·서버 오류): 남겨 뒀다가 다음에 다시 보낸다
      if (error && (error.code === '23505' || isPermanent(status))) {
        const left: Row[] = []
        for (const row of pending) {
          const r = await supabase.from(table).insert(row)
          if (!r.error || r.error.code === '23505') continue
          if (isPermanent(r.status) && !isAuthError({ ...r.error, status: r.status })) {
            console.warn('[upload] 서버가 거부한 기록을 버림', table, r.error.code, r.error.message, row)
            lastError = describeError(r.error)
            dropped.push(row.id)
            continue
          }
          left.push(row)
        }
        save(left)
        return { left: left.length, dropped }
      }
      if (error) throw error
      save([])
      return { left: 0, dropped }
    } catch (e) {
      // 원인을 나중에 확인할 수 있게 남긴다. 기록은 기기에 남아 다음에 다시 보낸다
      console.warn('[upload] 기록 올리기 실패', table, e)
      lastError = describeError(e)
      return { left: pending.length, dropped }
    }
  }

  async function flush(): Promise<number> {
    return (await send()).left
  }

  return {
    async submit(row) {
      save([...load(), row])
      const { dropped } = await send()
      if (dropped.includes(row.id)) return 'rejected'
      // 이번 기록이 아직 남아 있으면 나중에 다시 보낸다
      return load().some((r) => r.id === row.id) ? 'queued' : 'saved'
    },
    flush,
  }
}
