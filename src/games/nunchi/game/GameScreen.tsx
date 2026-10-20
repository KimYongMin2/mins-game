import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { CALL_MS, RPS_PICK_MS } from '../constants'
import { HAND_LABEL, Table } from '../field/Table'
import { type EngineAction, type EngineState, HANDS, type Hand, type Player, createEngine, engineReducer } from '../play/engine'
import type { NunchiMsg } from '../play/pvp'
import {
  COLLIDE_SEC,
  type NunchiView,
  type ScreenAction,
  type ScreenState,
  canCall,
  canPick,
  createScreen,
  myIndex,
  screenReducer,
  toView,
  viewChanged,
} from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그린다.

type Props =
  | { mode: 'bot'; bots: number; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<NunchiMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<NunchiMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수', '봇 지수', '봇 현우']

type HostState = { engine: EngineState; screen: ScreenState }
type HostAction = EngineAction | { type: 'myHand'; hand: Hand }

function hostReducer(s: HostState, action: HostAction): HostState {
  if (action.type === 'myHand') return { ...s, screen: screenReducer(s.screen, action) }
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
  if (props.mode === 'bot') {
    players = [{ id: 'me', name: me, kind: 'user' }, ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const }))]
  } else if (props.mode === 'host') {
    players = [{ id: props.room.myId, name: me, kind: 'user' }, ...props.members.map((m) => ({ id: m.id, name: m.nickname, kind: 'remote' as const }))]
  }
  const engine = createEngine({ now, seed: randomSeed(), players })
  return { engine, screen: screenReducer(createScreen(players[0]?.id ?? '', now), { type: 'view', view: toView(engine) }) }
}

function summaryOf(screen: ScreenState, mode: GameSummary['mode']): GameSummary {
  const v = screen.view!
  const me = myIndex(screen)
  const ranking = v.players.map((p, i) => ({ name: p.name, rank: v.ranks[i] })).sort((a, b) => a.rank - b.rank)
  return { mode, rank: v.ranks[me], ranking }
}

/** 가운데 안내 */
function Banner({ screen }: { screen: ScreenState }) {
  const v = screen.view
  if (!v) return null
  const me = myIndex(screen)
  const left = Math.max(0, screen.phaseUntil - screen.now)
  switch (v.phase) {
    case 'countdown':
      return (
        <div className="nc-banner">
          <strong>{Math.max(1, Math.ceil(left / 800))}</strong>
          <span>
            {v.round}판 · {v.alive.filter(Boolean).length}명
          </span>
        </div>
      )
    case 'call':
      return (
        <div className="nc-banner">
          <strong className="nc-banner__num">{v.presses.length + 1}?</strong>
          <span>{Math.ceil(left / 1000)}초</span>
        </div>
      )
    case 'result': {
      if (v.replay) return <div className="nc-banner"><strong className="nc-banner__small">모두 탈락할 뻔! 다시</strong></div>
      const names = v.losers.map((l) => (l.player === me ? '나' : v.players[l.player].name))
      return (
        <div className="nc-banner">
          <strong className="nc-banner__small nc-banner__bad">{names.join(', ')} 탈락</strong>
        </div>
      )
    }
    case 'rps':
      return (
        <div className="nc-banner">
          <strong className="nc-banner__small">결승! 가위바위보</strong>
          <span>{Math.ceil(left / 1000)}초</span>
        </div>
      )
    case 'reveal':
      return (
        <div className="nc-banner">
          <strong className="nc-banner__small">{v.winner === null ? '비겼다! 다시' : `${v.winner === me ? '내가' : v.players[v.winner].name} 이겼다!`}</strong>
        </div>
      )
    case 'done': {
      const winner = v.ranks.indexOf(1)
      return (
        <div className="nc-banner">
          <strong className={`nc-banner__small${winner === me ? ' nc-banner__win' : ''}`}>{winner === me ? '내가 우승!' : `${v.players[winner].name} 우승!`}</strong>
          <span>결과 화면으로 넘어가요…</span>
        </div>
      )
    }
  }
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

  // 친구 대전 메시지: 방장은 친구가 누른 것·고른 손을, 친구는 방장 화면을 받는다
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
      if (msg.t === 'press' && indexOf(msg.from) >= 0) hostDispatch({ type: 'press', player: indexOf(msg.from) })
      if (msg.t === 'pick' && indexOf(msg.from) >= 0) hostDispatch({ type: 'pick', player: indexOf(msg.from), hand: msg.hand })
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
  const sentRef = useRef<{ view: NunchiView | null; at: number }>({ view: null, at: 0 })
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
    if (!done || finished.current || hostGone || myIndex(screenRef.current) < 0) return
    finished.current = true
    finishRef.current(summaryOf(screenRef.current, props.mode === 'bot' ? 'bot' : 'pvp'))
  }, [done, hostGone, props.mode])

  function call() {
    if (!canCall(screen)) return
    if (props.mode === 'guest') props.room.send({ t: 'press', from: props.room.myId })
    else hostDispatch({ type: 'press', player: myIndex(screen) })
  }

  function choose(hand: Hand) {
    if (!canPick(screen)) return
    if (props.mode === 'guest') {
      props.room.send({ t: 'pick', from: props.room.myId, hand })
      guestDispatch({ type: 'myHand', hand })
    } else {
      hostDispatch({ type: 'pick', player: myIndex(screen), hand })
      hostDispatch({ type: 'myHand', hand })
    }
  }

  // PC: 스페이스바로 외치기
  const callRef = useRef(call)
  useEffect(() => {
    callRef.current = call
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) callRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const v = screen.view
  const me = myIndex(screen)
  const final = v && (v.phase === 'rps' || v.phase === 'reveal')
  const inFinal = !!final && me >= 0 && v.alive[me]
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const timerScale = v?.phase === 'call' ? left / CALL_MS : v?.phase === 'rps' ? left / RPS_PICK_MS : 0
  const myPress = v && me >= 0 ? v.presses.find((p) => p.player === me) : undefined
  const watching = v !== null && me < 0

  return (
    <div className="nc-game">
      <div className="nc-view">
        <Table screen={screen} />
        <Banner screen={screen} />
      </div>
      <div className="nc-timer" aria-hidden>
        <div className="nc-timer__fill" style={{ transform: `scaleX(${timerScale})` }} />
      </div>

      {inFinal ? (
        <div className="nc-hands" role="group" aria-label="가위바위보">
          {HANDS.map((h) => (
            <button
              key={h}
              type="button"
              className="button nc-hands__button"
              aria-pressed={screen.myHand === h}
              disabled={!canPick(screen)}
              onPointerDown={(e) => {
                e.preventDefault()
                choose(h)
              }}
              onClick={() => choose(h)}
            >
              {HAND_LABEL[h]}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className={`button nc-call${canCall(screen) ? ' nc-call--on' : ''}`}
          disabled={!canCall(screen)}
          onPointerDown={(e) => {
            // 터치하자마자 (click은 손을 뗄 때라 늦다)
            e.preventDefault()
            call()
          }}
        >
          {myPress ? (myPress.collided ? '겹쳤다!' : `${myPress.n}!`) : me >= 0 && v && !v.alive[me] ? '탈락 · 구경 중' : '외치기!'}
        </button>
      )}
      {watching && <p className="nc-tip">이미 시작한 판이라 구경해요. 다음 판부터 같이 해요</p>}
      <p className="nc-hint">
        {final
          ? '결승은 가위바위보 · 3초 안에 고르기 · 안 고르면 무작위'
          : `아무 때나 한 번 외치기 · ${COLLIDE_SEC}초 안에 겹치면 탈락 · 마지막 한 명도 탈락 · PC는 스페이스바`}
      </p>
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
