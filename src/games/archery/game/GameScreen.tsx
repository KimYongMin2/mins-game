import { useEffect, useReducer, useRef } from 'react'
import { randomSeed } from '../../../shared/random'
import { AUTO_RELEASE_MS, ROUNDS, TOTAL_ARROWS } from '../constants'
import { SideView } from '../field/SideView'
import { TargetView } from '../field/TargetView'
import { viewHalfSize } from '../field/view'
import { useBowControls } from '../input/useBowControls'
import { drawProgress, fatigue } from '../play/shot'
import { WIND_ARROWS, WIND_TIERS } from '../play/wind'
import {
  type RoundState,
  type RoundSummary,
  createRound,
  currentDistance,
  holdMsOf,
  reticleAt,
  roundReducer,
  summarizeRound,
} from '../play/roundState'
import { totalOf } from '../rules/scoring'

type Props = {
  onFinish: (summary: RoundSummary) => void
}

/** 드래그 1픽셀이 조준을 얼마나 옮기는지 (화면 거리 대비 비율). 1보다 작아야 섬세하게 조준된다 */
const DRAG_RATIO = 0.5
/** 방향키 조준 속도: 1초에 보이는 범위의 몇 배 */
const KEY_AIM_SPEED = 0.35

function scoreText(points: number, x: boolean) {
  if (x) return 'X!'
  if (points === 0) return '빗나감'
  return `${points}점`
}

function Banner({ state }: { state: RoundState }) {
  const { phase } = state
  if (phase.kind === 'announce') {
    const round = ROUNDS.find((r) => r.distance === currentDistance(state))!
    return (
      <div className="ar-banner">
        <strong className="ar-banner__title">{round.distance}m</strong>
        <span className="ar-banner__sub">{round.arrows}발</span>
      </div>
    )
  }
  if (phase.kind === 'scored') {
    const { score } = phase.shot
    return (
      <div className="ar-banner" aria-live="polite">
        <strong className={`ar-banner__title${score.points === 10 ? ' ar-banner__title--gold' : ''}`}>
          {scoreText(score.points, score.x)}
        </strong>
      </div>
    )
  }
  if (phase.kind === 'ready') {
    return (
      <div className="ar-banner ar-banner--hint">
        <span className="ar-banner__sub">눌러서 당기기</span>
      </div>
    )
  }
  return null
}

function DrawMeter({ state }: { state: RoundState }) {
  const hold = holdMsOf(state)
  const drawing = state.phase.kind === 'drawing'
  const progress = drawing ? drawProgress(hold) : 0
  const tired = drawing ? fatigue(hold) : 1
  const left = Math.ceil((AUTO_RELEASE_MS - hold) / 1000)
  let label = ''
  if (drawing) {
    if (progress < 1) label = '당기는 중…'
    else if (tired < 1.3) label = '조준!'
    else label = left <= 3 ? `팔이 떨려요 · ${left}초 뒤 발사` : '팔이 떨려요'
  }
  return (
    <div className="ar-meter">
      <div className="ar-meter__track">
        <div
          className={`ar-meter__fill${tired >= 1.3 ? ' ar-meter__fill--tired' : ''}`}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <span className="ar-meter__label">{label}</span>
    </div>
  )
}

function ScoreSheet({ state }: { state: RoundState }) {
  let i = 0
  return (
    <div className="ar-sheet">
      {ROUNDS.map((round) => (
        <div key={round.distance} className="ar-sheet__group">
          <span className="ar-sheet__distance">{round.distance}m</span>
          <div className="ar-sheet__cells">
            {Array.from({ length: round.arrows }, () => {
              const index = i++
              const shot = state.shots[index]
              const current = index === state.arrowIndex && state.phase.kind !== 'done'
              return (
                <span key={index} className={`ar-sheet__cell${current ? ' ar-sheet__cell--current' : ''}`}>
                  {shot ? (shot.score.x ? 'X' : shot.score.points === 0 ? 'M' : shot.score.points) : ''}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function GameScreen({ onFinish }: Props) {
  const [state, dispatch] = useReducer(roundReducer, undefined, () => createRound(performance.now(), randomSeed()))
  const distance = currentDistance(state)
  const done = state.phase.kind === 'done'
  const wrapRef = useRef<HTMLDivElement>(null)

  const { pointerHandlers, heldArrows } = useBowControls({
    onPress: () => dispatch({ type: 'press', at: performance.now() }),
    onRelease: () => dispatch({ type: 'release', at: performance.now() }),
    onDragPx: (dx, dy) => {
      const width = wrapRef.current?.getBoundingClientRect().width ?? 1
      const metersPerPx = ((viewHalfSize(distance) * 2) / width) * DRAG_RATIO
      dispatch({ type: 'aimBy', dx: dx * metersPerPx, dy: -dy * metersPerPx })
    },
  })

  // 매 프레임: 시간 진행 + 방향키 조준
  const distanceRef = useRef(distance)
  useEffect(() => {
    distanceRef.current = distance
  })
  useEffect(() => {
    if (done) return
    let last = performance.now()
    let id = requestAnimationFrame(function loop(t) {
      const dt = Math.min(t - last, 50) / 1000
      last = t
      const keys = heldArrows.current
      const dirX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
      const dirY = (keys.up ? 1 : 0) - (keys.down ? 1 : 0)
      if (dirX || dirY) {
        const speed = viewHalfSize(distanceRef.current) * KEY_AIM_SPEED
        dispatch({ type: 'aimBy', dx: dirX * speed * dt, dy: dirY * speed * dt })
      }
      dispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [done, heldArrows])

  // 10발이 끝나면 잠깐 보여준 뒤 결과로
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  useEffect(() => {
    if (!done) return
    const summary = summarizeRound(state)
    const timer = setTimeout(() => finishRef.current(summary), 900)
    return () => clearTimeout(timer)
  }, [done, state])

  const { phase, now } = state
  const total = totalOf(state.shots.map((s) => s.score))
  const atThisDistance = state.shots.filter((s) => s.distance === distance)
  const arrows = atThisDistance.map((s, i) => ({ at: s.impact, latest: i === atThisDistance.length - 1 && phase.kind === 'scored' }))
  const flying = phase.kind === 'flying' ? { to: phase.shot.impact, progress: (now - phase.startAt) / (phase.until - phase.startAt) } : null
  const tier = WIND_TIERS[state.wind.tier]

  return (
    <div className="ar-game">
      <div className="ar-hud">
        <span className="ar-hud__round">
          <strong>{distance}m</strong> · {Math.min(state.arrowIndex + 1, TOTAL_ARROWS)}/{TOTAL_ARROWS}발
        </span>
        <span className="ar-hud__total">
          <strong>{total.points}</strong>점 · X {total.xCount}
        </span>
      </div>

      <SideView
        distance={distance}
        draw={phase.kind === 'drawing' ? drawProgress(holdMsOf(state)) : 0}
        arrowProgress={flying ? Math.min(flying.progress, 1) : null}
      />

      <div className="ar-target-wrap ar-target-wrap--game" ref={wrapRef} {...pointerHandlers}>
        <TargetView
          distance={distance}
          reticle={reticleAt(state)}
          drawProgress={phase.kind === 'drawing' ? drawProgress(holdMsOf(state)) : 0}
          arrows={arrows}
          flying={flying ? { to: flying.to, progress: Math.min(flying.progress, 1) } : null}
        />
        <div className={`ar-wind ar-wind--${state.wind.tier}`} aria-label={`바람: ${tier.label} ${state.wind.speed}m/s`}>
          <span className="ar-wind__arrow">{WIND_ARROWS[state.wind.direction]}</span>
          <span className="ar-wind__text">
            {tier.label}
            <br />
            {state.wind.speed.toFixed(1)}m/s
          </span>
        </div>
        <Banner state={state} />
      </div>

      <DrawMeter state={state} />
      <ScoreSheet state={state} />
      <p className="ar-hint">
        누른 채로 드래그해서 조준, 떼면 발사
        <span className="ar-hint__pc"> · PC: 스페이스바를 누른 채 방향키</span>
      </p>
    </div>
  )
}
