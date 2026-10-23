// 봇: 맵 안 아무 곳에 서서, 상대가 지난 라운드에 있던 곳(모르면 맵 아무 곳)을 노린다.
// 다른 사람 자리는 공개 전에 못 보니 봇도 짐작으로 쏜다.
import { type Rng, chance, pickOne } from '../../../shared/random'
import { type Vec, type Wall, randomInArena, randomSpot } from '../rules/geometry'

/** lastSeen: 살아 있는 상대들의 지난 라운드 자리 (첫 라운드면 null) */
export function chooseBotPlan(rng: Rng, half: number, walls: readonly Wall[], lastSeen: readonly (Vec | null)[]): { pos: Vec; angle: number } {
  const pos = randomSpot(rng, half, walls)
  const known = lastSeen.filter((p): p is Vec => p !== null)
  // 지난 자리 근처를 노리거나(사람은 잘 안 움직이기도 해서), 맵 아무 곳
  const aimAt = known.length > 0 && chance(rng, 0.6) ? pickOne(rng, known) : randomInArena(rng, half * 0.8)
  const jitter = (rng.next() - 0.5) * half * 0.3
  const dx = aimAt.x + jitter - pos.x
  const dy = aimAt.y - jitter - pos.y
  const angle = Math.hypot(dx, dy) < 1 ? rng.next() * Math.PI * 2 : Math.atan2(dy, dx)
  return { pos, angle }
}
