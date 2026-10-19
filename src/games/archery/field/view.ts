import type { Distance } from '../constants'

/**
 * 거리별로 화면에 보이는 범위(과녁 중심에서 가장자리까지, m). 멀수록 넓게 보여 과녁이 작아진다.
 * 30m 0.75m · 100m 약 1.3m — 100m 강한 바람에 밀리는 거리(약 0.63m)를 보정해 조준할 여유가 있다.
 */
export function viewHalfSize(distance: Distance): number {
  return 0.75 * (distance / 30) ** 0.45
}
