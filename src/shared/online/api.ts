import { ensurePlayerId, getSupabase, recoverSession } from './supabase'

// 우리 서버 함수(Vercel /api/…) 부르기: 익명 로그인 토큰을 붙인다. 로그인이 만료됐으면 되살려 한 번 더.

async function post(path: string, body: unknown): Promise<Response> {
  await ensurePlayerId()
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${data.session?.access_token ?? ''}`,
      'x-supabase-key': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(body),
  })
}

export async function postApi(path: string, body: unknown): Promise<Response> {
  const res = await post(path, body)
  if (res.status !== 401) return res
  await recoverSession()
  return post(path, body)
}
