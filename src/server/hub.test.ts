import { describe, expect, it } from 'vitest'
import type { ServerMsg } from '../shared/online/hubProtocol'
import { Hub } from './hub'

/** 가짜 접속: 서버가 보낸 걸 모아 둔다 */
function client(hub: Hub) {
  const got: ServerMsg[] = []
  let closed = false
  const c = hub.open({ send: (t) => got.push(JSON.parse(t)), close: () => void (closed = true) })
  const send = async (m: object) => {
    c.receive(JSON.stringify(m))
    await new Promise((r) => setTimeout(r, 0))
  }
  return {
    got,
    send,
    close: c.close,
    get closed() {
      return closed
    },
    last: <T extends ServerMsg['t']>(t: T) => [...got].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined,
    hello: () => send({ t: 'hello', token: 'ok', apikey: 'k' }),
  }
}

const verify = async (token: string) => (token === 'ok' ? 'user-1' : null)
let ref = 0
const join = (role: 'host' | 'guest', code: string, extra: object = {}) => ({ t: 'join', ref: ++ref, game: 'bomb', code, role, nickname: role, capacity: 3, ...extra })

describe('게임 서버', () => {
  it('로그인 안 하면 아무것도 못 하고, 틀린 토큰은 끊김', async () => {
    const hub = new Hub({ verify })
    const a = client(hub)
    await a.send(join('host', 'ABCD'))
    expect(a.got).toEqual([])
    await a.send({ t: 'hello', token: 'bad', apikey: 'k' })
    expect(a.closed).toBe(true)
  })

  it('비공개 방은 코드가 맞아야, 정원이 차면 못 들어옴', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    await h.hello()
    await h.send(join('host', 'ROOM1-1234'))
    expect(h.last('joined')).toBeTruthy()
    const g = client(hub)
    await g.hello()
    await g.send(join('guest', 'ROOM1-9999'))
    expect(g.last('join-error')?.reason).toBe('not-found')
    await g.send(join('guest', 'ROOM1'))
    expect(g.last('join-error')?.reason).toBe('not-found')
    await g.send(join('guest', 'ROOM1-1234'))
    expect(g.last('joined')).toBeTruthy()
    const g2 = client(hub)
    await g2.hello()
    await g2.send(join('guest', 'ROOM1-1234'))
    const g3 = client(hub)
    await g3.hello()
    await g3.send(join('guest', 'ROOM1-1234'))
    expect(g3.last('join-error')?.reason).toBe('full')
  })

  it('메시지엔 서버가 보낸 사람을 붙이고, 게임 바꾸기는 방장만', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    const g = client(hub)
    await h.hello()
    await g.hello()
    await h.send(join('host', 'ABCD'))
    await g.send(join('guest', 'ABCD'))
    const room = h.last('joined')!.room
    const hostKey = h.last('joined')!.key
    await h.send({ t: 'send', room, msg: { from: 'guest-가짜', x: 1 } })
    expect(g.last('msg')).toEqual({ t: 'msg', room, from: hostKey, msg: { from: 'guest-가짜', x: 1 } })
    await g.send({ t: 'move', room, move: { path: '/games/omok' } })
    expect(h.last('move')).toBeUndefined()
    await h.send({ t: 'move', room, move: { path: '/games/omok' } })
    expect(g.last('move')?.from).toBe(hostKey)
  })

  it('방 목록은 그 방 방장만 올리고, 방장이 나가면 내려감', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    const w = client(hub)
    const faker = client(hub)
    await h.hello()
    await w.hello()
    await faker.hello()
    await w.send({ t: 'watch', list: 'game-bomb' })
    await faker.send({ t: 'advertise', list: 'game-bomb', info: { id: 'ABCD', name: '가짜' } })
    expect(w.last('rooms')?.rooms).toEqual([])
    await h.send(join('host', 'ABCD'))
    await h.send({ t: 'advertise', list: 'game-bomb', info: { id: 'ABCD', name: '진짜' } })
    expect(w.last('rooms')?.rooms).toEqual([{ id: 'ABCD', name: '진짜' }])
    await h.send({ t: 'leave', room: h.last('joined')!.room })
    expect(w.last('rooms')?.rooms).toEqual([])
  })

  it('끊겨도 잠깐은 자리를 들고 있다가 다시 붙으면 같은 번호, 안 오면 빠짐', async () => {
    const hub = new Hub({ verify, graceMs: 30 })
    const h = client(hub)
    const g = client(hub)
    await h.hello()
    await g.hello()
    await h.send(join('host', 'ABCD'))
    await g.send(join('guest', 'ABCD'))
    const { key, resume } = g.last('joined')!
    g.close()
    expect(h.last('members')?.members.length).toBe(2)
    const g2 = client(hub)
    await g2.hello()
    await g2.send(join('guest', 'ABCD', { resume }))
    expect(g2.last('joined')?.key).toBe(key)
    g2.close()
    await new Promise((r) => setTimeout(r, 60))
    expect(h.last('members')?.members.map((m) => m.role)).toEqual(['host'])
  })

  it('너무 많이 보내면 버림', async () => {
    let now = 0
    const hub = new Hub({ verify, now: () => now })
    const h = client(hub)
    const g = client(hub)
    await h.hello()
    await g.hello()
    await h.send(join('host', 'ABCD'))
    await g.send(join('guest', 'ABCD'))
    const room = h.last('joined')!.room
    const before = g.got.filter((m) => m.t === 'msg').length
    for (let i = 0; i < 300; i++) await h.send({ t: 'send', room, msg: i })
    expect(g.got.filter((m) => m.t === 'msg').length - before).toBeLessThan(90)
    now += 1000
    await h.send({ t: 'send', room, msg: 'ok' })
    expect(g.last('msg')?.msg).toBe('ok')
  })
})
