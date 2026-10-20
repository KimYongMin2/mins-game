import { type Rng, pickWeighted } from '../../../shared/random'
import { BOT_TAP_RATE, type Difficulty } from '../constants'
import type { Grade } from '../rules/timing'

// 팔씨름 봇. 연타는 속도를, 타이밍은 판정을 확률로 정한다.

/** 다음 연타까지 걸리는 시간 (평균 속도에서 ±30% 흔듦) */
export function botTapGap(rng: Rng, difficulty: Difficulty): number {
  return (1000 / BOT_TAP_RATE[difficulty]) * (0.7 + rng.next() * 0.6)
}

const GRADE_WEIGHTS: Record<Difficulty, Record<Grade, number>> = {
  normal: { perfect: 10, great: 30, good: 35, miss: 25 },
  hard: { perfect: 30, great: 40, good: 25, miss: 5 },
}

export function botGrade(rng: Rng, difficulty: Difficulty): Grade {
  return pickWeighted(rng, GRADE_WEIGHTS[difficulty])
}
