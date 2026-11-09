import { Suspense, lazy, useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { SWING_DURATION_MS, TEAM_COLORS } from '../constants'
import { ANIMALS, type Look, plainLook } from '../../../shared/art3d/animalKinds'
import { canWebGL } from '../../../shared/art3d/webgl'
import { loadLook } from '../../../shared/storage/avatar'
import { readLocal, writeLocal } from '../../../shared/storage/local'
import { Field } from '../field/Field'
import type { FieldView } from '../field/Field3D'
import type { Impact } from '../field/impact'
import { CAMERA_PITCH, type Camera } from '../field/camera'
import { followCamera } from '../field/followCamera'
import { trailOf } from '../field/trail'
import { usePitchKeys } from '../input/pitchKeys'
import { eventTime } from '../../../shared/input/eventTime'
import { useSpaceSwing } from '../input/swingInput'
import { type BattedBall, battedBallPosition } from '../play/battedBall'
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

/** 3D 야구장은 three.js가 커서 경기 화면에서만 불러온다 (불러오는 동안은 2D 그림) */
const Field3D = lazy(() => import('../field/Field3D').then((m) => ({ default: m.Field3D })))

/** 내가 칠 때 고른 시점 (타자 뒤 / 옆) — 기기에 기억 */
const VIEW_KEY = 'zolaball-bat-view'
type BatView = Extract<FieldView, 'catcher' | 'side'>
const loadBatView = (): BatView => (readLocal(VIEW_KEY) === 'side' ? 'side' : 'catcher')

/** 야구 선수 모습: 고른 동물에 팀 색 유니폼·야구모자(다른 모자를 골랐으면 그대로) */
function playerLook(base: Look, tint: Look['tint'], number: number): Look {
  return { ...base, outfit: 'uniform', tint, hat: base.hat === 'none' ? 'cap' : base.hat, number }
}

/** 두 팀 선수 모습: 나(타자·투수 겸)·우리 포수 / 상대 선수·상대 포수 — 동물이 겹치지 않게 */
function teamLooks(): { me: Look; myCatcher: Look; opp: Look; oppCatcher: Look } {
  const mine = loadLook() ?? plainLook('bear')
  const others = ANIMALS.filter((a) => a !== mine.animal)
  return {
    me: playerLook(mine, 'blue', mine.outfit === 'uniform' ? mine.number : 7),
    myCatcher: playerLook(plainLook(others[3]), 'blue', 2),
    opp: playerLook(plainLook(others[0]), 'red', 11),
    oppCatcher: playerLook(plainLook(others[1]), 'red', 22),
  }
}

/** 타구 방향: 내가 쳤으면 빠르면 당겨(3루 쪽)·늦으면 밀어(1루 쪽), 아니면 시각으로 섞음. 파울은 선 밖으로 */
function sprayOf(batted: BattedBall, diffMs: number | null): number {
  const h = ((Math.floor(batted.startAt) * 9301 + 49297) % 233280) / 233280
  if (batted.kind === 'foul') return (h < 0.5 ? -1 : 1) * (0.9 + h * 0.4)
  const base = diffMs !== null ? Math.max(-0.6, Math.min(0.6, diffMs / 70)) : (h - 0.5) * 1.0
  return base + (h - 0.5) * 0.15
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
  // 3D 야구장 (WebGL이 안 되는 기기는 예전 2D 그림)
  const [use3D] = useState(canWebGL)
  const [batView, setBatView] = useState<BatView>(loadBatView)
  const [team] = useState(teamLooks)
  function toggleView() {
    const next: BatView = batView === 'catcher' ? 'side' : 'catcher'
    writeLocal(VIEW_KEY, next)
    setBatView(next)
  }

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
  let trail: Point[] = []
  let camera: Camera = CAMERA_PITCH
  // 공이 홈플레이트를 지난 뒤에는 지나간 자리를 표시
  const shownPitch = phase.kind === 'pitching' || phase.kind === 'result' ? phase.pitch : null
  const mark = shownPitch && now >= shownPitch.arriveAt ? { x: 0, y: shownPitch.plateHeight } : null
  if (phase.kind === 'pitching') {
    const contact = phase.swing && phase.swing.result !== 'miss'
    ball = contact && now >= phase.pitch.arriveAt ? null : ballPosition(phase.pitch, now)
    if (ball) trail = trailOf((t) => ballPosition(phase.pitch, t), now)
  } else if (phase.kind === 'result' && phase.batted) {
    const batted = phase.batted
    ball = battedBallPosition(batted, now)
    trail = trailOf((t) => (t >= batted.startAt ? battedBallPosition(batted, t) : null), now)
    camera = followCamera(ball)
  }
  // 투수 동작은 공을 놓는 순간 기준, 맞으면 번쩍 + (장타면) 흔들림, 홈런이면 관중 환호
  const throwT = phase.kind === 'pitching' || phase.kind === 'result' ? now - phase.pitch.releaseAt : null
  const impact: Impact | null =
    phase.kind === 'result' && phase.contact
      ? {
          ms: now - phase.pitch.arriveAt,
          at: { x: 0, y: phase.pitch.plateHeight },
          power: phase.batted?.kind === 'homerun' ? 'homerun' : phase.batted?.kind === 'double' ? 'strong' : 'weak',
        }
      : null
  const celebrate = phase.kind === 'result' && phase.batted?.kind === 'homerun' && now >= phase.batted.startAt + phase.batted.duration * 0.6
  // 내 팀은 파랑: 내가 치면 타자가 파랑, 내가 던지면 투수가 파랑
  const colors = userPitching ? { batter: TEAM_COLORS.opponent, pitcher: TEAM_COLORS.me } : { batter: TEAM_COLORS.me, pitcher: TEAM_COLORS.opponent }
  const swingProgress =
    state.swingAt !== null && now < state.swingAt + SWING_DURATION_MS
      ? Math.max(0, now - state.swingAt) / SWING_DURATION_MS
      : null

  // 3D: 내가 던지면 중계 화면, 칠 땐 고른 시점, 맞으면 타구를 따라감
  const following = phase.kind === 'result' && !!phase.batted
  const spray = phase.kind === 'result' && phase.batted ? sprayOf(phase.batted, phase.userDiffMs) : 0
  const view: FieldView = userPitching ? 'broadcast' : batView
  const looks = userPitching
    ? { batter: team.opp, pitcher: team.me, catcher: team.myCatcher }
    : { batter: team.me, pitcher: team.opp, catcher: team.oppCatcher }

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
        {(() => {
          const flat = (
            <Field camera={camera} ball={ball} trail={trail} swing={swingProgress} throwT={throwT} mark={mark} impact={impact} celebrate={celebrate} colors={colors} now={now} />
          )
          if (!use3D) return flat
          return (
            <Suspense fallback={flat}>
              <Field3D
                view={view}
                ball={ball}
                trail={trail}
                following={following}
                spray={spray}
                swing={swingProgress}
                throwT={throwT}
                mark={mark}
                impact={impact}
                celebrate={celebrate}
                looks={looks}
                now={now}
              />
            </Suspense>
          )
        })()}
        <Banner state={state} />
        {use3D && userBatting && (
          <button type="button" className="button button--small zb-view-toggle" onClick={toggleView}>
            시점: {batView === 'catcher' ? '타자 뒤' : '옆에서'} ⇄
          </button>
        )}
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
