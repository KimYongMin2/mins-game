import type { PointerEvent } from 'react'
import { type TileId, colorOf, isWild, numOf } from '../rules/tiles'

// 타일 한 장: 미색 타일에 굵은 외곽선, 색 숫자 + 색마다 다른 작은 모양(색을 헷갈려도 구분되게). 와일드는 웃는 얼굴.

const TILE_COLORS = ['#e03131', '#1c62d6', '#e8590c', '#212529'] as const
const COLOR_NAMES = ['빨강', '파랑', '주황', '검정'] as const
const SHAPES = ['●', '▲', '◆', '★'] as const

type Props = {
  id: TileId
  selected?: boolean
  /** 이번 차례에 내가 올린 것 / 방금 남이 올린 것 */
  fresh?: boolean
  small?: boolean
  /** 끌고 있는 중 (제자리엔 흐리게) */
  dragging?: boolean
  /** 키보드로 눌렀을 때 (Enter·스페이스) */
  onClick?: () => void
  /** 누르기 시작 (끌기·누르기는 부르는 쪽이 판단) */
  onPointerDown?: (e: PointerEvent) => void
}

function tileLabel(id: TileId): string {
  return isWild(id) ? '와일드' : `${COLOR_NAMES[colorOf(id)]} ${numOf(id)}`
}

export function Tile({ id, selected, fresh, small, dragging, onClick, onPointerDown }: Props) {
  const wild = isWild(id)
  const color = wild ? undefined : TILE_COLORS[colorOf(id)]
  const cls = `nt-tile${small ? ' nt-tile--small' : ''}${selected ? ' nt-tile--on' : ''}${fresh ? ' nt-tile--fresh' : ''}${wild ? ' nt-tile--wild' : ''}${dragging ? ' nt-tile--dragging' : ''}`
  const body = wild ? (
    <svg viewBox="0 0 20 20" className="nt-tile__face" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="#ffd43b" stroke="#111" strokeWidth="1.6" />
      <circle cx="7.2" cy="8" r="1.2" fill="#111" />
      <circle cx="12.8" cy="8" r="1.2" fill="#111" />
      <path d="M6 11.5 Q10 15.5 14 11.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) : (
    <>
      <span className="nt-tile__num">{numOf(id)}</span>
      <span className="nt-tile__shape">{SHAPES[colorOf(id)]}</span>
    </>
  )
  if (!onClick)
    return (
      <span className={cls} style={{ color }} aria-label={tileLabel(id)}>
        {body}
      </span>
    )
  return (
    <button
      type="button"
      className={cls}
      style={{ color }}
      aria-label={tileLabel(id)}
      aria-pressed={selected}
      data-tile={id}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        // 줄을 누른 것으로 치지 않게. 터치·마우스 누름은 onPointerDown 쪽에서 처리하고 여기선 키보드만.
        // 터치 뒤 click도 detail이 0이라 pointerType으로 가린다 (키보드면 빈 문자열)
        e.stopPropagation()
        const pointerType = (e.nativeEvent as globalThis.PointerEvent).pointerType
        if (!pointerType || !onPointerDown) onClick()
      }}
    >
      {body}
    </button>
  )
}
