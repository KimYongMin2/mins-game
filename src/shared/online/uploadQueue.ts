import { readLocal, writeLocal } from '../storage/local'
import { ensurePlayerId, getSupabase, isAuthError, isOnlineConfigured, recoverSession } from './supabase'

// 게임 결과를 Supabase 테이블에 올리는 공용 큐.
// 올리기에 실패하면 기기(localStorage)에 쌓아 두었다가 다음에 다시 보낸다.
// 기록마다 고유 id가 있어 같은 기록을 두 번 보내도 서버에 한 번만 들어간다.

/** 결과 화면에 보여줄 업로드 상태. 'queued'면 기기에 보관해 두었다가 나중에 다시 보낸다. */
export type UploadStatus = 'saving' | 'saved' | 'queued'

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
  submit: (row: Row) => Promise<'saved' | 'queued'>
  /** 쌓여 있는 기록을 모두 보낸다. 남은 개수를 돌려준다 */
  flush: () => Promise<number>
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

  async function flush(): Promise<number> {
    const pending = load()
    if (pending.length === 0 || !isOnlineConfigured()) return pending.length
    try {
      await ensurePlayerId()
      const supabase = await getSupabase()
      let { error, status } = await supabase.from(table).insert(pending)
      // 저장된 로그인이 만료됐으면 되살려서 한 번 더
      if (error && isAuthError({ ...error, status })) {
        console.warn('[upload] 로그인 문제로 거부됨, 다시 로그인해서 재시도', error.code, error.message)
        await recoverSession()
        ;({ error, status } = await supabase.from(table).insert(pending))
      }
      // 23505: 이미 올라간 기록(같은 id)을 다시 보낸 경우. 하나씩 보내 중복만 건너뛴다.
      if (error?.code === '23505') {
        const left: Row[] = []
        for (const row of pending) {
          const r = await supabase.from(table).insert(row)
          if (r.error && r.error.code !== '23505') left.push(row)
        }
        save(left)
        return left.length
      }
      if (error) throw error
      save([])
      return 0
    } catch (e) {
      // 원인을 나중에 확인할 수 있게 콘솔에 남긴다. 기록은 기기에 남아 다음에 다시 보낸다
      console.warn('[upload] 기록 올리기 실패', table, e)
      return pending.length
    }
  }

  return {
    async submit(row) {
      save([...load(), row])
      return (await flush()) === 0 ? 'saved' : 'queued'
    },
    flush,
  }
}
