import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'nunchi'

/** 판 수와 1등 횟수 */
export type Tally = { games: number; wins: number }

export type NunchiRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수 */
  bots: number
}

export const EMPTY_RECORD: NunchiRecord = { bot: { games: 0, wins: 0 }, pvp: { games: 0, wins: 0 }, bots: 3 }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  /** 1등 = 1 */
  rank: number
  /** 등수 순으로 이름과 등수 (같은 판에 탈락하면 같은 등수) */
  ranking: { name: string; rank: number }[]
}

export function addGame(record: NunchiRecord, summary: GameSummary): NunchiRecord {
  const t = record[summary.mode]
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.rank === 1 ? 1 : 0) } }
}

export function loadRecord(store: RecordStore = localRecordStore): NunchiRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: NunchiRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
