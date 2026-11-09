// 팀전 공통 (게임 규칙은 모름): 두 팀(0 = 파랑, 1 = 빨강) 나누기, 앉는 순서, 이긴 팀.
// 자리는 사람 id로 고른다(방장 id · 친구 id · 'bot0'…). 고르지 않은 사람은 사람이 적은 팀으로 간다.

export type Team = 0 | 1

/** id → 팀. 대기실에서 방장이 정한 것 */
export type TeamPick = Record<string, Team>

export const TEAM_NAMES = ['파랑 팀', '빨강 팀'] as const
export const TEAM_COLORS = ['#3b82f6', '#ef4444'] as const

/** 사람마다 팀을 정한다. 고른 게 있으면 그대로, 없으면 사람이 적은 팀으로 (같으면 파랑) */
export function assignTeams(ids: readonly string[], pick: TeamPick): Team[] {
  const count = [0, 0]
  for (const id of ids) if (pick[id] !== undefined) count[pick[id]]++
  return ids.map((id) => {
    const p = pick[id]
    if (p !== undefined) return p
    const t: Team = count[1] < count[0] ? 1 : 0
    count[t]++
    return t
  })
}

/** 두 팀 모두 한 명 이상이어야 팀전을 할 수 있다 */
export function teamsReady(teams: readonly Team[]): boolean {
  return teams.includes(0) && teams.includes(1)
}

/**
 * 앉는(차례) 순서: 두 팀이 번갈아 오게 자리 번호를 다시 늘어놓는다 (한쪽이 많으면 남는 사람은 뒤에).
 * 원래 순서에서 같은 팀끼리는 순서를 지킨다. 돌려주는 건 원래 번호들
 */
export function alternateSeats(teams: readonly Team[]): number[] {
  const byTeam: number[][] = [[], []]
  teams.forEach((t, i) => byTeam[t].push(i))
  const first: Team = teams[0] ?? 0
  const a = byTeam[first]
  const b = byTeam[1 - first]
  const out: number[] = []
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    if (k < a.length) out.push(a[k])
    if (k < b.length) out.push(b[k])
  }
  return out
}

/** 살아 있는 사람이 모두 한 팀이면 그 팀, 아니면 null (아무도 없으면 null) */
export function lastTeam(alive: readonly boolean[], teams: readonly Team[]): Team | null {
  let found: Team | null = null
  for (let i = 0; i < alive.length; i++) {
    if (!alive[i]) continue
    if (found === null) found = teams[i]
    else if (found !== teams[i]) return null
  }
  return found
}

/** 같은 팀인지 (팀전이 아니면 늘 false) */
export const sameTeam = (teams: readonly Team[] | null, a: number, b: number): boolean => !!teams && a !== b && teams[a] === teams[b]

/**
 * 경기 시작할 때: 사람 id들과 대기실에서 고른 팀 → 앉는 순서(원래 번호들)와 그 순서대로의 팀.
 * 그새 사람이 바뀌어 한 팀이 비면 처음부터 고르게 나눈다
 */
export function planTeams(ids: readonly string[], pick: TeamPick): { order: number[]; teams: Team[] } {
  let teams = assignTeams(ids, pick)
  if (!teamsReady(teams)) teams = assignTeams(ids, {})
  const order = alternateSeats(teams)
  return { order, teams: order.map((i) => teams[i]) }
}

/** 결과 화면용 팀전 결과 */
export type TeamOutcome = {
  /** 이긴 팀 (무승부면 null) */
  winner: Team | null
  myTeam: Team
  members: { name: string; team: Team; me: boolean }[]
}

export function teamOutcome(names: readonly string[], teams: readonly Team[], me: number, winner: Team | null): TeamOutcome {
  return {
    winner,
    myTeam: teams[me],
    members: names.map((name, i) => ({ name, team: teams[i], me: i === me })),
  }
}
