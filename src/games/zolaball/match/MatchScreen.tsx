import { useEffect, useReducer, useRef } from 'react'
import { SWING_DURATION_MS } from '../constants'
import { Field } from '../field/Field'
import { CAMERA_PITCH } from '../field/camera'
import { usePitchKeys } from '../input/pitchKeys'
import { eventTime, useSpaceSwing } from '../input/swingInput'
import { ballPosition } from '../play/pitch'
import { PITCH_CHOICE_MS } from '../play/pitchSelection'
import { randomSeed } from '../play/random'
import { INNINGS } from '../rules/game'
import { outcomeText, pitchText, timingText } from './describe'
import {
  type MatchConfig,
  type MatchState,
  type MatchSummary,
  createMatch,
  isUserBatting,
  isUserPitching,
  matchReducer,
  summarize,
} from './matchState'
import { PitchPad } from './PitchPad'
import { Scoreboard } from './Scoreboard'
import { TimerBar } from './TimerBar'

type Props = {
  config: MatchConfig
  onFinish: (summary: MatchSummary) => void
}

function Banner({ state }: { state: MatchState }) {
  const { phase, game } = state
  const userBatting = isUserBatting(state)

  if (phase.kind === 'announce') {
    const first = game.inning === 1 && game.half === 'top' && game.outs === 0
    return (
      <div className="zb-banner">
        {first && (
          <span className="zb-banner__sub">
            {INNINGS}이닝 경기 · 나는 {state.config.userSide === 'away' ? '선공' : '후공'}
          </span>
        )}
        <strong className="zb-banner__title">
          {game.inning}회 {game.half === 'top' ? '초' : '말'}
        </strong>
        <span className="zb-banner__sub">{userBatting ? '나의 공격' : '나의 수비'}</span>
      </div>
    )
  }

  if (phase.kind === 'result') {
    const { event, pitch, userDiffMs } = phase
    const details = [pitchText(pitch)]
    if (userDiffMs !== null) details.unshift(timingText(userDiffMs))
    return (
      <div className="zb-banner" aria-live="polite">
        <strong className={`zb-banner__title${event.plateResult === 'homerun' ? ' zb-banner__title--big' : ''}`}>
          {outcomeText(event.outcome, event.plateResult)}
        </strong>
        {event.runs > 0 && <span className="zb-banner__runs">+{event.runs}점</span>}
        <span className="zb-banner__sub">{details.join(' · ')}</span>
      </div>
    )
  }

  if (phase.kind === 'final') {
    return (
      <div className="zb-banner">
        <strong className="zb-banner__title">경기 종료</strong>
      </div>
    )
  }

  if (phase.kind === 'choosing' && isUserPitching(state)) {
    return (
      <div className="zb-banner zb-banner--hint">
        <span className="zb-banner__sub">구종과 높이를 고르세요</span>
      </div>
    )
  }
  return null
}

export function MatchScreen({ config, onFinish }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch(config, performance.now(), randomSeed()),
  )
  const userBatting = isUserBatting(state)
  const userPitching = isUserPitching(state)
  const { phase, now } = state
  const finished = phase.kind === 'final'

  useEffect(() => {
    if (finished) return
    let id = requestAnimationFrame(function loop(t) {
      dispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [finished])

  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  // 경기가 끝난 순간 한 번만 알린다.
  const reportedRef = useRef(false)
  useEffect(() => {
    if (!finished || reportedRef.current) return
    reportedRef.current = true
    finishRef.current(summarize(state))
  }, [finished, state])

  useSpaceSwing((at) => dispatch({ type: 'swing', at }))
  const choosing = phase.kind === 'choosing' && userPitching
  usePitchKeys(choosing, {
    onKey: (key) => dispatch({ type: 'selectKey', key }),
    onHeight: (height) => dispatch({ type: 'selectHeight', height }),
  })

  // 필드에 그릴 것
  let ball = null
  if (phase.kind === 'pitching') {
    const contact = phase.swing && phase.swing.result !== 'miss'
    ball = contact && now >= phase.pitch.arriveAt ? null : ballPosition(phase.pitch, now)
  }
  const swingProgress =
    state.swingAt !== null && now < state.swingAt + SWING_DURATION_MS
      ? Math.max(0, now - state.swingAt) / SWING_DURATION_MS
      : null

  // 타이머
  let timerRemaining: number | null = null
  let timerLabel = ''
  if (phase.kind === 'choosing' && userPitching) {
    const left = phase.startedAt + PITCH_CHOICE_MS - now
    timerRemaining = left / PITCH_CHOICE_MS
    timerLabel = `${Math.max(0, Math.ceil(left / 1000))}초 남음`
  } else if (phase.kind === 'choosing') {
    timerLabel = '상대 투수 준비 중'
  } else if (phase.kind === 'pitching') {
    timerLabel = userBatting ? '지금 스윙!' : '투구!'
  }

  return (
    <div className="zb-match">
      <Scoreboard game={state.game} userSide={config.userSide} />

      <div className="zb-field-wrap zb-field-wrap--match">
        <Field camera={CAMERA_PITCH} ball={ball} swing={swingProgress} />
        <Banner state={state} />
      </div>

      <div className="zb-match__controls">
        <TimerBar remaining={timerRemaining} label={timerLabel} />
        {userPitching ? (
          <PitchPad
            selection={phase.kind === 'choosing' ? phase.selection : { key: null, height: null }}
            disabled={!choosing}
            onKey={(key) => dispatch({ type: 'selectKey', key })}
            onHeight={(height) => dispatch({ type: 'selectHeight', height })}
          />
        ) : (
          <>
            <button
              type="button"
              className="button button--primary zb-swing-button"
              disabled={finished}
              onPointerDown={(e) => {
                e.preventDefault()
                dispatch({ type: 'swing', at: eventTime(e) })
              }}
            >
              스윙
            </button>
            <p className="zb-hint">PC에서는 스페이스바로 스윙</p>
          </>
        )}
        {userPitching && <p className="zb-hint">PC: 숫자 1~4로 구종, ↑↓로 높이</p>}
      </div>
    </div>
  )
}
