import { describe, expect, it } from 'vitest'
import { parsePvpEntry, pvpLink } from './nav'

const parse = (link: string) => parsePvpEntry(new URL(link, 'http://x').searchParams)

describe('메인 → 게임 바로 들어가기 주소', () => {
  it('친구 대전 표시가 없으면 아무것도 안 함', () => {
    expect(parse('/games/bomb')).toBeNull()
    expect(parse('/games/bomb?mode=bot')).toBeNull()
  })
  it('표시만 있으면 방 목록', () => {
    expect(parse('/games/bomb?mode=pvp')).toEqual({ kind: 'list' })
  })
  it('방 만들기·들어가기는 만든 주소 그대로 읽힌다 (한글 이름·비공개 코드 포함)', () => {
    const create = { kind: 'create', name: '민수님의 방', pin: '0420' } as const
    expect(parse(pvpLink('/games/yut', create))).toEqual(create)
    const join = { kind: 'join', room: { id: 'AB12', name: '폭탄 한 판' }, pin: null } as const
    expect(parse(pvpLink('/games/bomb', join))).toEqual(join)
  })
  it('게임 바꾸기: 정해 둔 방 번호로 만들기 (친구들이 같은 번호로 따라옴)', () => {
    const create = { kind: 'create', name: '민수님의 방', pin: null, id: 'K7Q2' } as const
    expect(parse(pvpLink('/games/nunchi', create))).toEqual(create)
    expect(parse('/g?mode=pvp&create=1&name=a&id=bad!')).toEqual({ kind: 'create', name: 'a', pin: null })
  })
  it('이상한 값은 걸러 낸다', () => {
    expect(parse('/g?mode=pvp&create=1&pin=12345')).toEqual({ kind: 'create', name: '방', pin: null })
    const long = parse(`/g?mode=pvp&join=${'X'.repeat(40)}&name=${'가'.repeat(40)}`)
    expect(long).toMatchObject({ kind: 'join' })
    if (long?.kind === 'join') {
      expect(long.room.id.length).toBe(16)
      expect(long.room.name.length).toBe(20)
    }
  })
})
