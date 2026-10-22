import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { Difficulty, Length } from './constants'
import type { MatchSummary } from './play/matchState'

const GAME_ID = 'numbaseball'

/** 봇전 난이도 하나의 기기 전적 */
export type LevelRecord = {
  wins: number
  losses: number
  draws: number
  /** 지금 이어지는 연승 (지거나 비기면 0) */
  streak: number
  bestStreak: number
}

/** 친구 대전 전적 (봇전과 따로) */
export type PvpRecord = { wins: number; losses: number; draws: number }

/** 혼자 하기 (숫자 개수별) */
export type SoloRecord = {
  games: number
  solved: number
  /** 맞힌 경기들의 횟수 합 (평균 계산용) */
  solvedTries: number
  /** 가장 적은 횟수로 맞힌 기록 */
  best: number | null
}

export type NumbaseballRecord = {
  normal: LevelRecord
  hard: LevelRecord
  pvp: PvpRecord
  solo3: SoloRecord
  solo4: SoloRecord
  /** 시작 화면에서 마지막으로 고른 것 */
  difficulty: Difficulty
  length: Length
}

const EMPTY_LEVEL: LevelRecord = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0 }
const EMPTY_SOLO: SoloRecord = { games: 0, solved: 0, solvedTries: 0, best: null }

export const EMPTY_RECORD: NumbaseballRecord = {
  normal: EMPTY_LEVEL,
  hard: EMPTY_LEVEL,
  pvp: { wins: 0, losses: 0, draws: 0 },
  solo3: EMPTY_SOLO,
  solo4: EMPTY_SOLO,
  difficulty: 'normal',
  length: 3,
}

export const soloKey = (length: Length) => (length === 3 ? 'solo3' : 'solo4')

function tally<T extends PvpRecord>(r: T, outcome: MatchSummary['outcome']): T {
  return {
    ...r,
    wins: r.wins + (outcome === 'win' ? 1 : 0),
    losses: r.losses + (outcome === 'lose' ? 1 : 0),
    draws: r.draws + (outcome === 'draw' ? 1 : 0),
  }
}

export function addGame(record: NumbaseballRecord, summary: MatchSummary): NumbaseballRecord {
  if (summary.mode === 'pvp') return { ...record, pvp: tally(record.pvp, summary.outcome) }
  if (summary.mode === 'solo') {
    const key = soloKey(summary.length)
    const r = record[key]
    const solved = summary.outcome === 'win'
    return {
      ...record,
      [key]: {
        games: r.games + 1,
        solved: r.solved + (solved ? 1 : 0),
        solvedTries: r.solvedTries + (solved ? summary.tries : 0),
        best: solved ? Math.min(r.best ?? Infinity, summary.tries) : r.best,
      },
    }
  }
  const l = record[summary.difficulty]
  const streak = summary.outcome === 'win' ? l.streak + 1 : 0
  return { ...record, [summary.difficulty]: { ...tally(l, summary.outcome), streak, bestStreak: Math.max(l.bestStreak, streak) } }
}

/** 승률 (무승부 제외). 승패가 없으면 null */
export function winRate(l: LevelRecord): number | null {
  const decided = l.wins + l.losses
  return decided === 0 ? null : l.wins / decided
}

/** 혼자 하기 평균 횟수 (맞힌 경기만). 없으면 null */
export function soloAverage(r: SoloRecord): number | null {
  return r.solved === 0 ? null : r.solvedTries / r.solved
}

export function loadRecord(store: RecordStore = localRecordStore): NumbaseballRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: NumbaseballRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
