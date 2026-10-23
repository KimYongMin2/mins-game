// 알까기 봇. 내 돌 × 상대 돌마다 그쪽을 겨눠 여러 힘으로 미리 튕겨 보고(물리 계산) 가장 좋은 수를 고른 뒤,
// 난이도만큼 방향·힘을 흔들어 쏜다.
// - 좋은 수: 상대 돌을 많이 떨어뜨림 > 내 돌은 안 떨어짐 > 튕긴 돌이 남아 한 번 더
// - 일반: 힘을 몇 가지만 보고 상위 몇 개 중 아무거나, 조준이 많이 흔들림 / 어려움: 각도도 조금씩 바꿔 보고 거의 정확
import { type Rng, pickOne } from '../../../shared/random'
import { BOT_AIM, type Difficulty, MAX_SPEED } from '../constants'
import { type Side, type Stone, remaining, simulate } from '../rules/physics'

export type Shot = { index: number; vx: number; vy: number }

const SEARCH: Record<Difficulty, { powers: number[]; angles: number[]; top: number }> = {
  normal: { powers: [0.5, 0.75, 1], angles: [0], top: 4 },
  hard: { powers: [0.35, 0.5, 0.65, 0.8, 1], angles: [-3, 0, 3], top: 1 },
}

const rad = (deg: number) => (deg * Math.PI) / 180

function shotOf(index: number, angle: number, power: number): Shot {
  return { index, vx: Math.cos(angle) * power * MAX_SPEED, vy: Math.sin(angle) * power * MAX_SPEED }
}

/** 이 수가 얼마나 좋은지 */
function evaluate(stones: readonly Stone[], side: Side, shot: Shot): number {
  const { final } = simulate(stones, shot.index, shot.vx, shot.vy)
  const foe = (1 - side) as Side
  const knocked = remaining(stones, foe) - remaining(final, foe)
  const lost = remaining(stones, side) - remaining(final, side)
  const stays = final[shot.index].on
  return knocked * 100 - lost * 120 + (knocked > 0 && stays ? 30 : 0)
}

/** side 차례에 튕길 수 */
export function chooseShot(rng: Rng, stones: readonly Stone[], side: Side, difficulty: Difficulty): Shot {
  const { powers, angles, top } = SEARCH[difficulty]
  const candidates: { shot: Shot; score: number }[] = []
  stones.forEach((a, i) => {
    if (a.side !== side || !a.on) return
    for (const b of stones) {
      if (b.side === side || !b.on) continue
      const base = Math.atan2(b.y - a.y, b.x - a.x)
      for (const off of angles) {
        for (const p of powers) {
          const shot = shotOf(i, base + rad(off), p)
          candidates.push({ shot, score: evaluate(stones, side, shot) + rng.next() })
        }
      }
    }
  })
  if (candidates.length === 0) return weakShot(rng, stones, side)
  candidates.sort((x, y) => y.score - x.score)
  const best = pickOne(rng, candidates.slice(0, top)).shot
  // 손이 떨림
  const aim = BOT_AIM[difficulty]
  const angle = Math.atan2(best.vy, best.vx) + rad((rng.next() * 2 - 1) * aim.angle)
  const power = Math.min(1, (Math.hypot(best.vx, best.vy) / MAX_SPEED) * (1 + (rng.next() * 2 - 1) * aim.power))
  return shotOf(best.index, angle, power)
}

/** 시간 초과: 아무 돌이나 아무 방향으로 약하게 */
export function weakShot(rng: Rng, stones: readonly Stone[], side: Side): Shot {
  const mine = stones.flatMap((s, i) => (s.side === side && s.on ? [i] : []))
  return shotOf(pickOne(rng, mine), rng.next() * Math.PI * 2, 0.2 + rng.next() * 0.1)
}
