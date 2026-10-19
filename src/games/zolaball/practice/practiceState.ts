import { SWING_DURATION_MS } from '../constants'
import { type Pitch, type PitchCall, createPitch, pitchEndAt } from '../play/pitch'
import { type Difficulty, type SwingResult, judgeSwing } from '../rules/judge'

export type Outcome =
  | { kind: 'swing'; result: SwingResult; diffMs: number }
  | { kind: 'take'; call: 'strike' | 'ball' }

export type PracticeState = {
  now: number
  pitch: Pitch | null
  /** 가장 최근에 던진 공. 투구가 끝난 뒤에도 결과와 함께 보여준다. */
  lastPitch: Pitch | null
  /** 이번 투구에 이미 스윙했는지 (투구당 판정은 한 번) */
  swung: boolean
  /** 배트에 맞았는지. 맞으면 공은 홈플레이트에서 사라진다. */
  contact: boolean
  swingAt: number | null
  outcome: Outcome | null
}

export type PracticeAction =
  | { type: 'pitch'; releaseAt: number; call: PitchCall }
  | { type: 'swing'; at: number; difficulty: Difficulty }
  | { type: 'tick'; now: number }

export function initialPracticeState(now: number): PracticeState {
  return { now, pitch: null, lastPitch: null, swung: false, contact: false, swingAt: null, outcome: null }
}

export function isSwinging(state: PracticeState, at = state.now): boolean {
  return state.swingAt !== null && at < state.swingAt + SWING_DURATION_MS
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'pitch': {
      if (state.pitch) return state
      const pitch = createPitch(action.call, action.releaseAt)
      return {
        ...state,
        pitch,
        lastPitch: pitch,
        swung: false,
        contact: false,
        outcome: null,
      }
    }

    case 'swing': {
      // 스윙 동작 중에는 다시 휘두를 수 없다.
      if (isSwinging(state, action.at)) return state
      const next = { ...state, swingAt: action.at }
      const { pitch } = state
      if (!pitch || state.swung || action.at < pitch.releaseAt) return next

      const diffMs = action.at - pitch.arriveAt
      const result = judgeSwing({ diffMs, difficulty: action.difficulty, pitchIsBall: pitch.isBall })
      return {
        ...next,
        swung: true,
        contact: result !== 'miss',
        outcome: { kind: 'swing', result, diffMs },
      }
    }

    case 'tick': {
      const next = { ...state, now: action.now }
      const { pitch } = state
      if (!pitch || action.now < pitchEndAt(pitch)) return next
      // 투구 종료: 스윙하지 않았으면 볼/스트라이크 판정
      return {
        ...next,
        pitch: null,
        outcome: state.swung
          ? state.outcome
          : { kind: 'take', call: pitch.isBall ? 'ball' : 'strike' },
      }
    }
  }
}
