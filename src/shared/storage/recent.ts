import { readLocal, writeLocal } from './local'

// 최근에 들어간 게임 (메인 화면 '최근에 한 게임' 줄). 게임 id만, 최근 것이 앞, 최대 4개.

const KEY = 'recent-games'
const MAX = 4

export function loadRecent(): string[] {
  try {
    const list = JSON.parse(readLocal(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushRecent(id: string): void {
  writeLocal(KEY, JSON.stringify([id, ...loadRecent().filter((x) => x !== id)].slice(0, MAX)))
}
