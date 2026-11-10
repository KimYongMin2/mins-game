import { describe, expect, it } from 'vitest'
import { homeMove } from './HomeLink'
import { readyCount } from './Ready'

describe('친구 대전 준비', () => {
  it('친구가 없으면(봇만) 바로 시작할 수 있다', () => {
    expect(readyCount([])).toEqual({ all: true, ready: 0, total: 0 })
    expect(readyCount([{ role: 'host' }])).toEqual({ all: true, ready: 0, total: 0 })
  })
  it('친구가 모두 준비해야 시작 (방장은 준비 없음)', () => {
    const members = [{ role: 'host' as const }, { role: 'guest' as const, ready: true }, { role: 'guest' as const }]
    expect(readyCount(members)).toEqual({ all: false, ready: 1, total: 2 })
    expect(readyCount(members.map((m) => ({ ...m, ready: true }))).all).toBe(true)
  })
})

describe('게임 → 메인으로', () => {
  it('메인에서 들어온 그 게임이면 기록을 되돌아간다 (백키로 다시 게임에 안 가게)', () => {
    expect(homeMove('/games/fight', '/games/fight', 3)).toBe('back')
  })
  it('주소로 바로 들어왔거나 다른 게임이면 메인으로 바꾼다', () => {
    expect(homeMove(null, '/games/fight', 3)).toBe('replace')
    expect(homeMove('/games/bomb', '/games/fight', 3)).toBe('replace')
    expect(homeMove('/games/fight', '/games/fight', 1)).toBe('replace')
  })
})
