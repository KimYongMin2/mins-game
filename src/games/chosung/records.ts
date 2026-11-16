import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'chosung'

/** 혼자 하기: 판 수·최고 점수·맞힌 문제 수 / 친구 대전: 판 수·우승 */
export type ChosungRecord = { solo: { games: number; best: number; solved: number }; pvp: { games: number; wins: number } }

export const EMPTY_RECORD: ChosungRecord = { solo: { games: 0, best: 0, solved: 0 }, pvp: { games: 0, wins: 0 } }

export type GameSummary = {
  mode: 'solo' | 'pvp'
  rank: number
  score: number
  /** 맞힌 문제 수 (나) */
  solved: number
  total: number
  ranking: { name: string; score: number; rank: number; me: boolean }[]
}

export function addGame(r: ChosungRecord, s: GameSummary): ChosungRecord {
  if (s.mode === 'solo') return { ...r, solo: { games: r.solo.games + 1, best: Math.max(r.solo.best, s.score), solved: r.solo.solved + s.solved } }
  return { ...r, pvp: { games: r.pvp.games + 1, wins: r.pvp.wins + (s.rank === 1 ? 1 : 0) } }
}

export function loadRecord(store: RecordStore = localRecordStore): ChosungRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: ChosungRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
