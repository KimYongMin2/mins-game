import { Person } from '../../../shared/art/Person'
import { CHAMBERS, PLAYER_COLORS } from '../constants'
import { type ScreenState, fired, isMyTurn, myIndex } from '../play/view'

// 둥근 나무 탁자에 둘러앉은 만화풍 사람들 (처음엔 졸라맨). 나는 항상 맨 아래. 가운데 권총이 차례인 사람이 고른 사람 쪽으로 돈다.
// 내 차례면 사람(나 포함)을 눌러 고른다.

/** 자리 위치(%): 나를 맨 아래에 두고 시계 방향으로 고르게 */
function seatAt(seat: number, count: number): { x: number; y: number } {
  const a = Math.PI / 2 + (seat / count) * Math.PI * 2
  return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 36 }
}

/** 옆에서 본 리볼버 (오른쪽을 겨눔) */
function Revolver({ flash }: { flash: boolean }) {
  return (
    <svg className="rl-gun__svg" viewBox="-30 -22 74 44" aria-hidden>
      {flash && <path className="rl-gun__flash" d="M33 -6l8 -9l-1 7l9 -1l-7 5l8 5l-10 -2l1 8l-6 -7z" />}
      {/* 총열·가늠쇠 */}
      <rect x="2" y="-9" width="31" height="6" rx="1" />
      <rect x="29" y="-12" width="3" height="3" />
      {/* 몸통·공이 */}
      <path d="M-14 -11h18v14h-18z" />
      <path d="M-14 -11l-5 -5l4 -1l4 5z" />
      {/* 탄창(실린더) */}
      <rect className="rl-gun__cyl" x="-8" y="-10" width="11" height="11" rx="2" />
      {/* 손잡이 */}
      <path d="M-14 2h9l-3 15q-1 4 -5 4h-6q-4 0 -3 -4z" />
      {/* 방아쇠·울 */}
      <path className="rl-gun__guard" d="M-5 3q0 9 9 4M-1 3l-2 5" />
    </svg>
  )
}

export function Table({ screen, onPick }: { screen: ScreenState; onPick: (i: number) => void }) {
  const v = screen.view
  if (!v) return <div className="rl-table rl-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  const n = v.players.length
  const seatOf = (i: number) => (me < 0 ? i : (i - me + n) % n)
  const pos = (i: number) => seatAt(seatOf(i), n)
  const mine = isMyTurn(screen)
  const f = v.fire
  const shown = fired(screen)
  // 총구 방향: 겨눈 사람 쪽, 아직 안 골랐으면 차례인 사람이 가운데를 보는 쪽
  const target = f?.target ?? v.aimAt
  const from = { x: 50, y: 50 }
  const to = target !== null ? pos(target) : pos(v.turn)
  let deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  if (target === null) deg += 180
  const flip = Math.abs(deg) > 90

  return (
    <div className="rl-table">
      <div className="rl-table__top" />
      {v.phase !== 'intro' && v.phase !== 'done' && (
        <div className={`rl-gun${f && !shown ? ' rl-gun--tense' : ''}`} style={{ transform: `translate(-50%, -50%) rotate(${deg}deg)${flip ? ' scaleY(-1)' : ''}` }}>
          <Revolver flash={!!f?.bang && shown} />
        </div>
      )}
      {/* 탄창: 당긴 칸은 빈 칸, 남은 칸은 ? */}
      <div className="rl-cylinder" aria-label={`${v.pulls}번 당김, 남은 칸 ${CHAMBERS - v.pulls}`}>
        {Array.from({ length: CHAMBERS }, (_, k) => (
          <span key={k} className={`rl-cylinder__slot${k < v.pulls ? ' rl-cylinder__slot--used' : ''}`} />
        ))}
      </div>

      {v.players.map((p, i) => {
        const { x, y } = pos(i)
        const dead = !v.alive[i]
        const hitNow = f?.bang && f.target === i && shown
        const isTarget = target === i
        return (
          <button
            key={p.id}
            type="button"
            className={`rl-seat${i === me ? ' rl-seat--me' : ''}${dead || hitNow ? ' rl-seat--out' : ''}${v.turn === i && v.phase === 'aim' ? ' rl-seat--turn' : ''}${isTarget && !dead ? ' rl-seat--target' : ''}${mine && !dead ? ' rl-seat--pickable' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, color: dead || hitNow ? undefined : PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            disabled={!mine || dead}
            onPointerDown={(e) => {
              e.preventDefault()
              onPick(i)
            }}
          >
            {f && f.target === i && shown && <span className={`rl-bubble${f.bang ? ' rl-bubble--bang' : ''}`}>{f.bang ? '탕!' : '찰칵'}</span>}
            {/* 겨눠지면 겁먹고, 맞으면 ✕ */}
            <Person
              className="rl-stick"
              shirt={i}
              out={dead || !!hitNow}
              pose={isTarget && !dead && !hitNow ? 'scared' : 'idle'}
              mood={dead || hitNow ? 'ko' : isTarget ? 'scared' : 'calm'}
            />
            <span className="rl-seat__name">
              {i === me ? '나' : p.name}
              {v.kills[i] > 0 && <em> {v.kills[i]}킬</em>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
