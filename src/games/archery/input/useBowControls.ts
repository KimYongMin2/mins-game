import { type PointerEvent, useEffect, useRef } from 'react'

// 활 조작 입력. 누르면 당기기 시작, 누른 채로 조준을 옮기고, 떼면 발사.
// - 마우스·터치: 과녁 위에서 누른 채로 드래그
// - 키보드: 스페이스바를 누른 채로 방향키

type Handlers = {
  onPress: () => void
  onRelease: () => void
  /** 조준 이동 (화면 픽셀 기준, 오른쪽·아래가 +) */
  onDragPx: (dx: number, dy: number) => void
}

export type HeldArrows = { left: boolean; right: boolean; up: boolean; down: boolean }

const ARROW_CODES: Record<string, keyof HeldArrows> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export function useBowControls(handlers: Handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  /** 지금 누르고 있는 포인터 (하나만 받는다) */
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const spaceDown = useRef(false)
  const held = useRef<HeldArrows>({ left: false, right: false, up: false, down: false })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        if (e.repeat || spaceDown.current || pointer.current) return
        spaceDown.current = true
        ref.current.onPress()
        return
      }
      const arrow = ARROW_CODES[e.code]
      if (arrow) {
        e.preventDefault()
        held.current[arrow] = true
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        if (!spaceDown.current) return
        spaceDown.current = false
        ref.current.onRelease()
        return
      }
      const arrow = ARROW_CODES[e.code]
      if (arrow) held.current[arrow] = false
    }
    function onBlur() {
      // 창을 벗어나면 키 상태를 풀어 준다 (쏘지는 않는다)
      held.current = { left: false, right: false, up: false, down: false }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const pointerHandlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pointer.current || spaceDown.current) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      ref.current.onPress()
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const p = pointer.current
      if (!p || p.id !== e.pointerId) return
      ref.current.onDragPx(e.clientX - p.x, e.clientY - p.y)
      pointer.current = { id: p.id, x: e.clientX, y: e.clientY }
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      if (pointer.current?.id !== e.pointerId) return
      pointer.current = null
      ref.current.onRelease()
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      if (pointer.current?.id !== e.pointerId) return
      pointer.current = null
      ref.current.onRelease()
    },
  }

  return { pointerHandlers, heldArrows: held }
}
