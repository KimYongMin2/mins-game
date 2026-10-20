import { type Rng, pickWeighted } from '../../../shared/random'
import { type Difficulty, MAX_STACKS } from '../constants'
import { type Fighter, type Stance, sanitize } from '../rules/turn'

// 봇의 자세 고르기. 상대가 고른 것은 모르고, 지금까지 공개된 것만 본다.

type Weights = Record<Stance, number>

const w = (ready: number, guard: number, attack: number, smash = 0): Weights => ({ ready, guard, attack, smash })

/** 일반: 내 스택만 보고 대충 고른다. 꽉 차면 강타를 자주 */
function normalWeights(self: Fighter): Weights {
  if (self.stacks === 0) return w(70, 30, 0)
  if (self.stacks < MAX_STACKS) return w(40, 25, 35)
  return w(0, 15, 25, 60)
}

/** 어려움: 상대 스택과 상대가 고른 자세의 흐름을 읽는다 */
function hardWeights(self: Fighter, foe: Fighter, foeHistory: readonly Stance[]): Weights {
  const full = self.stacks >= MAX_STACKS
  let weights: Weights
  if (foe.stacks === 0) {
    // 상대가 칠 수 없으니 방어는 낭비. 모으거나, 상대가 준비할 때 친다
    if (self.stacks === 0) weights = w(100, 0, 0)
    else if (!full) weights = w(45, 0, 55)
    else weights = w(0, 0, 25, 75)
  } else if (foe.stacks >= MAX_STACKS) {
    // 상대 강타는 막을 수 없다. 같이 강타하거나, 상대가 망설일 때 친다
    if (full) weights = w(0, 10, 10, 80)
    else if (self.stacks > 0) weights = w(30, 30, 40)
    else weights = w(50, 50, 0)
  } else if (self.stacks === 0) weights = w(50, 50, 0)
  else if (!full) weights = w(25, 40, 35)
  else weights = w(0, 20, 10, 70)

  // 상대가 같은 자세를 두 번 연속 하면 또 할 거라고 보고 노린다
  const [last, before] = [foeHistory.at(-1), foeHistory.at(-2)]
  if (last && last === before) {
    if (last === 'ready' && self.stacks > 0) weights = { ...weights, attack: weights.attack + 40 }
    if (last === 'guard') weights = full ? { ...weights, smash: weights.smash + 40 } : { ...weights, ready: weights.ready + 40 }
    if (last === 'attack') weights = { ...weights, guard: weights.guard + 40 }
  }
  return weights
}

export function chooseBotStance(opts: {
  rng: Rng
  difficulty: Difficulty
  self: Fighter
  foe: Fighter
  /** 상대가 지금까지 고른 자세 (오래된 것부터) */
  foeHistory: readonly Stance[]
}): Stance {
  const { rng, difficulty, self, foe, foeHistory } = opts
  const weights = difficulty === 'hard' ? hardWeights(self, foe, foeHistory) : normalWeights(self)
  // 스택이 모자란 공격이 뽑히면 준비로 바뀐다
  return sanitize(self, pickWeighted(rng, weights))
}
