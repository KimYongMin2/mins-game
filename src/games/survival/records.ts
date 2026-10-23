import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'survival'

/** 판 수, 우승 횟수, 맞힌 사람 수 */
export type Tally = { games: number; wins: number; kills: number }

export type SurvivalRecord = {
  /** 봇이랑 연습 */
  bot: Tally
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수 */
  bots: number
}

export const EMPTY_RECORD: SurvivalRecord = { bot: { games: 0, wins: 0, kills: 0 }, pvp: { games: 0, wins: 0, kills: 0 }, bots: 3 }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  /** 1등 = 1 */
  rank: number
  kills: number
  /** 등수 순 (같은 라운드에 탈락하면 같은 등수) */
  ranking: { name: string; rank: number; kills: number; me: boolean }[]
}

export function addGame(record: SurvivalRecord, summary: GameSummary): SurvivalRecord {
  const t = { ...EMPTY_RECORD[summary.mode], ...record[summary.mode] }
  return { ...record, [summary.mode]: { games: t.games + 1, wins: t.wins + (summary.rank === 1 ? 1 : 0), kills: t.kills + summary.kills } }
}

export function loadRecord(store: RecordStore = localRecordStore): SurvivalRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: SurvivalRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
