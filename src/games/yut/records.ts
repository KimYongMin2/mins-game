import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'yut'

/** 판 수와 우승 횟수 */
export type Tally = { games: number; wins: number }

export type YutRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수·말 개수 */
  bots: number
  pieceCount: number
}

export const EMPTY_RECORD: YutRecord = { bot: { games: 0, wins: 0 }, pvp: { games: 0, wins: 0 }, bots: 1, pieceCount: 4 }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  won: boolean
  /** 우승 → 나간 말이 많은 순 */
  standings: { name: string; out: number; total: number; winner: boolean }[]
}

export function addGame(record: YutRecord, summary: GameSummary): YutRecord {
  const t = record[summary.mode]
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.won ? 1 : 0) } }
}

export function loadRecord(store: RecordStore = localRecordStore): YutRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: YutRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
