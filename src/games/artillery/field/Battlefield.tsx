import { useMemo } from 'react'
import { BARREL, CRATER_R, GRAVITY, MAX_SPEED, PLAYER_COLORS, STEP, TANK_CY, WORLD_H, WORLD_W } from '../constants'
import { TEAM_COLORS } from '../../../shared/team/teams'
import { type ScreenState, canAim, myIndex } from '../play/view'
import { type LandTheme, type Terrain, type Vec, heightAt, muzzle, tankPose } from '../rules/physics'

// 옆에서 본 전장 (SVG). 화면 좌표는 y가 아래로 커져서 WORLD_H - y로 뒤집어 그린다.
// 만화풍: 굵은 외곽선, 색깔별 대포, 하늘·구름·풀 덮인 흙 언덕. 맞으면 폭발과 피해 숫자.

const LINE = '#1f2937'

/** 땅 색·하늘 (판마다 무작위): 하늘 위·아래, 흙 위·아래, 땅 윗줄, 해/달, 구름 */
const THEMES: Record<LandTheme, { sky: [string, string]; dirt: [string, string]; top: string; sun: [string, string]; cloud: string; stars?: boolean }> = {
  grass: { sky: ['#7dd3fc', '#e0f2fe'], dirt: ['#b45309', '#713f12'], top: '#16a34a', sun: ['#fde68a', '#f59e0b'], cloud: '#ffffff' },
  desert: { sky: ['#fcd9a0', '#fff4e0'], dirt: ['#e7a456', '#a8622a'], top: '#f6d58e', sun: ['#fff1a8', '#f97316'], cloud: '#fff8ec' },
  snow: { sky: ['#bfd7ea', '#f1f6fb'], dirt: ['#7b8fa6', '#4a5a6e'], top: '#ffffff', sun: ['#fefce8', '#cbd5e1'], cloud: '#ffffff' },
  sunset: { sky: ['#f97362', '#fdd59a'], dirt: ['#7c3f1d', '#3f1f0e'], top: '#3f7d3a', sun: ['#fde047', '#ea580c'], cloud: '#fecdd3' },
  night: { sky: ['#0f1a3a', '#34457a'], dirt: ['#4b3a2a', '#251b12'], top: '#2f6b3a', sun: ['#f8fafc', '#cbd5e1'], cloud: '#64748b', stars: true },
}
const STARS = Array.from({ length: 30 }, (_, i) => [(i * 67.3) % 200, ((i * 41.7) % 70) + 3, 0.35 + ((i * 13) % 5) * 0.12] as const)
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

export type TankDraw = { x: number; angle: number; hp: number; alive: boolean }

/** 대포 그림 크기 (그림은 작은 단위로 그리고 키운다) */
const S = 1.5

function Tank({ t, color, ground, tilt, name, me, active, bob, lift }: { t: TankDraw; color: string; ground: number; tilt: number; name: string; me: boolean; active: boolean; bob: number; lift: number }) {
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
      <text x={t.x} y={gy - 14.5 - lift} textAnchor="middle" fontSize={4.6} fontWeight={me ? 900 : 700} fill={LINE} stroke="#fff" strokeWidth={1} paintOrder="stroke">
        {me ? `${name} (나)` : name}
      </text>
      {t.alive && (
        <g>
          <rect x={t.x - 6.5} y={gy - 12.6 - lift} width={13} height={2} rx={1} fill="#fff" stroke={LINE} strokeWidth={0.4} />
          <rect x={t.x - 6.5} y={gy - 12.6 - lift} width={(13 * t.hp) / 100} height={2} rx={1} fill={t.hp > 50 ? '#22c55e' : t.hp > 25 ? '#f59e0b' : '#ef4444'} />
        </g>
      )}
      {active && t.alive && <path d={`M${t.x - 2.2},${gy - 23 - lift + bob} L${t.x + 2.2},${gy - 23 - lift + bob} L${t.x},${gy - 19.8 - lift + bob} Z`} fill="#facc15" stroke={LINE} strokeWidth={0.5} />}
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

/** riders = 대포에 3D 동물이 타고 있음 (이름·체력·차례 표시를 그만큼 위로) */
type Props = { screen: ScreenState; riders?: boolean }

/** 동물이 타면 이름표를 올리는 높이 */
const RIDER_LIFT = 5

/** 그릴 대포들 (내 차례면 겨누는 중인 것을 바로) — 3D 동물 층(Riders3D)도 같은 걸 쓴다 */
export function tankDraws(screen: ScreenState): TankDraw[] {
  const v = screen.view!
  const me = myIndex(screen)
  return v.tanks.map((t, i) => (i === me && screen.draft && i === v.turn ? { ...t, ...screen.draft } : t))
}

/** 대포를 그리는지 (바닥까지 떨어진 대포는 안 그림) */
export function tankShown(screen: ScreenState, i: number, t: TankDraw): boolean {
  const v = screen.view!
  return !(v.boom?.fell ?? []).includes(i) && !(!t.alive && heightAt(v.terrain, t.x) <= 1.5)
}

/** 터진 직후 화면 흔들림 (가로) */
export function shakeOf(screen: ScreenState): number {
  const v = screen.view
  const elapsed = screen.now - screen.phaseStart
  return v?.phase === 'boom' && v.boom?.at && elapsed < 400 ? Math.sin(elapsed / 18) * (1 - elapsed / 400) * 1.2 : 0
}

export function Battlefield({ screen, riders = false }: Props) {
  const lift = riders ? RIDER_LIFT : 0
  const v = screen.view
  const paths = useMemo(() => (v ? terrainPath(v.terrain) : null), [v?.terrain]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!v || !paths) return <div className="at-field at-field--empty" />

  const me = myIndex(screen)
  const elapsed = screen.now - screen.phaseStart
  // 내 차례면 겨누는 중인 걸 바로 그린다
  const tanks = tankDraws(screen)

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
  const shake = shakeOf(screen)

  const theme = THEMES[v.land?.theme ?? 'grass']
  const guide = canAim(screen) && screen.draft ? guidePoints(v.terrain, screen.draft.x, screen.draft.angle, screen.draft.power) : []

  return (
    <svg
      className="at-field"
      viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
      role="img"
      aria-label="전장"
    >
      <defs>
        <linearGradient id="at-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.sky[0]} />
          <stop offset="1" stopColor={theme.sky[1]} />
        </linearGradient>
        <linearGradient id="at-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.dirt[0]} />
          <stop offset="1" stopColor={theme.dirt[1]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#at-sky)" />
      {theme.stars && STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.85} />)}
      <circle cx={170} cy={22} r={9} fill={theme.sun[0]} stroke={theme.sun[1]} strokeWidth={0.8} />
      {[
        [30, 20, 1],
        [95, 14, 0.8],
        [140, 34, 0.7],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x},${y}) scale(${s})`} fill={theme.cloud} opacity={theme.stars ? 0.5 : 0.9}>
          <ellipse cx={0} cy={0} rx={10} ry={4} />
          <ellipse cx={6} cy={-2} rx={6} ry={4} />
          <ellipse cx={-5} cy={-1.5} rx={5} ry={3.5} />
        </g>
      ))}
      <g transform={`translate(${shake},0)`}>
        <path d={paths.fill} fill="url(#at-dirt)" />
        <path d={paths.top} fill="none" stroke={theme.top} strokeWidth={2.2} strokeLinejoin="round" />
        <path d={paths.top} fill="none" stroke={LINE} strokeWidth={0.5} strokeLinejoin="round" transform="translate(0,1.1)" opacity={0.35} />

        {tanks.map((t, i) =>
          // 바닥까지 떨어진 대포는 안 그린다
          !tankShown(screen, i, t) ? null : (
            <Tank
              key={v.players[i].id}
              t={t}
              color={v.teams ? TEAM_COLORS[v.teams[i]] : PLAYER_COLORS[i % PLAYER_COLORS.length]}
              {...poseOf(tankPose(v.terrain, t.x))}
              name={v.players[i].name}
              me={i === me}
              active={i === v.turn && (v.phase === 'aim' || v.phase === 'countdown')}
              bob={Math.sin(screen.now / 180) * 0.8}
              lift={lift}
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
                y={sy(heightAt(v.terrain, tanks[i].x)) - 19 - lift - elapsed / 120}
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
