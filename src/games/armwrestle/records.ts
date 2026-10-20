import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { Difficulty, Event } from './constants'
import type { MatchSummary } from './play/matchState'

const GAME_ID = 'armwrestle'

/** 종목·난이도 하나의 기기 전적 (무승부 없음) */
export type LevelRecord = {
  wins: number
  losses: number
  /** 지금 이어지는 연승 (지면 0) */
  streak: number
  bestStreak: number
}

/** 친구 대전 전적 (봇전과 따로, 종목 합침) */
export type PvpRecord = { wins: number; losses: number }

export type ArmRecord = {
  mash: Record<Difficulty, LevelRecord>
  timing: Record<Difficulty, LevelRecord>
  pvp: PvpRecord
  /** 시작 화면에서 마지막으로 고른 종목·난이도 */
  event: Event
  difficulty: Difficulty
}

const EMPTY_LEVEL: LevelRecord = { wins: 0, losses: 0, streak: 0, bestStreak: 0 }

export const EMPTY_RECORD: ArmRecord = {
  mash: { normal: EMPTY_LEVEL, hard: EMPTY_LEVEL },
  timing: { normal: EMPTY_LEVEL, hard: EMPTY_LEVEL },
  pvp: { wins: 0, losses: 0 },
  event: 'mash',
  difficulty: 'normal',
}

export function addGame(record: ArmRecord, summary: MatchSummary): ArmRecord {
  const won = summary.outcome === 'win'
  if (summary.mode === 'pvp') {
    const p = record.pvp
    return { ...record, pvp: { wins: p.wins + (won ? 1 : 0), losses: p.losses + (won ? 0 : 1) } }
  }
  const l = record[summary.event][summary.difficulty]
  const streak = won ? l.streak + 1 : 0
  const level: LevelRecord = {
    wins: l.wins + (won ? 1 : 0),
    losses: l.losses + (won ? 0 : 1),
    streak,
    bestStreak: Math.max(l.bestStreak, streak),
  }
  return { ...record, [summary.event]: { ...record[summary.event], [summary.difficulty]: level } }
}

/** 승률. 경기가 없으면 null */
export function winRate(l: LevelRecord): number | null {
  const n = l.wins + l.losses
  return n === 0 ? null : l.wins / n
}

export function loadRecord(store: RecordStore = localRecordStore): ArmRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: ArmRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
