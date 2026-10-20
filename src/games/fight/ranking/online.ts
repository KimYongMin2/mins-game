import { getSupabase } from '../../../shared/online/supabase'
import { createUploadQueue, newRecordId } from '../../../shared/online/uploadQueue'
import type { Difficulty } from '../constants'
import type { MatchSummary } from '../play/matchState'
import type { FightLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.

/** fight_games 한 줄 (player_id·created_at은 서버가 채운다) */
export type FightGameRow = {
  id: string
  nickname: string
  difficulty: Difficulty
  outcome: MatchSummary['outcome']
  turns: number
  /** 이 경기 뒤의 연승 (지거나 비기면 0). 서버는 가장 큰 값을 최다 연승으로 쓴다 */
  win_streak: number
}

export function toGameRow(summary: MatchSummary, streak: number, nickname: string, id: string): FightGameRow {
  return {
    id,
    nickname: nickname.trim().slice(0, 10) || '익명',
    difficulty: summary.difficulty,
    outcome: summary.outcome,
    turns: summary.turns,
    win_streak: summary.outcome === 'win' ? streak : 0,
  }
}

const queue = createUploadQueue<FightGameRow>('fight_games', 'fight:pending-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: MatchSummary, streak: number, nickname: string): Promise<'saved' | 'queued'> {
  return queue.submit(toGameRow(summary, streak, nickname, newRecordId()))
}

type RpcRow = {
  player_id: string
  nickname: string
  wins: number
  losses: number
  draws: number
  best_streak: number
  best_streak_at: string | null
}

export async function fetchLeaderboard(difficulty: Difficulty): Promise<FightLeaderRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('fight_leaderboard', { p_difficulty: difficulty })
  if (error) throw error
  return ((data ?? []) as RpcRow[]).map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    bestStreak: r.best_streak,
    bestStreakAt: r.best_streak_at,
  }))
}
