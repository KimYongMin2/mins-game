import { useEffect, useRef } from 'react'
import type { Length } from '../constants'
import { type Digits, canAppend, isValidNumber } from '../rules/numbers'

type Props = {
  digits: Digits
  length: Length
  onChange: (digits: number[]) => void
  onSubmit: () => void
  submitLabel: string
  /** 지금 낼 수 있는지 (입력은 상대 차례에도 미리 해 둘 수 있다) */
  canSubmit: boolean
}

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** 숫자 칸과 키패드. 첫 자리 0과 이미 쓴 숫자는 누를 수 없다. PC는 숫자키·Backspace·Enter도 된다 */
export function Keypad({ digits, length, onChange, onSubmit, submitLabel, canSubmit }: Props) {
  const ready = canSubmit && isValidNumber(digits, length)
  const press = (d: number) => canAppend(digits, d, length) && onChange([...digits, d])
  const back = () => onChange(digits.slice(0, -1))

  // 키보드: 최신 값으로 부르도록 ref에 담는다
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) press(Number(e.key))
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Enter' && ready) onSubmit()
      else return
      e.preventDefault()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="nb-input">
      <div className="nb-slots" aria-label={`입력한 숫자 ${digits.join(' ') || '없음'}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`nb-slot${i === digits.length ? ' nb-slot--next' : ''}`}>
            {digits[i] ?? ''}
          </span>
        ))}
      </div>
      <div className="nb-keypad">
        {KEYS.map((d) => (
          <button key={d} type="button" className="nb-key" disabled={!canAppend(digits, d, length)} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="nb-key" disabled={!canAppend(digits, 0, length)} onClick={() => press(0)}>
          0
        </button>
        <button type="button" className="nb-key nb-key--back" disabled={digits.length === 0} onClick={back} aria-label="지우기">
          ⌫
        </button>
        <button type="button" className="nb-key nb-key--go" disabled={!ready} onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
