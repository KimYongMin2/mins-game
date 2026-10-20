import { type Rng, pickOne } from '../../../shared/random'
import type { Difficulty } from '../constants'
import { type Cell, CELLS, cellPosition } from '../rules/judge'

// 투구 하나의 궤적과 시간. 시간은 performance.now()와 같은 기준(ms).
// 좌표(m): x는 포수 시점 오른쪽이 +, y는 높이, z는 홈플레이트 앞면(0)에서 투수 쪽이 +.

export type PitchType = 'fastball' | 'slider' | 'curve'

export const PITCH_TYPES: readonly PitchType[] = ['fastball', 'slider', 'curve']

export const PITCH_LABEL: Record<PitchType, string> = { fastball: '직구', slider: '슬라이더', curve: '커브' }

export type Vec3 = { x: number; y: number; z: number }

/** 스트라이크 존(m). 한 칸은 가로 0.2 × 세로 0.24 */
export const ZONE = { left: -0.3, right: 0.3, bottom: 0.5, top: 1.22 }
export const CELL_WIDTH = (ZONE.right - ZONE.left) / 3
export const CELL_HEIGHT = (ZONE.top - ZONE.bottom) / 3

/** 우완 투수가 공을 놓는 곳 (포수 시점 왼쪽 위) */
export const RELEASE: Vec3 = { x: -0.45, y: 1.8, z: 17 }
/** 포수 미트. 공이 홈을 지나 여기서 멈춘다 */
export const MITT_Z = -1.1

export const BALL_RADIUS = 0.037

/** 구종별 비행 시간(놓은 순간 → 홈 도착) */
const FLIGHT_MS: Record<Difficulty, Record<PitchType, number>> = {
  normal: { fastball: 620, slider: 710, curve: 820 },
  hard: { fastball: 510, slider: 590, curve: 680 },
}

/** 외워서 치지 못하게 비행 시간을 공마다 이만큼(±) 흔든다 */
export const FLIGHT_JITTER_MS = 25

/**
 * 궤적의 휨. break는 휘는 총량(m)과 방향, power가 클수록 홈 근처에서 늦게 휜다.
 * 위치 = 직선(놓은 곳 → 도착 칸) + break × (s^power − s). 처음과 끝은 직선과 같고 그 사이가 볼록해진다.
 */
const SHAPE: Record<PitchType, { breakX: number; breakY: number; power: number }> = {
  fastball: { breakX: 0, breakY: -0.12, power: 2 },
  slider: { breakX: 0.75, breakY: -0.2, power: 3 },
  curve: { breakX: 0.35, breakY: -1.5, power: 2.4 },
}

export type Pitch = {
  type: PitchType
  cell: Cell
  releaseAt: number
  /** 공이 홈플레이트(z=0)를 지나는 시각. 타이밍 판정 기준 */
  arriveAt: number
}

/** 칸 가운데(공이 도착하는 곳) */
export function cellCenter(cell: Cell): { x: number; y: number } {
  const { col, row } = cellPosition(cell)
  return { x: ZONE.left + CELL_WIDTH * (col + 0.5), y: ZONE.top - CELL_HEIGHT * (row + 0.5) }
}

export function createPitch(rng: Rng, difficulty: Difficulty, releaseAt: number): Pitch {
  const type = pickOne(rng, PITCH_TYPES)
  const cell = pickOne(rng, CELLS)
  const jitter = (rng.next() * 2 - 1) * FLIGHT_JITTER_MS
  return { type, cell, releaseAt, arriveAt: releaseAt + FLIGHT_MS[difficulty][type] + jitter }
}

/** 진행도 s(0=놓음, 1=홈 도착)의 위치 */
function pathAt(pitch: Pitch, s: number): Vec3 {
  const end = cellCenter(pitch.cell)
  const { breakX, breakY, power } = SHAPE[pitch.type]
  const bend = s ** power - s
  return {
    x: RELEASE.x + (end.x - RELEASE.x) * s + breakX * bend,
    y: RELEASE.y + (end.y - RELEASE.y) * s + breakY * bend,
    z: RELEASE.z * (1 - s),
  }
}

/** 시각 t의 공 위치. 놓기 전이면 null. 홈을 지난 뒤엔 그 방향 그대로 미트까지 가서 멈춘다 */
export function ballPosition(pitch: Pitch, t: number): Vec3 | null {
  if (t < pitch.releaseAt) return null
  const s = (t - pitch.releaseAt) / (pitch.arriveAt - pitch.releaseAt)
  if (s <= 1) return pathAt(pitch, s)
  const end = pathAt(pitch, 1)
  const before = pathAt(pitch, 0.99)
  const maxK = (end.z - MITT_Z) / (before.z - end.z)
  const k = Math.min((s - 1) / 0.01, maxK)
  return {
    x: end.x + (end.x - before.x) * k,
    y: end.y + (end.y - before.y) * k,
    z: end.z + (end.z - before.z) * k,
  }
}

/** 도착한 뒤 이만큼 지나면 투구가 끝난다. 가장 늦은 판정 구간(파울 160ms)보다 길어야 한다 */
export const PITCH_END_AFTER_ARRIVAL_MS = 320

export function pitchEndAt(pitch: Pitch): number {
  return pitch.arriveAt + PITCH_END_AFTER_ARRIVAL_MS
}
