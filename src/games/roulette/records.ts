import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'roulette'

/** 판 수, 우승 횟수, 맞힌 사람 수 */
export type Tally = { games: number; wins: number; kills: number }

export type RouletteRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수 */
  bots: number
}

export const EMPTY_RECORD: RouletteRecord = { bot: { games: 0, wins: 0, kills: 0 }, pvp: { games: 0, wins: 0, kills: 0 }, bots: 3 }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  /** 1등 = 1 */
  rank: number
  kills: number
  /** 등수 순 (늦게 탈락할수록 앞) */
  ranking: { name: string; rank: number; kills: number; me: boolean }[]
}

export function addGame(record: RouletteRecord, summary: GameSummary): RouletteRecord {
  const t = { ...EMPTY_RECORD[summary.mode], ...record[summary.mode] }
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.rank === 1 ? 1 : 0), kills: t.kills + summary.kills } }
}

export function loadRecord(store: RecordStore = localRecordStore): RouletteRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: RouletteRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
