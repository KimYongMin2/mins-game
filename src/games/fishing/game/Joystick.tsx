import { useEffect, useRef, useState } from 'react'

// 폰 조이스틱 (사용자 요청 — 누르는 곳으로 가는 것보다 조이스틱이 좋음). 엄지로 미는 방향·세기를 out에 (x 오른쪽, y 아래쪽, 0~1).
// 누른 곳이 가운데가 되는 떠다니는 조이스틱 (왼쪽 아래 넓은 칸 어디를 눌러도 됨).
// 손가락을 뗀 신호를 놓쳐 계속 밀린 채로 남던 버그(사용자 제보 2026-11-18): 화면 어디서 떼도(창 전체에서 듣기),
// 그 손가락이 화면에 더는 없거나(touchend의 남은 손가락 목록), 앱을 나갔다 오면 풂.

const RADIUS = 52

export function Joystick({ out }: { out: { x: number; y: number } }) {
  const [knob, setKnob] = useState<{ cx: number; cy: number; dx: number; dy: number } | null>(null)
  const pid = useRef<number | null>(null)
  const knobRef = useRef(knob)
  useEffect(() => {
    knobRef.current = knob
  })
  const set = (dx: number, dy: number, cx: number, cy: number) => {
    const d = Math.hypot(dx, dy)
    const k = d > RADIUS ? RADIUS / d : 1
    setKnob({ cx, cy, dx: dx * k, dy: dy * k })
    out.x = (dx * k) / RADIUS
    out.y = (dy * k) / RADIUS
  }
  const endRef = useRef(() => {})
  endRef.current = () => {
    pid.current = null
    setKnob(null)
    out.x = 0
    out.y = 0
  }

  useEffect(() => {
    const end = () => pid.current !== null && endRef.current()
    const onUp = (e: PointerEvent) => e.pointerId === pid.current && end()
    // 손가락이 하나도 안 남았으면 무조건 풂 (pointerup을 놓친 경우)
    const onTouchEnd = (e: TouchEvent) => e.touches.length === 0 && end()
    const onHide = () => document.visibilityState !== 'visible' && end()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    window.addEventListener('blur', end)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('blur', end)
      document.removeEventListener('visibilitychange', onHide)
      endRef.current()
    }
  }, [])

  return (
    <div
      className="fs-joy"
      onPointerDown={(e) => {
        // 우클릭·가운데 버튼은 무시
        if (e.button !== 0) return
        // 이미 잡고 있는데 새 손가락이 오면(놓친 뗌) 새 손가락으로 다시 잡음
        pid.current = e.pointerId
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* 캡처 못 해도 창 전체에서 듣고 있음 */
        }
        const r = e.currentTarget.getBoundingClientRect()
        set(0, 0, e.clientX - r.left, e.clientY - r.top)
      }}
      onPointerMove={(e) => {
        const k = knobRef.current
        if (e.pointerId !== pid.current || !k) return
        const r = e.currentTarget.getBoundingClientRect()
        set(e.clientX - r.left - k.cx, e.clientY - r.top - k.cy, k.cx, k.cy)
      }}
      onPointerUp={(e) => e.pointerId === pid.current && endRef.current()}
      onPointerCancel={(e) => e.pointerId === pid.current && endRef.current()}
      onLostPointerCapture={(e) => e.pointerId === pid.current && endRef.current()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="조이스틱 (눌러서 밀면 걸어요)"
      role="application"
    >
      {knob ? (
        <span className="fs-joy__base" style={{ left: knob.cx, top: knob.cy }}>
          <span className="fs-joy__knob" style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
        </span>
      ) : (
        <span className="fs-joy__hint">
          <span className="fs-joy__knob" />
        </span>
      )}
    </div>
  )
}
