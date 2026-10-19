import { ensurePlayerId, getSupabase, isOnlineConfigured } from '../../../shared/online/supabase'
import { readLocal, writeLocal } from '../../../shared/storage/local'
import type { MatchSummary } from '../match/matchState'
import type { Difficulty } from '../rules/judge'
import type { LeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기에 실패하면 기기에 쌓아 두었다가 다음에 다시 보낸다.

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

function loadPending(): GameRow[] {
  try {
    const parsed: unknown = JSON.parse(readLocal(PENDING_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as GameRow[]) : []
  } catch {
    return []
  }
}

function savePending(rows: GameRow[]) {
  writeLocal(PENDING_KEY, JSON.stringify(rows))
}

/** 쌓여 있는 기록을 모두 보낸다. 남은 개수를 돌려준다. */
export async function flushPendingGames(): Promise<number> {
  const pending = loadPending()
  if (pending.length === 0 || !isOnlineConfigured()) return pending.length
  try {
    await ensurePlayerId()
    const supabase = await getSupabase()
    const { error } = await supabase.from(TABLE).insert(pending)
    // 23505: 이미 올라간 기록(같은 id)을 다시 보낸 경우. 하나씩 보내 중복만 건너뛴다.
    if (error?.code === '23505') {
      const left: GameRow[] = []
      for (const row of pending) {
        const r = await supabase.from(TABLE).insert(row)
        if (r.error && r.error.code !== '23505') left.push(row)
      }
      savePending(left)
      return left.length
    }
    if (error) throw error
    savePending([])
    return 0
  } catch {
    return pending.length
  }
}

/** 결과 화면에 보여줄 업로드 상태. 'queued'면 기기에 보관해 두었다가 나중에 다시 보낸다. */
export type UploadStatus = 'saving' | 'saved' | 'queued'

/** 경기 결과를 올린다. */
export async function submitGame(summary: MatchSummary, nickname: string): Promise<'saved' | 'queued'> {
  savePending([...loadPending(), toGameRow(summary, nickname, crypto.randomUUID())])
  const left = await flushPendingGames()
  return left === 0 ? 'saved' : 'queued'
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
