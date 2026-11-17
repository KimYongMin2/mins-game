import { describe, expect, it } from 'vitest'
import { CHAT_KEEP, CHAT_MAX, cleanChat, diffMembers, pushLine, readChat } from './chat'

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
})
