import { getSupabase } from '../../../shared/online/supabase'
import type { UploadStatus } from '../../../shared/online/uploadQueue'
import { type Ticket, createVerifiedQueue } from '../../../shared/online/verified'
import type { Difficulty } from '../constants'
import type { SessionSummary } from '../play/session'
import type { BattingLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.

// 올리기: 서버가 입장권 시드와 공마다 누른 곳·도착 기준 차이로 다시 쳐서 점수를 직접 매겨 넣는다 (src/server/games/batting.ts).
const queue = createVerifiedQueue('batting:verified-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: SessionSummary, ticket: Ticket, nickname: string): Promise<Exclude<UploadStatus, 'saving'>> {
  const swings = summary.records.map((r) => (r.touched && r.offsetMs !== null ? { point: r.touched, offsetMs: r.offsetMs } : null))
  return queue.submit({ game: 'batting', ticket, nickname: nickname.trim().slice(0, 10) || '익명', data: { difficulty: summary.difficulty, hand: summary.hand, swings } })
}

type RpcRow = {
  player_id: string
  nickname: string
  games: number
  best_points: number
  best_homeruns: number
  best_hits: number
  best_at: string
  most_hr: number
  most_hr_points: number
  most_hr_at: string
}

export async function fetchLeaderboard(difficulty: Difficulty): Promise<BattingLeaderRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('batting_leaderboard', { p_difficulty: difficulty })
  if (error) throw error
  return ((data ?? []) as RpcRow[]).map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    games: r.games,
    best: { points: r.best_points, homeruns: r.best_homeruns, hits: r.best_hits, at: r.best_at },
    mostHr: { homeruns: r.most_hr, points: r.most_hr_points, at: r.most_hr_at },
  }))
}
