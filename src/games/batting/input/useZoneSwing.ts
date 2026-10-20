import { type PointerEvent, useEffect, useRef } from 'react'
import { eventTime } from '../../../shared/input/eventTime'
import { CELL_SIZE, VIEW_W, zoneRect } from '../field/view'
import type { ZonePoint } from '../rules/judge'

// 스윙 입력: 화면 아무 곳이나 터치(클릭)하면 그 위치로 휘두른다. 칸 경계와 상관없다.
// 존 밖을 누르면 존 가장자리로 친다.

const ZONE = zoneRect()

/** 화면(viewBox) 좌표 → 존 안 위치(칸 단위, 0~3) */
export function zonePointFromView(x: number, y: number): ZonePoint {
  const clamp = (v: number) => Math.min(3, Math.max(0, v))
  return { col: clamp((x - ZONE.x) / CELL_SIZE.width), row: clamp((y - ZONE.y) / CELL_SIZE.height) }
}

export function useZoneSwing(onSwing: (point: ZonePoint, at: number) => void) {
  const handler = useRef(onSwing)
  useEffect(() => {
    handler.current = onSwing
  })

  return {
    onPointerDown(e: PointerEvent<SVGSVGElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      const at = eventTime(e)
      const rect = e.currentTarget.getBoundingClientRect()
      const scale = VIEW_W / rect.width
      handler.current(zonePointFromView((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale), at)
    },
  }
}
