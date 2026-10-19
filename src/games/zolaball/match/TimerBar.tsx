type Props = {
  /** 남은 시간 비율 0~1. null이면 빈 막대(타이머 없음) */
  remaining: number | null
  label: string
}

/** 조작 영역 위의 5초 타이머 막대 */
export function TimerBar({ remaining, label }: Props) {
  const ratio = remaining === null ? 0 : Math.min(Math.max(remaining, 0), 1)
  return (
    <div className="zb-timer">
      <div
        className="zb-timer__track"
        role="progressbar"
        aria-label="남은 시간"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <div
          className={`zb-timer__fill${ratio < 0.3 ? ' zb-timer__fill--low' : ''}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <span className="zb-timer__label">{label}</span>
    </div>
  )
}
