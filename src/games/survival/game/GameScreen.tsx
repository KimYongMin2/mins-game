import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { PIECE_R, PLAN_MS, PLAYER_COLORS } from '../constants'
import { Arena } from '../field/Arena'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer, lasersDoneAt } from '../play/engine'
import type { SurvivalMsg } from '../play/pvp'
import {
  type ScreenAction,
  type ScreenState,
  type SurvivalView,
  canLock,
  canPlan,
  createScreen,
  myIndex,
  screenReducer,
  toView,
  viewChanged,
} from '../play/view'
import type { Vec } from '../rules/geometry'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그리고,
// 자기가 고른 자리·방향은 방장에게 보낸다.

type Props =
  | { mode: 'bot'; bots: number; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<SurvivalMsg>; members: Member[]; bots: number; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<SurvivalMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000
/** 친구가 고르는 중인 걸 방장에게 보내는 간격 (끄는 동안 너무 자주 안 보내게) */
const SEND_PLAN_MS = 150

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수', '봇 지수', '봇 현우', '봇 수진', '봇 동현']

type HostState = { engine: EngineState; screen: ScreenState }
type HostAction = EngineAction | Exclude<ScreenAction, { type: 'view' | 'tick' }>

/** 방장: 내가 고른 것도 바로 심판에게 */
function hostReducer(s: HostState, action: HostAction): HostState {
  if (action.type !== 'tick' && action.type !== 'plan' && action.type !== 'drop') {
    const screen = screenReducer(s.screen, action)
    const me = myIndex(screen)
    if (screen.draft === s.screen.draft || me < 0) return { ...s, screen }
    const engine = engineReducer(s.engine, { type: 'plan', player: me, plan: screen.draft })
    return { engine, screen: screenReducer(screen, { type: 'view', view: toView(engine) }) }
  }
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
    players = [
      { id: props.room.myId, name: me, kind: 'user' },
      ...props.members.map((m) => ({ id: m.id, name: m.nickname, kind: 'remote' as const })),
      ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const })),
    ]
  }
  const engine = createEngine({ now, seed: randomSeed(), players })
  return { engine, screen: screenReducer(createScreen(players[0]?.id ?? '', now), { type: 'view', view: toView(engine) }) }
}

function summaryOf(screen: ScreenState, mode: GameSummary['mode']): GameSummary {
  const v = screen.view!
  const me = myIndex(screen)
  const ranking = v.players
    .map((p, i) => ({ name: p.name, rank: v.ranks[i], kills: v.kills[i], me: i === me }))
    .sort((a, b) => a.rank - b.rank || b.kills - a.kills)
  return { mode, rank: v.ranks[me], kills: v.kills[me], ranking }
}

/** 맵 위 한 줄 안내 */
function statusOf(screen: ScreenState): { text: string; tone?: 'bad' | 'win' } {
  const v = screen.view
  if (!v) return { text: '' }
  const me = myIndex(screen)
  const nameOf = (i: number) => (i === me ? '나' : v.players[i].name)
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const alive = v.alive.filter(Boolean).length
  switch (v.phase) {
    case 'countdown':
      return { text: `${v.round}라운드${v.half < v.prevHalf ? ' · 맵이 줄어요!' : ''} (${alive}명)` }
    case 'plan':
      return { text: `${v.round}라운드 · 몰래 자리와 방향 고르기 ${Math.ceil(left / 1000)}초` }
    case 'reveal':
    case 'done': {
      const r = v.reveal
      if (v.phase === 'done') {
        const winner = v.ranks.indexOf(1)
        return winner === me ? { text: '내가 최후의 1인!', tone: 'win' } : { text: `${v.players[winner].name} 우승!` }
      }
      if (!r || screen.now - screen.phaseStart < lasersDoneAt(r)) return { text: '공개! 탕!' }
      if (r.voided) return { text: '모두 맞아서 무효! 다시' }
      if (r.dead.length === 0) return { text: '아무도 안 맞았어요' }
      const lines = r.dead.map((d) => {
        const by = r.shots.filter((sh) => sh.hit === d).map((sh) => nameOf(sh.from))
        return `${nameOf(d)} 탈락 (${by.join('·')})`
      })
      return { text: lines.join(' · '), tone: r.dead.includes(me) ? 'bad' : undefined }
    }
  }
}

export function GameScreen(props: Props) {
  const isGuest = props.mode === 'guest'
  const [host, hostDispatch] = useReducer(hostReducer, props, initHost)
  const [guest, guestDispatch] = useReducer(screenReducer, undefined, () => createScreen(props.mode === 'guest' ? props.room.myId : '', performance.now()))
  const screen = isGuest ? guest : host.screen
  const dispatch = (a: Exclude<ScreenAction, { type: 'view' | 'tick' }>) => (isGuest ? guestDispatch(a) : hostDispatch(a))
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

  // 친구 대전 메시지: 방장은 친구가 고른 것을, 친구는 방장 화면을 받는다
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
      if (msg.t === 'plan' && indexOf(msg.from) >= 0 && msg.round === engineRef.current.round) {
        hostDispatch({ type: 'plan', player: indexOf(msg.from), plan: msg.plan })
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
  const sentRef = useRef<{ view: SurvivalView | null; at: number }>({ view: null, at: 0 })
  useEffect(() => {
    if (props.mode !== 'host') return
    const view = toView(host.engine)
    const last = sentRef.current
    if (viewChanged(last.view, view) || host.engine.now - last.at >= HEARTBEAT_MS) {
      props.room.send({ t: 'view', v: view })
      sentRef.current = { view, at: host.engine.now }
    }
  }, [props, host.engine])

  // 친구: 고르는 중인 것을 방장에게 (확정은 바로, 끄는 중엔 조금씩 모아서)
  const guestDraft = guest.draft
  const guestRound = guest.view?.round ?? 0
  useEffect(() => {
    if (props.mode !== 'guest' || !guestDraft.pos) return
    const send = () => props.room.send({ t: 'plan', from: props.room.myId, round: guestRound, plan: guestDraft })
    if (guestDraft.locked) {
      send()
      return
    }
    const id = setTimeout(send, SEND_PLAN_MS)
    return () => clearTimeout(id)
  }, [props, guestDraft, guestRound])

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

  // 맵 누르기: 자리 단계면 말을 옮기고(떼면 방향 단계로), 방향 단계면 그쪽을 겨눈다. 방향 단계에서 내 말을 누르면 다시 옮기기
  const dragRef = useRef<'pos' | 'aim' | null>(null)
  function onPointer(kind: 'down' | 'move' | 'up', at: Vec) {
    if (!canPlan(screen)) return
    const pos = screen.draft.pos
    if (kind === 'down') {
      const nearMe = pos && Math.hypot(at.x - pos.x, at.y - pos.y) <= PIECE_R * 1.6
      dragRef.current = screen.step === 'pos' || nearMe ? 'pos' : 'aim'
      if (dragRef.current === 'pos' && screen.step !== 'pos') dispatch({ type: 'step', step: 'pos' })
    }
    const drag = dragRef.current
    if (!drag) return
    if (drag === 'pos') dispatch({ type: 'place', pos: at })
    if (drag === 'aim' && pos && Math.hypot(at.x - pos.x, at.y - pos.y) > 1) dispatch({ type: 'aim', angle: Math.atan2(at.y - pos.y, at.x - pos.x) })
    if (kind === 'up') {
      if (drag === 'pos') dispatch({ type: 'step', step: 'aim' })
      dragRef.current = null
    }
  }

  const lock = () => dispatch({ type: 'lock' })
  // PC: Enter로 확정
  const lockRef = useRef(lock)
  useEffect(() => {
    lockRef.current = lock
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      e.preventDefault()
      lockRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const v = screen.view
  const me = myIndex(screen)
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const status = statusOf(screen)
  const planning = v?.phase === 'plan' && me >= 0 && v.alive[me]
  const watching = v !== null && me < 0

  return (
    <div className="sv-game">
      {v && (
        <ul className="sv-players" aria-label="참가자">
          {v.players.map((p, i) => (
            <li key={p.id} className={`sv-chip${v.alive[i] ? '' : ' sv-chip--out'}${i === me ? ' sv-chip--me' : ''}`}>
              <span className="sv-chip__dot" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
              <span className="sv-chip__name">{i === me ? '나' : p.name}</span>
              {v.kills[i] > 0 && <span className="sv-chip__kills">{v.kills[i]}킬</span>}
              {v.phase === 'plan' && v.alive[i] && <span className="sv-chip__state">{v.locked.includes(i) ? '✓' : '○'}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className={`sv-status${status.tone ? ` sv-status--${status.tone}` : ''}`} aria-live="polite">
        {status.text}
      </p>
      <Arena screen={screen} onPointer={onPointer} />
      <div className="sv-timer" aria-hidden>
        <div className="sv-timer__fill" style={{ transform: `scaleX(${v?.phase === 'plan' ? left / PLAN_MS : 0})` }} />
      </div>

      {planning ? (
        screen.draft.locked ? (
          <p className="sv-tip">
            확정! 다른 사람 기다리는 중 ({v.locked.length}/{v.alive.filter(Boolean).length})
          </p>
        ) : (
          <>
            <p className="sv-tip">
              {screen.step === 'pos' || !screen.draft.pos ? '① 숨을 자리를 누르세요' : '② 쏠 방향을 누르세요 (끌어서 조정)'}
            </p>
            <div className="sv-buttons">
              <button type="button" className="button" disabled={!screen.draft.pos} onClick={() => dispatch({ type: 'step', step: 'pos' })}>
                자리 다시
              </button>
              <button type="button" className="button button--primary" disabled={!canLock(screen)} onClick={lock}>
                확정
              </button>
            </div>
          </>
        )
      ) : (
        <p className="sv-tip">{me >= 0 && v && !v.alive[me] ? '탈락 · 구경 중' : watching ? '이미 시작한 판이라 구경해요' : ' '}</p>
      )}
      <p className="sv-hint">다른 사람 자리는 공개 전까지 안 보여요 · 내 말을 끌면 옮기기 · 총알은 처음 맞은 한 명에서 멈춰요 · PC는 Enter로 확정</p>

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
