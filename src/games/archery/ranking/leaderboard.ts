import type { RankingBoardData, RankingEntry } from '../../../shared/ui/RankingBoard'
import { formatPoints } from '../rules/scoring'

/** 서버에서 받은 선수별 합계 */
export type ArcheryLeaderRow = {
  playerId: string
  nickname: string
  games: number
  avgPoints: number
  /** 최고 점수 경기 */
  best: { points: number; xCount: number; tenCount: number; at: string }
  /** X를 가장 많이 맞힌 경기 */
  mostX: { xCount: number; points: number; at: string }
}

export const AVERAGE_MIN_GAMES = 3

type Spec = {
  key: string
  title: string
  rule: string
  include: (r: ArcheryLeaderRow) => boolean
  /** 앞의 값이 클수록 위. 마지막 값은 '먼저 세운 기록'용 시각(작을수록 위)이라 부호를 바꿔 넣는다 */
  order: (r: ArcheryLeaderRow) => number[]
  display: (r: ArcheryLeaderRow) => string
  detail: (r: ArcheryLeaderRow) => string
}

const time = (iso: string) => -new Date(iso).getTime()

const SPECS: Spec[] = [
  {
    key: 'best',
    title: '최고 점수',
    rule: '동점이면 X → 10점 개수 → 먼저 기록',
    include: () => true,
    order: (r) => [r.best.points, r.best.xCount, r.best.tenCount, time(r.best.at)],
    display: (r) => `${formatPoints(r.best.points)}점`,
    detail: (r) => `X ${r.best.xCount} · 10점 ${r.best.tenCount}`,
  },
  {
    key: 'average',
    title: '평균 점수',
    rule: `${AVERAGE_MIN_GAMES}경기 이상`,
    include: (r) => r.games >= AVERAGE_MIN_GAMES,
    order: (r) => [r.avgPoints, r.games],
    display: (r) => `${r.avgPoints.toFixed(1)}점`,
    detail: (r) => `${r.games}경기`,
  },
  {
    key: 'mostX',
    title: '한 경기 최다 X',
    rule: '동점이면 그 경기 점수 → 먼저 기록',
    include: (r) => r.mostX.xCount > 0,
    order: (r) => [r.mostX.xCount, r.mostX.points, time(r.mostX.at)],
    display: (r) => `X ${r.mostX.xCount}개`,
    detail: (r) => `그 경기 ${formatPoints(r.mostX.points)}점`,
  },
]

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-9) return b[i] - a[i]
  }
  return 0
}

/** 정렬 기준이 모두 같을 때만 같은 등수 (1, 1, 3 …) */
function rank(spec: Spec, rows: ArcheryLeaderRow[], limit: number): RankingEntry[] {
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

export function buildBoards(rows: ArcheryLeaderRow[], limit = 10): RankingBoardData[] {
  return SPECS.map((spec) => ({ key: spec.key, title: spec.title, rule: spec.rule, entries: rank(spec, rows, limit) }))
}
