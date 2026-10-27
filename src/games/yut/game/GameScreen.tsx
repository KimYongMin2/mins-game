import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { DECIDE_MS } from '../constants'
import { Board, PLAYER_COLORS } from '../field/Board'
import { Sticks } from '../field/Sticks'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer } from '../play/engine'
import type { YutMsg } from '../play/pvp'
import { type ScreenAction, type ScreenState, type YutView, createScreen, myIndex, myMove, myThrow, screenReducer, toView, viewChanged } from '../play/view'
import { nodeOf } from '../rules/board'
import { type From, movesFor } from '../rules/moves'
import { THROW_LABEL } from '../rules/throw'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그린다.

type Props =
  | { mode: 'bot'; bots: number; pieceCount: number; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<YutMsg>; members: Member[]; bots: number; pieceCount: number; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<YutMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000
/** 던진 뒤 윷가락이 흔들리는 시간 */
const SHAKE_MS = 450

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수']

type HostState = { engine: EngineState; screen: ScreenState }

function hostReducer(s: HostState, action: EngineAction): HostState {
  const engine = engineReducer(s.engine, action)
  let screen = action.type === 'tick' ? screenReducer(s.screen, { type: 'tick', now: action.now }) : s.screen
  screen = screenReducer(screen, { type: 'view', view: toView(engine) })
  return { engine, screen }
}

function guestReducer(s: ScreenState, action: ScreenAction): ScreenState {
  return screenReducer(s, action)
}

function initHost(props: Props): HostState {
  const now = performance.now()
  const me = loadNickname() ?? '나'
  let players: Player[] = []
  let pieceCount = 4
  if (props.mode === 'bot') {
    players = [{ id: 'me', name: me, kind: 'user' }, ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const }))]
    pieceCount = props.pieceCount
  } else if (props.mode === 'host') {
    players = [
      { id: props.room.myId, name: me, kind: 'user' },
      ...props.members.map((m) => ({ id: m.id, name: m.nickname, kind: 'remote' as const })),
      ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const })),
    ]
    pieceCount = props.pieceCount
  }
  const engine = createEngine({ now, seed: randomSeed(), players, pieceCount })
  return { engine, screen: screenReducer(createScreen(players[0]?.id ?? '', now), { type: 'view', view: toView(engine) }) }
}

function summaryOf(v: YutView, me: number, mode: GameSummary['mode']): GameSummary {
  const outCount = (i: number) => v.pieces[i].filter((p) => p === 'out').length
  // 우승 다음은 나간 말이 많은 순
  const order = v.players.map((_, i) => i).sort((a, b) => (a === v.winner ? -1 : b === v.winner ? 1 : outCount(b) - outCount(a)))
  return {
    mode,
    won: v.winner === me,
    standings: order.map((i) => ({ name: v.players[i].name, out: outCount(i), total: v.pieces[i].length, winner: i === v.winner })),
  }
}

function PlayerBar({ v, me }: { v: YutView; me: number }) {
  return (
    <ul className="yt-players">
      {v.players.map((p, i) => {
        const home = v.pieces[i].filter((x) => x === 'home').length
        const out = v.pieces[i].filter((x) => x === 'out').length
        return (
          <li
            key={p.id}
            className={`yt-player${v.turn === i && v.phase === 'turn' ? ' yt-player--turn' : ''}${v.left[i] ? ' yt-player--left' : ''}`}
            style={{ borderColor: v.turn === i && v.phase === 'turn' ? PLAYER_COLORS[i] : undefined }}
          >
            <span className="yt-player__dot" style={{ background: PLAYER_COLORS[i] }} />
            <span className="yt-player__name">
              {p.name}
              {i === me && ' (나)'}
            </span>
            <span className="yt-player__count" aria-label={`대기 ${home}, 나감 ${out}`}>
              대기 {home} · 나감 {out}/{v.pieces[i].length}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function GameScreen(props: Props) {
  const isGuest = props.mode === 'guest'
  const [host, hostDispatch] = useReducer(hostReducer, props, initHost)
  const [guest, guestDispatch] = useReducer(guestReducer, undefined, () =>
    createScreen(props.mode === 'guest' ? props.room.myId : '', performance.now()),
  )
  const screen = isGuest ? guest : host.screen
  const [hostGone, setHostGone] = useState(false)
  const room = props.mode === 'bot' ? null : props.room

  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      if (isGuest) guestDispatch({ type: 'tick', now: t })
      else hostDispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [isGuest])

  // 친구 대전 메시지: 방장은 친구의 던지기·옮기기를, 친구는 방장 화면을 받는다
  const engineRef = useRef(host.engine)
  useEffect(() => {
    engineRef.current = host.engine
  })
  useEffect(() => {
    if (!room) return
    const indexOf = (id: string) => engineRef.current.players.findIndex((p) => p.id === id && p.kind === 'remote')
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'view') guestDispatch({ type: 'view', view: msg.v })
      if (room.role !== 'host') return
      if (msg.t === 'throw' && indexOf(msg.from) >= 0) hostDispatch({ type: 'throw', player: indexOf(msg.from) })
      if (msg.t === 'move' && indexOf(msg.from) >= 0) hostDispatch({ type: 'move', player: indexOf(msg.from), throwIdx: msg.throwIdx, from: msg.piece })
    })
    // 방장: 나간 친구는 차례에서 뺌 / 친구: 방장이 나가면 경기를 못 이어간다
    const offMembers = room.onMembers((members) => {
      if (room.role === 'host') {
        engineRef.current.players.forEach((p, i) => {
          if (p.kind === 'remote' && !members.some((m) => m.id === p.id)) hostDispatch({ type: 'drop', player: i })
        })
      } else if (!members.some((m) => m.role === 'host')) setHostGone(true)
    })
    return () => {
      offMsg()
      offMembers()
    }
  }, [room])

  // 방장: 화면이 바뀌면 바로, 아니어도 1초마다 친구들에게 보낸다
  const sentRef = useRef<{ view: YutView | null; at: number }>({ view: null, at: 0 })
  useEffect(() => {
    if (props.mode !== 'host') return
    const view = toView(host.engine)
    const last = sentRef.current
    if (viewChanged(last.view, view) || host.engine.now - last.at >= HEARTBEAT_MS) {
      props.room.send({ t: 'view', v: view })
      sentRef.current = { view, at: host.engine.now }
    }
  }, [props, host.engine])

  const playedRef = useRef(0)
  useEffect(() => {
    for (const s of screen.sounds) {
      if (s.id <= playedRef.current) continue
      playedRef.current = s.id
      playSound(s.name)
    }
  }, [screen.sounds])

  // 끝나면 잠깐 보여준 뒤 결과로
  const done = screen.view?.phase === 'done' && screen.now >= screen.phaseUntil
  const finishRef = useRef(props.onFinish)
  const screenRef = useRef(screen)
  useEffect(() => {
    finishRef.current = props.onFinish
    screenRef.current = screen
  })
  const finished = useRef(false)
  useEffect(() => {
    const s = screenRef.current
    if (!done || finished.current || hostGone || !s.view || myIndex(s) < 0) return
    finished.current = true
    finishRef.current(summaryOf(s.view, myIndex(s), props.mode === 'bot' ? 'bot' : 'pvp'))
  }, [done, hostGone, props.mode])

  // 쌓인 결과 중 무엇을 쓸지 (내 차례에 고름). 고른 게 없어지면 첫 번째로
  const [chosen, setChosen] = useState(0)
  const v = screen.view
  const me = myIndex(screen)
  const canMoveNow = myMove(screen)
  const pick = v && chosen < v.pending.length ? chosen : 0
  const moves = v && canMoveNow ? movesFor(v.pieces, me, v.pending).filter((m) => m.throwIdx === v.pending.indexOf(v.pending[pick])) : []
  // 옮길 말은 두 번에: 말(또는 새 말)을 고르고 → 갈 칸을 눌러야 옮긴다. 고른 말이 이 결과로 못 가면 풀림
  // 판이 바뀌면(옮김·시간 초과·다음 사람) 고른 건 저절로 풀린다
  const boardKey = v ? `${v.turn}:${v.lastMove?.seq ?? 0}:${v.pending.length}` : ''
  const [picked, setPicked] = useState<{ from: From; key: string } | null>(null)
  const selected = picked && picked.key === boardKey ? picked.from : null
  const setSelected = (from: From | null) => setPicked(from === null ? null : { from, key: boardKey })
  const chosenMove = selected === null ? undefined : moves.find((m) => m.from === selected)
  const target = chosenMove ? (chosenMove.to === 'out' ? 'out' : nodeOf(chosenMove.to)) : null

  function doThrow() {
    if (!myThrow(screen)) return
    if (props.mode === 'guest') props.room.send({ t: 'throw', from: props.room.myId })
    else hostDispatch({ type: 'throw', player: me })
  }

  function doMove(from: From) {
    const m = moves.find((x) => x.from === from)
    if (!m) return
    if (props.mode === 'guest') props.room.send({ t: 'move', from: props.room.myId, throwIdx: m.throwIdx, piece: from })
    else hostDispatch({ type: 'move', player: me, throwIdx: m.throwIdx, from })
    setChosen(0)
    setSelected(null)
  }

  // PC: 스페이스바로 던지기
  const throwRef = useRef(doThrow)
  useEffect(() => {
    throwRef.current = doThrow
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) throwRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!v) return <p className="yt-tip">시작하는 중…</p>

  const myTurn = v.phase === 'turn' && v.turn === me
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const last = v.lastThrow
  const shaking = screen.now - screen.throwAt < SHAKE_MS
  const homeMove = moves.find((m) => m.from === 'home')
  const turnName = v.turn === me ? '내' : `${v.players[v.turn]?.name}`

  let tip: string
  if (v.phase === 'intro') tip = `${v.players[v.turn].name} 먼저 시작해요`
  else if (v.phase === 'done') tip = v.winner === me ? '내가 우승!' : `${v.players[v.winner ?? 0].name} 우승!`
  else if (!myTurn) tip = `${turnName} 차례…`
  else if (v.throwsLeft > 0) tip = v.pending.length > 0 ? '한 번 더 던져요!' : '윷을 던져요!'
  else if (chosenMove) tip = chosenMove.to === 'out' ? "점선 '나가기'를 누르면 나가요" : '점선 칸을 누르면 옮겨요'
  else tip = '쓸 결과를 고르고, 옮길 말을 눌러요'

  return (
    <div className="yt-game">
      <PlayerBar v={v} me={me} />

      <div className="yt-board-wrap">
        <Board
          pieces={v.pieces}
          movable={moves.flatMap((m) => (m.from === 'home' ? [] : [m.from]))}
          selected={chosenMove ? selected : null}
          target={target}
          me={me}
          lastTo={v.lastMove?.to ?? null}
          onSelect={setSelected}
          onConfirm={() => chosenMove && doMove(chosenMove.from)}
        />
      </div>

      <div className="yt-status">
        <Sticks result={last?.result ?? null} shaking={shaking} />
        <div className="yt-status__text">
          {last && (
            <strong className="yt-status__result" style={{ color: PLAYER_COLORS[last.player] }}>
              {THROW_LABEL[last.result]}!
            </strong>
          )}
          <span className={myTurn ? 'yt-status__tip yt-status__tip--mine' : 'yt-status__tip'}>{tip}</span>
        </div>
      </div>

      {myTurn && (
        <div className="yt-timer" aria-hidden>
          <div className="yt-timer__fill" style={{ transform: `scaleX(${left / DECIDE_MS})` }} />
        </div>
      )}

      {/* 쌓인 결과: 내 차례면 골라서 쓸 수 있다 */}
      {v.pending.length > 0 && (
        <div className="yt-pending" role="group" aria-label="쌓인 결과">
          {v.pending.map((t, i) => (
            <button
              key={`${t}-${i}`}
              type="button"
              className={`button button--small yt-chip${canMoveNow && i === pick ? ' yt-chip--on' : ''}`}
              disabled={!canMoveNow}
              onClick={() => setChosen(i)}
            >
              {THROW_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <div className="yt-actions">
        {myTurn && v.throwsLeft > 0 ? (
          <button
            type="button"
            className="button button--primary yt-throw"
            disabled={!myThrow(screen)}
            onPointerDown={(e) => {
              e.preventDefault()
              doThrow()
            }}
          >
            윷 던지기
          </button>
        ) : (
          <button
            type="button"
            className={`button yt-new${homeMove && selected === 'home' ? ' yt-new--on' : ''}`}
            disabled={!homeMove}
            aria-pressed={homeMove ? selected === 'home' : undefined}
            onClick={() => setSelected(selected === 'home' ? null : 'home')}
          >
            {homeMove && selected === 'home'
              ? '새 말 고름 · 점선 칸을 눌러요'
              : `새 말 올리기 ${canMoveNow && v.pending[pick] ? `(${THROW_LABEL[v.pending[pick]]})` : ''}`}
          </button>
        )}
      </div>
      <p className="yt-hint">윷·모는 한 번 더 · 도·개·걸·빽도로 잡으면 한 번 더 · 꺾이는 칸에 딱 멈추면 꺾어요 · PC는 스페이스바로 던지기</p>

      {hostGone && props.mode === 'guest' && (
        <div className="pvp-gone" role="alert">
          <strong>방장이 나갔어요</strong>
          <span>이 경기는 기록되지 않아요</span>
          <button type="button" className="button" onClick={props.onQuit}>
            나가기
          </button>
        </div>
      )}
    </div>
  )
}
