import { AccessToken, RoomConfiguration, TrackSource } from 'livekit-server-sdk'

// 회의방 음성 서버(LiveKit) 입장권 만들기 — Vercel 서버 함수 (주소 /api/livekit-token).
// 키(LIVEKIT_API_KEY·LIVEKIT_API_SECRET)는 Vercel 환경 변수에만 있고 브라우저엔 안 간다.
// 아무나 서버를 쓰지 못하게 우리 사이트의 익명 로그인(Supabase) 토큰을 확인한 뒤에만 준다.

const SUPABASE_URL = 'https://fxekefrjsmnmcuoaynfa.supabase.co'
/** 회의방 정원 (화면 CAPACITY와 같게) */
const CAPACITY = 16
const ROOM_RE = /^meeting-[A-Za-z0-9-]{1,48}$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const apikey = req.headers.get('x-supabase-key') ?? ''
  if (!auth.startsWith('Bearer ') || !apikey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey } })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  if (!key || !secret) return json(500, { error: 'not-configured' })
  let body: { room?: unknown; identity?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'bad-request' })
  }
  const { room, identity } = body
  const name = typeof body.name === 'string' ? body.name.replace(/[\u0000-\u001f]/g, '').slice(0, 20) : ''
  if (typeof room !== 'string' || !ROOM_RE.test(room) || typeof identity !== 'string' || !ID_RE.test(identity)) return json(400, { error: 'bad-request' })
  if (!(await signedIn(req))) return json(401, { error: 'unauthorized' })

  const at = new AccessToken(key, secret, { identity, name, ttl: '10m' })
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: [TrackSource.MICROPHONE] })
  at.roomConfig = new RoomConfiguration({ maxParticipants: CAPACITY, emptyTimeout: 60, departureTimeout: 20 })
  return json(200, { token: await at.toJwt() })
}
