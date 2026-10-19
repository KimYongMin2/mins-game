import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { RoundSummary } from './play/roundState'

const GAME_ID = 'archery'

/** 졸라 양궁 기기 기록 */
export type ArcheryRecord = {
  games: number
  /** 평균 계산용 누적 점수 */
  totalPoints: number
  /** 최고 점수 (동점이면 X → 10점 개수가 많은 쪽) */
  best: BestGame | null
}

export type BestGame = { points: number; xCount: number; tenCount: number }

export const EMPTY_RECORD: ArcheryRecord = { games: 0, totalPoints: 0, best: null }

/** 총점 → X 개수 → 10점 개수 순으로 비교. 모두 같으면 먼저 세운 기록을 유지한다. */
export function isBetter(a: BestGame, b: BestGame | null): boolean {
  if (!b) return true
  if (Math.abs(a.points - b.points) > 1e-9) return a.points > b.points
  if (a.xCount !== b.xCount) return a.xCount > b.xCount
  return a.tenCount > (b.tenCount ?? 0)
}

/** 경기 결과를 더한다. 최고 기록을 새로 세웠는지도 함께 돌려준다. */
export function addGame(record: ArcheryRecord, summary: RoundSummary): { record: ArcheryRecord; newBest: boolean } {
  const result: BestGame = { points: summary.points, xCount: summary.xCount, tenCount: summary.tenCount }
  const newBest = isBetter(result, record.best)
  return {
    record: {
      games: record.games + 1,
      totalPoints: Math.round((record.totalPoints + summary.points) * 10) / 10,
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
