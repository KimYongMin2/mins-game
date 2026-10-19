import type { Distance } from '../constants'

/** 거리별로 화면에 보이는 범위(과녁 중심에서 가장자리까지, m). 멀수록 넓게 보여 과녁이 작아진다. */
export function viewHalfSize(distance: Distance): number {
  return 1.0 * (distance / 30) ** 0.6
}
