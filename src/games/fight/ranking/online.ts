import { getSupabase } from '../../../shared/online/supabase'
import type { UploadStatus } from '../../../shared/online/uploadQueue'
import { type Ticket, createVerifiedQueue } from '../../../shared/online/verified'
import type { Difficulty } from '../constants'
import type { MatchSummary } from '../play/matchState'
import type { FightLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.

// 올리기: 서버가 입장권 시드와 내가 낸 자세로 판을 다시 돌려 결과·연승을 직접 매겨 넣는다 (src/server/games/fight.ts).
// 예전처럼 결과 숫자를 바로 테이블에 넣는 길은 막음 (supabase/schema.sql).
const queue = createVerifiedQueue('fight:verified-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: MatchSummary, ticket: Ticket, nickname: string): Promise<Exclude<UploadStatus, 'saving'>> {
  return queue.submit({ game: 'fight', ticket, nickname: nickname.trim().slice(0, 10) || '익명', data: { difficulty: summary.difficulty, moves: summary.moves } })
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
