import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, makeRoomCode, normalizeCode, othersIn } from './room'

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

describe('othersIn', () => {
  it('나를 뺀 사람들 (한 사람이 여러 번 잡혀도 한 번만)', () => {
    const state = {
      'host-a': [{ role: 'host' as const, nickname: '민' }],
      'guest-b': [
        { role: 'guest' as const, nickname: '철수' },
        { role: 'guest' as const, nickname: '철수' },
      ],
    }
    expect(othersIn(state, 'host-a')).toEqual([{ role: 'guest', nickname: '철수' }])
    expect(othersIn(state, 'guest-b')).toEqual([{ role: 'host', nickname: '민' }])
  })
})
