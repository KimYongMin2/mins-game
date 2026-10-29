import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { BotLevel } from './bot/volleyBot'

const GAME_ID = 'volley'

/** 승패와 연승 (무승부 없음) */
export type Tally = { wins: number; losses: number; streak: number; bestStreak: number }

export const LEVEL_LABEL: Record<BotLevel, string> = { normal: '일반', hard: '어려움' }

export const tallyText = (t: Tally) => `${t.wins}승 ${t.losses}패 · 최다 ${t.bestStreak}연승`

const EMPTY_TALLY: Tally = { wins: 0, losses: 0, streak: 0, bestStreak: 0 }

export type VolleyRecord = {
  /** 봇 대전 난이도별 */
  bot: Record<BotLevel, Tally>
  /** 친구 대전 (봇전과 따로) */
  pvp: Tally
  /** 마지막으로 고른 난이도 */
  level: BotLevel
}

export const EMPTY_RECORD: VolleyRecord = { bot: { normal: EMPTY_TALLY, hard: EMPTY_TALLY }, pvp: EMPTY_TALLY, level: 'normal' }

export type GameSummary = {
  mode: 'bot' | 'pvp'
  level: BotLevel
  won: boolean
  /** 내 점수, 상대 점수 */
  score: [number, number]
  /** 내 스파이크, 상대 스파이크 */
  spikes: [number, number]
  foeName: string
}

function tally(t: Tally, won: boolean): Tally {
  const streak = won ? t.streak + 1 : 0
  return { wins: t.wins + (won ? 1 : 0), losses: t.losses + (won ? 0 : 1), streak, bestStreak: Math.max(t.bestStreak, streak) }
}

export function addGame(record: VolleyRecord, s: GameSummary): VolleyRecord {
  if (s.mode === 'pvp') return { ...record, pvp: tally(record.pvp, s.won) }
  return { ...record, bot: { ...record.bot, [s.level]: tally(record.bot[s.level], s.won) } }
}

export function loadRecord(store: RecordStore = localRecordStore): VolleyRecord {
  const r = store.load(GAME_ID, EMPTY_RECORD)
  return { ...EMPTY_RECORD, ...r, bot: { ...EMPTY_RECORD.bot, ...r.bot } }
}

export function saveRecord(record: VolleyRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
