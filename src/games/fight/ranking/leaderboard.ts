import type { RankingBoardData, RankingEntry } from '../../../shared/ui/RankingBoard'

/** 서버에서 받은 선수별 합계 (난이도 하나) */
export type FightLeaderRow = {
  playerId: string
  nickname: string
  wins: number
  losses: number
  draws: number
  bestStreak: number
  /** 최다 연승을 처음 세운 시각 */
  bestStreakAt: string | null
}

/** 승률 랭킹에 오르려면 승+패가 이만큼 */
export const WIN_RATE_MIN_GAMES = 5

type Spec = {
  key: string
  title: string
  rule: string
  include: (r: FightLeaderRow) => boolean
  /** 앞의 값이 클수록 위 */
  order: (r: FightLeaderRow) => number[]
  display: (r: FightLeaderRow) => string
  detail: (r: FightLeaderRow) => string
}

const rate = (r: FightLeaderRow) => r.wins / (r.wins + r.losses)
const time = (iso: string | null) => (iso ? -new Date(iso).getTime() : 0)

const SPECS: Spec[] = [
  {
    key: 'winRate',
    title: '승률',
    rule: `${WIN_RATE_MIN_GAMES}경기 이상, 무승부 제외`,
    include: (r) => r.wins + r.losses >= WIN_RATE_MIN_GAMES,
    order: (r) => [rate(r), r.wins],
    display: (r) => `${Math.round(rate(r) * 1000) / 10}%`,
    detail: (r) => `${r.wins}승 ${r.losses}패${r.draws ? ` ${r.draws}무` : ''}`,
  },
  {
    key: 'streak',
    title: '최다 연승',
    rule: '동점이면 먼저 기록',
    include: (r) => r.bestStreak > 0,
    order: (r) => [r.bestStreak, time(r.bestStreakAt)],
    display: (r) => `${r.bestStreak}연승`,
    detail: (r) => `${r.wins}승 ${r.losses}패`,
  },
]

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-9) return b[i] - a[i]
  }
  return 0
}

/** 정렬 기준이 모두 같을 때만 같은 등수 (1, 1, 3 …) */
function rank(spec: Spec, rows: FightLeaderRow[], limit: number): RankingEntry[] {
  const sorted = rows.filter(spec.include).sort((a, b) => compare(spec.order(a), spec.order(b)))
  const entries: (RankingEntry & { key: number[] })[] = []
  sorted.forEach((r, i) => {
    const key = spec.order(r)
    const prev = entries[i - 1]
    entries.push({
      rank: prev && compare(prev.key, key) === 0 ? prev.rank : i + 1,
      playerId: r.playerId,
      nickname: r.nickname,
      display: spec.display(r),
      detail: spec.detail(r),
      key,
    })
  })
  return entries.slice(0, limit).map(({ key: _key, ...e }) => e)
}

export function buildBoards(rows: FightLeaderRow[], limit = 10): RankingBoardData[] {
  return SPECS.map((spec) => ({ key: spec.key, title: spec.title, rule: spec.rule, entries: rank(spec, rows, limit) }))
}
