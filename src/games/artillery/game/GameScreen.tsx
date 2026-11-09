import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import type { BotLevel } from '../bot/artilleryBot'
import { MOVE_SPEED, PLAYER_COLORS, POWER_MAX, TURN_MS, WIND_MAX, WORLD_W } from '../constants'
import { AngleDial } from '../field/AngleDial'
import { Battlefield } from '../field/Battlefield'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer } from '../play/engine'
import type { ArtilleryMsg } from '../play/pvp'
import { type ArtilleryView, type ScreenAction, type ScreenState, canAim, chargePower, createScreen, fuelLeft, myIndex, screenReducer, toView, viewChanged } from '../play/view'
import { tankPose } from '../rules/physics'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그리고,
// 자기 차례에 겨눈 것·발사만 방장에게 보낸다.

type Props =
  | { mode: 'bot'; bots: number; level: BotLevel; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | { mode: 'host'; room: Room<ArtilleryMsg>; members: Member[]; bots: number; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'guest'; room: Room<ArtilleryMsg>; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 간격: 바뀌면 이만큼마다(움직이는 동안 너무 자주 안 보내게), 안 바뀌어도 HEARTBEAT_MS마다 */
const SEND_MIN_MS = 100
const HEARTBEAT_MS = 1000
/** 친구가 겨누는 중인 걸 방장에게 보내는 간격 */
const SEND_AIM_MS = 100
/** 차례 시간이 이만큼 남았을 때 아직 힘을 모으는 중이면 그 힘으로 쏜다 */
const CHARGE_AUTO_FIRE_MS = 60

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수']

type HostState = { engine: EngineState; screen: ScreenState }
type HostAction = EngineAction | Exclude<ScreenAction, { type: 'view' | 'tick' }>

/** 방장: 내가 겨눈 것·발사도 바로 심판에게 */
function hostReducer(s: HostState, action: HostAction): HostState {
  // 내 화면에서 한 것 (친구가 보낸 'fire'는 심판 동작이라 player가 있다)
  if (action.type === 'draft' || (action.type === 'fire' && !('player' in action))) {
    const screen = screenReducer(s.screen, action as ScreenAction)
    const me = myIndex(screen)
    if (screen === s.screen || me < 0 || !screen.draft) return { ...s, screen }
    const engine = engineReducer(s.engine, { type: action.type === 'fire' ? 'fire' : 'aim', player: me, ...screen.draft })
    return { engine, screen: screenReducer(screen, { type: 'view', view: toView(engine) }) }
  }
  const engine = engineReducer(s.engine, action as EngineAction)
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
  // 친구 대전 봇은 일반
  const engine = createEngine({ now, seed: randomSeed(), players, level: props.mode === 'bot' ? props.level : 'normal' })
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
function statusOf(screen: ScreenState): { text: string; tone?: 'mine' | 'bad' | 'win' } {
  const v = screen.view
  if (!v) return { text: '' }
  const me = myIndex(screen)
  const nameOf = (i: number) => (i === me ? '나' : v.players[i].name)
  const left = Math.ceil(Math.max(0, screen.phaseUntil - screen.now) / 1000)
  switch (v.phase) {
    case 'countdown':
      return { text: `시작! 첫 차례는 ${nameOf(v.turn)}` }
    case 'aim':
      return v.turn === me ? { text: `내 차례! ${left}초`, tone: 'mine' } : { text: `${nameOf(v.turn)} 차례 ${left}초` }
    case 'flight':
      return { text: `${nameOf(v.turn)} 발사!` }
    case 'boom': {
      const b = v.boom
      if (!b?.at) return { text: '빗나갔어요!' }
      if (b.dead.length) return { text: `${b.dead.map(nameOf).join('·')} 탈락!`, tone: b.dead.includes(me) ? 'bad' : undefined }
      const hit = b.damage.flatMap((d, i) => (d > 0 ? [`${nameOf(i)} -${d}`] : []))
      return { text: hit.length ? hit.join(' · ') : '아무도 안 맞았어요' }
    }
    case 'done': {
      const winner = v.ranks.indexOf(1)
      if (winner < 0) return { text: '모두 쓰러졌어요!' }
      return winner === me ? { text: '내가 이겼다!', tone: 'win' } : { text: `${v.players[winner].name} 승리!` }
    }
  }
}

/** 바람 표시: 방향 화살표와 세기 */
function Wind({ wind }: { wind: number }) {
  const n = Math.round((Math.abs(wind) / WIND_MAX) * 3)
  const arrows = n === 0 ? '·' : (wind > 0 ? '→' : '←').repeat(n)
  return (
    <span className="at-wind" aria-label={`바람 ${wind > 0 ? '오른쪽' : wind < 0 ? '왼쪽' : '없음'} ${Math.abs(wind)}`}>
      바람 <b>{arrows}</b> {Math.abs(wind).toFixed(1)}
    </span>
  )
}

export function GameScreen(props: Props) {
  const isGuest = props.mode === 'guest'
  const [host, hostDispatch] = useReducer(hostReducer, props, initHost)
  const [guest, guestDispatch] = useReducer(screenReducer, undefined, () => createScreen(props.mode === 'guest' ? props.room.myId : '', performance.now()))
  const screen = isGuest ? guest : host.screen
  const dispatch = (a: Exclude<ScreenAction, { type: 'view' | 'tick' }>) => (isGuest ? guestDispatch(a) : hostDispatch(a))
  const dispatchRef = useRef(dispatch)
  const screenRef = useRef(screen)
  useEffect(() => {
    dispatchRef.current = dispatch
    screenRef.current = screen
  })
  const [hostGone, setHostGone] = useState(false)
  const room = props.mode === 'bot' ? null : props.room

  // 움직이기: 누르고 있는 동안 (-1 왼쪽, 1 오른쪽)
  const moveRef = useRef(0)
  // 힘 모으기: [발사]·스페이스를 누른 시각 (안 누르면 null). 떼면 그때 힘으로 발사
  const chargeRef = useRef<number | null>(null)
  const [chargeAt, setChargeAt] = useState<number | null>(null)
  const releaseRef = useRef(() => {})
  useEffect(() => {
    let last = performance.now()
    let id = requestAnimationFrame(function loop(t) {
      if (isGuest) guestDispatch({ type: 'tick', now: t })
      else hostDispatch({ type: 'tick', now: t })
      const dir = moveRef.current
      const s = screenRef.current
      if (chargeRef.current !== null && (!canAim(s) || s.phaseUntil - t < CHARGE_AUTO_FIRE_MS)) releaseRef.current()
      if (dir !== 0 && s.draft && s.view) {
        // 땅선을 따라 같은 빠르기로: 비탈이면 가로로는 덜 간다
        const slope = Math.cos(tankPose(s.view.terrain, s.draft.x).tilt)
        dispatchRef.current({ type: 'draft', x: s.draft.x + (dir * MOVE_SPEED * slope * (t - last)) / 1000 })
      }
      last = t
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [isGuest])

  // 친구 대전 메시지: 방장은 친구가 겨눈 것·발사를, 친구는 방장 화면을 받는다
  const engineRef = useRef(host.engine)
  useEffect(() => {
    engineRef.current = host.engine
  })
  useEffect(() => {
    if (!room) return
    const indexOf = (id: string) => engineRef.current.players.findIndex((p) => p.id === id && p.kind === 'remote')
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'view') guestDispatch({ type: 'view', view: msg.v })
      if (room.role !== 'host' || (msg.t !== 'aim' && msg.t !== 'fire')) return
      const player = indexOf(msg.from)
      if (player < 0 || msg.turnNo !== engineRef.current.turnNo) return
      hostDispatch({ type: msg.t, player, x: msg.x, angle: msg.angle, power: msg.power })
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

  // 방장: 화면이 바뀌면(차례인 사람이 움직이거나 겨누는 것도) 조금씩 모아서, 안 바뀌어도 1초마다 친구들에게 보낸다
  const sentRef = useRef<{ view: ArtilleryView | null; at: number }>({ view: null, at: 0 })
  useEffect(() => {
    if (props.mode !== 'host') return
    const view = toView(host.engine)
    const last = sentRef.current
    const phaseChanged = !last.view || last.view.phase !== view.phase || last.view.turnNo !== view.turnNo
    const since = host.engine.now - last.at
    if (phaseChanged || (viewChanged(last.view, view) && since >= SEND_MIN_MS) || since >= HEARTBEAT_MS) {
      props.room.send({ t: 'view', v: view })
      sentRef.current = { view, at: host.engine.now }
    }
  }, [props, host.engine])

  // 친구: 겨누는 중인 걸 방장에게 (발사는 바로)
  const guestDraft = guest.draft
  const guestFired = guest.fired
  const guestTurnNo = guest.view?.turnNo ?? 0
  useEffect(() => {
    if (props.mode !== 'guest' || !guestDraft) return
    const msg = { from: props.room.myId, turnNo: guestTurnNo, ...guestDraft }
    if (guestFired) {
      props.room.send({ t: 'fire', ...msg })
      return
    }
    const id = setTimeout(() => props.room.send({ t: 'aim', ...msg }), SEND_AIM_MS)
    return () => clearTimeout(id)
  }, [props, guestDraft, guestFired, guestTurnNo])

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
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  const finished = useRef(false)
  useEffect(() => {
    if (!done || finished.current || hostGone || myIndex(screenRef.current) < 0) return
    finished.current = true
    const summary = summaryOf(screenRef.current, props.mode === 'bot' ? 'bot' : 'pvp')
    finishRef.current(props.mode === 'bot' ? { ...summary, level: props.level } : summary)
  }, [done, hostGone, props])

  // 각도는 아래 다이얼(PC는 ↑↓), 힘은 [발사]를 누르고 있다가 떼는 타이밍으로
  function startCharge() {
    if (chargeRef.current !== null || !canAim(screenRef.current)) return
    const t = performance.now()
    chargeRef.current = t
    setChargeAt(t)
  }
  function releaseCharge() {
    const from = chargeRef.current
    if (from === null) return
    chargeRef.current = null
    setChargeAt(null)
    if (!canAim(screenRef.current)) return
    dispatchRef.current({ type: 'draft', power: chargePower(performance.now() - from) })
    dispatchRef.current({ type: 'fire' })
  }
  useEffect(() => {
    releaseRef.current = releaseCharge
  })

  // PC: ←→·A·D 이동(누르는 동안), ↑↓ 포신 올리기·내리기(Shift는 5씩), 스페이스·Enter 누르고 있다가 떼면 발사
  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const s = screenRef.current
      const moveKey: Record<string, number> = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 }
      if (e.code in moveKey) {
        e.preventDefault()
        const dir = moveKey[e.code]
        if (down) moveRef.current = dir
        else if (moveRef.current === dir) moveRef.current = 0
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (down && !e.repeat) startCharge()
        if (!down) releaseRef.current()
        return
      }
      // ↑ 포신 올리기 · ↓ 내리기 (지금 겨눈 쪽 기준, Shift는 5씩). 똑바로 위(90°)에서 ↓면 맵 가운데 쪽으로 내려감
      if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return
      e.preventDefault()
      if (!down || !s.draft) return
      const step = (e.shiftKey ? 5 : 1) * (e.code === 'ArrowUp' ? 1 : -1)
      const a = s.draft.angle
      const facingRight = a < 90 || (a === 90 && s.draft.x < WORLD_W / 2)
      dispatchRef.current({ type: 'draft', angle: facingRight ? Math.min(90, a + step) : Math.max(90, a - step) })
    }
    const down = (e: KeyboardEvent) => onKey(e, true)
    const up = (e: KeyboardEvent) => onKey(e, false)
    const blur = () => {
      moveRef.current = 0
      releaseRef.current()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const v = screen.view
  const me = myIndex(screen)
  const status = statusOf(screen)
  const aiming = canAim(screen)
  const left = Math.max(0, screen.phaseUntil - screen.now)
  const d = screen.draft
  const charging = chargeAt !== null
  const power = charging ? chargePower(screen.now - chargeAt) : null
  const hold = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        // 이미 뗀 손가락이면 무시
      }
      moveRef.current = dir
    },
    onPointerUp: () => (moveRef.current = 0),
    onPointerCancel: () => (moveRef.current = 0),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  return (
    <div className="at-game">
      {v && (
        <ul className="at-players" aria-label="참가자">
          {v.players.map((p, i) => (
            <li key={p.id} className={`at-chip${v.tanks[i].alive ? '' : ' at-chip--out'}${i === v.turn && v.phase !== 'done' ? ' at-chip--turn' : ''}`}>
              <span className="at-chip__dot" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
              <span className="at-chip__name">{i === me ? '나' : p.name}</span>
              <span className="at-chip__hp">{v.tanks[i].alive ? v.tanks[i].hp : '탈락'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="at-bar">
        <p className={`at-status${status.tone ? ` at-status--${status.tone}` : ''}`} aria-live="polite">
          {status.text}
        </p>
        {v && v.phase !== 'countdown' && v.phase !== 'done' && <Wind wind={v.wind} />}
      </div>
      <div className="at-view">
        <Battlefield screen={screen} />
      </div>
      <div className="at-timer" aria-hidden>
        <div className="at-timer__fill" style={{ transform: `scaleX(${v?.phase === 'aim' ? left / TURN_MS : 0})` }} />
      </div>

      {aiming && d ? (
        <div className="at-controls">
          <div className="at-row">
            <button type="button" className="button at-move" {...hold(-1)} aria-label="왼쪽으로 이동">
              ◀ 이동
            </button>
            <span className="at-fuel" aria-label="남은 연료">
              <span className="at-fuel__fill" style={{ transform: `scaleX(${fuelLeft(screen)})` }} />
            </span>
            <button type="button" className="button at-move" {...hold(1)} aria-label="오른쪽으로 이동">
              이동 ▶
            </button>
          </div>
          <div className="at-row at-row--aim">
            <AngleDial angle={d.angle} color={PLAYER_COLORS[me % PLAYER_COLORS.length]} onChange={(angle) => dispatch({ type: 'draft', angle })} />
            <div className="at-aim-side">
              <span className="at-tune">
                <button type="button" className="button button--small" onClick={() => dispatch({ type: 'draft', angle: d.angle + 1 })} aria-label="각도 왼쪽으로 1도">
                  ↺
                </button>
                <b>{Math.round(d.angle)}°</b>
                <button type="button" className="button button--small" onClick={() => dispatch({ type: 'draft', angle: d.angle - 1 })} aria-label="각도 오른쪽으로 1도">
                  ↻
                </button>
              </span>
              <span className="at-power" aria-label={`힘 ${power ?? Math.round(d.power)}`}>
                <span className="at-power__label">힘</span>
                <span className="at-power__bar">
                  <span className="at-power__fill" style={{ transform: `scaleX(${(power ?? 0) / POWER_MAX})` }} />
                  {/* 지난번에 쏜 힘 */}
                  <span className="at-power__last" style={{ left: `${(d.power / POWER_MAX) * 100}%` }} />
                </span>
                <b>{power ?? Math.round(d.power)}</b>
              </span>
            </div>
          </div>
          <button
            type="button"
            className={`button button--primary at-fire${charging ? ' at-fire--charging' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault()
              try {
                ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              } catch {
                // 이미 뗀 손가락이면 무시
              }
              startCharge()
            }}
            onPointerUp={releaseCharge}
            onPointerCancel={releaseCharge}
            onContextMenu={(e) => e.preventDefault()}
          >
            {charging ? '떼면 발사!' : '꾹 눌러 힘 모으기'}
          </button>
        </div>
      ) : (
        <p className="at-tip">
          {me >= 0 && v && !v.tanks[me].alive ? '탈락 · 구경 중' : v && me < 0 ? '이미 시작한 판이라 구경해요' : screen.fired ? '발사!' : '내 차례를 기다리는 중'}
        </p>
      )}
      <p className="at-hint">각도기를 끌어 돌려 각도 맞추기(↺↻는 1°씩) · 아래 버튼을 꾹 누르면 힘이 오르내려요, 원하는 힘에서 떼면 발사 (노란 줄 = 지난번 힘) · PC: ←→ 이동 · ↑↓ 포신 올리기·내리기(Shift는 5씩) · 스페이스 꾹 → 떼면 발사</p>

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
