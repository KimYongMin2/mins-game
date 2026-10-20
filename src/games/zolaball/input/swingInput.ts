import { useEffect, useRef } from 'react'
import { eventTime } from '../../../shared/input/eventTime'

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
