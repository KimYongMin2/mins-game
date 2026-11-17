import { describe, expect, it } from 'vitest'
import { CHAT_KEEP, CHAT_MAX, cleanChat, diffMembers, pushLine, readChat, readDeaf, readGame } from './chat'

describe('회의방 채팅', () => {
  it('글자를 다듬고 빈 글은 버린다', () => {
    expect(cleanChat('  안녕\n하세요  ')).toBe('안녕 하세요')
    expect(cleanChat('   ')).toBeNull()
    expect(cleanChat(3)).toBeNull()
    expect(cleanChat('a‮b')).toBe('a b')
    expect(cleanChat('가'.repeat(CHAT_MAX + 50))).toHaveLength(CHAT_MAX)
  })

  it('채팅 메시지만 읽는다', () => {
    expect(readChat({ t: 'chat', from: '1', text: 'hi' })).toBe('hi')
    expect(readChat({ t: 'mic', from: '1', on: true })).toBeNull()
    expect(readChat({ t: 'chat', text: { x: 1 } })).toBeNull()
    expect(readChat(null)).toBeNull()
  })

  it('오래된 줄은 버린다', () => {
    let lines = [] as Parameters<typeof pushLine>[0]
    for (let i = 0; i < CHAT_KEEP + 5; i++) lines = pushLine(lines, { key: i, kind: 'chat', name: 'a', text: String(i), at: 0 })
    expect(lines).toHaveLength(CHAT_KEEP)
    expect(lines[0].key).toBe(5)
  })

  it('들어온 사람·나간 사람을 찾는다', () => {
    const { joined, left } = diffMembers([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])
    expect(joined.map((m) => m.id)).toEqual(['c'])
    expect(left.map((m) => m.id)).toEqual(['a'])
  })

  it('게임 초대는 우리 게임·방 모양만', () => {
    const games = { '/games/bomb': '폭탄 돌리기' }
    expect(readGame({ t: 'game', from: '1', path: '/games/bomb', id: 'AB12CD', name: '우리방', pin: '1234' }, games)).toEqual({
      path: '/games/bomb',
      title: '폭탄 돌리기',
      id: 'AB12CD',
      name: '우리방',
      pin: '1234',
    })
    expect(readGame({ t: 'game', path: 'https://evil.example', id: 'AB12CD' }, games)).toBeNull()
    expect(readGame({ t: 'game', path: '/games/bomb', id: 'ab;12' }, games)).toBeNull()
    expect(readGame({ t: 'game', path: '/games/bomb', id: 'AB12', pin: 'x' }, games)?.pin).toBeNull()
  })

  it('듣기 끔 신호', () => {
    expect(readDeaf({ t: 'deaf', from: '1', on: true })).toBe(true)
    expect(readDeaf({ t: 'deaf', on: 'yes' })).toBeNull()
  })
})
