// 타이밍 판정. 화면·입력과 무관한 순수 함수만 둔다.

export type Difficulty = 'normal' | 'hard'

/** 스윙 결과. 좋은 것부터 나쁜 것 순서. */
export const SWING_RESULTS = ['homerun', 'double', 'single', 'out', 'foul', 'miss'] as const
export type SwingResult = (typeof SWING_RESULTS)[number]

/** 일반 난이도 기준 판정 구간 (공 도착과 스윙 시점 차이의 절댓값, ms 이하). */
const WINDOWS: ReadonlyArray<readonly [maxDiffMs: number, result: SwingResult]> = [
  [25, 'homerun'],
  [50, 'double'],
  [85, 'single'],
  [120, 'out'],
  [170, 'foul'],
]

/** 난이도별 구간 폭(%). 85 × 0.7 같은 소수 곱의 부동소수점 오차를 피하려고 정수 백분율로 계산한다. */
const WINDOW_PERCENT: Record<Difficulty, number> = {
  normal: 100,
  hard: 70,
}

type JudgeInput = {
  /** 스윙 시점 − 공 도착 시점 (ms). 음수면 빠름, 양수면 늦음. */
  diffMs: number
  difficulty: Difficulty
  /** 볼(스트라이크 존 밖)에 스윙했는지. 볼에 스윙하면 타이밍과 상관없이 헛스윙. */
  pitchIsBall: boolean
}

export function judgeSwing({ diffMs, difficulty, pitchIsBall }: JudgeInput): SwingResult {
  if (pitchIsBall) return 'miss'
  const percent = WINDOW_PERCENT[difficulty]
  const abs = Math.abs(diffMs)
  const hit = WINDOWS.find(([max]) => abs * 100 <= max * percent)
  return hit ? hit[1] : 'miss'
}

/**
 * 일반 난이도에서 주어진 결과가 나오는 스윙 시각 차이(ms)를 하나 고른다. 봇 타자가 쓴다.
 * random은 0 이상 1 미만 값을 돌려주는 함수.
 */
export function diffForResult(result: SwingResult, random: () => number): number {
  const i = SWING_RESULTS.indexOf(result)
  const min = i === 0 ? 0 : WINDOWS[i - 1][0] + 1
  const max = i < WINDOWS.length ? WINDOWS[i][0] : 300
  const abs = min + random() * (max - min)
  return random() < 0.5 ? -abs : abs
}
