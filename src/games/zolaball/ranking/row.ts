import type { MatchSummary } from '../match/matchState'
import type { Difficulty } from '../rules/judge'

// 랭킹 테이블 한 줄 만들기 (브라우저와 서버 검사가 같이 씀 — 그래서 Supabase를 안 불러오는 파일로 따로 둠)

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

/** 랭킹에 올릴 봇 경기의 선공·후공: 서버 입장권 시드로 정한다 (서버가 다시 돌릴 때 같게) */
export const userSideForSeed = (seed: number): 'away' | 'home' => (seed % 2 === 0 ? 'away' : 'home')
