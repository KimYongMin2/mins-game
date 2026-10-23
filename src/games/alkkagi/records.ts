import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { Difficulty } from './constants'
import type { MatchSummary } from './play/matchState'

const GAME_ID = 'alkkagi'

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

export type AlkkagiRecord = {
  normal: LevelRecord
  hard: LevelRecord
  pvp: PvpRecord
  /** 시작 화면에서 마지막으로 고른 난이도 */
  difficulty: Difficulty
}

const EMPTY_LEVEL: LevelRecord = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0 }

export const EMPTY_RECORD: AlkkagiRecord = {
  normal: EMPTY_LEVEL,
  hard: EMPTY_LEVEL,
  pvp: { wins: 0, losses: 0, draws: 0 },
  difficulty: 'normal',
}

function tally<T extends PvpRecord>(r: T, outcome: MatchSummary['outcome']): T {
  return {
    ...r,
    wins: r.wins + (outcome === 'win' ? 1 : 0),
    losses: r.losses + (outcome === 'lose' ? 1 : 0),
    draws: r.draws + (outcome === 'draw' ? 1 : 0),
  }
}

export function addGame(record: AlkkagiRecord, summary: MatchSummary): AlkkagiRecord {
  if (summary.mode === 'pvp') return { ...record, pvp: tally(record.pvp, summary.outcome) }
  const l = record[summary.difficulty]
  const streak = summary.outcome === 'win' ? l.streak + 1 : 0
  return { ...record, [summary.difficulty]: { ...tally(l, summary.outcome), streak, bestStreak: Math.max(l.bestStreak, streak) } }
}

/** 승률 (무승부 제외). 승패가 없으면 null */
export function winRate(l: LevelRecord): number | null {
  const decided = l.wins + l.losses
  return decided === 0 ? null : l.wins / decided
}

export function loadRecord(store: RecordStore = localRecordStore): AlkkagiRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: AlkkagiRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
