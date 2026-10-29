// 봇: 손패만으로 만들 수 있는 줄을 점수 큰 것부터 욕심껏 고르고, 첫 등록 뒤에는 남은 타일을 바닥 줄 앞뒤에 붙이거나
// 연속 줄을 쪼개 끼우거나 바닥의 남는 타일을 빌린다. 줄은 늘 올바른 순서로 놓는다. 낼 게 없으면 null → 1장 가져오기.
import { COLORS, FIRST_MELD, MAX_NUM, MIN_SET } from '../constants'
import { isValidSet, orderSet, setKind, setValue } from '../rules/sets'
import { type TileId, colorOf, isWild, numOf } from '../rules/tiles'
import type { Table } from '../rules/turn'

/** 손패에서 만들 수 있는 줄 후보 (와일드는 한 장까지 끼워 봄) */
function candidates(hand: readonly TileId[]): TileId[][] {
  const wild = hand.find(isWild)
  const plain = hand.filter((id) => !isWild(id))
  const out: TileId[][] = []
  // 같은 숫자 다른 색: 색마다 한 장씩
  for (let n = 1; n <= MAX_NUM; n++) {
    const byColor = new Map<number, TileId>()
    for (const id of plain) if (numOf(id) === n && !byColor.has(colorOf(id))) byColor.set(colorOf(id), id)
    const g = [...byColor.values()]
    if (g.length >= MIN_SET) out.push(g)
    if (wild !== undefined && g.length >= MIN_SET - 1 && g.length < COLORS) out.push([...g, wild])
  }
  // 같은 색 연속: 모든 구간
  for (let c = 0; c < COLORS; c++) {
    const at = new Map<number, TileId>()
    for (const id of plain) if (colorOf(id) === c && !at.has(numOf(id))) at.set(numOf(id), id)
    for (let lo = 1; lo <= MAX_NUM; lo++) {
      const seq: TileId[] = []
      let usedWild = false
      for (let n = lo; n <= MAX_NUM; n++) {
        const id = at.get(n)
        if (id !== undefined) seq.push(id)
        else if (wild !== undefined && !usedWild && seq.length > 0) {
          seq.push(wild)
          usedWild = true
        } else break
        if (seq.length >= MIN_SET) out.push([...seq])
      }
    }
  }
  return out.filter(isValidSet)
}

/** 손패만으로 줄을 욕심껏 고른다 (점수 큰 것부터) */
export function setsFromHand(hand: readonly TileId[]): TileId[][] {
  let left = [...hand]
  const sets: TileId[][] = []
  for (;;) {
    const best = candidates(left).sort((a, b) => setValue(b) - setValue(a) || b.length - a.length)[0]
    if (!best) return sets
    sets.push(best)
    left = left.filter((id) => !best.includes(id))
  }
}

/** 낼 바닥 전체, 낼 게 없으면 null */
export function chooseBotPlay(table: Table, hand: readonly TileId[], melded: boolean): Table | null {
  const sets = setsFromHand(hand)
  if (!melded) {
    const total = sets.reduce((sum, s) => sum + setValue(s), 0)
    return total >= FIRST_MELD ? [...table, ...sets] : null
  }
  const next = [...table.map((s) => [...s]), ...sets]
  let left = hand.filter((id) => !sets.some((s) => s.includes(id)))
  // 남은 타일을 하나씩 바닥에 끼운다: 줄 끝에 붙이기 → 연속 줄을 둘로 쪼개 끼우기 → 바닥의 남는 타일을 빌려 새 줄
  for (let changed = true; changed; ) {
    changed = false
    for (const id of left) {
      if (attach(next, id) || split(next, id) || borrow(next, id, left)) {
        left = left.filter((x) => !next.some((s) => s.includes(x)))
        changed = true
        break
      }
    }
  }
  return left.length === hand.length ? null : next
}

/** 줄 뒤(위쪽 숫자)나 앞(아래쪽 숫자)에 붙이기 */
function attach(table: TileId[][], id: TileId): boolean {
  for (const s of table) {
    if (isValidSet([...s, id])) {
      s.push(id)
      return true
    }
    if (isValidSet([id, ...s])) {
      s.unshift(id)
      return true
    }
  }
  return false
}

/** 빨강 3~8에 빨강 5 → 3·4·5 / 5·6·7·8 (양쪽 다 3장 이상) */
function split(table: TileId[][], id: TileId): boolean {
  if (isWild(id)) return false
  for (const [i, s] of table.entries()) {
    if (s.some(isWild) || setKind(s) !== 'run' || colorOf(s[0]) !== colorOf(id)) continue
    const low = s.filter((x) => numOf(x) <= numOf(id))
    const high = [id, ...s.filter((x) => numOf(x) > numOf(id))]
    if (low.length >= MIN_SET && high.length >= MIN_SET && isValidSet(low) && isValidSet(high)) {
      table.splice(i, 1, low, high)
      return true
    }
  }
  return false
}

/** 빼도 줄이 남는 바닥 타일(긴 연속의 끝, 4장 이상 같은 숫자의 한 장)을 빌려 손패와 새 줄 */
function borrow(table: TileId[][], id: TileId, hand: readonly TileId[]): boolean {
  const spares: { set: TileId[]; tile: TileId }[] = []
  for (const s of table) {
    if (s.length <= MIN_SET) continue
    for (const tile of s) if (isValidSet(s.filter((x) => x !== tile))) spares.push({ set: s, tile })
  }
  const others = hand.filter((x) => x !== id)
  // 손패 한 장 더 + 빌린 한 장, 또는 빌린 두 장
  for (const a of spares) {
    for (const x of others) {
      const set = orderSet([id, x, a.tile])
      if (set) return take(table, set, [a])
    }
    for (const b of spares) {
      const set = b.set !== a.set ? orderSet([id, a.tile, b.tile]) : null
      if (set) return take(table, set, [a, b])
    }
  }
  return false
}

/** 빌린 타일을 원래 줄에서 빼고 새 줄(이미 순서대로)을 놓는다 */
function take(table: TileId[][], set: TileId[], borrowed: { set: TileId[]; tile: TileId }[]): boolean {
  for (const b of borrowed) b.set.splice(b.set.indexOf(b.tile), 1)
  table.push(set)
  return true
}
