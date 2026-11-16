import { SUPABASE_URL } from './env'

// 서버 함수 공용: 응답, 우리 사이트에서 온 요청인지, 로그인한 사용자 ID.

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** 우리 사이트(브라우저가 붙이는 Origin)에서 온 요청만 — 대충 긁어 쓰는 프로그램 막기 */
export function fromOurSite(req: Request): boolean {
  const origin = req.headers.get('origin') ?? ''
  return /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)
}

/** 우리 익명 로그인(Supabase) 토큰을 서버에 물어 확인한 사용자 ID. 아니면 null */
export async function userIdOf(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const apikey = req.headers.get('x-supabase-key') ?? ''
  if (!auth.startsWith('Bearer ') || !apikey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey } })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: unknown }
    return typeof user.id === 'string' ? user.id : null
  } catch {
    return null
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}
