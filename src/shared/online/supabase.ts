import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase 연결. 랭킹 등 온라인 기능이 필요할 때만 라이브러리를 불러와 첫 화면 로딩을 가볍게 유지한다.
// 사용자는 가입 없이 익명 로그인으로 기기별 ID를 받는다.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

let clientPromise: Promise<SupabaseClient> | null = null

export function isOnlineConfigured(): boolean {
  return Boolean(URL && KEY)
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!URL || !KEY) return Promise.reject(new Error('Supabase 설정이 없습니다'))
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mins-game:auth' },
    }),
  )
  return clientPromise
}

let realtimePromise: Promise<SupabaseClient> | null = null

/**
 * 친구 대전(실시간 방) 전용 연결. 로그인 정보를 쓰지 않는다.
 * 기기에 저장된 익명 로그인 토큰이 만료돼 있으면 실시간 채널 접속이 거부되는데(JWT 오류),
 * 방에는 사용자 구분이 필요 없어서 공개 키만으로 접속한다.
 */
export function getRealtimeClient(): Promise<SupabaseClient> {
  if (!URL || !KEY) return Promise.reject(new Error('Supabase 설정이 없습니다'))
  realtimePromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'mins-game:realtime' },
    }),
  )
  return realtimePromise
}

/** 이미 로그인된 사용자 ID. 없으면 null (새로 만들지 않는다) */
export async function currentPlayerId(): Promise<string | null> {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** 로그인돼 있지 않으면 익명 로그인한다. 기록을 올릴 때만 부른다. */
export async function ensurePlayerId(): Promise<string> {
  const existing = await currentPlayerId()
  if (existing) return existing
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) throw error ?? new Error('익명 로그인 실패')
  return data.user.id
}

/**
 * 저장된 로그인이 만료·손상돼 서버가 거부할 때 되살린다.
 * 먼저 같은 계정으로 토큰을 새로 받고(기록이 같은 사람으로 이어짐), 그것도 안 되면 새 익명 계정을 만든다.
 */
export async function recoverSession(): Promise<void> {
  const supabase = await getSupabase()
  const refreshed = await supabase.auth.refreshSession()
  if (!refreshed.error && refreshed.data.session) return
  console.warn('[upload] 로그인 갱신 실패, 새 익명 계정으로 접속', refreshed.error?.message)
  await supabase.auth.signOut({ scope: 'local' })
  await ensurePlayerId()
}

/** 로그인(토큰·권한) 문제로 거부된 오류인지 */
export function isAuthError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false
  return (
    error.status === 401 ||
    error.code === 'PGRST301' ||
    error.code === 'PGRST303' ||
    error.code === '42501' ||
    /jwt/i.test(error.message ?? '')
  )
}

