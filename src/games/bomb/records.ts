import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'bomb'

/** 판 수와 1등 횟수 */
export type Tally = { games: number; wins: number }

export type BombRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수 */
  bots: number
}

export const EMPTY_RECORD: BombRecord = { bot: { games: 0, wins: 0 }, pvp: { games: 0, wins: 0 }, bots: 3 }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  /** 1등 = 1 */
  rank: number
  /** 순위대로 이름 */
  names: string[]
  /** 내가 던진 횟수 */
  passes: number
}

export function addGame(record: BombRecord, summary: GameSummary): BombRecord {
  const t = record[summary.mode]
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.rank === 1 ? 1 : 0) } }
}

export function loadRecord(store: RecordStore = localRecordStore): BombRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: BombRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
