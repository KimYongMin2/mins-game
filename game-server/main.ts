import { type IncomingMessage, createServer } from 'node:http'
import { AccessToken, RoomConfiguration, TrackSource } from 'livekit-server-sdk'
import { WebSocketServer } from 'ws'
import { Hub } from '../src/server/hub'
import { REFEREES } from '../src/server/referees'

// 민스서버(AWS Lightsail)에서 도는 게임 서버. Caddy가 https(wss://game.3-39-97-59.sslip.io)를 받아 여기(8090)로 넘긴다.
// 속은 src/server/hub.ts — 여기는 WebSocket만 붙인다. `npm run build:game`으로 game-server/server.js 한 파일로 묶어 커밋하고,
// 서버는 git pull → docker compose up -d --build.

const PORT = Number(process.env.PORT ?? 8090)
const SUPABASE_URL = 'https://fxekefrjsmnmcuoaynfa.supabase.co'
/** 같은 토큰은 한동안 다시 안 묻는다 */
const verified = new Map<string, { uid: string; until: number }>()

async function verify(token: string, apikey: string): Promise<string | null> {
  const hit = verified.get(token)
  if (hit && hit.until > Date.now()) return hit.uid
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey } })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: unknown }
    if (typeof user.id !== 'string') return null
    if (verified.size > 5000) verified.clear()
    verified.set(token, { uid: user.id, until: Date.now() + 10 * 60_000 })
    return user.id
  } catch {
    return null
  }
}

// 회의방 음성·화상 입장권 (2026-11-17 — 예전엔 Vercel이 방 확인 없이 줬음). 키는 서버의 game-server/.env (LIVEKIT_API_KEY·LIVEKIT_API_SECRET)
const LK_KEY = process.env.LIVEKIT_API_KEY
const LK_SECRET = process.env.LIVEKIT_API_SECRET
/** 회의방 정원 (화면 CAPACITY와 같게) */
const MEET_CAPACITY = 16
async function sfuToken(room: string, identity: string, name: string): Promise<string> {
  if (!LK_KEY || !LK_SECRET) throw new Error('LiveKit 키 없음')
  const at = new AccessToken(LK_KEY, LK_SECRET, { identity, name, ttl: '10m' })
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
  })
  at.roomConfig = new RoomConfiguration({ maxParticipants: MEET_CAPACITY, emptyTimeout: 60, departureTimeout: 20 })
  return at.toJwt()
}

const hub = new Hub({ verify, graceMs: 15_000, referees: REFEREES, ...(LK_KEY && LK_SECRET ? { sfuToken } : {}) })
// 오래 아무 일 없는 방 닫기
setInterval(() => hub.sweep(), 10 * 60_000)
const ALLOWED_ORIGIN = /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$|^http:\/\/localhost:\d+$/

/** 접속한 곳: Caddy가 붙인 X-Forwarded-For 맨 앞 (이 서버는 127.0.0.1에만 열려 있어 Caddy를 거친 것만 옴) */
const ipOf = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()

// 브라우저 오류 기록 (2026-11-17 — 친구 폰에서 화면이 하얘져도 알 수가 없어서). docker logs로 본다: '[report]'
const reports = new Map<string, number[]>()
const REPORT_PER_MIN = 10
function report(req: IncomingMessage, res: import('node:http').ServerResponse) {
  const origin = String(req.headers.origin ?? '')
  const allowed = ALLOWED_ORIGIN.test(origin)
  const cors: Record<string, string> = allowed ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type' } : {}
  if (req.method === 'OPTIONS') return void (res.writeHead(204, cors), res.end())
  if (req.method !== 'POST' || !allowed) return void (res.writeHead(403), res.end())
  const ip = ipOf(req)
  const now = Date.now()
  const recent = (reports.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= REPORT_PER_MIN) return void (res.writeHead(429, cors), res.end())
  reports.set(ip, [...recent, now])
  if (reports.size > 2000) reports.clear()
  let body = ''
  req.on('data', (c: Buffer) => {
    body += c.toString()
    if (body.length > 4000) req.destroy()
  })
  req.on('end', () => {
    try {
      const r = JSON.parse(body) as Record<string, unknown>
      const pick = (k: string, max: number) => (typeof r[k] === 'string' ? (r[k] as string).replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '')
      console.log(`[report] ${new Date().toISOString()} ${pick('path', 80)} | ${pick('msg', 300)} | ${pick('stack', 600)} | ${pick('ua', 160)} | ${pick('ver', 40)}`)
    } catch {
      /* 이상한 글은 버림 */
    }
    res.writeHead(204, cors)
    res.end()
  })
}

const http = createServer((req, res) => {
  if (req.url === '/report') return report(req, res)
  // 살아 있는지 보기 (브라우저로 열면 OK)
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end(req.url === '/stats' ? JSON.stringify(hub.stats()) : 'OK')
})

const wss = new WebSocketServer({
  server: http,
  maxPayload: 32 * 1024,
  // 우리 사이트에서 연 접속만
  verifyClient: ({ origin }: { origin: string }) => ALLOWED_ORIGIN.test(origin ?? ''),
})

wss.on('connection', (ws, req) => {
  const session = hub.open({ send: (t) => ws.send(t), close: (code) => ws.close(code) }, ipOf(req))
  let alive = true
  ws.on('pong', () => (alive = true))
  const beat = setInterval(() => {
    if (!alive) return ws.terminate()
    alive = false
    ws.ping()
  }, 20_000)
  ws.on('message', (data) => session.receive(data.toString()))
  ws.on('close', () => {
    clearInterval(beat)
    session.close()
  })
  ws.on('error', () => ws.terminate())
})

http.listen(PORT, () => console.log(`[game] ${PORT}번에서 기다리는 중`))
