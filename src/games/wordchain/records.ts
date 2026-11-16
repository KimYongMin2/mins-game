import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'wordchain'

/** 친구 대전 판 수·우승·한 판에 가장 많이 이은 낱말 수(나) */
export type WordchainRecord = { games: number; wins: number; bestWords: number }
export const EMPTY_RECORD: WordchainRecord = { games: 0, wins: 0, bestWords: 0 }

export function addGame(r: WordchainRecord, s: { rank: number; words: number }): WordchainRecord {
  return { games: r.games + 1, wins: r.wins + (s.rank === 1 ? 1 : 0), bestWords: Math.max(r.bestWords, s.words) }
}

export function loadRecord(store: RecordStore = localRecordStore): WordchainRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: WordchainRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
