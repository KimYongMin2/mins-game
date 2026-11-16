import { AUTO_RELEASE_MS, SHOT_CLOCK_MS, TOTAL_ARROWS } from '../../games/archery/constants'
import { createRound, roundReducer, summarizeRound, type RoundState } from '../../games/archery/play/roundState'

// 양궁 다시 쏘기: 서버 시드(바람·흔들림) + 화살마다 누른 시각·놓은 시각·조준점으로 처음부터 똑같이 쏴서 점수를 서버가 정한다.
// 흔들림은 놓은 시각(절대값)과 당긴 시간으로만 정해져서 같은 시각이면 같은 자리에 꽂힌다.
// 단계가 바뀌는 시각은 화면 프레임에 따라 조금씩 달라서, 서버는 1ms씩 돌려 언제나 화면보다 늦지 않게 바뀌게 한다.

export type ArcheryShotLog = { pressAt: number | null; releaseAt: number | null; aim: { x: number; y: number } }
export type ArcheryReplay = { points: number; xCount: number; tenCount: number }

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/** 놓은 시각이 자동 발사·시간 끝보다 이만큼 늦어도 봐줌 (화면 한 프레임) */
const SLACK_MS = 50

function readShots(x: unknown): ArcheryShotLog[] | null {
  if (!Array.isArray(x) || x.length !== TOTAL_ARROWS) return null
  const out: ArcheryShotLog[] = []
  for (const s of x as Record<string, unknown>[]) {
    if (!s || typeof s !== 'object') return null
    const aim = s.aim as Record<string, unknown> | undefined
    if (!aim || !isNum(aim.x) || !isNum(aim.y)) return null
    const pressAt = s.pressAt === null ? null : isNum(s.pressAt) ? s.pressAt : undefined
    const releaseAt = s.releaseAt === null ? null : isNum(s.releaseAt) ? s.releaseAt : undefined
    if (pressAt === undefined || releaseAt === undefined || (pressAt === null) !== (releaseAt === null)) return null
    if (pressAt !== null && releaseAt !== null && (releaseAt < pressAt || releaseAt - pressAt > AUTO_RELEASE_MS + SLACK_MS)) return null
    out.push({ pressAt, releaseAt, aim: { x: aim.x, y: aim.y } })
  }
  return out
}

export function replayArchery(seed: number, t0: unknown, shotsIn: unknown): ArcheryReplay | null {
  const shots = readShots(shotsIn)
  if (!shots || !isNum(t0)) return null
  let s: RoundState = createRound(t0, seed)
  let t = t0
  // 한 판 최대 시간 (화살마다 안내·10초·비행·점수 보여주기) — 넘으면 이상한 기록
  const end = t0 + TOTAL_ARROWS * (SHOT_CLOCK_MS + 6000)
  while (s.phase.kind !== 'done') {
    if (t > end) return null
    const log = shots[s.arrowIndex]
    const { phase } = s
    if (phase.kind === 'ready' && log.pressAt !== null && log.pressAt <= t + 1) {
      if (s.deadline !== null && log.pressAt > s.deadline + SLACK_MS) return null
      t = Math.max(t, log.pressAt)
      s = roundReducer({ ...s, now: t }, { type: 'press', at: log.pressAt })
      s = roundReducer(s, { type: 'aimBy', dx: log.aim.x, dy: log.aim.y })
      continue
    }
    if (phase.kind === 'drawing') {
      // 당기는 중엔 자동 발사를 서버 시각으로 하지 않고 적힌 놓은 시각에 놓는다
      const at = log.releaseAt!
      if (s.deadline !== null && at > s.deadline + SLACK_MS) return null
      t = Math.max(t, at)
      s = roundReducer({ ...s, now: t }, { type: 'release', at })
      continue
    }
    // 이 화살을 안 쐈다고 적혔는데 서버에선 시간 안에 누를 차례가 지나감 → 시간 초과로 처리됨
    t += 1
    s = roundReducer(s, { type: 'tick', now: t })
  }
  const sum = summarizeRound(s)
  return { points: sum.points, xCount: sum.xCount, tenCount: sum.tenCount }
}
