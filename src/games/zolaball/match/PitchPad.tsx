import type { PitchHeight } from '../play/pitch'
import { PITCH_KEYS, PITCH_KEY_INFO, type PitchKey, type PitchSelection } from '../play/pitchSelection'

type Props = {
  selection: PitchSelection
  disabled: boolean
  onKey: (key: PitchKey) => void
  onHeight: (height: PitchHeight) => void
}

const HEIGHTS: { value: PitchHeight; label: string; keyHint: string }[] = [
  { value: 'high', label: '높게', keyHint: '↑' },
  { value: 'low', label: '낮게', keyHint: '↓' },
]

/** 투수 조작 버튼. 구종(1~4)과 높이(↑↓)를 모두 고르면 던진다. */
export function PitchPad({ selection, disabled, onKey, onHeight }: Props) {
  return (
    <div className="zb-pitchpad">
      <div className="zb-pitchpad__kinds" role="group" aria-label="구종">
        {PITCH_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="button zb-pitchpad__button"
            aria-pressed={selection.key === key}
            disabled={disabled}
            onClick={() => onKey(key)}
          >
            <kbd className="zb-key">{key}</kbd>
            {PITCH_KEY_INFO[key].label}
          </button>
        ))}
      </div>
      <div className="zb-pitchpad__heights" role="group" aria-label="높이">
        {HEIGHTS.map((h) => (
          <button
            key={h.value}
            type="button"
            className="button zb-pitchpad__button"
            aria-pressed={selection.height === h.value}
            disabled={disabled}
            onClick={() => onHeight(h.value)}
          >
            <kbd className="zb-key">{h.keyHint}</kbd>
            {h.label}
          </button>
        ))}
      </div>
    </div>
  )
}
