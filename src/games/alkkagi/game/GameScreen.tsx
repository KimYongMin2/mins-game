import { useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { DONE_MS, type Difficulty, MAX_SPEED, PICK_MS, STONES, TURN_MS } from '../constants'
import { type Card, type MatchState, type MatchSummary, type Mode, type Side, createMatch, matchReducer, summarizeMatch } from '../play/matchState'
import { type AlkkagiMsg, actionOf, outbox } from '../play/pvp'
import { FRAME_MS, type Frame, remaining } from '../rules/physics'
import { playSound } from '../sounds'
import { Board } from './Board'

type Props = {
  mode: Mode
  difficulty: Difficulty
  /** 친구 대전이면 방, 상대 이름, 방장이 정한 카드 고를 쪽(나 = 0)과 흑 카드 */
  pvp?: { room: Room<AlkkagiMsg>; peerName: string; picker: Side; blackCard: Card }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
}

/** 굴러가는 중 '한 번 더'를 보여줄지: 상대 돌이 실제로 떨어진 뒤부터 (미리 알려주지 않게) */
function showAgain(state: MatchState): boolean {
  const { phase } = state
  if (phase.kind !== 'rolling' || phase.outcome.kind !== 'again') return false
  const lastFall = Math.max(0, ...phase.result.events.filter((e) => e.kind === 'fall').map((e) => e.t))
  return (state.now - phase.start) / 1000 >= lastFall + 0.2
}

/** 가운데 안내: 누구 차례인지, 남은 시간 */
function TurnInfo({ state, foe }: { state: MatchState; foe: string }) {
  const { phase } = state
  const time = (until: number) => {
    const s = Math.ceil(Math.max(0, until - state.now) / 1000)
    return <span className={`ak-turn__time${s <= 5 ? ' ak-turn__time--low' : ''}`}>{s}초</span>
  }
  switch (phase.kind) {
    case 'pick':
      return (
        <span className={`ak-turn${state.picker === 0 ? ' ak-turn--mine' : ''}`}>
          흑·백 정하기{time(phase.until)}
        </span>
      )
    case 'reveal':
      return <span className="ak-turn">{state.black === 0 ? '내가 흑, 먼저!' : `${foe} 흑, 먼저`}</span>
    case 'aiming':
      return (
        <span className={`ak-turn${state.turn === 0 ? ' ak-turn--mine' : ''}`}>
          {state.turn === 0 ? '내 차례' : `${foe} 차례`}
          {time(phase.until)}
        </span>
      )
    case 'rolling':
      return (
        <span className={`ak-turn${phase.shooter === 0 ? ' ak-turn--mine' : ''}`}>
          {showAgain(state) ? '한 번 더!' : phase.shooter === 0 ? '내 차례' : `${foe} 차례`}
        </span>
      )
    case 'done': {
      const text = phase.winner === 'draw' ? '무승부' : phase.winner === 0 ? '승리!' : '패배'
      return <span className={`ak-turn ak-turn--done${phase.winner === 0 ? ' ak-turn--win' : ''}`}>{text}</span>
    }
  }
}

/** 흑·백 카드 두 장. 고르기 전엔 뒷면 */
function Cards({ state, foe, onPick }: { state: MatchState; foe: string; onPick: (card: Card) => void }) {
  const mine = state.picker === 0
  const open = state.picked !== null
  const owner = (card: Card): Side => (card === state.picked ? state.picker : ((1 - state.picker) as Side))
  return (
    <div className="ak-cards">
      <p className="ak-cards__title">{open ? '흑이 먼저 튕겨요' : mine ? '카드를 한 장 고르세요' : `${foe}님이 카드를 고르는 중…`}</p>
      <div className="ak-cards__row">
        {([0, 1] as const).map((card) => {
          const black = card === state.blackCard
          return (
            <button
              key={card}
              type="button"
              className={`ak-card${open ? ' ak-card--open' : ''}${open && card === state.picked ? ' ak-card--picked' : ''}`}
              disabled={open || !mine}
              onPointerDown={() => onPick(card)}
              aria-label={open ? `${black ? '흑' : '백'} 카드` : `${card + 1}번 카드`}
            >
              {open ? (
                <>
                  <span className={`ak-card__stone ak-card__stone--${black ? 'black' : 'white'}`} />
                  <strong>{black ? '흑' : '백'}</strong>
                  <span className="ak-card__owner">{owner(card) === 0 ? '나' : foe}</span>
                </>
              ) : (
                <span className="ak-card__back">?</span>
              )}
            </button>
          )
        })}
      </div>
      {!open && <p className="ak-cards__hint">흑 한 장, 백 한 장 · {PICK_MS / 1000}초 안에 안 고르면 무작위</p>}
    </div>
  )
}

/** 지금 그릴 돌 자리: 굴러가는 중이면 시간에 맞는 프레임 */
function frameOf(state: MatchState): Frame {
  const { phase } = state
  if (phase.kind !== 'rolling') return state.stones
  const { frames } = phase.result
  const i = Math.min(frames.length - 1, Math.floor((state.now - phase.start) / FRAME_MS))
  return frames[Math.max(0, i)]
}

export function GameScreen({ mode, difficulty, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({ now: performance.now(), seed: randomSeed(), mode, difficulty, picker: pvp?.picker, blackCard: pvp?.blackCard }),
  )
  const [peerGone, setPeerGone] = useState(false)
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

  // 친구 대전: 고른 카드·튕긴 것과 결과를 보낸다 (시간 초과로 정해진 것도)
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

  // 끝나면 판을 잠깐 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
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
  const myTurn = phase.kind === 'aiming' && state.turn === 0
  const me = loadNickname() ?? '나'
  const foe = pvp?.peerName ?? '봇'
  const frame = frameOf(state)
  const timerUntil = phase.kind === 'pick' || phase.kind === 'aiming' ? phase.until : null
  const timerTotal = phase.kind === 'pick' ? PICK_MS : TURN_MS
  const left = timerUntil === null ? 0 : Math.max(0, timerUntil - state.now)
  const foeTimer = phase.kind === 'pick' ? state.picker === 1 : state.turn === 1

  const score = (side: Side, name: string) => {
    const n = remaining(frame.map((f, i) => ({ ...f, side: state.stones[i].side })), side)
    const color = state.black === null ? null : state.black === side ? 'black' : 'white'
    const active = started && !done && (phase.kind === 'rolling' ? phase.shooter : state.turn) === side
    return (
      <div className={`ak-score ak-score--${side === 0 ? 'me' : 'foe'}${active ? ' ak-score--active' : ''}`}>
        <span className="ak-score__name">{name}</span>
        <span className="ak-score__stones" aria-label={`남은 돌 ${n}개`}>
          {Array.from({ length: STONES }, (_, i) => (
            <span key={i} className={`ak-dot ak-dot--${color ?? 'none'}${i < n ? '' : ' ak-dot--gone'}`} />
          ))}
        </span>
      </div>
    )
  }

  return (
    <div className="ak-game">
      <div className="ak-hud">
        {score(0, me)}
        <TurnInfo state={state} foe={foe} />
        {score(1, foe)}
      </div>

      <div className="ak-timer" aria-hidden>
        <div className={`ak-timer__fill${foeTimer ? ' ak-timer__fill--foe' : ''}`} style={{ transform: `scaleX(${left / timerTotal})` }} />
      </div>

      {started ? (
        <>
          <Board
            frame={frame}
            sides={state.stones.map((s) => s.side)}
            black={state.black!}
            canShoot={myTurn}
            onShoot={(index, dx, dy, power) => dispatch({ type: 'shoot', index, vx: dx * power * MAX_SPEED, vy: dy * power * MAX_SPEED })}
          />
          {!done && (
            <p className="ak-hint" aria-live="polite">
              {myTurn
                ? '내 돌을 누른 채 뒤로 당겼다 놓으면 튕겨요 · 누른 곳으로 되돌리면 취소'
                : phase.kind === 'aiming'
                  ? `${foe} 조준하는 중…`
                  : showAgain(state)
                    ? '떨어뜨리고 내 돌이 남아서 한 번 더!'
                    : ''}
            </p>
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
