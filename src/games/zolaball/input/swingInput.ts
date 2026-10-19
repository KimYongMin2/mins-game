import { useEffect, useRef } from 'react'

/**
 * 이벤트가 실제로 일어난 시각. 렌더링이나 핸들러 지연과 상관없이 정확한 판정을 위해 쓴다.
 * 최신 브라우저에서 event.timeStamp는 performance.now()와 같은 기준이지만, 아닌 경우를 대비한다.
 */
export function eventTime(e: { timeStamp: number }): number {
  const now = performance.now()
  const t = e.timeStamp
  return t > 0 && t <= now && now - t < 1000 ? t : now
}

function isSpace(e: KeyboardEvent) {
  return e.code === 'Space' || e.key === ' '
}

/** PC 스페이스바 스윙. 스페이스가 포커스된 버튼을 누르거나 페이지를 스크롤하지 않게 막는다. */
export function useSpaceSwing(onSwing: (time: number) => void) {
  const handler = useRef(onSwing)
  useEffect(() => {
    handler.current = onSwing
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isSpace(e)) return
      e.preventDefault()
      if (!e.repeat) handler.current(eventTime(e))
    }
    function onKeyUp(e: KeyboardEvent) {
      if (isSpace(e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
