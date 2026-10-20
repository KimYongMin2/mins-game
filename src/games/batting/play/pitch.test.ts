import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { CELLS } from '../rules/judge'
import { project, zoneRect } from '../field/view'
import {
  FLIGHT_JITTER_MS,
  MITT_Z,
  PITCH_TYPES,
  type Pitch,
  RELEASE,
  ZONE,
  ballPosition,
  cellCenter,
  createPitch,
} from './pitch'

const pitch = (type: Pitch['type'], cell: Pitch['cell'] = 5): Pitch => ({ type, cell, releaseAt: 0, arriveAt: 600 })

describe('cellCenter', () => {
  it('1번은 왼쪽 위, 9번은 오른쪽 아래, 5번은 존 가운데', () => {
    const c1 = cellCenter(1)
    const c9 = cellCenter(9)
    const c5 = cellCenter(5)
    expect(c1.x).toBeLessThan(c5.x)
    expect(c1.y).toBeGreaterThan(c5.y)
    expect(c9.x).toBeGreaterThan(c5.x)
    expect(c5.x).toBeCloseTo(0)
    expect(c5.y).toBeCloseTo((ZONE.top + ZONE.bottom) / 2)
  })
})

describe('ballPosition', () => {
  it('놓기 전에는 없음, 놓는 순간은 투수 손', () => {
    const p = pitch('fastball')
    expect(ballPosition(p, -1)).toBeNull()
    expect(ballPosition(p, 0)).toEqual(RELEASE)
  })

  it.each(PITCH_TYPES)('%s는 도착 시각에 정확히 그 칸 가운데를 지난다', (type) => {
    for (const cell of CELLS) {
      const at = ballPosition(pitch(type, cell), 600)!
      const c = cellCenter(cell)
      expect(at.x).toBeCloseTo(c.x)
      expect(at.y).toBeCloseTo(c.y)
      expect(at.z).toBeCloseTo(0)
    }
  })

  it('커브는 중간에 직구보다 높이 떴다가 떨어진다', () => {
    const mid = (type: Pitch['type']) => ballPosition(pitch(type), 300)!.y
    expect(mid('curve')).toBeGreaterThan(mid('fastball') + 0.2)
  })

  it('슬라이더는 홈 근처에서 오른쪽으로 휜다 (늦게 휘어 중간까지는 직구와 비슷)', () => {
    const x = (type: Pitch['type'], t: number) => ballPosition(pitch(type), t)!.x
    // 직선보다 왼쪽에서 오다가 끝에 오른쪽으로 들어온다
    expect(x('slider', 450)).toBeLessThan(x('fastball', 450) - 0.1)
    const late = x('slider', 600) - x('slider', 540)
    const lateFast = x('fastball', 600) - x('fastball', 540)
    expect(late).toBeGreaterThan(lateFast + 0.05)
  })

  it('홈을 지난 뒤에는 미트에서 멈춘다', () => {
    const p = pitch('fastball')
    const a = ballPosition(p, 900)!
    const b = ballPosition(p, 2000)!
    expect(a.z).toBeCloseTo(MITT_Z)
    expect(b).toEqual(a)
  })
})

describe('createPitch', () => {
  it('구종·칸은 고르게, 도착 시간은 조금씩 다르게', () => {
    const rng = createRng(7)
    const pitches = Array.from({ length: 900 }, () => createPitch(rng, 'normal', 0))
    for (const type of PITCH_TYPES) {
      const n = pitches.filter((p) => p.type === type).length
      expect(n).toBeGreaterThan(240)
    }
    for (const cell of CELLS) expect(pitches.filter((p) => p.cell === cell).length).toBeGreaterThan(70)
    const fast = pitches.filter((p) => p.type === 'fastball').map((p) => p.arriveAt)
    expect(Math.max(...fast) - Math.min(...fast)).toBeGreaterThan(FLIGHT_JITTER_MS)
    expect(Math.max(...fast) - Math.min(...fast)).toBeLessThanOrEqual(FLIGHT_JITTER_MS * 2)
  })

  it('어려움은 같은 구종이 더 빨리 도착한다', () => {
    const avg = (difficulty: 'normal' | 'hard') => {
      const rng = createRng(3)
      const ps = Array.from({ length: 300 }, () => createPitch(rng, difficulty, 0)).filter((p) => p.type === 'curve')
      return ps.reduce((s, p) => s + p.arriveAt, 0) / ps.length
    }
    expect(avg('hard')).toBeLessThan(avg('normal') - 80)
  })
})

describe('project', () => {
  it('존은 화면 가운데에 좌우 대칭, 멀수록 작게', () => {
    const z = zoneRect()
    expect(z.x + z.width / 2).toBeCloseTo(180)
    expect(z.width).toBeGreaterThan(150)
    expect(project({ x: 0, y: 1, z: 10 }).scale).toBeLessThan(project({ x: 0, y: 1, z: 0 }).scale / 3)
  })

  it('투수 손은 존보다 위에 보인다', () => {
    expect(project(RELEASE).y).toBeLessThan(zoneRect().y)
  })

  it.each(PITCH_TYPES)('%s는 어느 칸으로 와도 화면 위로 나가지 않는다', (type) => {
    for (const cell of CELLS) {
      const p = pitch(type, cell)
      for (let t = 0; t <= 600; t += 4) expect(project(ballPosition(p, t)!).y).toBeGreaterThan(0)
    }
  })

  it('공은 다가올수록 커진다', () => {
    const p = pitch('curve')
    let last = 0
    for (let t = 0; t <= 600; t += 50) {
      const s = project(ballPosition(p, t)!).scale
      expect(s).toBeGreaterThan(last)
      last = s
    }
  })
})
