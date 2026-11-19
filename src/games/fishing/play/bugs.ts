import type { Catch, Iro, Rarity } from './fish'

// 낚시터 곤충 채집 (사용자와 정함 2026-11-19): 숲(나무 가까이)·꽃밭(꽃밭·밭)에 가면 낚시처럼 [채집] → 기다리면 입질 → 잡기.
// 물고기와 같은 등급 비율·이로치 7가지, 25종 + 꽝 3개(나뭇잎·나뭇가지·거미줄). 낮·밤에 나오는 곤충이 다름(낚시터 시계).
// 잡히는 곤충·크기·이로치는 서버가 정한다 — 이 파일은 서버 심판과 화면이 같이 씀. 그림은 field/bugArt.ts.

export type Habitat = 'forest' | 'meadow'
export type BugTime = 'day' | 'night' | 'any'
export type BugDef = { id: string; name: string; rarity: Rarity; zone: Habitat | 'both'; time: BugTime; min: number; max: number; bug: true }

const b = (id: string, name: string, rarity: Rarity, zone: Habitat | 'both', time: BugTime, min: number, max: number): BugDef => ({ id, name, rarity, zone, time, min, max, bug: true })

export const BUGS: BugDef[] = [
  // 흔함 8
  b('whitebfly', '배추흰나비', 'common', 'meadow', 'day', 4, 6),
  b('ladybug', '무당벌레', 'common', 'meadow', 'any', 0.5, 1),
  b('reddfly', '고추잠자리', 'common', 'meadow', 'day', 4, 5),
  b('grasshopper', '메뚜기', 'common', 'meadow', 'day', 3, 6),
  b('cricket', '귀뚜라미', 'common', 'meadow', 'night', 1.5, 3),
  b('honeybee', '꿀벌', 'common', 'meadow', 'day', 1, 1.6),
  b('ant', '개미', 'common', 'forest', 'any', 0.5, 1.5),
  b('cicada', '매미', 'common', 'forest', 'day', 3, 6),
  // 보통 7
  b('swallowtail', '호랑나비', 'normal', 'meadow', 'day', 8, 12),
  b('mantis', '사마귀', 'normal', 'meadow', 'any', 6, 10),
  b('longhopper', '방아깨비', 'normal', 'meadow', 'day', 4, 10),
  b('bigdfly', '왕잠자리', 'normal', 'meadow', 'day', 7, 9),
  b('chafer', '풍뎅이', 'normal', 'forest', 'day', 1.5, 3),
  b('firefly', '반딧불이', 'normal', 'forest', 'night', 1, 1.8),
  b('stick', '대벌레', 'normal', 'forest', 'any', 7, 12),
  // 희귀 5
  b('stag', '사슴벌레', 'rare', 'forest', 'night', 3, 8),
  b('rhino', '장수풍뎅이', 'rare', 'forest', 'night', 4, 8.5),
  b('longhorn', '하늘소', 'rare', 'forest', 'day', 3, 5),
  b('jewel', '비단벌레', 'rare', 'forest', 'day', 3, 4),
  b('morpho', '모르포나비', 'rare', 'meadow', 'day', 10, 15),
  // 영웅 3
  b('bighorn', '장수하늘소', 'epic', 'forest', 'day', 7, 11),
  b('atlas', '아틀라스나방', 'epic', 'forest', 'night', 20, 28),
  b('goliath', '골리앗꽃무지', 'epic', 'forest', 'any', 6, 11),
  // 전설 2
  b('hercules', '헤라클레스장수풍뎅이', 'legend', 'forest', 'night', 12, 17),
  b('birdwing', '여왕새날개나비', 'legend', 'meadow', 'day', 20, 28),
  // 꽝 3 (어디서나)
  b('leaf', '나뭇잎', 'junk', 'both', 'any', 0, 0),
  b('twig', '나뭇가지', 'junk', 'both', 'any', 0, 0),
  b('web', '거미줄', 'junk', 'both', 'any', 0, 0),
]

export const bugById = (id: string) => BUGS.find((x) => x.id === id)
export const isBugId = (id: string) => !!bugById(id)
/** 도감에 칸이 있는 곤충 (꽝 빼고) */
export const DEX_BUGS = BUGS.filter((x) => x.rarity !== 'junk')
export const HABITAT_NAME: Record<Habitat, string> = { forest: '숲', meadow: '꽃밭' }
export const TIME_NAME: Record<BugTime, string> = { day: '낮', night: '밤', any: '언제나' }
/** 밤 = 낚시터 시계로 저녁 7시 ~ 아침 5시 */
export const isNightHour = (h: number) => h >= 19 || h < 5

/**
 * 잡힌 곤충 정하기 (서버 난수): 등급(물고기와 같은 비율) → 그곳·그 시간에 나오는 그 등급 곤충 → 크기 → 이로치.
 * 그 등급이 없으면 한 단계 아래로.
 */
export function rollBug(rand: () => number, zone: Habitat, night: boolean, weights: Record<Rarity, number>, iros: { id: Iro; odds: number }[]): Catch {
  const total = Object.values(weights).reduce((a, w) => a + w, 0)
  let pick = rand() * total
  let rarity: Rarity = 'common'
  for (const [k, w] of Object.entries(weights) as [Rarity, number][]) {
    pick -= w
    if (pick < 0) {
      rarity = k
      break
    }
  }
  const fits = (x: BugDef) => (x.zone === zone || x.zone === 'both') && (x.time === 'any' || (x.time === 'night') === night)
  let pool = BUGS.filter((x) => x.rarity === rarity && fits(x))
  const order: Rarity[] = ['legend', 'epic', 'rare', 'normal', 'common']
  for (let i = order.indexOf(rarity); pool.length === 0 && i >= 0 && i < order.length - 1; i++) pool = BUGS.filter((x) => x.rarity === order[i + 1] && fits(x))
  if (pool.length === 0) pool = BUGS.filter((x) => x.rarity === 'common' && x.zone === zone)
  const bug = pool[Math.floor(rand() * pool.length)]
  if (bug.rarity === 'junk') return { fish: bug.id, iro: null, size: 0 }
  const size = Math.round((bug.min + (bug.max - bug.min) * Math.pow(rand(), 1.6)) * 10) / 10
  let r = rand() * 100
  let iro: Iro | null = null
  for (const x of iros) {
    r -= x.odds
    if (r < 0) {
      iro = x.id
      break
    }
  }
  return { fish: bug.id, iro, size }
}
