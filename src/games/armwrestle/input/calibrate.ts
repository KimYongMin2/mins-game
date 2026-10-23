import { PASS_MS } from '../constants'
import { LATENCY_RANGE } from './latency'

// 타이밍 맞추기 계산. 과녁을 가운데(0)에 두고, 막대는 지나갈 때마다 (n + 0.5) × PASS_MS에 가운데를 지난다.

/** 이만큼 눌러서 잰다 */
export const CALIBRATE_TAPS = 10
/** 가장 가까운 가운데 지남에서 이보다 많이 어긋나면 잘못 누른 것으로 보고 안 센다 */
const IGNORE_OVER_MS = 200

/** 막대가 돌기 시작한 뒤 elapsed ms에 누른 것이 가장 가까운 가운데 지남보다 몇 ms 늦었는지 (−면 빠름) */
export function tapError(elapsed: number): number | null {
  const n = Math.round(elapsed / PASS_MS - 0.5)
  const error = elapsed - (Math.max(0, n) + 0.5) * PASS_MS
  return Math.abs(error) > IGNORE_OVER_MS ? null : error
}

/** 잰 어긋남들로 보정값: 가운데값(중앙값, 한두 번 실수는 무시) */
export function measureLatency(errors: readonly number[]): number {
  const sorted = [...errors].sort((a, b) => a - b)
  const mid = sorted.length / 2
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.min(LATENCY_RANGE.max, Math.max(LATENCY_RANGE.min, Math.round(median)))
}
