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
