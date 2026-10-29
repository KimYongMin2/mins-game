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
  onClick?: () => void
}

function tileLabel(id: TileId): string {
  return isWild(id) ? '와일드' : `${COLOR_NAMES[colorOf(id)]} ${numOf(id)}`
}

export function Tile({ id, selected, fresh, small, onClick }: Props) {
  const wild = isWild(id)
  const color = wild ? undefined : TILE_COLORS[colorOf(id)]
  const cls = `nt-tile${small ? ' nt-tile--small' : ''}${selected ? ' nt-tile--on' : ''}${fresh ? ' nt-tile--fresh' : ''}${wild ? ' nt-tile--wild' : ''}`
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
      onClick={(e) => {
        // 줄을 누른 것으로 치지 않게
        e.stopPropagation()
        onClick()
      }}
    >
      {body}
    </button>
  )
}
