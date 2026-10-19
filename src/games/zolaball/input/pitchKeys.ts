import { useEffect, useRef } from 'react'
import type { PitchHeight } from '../play/pitch'
import type { PitchKey } from '../play/pitchSelection'

type Handlers = {
  onKey: (key: PitchKey) => void
  onHeight: (height: PitchHeight) => void
}

const DIGITS: Record<string, PitchKey> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
}

/** PC 투수 조작: 1~4 구종, ↑↓ 높낮이. enabled가 false면 무시한다. */
export function usePitchKeys(enabled: boolean, handlers: Handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const key = DIGITS[e.code]
      if (key) {
        e.preventDefault()
        ref.current.onKey(key)
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault() // 페이지 스크롤 방지
        ref.current.onHeight(e.code === 'ArrowUp' ? 'high' : 'low')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
