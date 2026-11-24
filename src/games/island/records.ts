import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { BotLevel } from './bot/islandBot'

const GAME_ID = 'island'

export type Tally = { games: number; wins: number; draws: number }

/** 봇 연습은 난이도별 승·무, 한 기기 둘이서는 판 수만 */
export type IslandRecord = { bot: Record<BotLevel, Tally>; local: { games: number }; level: BotLevel }

const EMPTY_TALLY: Tally = { games: 0, wins: 0, draws: 0 }
export const EMPTY_RECORD: IslandRecord = { bot: { normal: EMPTY_TALLY, hard: EMPTY_TALLY }, local: { games: 0 }, level: 'normal' }

export type GameSummary = {
  mode: 'bot' | 'local'
  level: BotLevel
  /** 이긴 팀 (0 = 파랑·나, 1 = 빨강·봇) */
  winner: 0 | 1 | 'draw'
  /** 팀마다 남은 동물 수 */
  left: [number, number]
  turns: number
}

export function addGame(r: IslandRecord, s: GameSummary): IslandRecord {
  if (s.mode === 'local') return { ...r, local: { games: r.local.games + 1 } }
  const t = r.bot[s.level]
  return {
    ...r,
    bot: { ...r.bot, [s.level]: { games: t.games + 1, wins: t.wins + (s.winner === 0 ? 1 : 0), draws: t.draws + (s.winner === 'draw' ? 1 : 0) } },
  }
}

export function loadRecord(store: RecordStore = localRecordStore): IslandRecord {
  const r = store.load(GAME_ID, EMPTY_RECORD)
  return { ...EMPTY_RECORD, ...r, bot: { ...EMPTY_RECORD.bot, ...r.bot } }
}

export function saveRecord(record: IslandRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
