// 탱크 대전 봇: 바람·지형을 넣고 각도·힘을 여러 개 미리 쏴 보고(simulateShot) 가장 가까이 떨어지는 걸 고른 뒤,
// 난이도만큼 손을 떨어 흔든다. 나한테 너무 가까이 떨어지는 건 피한다.
import type { Rng } from "../../../shared/random";
import { DAMAGE_R, POWER_MAX, POWER_MIN } from "../constants";
import {
  type ShotTank,
  type Terrain,
  simulateShot,
  tankCenter,
} from "../rules/physics";

export type BotLevel = "normal" | "hard";

/** 손 떨림: 각도(도), 힘 */
const JITTER: Record<BotLevel, { angle: number; power: number }> = {
  normal: { angle: 5, power: 7 },
  hard: { angle: 1.2, power: 1.8 },
};

export type BotAim = { angle: number; power: number };

export function chooseBotAim(
  rng: Rng,
  terrain: Terrain,
  tanks: (ShotTank & { hp: number })[],
  me: number,
  wind: number,
  level: BotLevel,
): BotAim {
  const myPos = tankCenter(terrain, tanks[me].x);
  const enemies = tanks
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => t.alive && i !== me);
  if (enemies.length === 0) return { angle: 90, power: 30 };
  // 노릴 상대: 일반은 가장 가까운 사람, 어려움은 가까운 두 명 중 체력이 적은 사람
  enemies.sort(
    (a, b) => Math.abs(a.t.x - tanks[me].x) - Math.abs(b.t.x - tanks[me].x),
  );
  const target =
    level === "hard"
      ? [...enemies.slice(0, 2)].sort((a, b) => a.t.hp - b.t.hp)[0]
      : enemies[0];
  const goal = tankCenter(terrain, target.t.x);
  const right = goal.x >= myPos.x;
  let best = { angle: right ? 45 : 135, power: 60, miss: Infinity };
  for (let a = 15; a <= 80; a += 2.5) {
    const angle = right ? a : 180 - a;
    for (let power = 15; power <= POWER_MAX; power += 2) {
      const s = simulateShot(terrain, tanks, me, angle, power, wind);
      if (!s.impact) continue;
      // 나한테 너무 가까우면 버림
      if (Math.hypot(s.impact.x - myPos.x, s.impact.y - myPos.y) < DAMAGE_R)
        continue;
      const miss = Math.hypot(s.impact.x - goal.x, s.impact.y - goal.y);
      if (miss < best.miss) best = { angle, power, miss };
    }
  }
  const j = JITTER[level];
  const angle = Math.min(
    180,
    Math.max(0, best.angle + (rng.next() * 2 - 1) * j.angle),
  );
  const power = Math.min(
    POWER_MAX,
    Math.max(POWER_MIN, best.power + (rng.next() * 2 - 1) * j.power),
  );
  return {
    angle: Math.round(angle * 10) / 10,
    power: Math.round(power * 10) / 10,
  };
}
