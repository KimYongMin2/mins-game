import { type MatchInput, type MatchState, type MatchSummary, createMatch, isUserBatting, isUserPitching, matchReducer, summarize } from '../../games/zolaball/match/matchState'
import { PITCH_KEYS } from '../../games/zolaball/play/pitchSelection'
import { userSideForSeed } from '../../games/zolaball/ranking/row'

// 야구 봇 경기 다시 돌리기: 서버 시드(선공·후공, 봇 구종·스윙·타구) + 공마다 내 입력으로 처음부터 똑같이 돌려 기록을 서버가 정한다.
// 내 입력: 투수면 고른 구종·높이(못 고른 칸은 시간 초과 무작위), 타자면 휘두른 시각 − 도착 시각.
// 공을 놓는 시각 등은 화면 프레임마다 조금씩 달라도 판정은 도착 기준 차이로만 해서 결과가 같다.

const STEP_MS = 10
/** 한 경기 최대 길이 (넘으면 이상한 기록) */
const MAX_MS = 40 * 60_000

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function readInputs(x: unknown): MatchInput[] | null {
  if (!Array.isArray(x) || x.length > 400) return null
  const out: MatchInput[] = []
  for (const i of x as Record<string, unknown>[]) {
    if (i && typeof i === 'object' && 'sel' in i) {
      const sel = i.sel as Record<string, unknown> | null
      const key = sel?.key ?? null
      const height = sel?.height ?? null
      if ((key !== null && !PITCH_KEYS.includes(key as 1)) || (height !== null && height !== 'high' && height !== 'low')) return null
      out.push({ sel: { key: key as 1 | null, height: height as 'high' | null } })
    } else if (i && typeof i === 'object' && 'diff' in i) {
      if (i.diff !== null && (!isNum(i.diff) || Math.abs(i.diff) > 5000)) return null
      out.push({ diff: i.diff as number | null })
    } else return null
  }
  return out
}

export function replayZolaball(seed: number, difficulty: unknown, inputsIn: unknown): MatchSummary | null {
  if (difficulty !== 'normal' && difficulty !== 'hard') return null
  const inputs = readInputs(inputsIn)
  if (!inputs) return null
  let s: MatchState = createMatch({ difficulty, userSide: userSideForSeed(seed) }, 0, seed)
  let t = 0
  /** 이번 투구에 고른 것을 이미 넣었는지 (덜 골랐으면 시간 초과를 기다림) */
  let selectedFor = -1
  while (s.phase.kind !== 'final') {
    if (t > MAX_MS) return null
    const next = inputs[s.inputs.length]
    const { phase } = s
    if (phase.kind === 'choosing' && isUserPitching(s) && selectedFor !== s.pitchCount) {
      if (!next || !('sel' in next)) return null
      selectedFor = s.pitchCount
      if (next.sel.key !== null) s = matchReducer(s, { type: 'selectKey', key: next.sel.key })
      if (next.sel.height !== null && s.phase.kind === 'choosing') s = matchReducer(s, { type: 'selectHeight', height: next.sel.height })
      continue
    }
    if (phase.kind === 'pitching' && isUserBatting(s) && !phase.swing) {
      if (!next || !('diff' in next)) return null
      if (next.diff !== null) {
        const at = phase.pitch.arriveAt + next.diff
        if (at < phase.pitch.releaseAt) return null
        if (t + STEP_MS >= at) {
          t = Math.max(t, at)
          s = matchReducer({ ...s, now: t }, { type: 'swing', at })
          if (s.phase.kind === 'pitching' && !s.phase.swing) return null
          continue
        }
      }
    }
    t += STEP_MS
    s = matchReducer(s, { type: 'tick', now: t })
  }
  // 서버가 돌리며 쌓은 입력이 보낸 기록과 똑같아야 (남거나 모자라면 조작)
  if (JSON.stringify(s.inputs) !== JSON.stringify(inputs)) return null
  return summarize(s)
}
