// 봇: 다음 칸에 총알이 있을 확률(1 / 남은 칸)을 보고 정한다.
// 확률이 낮으면 가끔 자기를 쏴서(빈 칸이면 한 번 더) 차례를 지키고, 높으면 남을 쏜다.
import { type Rng, chance, pickOne } from '../../../shared/random'
import { CHAMBERS } from '../constants'

export function chooseTarget(rng: Rng, me: number, alive: readonly number[], pulls: number): number {
  const others = alive.filter((i) => i !== me)
  if (others.length === 0) return me
  const risk = 1 / (CHAMBERS - pulls)
  // 첫 당김(1/6)이면 반쯤, 1/5면 가끔, 그 위로는 거의 남을 쏜다
  const selfChance = risk <= 1 / 6 ? 0.45 : risk <= 1 / 5 ? 0.2 : risk < 1 ? 0.05 : 0
  return chance(rng, selfChance) ? me : pickOne(rng, others)
}
