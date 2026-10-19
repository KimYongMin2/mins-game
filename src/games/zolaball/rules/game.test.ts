import { describe, expect, it } from 'vitest'
import { type GameState, type PitchOutcome, applyPitch, createGame, totalRuns } from './game'

function play(game: GameState, ...outcomes: PitchOutcome[]): GameState {
  return outcomes.reduce((g, o) => applyPitch(g, o).game, game)
}

const strikeout: PitchOutcome[] = ['calledStrike', 'calledStrike', 'calledStrike']
const threeOuts: PitchOutcome[] = ['out', 'out', 'out']

function withBases(bases: GameState['bases']): GameState {
  return { ...createGame(), bases }
}

describe('볼카운트', () => {
  it('볼 4개면 볼넷으로 1루', () => {
    const r = applyPitch(play(createGame(), 'ball', 'ball', 'ball'), 'ball')
    expect(r.event.plateResult).toBe('walk')
    expect(r.game.bases).toEqual([true, false, false])
    expect([r.game.balls, r.game.strikes]).toEqual([0, 0])
    expect(r.game.stats.away.walks).toBe(1)
    expect(r.game.stats.away.atBats).toBe(0)
  })

  it('스트라이크 3개면 삼진 아웃 (헛스윙·루킹 모두)', () => {
    const r = applyPitch(play(createGame(), 'calledStrike', 'swingingStrike'), 'swingingStrike')
    expect(r.event.plateResult).toBe('strikeout')
    expect(r.game.outs).toBe(1)
    expect(r.game.stats.away.strikeouts).toBe(1)
    expect(r.game.stats.away.atBats).toBe(1)
  })

  it('파울은 2스트라이크 전까지만 스트라이크', () => {
    const g = play(createGame(), 'foul', 'foul')
    expect(g.strikes).toBe(2)
    const after = play(g, 'foul', 'foul', 'foul')
    expect(after.strikes).toBe(2)
    expect(after.outs).toBe(0)
  })

  it('볼과 스트라이크가 섞여도 따로 센다', () => {
    const g = play(createGame(), 'ball', 'calledStrike', 'ball', 'foul')
    expect([g.balls, g.strikes]).toEqual([2, 2])
  })
})

describe('주자 진루', () => {
  it('안타: 모두 1베이스, 3루 주자 득점', () => {
    const r = applyPitch(withBases([true, false, true]), 'single')
    expect(r.game.bases).toEqual([true, true, false])
    expect(r.event.runs).toBe(1)
  })

  it('2루타: 모두 2베이스', () => {
    const r = applyPitch(withBases([true, true, false]), 'double')
    expect(r.game.bases).toEqual([false, true, true])
    expect(r.event.runs).toBe(1)
  })

  it('홈런: 주자 전원 + 타자 득점', () => {
    const r = applyPitch(withBases([true, true, true]), 'homerun')
    expect(r.game.bases).toEqual([false, false, false])
    expect(r.event.runs).toBe(4)
    expect(r.game.stats.away.homeruns).toBe(1)
    expect(r.game.stats.away.hits).toBe(1)
  })

  it('범타 아웃: 주자 그대로', () => {
    const r = applyPitch(withBases([true, false, true]), 'out')
    expect(r.game.bases).toEqual([true, false, true])
    expect(r.event.runs).toBe(0)
  })

  it.each([
    [[false, false, false], [true, false, false], 0],
    [[false, true, false], [true, true, false], 0],
    [[true, false, true], [true, true, true], 0],
    [[false, true, true], [true, true, true], 0],
    [[true, true, true], [true, true, true], 1],
  ] as const)('볼넷 밀어내기 %j → %j, %i점', (before, after, runs) => {
    const g = { ...withBases(before), balls: 3 }
    const r = applyPitch(g, 'ball')
    expect(r.game.bases).toEqual(after)
    expect(r.event.runs).toBe(runs)
  })
})

describe('타점과 투수 기록', () => {
  it('안타·홈런·밀어내기 볼넷으로 들어온 점수는 타자의 타점', () => {
    let r = applyPitch(withBases([true, true, true]), 'homerun')
    expect(r.game.stats.away.rbi).toBe(4)
    r = applyPitch({ ...withBases([true, true, true]), balls: 3 }, 'ball')
    expect(r.game.stats.away.rbi).toBe(1)
    r = applyPitch(withBases([false, true, true]), 'single')
    expect(r.game.stats.away.rbi).toBe(1)
  })

  it('수비 쪽에 잡은 아웃과 실점이 쌓인다', () => {
    let g = play(createGame(), 'homerun', 'out', ...strikeout) // 1회 초: 1실점, 2아웃
    expect(g.pitching.home).toEqual({ outs: 2, runsAllowed: 1 })
    g = play(g, 'out') // 3아웃 → 공수 교대
    expect(g.pitching.home).toEqual({ outs: 3, runsAllowed: 1 })
    g = play(g, 'single', 'out')
    expect(g.pitching.away).toEqual({ outs: 1, runsAllowed: 0 })
    expect(g.pitching.home).toEqual({ outs: 3, runsAllowed: 1 })
  })

  it('3이닝을 다 던지면 9아웃', () => {
    let g = createGame()
    for (let i = 0; i < 6; i++) g = play(g, ...threeOuts)
    expect(g.pitching.home.outs).toBe(9)
    expect(g.pitching.away.outs).toBe(9)
  })
})

describe('이닝과 경기 종료', () => {
  it('3아웃이면 공수 교대, 주자와 카운트 초기화', () => {
    const g = play({ ...withBases([true, true, false]), balls: 2 }, ...threeOuts)
    expect(g.half).toBe('bottom')
    expect(g.inning).toBe(1)
    expect(g.outs).toBe(0)
    expect(g.bases).toEqual([false, false, false])
    expect(g.linescore).toEqual({ away: [0], home: [0] })
  })

  it('말이 끝나면 다음 이닝 초', () => {
    const g = play(createGame(), ...threeOuts, ...threeOuts)
    expect([g.inning, g.half]).toEqual([2, 'top'])
    expect(g.linescore.away).toEqual([0, 0])
  })

  it('득점은 그 이닝 칸에 쌓인다', () => {
    let g = play(createGame(), ...threeOuts, ...threeOuts) // 2회 초
    g = play(g, 'homerun', 'single', 'homerun')
    expect(g.linescore.away).toEqual([0, 3])
    expect(totalRuns(g, 'away')).toBe(3)
  })

  it('3이닝을 다 하고 동점이면 무승부로 끝난다', () => {
    let g = createGame()
    for (let i = 0; i < 6; i++) g = play(g, ...threeOuts)
    expect(g.final).toBe(true)
    expect(totalRuns(g, 'away')).toBe(totalRuns(g, 'home'))
    expect(g.linescore).toEqual({ away: [0, 0, 0], home: [0, 0, 0] })
  })

  it('마지막 이닝 초가 끝났을 때 후공이 앞서면 말 공격 없이 종료', () => {
    let g = play(createGame(), ...threeOuts, 'homerun', ...threeOuts) // 1회 말 1점
    for (let i = 0; i < 3; i++) g = play(g, ...threeOuts) // 2회 초·말, 3회 초
    expect(g.final).toBe(true)
    expect(g.linescore.home).toEqual([1, 0])
  })

  it('마지막 이닝 말에 앞서는 순간 끝내기', () => {
    let g = play(createGame(), 'homerun', ...threeOuts) // 1회 초 1점
    for (let i = 0; i < 4; i++) g = play(g, ...threeOuts) // 1회 말 ~ 3회 초
    expect([g.inning, g.half]).toEqual([3, 'bottom'])
    g = play(g, 'homerun')
    expect(g.final).toBe(false) // 동점
    const r = applyPitch(g, 'homerun')
    expect(r.event.gameEnded).toBe(true)
    expect(r.game.final).toBe(true)
    expect(r.game.outs).toBe(0)
  })

  it('삼진 3개도 3아웃', () => {
    const g = play(createGame(), ...strikeout, ...strikeout, ...strikeout)
    expect(g.half).toBe('bottom')
    expect(g.stats.away.strikeouts).toBe(3)
  })

  it('끝난 경기에는 더 던질 수 없다', () => {
    let g = createGame()
    for (let i = 0; i < 6; i++) g = play(g, ...threeOuts)
    expect(() => applyPitch(g, 'ball')).toThrow()
  })
})
