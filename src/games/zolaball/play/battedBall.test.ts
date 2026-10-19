import { describe, expect, it } from 'vitest'
import { FENCE_DISTANCE, FENCE_HEIGHT } from '../constants'
import { type BattedKind, battedBallPosition, createBattedBall, standsHeightAt } from './battedBall'
import { createRng } from './random'

const START = { x: 0, y: 1.1 }

function many(kind: BattedKind, n = 300) {
  const rng = createRng(5)
  return Array.from({ length: n }, () => createBattedBall(kind, START, 1000, rng))
}

/** 공이 x를 지날 때의 높이 */
function heightAtX(ball: ReturnType<typeof createBattedBall>, x: number) {
  const u = (x - ball.start.x) / (ball.end.x - ball.start.x)
  return battedBallPosition(ball, ball.startAt + ball.duration * u).y
}

describe('battedBall', () => {
  it('시작 시점에는 배트 위치, 끝나면 떨어진 지점에 머문다', () => {
    const [b] = many('double', 1)
    expect(battedBallPosition(b, b.startAt)).toEqual(START)
    expect(battedBallPosition(b, b.startAt + b.duration)).toEqual(b.end)
    expect(battedBallPosition(b, b.startAt + b.duration + 5000)).toEqual(b.end)
  })

  it('홈런은 항상 펜스를 넘어 관중석에 떨어진다', () => {
    for (const b of many('homerun')) {
      expect(heightAtX(b, FENCE_DISTANCE)).toBeGreaterThan(FENCE_HEIGHT)
      expect(b.end.y).toBe(standsHeightAt(b.end.x))
      expect(b.end.y).toBeGreaterThan(0)
    }
  })

  it('홈런이 아닌 타구는 펜스 앞 그라운드에 떨어진다', () => {
    for (const kind of ['out', 'single', 'double'] as const) {
      for (const b of many(kind)) {
        expect(b.end.x).toBeLessThan(FENCE_DISTANCE)
        expect(b.end.x).toBeGreaterThan(0)
        expect(b.end.y).toBe(0)
      }
    }
  })

  it('파울은 뒤쪽으로 간다', () => {
    for (const b of many('foul')) expect(b.end.x).toBeLessThan(0)
  })

  it('비행 중에는 땅 아래로 내려가지 않는다', () => {
    for (const kind of ['foul', 'out', 'single', 'double', 'homerun'] as const) {
      for (const b of many(kind, 30)) {
        for (let i = 0; i <= 20; i++) {
          expect(battedBallPosition(b, b.startAt + (b.duration * i) / 20).y).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
