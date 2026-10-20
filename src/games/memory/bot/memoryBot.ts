import { type Rng, pickOne } from '../../../shared/random'

// 봇이 열 카드를 고른다. 봇은 자기 기억(memory)만 보고, 실제 카드 그림은 모른다.

export type BotView = {
  /** 카드별로 봇이 기억하는 그림. 모르면 null */
  memory: readonly (number | null)[]
  /** 아직 가져가지 않은 카드인지 */
  available: readonly boolean[]
  /** 이번 차례에 이미 연 카드 (없으면 null) */
  first: { index: number; face: number } | null
}

/** 열 수 있는 카드 중 기억에 없는 것을 우선, 없으면 아무거나 */
function unknownOrAny(rng: Rng, view: BotView, exclude: number | null): number {
  const open = view.available.flatMap((ok, i) => (ok && i !== exclude ? [i] : []))
  const unknown = open.filter((i) => view.memory[i] === null)
  return pickOne(rng, unknown.length > 0 ? unknown : open)
}

export function chooseBotCard(rng: Rng, view: BotView): number {
  const known = (i: number) => view.available[i] && view.memory[i] !== null
  if (view.first) {
    const { index, face } = view.first
    const pair = view.memory.findIndex((f, i) => i !== index && known(i) && f === face)
    return pair >= 0 ? pair : unknownOrAny(rng, view, index)
  }
  // 기억 속에 같은 그림이 두 장 있으면 그 쌍을 연다
  const seen = new Map<number, number>()
  for (let i = 0; i < view.memory.length; i++) {
    if (!known(i)) continue
    const f = view.memory[i]!
    if (seen.has(f)) return seen.get(f)!
    seen.set(f, i)
  }
  return unknownOrAny(rng, view, null)
}
