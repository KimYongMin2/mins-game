import { supabaseSecret } from './env'
import { fromOurSite, json, readJson, userIdOf } from './http'
import { issueTicket } from './ticket'

// POST /api/ticket {game} → 서버가 정한 시드가 든 판 입장권

export const VERIFIED_GAMES = ['fight', 'archery', 'batting', 'zolaball'] as const

export async function ticketApi(req: Request): Promise<Response> {
  if (!fromOurSite(req)) return json(403, { error: 'forbidden' })
  const secret = supabaseSecret()
  if (!secret) return json(500, { error: 'not-configured' })
  const body = await readJson(req)
  const game = body?.game
  if (typeof game !== 'string' || !(VERIFIED_GAMES as readonly string[]).includes(game)) return json(400, { error: 'bad-request' })
  const uid = await userIdOf(req)
  if (!uid) return json(401, { error: 'unauthorized' })
  return json(200, { ticket: await issueTicket(secret, game, uid) })
}
