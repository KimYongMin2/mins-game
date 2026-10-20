import { type Rng, pickWeighted } from '../../../shared/random'

// 윷 던지기 결과. 윷가락 넷이 각각 반반으로 뒤집히고, 하나에 빽도 표시가 있다고 친 확률.

export type Throw = 'backdo' | 'do' | 'gae' | 'geol' | 'yut' | 'mo'

export const THROWS: readonly Throw[] = ['backdo', 'do', 'gae', 'geol', 'yut', 'mo']

export const THROW_LABEL: Record<Throw, string> = { backdo: '빽도', do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' }

/** 움직이는 칸 수 (빽도 = 뒤로 한 칸) */
export const STEPS: Record<Throw, number> = { backdo: -1, do: 1, gae: 2, geol: 3, yut: 4, mo: 5 }

/** 16번 중 몇 번 */
export const THROW_WEIGHTS: Record<Throw, number> = { backdo: 1, do: 3, gae: 6, geol: 4, yut: 1, mo: 1 }

export function throwYut(rng: Rng): Throw {
  return pickWeighted(rng, THROW_WEIGHTS)
}

/** 나오면 한 번 더 던지는 결과 */
export const isBonus = (t: Throw): boolean => t === 'yut' || t === 'mo'
