import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { Difficulty, Hand } from './constants'
import type { SessionSummary } from './play/session'
import { type Totals, isBetter } from './rules/scoring'

/** 점수가 비거리 합으로 바뀌면서 예전(결과별 점수) 기록과 섞이지 않게 새 키를 쓴다 */
const GAME_ID = 'batting-distance'

/** 난이도 하나의 기기 기록 */
export type LevelRecord = {
  games: number
  /** 평균 계산용 누적 점수 */
  totalPoints: number
  /** 최고 기록 (동점이면 홈런 → 안타 이상 개수가 많은 쪽) */
  best: Totals | null
}

export type BattingRecord = {
  normal: LevelRecord
  hard: LevelRecord
  /** 시작 화면에서 마지막으로 고른 것 */
  difficulty: Difficulty
  hand: Hand
}

const EMPTY_LEVEL: LevelRecord = { games: 0, totalPoints: 0, best: null }

export const EMPTY_RECORD: BattingRecord = { normal: EMPTY_LEVEL, hard: EMPTY_LEVEL, difficulty: 'normal', hand: 'right' }

/** 경기 결과를 더한다. 최고 기록을 새로 세웠는지도 함께 돌려준다 */
export function addGame(record: BattingRecord, summary: SessionSummary): { record: BattingRecord; newBest: boolean } {
  const level = record[summary.difficulty]
  const result: Totals = { points: summary.points, homeruns: summary.homeruns, hits: summary.hits }
  const newBest = isBetter(result, level.best)
  return {
    record: {
      ...record,
      [summary.difficulty]: {
        games: level.games + 1,
        totalPoints: level.totalPoints + summary.points,
        best: newBest ? result : level.best,
      },
    },
    newBest,
  }
}

export function averageOf(level: LevelRecord): number | null {
  return level.games === 0 ? null : level.totalPoints / level.games
}

export function loadRecord(store: RecordStore = localRecordStore): BattingRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: BattingRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
