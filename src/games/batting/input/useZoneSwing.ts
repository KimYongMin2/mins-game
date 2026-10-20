import { type PointerEvent, useEffect, useRef } from 'react'
import { eventTime } from '../../../shared/input/eventTime'
import { VIEW_W, CELL_SIZE, zoneRect } from '../field/view'
import { type Cell, cellAt } from '../rules/judge'

// 스윙 입력: 칸을 터치(클릭)하거나, PC 키보드로 칸 위치대로 Q W E / A S D / Z X C.
// 존 밖을 눌러도 가장 가까운 칸으로 친다.

const KEY_CELLS: Record<string, Cell> = {
  KeyQ: 1,
  KeyW: 2,
  KeyE: 3,
  KeyA: 4,
  KeyS: 5,
  KeyD: 6,
  KeyZ: 7,
  KeyX: 8,
  KeyC: 9,
}

const ZONE = zoneRect()

/** 화면(viewBox) 좌표 → 가장 가까운 칸 */
export function cellFromView(x: number, y: number): Cell {
  const clamp = (v: number) => Math.min(2, Math.max(0, Math.floor(v)))
  return cellAt(clamp((x - ZONE.x) / CELL_SIZE.width), clamp((y - ZONE.y) / CELL_SIZE.height))
}

export function useZoneSwing(onSwing: (cell: Cell, at: number) => void) {
  const handler = useRef(onSwing)
  useEffect(() => {
    handler.current = onSwing
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const cell = KEY_CELLS[e.code]
      if (!cell || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      handler.current(cell, eventTime(e))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    onPointerDown(e: PointerEvent<SVGSVGElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      const at = eventTime(e)
      const rect = e.currentTarget.getBoundingClientRect()
      const scale = VIEW_W / rect.width
      handler.current(cellFromView((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale), at)
    },
  }
}
