// 시드 기반 난수(mulberry32). 리듀서를 순수하게 유지하고 테스트를 재현 가능하게 하려고 쓴다.
export type Rng = {
  /** 0 이상 1 미만 */
  next: () => number
  /** 다음 상태에 저장할 시드 */
  seed: () => number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    seed: () => s,
  }
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p
}

export function pickOne<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng.next() * values.length)]
}

/** 가중치에 따라 하나를 고른다. */
export function pickWeighted<T extends string>(rng: Rng, weights: Readonly<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = rng.next() * total
  for (const [value, w] of entries) {
    r -= w
    if (r < 0) return value
  }
  return entries[entries.length - 1][0]
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}
