import { useMemo, useRef } from 'react'
import { BARREL, CRATER_R, GRAVITY, MAX_SPEED, PLAYER_COLORS, STEP, TANK_CY, WORLD_H, WORLD_W } from '../constants'
import { type ScreenState, canAim, myIndex } from '../play/view'
import { type Terrain, type Vec, heightAt, muzzle, tankPose } from '../rules/physics'

// 옆에서 본 전장 (SVG). 화면 좌표는 y가 아래로 커져서 WORLD_H - y로 뒤집어 그린다.
// 만화풍: 굵은 외곽선, 색깔별 대포, 하늘·구름·풀 덮인 흙 언덕. 맞으면 폭발과 피해 숫자.

const LINE = '#1f2937'
const sy = (y: number) => WORLD_H - y

/** 예상 궤적: 처음 조금만 (바람 빼고) */
const GUIDE_S = 0.45
/** 폭발이 커지는·사라지는 시간 */
const BLAST_GROW_MS = 320
const BLAST_FADE_MS = 750
/** 피해 숫자가 떠오르는 시간 */
const DAMAGE_SHOW_MS = 1400

function terrainPath(t: Terrain): { fill: string; top: string } {
  const pts = t.map((h, x) => `${x},${sy(h).toFixed(1)}`)
  return { fill: `M0,${WORLD_H} L${pts.join(' L')} L${WORLD_W},${WORLD_H} Z`, top: `M${pts.join(' L')}` }
}

const poseOf = (p: { y: number; tilt: number }) => ({ ground: p.y, tilt: p.tilt })

type TankDraw = { x: number; angle: number; hp: number; alive: boolean }

/** 대포 그림 크기 (그림은 작은 단위로 그리고 키운다) */
const S = 1.5

function Tank({ t, color, ground, tilt, name, me, active, bob }: { t: TankDraw; color: string; ground: number; tilt: number; name: string; me: boolean; active: boolean; bob: number }) {
  const gy = sy(ground)
  // 몸은 땅 기울기만큼 기울이고, 포신은 겨눈 각도(화면 기준) 그대로 → 몸 안에선 기운 만큼 뺀다
  const a = (t.angle * Math.PI) / 180 - tilt
  const body = t.alive ? color : '#9ca3af'
  // 몸 안쪽 단위: 땅 = 0, 위로 -. 포탑 가운데 = 대포 가운데(TANK_CY)
  const cy = -TANK_CY / S
  const bl = BARREL / S
  const bx = Math.cos(a) * bl
  const by = cy - Math.sin(a) * bl
  return (
    <g>
      <g transform={`translate(${t.x},${gy}) rotate(${((-tilt * 180) / Math.PI).toFixed(1)}) scale(${S})`}>
        {/* 포신 */}
        <line x1={0} y1={cy} x2={bx} y2={by} stroke={LINE} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={0} y1={cy} x2={bx} y2={by} stroke={body} strokeWidth={0.75} strokeLinecap="round" />
        {/* 포탑 */}
        <path d={`M-2.2,${cy + 0.2} A2.2,2.2 0 0 1 2.2,${cy + 0.2} Z`} fill={body} stroke={LINE} strokeWidth={0.4} />
        {/* 몸통 */}
        <rect x={-3.8} y={cy + 0.1} width={7.6} height={1.2} rx={0.5} fill={body} stroke={LINE} strokeWidth={0.4} />
        {/* 바퀴 띠 */}
        <rect x={-4.2} y={-1.3} width={8.4} height={1.5} rx={0.75} fill="#374151" stroke={LINE} strokeWidth={0.35} />
        {[-2.7, -0.9, 0.9, 2.7].map((dx) => (
          <circle key={dx} cx={dx} cy={-0.55} r={0.45} fill="#9ca3af" />
        ))}
        {!t.alive && (
          <text x={0} y={cy - 0.4} textAnchor="middle" fontSize={3.2} fontWeight={900} fill={LINE}>
            ✕
          </text>
        )}
      </g>
      {/* 이름·체력 */}
      <text x={t.x} y={gy - 14.5} textAnchor="middle" fontSize={4.6} fontWeight={me ? 900 : 700} fill={LINE} stroke="#fff" strokeWidth={1} paintOrder="stroke">
        {me ? `${name} (나)` : name}
      </text>
      {t.alive && (
        <g>
          <rect x={t.x - 6.5} y={gy - 12.6} width={13} height={2} rx={1} fill="#fff" stroke={LINE} strokeWidth={0.4} />
          <rect x={t.x - 6.5} y={gy - 12.6} width={(13 * t.hp) / 100} height={2} rx={1} fill={t.hp > 50 ? '#22c55e' : t.hp > 25 ? '#f59e0b' : '#ef4444'} />
        </g>
      )}
      {active && t.alive && <path d={`M${t.x - 2.2},${gy - 23 + bob} L${t.x + 2.2},${gy - 23 + bob} L${t.x},${gy - 19.8 + bob} Z`} fill="#facc15" stroke={LINE} strokeWidth={0.5} />}
    </g>
  )
}

/** 예상 궤적 점들 (바람 빼고 처음 조금) */
function guidePoints(t: Terrain, x: number, angle: number, power: number): Vec[] {
  const a = (angle * Math.PI) / 180
  const v = (power / 100) * MAX_SPEED
  const m = muzzle(t, x, angle)
  const pts: Vec[] = []
  for (let k = 1; k <= GUIDE_S / STEP; k += 3) {
    const tt = k * STEP
    pts.push({ x: m.x + Math.cos(a) * v * tt, y: m.y + Math.sin(a) * v * tt - 0.5 * GRAVITY * tt * tt })
  }
  return pts
}

type Props = {
  screen: ScreenState
  /** 누름·끌기·뗌 (맵 좌표, y는 위로 +) */
  onPointer: (kind: 'down' | 'move' | 'up', at: Vec) => void
  /** 새총처럼 당기는 중: 처음 누른 곳 → 지금 손가락 */
  pull?: { from: Vec; to: Vec } | null
}

export function Battlefield({ screen, onPointer, pull }: Props) {
  const v = screen.view
  const svgRef = useRef<SVGSVGElement>(null)
  const paths = useMemo(() => (v ? terrainPath(v.terrain) : null), [v?.terrain]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!v || !paths) return <div className="at-field at-field--empty" />

  const me = myIndex(screen)
  const elapsed = screen.now - screen.phaseStart
  // 내 차례면 겨누는 중인 걸 바로 그린다
  const tanks: TankDraw[] = v.tanks.map((t, i) => (i === me && screen.draft && i === v.turn ? { ...t, ...screen.draft } : t))
  const fell = new Set(v.boom?.fell ?? [])

  // 날아가는 포탄
  let ball: Vec | null = null
  let trail: Vec[] = []
  if (v.phase === 'flight' && v.shot) {
    const idx = Math.min(v.shot.path.length - 1, Math.floor(elapsed / (STEP * 1000) / 2))
    ball = v.shot.path[idx]
    trail = v.shot.path.slice(Math.max(0, idx - 40), idx + 1)
  }
  const boom = v.phase === 'boom' ? v.boom : null
  const blastR = boom?.at ? CRATER_R * 1.7 * Math.min(1, elapsed / BLAST_GROW_MS) : 0
  const blastOpacity = Math.max(0, 1 - elapsed / BLAST_FADE_MS)
  // 화면이 흔들림 (터진 직후)
  const shake = boom?.at && elapsed < 400 ? Math.sin(elapsed / 18) * (1 - elapsed / 400) * 1.2 : 0

  const guide = canAim(screen) && screen.draft ? guidePoints(v.terrain, screen.draft.x, screen.draft.angle, screen.draft.power) : []

  function toWorld(e: React.PointerEvent): Vec | null {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: WORLD_H - p.y }
  }
  const handle = (kind: 'down' | 'move' | 'up') => (e: React.PointerEvent<SVGSVGElement>) => {
    if (kind === 'down') {
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        // 이미 뗀 손가락이면 무시
      }
    }
    if (kind === 'move' && e.buttons === 0 && e.pointerType === 'mouse') return
    const at = toWorld(e)
    if (at) onPointer(kind, at)
  }

  return (
    <svg
      ref={svgRef}
      className="at-field"
      viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
      onPointerDown={handle('down')}
      onPointerMove={handle('move')}
      onPointerUp={handle('up')}
      onPointerCancel={handle('up')}
      role="img"
      aria-label="전장"
    >
      <defs>
        <linearGradient id="at-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id="at-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="1" stopColor="#713f12" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#at-sky)" />
      <circle cx={170} cy={22} r={9} fill="#fde68a" stroke="#f59e0b" strokeWidth={0.8} />
      {[
        [30, 20, 1],
        [95, 14, 0.8],
        [140, 34, 0.7],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x},${y}) scale(${s})`} fill="#fff" opacity={0.9}>
          <ellipse cx={0} cy={0} rx={10} ry={4} />
          <ellipse cx={6} cy={-2} rx={6} ry={4} />
          <ellipse cx={-5} cy={-1.5} rx={5} ry={3.5} />
        </g>
      ))}
      <g transform={`translate(${shake},0)`}>
        <path d={paths.fill} fill="url(#at-dirt)" />
        <path d={paths.top} fill="none" stroke="#16a34a" strokeWidth={2.2} strokeLinejoin="round" />
        <path d={paths.top} fill="none" stroke={LINE} strokeWidth={0.5} strokeLinejoin="round" transform="translate(0,1.1)" opacity={0.35} />

        {tanks.map((t, i) =>
          // 바닥까지 떨어진 대포는 안 그린다
          fell.has(i) || (!t.alive && heightAt(v.terrain, t.x) <= 1.5) ? null : (
            <Tank
              key={v.players[i].id}
              t={t}
              color={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              {...poseOf(tankPose(v.terrain, t.x))}
              name={v.players[i].name}
              me={i === me}
              active={i === v.turn && (v.phase === 'aim' || v.phase === 'countdown')}
              bob={Math.sin(screen.now / 180) * 0.8}
            />
          ),
        )}

        {/* 움직일 수 있는 범위 (내 차례) */}
        {canAim(screen) && v.startX !== null && (
          <g opacity={0.5}>
            <line x1={Math.max(3, v.startX - 14)} y1={WORLD_H - 2} x2={Math.min(WORLD_W - 3, v.startX + 14)} y2={WORLD_H - 2} stroke="#fff" strokeWidth={1} strokeLinecap="round" />
          </g>
        )}
        {guide.length > 0 && (
          <polyline points={guide.map((p) => `${p.x},${sy(p.y)}`).join(' ')} fill="none" stroke="#fff" strokeWidth={0.8} strokeDasharray="1.2 1.6" strokeLinecap="round" />
        )}

        {pull && Math.hypot(pull.to.x - pull.from.x, pull.to.y - pull.from.y) > 1 && (
          <g opacity={0.75} pointerEvents="none">
            <line x1={pull.from.x} y1={sy(pull.from.y)} x2={pull.to.x} y2={sy(pull.to.y)} stroke="#fff" strokeWidth={0.9} strokeDasharray="1.5 1.5" />
            <circle cx={pull.from.x} cy={sy(pull.from.y)} r={1.6} fill="none" stroke="#fff" strokeWidth={0.7} />
            <circle cx={pull.to.x} cy={sy(pull.to.y)} r={2.4} fill="rgb(255 255 255 / 0.35)" stroke="#fff" strokeWidth={0.7} />
          </g>
        )}
        {trail.length > 1 && <polyline points={trail.map((p) => `${p.x},${sy(p.y)}`).join(' ')} fill="none" stroke="#f97316" strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />}
        {ball &&
          (ball.y > WORLD_H ? (
            // 화면 위로 나감: 위쪽 가장자리에 표시
            <path d={`M${ball.x - 2},5 L${ball.x + 2},5 L${ball.x},1.5 Z`} fill="#f97316" stroke={LINE} strokeWidth={0.4} />
          ) : (
            <circle cx={ball.x} cy={sy(ball.y)} r={1.6} fill="#111827" stroke="#fde68a" strokeWidth={0.5} />
          ))}

        {boom?.at && blastOpacity > 0 && (
          <g opacity={blastOpacity}>
            <circle cx={boom.at.x} cy={sy(boom.at.y)} r={blastR} fill="#fb923c" />
            <circle cx={boom.at.x} cy={sy(boom.at.y)} r={blastR * 0.6} fill="#fde047" />
          </g>
        )}
        {boom &&
          elapsed < DAMAGE_SHOW_MS &&
          boom.damage.map((d, i) =>
            d > 0 ? (
              <text
                key={i}
                x={tanks[i].x}
                y={sy(heightAt(v.terrain, tanks[i].x)) - 19 - elapsed / 120}
                textAnchor="middle"
                fontSize={6}
                fontWeight={900}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={0.9}
                paintOrder="stroke"
                opacity={Math.max(0, 1 - elapsed / DAMAGE_SHOW_MS)}
              >
                -{d}
              </text>
            ) : null,
          )}
      </g>
    </svg>
  )
}
