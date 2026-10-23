import type { PointerEvent } from 'react'
import { COUNTDOWN_MS, PIECE_R, PLAYER_COLORS, SHOT_AT } from '../constants'
import { type Vec, shoot } from '../rules/geometry'
import { hitAtOf, laserMs } from '../play/engine'
import { type ScreenState, myIndex } from '../play/view'

// 위에서 내려다본 둥근 맵. 가운데가 (0,0), 화면 틀은 이 경기 처음 맵 크기. 줄어든 바깥은 빗금(못 들어감).
// 고르는 동안엔 내 말·내 조준선만, 공개 때 모두의 말과 총알 실선을 그린다.

const PAD = 4

type Props = {
  screen: ScreenState
  onPointer?: (kind: 'down' | 'move' | 'up', at: Vec) => void
}

/** 화면 좌표 → 맵 좌표 */
function toWorld(e: PointerEvent<SVGSVGElement>): Vec {
  const svg = e.currentTarget
  const m = svg.getScreenCTM()
  if (!m) return { x: 0, y: 0 }
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))

/** 위에서 내려다본 병사: 어깨(팀 색) + 헬멧 + 총구가 겨눈 쪽 (처음엔 그냥 동그라미 말이었음) */
function Piece({ at, angle, color, me, dead, label }: { at: Vec; angle: number | null; color: string; me: boolean; dead?: boolean; label: string }) {
  const deg = angle === null ? -90 : (angle * 180) / Math.PI
  const ink = '#1f2937'
  const body = dead ? '#d1d5db' : color
  return (
    <g className={`sv-piece${dead ? ' sv-piece--dead' : ''}`} transform={`translate(${at.x} ${at.y})`}>
      <g transform={`rotate(${deg})`}>
        {/* 총: 겨눈 쪽으로 */}
        {!dead && <rect x={0} y={-0.55} width={PIECE_R * 1.75} height={1.1} rx={0.3} fill={ink} />}
        {/* 어깨 */}
        <ellipse rx={PIECE_R * 0.72} ry={PIECE_R} fill={body} stroke={ink} strokeWidth={me ? 0.9 : 0.5} />
        {/* 총 잡은 손 */}
        {!dead && <circle cx={PIECE_R * 0.75} cy={0} r={0.9} fill="#f6c7a0" stroke={ink} strokeWidth={0.35} />}
        {/* 헬멧 */}
        <circle r={PIECE_R * 0.55} fill={dead ? '#9ca3af' : '#4d7c0f'} stroke={ink} strokeWidth={0.45} />
        <circle cx={-0.5} cy={-0.6} r={0.6} fill="#fff" opacity={0.35} />
      </g>
      {dead && <path d="M-2.4 -2.4L2.4 2.4M2.4 -2.4L-2.4 2.4" stroke="#dc2626" strokeWidth={1.1} strokeLinecap="round" />}
      <text y={-PIECE_R - 1.4} textAnchor="middle" className="sv-piece__name">
        {label}
      </text>
    </g>
  )
}

export function Arena({ screen, onPointer }: Props) {
  const v = screen.view
  if (!v) return <div className="sv-arena sv-arena--empty">시작하는 중…</div>
  const me = myIndex(screen)
  const FULL = v.startHalf
  const t = screen.now - screen.phaseStart
  // 라운드 안내 동안 맵이 줄어드는 모습
  const half = v.phase === 'countdown' ? lerp(v.prevHalf, v.half, t / (COUNTDOWN_MS * 0.6)) : v.half
  const nameOf = (i: number) => (i === me ? '나' : v.players[i].name)
  const r = v.reveal
  const draft = screen.draft
  const showDraft = v.phase === 'plan' && me >= 0 && v.alive[me]
  // 공개 연출: SHOT_AT부터 레이저가 같은 속도로 끝까지 뻗어 가고, 사람에 닿는 순간 ✕
  const shotT = (ms: number) => (v.phase === 'done' ? 1 : (t - SHOT_AT) / ms)
  const isHit = (i: number) => {
    if (!r) return false
    const at = hitAtOf(r, i)
    return at !== null && (v.phase === 'done' || t >= at)
  }

  const handlers = onPointer && {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onPointer('down', toWorld(e))
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => onPointer('move', toWorld(e)),
    onPointerUp: (e: PointerEvent<SVGSVGElement>) => onPointer('up', toWorld(e)),
  }

  return (
    <svg className={`sv-arena${showDraft && !draft.locked ? ' sv-arena--active' : ''}`} viewBox={`${-FULL - PAD} ${-FULL - PAD} ${(FULL + PAD) * 2} ${(FULL + PAD) * 2}`} {...handlers}>
      <defs>
        <pattern id="sv-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill="#fee2e2" />
          <line x1="0" y1="0" x2="0" y2="3" stroke="#fca5a5" strokeWidth="1" />
        </pattern>
      </defs>
      <circle r={FULL} fill="url(#sv-hatch)" />
      <circle r={half} className="sv-arena__floor" />
      {/* 옅은 격자 (10칸), 맵 안쪽만 */}
      <clipPath id="sv-floor">
        <circle r={half} />
      </clipPath>
      <g className="sv-arena__grid" clipPath="url(#sv-floor)">
        {Array.from({ length: 9 }, (_, i) => (i - 4) * 10).map((g) => (
          <g key={g}>
            <line x1={g} y1={-half} x2={g} y2={half} />
            <line x1={-half} y1={g} x2={half} y2={g} />
          </g>
        ))}
      </g>

      {/* 엄폐물: 라운드 안내 땐 맵이 다 줄어든 뒤에 나타남 */}
      {(v.phase !== 'countdown' || half <= v.half + 0.01) &&
        v.walls.map((w, k) => (
          <rect
            key={k}
            className="sv-wall"
            x={-w.w / 2}
            y={-w.h / 2}
            width={w.w}
            height={w.h}
            rx={0.8}
            transform={`translate(${w.x} ${w.y}) rotate(${(w.angle * 180) / Math.PI})`}
          />
        ))}

      {/* 고르는 중: 내 조준선과 내 말 */}
      {showDraft && draft.pos && (
        <>
          {draft.angle !== null && (
            // 조준선은 벽이나 맵 끝까지
            <line
              className="sv-aim"
              x1={draft.pos.x}
              y1={draft.pos.y}
              x2={shoot(draft.pos, draft.angle, [], half, v.walls).end.x}
              y2={shoot(draft.pos, draft.angle, [], half, v.walls).end.y}
              stroke={PLAYER_COLORS[me % PLAYER_COLORS.length]}
            />
          )}
          <g opacity={draft.locked ? 1 : 0.75}>
            <Piece at={draft.pos} angle={draft.angle} color={PLAYER_COLORS[me % PLAYER_COLORS.length]} me label="나" />
          </g>
        </>
      )}

      {/* 공개: 총알 실선 → 맞은 사람 */}
      {r && (v.phase === 'reveal' || v.phase === 'done') && (
        <>
          {r.shots.map((sh) => {
            const p = shotT(laserMs(sh))
            if (p <= 0) return null
            const tip = { x: lerp(sh.pos.x, sh.end.x, p), y: lerp(sh.pos.y, sh.end.y, p) }
            const color = PLAYER_COLORS[sh.from % PLAYER_COLORS.length]
            return (
              <g key={`s${sh.from}`}>
                <line className="sv-shot__glow" x1={sh.pos.x} y1={sh.pos.y} x2={tip.x} y2={tip.y} stroke={color} />
                <line className="sv-shot" x1={sh.pos.x} y1={sh.pos.y} x2={tip.x} y2={tip.y} stroke={color} />
                {p < 1 && <circle className="sv-shot__tip" cx={tip.x} cy={tip.y} r={1.3} fill={color} />}
              </g>
            )
          })}
          {r.positions.map((p, i) => {
            if (!p) return null
            // 총구 방향 = 쏜 레이저 방향
            const sh = r.shots.find((x) => x.from === i)
            const angle = sh ? Math.atan2(sh.end.y - sh.pos.y, sh.end.x - sh.pos.x) : null
            return (
              <Piece
                key={`p${i}`}
                at={p}
                angle={angle}
                color={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                me={i === me}
                dead={isHit(i)}
                label={nameOf(i)}
              />
            )
          })}
        </>
      )}
    </svg>
  )
}
