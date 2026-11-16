import { describe, expect, it } from 'vitest'
import { VOTE_POINTS, VOTE_ROUNDS } from '../constants'
import { createVote, voteReducer, voteViewFor, type VoteState } from './voteEngine'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}` }))
const until = (s: VoteState, kind: string) => {
  let t = s.now
  while (s.phase.kind !== kind && s.phase.kind !== 'done') s = voteReducer(s, { type: 'tick', now: (t += 250) })
  return s
}

describe('다 같이 그리기 심판', () => {
  it('투표 중엔 누가 그렸는지 숨기고, 결과에 표·점수, 3판이면 끝', () => {
    let s = until(createVote({ now: 0, seed: 7, players: players(3) }), 'vote')
    if (s.phase.kind !== 'vote') throw new Error()
    const v0 = voteViewFor(s, 'p0')
    expect(v0.gallery?.every((g) => g.owner === null)).toBe(true)
    expect(v0.gallery?.filter((g) => g.mine)).toHaveLength(1)
    // 자기 그림엔 못 냄
    expect(voteReducer(s, { type: 'vote', player: 0, target: 0 })).toBe(s)
    s = voteReducer(s, { type: 'vote', player: 0, target: 1 })
    s = voteReducer(s, { type: 'vote', player: 2, target: 1 })
    s = voteReducer(s, { type: 'vote', player: 1, target: 0 })
    // 다 내면 바로 결과
    expect(s.phase.kind).toBe('result')
    expect(s.scores).toEqual([VOTE_POINTS, 2 * VOTE_POINTS, 0])
    expect(voteViewFor(s, 'p2').gallery?.every((g) => g.owner !== null)).toBe(true)
    s = until(s, 'done')
    expect(s.round).toBe(VOTE_ROUNDS)
    expect(new Set(s.used).size).toBe(VOTE_ROUNDS)
  })

  it('나가서 둘보다 적으면 끝', () => {
    let s = until(createVote({ now: 0, seed: 1, players: players(3) }), 'draw')
    s = voteReducer(s, { type: 'drop', player: 0 })
    expect(s.phase.kind).toBe('draw')
    s = voteReducer(s, { type: 'drop', player: 1 })
    expect(s.phase.kind).toBe('done')
  })
})
