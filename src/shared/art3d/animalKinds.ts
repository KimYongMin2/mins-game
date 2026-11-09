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

// ---- 꾸미기 (모자·안경·목 장식·털 색) ----

export type Hat = 'none' | 'cap' | 'crown' | 'party' | 'beanie' | 'tophat'
export type Glasses = 'none' | 'round' | 'sun' | 'star'
export type Neck = 'none' | 'bow' | 'scarf' | 'tie'
/** 털 색: 기본 · 연하게 · 진하게 */
export type Fur = 'base' | 'light' | 'dark'

export const HATS: readonly Hat[] = ['none', 'cap', 'crown', 'party', 'beanie', 'tophat']
export const GLASSES: readonly Glasses[] = ['none', 'round', 'sun', 'star']
export const NECKS: readonly Neck[] = ['none', 'bow', 'scarf', 'tie']
export const FURS: readonly Fur[] = ['base', 'light', 'dark']

export const HAT_NAMES: Record<Hat, string> = { none: '없음', cap: '야구모자', crown: '왕관', party: '고깔', beanie: '털모자', tophat: '신사모' }
export const GLASSES_NAMES: Record<Glasses, string> = { none: '없음', round: '동그란 안경', sun: '선글라스', star: '별 안경' }
export const NECK_NAMES: Record<Neck, string> = { none: '없음', bow: '리본', scarf: '목도리', tie: '넥타이' }
export const FUR_NAMES: Record<Fur, string> = { base: '기본', light: '연하게', dark: '진하게' }

/** 내 캐릭터 = 동물 + 꾸미기 */
export type Look = { animal: AnimalKind; hat: Hat; glasses: Glasses; neck: Neck; fur: Fur }

export const plainLook = (animal: AnimalKind): Look => ({ animal, hat: 'none', glasses: 'none', neck: 'none', fur: 'base' })

const pick = <T extends string>(list: readonly T[], x: unknown, fallback: T): T => (typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : fallback)

/** 방으로 보낼 짧은 글자: '동물.모자.안경.목.털' */
export const encodeLook = (l: Look): string => [l.animal, l.hat, l.glasses, l.neck, l.fur].join('.')

/** 받은 글자·저장값 → 캐릭터 (모르는 값은 버리거나 '없음') */
export function decodeLook(x: unknown): Look | undefined {
  if (typeof x !== 'string' || x.length > 48) return undefined
  const [a, hat, glasses, neck, fur] = x.split('.')
  const animal = asAnimal(a)
  if (!animal) return undefined
  return { animal, hat: pick(HATS, hat, 'none'), glasses: pick(GLASSES, glasses, 'none'), neck: pick(NECKS, neck, 'none'), fur: pick(FURS, fur, 'base') }
}

/** assignAnimals와 같지만 꾸미기까지: 고른 사람은 그대로, 안 고른 사람은 남은 동물(꾸미기 없음) */
export function assignLooks(chosen: readonly (Look | undefined)[]): Look[] {
  const animals = assignAnimals(chosen.map((c) => c?.animal))
  return chosen.map((c, i) => c ?? plainLook(animals[i]))
}
