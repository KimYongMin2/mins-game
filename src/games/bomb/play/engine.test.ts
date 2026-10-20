import { describe, expect, it } from 'vitest'
import { BOOM_MS, COUNTDOWN_MS, FLIGHT_MS, FUSE_MS, MIN_HOLD_MS } from '../constants'
import { type EngineState, type Player, type PlayerKind, canPass, createEngine, engineReducer, neighborsOf, rankingOf } from './engine'

const players = (...kinds: PlayerKind[]): Player[] => kinds.map((kind, i) => ({ id: `p${i}`, name: `사람${i}`, kind }))
const at = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })
/** 판이 시작되고 처음 든 사람이 던질 수 있게 된 때 */
const playing = (kinds: PlayerKind[], seed = 1) => at(at(createEngine({ now: 0, seed, players: players(...kinds) }), COUNTDOWN_MS), COUNTDOWN_MS + MIN_HOLD_MS)

describe('neighborsOf', () => {
  it('바로 옆 살아 있는 사람 [왼쪽(다음 번호), 오른쪽(이전 번호)], 탈락한 자리는 건너뜀', () => {
    expect(neighborsOf([true, true, true, true], 0)).toEqual([1, 3])
    expect(neighborsOf([true, false, true, true], 0)).toEqual([2, 3])
    expect(neighborsOf([true, false, true, false], 0)).toEqual([2, 2])
    expect(neighborsOf([true, false, false], 0)).toBeNull()
  })
})

describe('던지기', () => {
  it('옆 사람에게만 (맞은편은 안 됨)', () => {
    let s = playing(['user', 'remote', 'remote', 'remote'])
    const h = s.holder
    expect(canPass(s, h, (h + 2) % 4)).toBe(false)
    expect(canPass(s, h, (h + 1) % 4)).toBe(true)
    expect(canPass(s, h, (h + 3) % 4)).toBe(true)
    s = engineReducer(s, { type: 'pass', from: h, to: (h + 2) % 4 })
    expect(s.flight).toBeNull()
  })

  it('들고 있는 사람만, 살아 있는 다른 사람에게, 날아가는 동안엔 못 던짐', () => {
    let s = playing(['user', 'remote', 'remote'])
    expect(s.phase.kind).toBe('play')
    const h = s.holder
    const other = (h + 1) % 3
    expect(canPass(s, (h + 2) % 3, other)).toBe(false)
    expect(canPass(s, h, h)).toBe(false)
    s = engineReducer(s, { type: 'pass', from: h, to: other })
    expect(s.flight).toMatchObject({ from: h, to: other })
    expect(canPass(s, h, (h + 2) % 3)).toBe(false)
    s = at(s, s.now + FLIGHT_MS)
    expect(s.holder).toBe(other)
    expect(s.flight).toBeNull()
  })

  it(`받고 ${MIN_HOLD_MS}ms는 들고 있어야 다시 던질 수 있다`, () => {
    let s = playing(['user', 'remote', 'remote'])
    const h = s.holder
    const next = (h + 1) % 3
    s = at(engineReducer(s, { type: 'pass', from: h, to: next }), s.now + FLIGHT_MS)
    expect(s.holder).toBe(next)
    expect(canPass(s, next, h)).toBe(false)
    s = at(s, s.now + MIN_HOLD_MS - 1)
    expect(canPass(s, next, h)).toBe(false)
    s = at(s, s.now + 1)
    expect(canPass(s, next, h)).toBe(true)
  })
})

describe('펑', () => {
  it(`${FUSE_MS[0] / 1000}~${FUSE_MS[1] / 1000}초 사이에 터지고 들고 있던 사람이 탈락`, () => {
    for (let seed = 0; seed < 20; seed++) {
      let s = playing(['user', 'remote', 'remote'], seed)
      const h = s.holder
      s = at(s, COUNTDOWN_MS + FUSE_MS[0] - 1)
      expect(s.phase.kind).toBe('play')
      s = at(s, COUNTDOWN_MS + FUSE_MS[1])
      expect(s.phase).toMatchObject({ kind: 'boom', victim: h })
      expect(s.alive[h]).toBe(false)
    }
  })

  it('날아가는 중에 터지면 받던 사람이 탈락', () => {
    let s = playing(['user', 'remote'])
    const h = s.holder
    const phase = s.phase.kind === 'play' ? s.phase : null
    s = at(s, phase!.explodeAt - 100)
    s = engineReducer(s, { type: 'pass', from: h, to: 1 - h })
    s = at(s, phase!.explodeAt)
    expect(s.phase).toMatchObject({ kind: 'boom', victim: 1 - h })
  })

  it('한 명 남을 때까지 판을 이어가고, 순위는 남은 사람 → 늦게 탈락한 순', () => {
    let s = createEngine({ now: 0, seed: 3, players: players('bot', 'bot', 'bot', 'bot') })
    for (let now = 0; now < 200_000 && s.phase.kind !== 'done'; now += 16) s = at(s, now)
    expect(s.phase.kind).toBe('done')
    expect(s.alive.filter(Boolean)).toHaveLength(1)
    expect(s.out).toHaveLength(3)
    expect(s.round).toBe(3)
    const r = rankingOf(s)
    expect(r[0]).toBe(s.alive.indexOf(true))
    expect(r.slice(1)).toEqual([...s.out].reverse())
    expect(s.passes.reduce((a, b) => a + b, 0)).toBeGreaterThan(10)
  })

  it('펑 다음엔 3·2·1 뒤 남은 사람끼리 다시', () => {
    let s = playing(['user', 'remote', 'remote'])
    s = at(s, COUNTDOWN_MS + FUSE_MS[1])
    s = at(s, s.now + BOOM_MS)
    expect(s.phase.kind).toBe('countdown')
    s = at(s, s.now + COUNTDOWN_MS)
    expect(s.alive[s.holder]).toBe(true)
  })
})

describe('나감', () => {
  it('나간 사람은 탈락, 폭탄을 들고 있었으면 남은 사람에게', () => {
    let s = playing(['user', 'remote', 'remote'])
    const h = s.holder
    s = engineReducer(s, { type: 'drop', player: h })
    expect(s.alive[h]).toBe(false)
    expect(s.alive[s.holder]).toBe(true)
    expect(s.phase.kind).toBe('play')
  })

  it('둘이 하다 하나가 나가면 바로 끝', () => {
    const s = engineReducer(playing(['user', 'remote']), { type: 'drop', player: 1 })
    expect(s.phase.kind).toBe('done')
    expect(rankingOf(s)[0]).toBe(0)
  })
})
