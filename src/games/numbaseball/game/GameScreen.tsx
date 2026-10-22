import { useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { DONE_MS, type Difficulty, type Length, MAX_TRIES, SOLO_MAX_TRIES, TURN_MS } from '../constants'
import { type MatchState, type MatchSummary, type Mode, type Side, createMatch, matchReducer, summarizeMatch } from '../play/matchState'
import { type NumbaseballMsg, actionOf, outbox } from '../play/pvp'
import { type Digits, isSolved, scoreText } from '../rules/numbers'
import { playSound } from '../sounds'
import { Keypad } from './Keypad'

type Props = {
  mode: Mode
  difficulty: Difficulty
  length: Length
  /** 친구 대전이면 방, 상대 이름, 방장이 정한 선공 (나 = 0) */
  pvp?: { room: Room<NumbaseballMsg>; peerName: string; first: Side }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
}

const show = (d: Digits | null, length: Length) => (d ? d.join(' ') : Array(length).fill('?').join(' '))

/** 가운데 안내: 누구 차례인지, 남은 시간 */
function TurnInfo({ state, foe }: { state: MatchState; foe: string }) {
  const { phase } = state
  const left = (until: number) => Math.ceil(Math.max(0, until - state.now) / 1000)
  const time = (until: number) => {
    const s = left(until)
    return <span className={`nb-turn__time${s <= 5 ? ' nb-turn__time--low' : ''}`}>{s}초</span>
  }
  switch (phase.kind) {
    case 'setup':
      return <span className="nb-turn nb-turn--mine">숫자 정하기{time(phase.until)}</span>
    case 'intro':
      return <span className="nb-turn">{state.mode === 'solo' ? '시작!' : state.turn === 0 ? '내가 먼저!' : `${foe} 먼저`}</span>
    case 'guessing':
      return (
        <span className={`nb-turn${state.turn === 0 ? ' nb-turn--mine' : ''}`}>
          {state.turn === 0 ? '내 차례' : `${foe} 차례`}
          {time(phase.until)}
        </span>
      )
    case 'waiting':
      return <span className="nb-turn nb-turn--mine">판정 중…</span>
    case 'result':
      return <span className="nb-turn">{state.turn === 0 ? '내 차례' : `${foe} 차례`}</span>
    case 'done': {
      const text = state.mode === 'solo' ? (phase.winner === 0 ? '성공!' : '실패') : phase.winner === 'draw' ? '무승부' : phase.winner === 0 ? '승리!' : '패배'
      return <span className={`nb-turn nb-turn--done${phase.winner === 0 ? ' nb-turn--win' : ''}`}>{text}</span>
    }
  }
}

type Column = { title: string; sub: React.ReactNode; guesses: MatchState['guesses'][0]; active: boolean }

/** 부른 숫자 한 칸 */
function GuessCell({ g, length }: { g: MatchState['guesses'][0][number] | undefined; length: Length }) {
  if (!g) return <span className="nb-cell" />
  const solved = g.score && isSolved(g.score, length)
  const out = g.score && g.score.strike + g.score.ball === 0
  return (
    <span className={`nb-cell${solved ? ' nb-cell--solved' : ''}`}>
      <span className="nb-cell__digits">{g.digits.join('')}</span>
      <span className={`nb-cell__score${out ? ' nb-cell__score--out' : ''}`}>{g.score ? scoreText(g.score, length) : '…'}</span>
    </span>
  )
}

/** 부른 기록 표. n번째로 부른 것끼리 같은 줄에 (나 | 상대) */
function GuessTable({ columns, length }: { columns: Column[]; length: Length }) {
  const rows = Math.max(...columns.map((c) => c.guesses.length))
  const boxRef = useRef<HTMLDivElement>(null)
  const total = columns.reduce((n, c) => n + c.guesses.length, 0)
  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [total])
  return (
    <div className={`nb-table nb-table--cols${columns.length}`} ref={boxRef}>
      <div className="nb-table__head">
        <span />
        {columns.map((c) => (
          <span key={c.title} className={`nb-table__title${c.active ? ' nb-table__title--active' : ''}`}>
            {c.title}
            <span className="nb-table__sub">{c.sub}</span>
          </span>
        ))}
      </div>
      <ol className="nb-table__list">
        {rows === 0 && <li className="nb-table__empty">아직 없어요</li>}
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="nb-trow">
            <span className="nb-trow__n">{i + 1}</span>
            {columns.map((c) => (
              <GuessCell key={c.title} g={c.guesses[i]} length={length} />
            ))}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function GameScreen({ mode, difficulty, length, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({ now: performance.now(), seed: randomSeed(), mode, difficulty, length, first: pvp?.first }),
  )
  // 입력 중인 숫자. 내 숫자가 정해지거나 내가 부르면(시간 초과 포함) 비워지도록 그때의 단계(stage)와 함께 둔다
  const [draft, setDraft] = useState<{ stage: string; digits: number[] }>({ stage: '', digits: [] })
  const [peerGone, setPeerGone] = useState(false)
  const done = state.phase.kind === 'done'
  const solo = mode === 'solo'

  // 친구 대전: 받은 메시지를 경기에 넣고, 상대가 나가면 알린다
  useEffect(() => {
    if (!pvp) return
    const offMsg = pvp.room.onMessage((msg) => {
      const action = actionOf(msg)
      if (action) dispatch(action)
    })
    const offPeer = pvp.room.onPeer((peer) => {
      if (!peer) setPeerGone(true)
    })
    return () => {
      offMsg()
      offPeer()
    }
  }, [pvp])

  // 친구 대전: 정함·부른 숫자·판정·공개를 보낸다 (시간 초과로 정해진 것도)
  const sentRef = useRef(state)
  useEffect(() => {
    if (!pvp) return
    for (const msg of outbox(sentRef.current, state)) pvp.room.send(msg)
    sentRef.current = state
  }, [pvp, state])

  const playedRef = useRef(0)
  useEffect(() => {
    for (const s of state.sounds) {
      if (s.id <= playedRef.current) continue
      playedRef.current = s.id
      playSound(s.name)
    }
  }, [state.sounds])

  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      dispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const stage = `${state.locked[0]}:${state.guesses[0].length}`
  const input = draft.stage === stage ? draft.digits : []
  const setInput = (digits: number[]) => setDraft({ stage, digits })

  // 끝나면 서로의 숫자를 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
  const finishRef = useRef(onFinish)
  const stateRef = useRef(state)
  useEffect(() => {
    finishRef.current = onFinish
    stateRef.current = state
  })
  useEffect(() => {
    if (!done || peerGone) return
    const timer = setTimeout(() => finishRef.current(summarizeMatch(stateRef.current)), DONE_MS)
    return () => clearTimeout(timer)
  }, [done, peerGone])

  const { phase } = state
  const me = loadNickname() ?? '나'
  const foe = pvp?.peerName ?? '봇'
  /** 조사: 봇이 / ○○님이 */
  const foeSubj = pvp ? `${foe}님이` : '봇이'
  const max = solo ? SOLO_MAX_TRIES : MAX_TRIES
  const setup = phase.kind === 'setup'
  const myTurn = phase.kind === 'guessing' && state.turn === 0
  const timerUntil = phase.kind === 'setup' || phase.kind === 'guessing' ? phase.until : null
  const left = timerUntil === null ? 0 : Math.max(0, timerUntil - state.now)
  const last = (side: Side) => state.guesses[side].at(-1)
  const flashSide = phase.kind === 'result' ? state.turn : null
  const flash = flashSide !== null ? last(flashSide) : undefined

  const submit = () => {
    dispatch(setup ? { type: 'setSecret', digits: input } : { type: 'guess', digits: input })
  }

  return (
    <div className="nb-game">
      <div className="nb-hud">
        <div className={`nb-score nb-score--me${state.turn === 0 && !done && !setup ? ' nb-score--active' : ''}`}>
          <span className="nb-score__name">{me}</span>
          <strong>
            {state.guesses[0].length}
            <small>/{max}번</small>
          </strong>
        </div>
        <TurnInfo state={state} foe={foe} />
        {!solo ? (
          <div className={`nb-score nb-score--foe${state.turn === 1 && !done && !setup ? ' nb-score--active' : ''}`}>
            <span className="nb-score__name">{foe}</span>
            <strong>
              {state.guesses[1].length}
              <small>/{max}번</small>
            </strong>
          </div>
        ) : (
          <span />
        )}
      </div>

      <div className="nb-timer" aria-hidden>
        <div className={`nb-timer__fill${state.turn === 1 && !setup ? ' nb-timer__fill--foe' : ''}`} style={{ transform: `scaleX(${left / TURN_MS})` }} />
      </div>

      {setup ? (
        <div className="nb-setup">
          {state.locked[0] ? (
            <>
              <p className="nb-setup__title">
                내 숫자 <strong>{show(state.secrets[0], length)}</strong>
              </p>
              <p className="nb-setup__wait">{foe}님이 숫자를 정하는 중…</p>
            </>
          ) : (
            <>
              <p className="nb-setup__title">{foeSubj} 맞힐 내 숫자를 정하세요</p>
              <p className="nb-setup__hint">
                서로 다른 숫자 {length}개 · 맨 앞은 0 안 됨 · {Math.ceil(TURN_MS / 1000)}초 안에 안 정하면 무작위
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={`nb-flash${flash ? ' nb-flash--on' : ''}${flash?.score && isSolved(flash.score, length) ? ' nb-flash--solved' : ''}`} aria-live="polite">
            {flash?.score ? (
              <>
                <span className="nb-flash__who">
                  {flashSide === 0 ? '나' : foe} {flash.digits.join('')}
                </span>
                <strong>{isSolved(flash.score, length) ? '정답!' : scoreText(flash.score, length)}</strong>
              </>
            ) : done ? (
              <span className="nb-flash__who">
                {solo ? '정답' : `${foe} 숫자`} <strong className="nb-flash__secret">{show(state.secrets[1], length)}</strong>
              </span>
            ) : (
              <span className="nb-flash__who">{myTurn ? '숫자를 불러 보세요' : phase.kind === 'waiting' ? '판정 중…' : solo ? '' : `${foeSubj} 생각하는 중…`}</span>
            )}
          </div>

          <GuessTable
            length={length}
            columns={[
              {
                title: '내가 부른 것',
                sub: `${solo ? '정답' : `${foe} 숫자`} ${show(state.secrets[1] && done ? state.secrets[1] : null, length)}`,
                guesses: state.guesses[0],
                active: state.turn === 0 && !done,
              },
              ...(solo
                ? []
                : [{ title: `${foeSubj} 부른 것`, sub: `내 숫자 ${show(state.secrets[0], length)}`, guesses: state.guesses[1], active: state.turn === 1 && !done }]),
            ]}
          />
        </>
      )}

      {!done && !(setup && state.locked[0]) && (
        <Keypad
          digits={input}
          length={length}
          onChange={setInput}
          onSubmit={submit}
          submitLabel={setup ? '정하기' : '부르기'}
          canSubmit={setup || myTurn}
        />
      )}

      {peerGone && !done && (
        <div className="pvp-gone" role="alert">
          <strong>{foe}님이 나갔어요</strong>
          <span>이 경기는 기록되지 않아요</span>
          <button type="button" className="button" onClick={onQuit}>
            나가기
          </button>
        </div>
      )}
    </div>
  )
}
