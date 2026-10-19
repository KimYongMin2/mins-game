import type { PitchCall, PitchType } from '../play/pitch'
import { type Rng, chance, pickOne } from '../../../shared/random'
import type { Difficulty } from '../rules/judge'

export type Count = { balls: number; strikes: number }

/** 어려움: 볼카운트에 따라 스트라이크를 던질 확률 */
function hardStrikeChance({ balls, strikes }: Count): number {
  if (balls === 3) return 0.75 // 볼넷 위기면 승부
  if (strikes === 2) return 0.3 // 유리하면 볼로 유인
  if (balls > strikes) return 0.6 // 불리하면 카운트 잡기
  return 0.5
}

/**
 * 봇 투수의 투구 선택.
 * - 일반: 무작위, 스트라이크 약 50%
 * - 어려움: 볼카운트를 보고 스트라이크/볼을 정하고, 같은 구종이 반복되지 않게 섞는다
 * recentTypes는 최근 투구 구종(마지막이 가장 최근).
 */
export function botChoosePitch(
  difficulty: Difficulty,
  count: Count,
  recentTypes: readonly PitchType[],
  rng: Rng,
): PitchCall {
  const height = pickOne(rng, ['high', 'low'] as const)

  if (difficulty === 'normal') {
    return {
      type: pickOne(rng, ['fastball', 'breaking'] as const),
      isBall: !chance(rng, 0.5),
      height,
    }
  }

  const [prev2, prev1] = recentTypes.slice(-2)
  let type: PitchType
  if (prev1 && prev1 === prev2) {
    // 같은 구종을 두 번 던졌으면 대체로 바꾼다.
    const other: PitchType = prev1 === 'fastball' ? 'breaking' : 'fastball'
    type = chance(rng, 0.75) ? other : prev1
  } else {
    type = chance(rng, 0.45) ? 'breaking' : 'fastball'
  }
  return { type, isBall: !chance(rng, hardStrikeChance(count)), height }
}
