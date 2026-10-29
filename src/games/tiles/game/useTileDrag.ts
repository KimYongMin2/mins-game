import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useRef, useState } from 'react'
import type { TileId } from '../rules/tiles'

// 타일 끌어 놓기 (터치·마우스 모두 pointer 이벤트로). 조금만 움직이고 떼면 '누름'(고르기)으로 친다.
// 놓을 곳은 손가락 아래 요소로 찾는다: 줄([data-set]) 안이면 타일 가운데들과 비교해 끼울 자리, 손패 칸([data-rack]), 그 밖의 바닥(새 줄).
// 끼울 자리는 바닥 위에 겹쳐 그리는 막대로만 보여줘서 타일 배치가 움직이지 않는다 (처음엔 ▼ 자리를 끼워 넣었다가 패가 다 밀려서 바꿈).

export type DropTarget =
  | { kind: 'set'; set: number; at: number; bar: { left: number; top: number; height: number } }
  | { kind: 'new' }
  | { kind: 'rack' }
  | null

export type DragState = { ids: TileId[]; x: number; y: number; target: DropTarget }

/** 이만큼(px) 움직여야 끌기로 친다 */
const DRAG_PX = 6

type Options = {
  feltRef: RefObject<HTMLElement | null>
  /** 이 타일을 잡으면 같이 움직일 타일 (고른 것 중 하나면 고른 것 전부) */
  idsFor: (tile: TileId) => TileId[]
  onTap: (tile: TileId) => void
  onDrop: (ids: TileId[], target: Exclude<DropTarget, null>) => void
}

function findTarget(x: number, y: number, felt: HTMLElement | null): DropTarget {
  const el = document.elementFromPoint(x, y)
  if (!el || !felt) return null
  if (el.closest('[data-rack]')) return { kind: 'rack' }
  if (!felt.contains(el)) return null
  const setEl = el.closest<HTMLElement>('[data-set]')
  if (!setEl) return { kind: 'new' }
  const tiles = [...setEl.querySelectorAll<HTMLElement>('[data-tile]')]
  let at = tiles.findIndex((t) => {
    const r = t.getBoundingClientRect()
    return x < r.left + r.width / 2
  })
  if (at < 0) at = tiles.length
  const ref = (tiles[at] ?? tiles[at - 1]).getBoundingClientRect()
  const fr = felt.getBoundingClientRect()
  const barX = tiles[at] ? ref.left - 3 : ref.right + 1
  return {
    kind: 'set',
    set: Number(setEl.dataset.set),
    at,
    bar: {
      left: barX - fr.left - felt.clientLeft + felt.scrollLeft,
      top: ref.top - fr.top - felt.clientTop + felt.scrollTop,
      height: ref.height,
    },
  }
}

export function useTileDrag(opts: Options) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })
  const cleanup = useRef<() => void>(() => {})
  useEffect(() => () => cleanup.current(), [])

  function start(e: ReactPointerEvent, tile: TileId) {
    if (e.button !== 0) return
    // 글자 선택·브라우저 기본 끌기를 막는다
    e.preventDefault()
    cleanup.current()
    const x0 = e.clientX
    const y0 = e.clientY
    const pointerId = e.pointerId
    let active: DragState | null = null

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_PX) return
      const { feltRef, idsFor } = optsRef.current
      active = { ids: active?.ids ?? idsFor(tile), x: ev.clientX, y: ev.clientY, target: findTarget(ev.clientX, ev.clientY, feltRef.current) }
      setDrag(active)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup.current()
      if (!active) optsRef.current.onTap(tile)
      else if (active.target) optsRef.current.onDrop(active.ids, active.target)
      setDrag(null)
    }
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup.current()
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    cleanup.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      cleanup.current = () => {}
    }
  }

  return { drag, start }
}
