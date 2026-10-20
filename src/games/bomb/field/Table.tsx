import { neighborsOf } from '../play/engine'
import { canThrowNow, myIndex, type ScreenState } from '../play/view'

// 둥근 탁자에 둘러앉은 졸라맨들. 나는 항상 맨 아래. 폭탄은 든 사람 앞에, 던지면 포물선으로 날아간다.
// 바로 옆(왼쪽·오른쪽) 사람을 누르면 그 사람에게 던진다 (내가 들고 있을 때만).

type Props = {
  screen: ScreenState
  /** 내가 지금 던질 수 있으면 누를 사람 번호를 받는다 */
  onPick: (to: number) => void
}

/** 자리 위치(%): 나를 맨 아래에 두고 시계 방향으로 고르게 */
function seatAt(seat: number, count: number): { x: number; y: number } {
  const a = Math.PI / 2 + (seat / count) * Math.PI * 2
  return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 34 }
}

/** 폭탄이 놓이는 곳: 자리에서 탁자 가운데 쪽으로 조금 */
function bombAt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x + (50 - p.x) * 0.5, y: p.y + (50 - p.y) * 0.5 }
}

function Stick({ out, hurt }: { out: boolean; hurt: boolean }) {
  return (
    <svg className="bm-stick" viewBox="0 0 40 44" aria-hidden>
      <circle cx="20" cy="9" r="6" />
      {out ? (
        // 탈락: 눈이 X
        <path d="M17 7l2 2M19 7l-2 2M21 7l2 2M23 7l-2 2" />
      ) : null}
      <path d={hurt ? 'M20 15v14M20 19l-10-6M20 19l10-6M20 29l-7 11M20 29l7 11' : 'M20 15v14M20 19l-9 6M20 19l9 6M20 29l-7 11M20 29l7 11'} />
    </svg>
  )
}

function Bomb({ x, y, lift }: { x: number; y: number; lift: number }) {
  return (
    <div className="bm-bomb" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, calc(-50% - ${lift}px))` }} aria-hidden>
      <svg viewBox="0 0 40 40">
        <circle className="bm-bomb__body" cx="18" cy="24" r="12" />
        <path className="bm-bomb__fuse" d="M26 14q4 -6 9 -5" />
        <circle className="bm-bomb__spark" cx="35" cy="8" r="3" />
      </svg>
    </div>
  )
}

export function Table({ screen, onPick }: Props) {
  const v = screen.view
  if (!v) return <div className="bm-table bm-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  const n = v.players.length
  // 나를 맨 아래(자리 0)로 돌린다. 내가 없으면(구경) 그대로
  const seatOf = (i: number) => (me < 0 ? i : (i - me + n) % n)
  const pos = v.players.map((_, i) => seatAt(seatOf(i), n))
  const canThrow = canThrowNow(screen)
  const side = canThrow ? neighborsOf(v.alive, me) : null

  let bomb: { x: number; y: number; lift: number } | null = null
  if (v.phase === 'play' || v.phase === 'countdown') {
    const f = screen.flight
    if (f) {
      const t = Math.min(1, Math.max(0, (screen.now - f.startAt) / (f.landAt - f.startAt)))
      const a = bombAt(pos[f.from])
      const b = bombAt(pos[f.to])
      bomb = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, lift: Math.sin(Math.PI * t) * 40 }
    } else if (v.phase === 'play') {
      bomb = { ...bombAt(pos[v.holder]), lift: 0 }
    }
  }
  const boomAt = v.victim !== null ? bombAt(pos[v.victim]) : null

  return (
    <div className={`bm-table${v.phase === 'boom' ? ' bm-table--boom' : ''}`}>
      <div className="bm-table__top" />
      {v.players.map((p, i) => {
        const out = !v.alive[i]
        const holding = v.phase === 'play' && v.holder === i && !screen.flight
        const target = side?.includes(i) ?? false
        return (
          <button
            key={p.id}
            type="button"
            className={[
              'bm-seat',
              i === me && 'bm-seat--me',
              out && 'bm-seat--out',
              holding && 'bm-seat--holding',
              target && 'bm-seat--target',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}
            disabled={!target}
            onPointerDown={(e) => {
              // 터치하자마자 던지도록 (click은 손을 뗄 때라 늦다)
              e.preventDefault()
              if (target) onPick(i)
            }}
            onClick={() => target && onPick(i)}
            aria-label={target ? `${p.name}에게 던지기` : p.name}
          >
            <Stick out={out} hurt={v.victim === i} />
            <span className="bm-seat__name">
              {p.name}
              {i === me && ' (나)'}
            </span>
          </button>
        )
      })}
      {bomb && <Bomb {...bomb} />}
      {boomAt && (
        <div className="bm-boom" style={{ left: `${boomAt.x}%`, top: `${boomAt.y}%` }}>
          펑!
        </div>
      )}
    </div>
  )
}
