import { describe, expect, it } from 'vitest'
import { COUNTDOWN_MS, FLIGHT_MS } from '../constants'
import { createEngine, engineReducer } from './engine'
import { createScreen, screenReducer, tickGap, toView, viewChanged } from './view'

const players = [
  { id: 'a', name: '가', kind: 'user' as const },
  { id: 'b', name: '나', kind: 'remote' as const },
]

describe('toView', () => {
  it('터지는 시각은 화면에 안 넣는다', () => {
    const started = engineReducer(createEngine({ now: 0, seed: 1, players }), { type: 'tick', now: COUNTDOWN_MS })
    const s = engineReducer(started, { type: 'tick', now: COUNTDOWN_MS + 1000 })
    const v = toView(s)
    expect(v.phase).toBe('play')
    expect(v.elapsedMs).toBe(1000)
    expect(JSON.stringify(v)).not.toContain('explode')
  })
})

describe('screenReducer', () => {
  it('던짐이 오면 내 시계로 도착 시각을 정하고 소리, 받으면 받는 소리', () => {
    let e = engineReducer(createEngine({ now: 0, seed: 1, players }), { type: 'tick', now: COUNTDOWN_MS })
    let sc = createScreen('b', 5000)
    sc = screenReducer(sc, { type: 'view', view: toView(e) })
    expect(sc.sounds.map((x) => x.name)).toEqual(['go'])
    e = engineReducer(e, { type: 'pass', from: e.holder, to: 1 - e.holder })
    sc = screenReducer(sc, { type: 'view', view: toView(e) })
    expect(sc.flight?.landAt).toBe(5000 + FLIGHT_MS)
    expect(sc.sounds.at(-1)?.name).toBe('throw')
    e = engineReducer(e, { type: 'tick', now: e.now + FLIGHT_MS })
    sc = screenReducer(sc, { type: 'view', view: toView(e) })
    expect(sc.flight).toBeNull()
    expect(sc.sounds.at(-1)?.name).toBe('catch')
  })

  it('째깍은 점점 빨라진다', () => {
    expect(tickGap(0)).toBeGreaterThan(tickGap(8000))
    expect(tickGap(60_000)).toBe(130)
  })

  it('들고 있는 사람·던짐·단계가 바뀌면 바로 보낼 것', () => {
    const e = createEngine({ now: 0, seed: 1, players })
    const v = toView(e)
    expect(viewChanged(null, v)).toBe(true)
    expect(viewChanged(v, { ...v, leftMs: 10 })).toBe(false)
    expect(viewChanged(v, { ...v, holder: 1 - v.holder })).toBe(true)
  })
})
