import { beforeEach, describe, expect, it } from 'vitest'
import type { BagItem, ServerMsg } from '../../games/fishing/play/protocol'
import { BOAT_SLOTS, BOATS, BUILD_MS, KAYAKS, CASTLES, CRATES, CRATE_RESPAWN_MS, LADDERS, SEATS, shoreZ } from '../../games/fishing/play/map'
import { resetStore } from '../fishingStore'
import { BUGS, rollBug } from '../../games/fishing/play/bugs'
import { IRO, RARITY } from '../../games/fishing/play/fish'
import { addToBag, fishingReferee } from './fishing'

function setup(extra: string[] = []) {
  let now = 1000
  const got: { to: string; m: ServerMsg }[] = []
  const members = [
    { id: 'a', role: 'host' as const, nickname: '곰', uid: 'u-a' },
    { id: 'b', role: 'guest' as const, nickname: '토끼', uid: 'u-b' },
    ...extra.map((id) => ({ id, role: 'guest' as const, nickname: id, uid: `u-${id}` })),
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

  /** 서버가 아는 내 자리로 순간 이동 (시험용: 아주 오래 기다린 뒤 한 걸음씩) */
  function walkTo(s: ReturnType<typeof setup>, id: string, x: number, z: number) {
    for (let i = 0; i < 400; i++) {
      s.tick(2000)
      s.ref.input(id, { t: 'mv', x, z, r: 0 })
    }
  }

  it('배: 가까이 가서 타면 물 위로 다니고, 땅으로는 못 가고, 물가에서 내림', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    const b = BOATS[0]
    // 선착장 위 배 옆으로
    walkTo(s, 'a', 7.2, 2)
    walkTo(s, 'a', 8.2, b.z)
    s.ref.input('a', { t: 'board', i: 0 })
    expect(s.last('st')?.p.ride).toBe(0)
    expect(s.last('boats')?.l[0][3]).toBe('a')
    // 바다 쪽으로 저어 감
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x, z: b.z - 10, r: 0 })
    s.tick(100)
    expect(s.last('pos')!.l[0][2]).toBeCloseTo(b.z - 10)
    // 판자(선착장) 위로는 못 감
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: 7.2, z: -18, r: 0 })
    expect(s.last('st')?.p.z).toBeCloseTo(b.z - 10)
    // 바다 한가운데선 못 내림
    s.ref.input('a', { t: 'unboard' })
    expect(s.last('st')?.p.ride).toBe(0)
    // 다른 사람은 탄 배에 못 탐
    s.ref.input('b', { t: 'hi' })
    s.ref.input('b', { t: 'board', i: 0 })
    expect(s.last('st')?.p.ride).toBeNull()
    // 배에서 던지면 낚시가 되고, 조금 밀려도 안 끊김
    s.ref.input('a', { t: 'cast' })
    expect(s.last('st')?.p.fishing).toBe('cast')
    s.tick(500)
    s.ref.input('a', { t: 'mv', x: b.x + 0.6, z: b.z - 10, r: 0 })
    expect(s.last('st')?.p.fishing).toBe('cast')
    // 멀리 저어 가면 거둠
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x + 6, z: b.z - 10, r: 0 })
    expect(s.last('st')?.p.fishing).toBe('none')
    // 선착장 옆으로 돌아와 내림
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x, z: b.z, r: 0 })
    s.ref.input('a', { t: 'unboard' })
    const st = s.last('st')!.p
    expect(st.ride).toBeNull()
    expect(s.last('boats')?.l[0][3]).toBeNull()
  })

  it('카약: 한 명만 탐', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('b', { t: 'hi' })
    const i = BOAT_SLOTS.findIndex((b) => b.kayak)
    const k = KAYAKS[0]
    // 물가에서 카약 옆으로
    walkTo(s, 'a', k.x, k.z + 2.9)
    walkTo(s, 'b', k.x + 0.6, k.z + 2.9)
    s.ref.input('a', { t: 'board', i })
    expect(s.last('st')?.p).toMatchObject({ id: 'a', ride: i })
    s.ref.input('b', { t: 'board', i })
    expect(s.last('boats')!.l[i][4]).toBeNull()
    expect(s.last('st')?.p).toMatchObject({ id: 'b', ride: null })
  })

  it('배 두 명: 둘째는 같이 타서 배를 따라가고, 젓던 사람이 내리면 이어서 저음', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('b', { t: 'hi' })
    const b = BOATS[0]
    for (const id of ['a', 'b']) {
      walkTo(s, id, 7.2, 2)
      walkTo(s, id, 8.2, b.z)
    }
    s.ref.input('a', { t: 'board', i: 0 })
    s.ref.input('b', { t: 'board', i: 0 })
    expect(s.last('boats')?.l[0].slice(3, 5)).toEqual(['a', 'b'])
    // 셋째 자리는 없음 (빈 배가 아니면 못 탐): 같이 탄 사람은 배를 못 움직임
    s.tick(1000)
    s.ref.input('b', { t: 'mv', x: b.x, z: b.z - 5, r: 0 })
    s.tick(100)
    expect(s.last('pos')).toBeUndefined
    // 젓는 사람이 움직이면 같이 탄 사람도 따라감
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x, z: b.z - 3, r: 0 })
    s.tick(100)
    const pos = new Map(s.last('pos')!.l.map(([id, x, z]) => [id, [x, z]]))
    expect(pos.get('b')).toEqual(pos.get('a'))
    // 같이 탄 사람도 던질 수 있음
    s.ref.input('b', { t: 'cast' })
    expect(s.last('st')?.p).toMatchObject({ id: 'b', fishing: 'cast' })
    // 선착장 옆으로 와서 젓던 사람이 내리면 같이 탄 사람이 젓는 사람으로
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: b.x, z: b.z, r: 0 })
    s.ref.input('a', { t: 'unboard' })
    expect(s.last('boats')?.l[0].slice(3, 5)).toEqual(['b', null])
  })

  it('모래성: 뿅망치로 부수고, 가까이에서 쌓으면 4초 뒤 다시 서고, 움직이면 멈춤', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    expect(s.last('init')?.castles.every((c) => c[0] === 1)).toBe(true)
    const c = CASTLES[0]
    // 모래성 바로 앞(남쪽)에서 북쪽을 보고 뿅
    walkTo(s, 'a', c.x, c.z + 1.4)
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: c.x, z: c.z + 1.4, r: Math.PI })
    s.ref.input('a', { t: 'bonk' })
    expect(s.last('bonk')).toMatchObject({ id: 'a', to: null, castle: 0 })
    expect(s.last('castles')!.l[0][0]).toBe(0)
    // 쌓기 시작 → 움직이면 멈춤
    s.ref.input('a', { t: 'build', i: 0 })
    expect(s.last('castles')!.l[0][2]).toBe('a')
    s.tick(500)
    s.ref.input('a', { t: 'mv', x: c.x + 1, z: c.z + 1.4, r: 0 })
    expect(s.last('castles')!.l[0][2]).toBeNull()
    // 다시 쌓기 → 4초 뒤 섬
    s.ref.input('a', { t: 'build', i: 0 })
    s.tick(BUILD_MS + 200)
    expect(s.last('castles')!.l[0]).toEqual([1, 0, null])
    // 서 있는 건 못 쌓음
    const n = s.got.length
    s.ref.input('a', { t: 'build', i: 0 })
    expect(s.got.length).toBe(n)
  })

  it('나무 상자: 3~4번 때리면 부서지고 1분 뒤 다시 생김', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    const c = CRATES[0]
    walkTo(s, 'a', c.x, c.z + 1.3)
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: c.x, z: c.z + 1.3, r: Math.PI })
    const max = s.last('init')!.crates[0][1]
    expect(max).toBeGreaterThanOrEqual(3)
    expect(max).toBeLessThanOrEqual(4)
    for (let k = 0; k < max; k++) {
      s.tick(800)
      s.ref.input('a', { t: 'bonk' })
      expect(s.last('bonk')).toMatchObject({ crate: 0 })
      expect(s.last('crates')!.l[0][0]).toBe(max - k - 1)
    }
    s.tick(CRATE_RESPAWN_MS - 5000)
    expect(s.last('crates')!.l[0][0]).toBe(0)
    s.tick(11_000)
    expect(s.last('crates')!.l[0][0]).toBeGreaterThanOrEqual(3)
  })

  it('바다 배가 모두 차면 한 척 더 띄움', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const s = setup(['c', 'd', 'e', 'f'])
    for (const id of ids) s.ref.input(id, { t: 'hi' })
    const activeN = () => (s.last('boats')?.l ?? s.last('init')!.boats).filter((b) => b[5] === 1).length
    expect(activeN()).toBe(BOATS.length + KAYAKS.length)
    // 바다 배 3척에 두 명씩
    const spots: [number, number, number][] = [[8.2, -14, 0], [6.2, -11, 1], [-31.2, -22, 2]]
    spots.forEach(([x, z, i], k) => {
      for (const id of ids.slice(k * 2, k * 2 + 2)) {
        walkTo(s, id, x < 0 ? -32.5 : 7.2, 2)
        walkTo(s, id, x, z)
        s.ref.input(id, { t: 'board', i })
      }
    })
    expect(s.last('boats')!.l.slice(0, 3).every((b) => b[3] && b[4])).toBe(true)
    s.tick(11_000)
    expect(activeN()).toBe(BOATS.length + KAYAKS.length + 1)
  })

  it('앉을 자리: 가까이에서 앉고, 다른 사람은 못 앉고, 일어나면 서는 곳으로', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('b', { t: 'hi' })
    const i = SEATS.findIndex((st) => st.kind === 'lie')
    const st = SEATS[i]
    // 멀면 못 앉음
    s.ref.input('a', { t: 'seat', i })
    expect(s.last('st')?.p.seat).toBeNull()
    for (const id of ['a', 'b']) {
      walkTo(s, id, st.stand.x, st.stand.z - 4)
      walkTo(s, id, st.stand.x, st.stand.z)
    }
    s.ref.input('a', { t: 'seat', i })
    expect(s.last('st')?.p).toMatchObject({ id: 'a', seat: i, x: st.x, z: st.z })
    s.ref.input('b', { t: 'seat', i })
    expect(s.last('st')?.p).toMatchObject({ id: 'b', seat: null })
    s.ref.input('a', { t: 'seat', i: null })
    expect(s.last('st')?.p).toMatchObject({ id: 'a', seat: null, x: st.stand.x, z: st.stand.z })
  })

  it('앉기·눕기: 아무 데서나, 움직이면 풀림, 배에선 안 됨', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('a', { t: 'pose', p: 'sit' })
    expect(s.last('st')?.p.act).toBe('sit')
    s.ref.input('a', { t: 'pose', p: 'lie' })
    expect(s.last('st')?.p.act).toBe('lie')
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: 1, z: 9, r: 0 })
    expect(s.last('st')?.p.act).toBeNull()
  })

  it('점프: 모두에게 알리고, 앉아 있으면 일어남, 너무 자주는 안 됨', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('a', { t: 'pose', p: 'sit' })
    s.ref.input('a', { t: 'jump' })
    expect(s.last('jump')?.id).toBe('a')
    expect(s.last('st')?.p.act).toBeNull()
    const n = s.got.filter((g) => g.m.t === 'jump').length
    s.ref.input('a', { t: 'jump' })
    expect(s.got.filter((g) => g.m.t === 'jump').length).toBe(n)
    s.tick(600)
    s.ref.input('a', { t: 'jump' })
    expect(s.got.filter((g) => g.m.t === 'jump').length).toBe(n + 1)
  })

  it('사다리: 아래에서만 오르고, 위에선 위 자리 안만', () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    s.ref.input('a', { t: 'climb', i: 0 })
    expect(s.last('st')?.p.up).toBeNull()
    const l = LADDERS[0]
    walkTo(s, 'a', l.foot.x, l.foot.z)
    s.ref.input('a', { t: 'climb', i: 0 })
    expect(s.last('st')?.p.up).toBe(0)
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: l.top.x, z: l.top.z + 3, r: 0 })
    expect(s.last('st')?.p.z).toBeCloseTo(l.top.z)
    s.ref.input('a', { t: 'down' })
    expect(s.last('st')?.p).toMatchObject({ up: null, x: l.foot.x, z: l.foot.z })
  })

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
    walkTo(s, 'a', 0, 0)
    // 바다 쪽으로 조금씩 계속 가려고 해도 물가에서 멈춤
    for (let i = 0; i < 40; i++) {
      s.tick(200)
      const last = s.last('pos')?.l[0][2] ?? 0
      s.ref.input('a', { t: 'mv', x: 0, z: last - 0.5, r: 0 })
    }
    s.tick(100)
    const [, px, z] = s.last('pos')!.l[0]
    expect(z).toBeGreaterThanOrEqual(shoreZ(px))
    // 1초에 달리기 빠르기(9.5m/s)의 1.6배 + 0.6m 넘게는 못 감 — 막힌 것 없는 모래사장 뒤 줄(z 11)에서
    walkTo(s, 'a', 0, 11)
    s.tick(1000)
    s.ref.input('a', { t: 'mv', x: 40, z: 11, r: 0 })
    s.tick(100)
    const [, x] = s.last('pos')!.l[0]
    expect(x).toBeGreaterThan(5)
    expect(x).toBeLessThan(9.5 * 1.6 + 0.6 + 0.01)
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

  it('곤충 채집: 숲 나무 가까이에서 잠자리채 → 4~10초 뒤 걸림 → 잡으면 곤충 (어항엔 못 넣음)', async () => {
    const s = setup()
    s.ref.input('a', { t: 'hi' })
    walkTo(s, 'a', 0, 10)
    walkTo(s, 'a', 24.5, 10)
    walkTo(s, 'a', 24.8, 3.5)
    expect(s.last('pos')!.l.find((x) => x[0] === 'a')![2]).toBeCloseTo(3.5)
    s.ref.input('a', { t: 'cast' })
    expect(s.last('st')?.p).toMatchObject({ fishing: 'cast', net: 1 })
    for (let i = 0; i < 110 && !s.last('bite'); i++) s.tick(100)
    expect(s.last('bite')?.id).toBe('a')
    s.ref.input('a', { t: 'reel' })
    await s.flushAsync()
    const c = s.last('catch')!
    expect(BUGS.some((b) => b.id === c.c.fish && (b.zone === 'forest' || b.zone === 'both'))).toBe(true)
    expect(s.last('st')?.p.net).toBeUndefined()
    const key = s.last('profile')!.profile.bag[0].k
    s.ref.input('a', { t: 'tank', keys: [key] })
    await s.flushAsync()
    expect(s.last('profile')!.profile.tank).toEqual([])
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

describe('곤충 고르기', () => {
  const W = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.weight])) as Parameters<typeof rollBug>[3]
  it('그곳·그 시간 곤충만, 크기는 범위 안', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const zone of ['forest', 'meadow'] as const)
      for (const night of [false, true])
        for (let i = 0; i < 400; i++) {
          const c = rollBug(rand, zone, night, W, IRO)
          const b = BUGS.find((x) => x.id === c.fish)!
          expect(b.zone === zone || b.zone === 'both').toBe(true)
          if (b.rarity !== 'junk') {
            expect(b.time === 'any' || (b.time === 'night') === night, `${b.id} ${night}`).toBe(true)
            expect(c.size).toBeGreaterThanOrEqual(b.min)
            expect(c.size).toBeLessThanOrEqual(b.max)
          }
        }
  })
})
