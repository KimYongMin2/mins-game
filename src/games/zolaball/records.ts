import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { MatchSummary } from './match/matchState'
import type { Difficulty } from './rules/judge'

const GAME_ID = 'zolaball'

export type WinLossDraw = { wins: number; losses: number; draws: number }

/** 졸라볼 통산 전적 */
export type ZolaballRecord = Record<Difficulty, WinLossDraw> & {
  homeruns: number
  atBats: number
  hits: number
}

export const EMPTY_RECORD: ZolaballRecord = {
  normal: { wins: 0, losses: 0, draws: 0 },
  hard: { wins: 0, losses: 0, draws: 0 },
  homeruns: 0,
  atBats: 0,
  hits: 0,
}

export function addMatch(record: ZolaballRecord, summary: MatchSummary): ZolaballRecord {
  const { difficulty } = summary.config
  const wld = { ...record[difficulty] }
  if (summary.outcome === 'win') wld.wins++
  else if (summary.outcome === 'lose') wld.losses++
  else wld.draws++
  return {
    ...record,
    [difficulty]: wld,
    homeruns: record.homeruns + summary.userStats.homeruns,
    atBats: record.atBats + summary.userStats.atBats,
    hits: record.hits + summary.userStats.hits,
  }
}

/** 야구식 타율 표기 (.333). 타수가 없으면 '-' */
export function formatAverage(hits: number, atBats: number): string {
  if (atBats === 0) return '-'
  const avg = (hits / atBats).toFixed(3)
  return avg.startsWith('0') ? avg.slice(1) : avg
}

export function loadRecord(store: RecordStore = localRecordStore): ZolaballRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: ZolaballRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
