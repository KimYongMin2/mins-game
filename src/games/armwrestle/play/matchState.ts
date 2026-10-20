// 한 경기(3판 2선승)의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 판: 3·2·1 → 당기기(최대 15초) → 판 결과 → 다음 판. 위치(pos)가 +1이면 나(0), −1이면 상대(1)가 그 판을 이긴다.
//
// 친구 대전: 방장 기기가 심판이다. 친구 쪽(follow)은 자기 입력을 세기만 하고(위치는 안 바꿈),
// 방장이 보낸 'sync'로 위치·판·시간을 따라간다. 양쪽 모두 자기 자신이 왼쪽(0)이다.
import { createRng } from '../../../shared/random'
import { botGrade, botTapGap } from '../bot/armBot'
import {
  COUNTDOWN_MS,
  DONE_MS,
  type Difficulty,
  type Event,
  PASS_MS,
  ROUND_END_MS,
  ROUND_MS,
  TAP_PUSH,
  WINS_NEEDED,
} from '../constants'
import { type Grade, gradeAt, pushOf } from '../rules/timing'

/** 당기는 주체. remote = 방에 들어온 친구 */
export type Controller = 'user' | 'bot' | 'remote'

export type Side = 0 | 1
export type Pair<T> = readonly [T, T]

export type SoundName =
  | 'count'
  | 'go'
  | 'tap'
  | Grade
  | 'roundWin'
  | 'roundLose'
  | 'win'
  | 'lose'

export type PhaseKind = 'countdown' | 'pull' | 'roundEnd' | 'done'

export type Phase =
  /** shown: 지금 보이는 숫자 (3·2·1), 바뀔 때마다 삑 */
  | { kind: 'countdown'; until: number; shown: number }
  | { kind: 'pull'; start: number; until: number }
  /** winner null = 정확히 가운데라 그 판 다시 */
  | { kind: 'roundEnd'; winner: Side | null; until: number }
  | { kind: 'done'; winner: Side; until: number }

export type MatchState = {
  now: number
  seed: number
  event: Event
  difficulty: Difficulty
  controllers: Pair<Controller>
  /** 친구 대전의 친구 쪽: 위치·판을 방장에게서 받는다 */
  follow: boolean
  /** 몇 번째 판 (다시 하는 판 포함) */
  round: number
  wins: Pair<number>
  pos: number
  /** 화면에 그리는 위치. 친구 쪽은 0.1초마다 오는 위치를 부드럽게 따라간다 */
  shownPos: number
  phase: Phase
  /** 경기 전체 누른 횟수 (친구 것은 친구가 보낸 총 횟수) */
  taps: Pair<number>
  /** 타이밍전: 이번 판 과녁 위치를 정하는 시드 (방장·친구가 각자 정함) */
  zoneSeed: number
  /** 타이밍전: 이번 판에서 마지막으로 누른 지나감 번호 (−1 = 아직) */
  pressed: Pair<number>
  /** 타이밍전: 마지막 판정 (화면에 잠깐 띄움) */
  lastGrade: Pair<{ grade: Grade; at: number } | null>
  /** 타이밍전 완벽 횟수 (결과 화면용) */
  perfects: Pair<number>
  botNextAt: number
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  /** 연타전: 내가 누름 */
  | { type: 'tap' }
  /** 타이밍전: 내가 누름. at = 입력 시각 (event.timeStamp) */
  | { type: 'press'; at: number }
  /** 방장: 친구가 지금까지 누른 총 횟수 */
  | { type: 'remoteTaps'; total: number }
  /** 방장: 친구의 타이밍 판정 */
  | { type: 'remotePress'; pass: number; grade: Grade }
  /** 친구: 방장이 보낸 상태 (내 쪽 기준으로 바꾼 것) */
  | { type: 'sync'; sync: Sync }

/** 방장 → 친구 상태. 이미 받는 쪽 기준(내가 0)으로 바꾼 값 */
export type Sync = {
  round: number
  wins: Pair<number>
  pos: number
  phase: PhaseKind
  /** 지금 단계가 끝나기까지 남은 시간 */
  left: number
  winner: Side | null
  /** 상대(방장)의 마지막 타이밍 판정 */
  foeGrade: { pass: number; grade: Grade } | null
}

const COUNT_STEP_MS = COUNTDOWN_MS / 3

function withSounds(state: MatchState, ...names: SoundName[]): MatchState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-12), soundSeq: seq }
}

function countdown(state: MatchState): MatchState {
  return withSounds({ ...state, phase: { kind: 'countdown', until: state.now + COUNTDOWN_MS, shown: 3 } }, 'count')
}

export function createMatch(opts: {
  now: number
  seed: number
  event: Event
  difficulty: Difficulty
  /** 기본은 나 vs 봇 */
  controllers?: Pair<Controller>
  follow?: boolean
}): MatchState {
  return countdown({
    now: opts.now,
    seed: opts.seed,
    event: opts.event,
    difficulty: opts.difficulty,
    controllers: opts.controllers ?? ['user', 'bot'],
    follow: opts.follow ?? false,
    round: 1,
    wins: [0, 0],
    pos: 0,
    shownPos: 0,
    phase: { kind: 'countdown', until: 0, shown: 3 },
    taps: [0, 0],
    zoneSeed: 0,
    pressed: [-1, -1],
    lastGrade: [null, null],
    perfects: [0, 0],
    botNextAt: 0,
    sounds: [],
    soundSeq: 0,
  })
}

const set = <T,>(pair: Pair<T>, side: Side, value: T): Pair<T> => (side === 0 ? [value, pair[1]] : [pair[0], value])

/** 위치를 옮기고, 끝까지 넘어가면 판을 끝낸다. side 쪽으로 amount만큼 */
function push(state: MatchState, side: Side, amount: number): MatchState {
  if (state.follow || state.phase.kind !== 'pull' || amount <= 0) return state
  const pos = Math.max(-1, Math.min(1, state.pos + (side === 0 ? amount : -amount)))
  const next = { ...state, pos }
  if (pos >= 1) return endRound(next, 0)
  if (pos <= -1) return endRound(next, 1)
  return next
}

function endRound(state: MatchState, winner: Side | null): MatchState {
  const wins = winner === null ? state.wins : set(state.wins, winner, state.wins[winner] + 1)
  const userSide = state.controllers.indexOf('user')
  return withSounds(
    { ...state, wins, phase: { kind: 'roundEnd', winner, until: state.now + ROUND_END_MS } },
    winner === null ? 'miss' : winner === userSide ? 'roundWin' : 'roundLose',
  )
}

function afterRound(state: MatchState): MatchState {
  const champ = state.wins.findIndex((w) => w >= WINS_NEEDED)
  if (champ >= 0) {
    const winner = champ as Side
    const userSide = state.controllers.indexOf('user')
    return withSounds({ ...state, phase: { kind: 'done', winner, until: state.now + DONE_MS } }, winner === userSide ? 'win' : 'lose')
  }
  return countdown({ ...state, round: state.round + 1, pos: 0 })
}

/** 이번 판 과녁 시드를 새로 뽑는다 */
function newZones(state: MatchState): MatchState {
  const rng = createRng(state.seed)
  const zoneSeed = Math.floor(rng.next() * 2 ** 32)
  return { ...state, seed: rng.seed(), zoneSeed }
}

function startPull(state: MatchState): MatchState {
  return withSounds(
    {
      ...newZones(state),
      pressed: [-1, -1],
      lastGrade: [null, null],
      botNextAt: state.now + 250,
      phase: { kind: 'pull', start: state.now, until: state.now + ROUND_MS },
    },
    'go',
  )
}

/** 봇: 연타전은 정해진 간격으로 누르고, 타이밍전은 지나갈 때마다 가운데쯤 한 번 */
function botAct(state: MatchState): MatchState {
  const { phase } = state
  if (phase.kind !== 'pull') return state
  let s = state
  state.controllers.forEach((c, i) => {
    if (c !== 'bot' || s.phase.kind !== 'pull') return
    const side = i as Side
    const rng = createRng(s.seed)
    if (s.event === 'mash') {
      while (s.phase.kind === 'pull' && s.now >= s.botNextAt) {
        const at = s.botNextAt
        s = push({ ...s, taps: set(s.taps, side, s.taps[side] + 1), botNextAt: at + botTapGap(rng, s.difficulty) }, side, TAP_PUSH)
      }
    } else {
      const pass = Math.floor((s.now - phase.start - PASS_MS / 2) / PASS_MS)
      if (pass > s.pressed[side]) {
        const grade = botGrade(rng, s.difficulty)
        s = applyGrade(s, side, pass, grade)
      }
    }
    s = { ...s, seed: rng.seed() }
  })
  return s
}

function applyGrade(state: MatchState, side: Side, pass: number, grade: Grade): MatchState {
  const next: MatchState = {
    ...state,
    pressed: set(state.pressed, side, pass),
    lastGrade: set(state.lastGrade, side, { grade, at: state.now }),
    perfects: grade === 'perfect' ? set(state.perfects, side, state.perfects[side] + 1) : state.perfects,
  }
  const userSide = state.controllers.indexOf('user')
  return push(side === userSide ? withSounds(next, grade) : next, side, pushOf(grade))
}

function tick(state: MatchState): MatchState {
  if (state.follow) {
    const shownPos = state.shownPos + (state.pos - state.shownPos) * 0.3
    return { ...state, shownPos: Math.abs(state.pos - shownPos) < 0.002 ? state.pos : shownPos }
  }
  const next = advance(state)
  return next.shownPos === next.pos ? next : { ...next, shownPos: next.pos }
}

function advance(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'countdown': {
      if (now >= phase.until) return startPull(state)
      const shown = Math.ceil((phase.until - now) / COUNT_STEP_MS)
      return shown < phase.shown ? withSounds({ ...state, phase: { ...phase, shown } }, 'count') : state
    }
    case 'pull': {
      const s = botAct(state)
      if (s.phase.kind === 'pull' && now >= s.phase.until) return endRound(s, s.pos > 0 ? 0 : s.pos < 0 ? 1 : null)
      return s
    }
    case 'roundEnd':
      return now >= phase.until ? afterRound(state) : state
    case 'done':
      return state
  }
}

function tap(state: MatchState): MatchState {
  if (state.event !== 'mash' || state.phase.kind !== 'pull') return state
  const next = withSounds({ ...state, taps: set(state.taps, 0, state.taps[0] + 1) }, 'tap')
  return push(next, 0, TAP_PUSH)
}

function press(state: MatchState, at: number): MatchState {
  const { phase } = state
  if (state.event !== 'timing' || phase.kind !== 'pull') return state
  const { pass, grade } = gradeAt(at - phase.start, state.zoneSeed)
  if (pass <= state.pressed[0]) return state
  return applyGrade(state, 0, pass, grade)
}

function remoteTaps(state: MatchState, total: number): MatchState {
  const added = total - state.taps[1]
  if (added <= 0 || state.controllers[1] !== 'remote') return state
  const next = { ...state, taps: set(state.taps, 1, total) }
  // 판 사이에 누른 것은 세기만 한다
  return push(next, 1, added * TAP_PUSH)
}

function remotePress(state: MatchState, pass: number, grade: Grade): MatchState {
  if (state.controllers[1] !== 'remote' || state.phase.kind !== 'pull' || pass <= state.pressed[1]) return state
  return applyGrade(state, 1, pass, grade)
}

/** 친구: 방장 상태를 받아 따라간다. 단계가 바뀌면 그에 맞는 소리 */
function sync(state: MatchState, s: Sync): MatchState {
  if (!state.follow || state.phase.kind === 'done') return state
  const { now } = state
  const prev = state.phase
  const changed = prev.kind !== s.phase || state.round !== s.round
  let phase: Phase
  switch (s.phase) {
    case 'countdown': {
      const shown = Math.max(1, Math.ceil(s.left / COUNT_STEP_MS))
      phase = { kind: 'countdown', until: now + s.left, shown }
      break
    }
    case 'pull': {
      const until = now + s.left
      // 막대 위치를 방장과 맞추려고 시작 시각을 남은 시간에서 거꾸로 구한다 (판 중간엔 처음 값 유지)
      const start = prev.kind === 'pull' && !changed ? prev.start : until - ROUND_MS
      phase = { kind: 'pull', start, until }
      break
    }
    case 'roundEnd':
      phase = { kind: 'roundEnd', winner: s.winner, until: now + s.left }
      break
    case 'done':
      phase = { kind: 'done', winner: s.winner ?? 0, until: now + s.left }
      break
  }
  let next: MatchState = { ...state, round: s.round, wins: s.wins, pos: s.pos, phase }
  if (s.foeGrade && s.foeGrade.pass > state.pressed[1]) {
    next = { ...next, pressed: set(next.pressed, 1, s.foeGrade.pass), lastGrade: set(next.lastGrade, 1, { grade: s.foeGrade.grade, at: now }) }
  }
  if (changed && s.phase === 'pull') next = { ...newZones(next), pressed: [-1, -1], lastGrade: [null, null] }
  if (!changed) {
    if (phase.kind === 'countdown' && prev.kind === 'countdown' && phase.shown < prev.shown) return withSounds(next, 'count')
    return next
  }
  switch (s.phase) {
    case 'countdown':
      return withSounds(next, 'count')
    case 'pull':
      return withSounds(next, 'go')
    case 'roundEnd':
      return withSounds(next, s.winner === null ? 'miss' : s.winner === 0 ? 'roundWin' : 'roundLose')
    case 'done':
      return withSounds(next, s.winner === 0 ? 'win' : 'lose')
  }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'tap':
      return tap(state)
    case 'press':
      return press(state, action.at)
    case 'remoteTaps':
      return remoteTaps(state, action.total)
    case 'remotePress':
      return remotePress(state, action.pass, action.grade)
    case 'sync':
      return sync(state, action.sync)
  }
}

/** 지금 단계가 끝나기까지 남은 시간 */
export function phaseLeft(state: MatchState): number {
  return Math.max(0, state.phase.until - state.now)
}

export type MatchSummary = {
  /** 봇 대전 / 친구 대전 (기록을 따로 센다) */
  mode: 'bot' | 'pvp'
  event: Event
  difficulty: Difficulty
  outcome: 'win' | 'lose'
  /** 이긴 판 (나, 상대) */
  wins: Pair<number>
  /** 내가 누른 횟수 (연타전) */
  taps: number
  /** 내 완벽 횟수 (타이밍전) */
  perfects: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const me = state.controllers.indexOf('user') as Side
  const other = (1 - me) as Side
  return {
    mode: state.controllers.includes('remote') ? 'pvp' : 'bot',
    event: state.event,
    difficulty: state.difficulty,
    outcome: state.phase.winner === me ? 'win' : 'lose',
    wins: [state.wins[me], state.wins[other]],
    taps: state.taps[me],
    perfects: state.perfects[me],
  }
}
