import { type RecordStore, localRecordStore } from '../../shared/storage/records'

const GAME_ID = 'spotdiff'

/** 혼자 하기: 판 수·최고 점수·찾은 곳 / 친구 대전: 판 수·우승·가장 빠른 총 시간(ms, 없으면 0) */
export type SpotRecord = { solo: { games: number; best: number; found: number }; pvp: { games: number; wins: number; fastest: number } }

export const EMPTY_RECORD: SpotRecord = { solo: { games: 0, best: 0, found: 0 }, pvp: { games: 0, wins: 0, fastest: 0 } }

export type GameSummary = {
  mode: 'solo' | 'pvp'
  rank: number
  score: number
  /** 총 걸린 시간 (벌칙 포함) */
  ms: number
  found: number
  /** 찾아야 했던 곳 수 */
  total: number
  ranking: { name: string; ms: number; rank: number; me: boolean; left: boolean }[]
}

export function addGame(r: SpotRecord, s: GameSummary): SpotRecord {
  if (s.mode === 'solo') return { ...r, solo: { games: r.solo.games + 1, best: Math.max(r.solo.best, s.score), found: r.solo.found + s.found } }
  return { ...r, pvp: { games: r.pvp.games + 1, wins: r.pvp.wins + (s.rank === 1 ? 1 : 0), fastest: r.pvp.fastest ? Math.min(r.pvp.fastest, s.ms) : s.ms } }
}

export function loadRecord(store: RecordStore = localRecordStore): SpotRecord {
  return store.load(GAME_ID, EMPTY_RECORD)
}

export function saveRecord(record: SpotRecord, store: RecordStore = localRecordStore): void {
  store.save(GAME_ID, record)
}

/** 1분 23.4초 */
export function formatMs(ms: number): string {
  const t = Math.max(0, Math.round(ms / 100)) / 10
  const m = Math.floor(t / 60)
  const sec = (t - m * 60).toFixed(1)
  return m ? `${m}분 ${sec}초` : `${sec}초`
}
