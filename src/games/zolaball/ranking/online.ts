import { getSupabase } from '../../../shared/online/supabase'
import { createUploadQueue, newRecordId } from '../../../shared/online/uploadQueue'
import type { MatchSummary } from '../match/matchState'
import type { Difficulty } from '../rules/judge'
import type { LeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.

const TABLE = 'zolaball_games'
const PENDING_KEY = 'zolaball:pending-games'

/** zolaball_games 한 줄 (player_id·created_at은 서버가 채운다) */
export type GameRow = {
  id: string
  nickname: string
  difficulty: Difficulty
  outcome: MatchSummary['outcome']
  at_bats: number
  hits: number
  homeruns: number
  rbi: number
  outs_pitched: number
  runs_allowed: number
}

export function toGameRow(summary: MatchSummary, nickname: string, id: string): GameRow {
  return {
    id,
    nickname: nickname.trim().slice(0, 10) || '익명',
    difficulty: summary.config.difficulty,
    outcome: summary.outcome,
    at_bats: summary.userStats.atBats,
    hits: summary.userStats.hits,
    homeruns: summary.userStats.homeruns,
    rbi: summary.userStats.rbi,
    outs_pitched: summary.userPitching.outs,
    runs_allowed: summary.userPitching.runsAllowed,
  }
}

const queue = createUploadQueue<GameRow>(TABLE, PENDING_KEY)

export type { UploadStatus } from '../../../shared/online/uploadQueue'

/** 쌓여 있는 기록을 모두 보낸다. 남은 개수를 돌려준다. */
export const flushPendingGames = queue.flush

/** 경기 결과를 올린다. */
export function submitGame(summary: MatchSummary, nickname: string): Promise<'saved' | 'queued'> {
  return queue.submit(toGameRow(summary, nickname, newRecordId()))
}

type LeaderboardRpcRow = {
  player_id: string
  nickname: string
  games: number
  wins: number
  losses: number
  draws: number
  at_bats: number
  hits: number
  homeruns: number
  rbi: number
  best_rbi: number
  outs_pitched: number
  runs_allowed: number
}

export async function fetchLeaderboard(difficulty: Difficulty): Promise<LeaderRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('zolaball_leaderboard', { p_difficulty: difficulty })
  if (error) throw error
  return ((data ?? []) as LeaderboardRpcRow[]).map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    atBats: r.at_bats,
    hits: r.hits,
    homeruns: r.homeruns,
    rbi: r.rbi,
    bestRbi: r.best_rbi,
    outsPitched: r.outs_pitched,
    runsAllowed: r.runs_allowed,
  }))
}
