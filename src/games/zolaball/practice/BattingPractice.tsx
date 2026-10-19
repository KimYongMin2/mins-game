import { useEffect, useReducer, useState } from 'react'
import { SWING_DURATION_MS } from '../constants'
import { Field } from '../field/Field'
import { CAMERA_PITCH } from '../field/camera'
import { eventTime, useSpaceSwing } from '../input/swingInput'
import { type Pitch, type PitchCall, type PitchHeight, type PitchType, ballPosition } from '../play/pitch'
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

const TYPE_LABEL: Record<PitchType, string> = { fastball: '직구', breaking: '변화구' }
const HEIGHT_LABEL: Record<PitchHeight, string> = { high: '높은', low: '낮은' }

/** 연습 옵션. 'random'이면 던질 때마다 무작위로 고른다. */
type Choice<T> = T | 'random'

type ToggleOption<T> = { value: T; label: string }

function pick<T>(choice: Choice<T>, values: readonly T[]): T {
  return choice === 'random' ? values[Math.floor(Math.random() * values.length)] : choice
}

/** 버튼을 누르고 공을 던지기까지의 와인드업 시간. 매번 달라서 버튼 타이밍으로 예측할 수 없다. */
function windupMs() {
  return 500 + Math.random() * 600
}

function describePitch(pitch: Pitch): string {
  return `${HEIGHT_LABEL[pitch.height]} ${TYPE_LABEL[pitch.type]} · ${pitch.isBall ? '볼' : '스트라이크'}`
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

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ToggleOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="zb-toggle" role="group" aria-label={label}>
      <span className="zb-toggle__label">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="button button--small"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function BattingPractice() {
  const [state, dispatch] = useReducer(practiceReducer, undefined, () =>
    initialPracticeState(performance.now()),
  )
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [pitchType, setPitchType] = useState<Choice<PitchType>>('random')
  const [course, setCourse] = useState<Choice<'strike' | 'ball'>>('random')
  const [height, setHeight] = useState<Choice<PitchHeight>>('random')

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
    const call: PitchCall = {
      type: pick(pitchType, ['fastball', 'breaking'] as const),
      isBall: pick(course, ['strike', 'ball'] as const) === 'ball',
      height: pick(height, ['high', 'low'] as const),
    }
    dispatch({ type: 'pitch', releaseAt: performance.now() + windupMs(), call })
  }

  const { pitch, now, swingAt } = state
  const ballHidden = !pitch || (state.contact && now >= pitch.arriveAt)
  const ball = ballHidden ? null : ballPosition(pitch, now)
  const swingProgress =
    swingAt !== null && isSwinging(state) ? Math.max(0, now - swingAt) / SWING_DURATION_MS : null
  const outcome = state.outcome && describeOutcome(state.outcome)
  // 공이 홈플레이트를 지난 자리. 투구가 끝난 뒤에도 결과와 함께 남겨 둔다.
  const marked = state.lastPitch
  const mark = marked && now >= marked.arriveAt ? { x: 0, y: marked.plateHeight } : null
  // 투구가 끝난 뒤에만 구종을 알려준다.
  const pitchInfo = !pitch && state.lastPitch ? describePitch(state.lastPitch) : null

  return (
    <>
      <div className="zb-field-wrap">
        <Field camera={CAMERA_PITCH} ball={ball} swing={swingProgress} mark={mark} />
      </div>

      <div className="zb-practice-result" aria-live="polite">
        {outcome ? (
          <>
            <strong className="zb-practice-result__title">{outcome.title}</strong>
            <span className="zb-practice-result__detail">
              {outcome.detail}
              {pitchInfo && ` · ${pitchInfo}`}
            </span>
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
        <Toggle
          label="난이도"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'normal', label: '일반' },
            { value: 'hard', label: '어려움' },
          ]}
        />
        <Toggle
          label="구종"
          value={pitchType}
          onChange={setPitchType}
          options={[
            { value: 'random', label: '랜덤' },
            { value: 'fastball', label: '직구' },
            { value: 'breaking', label: '변화구' },
          ]}
        />
        <Toggle
          label="코스"
          value={course}
          onChange={setCourse}
          options={[
            { value: 'random', label: '랜덤' },
            { value: 'strike', label: '스트라이크' },
            { value: 'ball', label: '볼' },
          ]}
        />
        <Toggle
          label="높이"
          value={height}
          onChange={setHeight}
          options={[
            { value: 'random', label: '랜덤' },
            { value: 'high', label: '높게' },
            { value: 'low', label: '낮게' },
          ]}
        />
      </div>
    </>
  )
}
