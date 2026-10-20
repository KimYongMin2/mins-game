import { useEffect, useReducer, useRef } from 'react'
import { randomSeed } from '../../../shared/random'
import { type Difficulty, type Hand, TOTAL_PITCHES } from '../constants'
import { FrontView, type Mark } from '../field/FrontView'
import { useZoneSwing } from '../input/useZoneSwing'
import { battedBallPosition } from '../play/battedBall'
import { PITCH_LABEL, ballPosition, cellCenter } from '../play/pitch'
import {
  type PitchRecord,
  type SessionState,
  type SessionSummary,
  createSession,
  pitcherPoseOf,
  sessionReducer,
  summarizeSession,
} from '../play/session'
import { CONTACT_LABEL, OUTCOME_LABEL } from '../rules/judge'
import { OUTCOME_POINTS, isHit, totalOf } from '../rules/scoring'
import { playSound } from '../sounds'
import { timingText } from './describe'

type Props = {
  difficulty: Difficulty
  hand: Hand
  onFinish: (summary: SessionSummary) => void
}

/** 스윙 동작 시간 (준비 → 맞힘 → 팔로스루) */
const SWING_MS = 320
/** 터치한 칸을 밝게 보여주는 시간 */
const TOUCH_FLASH_MS = 180

function Banner({ state }: { state: SessionState }) {
  const { phase } = state
  if (phase.kind === 'ready' || phase.kind === 'windup') {
    return (
      <div className="bt-banner bt-banner--hint">
        <span className="bt-banner__sub">
          {state.index + 1}번째 공 · 들어오는 칸을 터치!
        </span>
      </div>
    )
  }
  if (phase.kind !== 'result') return null
  const r = phase.record
  const hit = isHit(r.outcome)
  return (
    <div className="bt-banner" aria-live="polite">
      <strong className={`bt-banner__title${r.outcome === 'homerun' ? ' bt-banner__title--hr' : ''}`}>
        {OUTCOME_LABEL[r.outcome]}
        {hit && <span className="bt-banner__points"> +{OUTCOME_POINTS[r.outcome]}</span>}
      </strong>
      <span className="bt-banner__sub">
        {PITCH_LABEL[r.pitch.type]} · {r.pitch.cell}번
        {r.touched !== null && ` · ${r.touched}번 터치`}
      </span>
      {r.offsetMs !== null && r.contact !== 'miss' && (
        <span className="bt-banner__sub">
          {r.contact && r.contact !== 'sweet' && `${CONTACT_LABEL[r.contact]} · `}
          {timingText(r.offsetMs, state.difficulty)}
        </span>
      )}
      {r.contact === 'miss' && r.touched !== null && <span className="bt-banner__sub">배트가 닿지 않았어요</span>}
    </div>
  )
}

const SHORT: Record<PitchRecord['outcome'], string> = {
  homerun: 'HR',
  triple: '3B',
  double: '2B',
  single: '1B',
  out: '아웃',
  foul: '파울',
  whiff: '헛',
  looking: 'S',
}

function ScoreStrip({ state }: { state: SessionState }) {
  return (
    <ol className="bt-strip" aria-label="공별 결과">
      {Array.from({ length: TOTAL_PITCHES }, (_, i) => {
        const r = state.records[i]
        const current = i === state.index && state.phase.kind !== 'done'
        const cls = ['bt-strip__cell']
        if (current) cls.push('bt-strip__cell--current')
        if (r && isHit(r.outcome)) cls.push('bt-strip__cell--hit')
        if (r?.outcome === 'homerun') cls.push('bt-strip__cell--hr')
        return (
          <li key={i} className={cls.join(' ')}>
            {r ? SHORT[r.outcome] : ''}
          </li>
        )
      })}
    </ol>
  )
}

export function GameScreen({ difficulty, hand, onFinish }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, () =>
    createSession({ now: performance.now(), seed: randomSeed(), difficulty, hand }),
  )
  const done = state.phase.kind === 'done'

  const pointer = useZoneSwing((cell, at) => dispatch({ type: 'swing', cell, at }))

  // 효과음: 리듀서가 쌓은 것 중 아직 재생하지 않은 것만
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

  // 10구가 끝나면 잠깐 보여준 뒤 결과로
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  useEffect(() => {
    if (!done) return
    const summary = summarizeSession(state)
    const timer = setTimeout(() => finishRef.current(summary), 900)
    return () => clearTimeout(timer)
  }, [done, state])

  const { phase, now } = state
  let ball = null
  if (phase.kind === 'pitching') ball = ballPosition(phase.pitch, now)
  else if (phase.kind === 'result') ball = phase.batted ? battedBallPosition(phase.batted, now) : ballPosition(phase.pitch, now)

  const swingOf = phase.kind === 'pitching' || phase.kind === 'result' ? phase.swing : null
  const swing = swingOf ? { cell: swingOf.cell, progress: Math.min(1, Math.max(0, (now - swingOf.at) / SWING_MS)) } : null
  const touched = swingOf && now - swingOf.at < TOUCH_FLASH_MS ? swingOf.cell : null

  // 지나간 공 자리. 이번 공은 결과가 나온 뒤에 진하게
  const marks: Mark[] = state.records.map((r, i) => {
    const c = cellCenter(r.pitch.cell)
    return { at: { x: c.x, y: c.y, z: 0 }, latest: phase.kind === 'result' && i === state.records.length - 1 }
  })

  const total = totalOf(state.records.map((r) => r.outcome))

  return (
    <div className="bt-game">
      <div className="bt-hud">
        <span>
          <strong>{Math.min(state.index + 1, TOTAL_PITCHES)}</strong>/{TOTAL_PITCHES}구
        </span>
        <span>
          <strong>{total.points}</strong>점 · 홈런 {total.homeruns}
        </span>
      </div>

      <div className="bt-view-wrap">
        <FrontView
          hand={hand}
          pitcher={pitcherPoseOf(state)}
          ball={ball}
          swing={swing}
          marks={marks}
          touched={touched}
          onPointerDown={pointer.onPointerDown}
        />
        <Banner state={state} />
      </div>

      <ScoreStrip state={state} />
      <p className="bt-hint">
        공이 들어오는 칸을 타이밍 맞춰 터치
        <span className="bt-hint__pc"> · PC: 클릭 또는 Q W E / A S D / Z X C</span>
      </p>
    </div>
  )
}
