import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { BotLevel } from './bot/islandBot'
import type { Team } from './play/world'

const GAME_ID = 'island'

export type Tally = { games: number; wins: number; draws: number }

/** 봇 연습은 난이도별 승·무, 친구 대전은 판 수·승, 한 기기 둘이서는 판 수만 */
export type IslandRecord = { bot: Record<BotLevel, Tally>; pvp: Tally; local: { games: number }; level: BotLevel }

const EMPTY_TALLY: Tally = { games: 0, wins: 0, draws: 0 }
export const EMPTY_RECORD: IslandRecord = { bot: { normal: EMPTY_TALLY, hard: EMPTY_TALLY }, pvp: EMPTY_TALLY, local: { games: 0 }, level: 'normal' }

export type GameSummary = {
  mode: 'bot' | 'local' | 'pvp'
  level: BotLevel
  /** 이긴 팀 (0 = 파랑, 1 = 빨강) */
  winner: Team | 'draw'
  /** 내 팀 (봇 연습은 파랑, 둘이서는 의미 없음) */
  myTeam: Team
  /** 팀마다 남은 동물 수 */
  left: [number, number]
  turns: number
  /** 팀 이름 (친구 대전은 사람 이름) */
  names: [string, string]
}

const tally = (t: Tally, s: GameSummary): Tally => ({ games: t.games + 1, wins: t.wins + (s.winner === s.myTeam ? 1 : 0), draws: t.draws + (s.winner === 'draw' ? 1 : 0) })

export function addGame(r: IslandRecord, s: GameSummary): IslandRecord {
  if (s.mode === 'local') return { ...r, local: { games: r.local.games + 1 } }
  if (s.mode === 'pvp') return { ...r, pvp: tally(r.pvp, s) }
  return { ...r, bot: { ...r.bot, [s.level]: tally(r.bot[s.level], s) } }
}

export function loadRecord(store: RecordStore = localRecordStore): IslandRecord {
  const r = store.load(GAME_ID, EMPTY_RECORD)
  return { ...EMPTY_RECORD, ...r, bot: { ...EMPTY_RECORD.bot, ...r.bot }, pvp: { ...EMPTY_TALLY, ...r.pvp } }
}

export function saveRecord(record: IslandRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
