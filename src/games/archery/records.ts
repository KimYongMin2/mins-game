import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { RoundSummary } from './play/roundState'

const GAME_ID = 'archery'

/** 졸라 양궁 기기 기록 */
export type ArcheryRecord = {
  games: number
  /** 평균 계산용 누적 점수 */
  totalPoints: number
  /** 최고 점수 (동점이면 X가 많은 쪽) */
  best: { points: number; xCount: number } | null
}

export const EMPTY_RECORD: ArcheryRecord = { games: 0, totalPoints: 0, best: null }

function isBetter(a: { points: number; xCount: number }, b: { points: number; xCount: number } | null) {
  if (!b) return true
  return a.points > b.points || (a.points === b.points && a.xCount > b.xCount)
}

/** 경기 결과를 더한다. 최고 기록을 새로 세웠는지도 함께 돌려준다. */
export function addGame(record: ArcheryRecord, summary: RoundSummary): { record: ArcheryRecord; newBest: boolean } {
  const result = { points: summary.points, xCount: summary.xCount }
  const newBest = isBetter(result, record.best)
  return {
    record: {
      games: record.games + 1,
      totalPoints: record.totalPoints + summary.points,
      best: newBest ? result : record.best,
    },
    newBest,
  }
}

export function averageOf(record: ArcheryRecord): number | null {
  return record.games === 0 ? null : record.totalPoints / record.games
}

export function loadRecord(store: RecordStore = localRecordStore): ArcheryRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: ArcheryRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
