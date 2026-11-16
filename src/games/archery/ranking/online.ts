import { getSupabase } from '../../../shared/online/supabase'
import type { UploadStatus } from '../../../shared/online/uploadQueue'
import { type Ticket, createVerifiedQueue } from '../../../shared/online/verified'
import type { RoundSummary } from '../play/roundState'
import type { ArcheryLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.

// 올리기: 서버가 입장권 시드와 화살마다 누른·놓은 시각·조준점으로 다시 쏴서 점수를 직접 매겨 넣는다 (src/server/games/archery.ts).
const queue = createVerifiedQueue('archery:verified-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: RoundSummary, ticket: Ticket, nickname: string): Promise<Exclude<UploadStatus, 'saving'>> {
  const shots = summary.shots.map((s) => ({ pressAt: s.pressAt, releaseAt: s.releaseAt, aim: s.aim }))
  return queue.submit({ game: 'archery', ticket, nickname: nickname.trim().slice(0, 10) || '익명', data: { t0: summary.t0, shots } })
}

type RpcRow = {
  player_id: string
  nickname: string
  games: number
  avg_points: number | string
  best_points: number | string
  best_x: number
  best_ten: number
  best_at: string
  most_x: number
  most_x_points: number | string
  most_x_at: string
}

/** numeric 열은 설정에 따라 문자열로 올 수 있어 숫자로 맞춘다 */
const num = (v: number | string) => Number(v)

export async function fetchLeaderboard(): Promise<ArcheryLeaderRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('archery_leaderboard')
  if (error) throw error
  return ((data ?? []) as RpcRow[]).map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    games: r.games,
    avgPoints: num(r.avg_points),
    best: { points: num(r.best_points), xCount: r.best_x, tenCount: r.best_ten, at: r.best_at },
    mostX: { xCount: r.most_x, points: num(r.most_x_points), at: r.most_x_at },
  }))
}
