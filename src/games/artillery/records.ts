import type { TeamOutcome } from '../../shared/team/teams'
import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { BotLevel } from './bot/artilleryBot'

const GAME_ID = 'artillery'

/** 판 수, 우승 횟수, 쓰러뜨린 수 */
export type Tally = { games: number; wins: number; kills: number }

export type ArtilleryRecord = {
  /** 봇 연습 (난이도별) */
  bot: Record<BotLevel, Tally>
  /** 친구 대전 (봇 연습과 따로) */
  pvp: Tally
  /** 시작 화면에서 마지막으로 고른 봇 수·난이도 */
  bots: number
  level: BotLevel
}

const EMPTY_TALLY: Tally = { games: 0, wins: 0, kills: 0 }

export const EMPTY_RECORD: ArtilleryRecord = { bot: { normal: EMPTY_TALLY, hard: EMPTY_TALLY }, pvp: EMPTY_TALLY, bots: 1, level: 'normal' }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  level?: BotLevel
  /** 1등 = 1 */
  rank: number
  kills: number
  ranking: { name: string; rank: number; kills: number; me: boolean }[]
  /** 팀전이면 팀 결과 (rank는 이기면 1, 지면 2) */
  team?: TeamOutcome
}

const add = (t: Tally, s: GameSummary): Tally => ({ games: t.games + 1, wins: t.wins + (s.rank === 1 ? 1 : 0), kills: t.kills + s.kills })

export function addGame(record: ArtilleryRecord, summary: GameSummary): ArtilleryRecord {
  if (summary.mode === 'pvp') return { ...record, pvp: add(record.pvp, summary) }
  const level = summary.level ?? 'normal'
  return { ...record, bot: { ...record.bot, [level]: add(record.bot[level], summary) } }
}

export function loadRecord(store: RecordStore = localRecordStore): ArtilleryRecord {
  const r = store.load(GAME_ID, EMPTY_RECORD)
  return { ...EMPTY_RECORD, ...r, bot: { ...EMPTY_RECORD.bot, ...r.bot } }
}

export function saveRecord(record: ArtilleryRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
