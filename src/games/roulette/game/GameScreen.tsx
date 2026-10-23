import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { CHAMBERS, TURN_MS } from '../constants'
import { Table } from '../field/Table'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer } from '../play/engine'
import type { RouletteMsg } from '../play/pvp'
import { type RouletteView, type ScreenState, createScreen, fired, isMyTurn, myIndex, screenReducer, toView, viewChanged } from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그리고,
// 자기 차례면 고른 사람·방아쇠를 방장에게 보낸다.

type Props =
  | { mode: 'bot'; bots: number; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<RouletteMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<RouletteMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수', '봇 지수', '봇 현우']

type HostState = { engine: EngineState; screen: ScreenState }

function hostReducer(s: HostState, action: EngineAction): HostState {
  const engine = engineReducer(s.engine, action)
  let screen = action.type === 'tick' ? screenReducer(s.screen, { type: 'tick', now: action.now }) : s.screen
  screen = screenReducer(screen, { type: 'view', view: toView(engine) })
  return { engine, screen }
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
  const ranking = v.players.map((p, i) => ({ name: p.name, rank: v.ranks[i], kills: v.kills[i], me: i === me })).sort((a, b) => a.rank - b.rank)
  return { mode, rank: v.ranks[me], kills: v.kills[me], ranking }
}

/** 탁자 위 한 줄 안내 */
function statusOf(screen: ScreenState): { text: string; tone?: 'bad' | 'win' | 'mine' } {
  const v = screen.view
  if (!v) return { text: '' }
  const me = myIndex(screen)
  const nameOf = (i: number) => (i === me ? '나' : v.players[i].name)
  const left = Math.ceil(Math.max(0, screen.phaseUntil - screen.now) / 1000)
  switch (v.phase) {
    case 'intro':
      return { text: `총알 한 발 장전! ${nameOf(v.turn)}부터` }
    case 'aim':
      if (isMyTurn(screen)) return { text: `내 차례! 쏠 사람을 고르세요 (나도 돼요) ${left}초`, tone: 'mine' }
      return { text: `${nameOf(v.turn)} 차례… 누굴 쏠까 ${left}초` }
    case 'fire': {
      const f = v.fire!
      const who = f.shooter === f.target ? `${nameOf(f.shooter)} → 자기 자신` : `${nameOf(f.shooter)} → ${nameOf(f.target)}`
      if (!fired(screen)) return { text: `${who}… 철컥` }
      if (!f.bang) return { text: f.shooter === f.target ? '찰칵! 빈 칸 · 한 번 더' : `찰칵! 빈 칸 · ${nameOf(f.target)} 차례` }
      return { text: `탕! ${nameOf(f.target)} 탈락`, tone: f.target === me ? 'bad' : undefined }
    }
    case 'done': {
      const winner = v.ranks.indexOf(1)
      return winner === me ? { text: '내가 살아남았다!', tone: 'win' } : { text: `${v.players[winner].name} 우승!` }
    }
  }
}

export function GameScreen(props: Props) {
  const isGuest = props.mode === 'guest'
  const [host, hostDispatch] = useReducer(hostReducer, props, initHost)
  const [guest, guestDispatch] = useReducer(screenReducer, undefined, () => createScreen(props.mode === 'guest' ? props.room.myId : '', performance.now()))
  const screen = isGuest ? guest : host.screen
  const [hostGone, setHostGone] = useState(false)
  /** 친구: 방금 고른 사람 (방장 화면이 돌아오기 전에도 바로 보이게). 차례마다 새로 */
  const [myPick, setMyPick] = useState<{ turnKey: number; target: number } | null>(null)
  const room = props.mode === 'bot' ? null : props.room

  useEffect(() => {
    let id = requestAnimationFrame(function loop(t) {
      if (isGuest) guestDispatch({ type: 'tick', now: t })
      else hostDispatch({ type: 'tick', now: t })
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [isGuest])

  // 친구 대전 메시지: 방장은 친구가 고른 사람·방아쇠를, 친구는 방장 화면을 받는다
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
      if (msg.t === 'aim' && indexOf(msg.from) >= 0) hostDispatch({ type: 'aim', player: indexOf(msg.from), target: msg.target })
      if (msg.t === 'pull' && indexOf(msg.from) >= 0) hostDispatch({ type: 'pull', player: indexOf(msg.from), target: msg.target })
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
  const sentRef = useRef<{ view: RouletteView | null; at: number }>({ view: null, at: 0 })
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

  const v = screen.view
  const me = myIndex(screen)
  const mine = isMyTurn(screen)
  // 같은 사람 차례가 이어져도(나를 쐈는데 빈 칸) 새 차례로 보도록 시작 시각을 열쇠로
  const turnKey = Math.round(screen.phaseStart)
  const localPick = myPick?.turnKey === turnKey ? myPick.target : null
  const picked = isGuest ? (localPick ?? v?.aimAt ?? null) : (v?.aimAt ?? null)

  function pick(target: number) {
    if (!mine) return
    if (props.mode === 'guest') {
      setMyPick({ turnKey, target })
      props.room.send({ t: 'aim', from: props.room.myId, target })
    } else hostDispatch({ type: 'aim', player: me, target })
  }

  function pull() {
    if (!mine || picked === null) return
    if (props.mode === 'guest') props.room.send({ t: 'pull', from: props.room.myId, target: picked })
    else hostDispatch({ type: 'pull', player: me, target: picked })
  }

  // PC: Enter·스페이스바로 방아쇠
  const pullRef = useRef(pull)
  useEffect(() => {
    pullRef.current = pull
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) pullRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const status = statusOf(screen)
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const shownView = v && isGuest && localPick !== null && mine ? { ...screen, view: { ...v, aimAt: localPick } } : screen
  const remaining = CHAMBERS - (v?.pulls ?? 0)

  return (
    <div className="rl-game">
      <p className={`rl-status${status.tone ? ` rl-status--${status.tone}` : ''}`} aria-live="polite">
        {status.text}
      </p>
      <Table screen={shownView} onPick={pick} />
      <div className="rl-timer" aria-hidden>
        <div className="rl-timer__fill" style={{ transform: `scaleX(${v?.phase === 'aim' ? left / TURN_MS : 0})` }} />
      </div>
      <p className="rl-odds">
        {v ? `${v.pulls}번 당김 · 다음에 나갈 확률 1/${remaining}${remaining === 1 ? ' (무조건!)' : ''}` : ' '}
      </p>
      <button
        type="button"
        className={`button rl-pull${mine && picked !== null ? ' rl-pull--on' : ''}`}
        disabled={!mine || picked === null}
        onClick={pull}
      >
        {mine
          ? picked === null
            ? '쏠 사람을 누르세요'
            : `${picked === me ? '나에게' : `${v!.players[picked].name}에게`} 방아쇠 당기기`
          : me >= 0 && v && !v.alive[me]
            ? '탈락 · 구경 중'
            : me < 0 && v
              ? '이미 시작한 판이라 구경해요'
              : '기다리는 중'}
      </button>
      <p className="rl-hint">빈 칸이면 지목당한 사람 차례 · 남을 맞히면 내가 계속 · 나를 쏴서 빈 칸이면 한 번 더 · PC는 Enter</p>
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
