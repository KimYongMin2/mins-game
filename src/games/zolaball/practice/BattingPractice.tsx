import { useEffect, useReducer, useState } from 'react'
import { SWING_DURATION_MS } from '../constants'
import { Field } from '../field/Field'
import { CAMERA_PITCH } from '../field/camera'
import { eventTime, useSpaceSwing } from '../input/swingInput'
import { ballPosition } from '../play/pitch'
import type { Difficulty, SwingResult } from '../rules/judge'
import {
  type Outcome,
  initialPracticeState,
  isSwinging,
  practiceReducer,
} from './practiceState'

const RESULT_LABEL: Record<SwingResult, string> = {
  homerun: '홈런!',
  double: '2루타',
  single: '안타',
  out: '범타 아웃',
  foul: '파울',
  miss: '헛스윙',
}

/** 버튼을 누르고 공을 던지기까지의 와인드업 시간. 매번 달라서 버튼 타이밍으로 예측할 수 없다. */
function windupMs() {
  return 500 + Math.random() * 600
}

function describeOutcome(outcome: Outcome): { title: string; detail: string } {
  if (outcome.kind === 'take') {
    return {
      title: outcome.call === 'strike' ? '스트라이크' : '볼',
      detail: '스윙하지 않음',
    }
  }
  const ms = Math.round(outcome.diffMs)
  const detail = ms === 0 ? '정확히 맞춤 (0ms)' : `${Math.abs(ms)}ms ${ms < 0 ? '빠름' : '늦음'}`
  return { title: RESULT_LABEL[outcome.result], detail }
}

export function BattingPractice() {
  const [state, dispatch] = useReducer(practiceReducer, undefined, () =>
    initialPracticeState(performance.now()),
  )
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [throwBall, setThrowBall] = useState(false)

  const animating = state.pitch !== null || isSwinging(state)
  useEffect(() => {
    if (!animating) return
    let id = requestAnimationFrame(function loop(now) {
      dispatch({ type: 'tick', now })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [animating])

  function swing(at: number) {
    dispatch({ type: 'swing', at, difficulty })
  }
  useSpaceSwing(swing)

  function throwPitch() {
    dispatch({ type: 'pitch', releaseAt: performance.now() + windupMs(), isBall: throwBall })
  }

  const { pitch, now, swingAt } = state
  const ballHidden = !pitch || (state.contact && now >= pitch.arriveAt)
  const ball = ballHidden ? null : ballPosition(pitch, now)
  const swingProgress =
    swingAt !== null && isSwinging(state) ? Math.max(0, now - swingAt) / SWING_DURATION_MS : null
  const outcome = state.outcome && describeOutcome(state.outcome)

  return (
    <>
      <div className="zb-field-wrap">
        <Field camera={CAMERA_PITCH} ball={ball} swing={swingProgress} />
      </div>

      <div className="zb-practice-result" aria-live="polite">
        {outcome ? (
          <>
            <strong className="zb-practice-result__title">{outcome.title}</strong>
            <span className="zb-practice-result__detail">{outcome.detail}</span>
          </>
        ) : (
          <span className="zb-practice-result__detail">
            {pitch ? '공이 날아옵니다…' : '[투구]를 누르면 연습 공이 날아와요'}
          </span>
        )}
      </div>

      <div className="zb-controls">
        <button
          type="button"
          className="button zb-controls__pitch"
          onClick={throwPitch}
          disabled={pitch !== null}
        >
          투구
        </button>
        <button
          type="button"
          className="button button--primary zb-controls__swing"
          onPointerDown={(e) => {
            e.preventDefault()
            swing(eventTime(e))
          }}
        >
          스윙
        </button>
      </div>
      <p className="zb-hint">PC에서는 스페이스바로 스윙</p>

      <div className="zb-options">
        <div className="zb-toggle" role="group" aria-label="난이도">
          {(['normal', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="button button--small"
              aria-pressed={difficulty === d}
              onClick={() => setDifficulty(d)}
            >
              {d === 'normal' ? '일반' : '어려움'}
            </button>
          ))}
        </div>
        <div className="zb-toggle" role="group" aria-label="공 종류">
          {[false, true].map((isBall) => (
            <button
              key={String(isBall)}
              type="button"
              className="button button--small"
              aria-pressed={throwBall === isBall}
              onClick={() => setThrowBall(isBall)}
            >
              {isBall ? '볼(낮게)' : '스트라이크'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
