import type { PitchCall, PitchType } from '../play/pitch'
import { type Rng, chance, pickWeighted } from '../play/random'
import { type Difficulty, type SwingResult, diffForResult } from '../rules/judge'
import type { Count } from './pitcherBot'

/** 스윙하면 공 도착 기준 몇 ms에 휘두르는지. 판정은 일반 난이도 구간으로 한다. */
export type BotSwing = { swing: false } | { swing: true; diffMs: number }

type Weights = Record<SwingResult, number>

/**
 * 스윙했을 때 결과 비율(%). '정타'는 배트에 제대로 맞아 페어가 된 타구(범타 이상)로 본다.
 * 일반: 스트라이크에 80% 스윙 × 페어 62.5% ≈ 스트라이크의 50%가 정타.
 */
const NORMAL_WEIGHTS: Weights = {
  homerun: 6.25,
  double: 9.4,
  single: 21.85,
  out: 25,
  foul: 20,
  miss: 17.5,
}

const HARD_WEIGHTS: Weights = {
  homerun: 7.8,
  double: 11.7,
  single: 22.75,
  out: 22.75,
  foul: 20,
  miss: 15,
}

/** 지금 공과 같은 구종이 직전에 몇 번 연속으로 왔는지 (최대 2) */
function repeats(type: PitchType, recentTypes: readonly PitchType[]): number {
  let n = 0
  for (let i = recentTypes.length - 1; i >= 0 && recentTypes[i] === type && n < 2; i--) n++
  return n
}

function swingChance(difficulty: Difficulty, pitch: PitchCall, count: Count): number {
  if (difficulty === 'normal') return pitch.isBall ? 0.45 : 0.8
  // 어려움: 볼을 잘 참는다. 2스트라이크면 조금 더 걷어낸다.
  if (pitch.isBall) return count.strikes === 2 ? 0.25 : 0.15
  return 0.85
}

/**
 * 봇 타자의 스윙 결정.
 * - 일반: 스트라이크에 약 50% 정타, 볼에도 자주 스윙
 * - 어려움: 볼을 잘 참고, 같은 구종이 반복되면 더 잘 친다
 * 볼에 스윙한 결과의 한 단계 하향은 판정(judgeSwing)에서 처리된다.
 */
export function botDecideSwing(
  difficulty: Difficulty,
  pitch: PitchCall,
  count: Count,
  recentTypes: readonly PitchType[],
  rng: Rng,
): BotSwing {
  if (!chance(rng, swingChance(difficulty, pitch, count))) return { swing: false }

  let weights = difficulty === 'normal' ? NORMAL_WEIGHTS : HARD_WEIGHTS
  if (difficulty === 'hard') {
    const r = repeats(pitch.type, recentTypes)
    if (r > 0) {
      // 반복될수록 헛스윙·파울이 줄고 좋은 타구가 는다.
      const boost = 1 + 0.25 * r
      weights = {
        homerun: weights.homerun * boost,
        double: weights.double * boost,
        single: weights.single * boost,
        out: weights.out,
        foul: weights.foul * (1 - 0.2 * r),
        miss: weights.miss * (1 - 0.35 * r),
      }
    }
  }

  const target = pickWeighted(rng, weights)
  return { swing: true, diffMs: diffForResult(target, rng.next) }
}
