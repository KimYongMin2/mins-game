import { describe, expect, it } from 'vitest'
import { type Pos, advance, atEnd, back, enter, nodeOf } from './board'

const node = (p: Pos | 'out') => (p === 'out' ? 'out' : nodeOf(p))
/** 처음 올린 뒤 결과들을 차례로 쓴 칸 */
function walk(first: number, ...steps: number[]) {
  let p: Pos | 'out' = enter(first)
  const nodes = [node(p)]
  for (const s of steps) {
    if (p === 'out') break
    p = s < 0 ? back(p) : advance(p, s)
    nodes.push(node(p))
  }
  return nodes
}

describe('말판 길', () => {
  it('바깥으로 한 바퀴: 출발점에 도착하면 끝, 그다음에 나감', () => {
    expect(walk(4, 4, 4, 4, 4)).toEqual([4, 8, 12, 16, 0])
    expect(atEnd(enter(4) as Pos)).toBe(false)
    expect(walk(4, 4, 4, 4, 4, 1)).toEqual([4, 8, 12, 16, 0, 'out'])
    expect(walk(4, 4, 4, 4, 5)).toEqual([4, 8, 12, 16, 'out'])
  })

  it('오른쪽 위 모서리에 딱 멈추면 무조건 꺾는다', () => {
    expect(walk(5, 1, 2)).toEqual([5, 20, 22])
    // 가운데에 또 멈추면 출발점 쪽으로 꺾는다
    expect(walk(5, 3, 1, 2)).toEqual([5, 22, 27, 0])
    // 가운데를 지나가기만 하면 왼쪽 아래로
    expect(walk(5, 4, 1)).toEqual([5, 23, 24])
  })

  it('모서리를 지나가기만 하면 꺾지 않는다', () => {
    expect(walk(4, 2)).toEqual([4, 6])
    expect(walk(3, 3, 3, 1)).toEqual([3, 6, 9, 10])
  })

  it('왼쪽 위 모서리에서 꺾으면 가운데 지나 출발점으로', () => {
    expect(walk(4, 5, 1, 3, 2)).toEqual([4, 9, 10, 22, 28])
    expect(walk(4, 5, 1, 3, 3)).toEqual([4, 9, 10, 22, 0])
  })

  it('왼쪽 아래 모서리는 꺾는 곳이 아니다', () => {
    expect(walk(5, 3, 1, 1, 1)).toEqual([5, 22, 27, 28, 0])
    expect(walk(5, 4, 2, 1)).toEqual([5, 23, 15, 16])
  })
})

describe('빽도', () => {
  it('도 칸에서 빽도면 출발점(끝), 다음 결과로 나간다', () => {
    const p = back(enter(1))
    expect(nodeOf(p)).toBe(0)
    expect(atEnd(p)).toBe(true)
    expect(advance(p, 1)).toBe('out')
  })

  it('지름길 첫 칸·꺾이는 칸으로 물러나기', () => {
    expect(walk(5, -1)).toEqual([5, 4])
    expect(walk(5, 1, -1)).toEqual([5, 20, 5])
    // 뒤로 물러나 모서리에 멈춰도 꺾는다
    expect(walk(4, 2, -1, 1)).toEqual([4, 6, 5, 20])
    // 가운데에서 뒤로 가면 들어온 대각선
    expect(walk(5, 3, -1)).toEqual([5, 22, 21])
  })
})
