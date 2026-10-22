import { type Rng, pickOne } from '../../../shared/random'
import { BOT_RECALL, type Difficulty, type Length } from '../constants'
import { type Digits, type Score, allNumbers, consistent } from '../rules/numbers'

// 봇이 부를 숫자 고르기.
// 지난 결과(단서)마다 BOT_RECALL 확률로 기억해 쓰고, 기억한 단서에 모두 맞는 후보 중 하나를 부른다.
// 어려움은 단서를 다 써서 남은 후보에서만 부르고, 일반은 단서를 반쯤 잊어 헛걸음을 한다.

export function chooseBotGuess(
  rng: Rng,
  length: Length,
  clues: readonly { digits: Digits; score: Score }[],
  difficulty: Difficulty,
): number[] {
  const recall = BOT_RECALL[difficulty]
  // 바로 앞 결과는 늘 기억한다 (같은 걸 또 부르는 바보짓 방지에도 도움)
  const remembered = clues.filter((_, i) => i === clues.length - 1 || rng.next() < recall)
  const tried = new Set(clues.map((c) => c.digits.join('')))
  let pool = consistent(allNumbers(length), remembered).filter((c) => !tried.has(c.join('')))
  // 기억이 엉켜 후보가 없으면 (일반만 생김) 아무거나
  if (pool.length === 0) pool = allNumbers(length).filter((c) => !tried.has(c.join('')))
  return [...pickOne(rng, pool)]
}
