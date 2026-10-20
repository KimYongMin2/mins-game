import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { Table } from '../field/Table'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer, neighborsOf } from '../play/engine'
import type { BombMsg } from '../play/pvp'
import { type BombView, type ScreenState, createScreen, myIndex, screenReducer, toView, viewChanged } from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그린다.

type Props =
  | { mode: 'bot'; bots: number; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<BombMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<BombMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수', '봇 지수', '봇 현우']

type HostState = { engine: EngineState; screen: ScreenState }

function hostReducer(s: HostState, action: EngineAction): HostState {
  const engine = engineReducer(s.engine, action)
  let screen = screenReducer(s.screen, { type: 'view', view: toView(engine) })
  if (action.type === 'tick') screen = screenReducer(screen, { type: 'tick', now: action.now })
  return { engine, screen }
}

function guestReducer(s: ScreenState, action: { type: 'view'; view: BombView } | { type: 'tick'; now: number }): ScreenState {
  return screenReducer(s, action)
}

function initHost(props: Props): HostState {
  const now = performance.now()
  const me = loadNickname() ?? '나'
  let players: Player[]
  if (props.mode === 'bot') {
    players = [{ id: 'me', name: me, kind: 'user' }, ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const }))]
  } else if (props.mode === 'host') {
    players = [{ id: props.room.myId, name: me, kind: 'user' }, ...props.members.map((m) => ({ id: m.id, name: m.nickname, kind: 'remote' as const }))]
  } else {
    players = []
  }
  const engine = createEngine({ now, seed: randomSeed(), players })
  const myId = players[0]?.id ?? ''
  return { engine, screen: screenReducer(createScreen(myId, now), { type: 'view', view: toView(engine) }) }
}

function summaryOf(screen: ScreenState, mode: GameSummary['mode'], passes: number): GameSummary {
  const v = screen.view!
  const me = myIndex(screen)
  return { mode, rank: v.ranking.indexOf(me) + 1, names: v.ranking.map((i) => v.players[i].name), passes }
}

function Banner({ screen }: { screen: ScreenState }) {
  const v = screen.view
  if (!v) return null
  const me = myIndex(screen)
  if (v.phase === 'countdown') {
    const n = Math.max(1, Math.ceil((screen.phaseUntil - screen.now) / 800))
    return (
      <div className="bm-banner">
        <strong>{n}</strong>
        <span>{v.round}판 · {v.alive.filter(Boolean).length}명</span>
      </div>
    )
  }
  if (v.phase === 'boom' && v.victim !== null) {
    return (
      <div className="bm-banner bm-banner--boom">
        <strong>{v.victim === me ? '내가 탈락!' : `${v.players[v.victim].name} 탈락!`}</strong>
      </div>
    )
  }
  if (v.phase === 'done') {
    const won = v.ranking[0] === me
    return (
      <div className="bm-banner">
        <strong className={won ? 'bm-banner__win' : ''}>{won ? '내가 살아남았다!' : `${v.players[v.ranking[0]].name} 우승!`}</strong>
        <span>결과 화면으로 넘어가요…</span>
      </div>
    )
  }
  if (me >= 0 && !v.alive[me]) return <p className="bm-tip">탈락했어요. 끝까지 구경해요</p>
  if (v.holder === me && !screen.flight) return <p className="bm-tip bm-tip--hot">폭탄을 들었어요! 옆 사람에게 던져요</p>
  return <p className="bm-tip">째깍째깍… 언제 터질지 몰라요</p>
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

  // 매 프레임: 방장은 심판을, 친구는 화면 시계를 돌린다
  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      if (isGuest) guestDispatch({ type: 'tick', now: t })
      else hostDispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [isGuest])

  // 친구 대전 메시지: 방장은 친구가 던진 것을, 친구는 방장 화면을 받는다
  const engineRef = useRef(host.engine)
  useEffect(() => {
    engineRef.current = host.engine
  })
  useEffect(() => {
    if (!room) return
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'view') guestDispatch({ type: 'view', view: msg.v })
      if (room.role === 'host' && msg.t === 'pass') {
        const players = engineRef.current.players
        const from = players.findIndex((p) => p.id === msg.from && p.kind === 'remote')
        const to = players.findIndex((p) => p.id === msg.to)
        if (from >= 0 && to >= 0) hostDispatch({ type: 'pass', from, to })
      }
    })
    // 방장: 나간 친구는 탈락 / 친구: 방장이 나가면 경기를 못 이어간다
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
  const sentRef = useRef<{ view: BombView | null; at: number }>({ view: null, at: 0 })
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
  // 친구: 내가 던진 횟수는 직접 센다 (심판은 방장 기기에 있음)
  const guestPasses = useRef(0)
  useEffect(() => {
    if (!done || finished.current || hostGone) return
    const s = screenRef.current
    if (myIndex(s) < 0) return
    finished.current = true
    const passes = isGuest ? guestPasses.current : engineRef.current.passes[myIndex(s)]
    finishRef.current(summaryOf(s, props.mode === 'bot' ? 'bot' : 'pvp', passes))
  }, [done, hostGone, isGuest, props.mode])

  function pick(to: number) {
    const v = screen.view
    const me = myIndex(screen)
    if (!v || me < 0) return
    if (props.mode === 'guest') {
      props.room.send({ t: 'pass', from: props.room.myId, to: v.players[to].id })
      guestPasses.current += 1
    }
    else hostDispatch({ type: 'pass', from: me, to })
  }

  const watching = screen.view !== null && myIndex(screen) < 0
  const v = screen.view
  const me = myIndex(screen)
  const canThrow = !!v && v.phase === 'play' && !screen.flight && v.holder === me && me >= 0
  const side = v && me >= 0 && v.alive[me] ? neighborsOf(v.alive, me) : null

  // PC: ← → 방향키로 왼쪽·오른쪽에 던지기
  const throwRef = useRef<(dir: 0 | 1) => void>(() => {})
  useEffect(() => {
    throwRef.current = (dir) => {
      if (canThrow && side) pick(side[dir])
    }
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      if (!e.repeat) throwRef.current(e.key === 'ArrowLeft' ? 0 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="bm-game">
      <div className="bm-view">
        <Table screen={screen} onPick={pick} />
        <Banner screen={screen} />
      </div>
      {watching && <p className="bm-tip">이미 시작한 판이라 구경해요. 다음 판부터 같이 해요</p>}
      {/* 왼쪽·오른쪽 던지기 (옆 사람을 직접 눌러도 됨) */}
      <div className="bm-throw" role="group" aria-label="던지기">
        {([0, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            className={`button bm-throw__button${canThrow ? ' bm-throw__button--hot' : ''}`}
            disabled={!canThrow}
            onPointerDown={(e) => {
              // 터치하자마자 던지도록
              e.preventDefault()
              if (canThrow && side) pick(side[dir])
            }}
            onClick={() => canThrow && side && pick(side[dir])}
          >
            {dir === 0 ? '◀ 왼쪽' : '오른쪽 ▶'}
            {side && v && <span>{v.players[side[dir]].name}</span>}
          </button>
        ))}
      </div>
      <p className="bm-hint">폭탄은 바로 옆 사람에게만 · 터질 때 들고 있으면 탈락 · PC는 ← → 방향키</p>
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
