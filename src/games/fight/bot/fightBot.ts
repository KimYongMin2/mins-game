import { type Rng, pickWeighted } from '../../../shared/random'
import { MAX_STACKS, type Difficulty } from '../constants'
import { type Fighter, type Stance, sanitize } from '../rules/turn'

// 봇의 자세 고르기. 상대가 고른 것은 모르고, 지금까지 공개된 것만 본다.

type Weights = Record<Stance, number>

/** 일반: 내 스택만 보고 대충 고른다 */
function normalWeights(self: Fighter): Weights {
  if (self.stacks === 0) return { ready: 70, guard: 30, attack: 0 }
  if (self.stacks < MAX_STACKS) return { ready: 40, guard: 25, attack: 35 }
  return { ready: 0, guard: 30, attack: 70 }
}

/** 어려움: 상대 스택과 상대가 고른 자세의 흐름을 읽는다 */
function hardWeights(self: Fighter, foe: Fighter, foeHistory: readonly Stance[]): Weights {
  let w: Weights
  if (foe.stacks === 0) {
    // 상대가 칠 수 없으니 방어는 낭비. 모으거나, 상대가 준비할 때 친다
    if (self.stacks === 0) w = { ready: 100, guard: 0, attack: 0 }
    else if (self.stacks < MAX_STACKS) w = { ready: 45, guard: 0, attack: 55 }
    else w = { ready: 35, guard: 0, attack: 65 }
  } else if (self.stacks === 0) w = { ready: 50, guard: 50, attack: 0 }
  else if (self.stacks < MAX_STACKS) w = { ready: 25, guard: 40, attack: 35 }
  else w = { ready: 0, guard: 40, attack: 60 }

  // 상대가 같은 자세를 두 번 연속 하면 또 할 거라고 보고 노린다
  const [last, before] = [foeHistory.at(-1), foeHistory.at(-2)]
  if (last && last === before) {
    if (last === 'ready' && self.stacks > 0) w = { ...w, attack: w.attack + 40 }
    if (last === 'guard') w = { ...w, ready: w.ready + 40 }
    if (last === 'attack') w = { ...w, guard: w.guard + 40 }
  }
  return w
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
  const w = difficulty === 'hard' ? hardWeights(self, foe, foeHistory) : normalWeights(self)
  // 스택이 꽉 찼을 때 준비는 의미가 없지만, 가중치가 전부 0이 되는 일은 없게 둔다
  return sanitize(self, pickWeighted(rng, w))
}
