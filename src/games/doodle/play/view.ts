import type { Look } from '../../../shared/art3d/animalKinds'
import { type EngineState, type Guess, type LogEntry, canGuess, choicesOpen, ranksOf } from './engine'

// 사람마다 다른 화면 (서버가 사람마다 따로 보냄): 제시어는 그리는 사람만, 정답 보여주기·끝에선 모두.
// 시간은 '남은 ms'로 주고받는다.

export type DoodleView = {
  players: { id: string; name: string; avatar?: Look }[]
  left: boolean[]
  scores: number[]
  phase: EngineState['phase']['kind']
  leftMs: number
  /** 지금 몇 번째 차례 / 모두 몇 차례 */
  turnNo: number
  turns: number
  drawer: number | null
  /** 그리는 사람이거나 정답 보여줄 때만 */
  word: string | null
  /** 맞히는 사람에게: 글자 수 */
  wordLength: number | null
  /** 고르는 중이고 내가 그릴 사람일 때만: 제시어 2개 */
  options: [string, string] | null
  /** 보기 4개 (마지막 20초, 아직 못 맞힌 맞히는 사람만) */
  choices: string[] | null
  /** 보기를 이미 한 번 골랐음 (틀림) */
  choiceTried: boolean
  /** 내가 지금 맞힐 수 있는지 */
  canGuess: boolean
  guessed: Guess[]
  log: LogEntry[]
  ranks: number[]
}

export function viewFor(s: EngineState, viewerId: string): DoodleView {
  const me = s.players.findIndex((p) => p.id === viewerId)
  const p = s.phase
  const drawer = p.kind === 'choose' || p.kind === 'draw' || p.kind === 'reveal' ? p.drawer : null
  const word = p.kind === 'reveal' ? p.word : p.kind === 'draw' && drawer === me ? p.word : null
  const showChoices = p.kind === 'draw' && choicesOpen(s) && canGuess(s, me)
  return {
    players: s.players.map(({ id, name, avatar }) => ({ id, name, avatar })),
    left: s.left,
    scores: s.scores,
    phase: p.kind,
    leftMs: 'until' in p ? Math.max(0, p.until - s.now) : 0,
    turnNo: Math.max(0, s.turnNo),
    turns: s.order.length,
    drawer,
    word,
    wordLength: p.kind === 'draw' ? [...p.word].length : null,
    options: p.kind === 'choose' && drawer === me ? p.options : null,
    choices: showChoices ? p.choices : null,
    choiceTried: p.kind === 'draw' && p.choiceTried.includes(me),
    canGuess: canGuess(s, me),
    guessed: p.kind === 'draw' || p.kind === 'reveal' ? p.guessed : [],
    log: s.log.slice(-20),
    ranks: ranksOf(s),
  }
}

/** 바로 보내야 할 만큼 바뀌었는지 (그 밖엔 1초마다) */
export function changeKey(s: EngineState): string {
  const p = s.phase
  return [p.kind, s.turnNo, s.logSeq, s.left.join(), p.kind === 'draw' ? `${p.guessed.length}.${p.choiceTried.length}.${choicesOpen(s)}` : ''].join('|')
}
