import { beforeEach, describe, expect, it } from 'vitest'
import type { BagItem, ServerMsg } from '../../games/fishing/play/protocol'
import { shoreZ } from '../../games/fishing/play/map'
import { resetStore } from '../fishingStore'
import { addToBag, fishingReferee } from './fishing'

function setup() {
  let now = 1000
  const got: { to: string; m: ServerMsg }[] = []
  const members = [
    { id: 'a', role: 'host' as const, nickname: '곰', uid: 'u-a' },
    { id: 'b', role: 'guest' as const, nickname: '토끼', uid: 'u-b' },
  ]
  const ref = fishingReferee(null, {
    now: () => now,
    members: () => members,
    broadcast: (m) => got.push({ to: '*', m: m as ServerMsg }),
    sendTo: (to, m) => got.push({ to, m: m as ServerMsg }),
  })
  const flushAsync = () => new Promise((r) => setTimeout(r, 0))
  return { ref, got, tick: (ms: number) => ((now += ms), ref.tick(now)), at: () => now, flushAsync, last: <T extends ServerMsg['t']>(t: T) => [...got].reverse().find((g) => g.m.t === t)?.m as Extract<ServerMsg, { t: T }> | undefined }
}

describe('낚시터 심판', () => {
  beforeEach(() => resetStore())

  it('들어오면 모두에게 알리고 지금 사람들을 받음', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    expect(s.last('init')?.you).toBe('a')
    s.ref.input('b', { t: 'hi' })
    expect(s.last('init')?.players.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  it('물에는 못 들어가고, 너무 빨리 가면 갈 수 있는 만큼만', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.tick(1000)
    // 바다 쪽으로 계속 가려고 해도 물가에서 멈춤
    for (let i = 0; i < 10; i++) {
      s.tick(1000)
      s.ref.input('a', { t: 'mv', x: 0, z: -12, r: 0 })
    }
    s.tick(100)
    const z = s.last('pos')!.l[0][2]
    expect(z).toBeGreaterThanOrEqual(shoreZ(0))
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: 25, z: 10, r: 0 })
    s.tick(100)
    const [, x] = s.last('pos')!.l[0]
    expect(x).toBeLessThan(15)
  })

  it('물가에서 던지면 7~16초 뒤 입질, 5초 안에 당기면 잡힘 (도감·가방에 들어감)', async () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    // 물가로 걸어감
    let z = 5
    while (z > shoreZ(0) + 1) {
      s.tick(200)
      z -= 0.9
      s.ref.input('a', { t: 'mv', x: 0, z, r: Math.PI })
    }
    s.ref.input('a', { t: 'cast' })
    expect(s.last('st')?.p.fishing).toBe('cast')
    for (let i = 0; i < 170 && !s.last('bite'); i++) s.tick(100)
    expect(s.last('bite')?.id).toBe('a')
    s.ref.input('a', { t: 'reel' })
    await s.flushAsync()
    const c = s.last('catch')
    expect(c?.id).toBe('a')
    const prof = s.last('profile')!.profile
    expect(prof.bag).toHaveLength(1)
  })

  it('입질 뒤 5초가 지나면 도망', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    let z = 5
    while (z > shoreZ(0) + 1) {
      s.tick(200)
      z -= 0.9
      s.ref.input('a', { t: 'mv', x: 0, z, r: Math.PI })
    }
    s.ref.input('a', { t: 'cast' })
    for (let i = 0; i < 170 && !s.last('bite'); i++) s.tick(100)
    s.tick(5100)
    expect(s.last('escape')?.id).toBe('a')
    expect(s.last('st')?.p.fishing).toBe('none')
  })

  it('물가가 아니면 못 던짐, 나가면 사라짐', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('a', { t: 'cast' })
    expect(s.last('st')?.p.fishing).toBe('none')
    s.ref.leave('a')
    expect(s.last('gone')?.id).toBe('a')
  })

  it('가방이 차면 자랑할 만한 것은 남기고 흔한 것부터 버림', () => {
    let bag: BagItem[] = [{ k: 'gold', f: 'crucian', i: 'gold', s: 20, at: 0 }]
    for (let i = 0; i < 200; i++) bag = addToBag(bag, { k: `c${i}`, f: 'crucian', i: null, s: 20, at: i })
    expect(bag.length).toBe(150)
    expect(bag.some((x) => x.k === 'gold')).toBe(true)
  })

  it('뿅망치: 바라보는 쪽 가까운 사람이 맞고, 너무 자주는 못 휘두름', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('b', { t: 'hi' })
    const init = s.last('init')!.players
    const a = init.find((p) => p.id === 'a')!, b = init.find((p) => p.id === 'b')!
    // a를 b 바로 앞으로 옮기고 b 쪽을 보게
    const r = Math.atan2(b.x - a.x, b.z - a.z)
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x - Math.sin(r) * 1, z: b.z - Math.cos(r) * 1, r })
    s.ref.input('a', { t: 'bonk' })
    expect(s.last('bonk')).toEqual({ t: 'bonk', id: 'a', to: 'b' })
    const n = s.got.filter((g) => g.m.t === 'bonk').length
    s.ref.input('a', { t: 'bonk' })
    expect(s.got.filter((g) => g.m.t === 'bonk').length).toBe(n)
    s.tick(800)
    s.ref.input('a', { t: 'mv', x: b.x - Math.sin(r) * 1, z: b.z - Math.cos(r) * 1, r: r + Math.PI })
    s.ref.input('a', { t: 'bonk' })
    expect(s.last('bonk')?.to).toBeNull()
  })
})
