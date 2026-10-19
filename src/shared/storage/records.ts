import { readLocal, writeLocal } from './local'

/**
 * 게임별 기록 저장소. 지금은 localStorage, 나중에 랭킹을 붙일 때 Supabase 구현으로 바꾼다.
 * 기록의 모양은 각 게임이 정하고, 저장소는 JSON으로만 다룬다.
 */
export interface RecordStore {
  load<T extends object>(gameId: string, fallback: T): T
  save<T extends object>(gameId: string, record: T): void
}

export const localRecordStore: RecordStore = {
  load(gameId, fallback) {
    const raw = readLocal(`records:${gameId}`)
    if (!raw) return fallback
    try {
      const parsed: unknown = JSON.parse(raw)
      // 필드가 추가돼도 예전 기록을 읽을 수 있게 기본값 위에 덮어쓴다.
      return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback
    } catch {
      return fallback
    }
  },
  save(gameId, record) {
    writeLocal(`records:${gameId}`, JSON.stringify(record))
  },
}
