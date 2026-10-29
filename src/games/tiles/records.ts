import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'tiles'

/** 판 수와 우승 횟수 */
export type Tally = { games: number; wins: number }

export type SortBy = 'color' | 'number'

export type TilesRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수 */
  bots: number
  /** 손패 정렬 */
  sortBy: SortBy
}

export const EMPTY_RECORD: TilesRecord = { bot: { games: 0, wins: 0 }, pvp: { games: 0, wins: 0 }, bots: 1, sortBy: 'color' }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  won: boolean
  /** 1등부터: 남은 타일 수와 점수 */
  standings: { name: string; tiles: number; value: number; me: boolean }[]
}

export function addGame(record: TilesRecord, summary: GameSummary): TilesRecord {
  const t = record[summary.mode]
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.won ? 1 : 0) } }
}

export function loadRecord(store: RecordStore = localRecordStore): TilesRecord {
  return { ...EMPTY_RECORD, ...store.load(GAME_ID, EMPTY_RECORD) }
}

export function saveRecord(record: TilesRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
