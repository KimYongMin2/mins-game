import { type Difficulty, type Hand, TOTAL_PITCHES } from '../../games/batting/constants'
import { createSession, sessionReducer, summarizeSession, type SessionState } from '../../games/batting/play/session'

// 배팅 다시 치기: 서버 시드(구종·칸·도착 시각) + 공마다 누른 곳과 '도착보다 몇 ms 빨랐나/늦었나'로 처음부터 똑같이 쳐서 점수를 서버가 정한다.
// 공을 놓는 시각은 화면 프레임에 따라 조금씩 달라서 절대 시각 대신 도착 기준 차이(offsetMs)를 받는다 — 판정은 그 차이로만 하니 결과가 같다.

export type BattingSwingLog = { point: { col: number; row: number }; offsetMs: number } | null
export type BattingReplay = { difficulty: Difficulty; hand: Hand; points: number; homeruns: number; hits: number }

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function readSwings(x: unknown): BattingSwingLog[] | null {
  if (!Array.isArray(x) || x.length !== TOTAL_PITCHES) return null
  const out: BattingSwingLog[] = []
  for (const s of x as unknown[]) {
    if (s === null) {
      out.push(null)
      continue
    }
    const o = s as Record<string, unknown>
    const p = o?.point as Record<string, unknown> | undefined
    // 누른 곳은 존 근처(칸 단위 -1~4), 차이는 ±5초 안
    if (!p || !isNum(p.col) || !isNum(p.row) || Math.abs(p.col - 1) > 3 || Math.abs(p.row - 1) > 3 || !isNum(o.offsetMs) || Math.abs(o.offsetMs) > 5000) return null
    out.push({ point: { col: p.col, row: p.row }, offsetMs: o.offsetMs })
  }
  return out
}

export function replayBatting(seed: number, difficulty: unknown, hand: unknown, swingsIn: unknown): BattingReplay | null {
  if ((difficulty !== 'normal' && difficulty !== 'hard') || (hand !== 'right' && hand !== 'left')) return null
  const swings = readSwings(swingsIn)
  if (!swings) return null
  let s: SessionState = createSession({ now: 0, seed, difficulty, hand })
  let t = 0
  while (s.phase.kind !== 'done') {
    if (t > 10 * 60_000) return null
    const { phase } = s
    const log = swings[s.index]
    if (phase.kind === 'pitching' && !phase.swing && log) {
      const at = phase.pitch.arriveAt + log.offsetMs
      // 공을 놓기 전이나 공이 다 지나간 뒤에 친 기록은 말이 안 됨
      if (at < phase.pitch.releaseAt) return null
      if (t + 1 >= at) {
        s = sessionReducer({ ...s, now: Math.max(t, at) }, { type: 'swing', point: log.point, at })
        if (s.phase.kind === 'pitching' && !s.phase.swing) return null
        continue
      }
    }
    t += 1
    s = sessionReducer(s, { type: 'tick', now: t })
  }
  // 친 공 수가 기록과 같아야 (늦게 친 기록이 공이 지나간 뒤라 버려졌으면 조작)
  const swung = s.records.filter((r) => r.touched !== null).length
  if (swung !== swings.filter(Boolean).length) return null
  const sum = summarizeSession(s)
  return { difficulty, hand, points: sum.points, homeruns: sum.homeruns, hits: sum.hits }
}
