import { ensurePlayerId, getSupabase, recoverSession } from '../online/supabase'

// 음성 서버 입장권 받기: 우리 사이트 익명 로그인 토큰을 붙여 /api/livekit-token(Vercel 서버 함수)에 묻는다.

export const SFU_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined

async function ask(room: string, identity: string, name: string): Promise<Response> {
  await ensurePlayerId()
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return fetch('/api/livekit-token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${data.session?.access_token ?? ''}`,
      'x-supabase-key': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ room, identity, name }),
  })
}

/** room은 'meeting-' + 방 채널 코드, identity는 방 접속 번호 */
export async function sfuToken(room: string, identity: string, name: string): Promise<string> {
  let res = await ask(room, identity, name)
  if (res.status === 401) {
    await recoverSession()
    res = await ask(room, identity, name)
  }
  if (!res.ok) throw new Error(`입장권 실패 ${res.status}`)
  const { token } = (await res.json()) as { token: string }
  return token
}
