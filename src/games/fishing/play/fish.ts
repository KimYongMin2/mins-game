// 낚시터 물고기 (사용자와 정함 2026-11-17): 25종 + 꽝 3개, 이로치 7가지. 그림은 field/fishArt.ts.
// 잡히는 물고기·크기·이로치는 서버가 정한다(가짜 물고기 막기) — 이 파일은 서버 심판과 화면이 같이 씀.

export type Zone = 'sea' | 'fresh'
export type Rarity = 'common' | 'normal' | 'rare' | 'epic' | 'legend' | 'junk'
export type FishDef = { id: string; name: string; rarity: Rarity; zone: Zone | 'both'; min: number; max: number }

export const FISH: FishDef[] = [
  // 흔함 8
  { id: 'crucian', name: '붕어', rarity: 'common', zone: 'fresh', min: 10, max: 30 },
  { id: 'carp', name: '잉어', rarity: 'common', zone: 'fresh', min: 30, max: 80 },
  { id: 'mackerel', name: '고등어', rarity: 'common', zone: 'sea', min: 20, max: 45 },
  { id: 'seabass', name: '농어', rarity: 'common', zone: 'sea', min: 30, max: 90 },
  { id: 'flounder', name: '가자미', rarity: 'common', zone: 'sea', min: 20, max: 40 },
  { id: 'crab', name: '꽃게', rarity: 'common', zone: 'sea', min: 15, max: 25 },
  { id: 'squid', name: '오징어', rarity: 'common', zone: 'sea', min: 20, max: 40 },
  { id: 'jelly', name: '해파리', rarity: 'common', zone: 'sea', min: 10, max: 40 },
  // 보통 7
  { id: 'redbream', name: '참돔', rarity: 'normal', zone: 'sea', min: 25, max: 70 },
  { id: 'halibut', name: '광어', rarity: 'normal', zone: 'sea', min: 30, max: 80 },
  { id: 'salmon', name: '연어', rarity: 'normal', zone: 'fresh', min: 50, max: 90 },
  { id: 'cutlass', name: '갈치', rarity: 'normal', zone: 'sea', min: 60, max: 120 },
  { id: 'puffer', name: '복어', rarity: 'normal', zone: 'sea', min: 15, max: 40 },
  { id: 'crayfish', name: '가재', rarity: 'normal', zone: 'fresh', min: 8, max: 15 },
  { id: 'octopus', name: '문어', rarity: 'normal', zone: 'sea', min: 30, max: 100 },
  // 희귀 5
  { id: 'eel', name: '장어', rarity: 'rare', zone: 'fresh', min: 40, max: 100 },
  { id: 'ray', name: '가오리', rarity: 'rare', zone: 'sea', min: 50, max: 150 },
  { id: 'seahorse', name: '해마', rarity: 'rare', zone: 'sea', min: 5, max: 20 },
  { id: 'angler', name: '아귀', rarity: 'rare', zone: 'sea', min: 30, max: 100 },
  { id: 'tuna', name: '참치', rarity: 'rare', zone: 'sea', min: 80, max: 250 },
  // 영웅 3
  { id: 'shark', name: '상어', rarity: 'epic', zone: 'sea', min: 150, max: 400 },
  { id: 'marlin', name: '청새치', rarity: 'epic', zone: 'sea', min: 150, max: 350 },
  { id: 'sunfish', name: '개복치', rarity: 'epic', zone: 'sea', min: 100, max: 300 },
  // 전설 2
  { id: 'coelacanth', name: '실러캔스', rarity: 'legend', zone: 'sea', min: 100, max: 200 },
  { id: 'sturgeon', name: '철갑상어', rarity: 'legend', zone: 'fresh', min: 100, max: 300 },
  // 꽝 3 (어디서나)
  { id: 'boot', name: '장화', rarity: 'junk', zone: 'both', min: 0, max: 0 },
  { id: 'can', name: '깡통', rarity: 'junk', zone: 'both', min: 0, max: 0 },
  { id: 'kelp', name: '미역', rarity: 'junk', zone: 'both', min: 0, max: 0 },
]

export const fishById = (id: string) => FISH.find((f) => f.id === id)
/** 도감에 칸이 있는 물고기 (꽝 빼고) */
export const DEX_FISH = FISH.filter((f) => f.rarity !== 'junk')

export const RARITY: Record<Rarity, { name: string; color: string; weight: number }> = {
  common: { name: '흔함', color: '#c9c4f0', weight: 52 },
  normal: { name: '보통', color: '#6fdc9a', weight: 27 },
  rare: { name: '희귀', color: '#5be0f0', weight: 10 },
  epic: { name: '영웅', color: '#c79bff', weight: 3 },
  legend: { name: '전설', color: '#ffd23f', weight: 0.6 },
  junk: { name: '꽝', color: '#8f8ab8', weight: 7.4 },
}

/** 이로치: 어떤 물고기든 드물게 다른 색 (꽝은 없음). 확률은 % */
export type Iro = 'silver' | 'sakura' | 'gold' | 'neon' | 'obsidian' | 'ghost' | 'rainbow'
export const IRO: { id: Iro; name: string; odds: number; color: string }[] = [
  { id: 'silver', name: '은빛', odds: 3, color: '#e6ebf5' },
  { id: 'sakura', name: '벚꽃', odds: 1, color: '#ffb3cf' },
  { id: 'gold', name: '금빛', odds: 1, color: '#ffd23f' },
  { id: 'neon', name: '형광', odds: 0.5, color: '#7dff9a' },
  { id: 'obsidian', name: '흑요석', odds: 0.5, color: '#b9a3ff' },
  { id: 'ghost', name: '유령', odds: 0.3, color: '#d6f6ff' },
  { id: 'rainbow', name: '무지개', odds: 0.1, color: '#ff9adf' },
]
export const iroById = (id: string | null | undefined) => IRO.find((x) => x.id === id) ?? null

export type Catch = { fish: string; iro: Iro | null; size: number }

/** 잡힌 것 정하기 (rand = 0~1 난수, 서버 것): 등급 → 그 물가에 사는 그 등급 물고기 중 하나 → 크기 → 이로치 */
export function rollCatch(rand: () => number, zone: Zone): Catch {
  const total = Object.values(RARITY).reduce((a, r) => a + r.weight, 0)
  let pick = rand() * total
  let rarity: Rarity = 'common'
  for (const [k, r] of Object.entries(RARITY) as [Rarity, (typeof RARITY)[Rarity]][]) {
    pick -= r.weight
    if (pick < 0) {
      rarity = k
      break
    }
  }
  let pool = FISH.filter((f) => f.rarity === rarity && (f.zone === zone || f.zone === 'both'))
  // 그 물가에 그 등급이 없으면(민물 영웅 등) 한 단계 아래로
  const order: Rarity[] = ['legend', 'epic', 'rare', 'normal', 'common']
  for (let i = order.indexOf(rarity); pool.length === 0 && i >= 0 && i < order.length - 1; i++) pool = FISH.filter((f) => f.rarity === order[i + 1] && f.zone === zone)
  if (pool.length === 0) pool = FISH.filter((f) => f.rarity === 'common' && f.zone === zone)
  const fish = pool[Math.floor(rand() * pool.length)]
  if (fish.rarity === 'junk') return { fish: fish.id, iro: null, size: 0 }
  // 크기: 작은 쪽이 흔하게 (큰 기록이 귀하게)
  const size = Math.round((fish.min + (fish.max - fish.min) * Math.pow(rand(), 1.6)) * 10) / 10
  let r = rand() * 100
  let iro: Iro | null = null
  for (const x of IRO) {
    r -= x.odds
    if (r < 0) {
      iro = x.id
      break
    }
  }
  return { fish: fish.id, iro, size }
}

/** 자랑할 만한지: 희귀 이상이거나 이로치 */
export const isBig = (c: Catch) => !!c.iro || ['rare', 'epic', 'legend'].includes(fishById(c.fish)?.rarity ?? '')
