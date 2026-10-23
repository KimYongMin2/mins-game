import { useEffect, useReducer, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { CardFace } from '../cards/CardFace'
import { CARD_COUNT, DONE_MS, type Difficulty, PICK_MS } from '../constants'
import { type MatchState, type MatchSummary, type Side, canFlip, createMatch, matchReducer, pairsOf, summarizeMatch } from '../play/matchState'
import { type MemoryMsg, actionOf, outbox } from '../play/pvp'
import { playSound } from '../sounds'

type Props = {
  difficulty: Difficulty
  /** 친구 대전이면 방, 상대 이름, 방장이 정한 덱 시드와 선공 (나 = 0) */
  pvp?: { room: Room<MemoryMsg>; peerName: string; deckSeed: number; first: Side }
  onFinish: (summary: MatchSummary) => void
  /** 친구 대전 중 상대가 나갔을 때 '나가기' */
  onQuit?: () => void
}

/** 가운데 안내: 누구 차례인지, 남은 시간 */
function TurnInfo({ state, names }: { state: MatchState; names: readonly [string, string] }) {
  const { phase } = state
  if (phase.kind === 'intro') return <span className="mm-turn">{state.turn === 0 ? '내가 먼저!' : `${names[1]} 먼저`}</span>
  if (phase.kind === 'done') {
    const text = phase.winner === 'draw' ? '무승부' : phase.winner === 0 ? '승리!' : '패배'
    return <span className={`mm-turn mm-turn--done${phase.winner === 0 ? ' mm-turn--win' : ''}`}>{text}</span>
  }
  const mine = state.turn === 0
  const left = phase.kind === 'picking' ? Math.ceil(Math.max(0, phase.until - state.now) / 1000) : null
  return (
    <span className={`mm-turn${mine ? ' mm-turn--mine' : ''}`}>
      {mine ? '내 차례' : `${names[1]} 차례`}
      {mine && left !== null && <span className={`mm-turn__time${left <= 3 ? ' mm-turn__time--low' : ''}`}>{left}초</span>}
    </span>
  )
}

export function GameScreen({ difficulty, pvp, onFinish, onQuit }: Props) {
  const [state, dispatch] = useReducer(matchReducer, undefined, () =>
    createMatch({
      now: performance.now(),
      seed: randomSeed(),
      difficulty,
      controllers: ['user', pvp ? 'remote' : 'bot'],
      deckSeed: pvp?.deckSeed,
      first: pvp?.first,
    }),
  )
  const done = state.phase.kind === 'done'
  const [peerGone, setPeerGone] = useState(false)

  // 친구 대전: 받은 카드를 경기에 넣고, 상대가 나가면 알린다
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

  // 친구 대전: 내가 연 카드를 보낸다 (시간 초과로 열린 것도)
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

  // 끝나면 잠깐 보여준 뒤 결과로. 상태는 매 프레임 바뀌므로 ref로 읽는다
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
  const names = [loadNickname() ?? '나', pvp?.peerName ?? '봇'] as const
  const pairs = pairsOf(state)
  const myTurn = state.turn === 0 && phase.kind === 'picking'
  const left = phase.kind === 'picking' && state.turn === 0 ? Math.max(0, phase.until - state.now) : 0
  const showing = phase.kind === 'showing' ? (phase.match ? 'match' : 'miss') : null

  return (
    <div className="mm-game">
      <div className="mm-hud">
        <div className={`mm-score mm-score--me${state.turn === 0 && !done ? ' mm-score--active' : ''}`}>
          <span className="mm-score__name">{names[0]}</span>
          <strong>{pairs[0]}쌍</strong>
        </div>
        <TurnInfo state={state} names={names} />
        <div className={`mm-score mm-score--foe${state.turn === 1 && !done ? ' mm-score--active' : ''}`}>
          <span className="mm-score__name">{names[1]}</span>
          <strong>{pairs[1]}쌍</strong>
        </div>
      </div>

      <div className="mm-timer" aria-hidden>
        <div className="mm-timer__fill" style={{ transform: `scaleX(${left / PICK_MS})` }} />
      </div>

      {/* 초록 펠트 카드 테이블 위에 카드 */}
      <div className="mm-felt">
        <div className={`mm-board${myTurn ? ' mm-board--mine' : ''}`} role="grid" aria-label={`카드 ${CARD_COUNT}장`}>
          {state.cards.map((card, i) => {
            const isOpen = state.open.includes(i)
            const faceUp = isOpen || card.owner !== null
            const cls = [
              'mm-card',
              faceUp && 'mm-card--up',
              card.owner !== null && !isOpen && `mm-card--taken mm-card--by${card.owner}`,
              isOpen && showing && `mm-card--${showing}`,
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={!myTurn || !canFlip(state, i)}
                aria-label={faceUp ? undefined : `${i + 1}번 카드`}
                onPointerDown={(e) => {
                  // 터치하자마자 열리도록 (click은 손을 뗄 때라 늦다)
                  e.preventDefault()
                  dispatch({ type: 'pick', index: i })
                }}
                // 키보드(Enter·Space)로도 열 수 있게. 이미 연 카드는 무시된다
                onClick={() => dispatch({ type: 'pick', index: i })}
              >
                <span className="mm-card__inner">
                  <span className="mm-card__back" />
                  {/* 덮인 카드는 그림을 아예 그리지 않는다 (화면 읽기 프로그램에 그림 이름이 새지 않게) */}
                  <span className="mm-card__front">{faceUp && <CardFace face={card.face} />}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="mm-hint">두 장씩 열어 같은 그림이면 가져가고 한 번 더 · 한 장에 10초</p>

      {peerGone && !done && (
        <div className="pvp-gone" role="alert">
          <strong>{pvp?.peerName}님이 나갔어요</strong>
          <span>이 경기는 기록되지 않아요</span>
          <button type="button" className="button" onClick={onQuit}>
            나가기
          </button>
        </div>
      )}
    </div>
  )
}
