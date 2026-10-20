// 경기 규칙: 볼카운트·아웃·주자·점수·이닝. 화면·입력과 무관한 순수 함수만 둔다.

export const INNINGS = 2

/** away = 선공(초), home = 후공(말) */
export type Side = 'away' | 'home'
export type Half = 'top' | 'bottom'
/** [1루, 2루, 3루]에 주자가 있는지 */
export type Bases = readonly [boolean, boolean, boolean]

/** 투구 하나의 결과 */
export type PitchOutcome =
  | 'ball'
  | 'calledStrike'
  | 'swingingStrike'
  | 'foul'
  | 'out'
  | 'single'
  | 'double'
  | 'homerun'

/** 타석이 끝났을 때의 결과 */
export type PlateResult = 'strikeout' | 'walk' | 'out' | 'single' | 'double' | 'homerun'

export type BattingStats = {
  atBats: number
  hits: number
  homeruns: number
  strikeouts: number
  walks: number
  /** 타점: 이 타자의 타석 결과로 들어온 점수 (홈런은 본인 득점 포함) */
  rbi: number
}

/** 수비(투수) 기록 */
export type PitchingStats = {
  /** 잡은 아웃 수. 3개 = 1이닝 */
  outs: number
  runsAllowed: number
}

export type GameState = {
  /** 1부터 시작 */
  inning: number
  half: Half
  outs: number
  balls: number
  strikes: number
  bases: Bases
  /** 이닝별 득점. 시작한 이닝까지만 들어 있다. */
  linescore: Record<Side, number[]>
  stats: Record<Side, BattingStats>
  pitching: Record<Side, PitchingStats>
  final: boolean
}

/** 투구 하나를 적용한 뒤 화면·효과음에 알려줄 내용 */
export type PlayEvent = {
  outcome: PitchOutcome
  /** 이 투구로 타석이 끝났으면 그 결과 */
  plateResult: PlateResult | null
  runs: number
  halfEnded: boolean
  gameEnded: boolean
}

const EMPTY_BASES: Bases = [false, false, false]

function emptyStats(): BattingStats {
  return { atBats: 0, hits: 0, homeruns: 0, strikeouts: 0, walks: 0, rbi: 0 }
}

function emptyPitching(): PitchingStats {
  return { outs: 0, runsAllowed: 0 }
}

export function createGame(): GameState {
  return {
    inning: 1,
    half: 'top',
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: EMPTY_BASES,
    linescore: { away: [0], home: [] },
    stats: { away: emptyStats(), home: emptyStats() },
    pitching: { away: emptyPitching(), home: emptyPitching() },
    final: false,
  }
}

export function battingSide(half: Half): Side {
  return half === 'top' ? 'away' : 'home'
}

export function fieldingSide(half: Half): Side {
  return half === 'top' ? 'home' : 'away'
}

export function totalRuns(game: GameState, side: Side): number {
  return game.linescore[side].reduce((a, b) => a + b, 0)
}

/** 모든 주자와 타자가 n베이스씩 진루. 홈을 밟은 수를 돌려준다. */
function advance(bases: Bases, n: number): [Bases, number] {
  const next = [false, false, false]
  let runs = 0
  bases.forEach((occupied, i) => {
    if (!occupied) return
    if (i + n >= 3) runs++
    else next[i + n] = true
  })
  // 타자
  if (n >= 4) runs++
  else next[n - 1] = true
  return [next as unknown as Bases, runs]
}

/** 볼넷: 1루부터 꽉 찬 베이스만 밀려서 진루 */
function walk(bases: Bases): [Bases, number] {
  const [first, second, third] = bases
  if (!first) return [[true, second, third], 0]
  if (!second) return [[true, true, third], 0]
  if (!third) return [[true, true, true], 0]
  return [[true, true, true], 1]
}

export function applyPitch(game: GameState, outcome: PitchOutcome): { game: GameState; event: PlayEvent } {
  if (game.final) throw new Error('경기가 이미 끝났습니다')

  let { balls, strikes, outs, bases } = game
  let runs = 0
  let plateResult: PlateResult | null = null

  switch (outcome) {
    case 'ball':
      balls++
      if (balls === 4) {
        ;[bases, runs] = walk(bases)
        plateResult = 'walk'
      }
      break
    case 'calledStrike':
    case 'swingingStrike':
      strikes++
      if (strikes === 3) {
        outs++
        plateResult = 'strikeout'
      }
      break
    case 'foul':
      // 2스트라이크 이후 파울은 카운트 유지
      if (strikes < 2) strikes++
      break
    case 'out':
      outs++
      plateResult = 'out'
      break
    case 'single':
      ;[bases, runs] = advance(bases, 1)
      plateResult = 'single'
      break
    case 'double':
      ;[bases, runs] = advance(bases, 2)
      plateResult = 'double'
      break
    case 'homerun':
      ;[bases, runs] = advance(bases, 4)
      plateResult = 'homerun'
      break
  }

  if (plateResult) {
    balls = 0
    strikes = 0
  }

  const side = battingSide(game.half)
  const stats = { ...game.stats[side] }
  if (plateResult === 'walk') stats.walks++
  else if (plateResult) stats.atBats++
  if (plateResult === 'single' || plateResult === 'double' || plateResult === 'homerun') stats.hits++
  if (plateResult === 'homerun') stats.homeruns++
  if (plateResult === 'strikeout') stats.strikeouts++
  // 점수는 볼넷·안타·홈런 타석에서만 나므로 모두 그 타자의 타점
  stats.rbi += runs

  const defense = fieldingSide(game.half)
  const pitching = {
    outs: game.pitching[defense].outs + (outs - game.outs),
    runsAllowed: game.pitching[defense].runsAllowed + runs,
  }

  const sideLine = [...game.linescore[side]]
  sideLine[game.inning - 1] += runs

  let next: GameState = {
    ...game,
    balls,
    strikes,
    outs,
    bases,
    linescore: { ...game.linescore, [side]: sideLine },
    stats: { ...game.stats, [side]: stats },
    pitching: { ...game.pitching, [defense]: pitching },
  }

  const lastInning = game.inning >= INNINGS
  const homeLeads = () => totalRuns(next, 'home') > totalRuns(next, 'away')
  let halfEnded = false

  if (game.half === 'bottom' && lastInning && homeLeads()) {
    // 끝내기: 마지막 이닝 말에 후공이 앞서는 순간 경기 종료
    next = { ...next, final: true }
  } else if (outs >= 3) {
    halfEnded = true
    const cleared = { ...next, outs: 0, balls: 0, strikes: 0, bases: EMPTY_BASES }
    if (game.half === 'top') {
      // 마지막 이닝 초가 끝났는데 후공이 이미 앞서면 말 공격은 하지 않는다.
      next = lastInning && homeLeads()
        ? { ...cleared, final: true }
        : { ...cleared, half: 'bottom', linescore: { ...cleared.linescore, home: [...cleared.linescore.home, 0] } }
    } else {
      next = lastInning
        ? { ...cleared, final: true }
        : {
            ...cleared,
            inning: game.inning + 1,
            half: 'top',
            linescore: { ...cleared.linescore, away: [...cleared.linescore.away, 0] },
          }
    }
  }

  return {
    game: next,
    event: { outcome, plateResult, runs, halfEnded, gameEnded: next.final },
  }
}
