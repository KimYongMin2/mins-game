import { useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { DONE_MS, type Difficulty, PICK_MS, SIZE, TURN_MS } from '../constants'
import { type Card, type MatchState, type MatchSummary, type Mode, type Side, createMatch, matchReducer, stoneOf, summarizeMatch } from '../play/matchState'
import { type OmokMsg, actionOf, outbox } from '../play/pvp'
import { BLACK, CENTER, EMPTY, forbiddenKind, xyOf } from '../rules/renju'
import { playSound } from '../sounds'
import { Board } from './Board'

type Props = {
  mode: Mode
  difficulty: Difficulty
  /** 친구 대전이면 방, 상대 이름, 방장이 정한 카드 고를 쪽(나 = 0)과 흑 카드 */
  pvp?: { room: Room<OmokMsg>; peerName: string; picker: Side; blackCard: Card }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
}

const stoneName = (state: MatchState, side: Side) => (stoneOf(state, side) === BLACK ? '흑' : '백')

/** 가운데 안내: 누구 차례인지, 남은 시간 */
function TurnInfo({ state, foe }: { state: MatchState; foe: string }) {
  const { phase } = state
  const time = (until: number) => {
    const s = Math.ceil(Math.max(0, until - state.now) / 1000)
    return <span className={`om-turn__time${s <= 5 ? ' om-turn__time--low' : ''}`}>{s}초</span>
  }
  switch (phase.kind) {
    case 'pick':
      return (
        <span className={`om-turn${state.picker === 0 ? ' om-turn--mine' : ''}`}>
          흑·백 정하기{time(phase.until)}
        </span>
      )
    case 'reveal':
      return <span className="om-turn">{state.black === 0 ? '내가 흑, 먼저!' : `${foe} 흑, 먼저`}</span>
    case 'playing':
      return (
        <span className={`om-turn${state.turn === 0 ? ' om-turn--mine' : ''}`}>
          {state.turn === 0 ? '내 차례' : `${foe} 차례`}
          {time(phase.until)}
        </span>
      )
    case 'done': {
      const text = phase.winner === 'draw' ? '무승부' : phase.winner === 0 ? '승리!' : '패배'
      return <span className={`om-turn om-turn--done${phase.winner === 0 ? ' om-turn--win' : ''}`}>{text}</span>
    }
  }
}

/** 흑·백 카드 두 장. 고르기 전엔 뒷면 */
function Cards({ state, foe, onPick }: { state: MatchState; foe: string; onPick: (card: Card) => void }) {
  const mine = state.picker === 0
  const open = state.picked !== null
  const owner = (card: Card): Side => (card === state.picked ? state.picker : ((1 - state.picker) as Side))
  return (
    <div className="om-cards">
      <p className="om-cards__title">
        {open ? '흑이 먼저 둬요' : mine ? '카드를 한 장 고르세요' : `${foe}님이 카드를 고르는 중…`}
      </p>
      <div className="om-cards__row">
        {([0, 1] as const).map((card) => {
          const black = card === state.blackCard
          return (
            <button
              key={card}
              type="button"
              className={`om-card${open ? ' om-card--open' : ''}${open && card === state.picked ? ' om-card--picked' : ''}`}
              disabled={open || !mine}
              onPointerDown={() => onPick(card)}
              aria-label={open ? `${black ? '흑' : '백'} 카드` : `${card + 1}번 카드`}
            >
              {open ? (
                <>
                  <span className={`om-card__stone om-card__stone--${black ? 'black' : 'white'}`} />
                  <strong>{black ? '흑' : '백'}</strong>
                  <span className="om-card__owner">{owner(card) === 0 ? '나' : foe}</span>
                </>
              ) : (
                <span className="om-card__back">?</span>
              )}
            </button>
          )
        })}
      </div>
      {!open && <p className="om-cards__hint">흑 한 장, 백 한 장 · {PICK_MS / 1000}초 안에 안 고르면 무작위</p>}
    </div>
  )
}

export function GameScreen({ mode, difficulty, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({ now: performance.now(), seed: randomSeed(), mode, difficulty, picker: pvp?.picker, blackCard: pvp?.blackCard }),
  )
  const [peerGone, setPeerGone] = useState(false)
  /** 금수 자리를 눌렀을 때 안내 (그 판 상태일 때만 보여줌) */
  const [notice, setNotice] = useState<{ moves: number; text: string } | null>(null)
  const done = state.phase.kind === 'done'

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

  // 친구 대전: 고른 카드·둔 자리를 보낸다 (시간 초과로 정해진 것도)
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

  // 끝나면 다섯 줄을 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
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
  const started = state.black !== null && phase.kind !== 'pick' && phase.kind !== 'reveal'
  const myTurn = phase.kind === 'playing' && state.turn === 0
  const myStone = state.black === null ? BLACK : stoneOf(state, 0)
  const canPlace = myTurn && state.selected !== null

  function point(pos: number) {
    if (!started || done) return
    if (state.board[pos] !== EMPTY) return
    const kind = myStone === BLACK ? forbiddenKind(state.board, pos) : null
    if (kind) {
      setNotice({ moves: state.moves.length, text: `${kind} 자리라 흑은 둘 수 없어요` })
      return
    }
    setNotice(null)
    dispatch({ type: 'select', pos })
  }
  const placeStone = () => {
    if (canPlace) dispatch({ type: 'place', pos: state.selected! })
  }

  // 키보드: 방향키로 자리 옮기기, Enter·스페이스로 착수. 최신 값으로 부르도록 ref에 담는다
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !started || done) return
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
      if (step) {
        const [x, y] = xyOf(state.selected ?? state.moves.at(-1) ?? CENTER)
        // 막힌 칸은 건너뛰며 그 방향으로 둘 수 있는 칸까지
        for (let k = 1; k < SIZE; k++) {
          const nx = x + step[0] * k
          const ny = y + step[1] * k
          if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) break
          const pos = ny * SIZE + nx
          if (state.board[pos] === EMPTY && !(myStone === BLACK && forbiddenKind(state.board, pos))) {
            dispatch({ type: 'select', pos })
            break
          }
        }
      } else if (e.key === 'Enter' || e.key === ' ') placeStone()
      else return
      e.preventDefault()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const me = loadNickname() ?? '나'
  const foe = pvp?.peerName ?? '봇'
  const timerUntil = phase.kind === 'pick' || phase.kind === 'playing' ? phase.until : null
  const timerTotal = phase.kind === 'pick' ? PICK_MS : TURN_MS
  const left = timerUntil === null ? 0 : Math.max(0, timerUntil - state.now)
  const foeTimer = phase.kind === 'pick' ? state.picker === 1 : state.turn === 1
  const shownNotice = notice && notice.moves === state.moves.length ? notice.text : null

  const score = (side: Side, name: string) => (
    <div className={`om-score om-score--${side === 0 ? 'me' : 'foe'}${state.turn === side && started && !done ? ' om-score--active' : ''}`}>
      <span className="om-score__name">{name}</span>
      {state.black !== null ? (
        <span className="om-score__stone">
          <span className={`om-dot om-dot--${stoneOf(state, side) === BLACK ? 'black' : 'white'}`} />
          {stoneName(state, side)}
        </span>
      ) : (
        <span className="om-score__stone">?</span>
      )}
    </div>
  )

  return (
    <div className="om-game">
      <div className="om-hud">
        {score(0, me)}
        <TurnInfo state={state} foe={foe} />
        {score(1, foe)}
      </div>

      <div className="om-timer" aria-hidden>
        <div className={`om-timer__fill${foeTimer ? ' om-timer__fill--foe' : ''}`} style={{ transform: `scaleX(${left / timerTotal})` }} />
      </div>

      {started ? (
        <>
          <Board
            board={state.board}
            last={state.moves.at(-1) ?? null}
            selected={state.selected}
            myStone={myStone}
            showForbidden={myStone === BLACK && !done}
            line={phase.kind === 'done' ? phase.line : []}
            onPoint={point}
          />
          {!done && (
            <div className="om-controls">
              <p className={`om-hint${shownNotice ? ' om-hint--warn' : ''}`} aria-live="polite">
                {shownNotice ??
                  (myTurn
                    ? state.selected === null
                      ? '둘 자리를 누르세요'
                      : '여기 둘까요? 착수하기를 누르세요'
                    : `${foe} 생각하는 중… 미리 골라 둘 수 있어요`)}
                {myStone === BLACK && !shownNotice && <span> · ✕는 흑 금수</span>}
              </p>
              <button type="button" className="button button--primary om-place" disabled={!canPlace} onClick={placeStone}>
                착수하기
              </button>
            </div>
          )}
        </>
      ) : (
        <Cards state={state} foe={foe} onPick={(card) => dispatch({ type: 'pick', card })} />
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
