import { createRng } from '../../shared/random'
import { describe, expect, it } from 'vitest'
import type { RefereeContext } from '../hub'
import { rouletteReferee } from './roulette'

function fakeCtx(members: { id: string; role: 'host' | 'guest' }[]) {
  let now = 1000
  const all: unknown[] = []
  const ctx: RefereeContext = {
    now: () => now,
    members: () => members.map((m) => ({ ...m, nickname: m.id })),
    broadcast: (m) => all.push(m),
    sendTo: () => {},
  }
  return { ctx, all, advance: (ms: number) => (now += ms), get now() { return now } }
}

describe('러시안룰렛 서버 심판', () => {
  it('끝까지 가고, 화면엔 총알 칸이 안 나가고, 남의 차례엔 못 쏨', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = rouletteReferee({ players: [{ id: 'H', name: '가짜이름' }, { id: 'G' }, { id: 'bot0', name: '봇' }], teams: null }, f.ctx)!
    expect(ref).not.toBeNull()
    let guard = 0
    while (!ref.finished() && guard++ < 20000) {
      f.advance(50)
      ref.tick(f.now)
      const v = (f.all.at(-1) as { v: { phase: string; turn: number; alive: boolean[]; players: { id: string }[] } }).v
      if (v.phase === 'aim') {
        const turnId = v.players[v.turn].id
        const other = turnId === 'H' ? 'G' : 'H'
        const target = v.alive.findIndex((a, i) => a && i !== v.turn)
        // 차례가 아닌 사람이 당겨도 아무 일 없음
        const before = JSON.stringify(f.all.at(-1))
        expect(ref.input(other, { t: 'pull', target })).toBe(true)
        if (turnId !== 'bot0') expect(JSON.stringify(f.all.at(-1))).toBe(before)
        if (turnId !== 'bot0') ref.input(turnId, { t: 'pull', target })
      }
    }
    expect(ref.finished()).toBe(true)
    expect(JSON.stringify(f.all)).not.toContain('chamber')
    // 사람 이름은 서버가 아는 닉네임
    expect(JSON.stringify(f.all[0])).not.toContain('가짜이름')
  })

  it('방에 없는 사람을 넣으면 시작 안 함, 모르는 메시지는 그대로 전달', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }])
    expect(rouletteReferee({ players: [{ id: 'H' }, { id: 'X' }] }, f.ctx)).toBeNull()
    const ref = rouletteReferee({ players: [{ id: 'H' }, { id: 'bot0' }] }, f.ctx)!
    expect(ref.input('H', { t: 'rtc-offer' })).toBe(false)
  })
})

import { bombReferee } from './bomb'

describe('폭탄 돌리기 서버 심판', () => {
  it('끝까지 가고, 터지는 시각은 안 나가고, 남 대신 못 던짐', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = bombReferee({ players: [{ id: 'H' }, { id: 'G' }, { id: 'bot0', name: '봇' }] }, f.ctx)!
    let guard = 0
    let spoofTried = false
    while (!ref.finished() && guard++ < 40000) {
      f.advance(50)
      ref.tick(f.now)
      const v = (f.all.at(-1) as { v: { phase: string; holder: number; players: { id: string }[]; alive: boolean[] } }).v
      const holder = v.players[v.holder]?.id
      if (v.phase === 'play' && (holder === 'H' || holder === 'G')) {
        const other = holder === 'H' ? 'G' : 'H'
        if (!spoofTried) {
          const before = JSON.stringify(f.all.at(-1))
          ref.input(other, { t: 'pass', to: 'bot0' })
          expect(JSON.stringify(f.all.at(-1))).toBe(before)
          spoofTried = true
        }
        if (guard % 7 === 0) ref.input(holder, { t: 'pass', to: v.players.find((p, i) => p.id !== holder && v.alive[i])!.id })
      }
    }
    expect(ref.finished()).toBe(true)
    expect(spoofTried).toBe(true)
    expect(JSON.stringify(f.all)).not.toContain('explodeAt')
  })
})

import { nunchiReferee } from './nunchi'

describe('눈치게임 서버 심판', () => {
  it('끝까지 가고 남 대신 못 누름', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = nunchiReferee({ players: [{ id: 'H' }, { id: 'G' }, { id: 'bot0' }, { id: 'bot1' }] }, f.ctx)!
    let guard = 0
    while (!ref.finished() && guard++ < 40000) {
      f.advance(50)
      ref.tick(f.now)
      if (guard % 37 === 0) ref.input('H', { t: 'press' })
      if (guard % 53 === 0) ref.input('G', { t: 'pick', hand: 'rock' })
    }
    expect(ref.finished()).toBe(true)
    expect(ref.input('X', { t: 'press' })).toBe(true)
  })
})

import { REFEREES } from './index'

describe('나머지 서버 심판 (봇과 한참 돌려도 안 멈춤)', () => {
  const setups: Record<string, object> = {
    survival: { players: [{ id: 'H' }, { id: 'bot0' }, { id: 'bot1' }] },
    yut: { players: [{ id: 'H' }, { id: 'bot0' }], pieceCount: 2 },
    tiles: { players: [{ id: 'H' }, { id: 'G' }, { id: 'bot0' }] },
    artillery: { players: [{ id: 'H' }, { id: 'bot0' }] },
  }
  for (const [game, setup] of Object.entries(setups)) {
    it(game, () => {
      const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
      const sentTo: [string, unknown][] = []
      f.ctx.sendTo = (k, m) => sentTo.push([k, m])
      const ref = REFEREES[game](setup, f.ctx)!
      expect(ref).not.toBeNull()
      for (let i = 0; i < 4000 && !ref.finished(); i++) {
        f.advance(50)
        ref.tick(f.now)
      }
      // 이상한 입력에도 안 멈춤
      expect(() => ref.input('H', { t: 'plan', round: 1, plan: { pos: 'x' } })).not.toThrow()
      expect(() => ref.input('H', { t: 'play', table: [[999]] })).not.toThrow()
      if (game === 'tiles') {
        const toG = sentTo.filter(([k]) => k === 'G').at(-1)![1] as { v: { hands: number[][]; players: { id: string }[] } }
        const gi = toG.v.players.findIndex((p) => p.id === 'G')
        toG.v.hands.forEach((h, i) => (i === gi ? expect(h.some((t) => t >= 0)).toBe(true) : expect(h.every((t) => t === -1)).toBe(true)))
      }
    })
  }
})

import { createMatch as createNb, matchReducer as nbReducer, type MatchState as NbState } from '../../games/numbaseball/play/matchState'
import { actionOf as nbAction, outbox as nbOutbox, type NumbaseballMsg } from '../../games/numbaseball/play/pvp'
import { numbaseballReferee } from './numbaseball'

describe('숫자야구 서버 심판', () => {
  it('두 폰이 서버를 거쳐 끝까지 같은 결과, 숫자는 끝나고서야 상대에게 감, 거짓 판정은 버림', () => {
    const inbox: Record<string, NumbaseballMsg[]> = { H: [], G: [] }
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    f.ctx.sendTo = (k, m) => inbox[k].push(m as NumbaseballMsg)
    const ref = numbaseballReferee({ length: 3, guestFirst: false }, f.ctx)!
    let h: NbState = createNb({ now: f.now, seed: 1, mode: 'pvp', difficulty: 'normal', length: 3, first: 0 })
    let g: NbState = createNb({ now: f.now, seed: 2, mode: 'pvp', difficulty: 'normal', length: 3, first: 1 })
    // 방장이 거짓 판정을 보내 봐도 서버가 버림
    expect(ref.input('H', { t: 'answer', n: 0, strike: 3, ball: 0 })).toBe(true)
    let revealedEarly = false
    for (let i = 0; i < 20000 && (h.phase.kind !== 'done' || g.phase.kind !== 'done'); i++) {
      f.advance(200)
      const ph = h, pg = g
      h = nbReducer(h, { type: 'tick', now: f.now })
      g = nbReducer(g, { type: 'tick', now: f.now })
      for (const m of nbOutbox(ph, h, true)) ref.input('H', m)
      for (const m of nbOutbox(pg, g, true)) ref.input('G', m)
      for (const [k, msgs] of Object.entries(inbox)) {
        for (const m of msgs.splice(0)) {
          if (m.t === 'reveal' && (k === 'H' ? h : g).phase.kind !== 'done' && (k === 'H' ? h : g).phase.kind !== 'result') revealedEarly = true
          const a = nbAction(m)
          if (!a) continue
          if (k === 'H') h = nbReducer(h, a)
          else g = nbReducer(g, a)
        }
      }
    }
    expect(h.phase.kind).toBe('done')
    expect(g.phase.kind).toBe('done')
    const wh = h.phase.kind === 'done' ? h.phase.winner : null
    const wg = g.phase.kind === 'done' ? g.phase.winner : null
    expect(wh === 'draw' ? wg === 'draw' : wg === (wh === 0 ? 1 : 0)).toBe(true)
    expect(revealedEarly).toBe(false)
  })
})

import { canFlip as mmCanFlip, createMatch as createMm, matchReducer as mmReducer, type MatchState as MmState } from '../../games/memory/play/matchState'
import { memoryReferee } from './memory'

describe('짝맞추기 서버 심판', () => {
  it('두 폰은 그림을 모른 채 시작하고, 서버를 거쳐 끝까지 같은 점수', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const out: { n: number; index: number; face: number }[] = []
    f.ctx.broadcast = (m) => out.push(m as { n: number; index: number; face: number })
    const ref = memoryReferee({ guestFirst: true }, f.ctx)!
    let h: MmState = createMm({ now: f.now, seed: 1, difficulty: 'normal', controllers: ['user', 'remote'], first: 1, hidden: true })
    let g: MmState = createMm({ now: f.now, seed: 2, difficulty: 'normal', controllers: ['user', 'remote'], first: 0, hidden: true })
    expect(h.cards.every((c) => c.face === -1)).toBe(true)
    let seen = 0
    const pickRng = createRng(42)
    for (let i = 0; i < 20000 && (h.phase.kind !== 'done' || g.phase.kind !== 'done'); i++) {
      f.advance(100)
      ref.tick(f.now)
      h = mmReducer(h, { type: 'tick', now: f.now })
      g = mmReducer(g, { type: 'tick', now: f.now })
      // 차례인 쪽이 가끔 아무 카드나 누름 (남의 차례에 누른 건 서버가 버림)
      for (const [key, st] of [['H', h], ['G', g]] as const) {
        if (i % 3) continue
        const options = st.cards.flatMap((_, k) => (mmCanFlip(st, k) ? [k] : []))
        if (options.length) ref.input(key, { t: 'flip', n: st.flips.length, index: options[Math.floor(pickRng.next() * options.length)] })
      }
      for (; seen < out.length; seen++) {
        const m = out[seen]
        h = mmReducer(h, { type: 'serverFlip', ...m })
        g = mmReducer(g, { type: 'serverFlip', ...m })
      }
    }
    expect(h.phase.kind).toBe('done')
    expect(g.phase.kind).toBe('done')
    const own = (s: MmState, side: 0 | 1) => s.cards.filter((c) => c.owner === side).length
    expect([own(h, 0), own(h, 1)]).toEqual([own(g, 1), own(g, 0)])
  })
})

import { createMatch as createFt, matchReducer as ftReducer, type MatchState as FtState } from '../../games/fight/play/matchState'
import { guestPickMsg, serverActionOf, type FightMsg } from '../../games/fight/play/pvp'
import { fightReferee } from './fight'

describe('격투 서버 심판', () => {
  it('두 폰 모두 서버 턴·공개를 따라 끝까지 같은 결과, 공개 전엔 상대 자세가 안 감', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const out: FightMsg[] = []
    f.ctx.broadcast = (m) => out.push(m as FightMsg)
    const ref = fightReferee({}, f.ctx)!
    let h: FtState = createFt({ now: f.now, seed: 1, difficulty: 'normal', controllers: ['user', 'remote'], follow: true })
    let g: FtState = createFt({ now: f.now, seed: 2, difficulty: 'normal', controllers: ['user', 'remote'], follow: true })
    const rng = createRng(7)
    let seen = 0
    for (let i = 0; i < 5000 && (h.phase.kind !== 'done' || g.phase.kind !== 'done'); i++) {
      f.advance(100)
      ref.tick(f.now)
      h = ftReducer(h, { type: 'tick', now: f.now })
      g = ftReducer(g, { type: 'tick', now: f.now })
      for (const [key, st] of [['H', h], ['G', g]] as const) {
        if (rng.next() > 0.3) continue
        const stance = (['ready', 'guard', 'attack', 'smash'] as const)[Math.floor(rng.next() * 4)]
        const m = guestPickMsg(st, stance)
        if (m) ref.input(key, m)
      }
      for (; seen < out.length; seen++) {
        // 공개 메시지 말고는 자세가 안 담김
        if (out[seen].t !== 'reveal') expect(JSON.stringify(out[seen])).not.toMatch(/ready|guard|attack|smash/)
        const ah = serverActionOf(out[seen], 'host')
        const ag = serverActionOf(out[seen], 'guest')
        if (ah) h = ftReducer(h, ah)
        if (ag) g = ftReducer(g, ag)
      }
    }
    expect(h.phase.kind).toBe('done')
    expect(g.phase.kind).toBe('done')
    expect([h.fighters[0].life, h.fighters[1].life]).toEqual([g.fighters[1].life, g.fighters[0].life])
  })
})

import { doodleReferee } from './doodle'

describe('그림 맞히기 서버 심판', () => {
  it('그리는 사람 그림만 넘기고 기억해서 다시 보내 줌, 제시어는 그리는 사람에게만', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const to: [string, { t: string; v?: { word: string | null; drawer: number | null; phase: string; turnNo: number; players: { id: string }[] }; ops?: unknown[] }][] = []
    f.ctx.sendTo = (k, m) => to.push([k, m as never])
    const ref = doodleReferee({ players: [{ id: 'H' }, { id: 'G' }] }, f.ctx)!
    expect(doodleReferee({ players: [{ id: 'H' }, { id: 'bot0' }] }, f.ctx)).toBeNull()
    let v = to.at(-1)![1].v!
    for (let i = 0; i < 400 && v.phase !== 'draw'; i++) {
      f.advance(100)
      ref.tick(f.now)
      v = to.filter(([k]) => k === 'H').at(-1)![1].v!
    }
    const drawerId = v.players[v.drawer!].id
    const otherId = drawerId === 'H' ? 'G' : 'H'
    const mine = to.filter(([k]) => k === drawerId).at(-1)![1].v!
    const theirs = to.filter(([k]) => k === otherId).at(-1)![1].v!
    expect(mine.word).toBeTruthy()
    expect(theirs.word).toBeNull()
    const ink = { t: 'ink', turn: v.turnNo, ops: [{ op: 's', id: 1, c: '#1c1748', w: 4, p: [10, 10, 20, 20] }] }
    expect(ref.input(otherId, ink)).toBe(true) // 맞히는 사람 낙서는 막힘
    expect(ref.input(drawerId, ink)).toBe(false) // 그리는 사람 것은 그대로 전달
    ref.input(otherId, { t: 'inkSync' })
    const sync = to.filter(([k, m]) => k === otherId && m.t === 'inkAll').at(-1)![1]
    expect(sync.ops).toHaveLength(1)
  })
})
