import { type Difficulty, MAX_TURNS } from '../../games/fight/constants'
import { createMatch, matchReducer, summarizeMatch, type MatchState } from '../../games/fight/play/matchState'
import { STANCES, type Stance } from '../../games/fight/rules/turn'

// 격투 봇 대전 다시 돌리기: 서버 시드 + 내가 턴마다 낸 자세로 처음부터 똑같이 돌려 결과를 서버가 정한다.
// 봇은 시드로만 고르고(내 선택을 안 봄) 고르는 시각은 결과와 상관없어서, 턴마다 마지막 자세만 있으면 된다.

export type FightReplay = { difficulty: Difficulty; outcome: 'win' | 'lose' | 'draw'; turns: number }

export function replayFight(seed: number, difficulty: unknown, moves: unknown): FightReplay | null {
  if (difficulty !== 'normal' && difficulty !== 'hard') return null
  if (!Array.isArray(moves) || moves.length > MAX_TURNS || !moves.every((m) => STANCES.includes(m as Stance))) return null
  let s: MatchState = createMatch({ now: 0, seed, difficulty })
  let guard = 0
  while (s.phase.kind !== 'done' && guard++ < 200) {
    const { phase } = s
    if (phase.kind === 'choosing') {
      const move = moves[phase.index] as Stance | undefined
      if (move === undefined) return null
      s = matchReducer(s, { type: 'pick', side: 0, stance: move })
      const picked = s.phase.kind === 'choosing' ? s.phase.picks[0] : null
      // 낼 수 없는 자세(스택 부족)를 적었으면 조작
      if ((picked ?? 'ready') !== move) return null
    }
    s = matchReducer(s, { type: 'tick', now: s.phase.kind === 'done' ? s.now : s.phase.until })
  }
  if (s.phase.kind !== 'done' || s.turns.length !== moves.length) return null
  const sum = summarizeMatch(s)
  return { difficulty, outcome: sum.outcome, turns: sum.turns }
}
