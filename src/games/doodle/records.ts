import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'doodle'

/** 친구 대전 판 수·1등 횟수·가장 높은 점수 */
export type DoodleRecord = { games: number; wins: number; best: number }

export const EMPTY_RECORD: DoodleRecord = { games: 0, wins: 0, best: 0 }

export type GameSummary = {
  /** 1등 = 1 (같은 점수면 같은 등수) */
  rank: number
  score: number
  ranking: { name: string; score: number; rank: number; me: boolean }[]
}

export function addGame(record: DoodleRecord, s: GameSummary): DoodleRecord {
  return { games: record.games + 1, wins: record.wins + (s.rank === 1 ? 1 : 0), best: Math.max(record.best, s.score) }
}

export function loadRecord(store: RecordStore = localRecordStore): DoodleRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: DoodleRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
