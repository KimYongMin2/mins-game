import { describe, expect, it } from 'vitest'
import { type Pos, enter, nodeOf } from './board'
import { type Piece, applyMove, movesFor } from './moves'

const at = (steps: number): Pos => enter(steps)

describe('movesFor', () => {
  it('새 말 올리기와 판 위 말 (업힌 말은 한 번만), 같은 결과가 여러 개면 한 번만', () => {
    const pieces: Piece[][] = [[at(2), at(2), 'home'], ['home']]
    const moves = movesFor(pieces, 0, ['gae', 'gae', 'do'])
    expect(moves.map((m) => [m.throwIdx, m.from])).toEqual([
      [0, 2],
      [0, 'home'],
      [2, 2],
      [2, 'home'],
    ])
  })

  it('판에 말이 없으면 빽도는 쓸 데가 없다 (다른 결과로 올리면 그때 쓸 수 있음)', () => {
    expect(movesFor([['home', 'home']], 0, ['backdo'])).toEqual([])
    expect(movesFor([['home', 'home']], 0, ['backdo', 'gae']).map((m) => m.throwIdx)).toEqual([1])
  })
})

describe('applyMove', () => {
  it('내 말이 있는 칸에 멈추면 업고, 업힌 말은 같이 움직인다', () => {
    let pieces: Piece[][] = [[at(1), at(3)], ['home']]
    pieces = applyMove(pieces, 0, 'gae', 1, at(3)).pieces
    expect(pieces[0].map((p) => nodeOf(p as Pos))).toEqual([3, 3])
    const r = applyMove(pieces, 0, 'do', 3, at(4))
    expect(r.pieces[0].map((p) => nodeOf(p as Pos))).toEqual([4, 4])
  })

  it('상대 말(업힌 것까지)을 잡으면 처음으로, 도·개·걸·빽도로 잡으면 한 번 더', () => {
    const pieces: Piece[][] = [[at(1)], [at(3), at(3)]]
    const r = applyMove(pieces, 0, 'gae', 1, at(3))
    expect(r.pieces[1]).toEqual(['home', 'home'])
    expect(r.captured).toBe(2)
    expect(r.bonus).toBe(true)
  })

  it('윷·모로 잡으면 추가 없음', () => {
    const pieces: Piece[][] = [[at(1)], [at(5)]]
    const r = applyMove(pieces, 0, 'yut', 1, at(5))
    expect(r.captured).toBe(1)
    expect(r.bonus).toBe(false)
  })

  it('나가면 out', () => {
    const r = applyMove([[at(3)], ['home']], 0, 'mo', 3, 'out')
    expect(r.pieces[0]).toEqual(['out'])
  })
})
