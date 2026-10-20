import { useEffect, useReducer, useRef, useState } from 'react'
import { eventTime } from '../../../shared/input/eventTime'
import type { Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { DONE_MS, type Difficulty, type Event, ROUND_MS, WINS_NEEDED } from '../constants'
import { ArmView } from '../field/ArmView'
import { type MatchState, type MatchSummary, createMatch, matchReducer, phaseLeft, summarizeMatch, zoneOf } from '../play/matchState'
import { type ArmMsg, guestActionOf, guestPressOut, hostActionOf, hostSync, phaseChanged } from '../play/pvp'
import { GRADES, GRADE_LABEL, markerAt } from '../rules/timing'
import { playSound } from '../sounds'

type Props = {
  event: Event
  difficulty: Difficulty
  /** 친구 대전이면 방과 상대 이름 */
  pvp?: { room: Room<ArmMsg>; peerName: string }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
}

/** 방장이 친구에게 상태를 보내는 간격, 친구가 누른 횟수를 보내는 간격 */
const SYNC_MS = 100
/** 판정 글자를 띄워 두는 시간 */
const GRADE_SHOW_MS = 500

function WinDots({ wins }: { wins: number }) {
  return (
    <span className="aw-dots" aria-label={`${wins}판 이김`}>
      {Array.from({ length: WINS_NEEDED }, (_, i) => (
        <span key={i} className={i < wins ? 'aw-dot aw-dot--on' : 'aw-dot'} />
      ))}
    </span>
  )
}

/** 가운데 안내: 3·2·1 / 당겨! / 판 결과 / 경기 끝 */
function Banner({ state }: { state: MatchState }) {
  const { phase, now } = state
  if (phase.kind === 'countdown') return <div className="aw-banner aw-banner--count">{phase.shown}</div>
  if (phase.kind === 'pull' && now - phase.start < 500) return <div className="aw-banner aw-banner--go">당겨!</div>
  if (phase.kind === 'roundEnd') {
    const text = phase.winner === null ? '비김! 다시' : phase.winner === 0 ? '이겼다!' : '졌다'
    return <div className={`aw-banner${phase.winner === 0 ? ' aw-banner--win' : ''}`}>{text}</div>
  }
  if (phase.kind === 'done') {
    return (
      <div className="aw-banner aw-banner--done">
        <strong className={phase.winner === 0 ? 'aw-banner--win' : ''}>{phase.winner === 0 ? '승리!' : '패배'}</strong>
        <span>결과 화면으로 넘어가요…</span>
      </div>
    )
  }
  return null
}

/** 지금 누가 앞서는지 한 줄로 */
function Lead({ pos, pulling }: { pos: number; pulling: boolean }) {
  if (!pulling) return <p className="aw-lead">&nbsp;</p>
  if (pos >= 0.6) return <p className="aw-lead aw-lead--me">거의 다 넘겼어요!</p>
  if (pos >= 0.12) return <p className="aw-lead aw-lead--me">내가 앞서요</p>
  if (pos <= -0.6) return <p className="aw-lead aw-lead--foe">넘어가기 직전!</p>
  if (pos <= -0.12) return <p className="aw-lead aw-lead--foe">밀리고 있어요</p>
  return <p className="aw-lead">팽팽해요</p>
}

/** 타이밍전 게이지: 가운데로 갈수록 좋은 판정, 막대가 왔다 갔다 */
function Gauge({ state }: { state: MatchState }) {
  const { phase } = state
  const x = phase.kind === 'pull' ? markerAt(state.now - phase.start).x : 0
  // 과녁은 누를 때마다 옮겨 간다
  const center = phase.kind === 'pull' ? zoneOf(state) : 0
  const mine = state.lastGrade[0]
  const showGrade = mine && state.now - mine.at < GRADE_SHOW_MS ? mine.grade : null
  return (
    <div className="aw-gauge" aria-hidden>
      {[...GRADES].reverse().map((g) => (
        <span
          key={g.grade}
          className={`aw-gauge__zone aw-gauge__zone--${g.grade}`}
          style={{ left: `${50 + center * 50}%`, width: `${g.within * 100}%` }}
        />
      ))}
      <span className="aw-gauge__marker" style={{ left: `${50 + x * 50}%`, opacity: phase.kind === 'pull' ? 1 : 0.3 }} />
      {showGrade && <span className={`aw-gauge__grade aw-gauge__grade--${showGrade}`}>{GRADE_LABEL[showGrade]}</span>}
    </div>
  )
}

export function GameScreen({ event, difficulty, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({
      now: performance.now(),
      seed: randomSeed(),
      event,
      difficulty,
      controllers: ['user', pvp ? 'remote' : 'bot'],
      follow: pvp?.room.role === 'guest',
    }),
  )
  const done = state.phase.kind === 'done'
  const [peerGone, setPeerGone] = useState(false)
  const stateRef = useRef(state)

  // 친구 대전: 받은 메시지를 경기에 넣고, 상대가 나가면 알린다
  useEffect(() => {
    if (!pvp) return
    const { room } = pvp
    const toAction = room.role === 'host' ? hostActionOf : guestActionOf
    const offMsg = room.onMessage((msg) => {
      const action = toAction(msg)
      if (action) dispatch(action)
    })
    const offPeer = room.onPeer((peer) => {
      if (!peer) setPeerGone(true)
    })
    return () => {
      offMsg()
      offPeer()
    }
  }, [pvp])

  // 친구 대전: 방장은 0.1초마다 상태를, 친구는 누른 횟수가 바뀌었으면 보낸다
  useEffect(() => {
    if (!pvp) return
    let sentTaps = 0
    const id = setInterval(() => {
      const s = stateRef.current
      if (pvp.room.role === 'host') pvp.room.send(hostSync(s))
      else if (s.taps[0] !== sentTaps) {
        sentTaps = s.taps[0]
        pvp.room.send({ t: 'taps', total: sentTaps })
      }
    }, SYNC_MS)
    return () => clearInterval(id)
  }, [pvp])

  // 친구 대전: 방장은 단계가 바뀌면 바로, 친구는 타이밍 판정을 바로 보낸다
  const sentRef = useRef(state)
  useEffect(() => {
    if (!pvp) return
    const prev = sentRef.current
    sentRef.current = state
    if (pvp.room.role === 'host') {
      if (phaseChanged(prev, state)) pvp.room.send(hostSync(state))
    } else {
      const msg = guestPressOut(prev, state)
      if (msg) pvp.room.send(msg)
    }
  }, [pvp, state])

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

  function pull(at: number) {
    dispatch(event === 'mash' ? { type: 'tap' } : { type: 'press', at })
  }

  // PC: 스페이스바 (꾹 누르고 있을 때 나오는 반복 입력은 안 침)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) dispatch(event === 'mash' ? { type: 'tap' } : { type: 'press', at: eventTime(e) })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [event])

  // 끝나면 잠깐 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
    stateRef.current = state
  })
  useEffect(() => {
    if (!done || peerGone) return
    const timer = setTimeout(() => finishRef.current(summarizeMatch(stateRef.current)), DONE_MS)
    return () => clearTimeout(timer)
  }, [done, peerGone])

  const { phase } = state
  const pulling = phase.kind === 'pull'
  const names = [loadNickname() ?? '나', pvp?.peerName ?? '봇'] as const
  const winner = phase.kind === 'roundEnd' || phase.kind === 'done' ? phase.winner : null
  const foeGrade = state.lastGrade[1]
  const shownPos = state.shownPos

  return (
    <div className="aw-game">
      <div className="aw-hud">
        <div className="aw-side">
          <span className="aw-side__name">{names[0]}</span>
          <WinDots wins={state.wins[0]} />
        </div>
        <span className="aw-hud__round">
          {state.round}판
          {pulling && <span className={phaseLeft(state) <= 3000 ? 'aw-hud__time aw-hud__time--low' : 'aw-hud__time'}>{Math.ceil(phaseLeft(state) / 1000)}초</span>}
        </span>
        <div className="aw-side aw-side--foe">
          <span className="aw-side__name">{names[1]}</span>
          <WinDots wins={state.wins[1]} />
        </div>
      </div>

      <div className="aw-view-wrap">
        <ArmView pos={shownPos} straining={pulling} now={state.now} names={names} winner={winner} />
        <Banner state={state} />
        {event === 'timing' && foeGrade && state.now - foeGrade.at < GRADE_SHOW_MS && (
          <span className={`aw-foe-grade aw-gauge__grade--${foeGrade.grade}`}>{GRADE_LABEL[foeGrade.grade]}</span>
        )}
      </div>

      <Lead pos={shownPos} pulling={pulling} />
      {/* 위치 막대: 손이 왼쪽(내 쪽) 끝까지 오면 내가 이김. 손 그림과 같은 방향 */}
      <div className="aw-bar" role="meter" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={shownPos} aria-label="손 위치">
        <span className="aw-bar__end aw-bar__end--win">◀ 이김</span>
        <span className="aw-bar__end aw-bar__end--lose">짐 ▶</span>
        <span
          className={`aw-bar__fill aw-bar__fill--${shownPos >= 0 ? 'me' : 'foe'}`}
          style={{ left: `${50 - Math.max(0, shownPos) * 50}%`, width: `${Math.abs(shownPos) * 50}%` }}
        />
        <span className="aw-bar__mid" />
        <span className="aw-bar__knob" style={{ left: `${50 - shownPos * 50}%` }} />
      </div>
      <div className="aw-timer" aria-hidden>
        <div className="aw-timer__fill" style={{ transform: `scaleX(${pulling ? phaseLeft(state) / ROUND_MS : 0})` }} />
      </div>

      {event === 'timing' && <Gauge state={state} />}

      <button
        type="button"
        className={`button aw-pull${pulling ? ' aw-pull--on' : ''}`}
        disabled={!pulling}
        onPointerDown={(e) => {
          // 터치하자마자 (click은 손을 뗄 때라 늦다)
          e.preventDefault()
          pull(eventTime(e))
        }}
      >
        {event === 'mash' ? '연타!' : '노란 곳에서 누르기!'}
      </button>
      <p className="aw-hint">
        {event === 'mash'
          ? '빠르게 많이 누를수록 내 쪽으로 넘어가요 · PC는 스페이스바'
          : '누르면 노란 곳이 옮겨 가요 · 지나갈 때 한 번만 · PC 스페이스바'}
      </p>

      {peerGone && !done && (
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
