import type { Point } from '../play/pitch'

/** 공 꼬리(잔상): 조금 전 자리들 (가까운 것부터) */
export function trailOf(positionAt: (t: number) => Point | null, now: number, steps = 5, gapMs = 18): Point[] {
  const out: Point[] = []
  for (let k = 1; k <= steps; k++) {
    const p = positionAt(now - k * gapMs)
    if (p) out.push(p)
  }
  return out
}
