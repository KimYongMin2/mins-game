import type { Profile } from '../games/fishing/play/protocol'
import { SUPABASE_URL, supabaseSecret } from './env'

// 낚시터 도감·어항 저장 (사용자가 Supabase로 정함 2026-11-17). 표 fishing_profiles(user_id, nickname, data jsonb) 한 사람 한 줄.
// 게임 서버가 비밀 키(SUPABASE_SECRET_KEY, 서버 game-server/.env)로 읽고 쓴다 — 브라우저는 못 씀.
// 키가 없으면 서버 메모리에만 (서버를 다시 켜면 사라짐 — 화면에 '저장 안 됨' 표시).

const cache = new Map<string, { profile: Profile; nickname: string }>()
const dirty = new Set<string>()
const loading = new Map<string, Promise<Profile>>()

const empty = (): Profile => ({ dex: {}, bag: [], tank: [] })
export const savingOn = () => !!supabaseSecret()

function headers(secret: string): Record<string, string> {
  return secret.startsWith('sb_secret_') ? { apikey: secret } : { apikey: secret, authorization: `Bearer ${secret}` }
}

/** 읽은 값 검사 (모양이 틀리면 빈 것으로) */
function clean(x: unknown): Profile {
  if (!x || typeof x !== 'object') return empty()
  const p = x as Partial<Profile>
  return {
    dex: p.dex && typeof p.dex === 'object' ? p.dex : {},
    bag: Array.isArray(p.bag) ? p.bag.slice(-200) : [],
    tank: Array.isArray(p.tank) ? p.tank.filter((k) => typeof k === 'string').slice(0, 10) : [],
  }
}

export function loadProfile(uid: string): Promise<Profile> {
  const hit = cache.get(uid)
  if (hit) return Promise.resolve(hit.profile)
  const going = loading.get(uid)
  if (going) return going
  const secret = supabaseSecret()
  const p = (async () => {
    let profile = empty()
    if (secret) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_profiles?select=data&user_id=eq.${encodeURIComponent(uid)}`, { headers: headers(secret) })
        if (res.ok) profile = clean(((await res.json()) as { data: unknown }[])[0]?.data)
        else console.warn('[fishing] 읽기 실패', res.status, (await res.text()).slice(0, 160))
      } catch (e) {
        console.warn('[fishing] 읽기 실패', e)
      }
    }
    const hitNow = cache.get(uid)
    if (hitNow) return hitNow.profile
    cache.set(uid, { profile, nickname: '' })
    return profile
  })().finally(() => loading.delete(uid))
  loading.set(uid, p)
  return p
}

/** 바꾼 뒤 부름 (몇 초 모아서 씀) */
export function markDirty(uid: string, nickname: string) {
  const hit = cache.get(uid)
  if (!hit) return
  hit.nickname = nickname
  dirty.add(uid)
}

export async function flush() {
  const secret = supabaseSecret()
  if (!secret || dirty.size === 0) return dirty.clear()
  const rows = [...dirty].map((uid) => ({ user_id: uid, nickname: cache.get(uid)!.nickname.slice(0, 20), data: cache.get(uid)!.profile, updated_at: new Date().toISOString() }))
  dirty.clear()
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_profiles?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers(secret), 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!res.ok) {
      console.warn('[fishing] 쓰기 실패', res.status, (await res.text()).slice(0, 200))
      for (const r of rows) dirty.add(r.user_id)
    }
  } catch (e) {
    console.warn('[fishing] 쓰기 실패', e)
    for (const r of rows) dirty.add(r.user_id)
  }
}

let timer: ReturnType<typeof setInterval> | null = null
/** 3초마다 모아서 쓰기 (게임 서버가 켜질 때 한 번) */
export function startFlushing() {
  timer ??= setInterval(() => void flush(), 3000)
}

/** 테스트용 */
export function resetStore() {
  cache.clear()
  dirty.clear()
  loading.clear()
}
