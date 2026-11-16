import { describe, expect, it } from 'vitest'
import { createRng } from '../shared/random'
import { createMatch, matchReducer, summarizeMatch, type MatchState } from '../games/fight/play/matchState'
import { STANCES, canChoose } from '../games/fight/rules/turn'
import { replayFight } from './games/fight'
import { checkTicket, issueTicket } from './ticket'

/** 사람처럼 아무 때나 아무 자세를 눌러 한 판 끝까지 (실제 화면처럼 시각을 흘려 가며) */
function playFight(seed: number, difficulty: 'normal' | 'hard', pickSeed: number): MatchState {
  const rng = createRng(pickSeed)
  let s = createMatch({ now: 0, seed, difficulty })
  let t = 0
  while (s.phase.kind !== 'done') {
    t += 50
    if (s.phase.kind === 'choosing' && rng.next() < 0.08) {
      const options = STANCES.filter((x) => canChoose(s.fighters[0], x))
      s = matchReducer(s, { type: 'pick', side: 0, stance: options[Math.floor(rng.next() * options.length)] })
    }
    s = matchReducer(s, { type: 'tick', now: t })
  }
  return s
}

describe('격투 다시 돌리기', () => {
  it('실제로 한 판과 같은 결과', () => {
    for (let i = 0; i < 40; i++) {
      const s = playFight(1000 + i, i % 2 ? 'hard' : 'normal', 77 + i)
      const sum = summarizeMatch(s)
      const r = replayFight(1000 + i, sum.difficulty, sum.moves)
      expect(r).toEqual({ difficulty: sum.difficulty, outcome: sum.outcome, turns: sum.turns })
    }
  })

  it('지어낸 기록은 거절 (낼 수 없는 자세 · 판이 안 끝남 · 이상한 값)', () => {
    expect(replayFight(5, 'normal', ['smash', 'smash', 'smash'])).toBeNull()
    expect(replayFight(5, 'normal', ['ready'])).toBeNull()
    expect(replayFight(5, 'easy', ['ready'])).toBeNull()
    expect(replayFight(5, 'normal', ['kick'])).toBeNull()
  })

  it('다른 시드로 같은 기록을 내면 결과가 다르거나 거절', () => {
    const s = playFight(42, 'hard', 9)
    const sum = summarizeMatch(s)
    let differs = 0
    for (let seed = 1; seed <= 20; seed++) {
      const r = replayFight(seed, 'hard', sum.moves)
      if (!r || r.outcome !== sum.outcome || r.turns !== sum.turns) differs++
    }
    expect(differs).toBeGreaterThan(10)
  })
})

describe('판 입장권', () => {
  it('서명 확인: 진짜만 통과, 다른 사람·게임·바꾼 시드·지난 것은 거절', async () => {
    const t = await issueTicket('secret', 'fight', 'u1', 1000)
    expect(await checkTicket('secret', t, 'fight', 'u1', 2000)).not.toBeNull()
    expect(await checkTicket('secret', t, 'fight', 'u2', 2000)).toBeNull()
    expect(await checkTicket('secret', t, 'archery', 'u1', 2000)).toBeNull()
    expect(await checkTicket('secret', { ...t, seed: t.seed + 1 }, 'fight', 'u1', 2000)).toBeNull()
    expect(await checkTicket('other', t, 'fight', 'u1', 2000)).toBeNull()
    expect(await checkTicket('secret', t, 'fight', 'u1', t.exp + 1)).toBeNull()
  })
})
