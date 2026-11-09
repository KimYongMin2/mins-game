// 동물 캐릭터 목록 (three.js 없이 — 메인 화면 고르기·저장·방 정보에서도 쓰려고 따로 둠)

export type AnimalKind = 'bear' | 'cat' | 'fox' | 'rabbit' | 'panda' | 'dog' | 'pig' | 'frog'

/** 고르지 않은 사람·봇은 아무도 안 고른 동물을 이 순서로 받는다 */
export const ANIMALS: readonly AnimalKind[] = ['bear', 'cat', 'fox', 'rabbit', 'panda', 'dog', 'pig', 'frog']

export const ANIMAL_NAMES: Record<AnimalKind, string> = {
  bear: '곰',
  cat: '고양이',
  fox: '여우',
  rabbit: '토끼',
  panda: '판다',
  dog: '강아지',
  pig: '돼지',
  frog: '개구리',
}

/** 고르는 화면에서 보여 줄 그림 */
export const ANIMAL_EMOJI: Record<AnimalKind, string> = {
  bear: '🐻',
  cat: '🐱',
  fox: '🦊',
  rabbit: '🐰',
  panda: '🐼',
  dog: '🐶',
  pig: '🐷',
  frog: '🐸',
}

/** 모르는 값(옛 저장값·남이 보낸 이상한 값)은 버린다 */
export function asAnimal(x: unknown): AnimalKind | undefined {
  return typeof x === 'string' && (ANIMALS as readonly string[]).includes(x) ? (x as AnimalKind) : undefined
}

/**
 * 사람마다 동물을 정한다: 고른 사람은 그대로(겹쳐도 됨), 안 고른 사람(봇 포함)은 아무도 안 고른 동물을 차례로.
 * 다 쓰였으면 다시 처음부터
 */
export function assignAnimals(chosen: readonly (AnimalKind | undefined)[]): AnimalKind[] {
  const used = new Set(chosen.filter((x): x is AnimalKind => !!x))
  const free = ANIMALS.filter((a) => !used.has(a))
  let k = 0
  return chosen.map((c) => c ?? (free.length ? free[k++ % free.length] : ANIMALS[k++ % ANIMALS.length]))
}
