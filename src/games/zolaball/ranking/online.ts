import { getSupabase } from '../../../shared/online/supabase'
import type { UploadStatus } from '../../../shared/online/uploadQueue'
import { type Ticket, createVerifiedQueue } from '../../../shared/online/verified'
import type { MatchSummary } from '../match/matchState'
import type { Difficulty } from '../rules/judge'
import type { LeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.


// 올리기: 서버가 입장권 시드와 공마다 내 입력으로 경기를 다시 돌려 기록을 직접 매겨 넣는다 (src/server/games/zolaball.ts).
const queue = createVerifiedQueue('zolaball:verified-games')

export type { UploadStatus } from '../../../shared/online/uploadQueue'

/** 쌓여 있는 기록을 모두 보낸다. 남은 개수를 돌려준다. */
export const flushPendingGames = queue.flush

/** 경기 결과를 올린다. */
export function submitGame(summary: MatchSummary, ticket: Ticket, nickname: string): Promise<Exclude<UploadStatus, 'saving'>> {
  return queue.submit({ game: 'zolaball', ticket, nickname: nickname.trim().slice(0, 10) || '익명', data: { difficulty: summary.config.difficulty, inputs: summary.inputs } })
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
