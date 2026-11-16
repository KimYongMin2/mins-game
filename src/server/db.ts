import { SUPABASE_URL } from './env'

// 비밀 키로 Supabase 테이블에 쓰기·읽기 (서버 함수만). 비밀 키는 RLS를 건너뛴다.

function headers(secret: string): Record<string, string> {
  // 새 비밀 키(sb_secret_…)는 apikey만, 예전 service_role(JWT)은 Authorization도
  return secret.startsWith('sb_secret_') ? { apikey: secret } : { apikey: secret, authorization: `Bearer ${secret}` }
}

/** 넣기. 같은 id가 이미 있으면 'duplicate' */
export async function insertRow(secret: string, table: string, row: Record<string, unknown>): Promise<'ok' | 'duplicate' | 'error'> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers(secret), 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (res.ok) return 'ok'
  const text = await res.text()
  if (res.status === 409 || text.includes('23505')) return 'duplicate'
  console.warn('[db] 넣기 실패', table, res.status, text.slice(0, 200))
  return 'error'
}

/** 조건에 맞는 가장 최근 한 줄 (query는 PostgREST 꼴, 예: 'player_id=eq.x&difficulty=eq.hard') */
export async function latestRow<T>(secret: string, table: string, query: string, columns: string): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${query}&order=created_at.desc&limit=1`, { headers: headers(secret) })
  if (!res.ok) throw new Error(`읽기 실패 ${res.status}`)
  const rows = (await res.json()) as T[]
  return rows[0] ?? null
}
