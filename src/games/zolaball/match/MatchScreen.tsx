import { useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { SWING_DURATION_MS } from '../constants'
import { Field } from '../field/Field'
import { CAMERA_PITCH, type Camera } from '../field/camera'
import { followCamera } from '../field/followCamera'
import { usePitchKeys } from '../input/pitchKeys'
import { eventTime } from '../../../shared/input/eventTime'
import { useSpaceSwing } from '../input/swingInput'
import { battedBallPosition } from '../play/battedBall'
import { type Point, ballPosition } from '../play/pitch'
import { PITCH_CHOICE_MS } from '../play/pitchSelection'
import { randomSeed } from '../../../shared/random'
import { INNINGS } from '../rules/game'
import { playSound } from '../sounds'
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
import { type BaseballMsg, actionOf, outbox } from './pvp'
import { Scoreboard } from './Scoreboard'
import { TimerBar } from './TimerBar'

type Props = {
  config: MatchConfig
  /** 친구 대전이면 방과 상대 이름 */
  pvp?: { room: Room<BaseballMsg>; peerName: string }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
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
    const { event, pitch, userDiffMs, batted } = phase
    // 멀리 날아가는 타구는 떨어질 즈음 결과를 보여준다.
    if (batted && batted.kind !== 'foul' && state.now < batted.startAt + batted.duration * 0.75) return null
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

export function MatchScreen({ config, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch(config, performance.now(), randomSeed()),
  )
  const [peerGone, setPeerGone] = useState(false)

  // 친구 대전: 받은 투구·판정을 경기에 넣고, 상대가 나가면 알린다
  useEffect(() => {
    if (!pvp) return
    const offMsg = pvp.room.onMessage((msg) => {
      const action = actionOf(msg)
      if (action) dispatch(action)
    })
    const offPeer = pvp.room.onPeer((peer) => {
      if (!peer) setPeerGone(true)
    })
    return () => {
      offMsg()
      offPeer()
    }
  }, [pvp])

  // 친구 대전: 내가 던진 공·내 판정을 보낸다 (지난번 보낸 뒤의 모든 변화를 비교)
  const sentRef = useRef(state)
  useEffect(() => {
    if (!pvp) return
    for (const msg of outbox(sentRef.current, state)) pvp.room.send(msg)
    sentRef.current = state
  }, [pvp, state])
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
    if (!finished || reportedRef.current || peerGone) return
    reportedRef.current = true
    finishRef.current(summarize(state))
  }, [finished, state, peerGone])

  // 효과음: 리듀서가 쌓은 것 중 아직 재생하지 않은 것만
  const playedRef = useRef(0)
  useEffect(() => {
    for (const s of state.sounds) {
      if (s.id <= playedRef.current) continue
      playedRef.current = s.id
      playSound(s.name)
    }
  }, [state.sounds])

  useSpaceSwing((at) => dispatch({ type: 'swing', at }))
  const choosing = phase.kind === 'choosing' && userPitching
  usePitchKeys(choosing, {
    onKey: (key) => dispatch({ type: 'selectKey', key }),
    onHeight: (height) => dispatch({ type: 'selectHeight', height }),
  })

  // 필드에 그릴 것: 투구 중에는 날아오는 공, 결과 중에는 타구와 그 공을 따라가는 카메라
  let ball: Point | null = null
  let camera: Camera = CAMERA_PITCH
  // 공이 홈플레이트를 지난 뒤에는 지나간 자리를 표시
  const shownPitch = phase.kind === 'pitching' || phase.kind === 'result' ? phase.pitch : null
  const mark = shownPitch && now >= shownPitch.arriveAt ? { x: 0, y: shownPitch.plateHeight } : null
  if (phase.kind === 'pitching') {
    const contact = phase.swing && phase.swing.result !== 'miss'
    ball = contact && now >= phase.pitch.arriveAt ? null : ballPosition(phase.pitch, now)
  } else if (phase.kind === 'result' && phase.batted) {
    ball = battedBallPosition(phase.batted, now)
    camera = followCamera(ball)
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
    timerLabel = pvp ? `${pvp.peerName}님이 구종을 고르는 중` : '상대 투수 준비 중'
  } else if (phase.kind === 'pitching') {
    timerLabel = userBatting ? '지금 스윙!' : '투구!'
  }

  return (
    <div className="zb-match">
      <Scoreboard game={state.game} userSide={config.userSide} opponentName={pvp?.peerName} />

      <div className="zb-field-wrap zb-field-wrap--match">
        <Field camera={camera} ball={ball} swing={swingProgress} mark={mark} />
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
      {peerGone && !finished && (
        <div className="pvp-gone" role="alert">
          <strong>{pvp?.peerName}님이 나갔어요</strong>
          <span>이 경기는 기록되지 않아요</span>
          <button type="button" className="button" onClick={onQuit}>
            나가기
          </button>
        </div>
      )}
    </div>
  )
}
