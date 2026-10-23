import { Person } from '../../../shared/art/Person'
import { neighborsOf } from '../play/engine'
import { canThrowNow, myIndex, type ScreenState } from '../play/view'

// 둥근 나무 탁자에 둘러앉은 만화풍 사람들 (처음엔 졸라맨). 나는 항상 맨 아래. 폭탄은 든 사람 앞에, 던지면 포물선으로 날아간다.
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

function Bomb({ x, y, lift }: { x: number; y: number; lift: number }) {
  return (
    <div className="bm-bomb" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, calc(-50% - ${lift}px))` }} aria-hidden>
      <svg viewBox="0 0 40 40">
        <path className="bm-bomb__fuse" d="M25 14q4 -6 9 -5" />
        <circle className="bm-bomb__body" cx="18" cy="24" r="12" />
        {/* 심지 꽂는 마개 + 반짝이 */}
        <rect className="bm-bomb__cap" x="21" y="11" width="7" height="5" rx="1" transform="rotate(40 24.5 13.5)" />
        <ellipse cx="13" cy="19" rx="4" ry="2.6" fill="#fff" opacity="0.55" transform="rotate(-35 13 19)" />
        <path className="bm-bomb__spark" d="M35 3l1.4 3.4 3.4-1-2 3 3 2-3.6.4.4 3.6-2.6-2.4-2.6 2.4.4-3.6-3.6-.4 3-2-2-3 3.4 1z" />
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
            {/* 폭탄을 들면 겁먹고, 터지면 ✕ */}
            <Person
              className="bm-stick"
              shirt={i}
              out={out}
              pose={holding ? 'hold' : v.victim === i ? 'scared' : 'idle'}
              mood={out || v.victim === i ? 'ko' : holding ? 'scared' : 'calm'}
            />
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
