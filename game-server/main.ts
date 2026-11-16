import { createServer } from 'node:http'
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

const hub = new Hub({ verify, graceMs: 15_000, referees: REFEREES })
// 오래 아무 일 없는 방 닫기
setInterval(() => hub.sweep(), 10 * 60_000)
const ALLOWED_ORIGIN = /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$|^http:\/\/localhost:\d+$/

const http = createServer((req, res) => {
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

wss.on('connection', (ws) => {
  const session = hub.open({ send: (t) => ws.send(t), close: (code) => ws.close(code) })
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
