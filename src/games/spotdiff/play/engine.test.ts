import { describe, expect, it } from 'vitest'
import { ASK_MS, CLEAR_PAUSE_MS, INTRO_MS, LOCK_MS, MISS_PENALTY_MS, QUESTIONS, REVEAL_MS } from '../constants'
import { type EngineState, createEngine, engineReducer, pickSeeds, ranksOf } from './engine'
import { DIFFS, makeScene, sceneOf, sceneSvg, THEME_KEYS } from './scene'
import { viewFor } from './view'

const players = [
  { id: 'a', name: '가' },
  { id: 'b', name: '나' },
]

function started(): EngineState {
  const s = createEngine({ now: 0, seed: 42, players })
  return engineReducer(s, { type: 'tick', now: INTRO_MS })
}

/** 지금 문제의 남은 차이를 다 누름 (한 번에 dt씩 지나며) */
function solve(s: EngineState, player: number, dt: number): EngineState {
  const diffs = sceneOf(s.seeds[s.runs[player].q]).diffs
  diffs.forEach((d) => {
    s = engineReducer(s, { type: 'tick', now: s.now + dt })
    s = engineReducer(s, { type: 'tap', player, q: s.runs[player].q, x: d.x, y: d.y })
  })
  return s
}

describe('그림 만들기', () => {
  it('어느 장면이든 7곳이 바뀌고, 같은 씨앗값은 같은 그림', () => {
    for (let seed = 1; seed < 400; seed++) {
      const sc = makeScene(seed * 7919)
      expect(sc.diffs.length).toBe(DIFFS)
      expect(sceneSvg(sc, 'B', 'x')).toBe(sceneSvg(makeScene(seed * 7919), 'B', 'x'))
    }
  })
  it('장면 7가지가 다 나온다', () => {
    const seen = new Set(Array.from({ length: 300 }, (_, i) => makeScene(i + 1).theme))
    expect(seen.size).toBe(THEME_KEYS.length)
    expect(THEME_KEYS.length).toBe(7)
  })
  it('한 판 문제들은 바로 앞과 장면이 다르다', () => {
    for (let seed = 1; seed < 30; seed++) {
      const themes = pickSeeds(seed).map((s) => makeScene(s).theme)
      themes.slice(1).forEach((t, i) => expect(t).not.toBe(themes[i]))
    }
  })
})

describe('진행', () => {
  it('다 찾으면 걸린 시간을 남기고 쉬었다가 다음 문제', () => {
    let s = solve(started(), 0, 1000)
    expect(s.runs[0].results).toEqual([{ found: 7, ms: 7000, cleared: true }])
    expect(s.runs[0].score).toBe(700 + 53 * 10)
    s = engineReducer(s, { type: 'tick', now: s.now + CLEAR_PAUSE_MS })
    expect(s.runs[0].q).toBe(1)
  })

  it('틀리면 3초 동안 못 누름', () => {
    let s = started()
    const d = sceneOf(s.seeds[0]).diffs[0]
    // 차이에서 먼 곳 찾기
    const far = [[5, 5], [395, 5], [5, 295], [395, 295], [200, 150]].find(([x, y]) => sceneOf(s.seeds[0]).diffs.every((k) => Math.hypot(k.x - x, k.y - y) > 60))!
    s = engineReducer(s, { type: 'tap', player: 0, q: 0, x: far[0], y: far[1] })
    expect(s.runs[0].misses).toBe(1)
    s = engineReducer(s, { type: 'tap', player: 0, q: 0, x: d.x, y: d.y })
    expect(s.runs[0].found).toEqual([])
    s = engineReducer(s, { type: 'tick', now: s.now + LOCK_MS })
    s = engineReducer(s, { type: 'tap', player: 0, q: 0, x: d.x, y: d.y })
    expect(s.runs[0].found).toEqual([0])
  })

  it('시간이 끝나면 60초 + 못 찾은 곳마다 10초', () => {
    let s = started()
    const d = sceneOf(s.seeds[0]).diffs[0]
    s = engineReducer(s, { type: 'tap', player: 1, q: 0, x: d.x, y: d.y })
    s = engineReducer(s, { type: 'tick', now: s.now + ASK_MS })
    expect(s.runs[1].results[0]).toEqual({ found: 1, ms: ASK_MS + 6 * MISS_PENALTY_MS, cleared: false })
    s = engineReducer(s, { type: 'tick', now: s.now + REVEAL_MS })
    expect(s.runs[1].q).toBe(1)
  })

  it('다른 문제 번호로 누른 건 무시', () => {
    let s = started()
    const d = sceneOf(s.seeds[1]).diffs[0]
    s = engineReducer(s, { type: 'tap', player: 0, q: 1, x: d.x, y: d.y })
    expect(s.runs[0].found).toEqual([])
    expect(s.runs[0].misses).toBe(0)
  })

  it('모두 다 풀면 끝, 총 시간이 짧은 사람이 1등', () => {
    let s = started()
    for (let q = 0; q < QUESTIONS; q++) {
      s = solve(s, 0, 500)
      s = solve(s, 1, 900)
      s = engineReducer(s, { type: 'tick', now: s.now + CLEAR_PAUSE_MS })
    }
    s = engineReducer(s, { type: 'tick', now: s.now + 10 })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)).toEqual([1, 2])
    expect(viewFor(s, 'a').rows[0].done).toBe(true)
  })

  it('먼저 다 푼 사람은 기다리고, 남은 사람이 나가면 끝', () => {
    let s = started()
    for (let q = 0; q < QUESTIONS; q++) {
      s = solve(s, 0, 300)
      s = engineReducer(s, { type: 'tick', now: s.now + CLEAR_PAUSE_MS })
    }
    expect(s.runs[0].done).toBe(true)
    expect(s.phase.kind).toBe('play')
    s = engineReducer(s, { type: 'drop', player: 1 })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)).toEqual([1, 2])
  })

  it('화면엔 내 문제 그림 씨앗값만', () => {
    let s = solve(started(), 0, 100)
    s = engineReducer(s, { type: 'tick', now: s.now + CLEAR_PAUSE_MS })
    expect(viewFor(s, 'a').my?.seed).toBe(s.seeds[1])
    expect(viewFor(s, 'b').my?.seed).toBe(s.seeds[0])
  })
})
