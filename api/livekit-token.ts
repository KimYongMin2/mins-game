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

/** 로그인한 사용자 ID (서버가 확인한 것). 아니면 null */
async function signedIn(req: Request): Promise<string | null> {
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

/**
 * 우리 사이트에서 온 요청만 (사용자 요청 — 남이 프로그램으로 입장권을 잔뜩 받아 트래픽을 일으키지 못하게).
 * Origin은 브라우저가 붙이고 페이지가 못 바꾼다. 프로그램은 속일 수 있지만 대충 긁어 쓰는 건 막고, 진짜 상한은 서버 설정(limit)이 맡는다
 */
function fromOurSite(req: Request): boolean {
  const origin = req.headers.get('origin') ?? ''
  return /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)
}

export async function POST(req: Request): Promise<Response> {
  if (!fromOurSite(req)) return json(403, { error: 'forbidden' })
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
  const userId = await signedIn(req)
  if (!userId) return json(401, { error: 'unauthorized' })

  // 참가자 이름 = '방 접속 번호.사용자 ID 앞 8자'. 사용자 ID는 서버가 확인한 것이라, 남의 접속 번호로 받아도 이름이 달라
  // 원래 사람이 쫓겨나지 않는다 (LiveKit은 같은 이름이 들어오면 먼저 있던 사람을 내보냄)
  const at = new AccessToken(key, secret, { identity: `${identity}.${userId.replace(/-/g, '').slice(0, 8)}`, name, ttl: '10m' })
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: [TrackSource.MICROPHONE] })
  at.roomConfig = new RoomConfiguration({ maxParticipants: CAPACITY, emptyTimeout: 60, departureTimeout: 20 })
  return json(200, { token: await at.toJwt() })
}
