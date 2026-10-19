import { formatAverage, formatInnings } from '../records'

/** 서버에서 받은 선수별 합계 (난이도 하나) */
export type LeaderRow = {
  playerId: string
  nickname: string
  games: number
  wins: number
  losses: number
  draws: number
  atBats: number
  hits: number
  homeruns: number
  rbi: number
  bestRbi: number
  outsPitched: number
  runsAllowed: number
}

/** 순위에 오르는 최소 조건 */
export const BOARD_RULES = {
  winRateMinGames: 3,
  battingMinAtBats: 10,
  rbiMinGames: 3,
  /** 6이닝 */
  eraMinOuts: 18,
} as const

export type BoardKey = 'winRate' | 'battingAvg' | 'rbiPerGame' | 'bestRbi' | 'era'

export type BoardEntry = {
  rank: number
  playerId: string
  nickname: string
  value: number
  /** 화면에 보여줄 값 (.667, 2.50 등) */
  display: string
  /** 보조 설명 (3승 1패 등) */
  detail: string
}

export type Board = {
  key: BoardKey
  title: string
  rule: string
  entries: BoardEntry[]
}

type Spec = {
  key: BoardKey
  title: string
  rule: string
  /** 순위에 오르지 못하면 null */
  value: (r: LeaderRow) => number | null
  lowerIsBetter?: boolean
  display: (value: number, r: LeaderRow) => string
  detail: (r: LeaderRow) => string
}

const SPECS: Spec[] = [
  {
    key: 'winRate',
    title: '승률',
    rule: `${BOARD_RULES.winRateMinGames}경기 이상 · 무승부 제외`,
    value: (r) =>
      r.games >= BOARD_RULES.winRateMinGames && r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : null,
    display: (_, r) => formatAverage(r.wins, r.wins + r.losses),
    detail: (r) => `${r.wins}승 ${r.losses}패 ${r.draws}무`,
  },
  {
    key: 'battingAvg',
    title: '타율',
    rule: `${BOARD_RULES.battingMinAtBats}타수 이상`,
    value: (r) => (r.atBats >= BOARD_RULES.battingMinAtBats ? r.hits / r.atBats : null),
    display: (_, r) => formatAverage(r.hits, r.atBats),
    detail: (r) => `${r.atBats}타수 ${r.hits}안타 ${r.homeruns}홈런`,
  },
  {
    key: 'rbiPerGame',
    title: '경기당 타점',
    rule: `${BOARD_RULES.rbiMinGames}경기 이상`,
    value: (r) => (r.games >= BOARD_RULES.rbiMinGames ? r.rbi / r.games : null),
    display: (v) => v.toFixed(2),
    detail: (r) => `${r.games}경기 ${r.rbi}타점`,
  },
  {
    key: 'bestRbi',
    title: '한 경기 최다 타점',
    rule: '1경기 이상',
    value: (r) => (r.games > 0 ? r.bestRbi : null),
    display: (v) => `${v}타점`,
    detail: (r) => `${r.games}경기`,
  },
  {
    key: 'era',
    title: '평균자책점',
    rule: `${BOARD_RULES.eraMinOuts / 3}이닝 이상 · 3이닝당 실점 · 낮을수록 1위`,
    value: (r) => (r.outsPitched >= BOARD_RULES.eraMinOuts ? (r.runsAllowed / r.outsPitched) * 9 : null),
    lowerIsBetter: true,
    display: (v) => v.toFixed(2),
    detail: (r) => `${formatInnings(r.outsPitched)}이닝 ${r.runsAllowed}실점`,
  },
]

/** 같은 값은 같은 등수 (1, 1, 3 …). 값이 같으면 경기를 더 많이 한 사람을 위에 보여준다. */
function rank(spec: Spec, rows: LeaderRow[], limit: number): BoardEntry[] {
  const scored = rows
    .map((r) => ({ r, value: spec.value(r) }))
    .filter((x): x is { r: LeaderRow; value: number } => x.value !== null)
    .sort((a, b) => {
      const diff = spec.lowerIsBetter ? a.value - b.value : b.value - a.value
      return Math.abs(diff) > 1e-9 ? diff : b.r.games - a.r.games
    })

  const entries: BoardEntry[] = []
  scored.forEach(({ r, value }, i) => {
    const prev = entries[i - 1]
    const tied = prev && Math.abs(prev.value - value) < 1e-9
    entries.push({
      rank: tied ? prev.rank : i + 1,
      playerId: r.playerId,
      nickname: r.nickname,
      value,
      display: spec.display(value, r),
      detail: spec.detail(r),
    })
  })
  return entries.slice(0, limit)
}

export function buildBoards(rows: LeaderRow[], limit = 10): Board[] {
  return SPECS.map((spec) => ({
    key: spec.key,
    title: spec.title,
    rule: spec.rule,
    entries: rank(spec, rows, limit),
  }))
}
