import { describe, expect, it } from 'vitest'
import type { ServerMsg } from '../shared/online/hubProtocol'
import { Hub } from './hub'

/** 가짜 접속: 서버가 보낸 걸 모아 둔다 */
function client(hub: Hub, ip = '') {
  const got: ServerMsg[] = []
  let closed = false
  const c = hub.open({ send: (t) => got.push(JSON.parse(t)), close: () => void (closed = true) }, ip)
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
    expect(g.got.filter((m) => m.t === 'msg').length - before).toBeLessThan(160)
    now += 1000
    await h.send({ t: 'send', room, msg: 'ok' })
    expect(g.last('msg')?.msg).toBe('ok')
  })
})

describe('서버 심판 자리', () => {
  it('방장만 심판을 세우고, 입력은 심판에게만, 심판 메시지는 from=server', async () => {
    const seen: [string, unknown][] = []
    const hub = new Hub({
      verify,
      tickMs: 5,
      referees: {
        bomb: (_setup, ctx) => {
          ctx.broadcast({ t: 'view', n: 1 })
          return { input: (from, msg) => (seen.push([from, msg]), (msg as { t: string }).t === 'aim'), tick: () => {}, leave: () => {}, finished: () => false }
        },
      },
    })
    const h = client(hub)
    const g = client(hub)
    await h.hello()
    await g.hello()
    await h.send(join('host', 'ABCD'))
    await g.send(join('guest', 'ABCD'))
    const room = h.last('joined')!.room
    await g.send({ t: 'referee', room, game: 'bomb', setup: {} })
    expect(g.last('msg')).toBeUndefined()
    await h.send({ t: 'referee', room, game: 'bomb', setup: {} })
    expect(g.last('msg')).toEqual({ t: 'msg', room, from: 'server', msg: { t: 'view', n: 1 } })
    const before = h.got.length
    await g.send({ t: 'send', room, msg: { t: 'aim' } })
    expect(seen.at(-1)).toEqual([g.last('joined')!.key, { t: 'aim' }])
    expect(h.got.length).toBe(before)
    await g.send({ t: 'send', room, msg: { t: 'other' } })
    expect(h.last('msg')?.msg).toEqual({ t: 'other' })
    await h.send({ t: 'leave', room })
    await g.send({ t: 'leave', room })
  })
})

describe('막기 (2026-11-16)', () => {
  it('틀린 코드를 8번 넣으면 5분 동안은 맞는 코드도 방 없음', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    await h.hello()
    await h.send(join('host', 'SAFE-1234'))
    const g = client(hub)
    await g.hello()
    for (let i = 0; i < 8; i++) await g.send(join('guest', `SAFE-${String(i).padStart(4, '0')}`))
    await g.send(join('guest', 'SAFE-1234'))
    expect(g.last('join-error')?.reason).toBe('not-found')
    expect(g.last('joined')).toBeUndefined()
  })

  it('한 계정은 접속 6개까지', async () => {
    const hub = new Hub({ verify })
    const cs = Array.from({ length: 7 }, () => client(hub))
    for (const c of cs) await c.hello()
    expect(cs.slice(0, 6).every((c) => !c.closed)).toBe(true)
    expect(cs[6].closed).toBe(true)
    cs[0].close()
    const again = client(hub)
    await again.hello()
    expect(again.closed).toBe(false)
  })

  it('15분 아무 일 없으면 하는 중 아님, 3시간이면 서버가 닫음', async () => {
    let now = 0
    const hub = new Hub({ verify, now: () => now })
    const h = client(hub)
    await h.hello()
    await h.send(join('host', 'IDLE'))
    expect(hub.stats().active).toBe(1)
    now += 16 * 60_000
    expect(hub.stats().active).toBe(0)
    now += 3 * 60 * 60_000
    hub.sweep()
    expect(hub.stats().rooms).toBe(0)
  })

  it('회의방 입장권은 그 방에 들어온 사람에게만, 방 이름엔 비공개 코드까지', async () => {
    const made: string[] = []
    const hub = new Hub({ verify, sfuToken: async (room, identity, name) => (made.push(`${room}|${identity}|${name}`), 'TOKEN') })
    const h = client(hub)
    await h.hello()
    await h.send({ ...join('host', 'MEET1-4321'), game: 'meeting' })
    const topic = h.last('joined')!.room
    await h.send({ t: 'sfu', ref: 7, room: topic })
    expect(h.last('sfu')).toEqual({ t: 'sfu', ref: 7, token: 'TOKEN' })
    expect(made[0]).toMatch(/^meeting-MEET1-4321\|host-[a-z0-9]+\.user1\|host$/)
    // 방에 없는 사람은 못 받음
    const x = client(hub)
    await x.hello()
    await x.send({ t: 'sfu', ref: 8, room: topic })
    expect(x.last('sfu')).toEqual({ t: 'sfu', ref: 8, token: null })
    // 게임 방도 줌 (2026-11-18 모든 게임 방에 음성)
    await h.send(join('host', 'GAME1'))
    await h.send({ t: 'sfu', ref: 9, room: h.last('joined')!.room })
    expect(h.last('sfu')?.token).toBe('TOKEN')
  })

  it('방 글자 채팅: 방 사람 모두에게, 보낸 사람·닉네임은 서버가, 너무 빠르면 버림', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    await h.hello()
    await h.send(join('host', 'TALK1'))
    const topic = h.last('joined')!.room
    const g = client(hub, 'user2')
    await g.hello()
    await g.send(join('guest', 'TALK1'))
    await g.send({ t: 'talk', room: topic, text: '  안녕\u0007하세요  ' })
    expect(h.last('talk')).toMatchObject({ t: 'talk', room: topic, from: g.last('joined')!.key, name: 'guest', text: '안녕하세요' })
    expect(g.last('talk')?.text).toBe('안녕하세요')
    await g.send({ t: 'talk', room: topic, text: '또' })
    expect(h.last('talk')?.text).toBe('안녕하세요')
  })

  it('회의방은 방장이 나가면 먼저 온 사람이 방장, 게임 방은 그대로', async () => {
    const hub = new Hub({ verify })
    const h = client(hub)
    const a = client(hub)
    const b = client(hub)
    for (const c of [h, a, b]) await c.hello()
    await h.send({ ...join('host', 'MEET2'), game: 'meeting' })
    await a.send({ ...join('guest', 'MEET2'), game: 'meeting' })
    await b.send({ ...join('guest', 'MEET2'), game: 'meeting' })
    const topic = h.last('joined')!.room
    await h.send({ t: 'leave', room: topic })
    const ms = b.last('members')!.members
    expect(ms.find((m) => m.id === a.last('joined')!.key)?.role).toBe('host')
    // 새 사람도 들어올 수 있음
    const c = client(hub)
    await c.hello()
    await c.send({ ...join('guest', 'MEET2'), game: 'meeting' })
    expect(c.last('joined')).toBeTruthy()
    // 게임 방은 방장이 나가면 방장 없음
    await h.send(join('host', 'GAME2'))
    await a.send(join('guest', 'GAME2'))
    await h.send({ t: 'leave', room: h.last('joined')!.room })
    expect(a.last('members')!.members.every((m) => m.role === 'guest')).toBe(true)
  })

  it('IP별로도 셈: 접속 40개까지, 계정을 바꿔도 틀린 코드 24번이면 막힘', async () => {
    const hub = new Hub({ verify: async (t) => t })
    const h = client(hub, '9.9.9.9')
    await h.send({ t: 'hello', token: 'host-user', apikey: 'k' })
    await h.send(join('host', 'SAFE1-1111'))
    const tries: ReturnType<typeof client>[] = []
    for (let i = 0; i < 12; i++) {
      const c = client(hub, '1.2.3.4')
      await c.send({ t: 'hello', token: `u${i}`, apikey: 'k' })
      await c.send(join('guest', `SAFE1-${String(2000 + i * 2)}`))
      await c.send(join('guest', `SAFE1-${String(2001 + i * 2)}`))
      tries.push(c)
    }
    const last = client(hub, '1.2.3.4')
    await last.send({ t: 'hello', token: 'fresh', apikey: 'k' })
    await last.send(join('guest', 'SAFE1-1111'))
    expect(last.last('join-error')?.reason).toBe('not-found')
    // 다른 IP는 괜찮음
    const other = client(hub, '5.6.7.8')
    await other.send({ t: 'hello', token: 'other', apikey: 'k' })
    await other.send(join('guest', 'SAFE1-1111'))
    expect(other.last('joined')).toBeTruthy()
    // 접속 수
    for (let i = 0; i < 40 - 13; i++) client(hub, '1.2.3.4')
    expect(client(hub, '1.2.3.4').closed).toBe(true)
  })
})
