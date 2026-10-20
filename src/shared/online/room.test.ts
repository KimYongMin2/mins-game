import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, aheadOf, makeRoomCode, normalizeCode, othersIn } from './room'

describe('방 코드', () => {
  it(`${CODE_LENGTH}자리, 헷갈리는 글자(0 O 1 I L) 없음`, () => {
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(code).not.toMatch(/[0O1IL]/)
    }
  })

  it('입력은 소문자·공백을 허용하고, 틀린 형식은 거부', () => {
    expect(normalizeCode(' 7k3p ')).toBe('7K3P')
    expect(normalizeCode('7K 3P')).toBe('7K3P')
    expect(normalizeCode('7K3')).toBeNull()
    expect(normalizeCode('7K3O')).toBeNull()
  })
})

const host = { role: 'host' as const, nickname: '민', joinedAt: 100 }
const guest = (nickname: string, joinedAt: number) => ({ role: 'guest' as const, nickname, joinedAt })

describe('othersIn', () => {
  it('나를 뺀 사람들 (한 사람이 여러 번 잡혀도 한 번만)', () => {
    const state = { 'host-a': [host], 'guest-b': [guest('철수', 200), guest('철수', 200)] }
    expect(othersIn(state, 'host-a')).toEqual([{ ...guest('철수', 200), key: 'guest-b' }])
    expect(othersIn(state, 'guest-b')).toEqual([{ ...host, key: 'host-a' }])
  })

  it('방장이 맨 앞, 그다음 먼저 들어온 순서', () => {
    const state = { 'guest-z': [guest('늦게', 300)], 'guest-y': [guest('먼저', 200)], 'host-a': [host] }
    expect(othersIn(state, 'me').map((o) => o.nickname)).toEqual(['민', '먼저', '늦게'])
  })
})

describe('aheadOf (정원 확인)', () => {
  it('나보다 먼저 온 사람만 센다. 같은 시각이면 접속 번호로', () => {
    const state = { 'host-a': [host], 'guest-b': [guest('철수', 200)], 'guest-d': [guest('영희', 300)] }
    const me = guest('나', 200)
    const others = othersIn(state, 'guest-c')
    expect(aheadOf(others, me, 'guest-c').map((o) => o.nickname)).toEqual(['민', '철수'])
  })
})
