// 타일: 번호(id) 하나로 다룬다. 0~103은 숫자 타일(숫자 1~13 × 색 4 × 두 벌), 104·105는 와일드.
import { type Rng } from '../../../shared/random'
import { COLORS, COPIES, MAX_NUM, WILDS } from '../constants'

export type TileId = number

export const NUMBER_TILES = MAX_NUM * COLORS * COPIES
export const TILE_COUNT = NUMBER_TILES + WILDS

export function isWild(id: TileId): boolean {
  return id >= NUMBER_TILES
}

/** 1~13 (와일드는 0) */
export function numOf(id: TileId): number {
  return isWild(id) ? 0 : (id % MAX_NUM) + 1
}

/** 0~3 (와일드는 -1) */
export function colorOf(id: TileId): number {
  return isWild(id) ? -1 : Math.floor(id / MAX_NUM) % COLORS
}

export function tileId(color: number, num: number, copy = 0): TileId {
  return copy * MAX_NUM * COLORS + color * MAX_NUM + (num - 1)
}

export const WILD_IDS: readonly TileId[] = Array.from({ length: WILDS }, (_, i) => NUMBER_TILES + i)

/** 섞은 타일 더미 */
export function shuffledDeck(rng: Rng): TileId[] {
  const deck = Array.from({ length: TILE_COUNT }, (_, i) => i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** 손패 정렬: 색 → 숫자, 와일드는 맨 뒤 */
export function sortByColor(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((a, b) => key(a, colorOf(a) * 100 + numOf(a)) - key(b, colorOf(b) * 100 + numOf(b)))
}

/** 손패 정렬: 숫자 → 색, 와일드는 맨 뒤 */
export function sortByNumber(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((a, b) => key(a, numOf(a) * 10 + colorOf(a)) - key(b, numOf(b) * 10 + colorOf(b)))
}

const key = (id: TileId, k: number) => (isWild(id) ? 10_000 + id : k)

/** 남은 손패 점수 (끝났을 때 순위용). 와일드는 MAX_NUM(13) */
export function handValue(ids: readonly TileId[]): number {
  return ids.reduce((sum, id) => sum + (isWild(id) ? MAX_NUM : numOf(id)), 0)
}
