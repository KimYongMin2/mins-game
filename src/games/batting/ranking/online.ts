import { getSupabase } from '../../../shared/online/supabase'
import { createUploadQueue, newRecordId } from '../../../shared/online/uploadQueue'
import type { Difficulty, Hand } from '../constants'
import type { SessionSummary } from '../play/session'
import type { BattingLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.

/** batting_games 한 줄 (player_id·created_at은 서버가 채운다) */
export type BattingGameRow = {
  id: string
  nickname: string
  difficulty: Difficulty
  hand: Hand
  points: number
  homeruns: number
  hits: number
}

export function toGameRow(summary: SessionSummary, nickname: string, id: string): BattingGameRow {
  return {
    id,
    nickname: nickname.trim().slice(0, 10) || '익명',
    difficulty: summary.difficulty,
    hand: summary.hand,
    points: summary.points,
    homeruns: summary.homeruns,
    hits: summary.hits,
  }
}

const queue = createUploadQueue<BattingGameRow>('batting_games', 'batting:pending-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: SessionSummary, nickname: string): Promise<'saved' | 'queued'> {
  return queue.submit(toGameRow(summary, nickname, newRecordId()))
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
