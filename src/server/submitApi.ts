import { latestRow, insertRow } from './db'
import { supabaseSecret } from './env'
import { replayArchery } from './games/archery'
import { replayBatting } from './games/batting'
import { replayFight } from './games/fight'
import { fromOurSite, json, readJson, userIdOf } from './http'
import { checkTicket } from './ticket'

// POST /api/submit {game, ticket, nickname, data} → 그 판을 다시 돌려 서버가 매긴 기록만 랭킹 테이블에 넣는다.
// 응답: 200 저장 · 409 이미 올림 · 400 조작이거나 잘못된 기록(다시 보내도 안 됨) · 401 로그인 · 500 서버 문제

const cleanNick = (x: unknown) => (typeof x === 'string' ? x.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 10) : '') || '익명'

export async function submitApi(req: Request): Promise<Response> {
  if (!fromOurSite(req)) return json(403, { error: 'forbidden' })
  const secret = supabaseSecret()
  if (!secret) return json(500, { error: 'not-configured' })
  const body = await readJson(req)
  if (!body || typeof body.game !== 'string') return json(400, { error: 'bad-request' })
  const uid = await userIdOf(req)
  if (!uid) return json(401, { error: 'unauthorized' })
  const ticket = await checkTicket(secret, body.ticket, body.game, uid)
  if (!ticket) return json(400, { error: 'bad-ticket' })
  const data = (body.data ?? {}) as Record<string, unknown>
  const nickname = cleanNick(body.nickname)

  if (body.game === 'fight') {
    const r = replayFight(ticket.seed, data.difficulty, data.moves)
    if (!r) return json(400, { error: 'replay-mismatch' })
    // 연승은 서버가 이 사람의 지난 기록으로 센다
    const last = await latestRow<{ win_streak: number }>(secret, 'fight_games', `player_id=eq.${uid}&difficulty=eq.${r.difficulty}`, 'win_streak')
    const streak = r.outcome === 'win' ? (last?.win_streak ?? 0) + 1 : 0
    const res = await insertRow(secret, 'fight_games', { id: ticket.id, player_id: uid, nickname, difficulty: r.difficulty, outcome: r.outcome, turns: r.turns, win_streak: streak })
    return res === 'ok' ? json(200, { ok: true, outcome: r.outcome }) : res === 'duplicate' ? json(409, { error: 'duplicate' }) : json(500, { error: 'db' })
  }
  if (body.game === 'archery') {
    const r = replayArchery(ticket.seed, data.t0, data.shots)
    if (!r) return json(400, { error: 'replay-mismatch' })
    const res = await insertRow(secret, 'archery_games', { id: ticket.id, player_id: uid, nickname, points: r.points, x_count: r.xCount, ten_count: r.tenCount })
    return res === 'ok' ? json(200, { ok: true, points: r.points }) : res === 'duplicate' ? json(409, { error: 'duplicate' }) : json(500, { error: 'db' })
  }
  if (body.game === 'batting') {
    const r = replayBatting(ticket.seed, data.difficulty, data.hand, data.swings)
    if (!r) return json(400, { error: 'replay-mismatch' })
    const res = await insertRow(secret, 'batting_games', { id: ticket.id, player_id: uid, nickname, difficulty: r.difficulty, hand: r.hand, points: r.points, homeruns: r.homeruns, hits: r.hits })
    return res === 'ok' ? json(200, { ok: true, points: r.points }) : res === 'duplicate' ? json(409, { error: 'duplicate' }) : json(500, { error: 'db' })
  }
  return json(400, { error: 'bad-request' })
}
