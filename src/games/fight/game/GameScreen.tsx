import { useEffect, useReducer, useRef } from 'react'
import { loadNickname } from '../../../shared/storage/nickname'
import { randomSeed } from '../../../shared/random'
import { CHOOSE_MS, DONE_MS, type Difficulty, MAX_LIFE, MAX_STACKS, MAX_TURNS, REVEAL_MS } from '../constants'
import { FightView, type FighterShow } from '../field/FightView'
import { type MatchState, type MatchSummary, createMatch, matchReducer, summarizeMatch } from '../play/matchState'
import { type Fighter, STANCES, STANCE_LABEL, type Stance, canChoose } from '../rules/turn'
import { playSound } from '../sounds'

type Props = {
  difficulty: Difficulty
  onFinish: (summary: MatchSummary) => void
}

const STANCE_DESC: Record<Stance, string> = {
  ready: '스택 +1',
  guard: '타격을 막음',
  attack: '스택 1개 써서 공격',
}

function Status({ fighter, name, side }: { fighter: Fighter; name: string; side: 0 | 1 }) {
  return (
    <div className={`ft-status ft-status--${side === 0 ? 'me' : 'foe'}`}>
      <span className="ft-status__name">{name}</span>
      <span className="ft-status__life" aria-label={`생명력 ${fighter.life}`}>
        {Array.from({ length: MAX_LIFE }, (_, i) => (
          <span key={i} className={i < fighter.life ? 'ft-heart' : 'ft-heart ft-heart--lost'}>
            ♥
          </span>
        ))}
      </span>
      <span className="ft-status__stacks" aria-label={`준비 스택 ${fighter.stacks}`}>
        {Array.from({ length: MAX_STACKS }, (_, i) => (
          <span key={i} className={i < fighter.stacks ? 'ft-stack ft-stack--on' : 'ft-stack'} />
        ))}
      </span>
    </div>
  )
}

/** 화면 가운데 안내: 시작 / 결과 한 줄 / 경기 끝 */
function Banner({ state }: { state: MatchState }) {
  const { phase } = state
  if (phase.kind === 'intro') return <div className="ft-banner"><strong>시작!</strong></div>
  if (phase.kind === 'done') {
    const text = phase.winner === 'draw' ? '무승부' : phase.winner === 0 ? '승리!' : '패배'
    return (
      <div className="ft-banner ft-banner--done">
        <strong className={phase.winner === 0 ? 'ft-banner__win' : ''}>{text}</strong>
        <span>결과 화면으로 넘어가요…</span>
      </div>
    )
  }
  return null
}

function showOf(state: MatchState, side: 0 | 1): FighterShow {
  const { phase } = state
  if (phase.kind === 'reveal') return { stance: phase.result.stances[side], event: phase.result.events[side], hidden: false }
  if (phase.kind === 'choosing') {
    // 내 것만 보여주고 상대 것은 숨긴다
    const mine = state.controllers[side] === 'user'
    return { stance: mine ? phase.picks[side] : null, event: null, hidden: !mine }
  }
  return { stance: null, event: null, hidden: false }
}

export function GameScreen({ difficulty, onFinish }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({ now: performance.now(), seed: randomSeed(), difficulty }),
  )
  const done = state.phase.kind === 'done'

  const playedRef = useRef(0)
  useEffect(() => {
    for (const s of state.sounds) {
      if (s.id <= playedRef.current) continue
      playedRef.current = s.id
      playSound(s.name)
    }
  }, [state.sounds])

  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      dispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // 끝나면 잠깐 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
  const finishRef = useRef(onFinish)
  const stateRef = useRef(state)
  useEffect(() => {
    finishRef.current = onFinish
    stateRef.current = state
  })
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => finishRef.current(summarizeMatch(stateRef.current)), DONE_MS)
    return () => clearTimeout(timer)
  }, [done])

  const { phase, now } = state
  const me = state.fighters[0]
  const choosing = phase.kind === 'choosing'
  const myPick = choosing ? phase.picks[0] : null
  const left = choosing ? Math.max(0, phase.until - now) : 0
  const reveal = phase.kind === 'reveal' ? Math.min(1, 1 - (phase.until - now) / REVEAL_MS) : null
  const names = [loadNickname() ?? '나', '봇'] as const

  return (
    <div className="ft-game">
      <div className="ft-hud">
        <Status fighter={state.fighters[0]} name={names[0]} side={0} />
        <span className="ft-hud__turn">
          {Math.min(state.turns.length + (choosing ? 1 : 0), MAX_TURNS)}/{MAX_TURNS}턴
        </span>
        <Status fighter={state.fighters[1]} name={names[1]} side={1} />
      </div>

      <div className="ft-view-wrap">
        <FightView fighters={[showOf(state, 0), showOf(state, 1)]} reveal={reveal} now={now} names={names} />
        <Banner state={state} />
      </div>

      <div className="ft-timer" aria-hidden={!choosing}>
        <div className="ft-timer__fill" style={{ transform: `scaleX(${choosing ? left / CHOOSE_MS : 0})` }} />
      </div>

      <div className="ft-pad" role="group" aria-label="자세 고르기">
        {STANCES.map((s) => {
          const allowed = canChoose(me, s)
          return (
            <button
              key={s}
              type="button"
              className={`button ft-pad__button ft-pad__button--${s}`}
              aria-pressed={myPick === s}
              disabled={!choosing || !allowed}
              onPointerDown={(e) => {
                // 터치하자마자 고르도록 (click은 손을 뗄 때라 늦다)
                e.preventDefault()
                dispatch({ type: 'pick', side: 0, stance: s })
              }}
              // 키보드(Enter·Space)로도 고를 수 있게. 같은 자세를 다시 고르는 건 무시된다
              onClick={() => dispatch({ type: 'pick', side: 0, stance: s })}
            >
              <span className="ft-pad__label">{STANCE_LABEL[s]}</span>
              <span className="ft-pad__desc">{s === 'attack' && !allowed ? '스택 필요' : STANCE_DESC[s]}</span>
            </button>
          )
        })}
      </div>
      <p className="ft-hint">2초 안에 고르기 · 안 고르면 준비 · 준비 중에 맞으면 생명력 −1</p>
    </div>
  )
}
