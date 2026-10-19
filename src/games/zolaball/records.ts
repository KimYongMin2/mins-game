import { type RecordStore, localRecordStore } from '../../shared/storage/records'
import type { MatchSummary } from './match/matchState'
import type { Difficulty } from './rules/judge'

const GAME_ID = 'zolaball'

export type WinLossDraw = { wins: number; losses: number; draws: number }

/** 졸라볼 통산 전적 */
export type ZolaballRecord = Record<Difficulty, WinLossDraw> & {
  homeruns: number
  atBats: number
  hits: number
  rbi: number
  outsPitched: number
  runsAllowed: number
}

export const EMPTY_RECORD: ZolaballRecord = {
  normal: { wins: 0, losses: 0, draws: 0 },
  hard: { wins: 0, losses: 0, draws: 0 },
  homeruns: 0,
  atBats: 0,
  hits: 0,
  rbi: 0,
  outsPitched: 0,
  runsAllowed: 0,
}

export function addMatch(record: ZolaballRecord, summary: MatchSummary): ZolaballRecord {
  const { difficulty } = summary.config
  const wld = { ...record[difficulty] }
  if (summary.outcome === 'win') wld.wins++
  else if (summary.outcome === 'lose') wld.losses++
  else wld.draws++
  return {
    ...record,
    [difficulty]: wld,
    homeruns: record.homeruns + summary.userStats.homeruns,
    atBats: record.atBats + summary.userStats.atBats,
    hits: record.hits + summary.userStats.hits,
    rbi: record.rbi + summary.userStats.rbi,
    outsPitched: record.outsPitched + summary.userPitching.outs,
    runsAllowed: record.runsAllowed + summary.userPitching.runsAllowed,
  }
}

/** 야구식 타율 표기 (.333). 타수가 없으면 '-' */
export function formatAverage(hits: number, atBats: number): string {
  if (atBats === 0) return '-'
  const avg = (hits / atBats).toFixed(3)
  return avg.startsWith('0') ? avg.slice(1) : avg
}

/** 평균자책점: 3이닝(한 경기)당 실점. 던진 아웃이 없으면 '-' */
export function era(runsAllowed: number, outs: number): number | null {
  if (outs === 0) return null
  return (runsAllowed / outs) * 9
}

export function formatEra(runsAllowed: number, outs: number): string {
  const value = era(runsAllowed, outs)
  return value === null ? '-' : value.toFixed(2)
}

/** 투구 이닝 표기: 7아웃 → '2⅓' */
export function formatInnings(outs: number): string {
  const whole = Math.floor(outs / 3)
  const rest = ['', '⅓', '⅔'][outs % 3]
  return whole === 0 && rest ? rest : `${whole}${rest}`
}

export function loadRecord(store: RecordStore = localRecordStore): ZolaballRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: ZolaballRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}
