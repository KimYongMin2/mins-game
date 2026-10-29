import { useEffect, useRef, useState } from 'react'
import type { Room } from '../../../shared/online/room'
import { loadNickname } from '../../../shared/storage/nickname'
import { type BotLevel, botInput, createBotMind } from '../bot/volleyBot'
import { DONE_MS, STEP_HZ } from '../constants'
import { Court } from '../field/Court'
import { type Guest, INPUT_RESEND_MS, PING_MS, STATE_HZ, type VolleyMsg, createGuest, guestReceive, guestStep, sameInput, withRtt } from '../play/net'
import { type Input, NO_INPUT, type Side, type SimState, createSim, step } from '../play/sim'
import type { GameSummary } from '../records'
import { type SoundName, playSound } from '../sounds'

// 경기 화면. 물리는 1초에 60스텝 고정(남는 시간은 모았다가 다음 프레임에), 그리는 건 화면 주사율대로.
// - 봇: 이 기기에서 나(왼쪽) vs 봇
// - 방장: 진짜 경기를 돌리고 친구 키를 받아 넣는다. 1초에 STATE_HZ번 상태를 보낸다
// - 친구: 같은 물리로 예측해서 자기 키를 바로 반영 (play/net.ts). 자기가 왼쪽에 보이게 좌우를 뒤집어 그린다

type Props =
  | { mode: 'bot'; level: BotLevel; onFinish: (s: GameSummary) => void }
  | { mode: 'pvp'; room: Room<VolleyMsg>; peerName: string; server: Side; peerGone: boolean; onFinish: (s: GameSummary) => void; onQuit: () => void }

const STEP_MS = 1000 / STEP_HZ
/** 한 프레임에 최대 몇 스텝까지 따라잡을지 (탭이 잠깐 멈췄다 돌아왔을 때 폭주 방지) */
const MAX_STEPS_PER_FRAME = 5
const TRAIL = 7

type Keys = { left: boolean; right: boolean; jump: boolean; down: boolean; hit: boolean }
const NO_KEYS: Keys = { left: false, right: false, jump: false, down: false, hit: false }
const KEY_OF: Record<string, keyof Keys> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  ArrowDown: 'down',
  Space: 'hit',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'jump',
  KeyS: 'down',
  Enter: 'hit',
}

/** 화면 기준 키 → 물리 기준 키 (뒤집어 그리면 좌우도 뒤집는다) */
const toWorld = (k: Keys, mirror: boolean): Input => (mirror ? { ...k, left: k.right, right: k.left } : { ...k })

export function GameScreen(props: Props) {
  const role = props.mode === 'bot' ? 'bot' : props.room.role
  const me: Side = role === 'guest' ? 1 : 0
  const foe: Side = me === 0 ? 1 : 0
  const mirror = me === 1
  // 물리 상태는 ref에 두고, 프레임마다 그릴 것만 state로. 첫 서브: 친구 대전은 방장이 정함, 봇전은 무작위
  const [initial] = useState(() => createSim(props.mode === 'pvp' ? props.server : Math.random() < 0.5 ? 0 : 1))
  const simRef = useRef<SimState>(initial)
  const guestRef = useRef<Guest>(createGuest(initial))
  // 그릴 것: 경기 상태 + 공 꼬리
  const [frame, setFrame] = useState<{ sim: SimState; trail: { x: number; y: number }[] }>({ sim: initial, trail: [] })
  const view = frame.sim
  const keysRef = useRef<Keys>(NO_KEYS)
  // 치기를 아주 짧게 눌렀다 떼면 다음 스텝 전에 끝나 버려서, 누른 순간을 따로 잡아 한 스텝은 꼭 '누름'으로 넣는다
  const hitTapRef = useRef(false)
  const remoteTapRef = useRef(false)
  const [touchKeys, setTouchKeys] = useState<Keys>(NO_KEYS)
  const remoteRef = useRef<Input>(NO_INPUT)
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })

  // 키보드
  useEffect(() => {
    function set(e: KeyboardEvent, down: boolean) {
      const k = KEY_OF[e.code]
      if (!k) return
      e.preventDefault()
      if (k === 'hit' && down && !e.repeat) hitTapRef.current = true
      keysRef.current = { ...keysRef.current, [k]: down }
    }
    const down = (e: KeyboardEvent) => set(e, true)
    const up = (e: KeyboardEvent) => set(e, false)
    const blur = () => (keysRef.current = NO_KEYS)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // 친구 화면: 되감아 맞출 때 튀지 않게, 차이를 조금씩 줄여 가며 그린다
  const offsetRef = useRef({ bx: 0, by: 0, p: [0, 0] as [number, number] })
  function nudge(before: SimState, after: SimState) {
    if (before.phase.kind !== 'rally' || after.phase.kind !== 'rally') return
    const o = offsetRef.current
    o.bx += before.ball.x - after.ball.x
    o.by += before.ball.y - after.ball.y
    o.p = [o.p[0] + before.players[0].x - after.players[0].x, o.p[1] + before.players[1].x - after.players[1].x]
  }

  // 친구 대전 메시지
  const room = props.mode === 'pvp' ? props.room : null
  useEffect(() => {
    if (!room) return
    const pings = new Map<number, number>()
    const off = room.onMessage((msg) => {
      if (room.role === 'host') {
        if (msg.t === 'input') {
          // 친구가 짧게 누른 것도 놓치지 않게 (누름·뗌이 한 프레임에 같이 와도)
          if (msg.i.hit && !remoteRef.current.hit) remoteTapRef.current = true
          remoteRef.current = msg.i
        }
        if (msg.t === 'ping') room.send({ t: 'pong', id: msg.id })
      } else {
        if (msg.t === 'state') {
          const before = guestRef.current.local
          guestRef.current = guestReceive(guestRef.current, msg.s, msg.i)
          nudge(before, guestRef.current.local)
        }
        if (msg.t === 'pong' && pings.has(msg.id)) {
          guestRef.current = withRtt(guestRef.current, performance.now() - pings.get(msg.id)!)
          pings.delete(msg.id)
        }
      }
    })
    // 친구: 왕복 지연 재기
    let id = 0
    const timer =
      room.role === 'guest'
        ? setInterval(() => {
            id++
            pings.set(id, performance.now())
            room.send({ t: 'ping', id })
          }, PING_MS)
        : undefined
    return () => {
      off()
      clearInterval(timer)
    }
  }, [room])

  // 게임 루프
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let mind = createBotMind()
    let sentInput: Input = NO_INPUT
    let sentAt = 0
    let sentTick = -1
    const loop = (t: number) => {
      acc += Math.min(250, t - last)
      last = t
      const p = propsRef.current
      let n = 0
      // 이번 프레임에 누른 치기는 첫 스텝에 꼭 들어간다
      let tap = hitTapRef.current
      let remoteTap = remoteTapRef.current
      let mine = toWorld(keysRef.current, mirror)
      while (acc >= STEP_MS && n < MAX_STEPS_PER_FRAME) {
        acc -= STEP_MS
        n++
        mine = toWorld({ ...keysRef.current, hit: keysRef.current.hit || tap }, mirror)
        const remote = remoteTap ? { ...remoteRef.current, hit: true } : remoteRef.current
        if (tap) {
          tap = false
          hitTapRef.current = false
        }
        if (remoteTap && p.mode === 'pvp' && p.room.role === 'host') {
          remoteTap = false
          remoteTapRef.current = false
        }
        if (p.mode === 'bot') {
          const b = botInput(simRef.current, 1, p.level, mind)
          mind = b.mind
          simRef.current = step(simRef.current, [mine, b.input])
        } else if (p.room.role === 'host') {
          if (p.peerGone) continue
          simRef.current = step(simRef.current, [mine, remote])
          // 끝난 뒤엔 스텝이 안 늘어서 한 번만 보낸다
          const s = simRef.current
          if (s.tick !== sentTick && (s.tick % (STEP_HZ / STATE_HZ) === 0 || s.phase.kind === 'done')) {
            p.room.send({ t: 'state', s, i: [mine, remote] })
            sentTick = s.tick
          }
        } else {
          if (p.peerGone) continue
          guestRef.current = guestStep(guestRef.current, mine)
        }
      }
      if (n === MAX_STEPS_PER_FRAME) acc = 0
      // 스텝이 없던 프레임에 누른 것도 보낼 수 있게 (친구)
      if (n === 0) mine = toWorld({ ...keysRef.current, hit: keysRef.current.hit || tap }, mirror)
      // 친구: 키가 바뀌면 바로, 아니어도 가끔
      if (p.mode === 'pvp' && p.room.role === 'guest' && (!sameInput(mine, sentInput) || t - sentAt > INPUT_RESEND_MS)) {
        p.room.send({ t: 'input', i: mine })
        sentInput = mine
        sentAt = t
        if (mine.hit) hitTapRef.current = false
      }
      // 그릴 상태
      let shown = role === 'guest' ? guestRef.current.local : simRef.current
      const o = offsetRef.current
      if (role === 'guest' && shown.phase.kind === 'rally') {
        shown = {
          ...shown,
          ball: { ...shown.ball, x: shown.ball.x + o.bx, y: shown.ball.y + o.by },
          players: [
            { ...shown.players[0], x: shown.players[0].x + o.p[0] },
            { ...shown.players[1], x: shown.players[1].x + o.p[1] },
          ],
        }
      }
      o.bx *= 0.75
      o.by *= 0.75
      o.p = [o.p[0] * 0.75, o.p[1] * 0.75]
      if (shown.phase.kind === 'rally') trailRef.current = [...trailRef.current, { x: shown.ball.x, y: shown.ball.y }].slice(-TRAIL)
      else trailRef.current = []
      setFrame({ sim: shown, trail: trailRef.current })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [mirror, role])

  // 소리·흔들림: 새로 생긴 일만
  const seen = useRef({ hit: 0, phase: view.phase.kind, air: false })
  useEffect(() => {
    const s = seen.current
    const play: SoundName[] = []
    if (view.lastHit && view.lastHit.seq > s.hit) {
      s.hit = view.lastHit.seq
      play.push(view.lastHit.kind)
    }
    const air = view.players[me].y > 0.05
    if (air && !s.air) play.push('jump')
    s.air = air
    if (view.phase.kind !== s.phase) {
      if (view.phase.kind === 'point') play.push(view.phase.scorer === me ? 'point' : 'lost')
      if (view.phase.kind === 'serve') play.push('whistle')
      if (view.phase.kind === 'done') play.push(view.phase.winner === me ? 'win' : 'lose')
      s.phase = view.phase.kind
    }
    play.forEach(playSound)
  }, [view, me])

  // 끝나면 잠깐 보여준 뒤 결과로
  const done = view.phase.kind === 'done'
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => {
      const p = propsRef.current
      const s = role === 'guest' ? guestRef.current.local : simRef.current
      if (s.phase.kind !== 'done') return
      p.onFinish({
        mode: p.mode,
        level: p.mode === 'bot' ? p.level : 'normal',
        won: s.phase.winner === me,
        score: [s.score[me], s.score[foe]],
        spikes: [s.spikes[me], s.spikes[foe]],
        foeName: p.mode === 'bot' ? '봇' : p.peerName,
      })
    }, DONE_MS)
    return () => clearTimeout(id)
  }, [done, role, me, foe])

  // 터치 버튼: 누르는 동안만
  function touch(k: keyof Keys, down: boolean) {
    keysRef.current = { ...keysRef.current, [k]: down }
    setTouchKeys(keysRef.current)
  }
  const pad = (k: keyof Keys, label: string, cls: string) => (
    <button
      type="button"
      className={`vb-pad ${cls}${touchKeys[k] ? ' vb-pad--on' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        if (k === 'hit') hitTapRef.current = true
        touch(k, true)
      }}
      onPointerUp={() => touch(k, false)}
      onPointerCancel={() => touch(k, false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {label}
    </button>
  )

  const myName = loadNickname() ?? '나'
  const foeName = props.mode === 'bot' ? `봇 (${props.level === 'hard' ? '어려움' : '일반'})` : props.peerName
  let banner: { text: string; cls?: string } | null = null
  if (view.phase.kind === 'point') banner = view.phase.scorer === me ? { text: '득점!', cls: 'vb-banner--win' } : { text: '실점…' }
  else if (view.phase.kind === 'serve' && view.tick < 50 && view.score[0] + view.score[1] === 0) banner = { text: view.server === me ? '내 서브!' : '상대 서브' }
  else if (view.phase.kind === 'done') banner = view.phase.winner === me ? { text: '승리!', cls: 'vb-banner--win' } : { text: '패배' }
  const deuce = view.score[0] >= 14 && view.score[1] >= 14
  // 스파이크하면 화면이 잠깐 좌우로 흔들린다
  const spikeAge = view.lastHit?.kind === 'spike' ? view.tick - view.lastHit.tick : 99
  const shake = spikeAge < 10 ? 0.14 * (1 - spikeAge / 10) * (spikeAge % 2 ? 1 : -1) : 0

  return (
    <div className="vb-game">
      <div className="vb-hud">
        <span className="vb-hud__name vb-hud__name--me">
          {view.server === me && <i aria-label="서브" />}
          {myName}
        </span>
        <strong className="vb-hud__score">
          {view.score[me]} : {view.score[foe]}
        </strong>
        <span className="vb-hud__name vb-hud__name--foe">
          {foeName}
          {view.server === foe && <i aria-label="서브" />}
        </span>
      </div>
      {deuce && <p className="vb-deuce">듀스! 2점 차가 나야 끝나요</p>}

      <div className="vb-view">
        <Court sim={view} me={me} mirror={mirror} trail={frame.trail} shake={shake} />
        {banner && <div className={`vb-banner ${banner.cls ?? ''}`}>{banner.text}</div>}
      </div>

      <div className="vb-pads" aria-label="조작">
        <div className="vb-pads__move">
          {pad('left', '◀', 'vb-pad--move')}
          {pad('down', '▼', 'vb-pad--move vb-pad--down')}
          {pad('right', '▶', 'vb-pad--move')}
        </div>
        <div className="vb-pads__act">
          {pad('jump', '점프', 'vb-pad--jump')}
          {pad('hit', '치기', 'vb-pad--hit')}
        </div>
      </div>
      <p className="vb-rotate">폰을 가로로 돌리면 코트가 더 크게 보여요</p>
      <p className="vb-hint">PC: ← → 이동 · ↑ 점프 · 스페이스 치기 · 스파이크 방향: ↑ 위로 강타 · 상대 쪽 빠르게 · 반대쪽 느리게 · ↓ 내리찍기</p>

      {props.mode === 'pvp' && props.peerGone && (
        <div className="pvp-gone" role="alert">
          <strong>{props.peerName}님이 나갔어요</strong>
          <span>이 경기는 기록되지 않아요</span>
          <button type="button" className="button" onClick={props.onQuit}>
            나가기
          </button>
        </div>
      )}
    </div>
  )
}
