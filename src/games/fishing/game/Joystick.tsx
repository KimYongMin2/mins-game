import { useRef, useState } from 'react'

// 폰 조이스틱 (사용자 요청 — 누르는 곳으로 가는 것보다 조이스틱이 좋음). 엄지로 미는 방향·세기를 out에 (x 오른쪽, y 아래쪽, 0~1).
// 누른 곳이 가운데가 되는 떠다니는 조이스틱 (왼쪽 아래 넓은 칸 어디를 눌러도 됨)

const RADIUS = 52

export function Joystick({ out }: { out: { x: number; y: number } }) {
  const [knob, setKnob] = useState<{ cx: number; cy: number; dx: number; dy: number } | null>(null)
  const pid = useRef<number | null>(null)
  const set = (dx: number, dy: number, cx: number, cy: number) => {
    const d = Math.hypot(dx, dy)
    const k = d > RADIUS ? RADIUS / d : 1
    setKnob({ cx, cy, dx: dx * k, dy: dy * k })
    out.x = (dx * k) / RADIUS
    out.y = (dy * k) / RADIUS
  }
  const end = () => {
    pid.current = null
    setKnob(null)
    out.x = 0
    out.y = 0
  }
  return (
    <div
      className="fs-joy"
      onPointerDown={(e) => {
        // 우클릭·가운데 버튼은 무시 (우클릭 메뉴가 뜨면 손 뗀 신호가 안 와서 계속 밀린 채로 남았음)
        if (e.button !== 0 || pid.current !== null) return
        pid.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        const r = e.currentTarget.getBoundingClientRect()
        set(0, 0, e.clientX - r.left, e.clientY - r.top)
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pid.current || !knob) return
        const r = e.currentTarget.getBoundingClientRect()
        set(e.clientX - r.left - knob.cx, e.clientY - r.top - knob.cy, knob.cx, knob.cy)
      }}
      onPointerUp={(e) => e.pointerId === pid.current && end()}
      onPointerCancel={(e) => e.pointerId === pid.current && end()}
      onLostPointerCapture={(e) => e.pointerId === pid.current && end()}
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
