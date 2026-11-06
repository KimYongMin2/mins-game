import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, aheadOf, makeRoomCode, normalizeCode, othersIn, readListedRoom } from './room'
import { MAX_LISTED, cleanList } from './roomList'

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

describe('방 목록 검사 (누구나 올릴 수 있어서)', () => {
  const ok = { id: 'AB3K', name: '민님의 방', locked: false, count: 1, capacity: 2, playing: false, at: 1 }

  it('맞는 방은 그대로', () => {
    expect(cleanList([ok], readListedRoom)).toEqual([ok])
  })

  it('이상한 건 버리고, 이름은 20자로 자르고 제어 문자는 지운다', () => {
    const list = cleanList(
      [null, 'x', { ...ok, id: 'ab<script>' }, { ...ok, id: 'C1', name: 5 }, { ...ok, id: 'D2D2', capacity: 999 }, { ...ok, id: 'E5E5', name: '\u0007' + '가'.repeat(50) }],
      readListedRoom,
    )
    expect(list.map((r) => r.id)).toEqual(['E5E5'])
    expect(list[0].name).toBe('가'.repeat(20))
  })

  it('같은 번호는 하나만, 너무 많으면 앞에서부터 MAX_LISTED개', () => {
    expect(cleanList([ok, { ...ok, name: '가짜' }], readListedRoom)).toHaveLength(1)
    const many = Array.from({ length: 100 }, (_, i) => ({ ...ok, id: `R${String(i).padStart(3, '0')}` }))
    expect(cleanList(many, readListedRoom)).toHaveLength(MAX_LISTED)
  })
})
