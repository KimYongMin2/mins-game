import { useEffect, useRef, useState } from 'react'
import { eventTime } from '../../../shared/input/eventTime'
import { type InputKind, INPUT_LABEL, LATENCY_RANGE, inputKindOf, loadLatency, saveLatency } from '../input/latency'
import { CALIBRATE_TAPS, measureLatency, tapError } from '../input/calibrate'
import { PASS_MS } from '../constants'
import { GRADES, GRADE_LABEL, type Grade, markerAt } from '../rules/timing'

type Props = {
  onDone: () => void
}

type Tap = { kind: InputKind; error: number }

/** 보정을 뺀 어긋남(ms)의 판정 (과녁 가운데 기준). 막대는 PASS_MS 동안 2만큼 간다 */
function gradeOf(errorMs: number): Grade {
  const off = (Math.abs(errorMs) * 2) / PASS_MS
  return GRADES.find((g) => off <= g.within)?.grade ?? 'miss'
}

const signed = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)}ms`

/** 타이밍 맞추기: 막대가 가운데 올 때 눌러서 내 기기·손의 지연을 재고, 감도처럼 직접 조정해 저장한다 */
export function CalibrateScreen({ onDone }: Props) {
  const [saved, setSaved] = useState(loadLatency)
  const [taps, setTaps] = useState<Tap[]>([])
  /** 잰 뒤 조정 중인 보정값 (재기 전엔 null) */
  const [draft, setDraft] = useState<{ kind: InputKind; ms: number } | null>(null)
  /** 막대가 돌기 시작한 시각 */
  const [start] = useState(() => performance.now())
  const [now, setNow] = useState(start)

  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      setNow(t)
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const lastKind = taps.at(-1)?.kind ?? 'touch'
  const measuring = draft === null
  const offset = draft ? draft.ms : saved[lastKind]

  function press(at: number, kind: InputKind) {
    const error = tapError(at - start)
    if (error === null) return
    const next = [...taps, { kind, error }]
    setTaps(next)
    if (measuring) {
      const same = next.filter((t) => t.kind === kind)
      if (same.length >= CALIBRATE_TAPS) setDraft({ kind, ms: measureLatency(same.map((t) => t.error)) })
    }
  }
  const pressRef = useRef(press)
  useEffect(() => {
    pressRef.current = press
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      pressRef.current(eventTime(e), 'other')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const x = markerAt(now - start).x
  const last = taps.at(-1)
  const lastGrade = last ? gradeOf(last.error - offset) : null
  const count = taps.filter((t) => t.kind === lastKind).length
  // 점 표시: 최근 것 위주로, ±150ms 안
  const dots = taps.slice(-12)

  function adjust(delta: number) {
    if (!draft) return
    setDraft({ ...draft, ms: Math.min(LATENCY_RANGE.max, Math.max(LATENCY_RANGE.min, draft.ms + delta)) })
  }
  function save() {
    if (!draft) return
    const next = { ...saved, [draft.kind]: draft.ms }
    saveLatency(next)
    setSaved(next)
    onDone()
  }
  function retry() {
    setTaps([])
    setDraft(null)
  }

  return (
    <section className="aw-cal">
      <p className="subtitle">
        {measuring
          ? `막대가 가운데 노란 곳에 올 때 눌러 보세요. ${CALIBRATE_TAPS}번 누르면 내 손과 기기에 맞춰져요`
          : '이 보정으로 눌러 보며 확인하세요. 늦게 잡히면 +, 일찍 잡히면 −'}
      </p>

      <div className="aw-gauge" aria-hidden>
        {[...GRADES].reverse().map((g) => (
          <span key={g.grade} className={`aw-gauge__zone aw-gauge__zone--${g.grade}`} style={{ width: `${g.within * 100}%` }} />
        ))}
        <span className="aw-gauge__marker" style={{ left: `${50 + x * 50}%` }} />
        {lastGrade && <span className={`aw-gauge__grade aw-gauge__grade--${lastGrade}`}>{GRADE_LABEL[lastGrade]}</span>}
      </div>

      {/* 누른 것들이 가운데에서 얼마나 어긋났는지 (보정 뺀 값) */}
      <div className="aw-cal__strip" aria-label="누른 타이밍">
        <span className="aw-cal__center" />
        {dots.map((t, i) => {
          const e = Math.max(-150, Math.min(150, t.error - offset))
          return <span key={taps.length - dots.length + i} className="aw-cal__dot" style={{ left: `${50 + (e / 150) * 50}%`, opacity: 0.3 + (0.7 * (i + 1)) / dots.length }} />
        })}
        <span className="aw-cal__end aw-cal__end--early">빠름</span>
        <span className="aw-cal__end aw-cal__end--late">늦음</span>
      </div>

      <p className="aw-cal__status" aria-live="polite">
        {last ? `방금 ${signed(last.error - offset)} · ` : ''}
        {measuring ? `${count}/${CALIBRATE_TAPS}번` : `${INPUT_LABEL[draft.kind]} 보정 ${Math.round(draft.ms)}ms`}
      </p>

      <button
        type="button"
        className="button aw-pull aw-pull--on"
        onPointerDown={(e) => {
          e.preventDefault()
          press(eventTime(e), inputKindOf(e.pointerType))
        }}
      >
        가운데에서 누르기!
      </button>

      {draft ? (
        <>
          <div className="aw-cal__adjust" role="group" aria-label="보정 조정">
            <button type="button" className="button" onClick={() => adjust(-10)}>
              −10ms
            </button>
            <strong>{Math.round(draft.ms)}ms</strong>
            <button type="button" className="button" onClick={() => adjust(10)}>
              +10ms
            </button>
          </div>
          <div className="aw-cal__buttons">
            <button type="button" className="button button--primary" onClick={save}>
              저장
            </button>
            <button type="button" className="button" onClick={retry}>
              다시 재기
            </button>
          </div>
        </>
      ) : (
        <p className="aw-cal__saved">
          지금 보정: 터치 {Math.round(saved.touch)}ms · 마우스·키보드 {Math.round(saved.other)}ms
        </p>
      )}
      <button type="button" className="button aw-cal__back" onClick={onDone}>
        {draft ? '저장 안 하고 나가기' : '나가기'}
      </button>
    </section>
  )
}
