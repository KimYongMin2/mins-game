import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { TURN_MS } from '../constants'
import { Tile } from '../field/Tile'
import { type Draft, type DraftAction, checkDraft, createDraft, draftReducer, placedOf, rackOf } from '../play/draft'
import { type EngineAction, type EngineState, type Player, createEngine, engineReducer, turnSeqOf } from '../play/engine'
import type { TilesMsg } from '../play/pvp'
import { type ScreenAction, type ScreenState, type TilesView, createScreen, myIndex, myTurn, screenReducer, toView, viewChanged } from '../play/view'
import type { GameSummary, SortBy } from '../records'
import { isValidSet } from '../rules/sets'
import { handValue, sortByColor, sortByNumber } from '../rules/tiles'
import { PROBLEM_TEXT } from '../rules/turn'
import { playSound } from '../sounds'
import { type DropTarget, useTileDrag } from './useTileDrag'

// 경기 화면. 방장(봇 연습 포함)은 심판을 돌리고 그 화면을 친구들에게 보낸다. 친구는 받은 화면만 그린다.
// 내 차례엔 작업판(draft)에서 바닥을 다시 짜고, [내려놓기]를 누르면 바닥 전체를 심판에게 낸다.

type Props =
  | { mode: 'bot'; bots: number; sortBy: SortBy; onSort: (s: SortBy) => void; onFinish: (s: GameSummary) => void }
  /** 방장: 시작할 때 방에 있던 사람들로 경기 */
  | {
      mode: 'host'
      room: Room<TilesMsg>
      members: Member[]
      bots: number
      sortBy: SortBy
      onSort: (s: SortBy) => void
      onFinish: (s: GameSummary) => void
      onQuit: () => void
    }
  | { mode: 'guest'; room: Room<TilesMsg>; sortBy: SortBy; onSort: (s: SortBy) => void; onFinish: (s: GameSummary) => void; onQuit: () => void }

/** 방장이 친구들에게 화면을 보내는 최소 간격 (바뀌면 바로, 안 바뀌어도 이만큼마다) */
const HEARTBEAT_MS = 1000
/** 남은 시간이 이만큼이면 빨갛게 */
const HURRY_MS = 10_000

const BOT_NAMES = ['봇 철수', '봇 영희', '봇 민수']

type HostState = { engine: EngineState; screen: ScreenState }

function hostReducer(s: HostState, action: EngineAction | { type: 'sound'; name: Parameters<typeof playSound>[0] }): HostState {
  if (action.type === 'sound') return { ...s, screen: screenReducer(s.screen, action) }
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
    players = [
      { id: props.room.myId, name: me, kind: 'user' },
      ...props.members.map((m) => ({ id: m.id, name: m.nickname, kind: 'remote' as const })),
      ...BOT_NAMES.slice(0, props.bots).map((name, i) => ({ id: `bot${i}`, name, kind: 'bot' as const })),
    ]
  }
  const engine = createEngine({ now, seed: randomSeed(), players })
  return { engine, screen: screenReducer(createScreen(players[0]?.id ?? '', now), { type: 'view', view: toView(engine) }) }
}

function summaryOf(v: TilesView, me: number, mode: GameSummary['mode']): GameSummary {
  const order = v.ranking ?? v.players.map((_, i) => i)
  return {
    mode,
    won: order[0] === me,
    standings: order.map((i) => ({ name: v.players[i].name, tiles: v.hands[i].length, value: handValue(v.hands[i]), me: i === me })),
  }
}

function PlayerBar({ v, me }: { v: TilesView; me: number }) {
  return (
    <ul className="nt-players">
      {v.players.map((p, i) => (
        <li key={p.id} className={`nt-player${v.turn === i && v.phase === 'turn' ? ' nt-player--turn' : ''}${v.left[i] ? ' nt-player--left' : ''}`}>
          <span className="nt-player__name">
            {p.name}
            {i === me && ' (나)'}
          </span>
          <span className="nt-player__count">
            {v.hands[i].length}장{v.melded[i] ? ' · 등록' : ''}
          </span>
        </li>
      ))}
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

  // 친구 대전 메시지: 방장은 친구가 낸 것·가져오기를, 친구는 방장 화면을 받는다
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
      if (msg.t === 'play' && indexOf(msg.from) >= 0) hostDispatch({ type: 'play', player: indexOf(msg.from), table: msg.table })
      if (msg.t === 'draw' && indexOf(msg.from) >= 0) hostDispatch({ type: 'draw', player: indexOf(msg.from) })
      if (msg.t === 'draft' && indexOf(msg.from) >= 0)
        hostDispatch({ type: 'draft', player: indexOf(msg.from), turnSeq: msg.turnSeq, table: msg.table })
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
  const sentRef = useRef<{ view: TilesView | null; at: number }>({ view: null, at: 0 })
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
  const sound = (name: Parameters<typeof playSound>[0]) => (isGuest ? guestDispatch({ type: 'sound', name }) : hostDispatch({ type: 'sound', name }))

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

  const v = screen.view
  const me = myIndex(screen)
  const mine = myTurn(screen)

  // 작업판: 내 차례가 새로 시작되면(바닥·손패가 바뀌면) 새로 만든다
  const turnKey = v ? `${v.turn}:${v.last?.seq ?? 0}:${v.phase}` : ''
  const [work, setWork] = useState<{ key: string; d: Draft } | null>(null)
  const fresh = (): Draft => createDraft(v?.table ?? [], me >= 0 && v ? v.hands[me] : [], me >= 0 && v ? v.melded[me] : false)
  const draft = work && work.key === turnKey ? work.d : fresh()
  function act(a: DraftAction) {
    if (!mine || !v) return
    const d = draftReducer(draft, a)
    setWork({ key: turnKey, d })
    // 심판에게 짜던 바닥을 알려 둔다: 시간이 끝날 때 다 맞으면 그대로 낸다
    if (d.table === draft.table) return
    const turnSeq = turnSeqOf(v)
    if (props.mode === 'guest') props.room.send({ t: 'draft', from: props.room.myId, turnSeq, table: d.table })
    else hostDispatch({ type: 'draft', player: me, turnSeq, table: d.table })
  }

  function submit() {
    if (!mine) return
    const check = checkDraft(draft)
    if (!check.ok) {
      sound('nope')
      return
    }
    if (props.mode === 'guest') props.room.send({ t: 'play', from: props.room.myId, table: draft.table })
    else hostDispatch({ type: 'play', player: me, table: draft.table })
  }

  function draw() {
    if (!mine) return
    if (props.mode === 'guest') props.room.send({ t: 'draw', from: props.room.myId })
    else hostDispatch({ type: 'draw', player: me })
  }

  // PC: Enter 내려놓기, Esc 되돌리기
  const keyRef = useRef<(k: string) => void>(() => {})
  useEffect(() => {
    keyRef.current = (k) => {
      if (k === 'Enter') submit()
      if (k === 'Escape') act({ type: 'undo' })
    }
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      e.preventDefault()
      if (!e.repeat) keyRef.current(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 끌어 놓기 (훅이라 아래 return 전에 둔다)
  const feltRef = useRef<HTMLDivElement>(null)
  const { drag, start } = useTileDrag({
    feltRef,
    idsFor: (tile) => (draft.selected.includes(tile) ? draft.selected : [tile]),
    onTap: (tile) => {
      sound('pick')
      act({ type: 'toggle', tile })
    },
    onDrop: (tiles, target) => {
      sound('drop')
      if (target.kind === 'set') act({ type: 'place', set: target.set, at: target.at, tiles })
      else if (target.kind === 'new') act({ type: 'place', set: -1, tiles })
      else act({ type: 'unplace', tiles })
    },
  })
  const target: DropTarget = drag?.target ?? null

  if (!v) return <p className="nt-tip">시작하는 중…</p>

  const table = mine ? draft.table : v.table
  const placed = mine ? placedOf(draft) : []
  const justPlaced = !mine && v.last?.kind === 'play' ? v.last.placed : []
  const myHand = me >= 0 ? (mine ? rackOf(draft) : v.hands[me]) : []
  const rack = props.sortBy === 'color' ? sortByColor(myHand) : sortByNumber(myHand)
  const check = checkDraft(draft)
  const changed = mine && placed.length > 0
  const selected = mine ? draft.selected : []
  const left = Math.max(0, screen.phaseUntil - screen.now)

  function toggle(id: number) {
    if (!mine) return
    sound('pick')
    act({ type: 'toggle', tile: id })
  }

  /** 고른 타일을 그 줄 맨 뒤에 (set -1이면 새 줄) */
  function placeInto(set: number) {
    if (!mine || selected.length === 0 || drag) return
    sound('drop')
    act({ type: 'place', set })
  }
  const placing = mine && selected.length > 0
  const dragging = (id: number) => drag?.ids.includes(id) ?? false
  // 내 차례에만 끌 수 있다
  const grab = (id: number) => (mine ? { onPointerDown: (e: React.PointerEvent) => start(e, id), onClick: () => toggle(id) } : {})

  let tip: string
  if (v.phase === 'intro') tip = `${v.players[v.turn].name} 먼저 시작해요`
  else if (v.phase === 'done') tip = v.ranking?.[0] === me ? '내가 우승!' : `${v.players[v.ranking?.[0] ?? 0].name} 우승!`
  else if (!mine) {
    const lastText =
      v.last && v.last.player !== me
        ? v.last.kind === 'play'
          ? ` · ${v.players[v.last.player].name} ${v.last.placed.length}장 냄`
          : v.last.kind === 'draw'
            ? ` · ${v.players[v.last.player].name} 1장 가져감`
            : ''
        : ''
    tip = `${v.players[v.turn].name} 차례…${lastText}`
  } else if (selected.length > 0) tip = '끌어서 원하는 자리에 놓거나, 줄을 누르면 맨 뒤 · [새 줄]'
  else if (!changed) tip = v.melded[me] ? '타일을 끌어 놓아요. 바닥 타일도 옮길 수 있어요' : '첫 등록: 내 타일로 합 30 이상 줄을 만들어요'
  else tip = check.ok ? '다 맞아요! [내려놓기]' : PROBLEM_TEXT[check.problem]

  return (
    <div className="nt-game">
      <PlayerBar v={v} me={me} />

      <div ref={feltRef} className={`nt-felt${target?.kind === 'new' ? ' nt-felt--drop' : ''}`}>
        <div className="nt-felt__pool">더미 {v.poolCount}장</div>
        {table.length === 0 && selected.length === 0 && <p className="nt-felt__empty">아직 바닥이 비어 있어요</p>}
        <div className="nt-sets">
          {table.map((set, i) => {
            const ok = isValidSet(set)
            return (
              <div
                key={i}
                data-set={i}
                className={`nt-set${ok ? '' : ' nt-set--bad'}${placing && !drag ? ' nt-set--target' : ''}${target?.kind === 'set' && target.set === i ? ' nt-set--drop' : ''}`}
                onClick={() => placeInto(i)}
              >
                {/* 놓인 순서 그대로 그린다 (연속은 순서가 규칙) */}
                {set.map((id) => (
                  <Tile
                    key={id}
                    id={id}
                    selected={selected.includes(id)}
                    fresh={placed.includes(id) || justPlaced.includes(id)}
                    dragging={dragging(id)}
                    {...grab(id)}
                  />
                ))}
              </div>
            )
          })}
          {placing && !drag && (
            <button type="button" className="nt-set nt-set--new" onClick={() => placeInto(-1)}>
              + 새 줄
            </button>
          )}
        </div>
        {/* 끼울 자리: 겹쳐 그려서 타일이 안 움직인다 */}
        {target?.kind === 'set' && <div className="nt-drop-bar" style={{ left: target.bar.left, top: target.bar.top, height: target.bar.height }} />}
      </div>

      <div className="nt-status">
        <span className={mine ? 'nt-status__tip nt-status__tip--mine' : 'nt-status__tip'}>{tip}</span>
        {v.phase === 'turn' && (
          <div className="nt-timer" aria-hidden>
            <div className={`nt-timer__fill${left < HURRY_MS ? ' nt-timer__fill--hurry' : ''}`} style={{ transform: `scaleX(${left / TURN_MS})` }} />
          </div>
        )}
      </div>

      <div
        data-rack
        className={`nt-rack${(target?.kind === 'rack' && drag?.ids.some((id) => placed.includes(id))) || (!drag && mine && selected.some((id) => placed.includes(id))) ? ' nt-rack--target' : ''}`}
        onClick={() => {
          if (mine && selected.length > 0 && !drag) {
            sound('drop')
            act({ type: 'unplace' })
          }
        }}
      >
        <div className="nt-rack__head">
          <span>
            내 손패 {myHand.length}장 · {handValue(myHand)}점
          </span>
          <div className="nt-rack__sort" role="group" aria-label="정렬">
            {(['color', 'number'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`button button--small${props.sortBy === s ? ' nt-rack__sort--on' : ''}`}
                aria-pressed={props.sortBy === s}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onSort(s)
                }}
              >
                {s === 'color' ? '색별' : '숫자별'}
              </button>
            ))}
          </div>
        </div>
        <div className="nt-rack__tiles">
          {rack.map((id) => (
            <Tile key={id} id={id} selected={selected.includes(id)} dragging={dragging(id)} {...grab(id)} />
          ))}
        </div>
      </div>

      <div className="nt-actions">
        <button type="button" className="button" disabled={!mine || (selected.length === 0 && sameTable(draft, v))} onClick={() => act({ type: 'undo' })}>
          되돌리기
        </button>
        {changed ? (
          <button type="button" className="button button--primary nt-actions__main" disabled={!mine || !check.ok} onClick={submit}>
            내려놓기 ({placed.length}장)
          </button>
        ) : (
          <button type="button" className="button button--primary nt-actions__main" disabled={!mine} onClick={draw}>
            {v.poolCount > 0 ? '1장 가져오기' : '넘기기'}
          </button>
        )}
      </div>
      <p className="nt-hint">타일을 끌어 원하는 자리에 놓기 (빈 바닥이면 새 줄, 손패 칸이면 손으로) · 여러 장은 눌러 고른 뒤 끌기 · 시간이 끝날 때 바닥이 다 맞으면 그대로 내려놓고, 아니면 되돌리고 1장 가져와요 · PC는 Enter 내려놓기, Esc 되돌리기</p>

      {/* 끌고 있는 타일 (손가락에 가리지 않게 조금 위에) */}
      {drag && (
        <div className="nt-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          {drag.ids.map((id) => (
            <Tile key={id} id={id} />
          ))}
        </div>
      )}

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

/** 작업판이 처음 바닥 그대로인지 */
function sameTable(d: Draft, v: TilesView): boolean {
  return JSON.stringify(d.table) === JSON.stringify(v.table)
}
