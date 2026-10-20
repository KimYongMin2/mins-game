import type { RankingBoardData, RankingEntry } from '../../../shared/ui/RankingBoard'

/** 서버에서 받은 선수별 합계 (난이도 하나) */
export type BattingLeaderRow = {
  playerId: string
  nickname: string
  games: number
  /** 최고 점수 경기 */
  best: { points: number; homeruns: number; hits: number; at: string }
  /** 홈런을 가장 많이 친 경기 */
  mostHr: { homeruns: number; points: number; at: string }
}

type Spec = {
  key: string
  title: string
  rule: string
  include: (r: BattingLeaderRow) => boolean
  /** 앞의 값이 클수록 위. 마지막 값은 '먼저 세운 기록'용 시각(작을수록 위)이라 부호를 바꿔 넣는다 */
  order: (r: BattingLeaderRow) => number[]
  display: (r: BattingLeaderRow) => string
  detail: (r: BattingLeaderRow) => string
}

const time = (iso: string) => -new Date(iso).getTime()

const SPECS: Spec[] = [
  {
    key: 'best',
    title: '최고 점수',
    rule: '동점이면 홈런 → 안타 이상 → 먼저 기록',
    include: () => true,
    order: (r) => [r.best.points, r.best.homeruns, r.best.hits, time(r.best.at)],
    display: (r) => `${r.best.points}점`,
    detail: (r) => `홈런 ${r.best.homeruns} · 안타 이상 ${r.best.hits}`,
  },
  {
    key: 'mostHr',
    title: '한 경기 최다 홈런',
    rule: '동점이면 그 경기 점수 → 먼저 기록',
    include: (r) => r.mostHr.homeruns > 0,
    order: (r) => [r.mostHr.homeruns, r.mostHr.points, time(r.mostHr.at)],
    display: (r) => `홈런 ${r.mostHr.homeruns}개`,
    detail: (r) => `그 경기 ${r.mostHr.points}점`,
  },
]

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i]
  }
  return 0
}

/** 정렬 기준이 모두 같을 때만 같은 등수 (1, 1, 3 …) */
function rank(spec: Spec, rows: BattingLeaderRow[], limit: number): RankingEntry[] {
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

export function buildBoards(rows: BattingLeaderRow[], limit = 10): RankingBoardData[] {
  return SPECS.map((spec) => ({ key: spec.key, title: spec.title, rule: spec.rule, entries: rank(spec, rows, limit) }))
}
