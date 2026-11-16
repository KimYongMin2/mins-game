import { postApi } from '../online/api'

// 음성 서버 입장권 받기: /api/livekit-token(Vercel 서버 함수)에 익명 로그인 토큰을 붙여 묻는다.

export const SFU_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined

/** room은 'meeting-' + 방 채널 코드, identity는 방 접속 번호 */
export async function sfuToken(room: string, identity: string, name: string): Promise<string> {
  const res = await postApi('/api/livekit-token', { room, identity, name })
  if (!res.ok) throw new Error(`입장권 실패 ${res.status}`)
  const { token } = (await res.json()) as { token: string }
  return token
}
