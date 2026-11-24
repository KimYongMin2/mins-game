import { BotDriver } from '../../games/island/bot/islandBot'
import { type CarveRow, type RosterPlayer, clampAim, clampPower, clampTarget, encodeSnap, isWeapon } from '../../games/island/play/net'
import { type Fx, type Keys, NO_KEYS, type Team, World } from '../../games/island/play/world'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, serverSeed } from './common'

// 동물 섬 대작전 서버 심판: 서버가 섬을 1초에 60번 돌리고 1초에 30번 상태를 보낸다. 섬 모양은 씨앗값으로 폰이 같게 만들고,
// 파인 곳은 번호를 붙여 이어 보냄(중간에 들어오거나 놓치면 hello로 처음부터). 사람은 두 팀에 번갈아(0,1,0,1), 같은 팀은 차례마다 돌아가며 조작.
// 봇 자리는 서버가 봇처럼 둠.

const STEP_MS = 1000 / 60
const MAX_CATCHUP = 10
const SEND_EVERY = 2

export function islandReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 4)
  if (!players) return null
  const seed = serverSeed()
  const w = new World(seed)
  const roster: (RosterPlayer & { gone: boolean })[] = players.map((p, i) => ({ id: p.id, name: p.name, kind: p.kind, team: (i % 2) as Team, gone: false }))
  const bots = new Map(roster.filter((p) => p.kind === 'bot').map((p, i) => [p.id, new BotDriver('normal', seed + i + 1)]))
  const turns: [number, number] = [0, 0]
  const carveLog: CarveRow[] = []
  let fxBuf: Fx[] = []
  let sentCarves = 0
  let keys: Keys = NO_KEYS
  let lastTurn = w.turnNo
  let lastTeam = w.team
  let lastPhase = w.phase
  let steps = 0
  const t0 = ctx.now()
  let overAt: number | null = null

  const pickCtl = () => {
    const list = roster.filter((p) => p.team === w.team && !p.gone)
    return list.length ? list[turns[w.team] % list.length].id : ''
  }
  let ctl = pickCtl()

  const drain = () => {
    for (const c of w.carves) carveLog.push([Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.r, c.ring ? 1 : 0])
    w.carves.length = 0
    fxBuf.push(...w.fx)
    w.fx.length = 0
  }
  const send = () => {
    const fresh = carveLog.slice(sentCarves)
    ctx.broadcast({ t: 'snap', sd: seed, ...encodeSnap(w, ctl, sentCarves, fresh, fxBuf) })
    sentCarves = carveLog.length
    fxBuf = []
  }
  const checkTeams = () => {
    for (const t of [0, 1] as const) if (!roster.some((p) => p.team === t && !p.gone)) w.forfeit(t)
  }

  return {
    tickMs: STEP_MS,
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t === 'hello') {
        ctx.sendTo(from, { t: 'init', seed, players: roster.map(({ id, name, kind, team }) => ({ id, name, kind, team })), carves: carveLog.slice(0, sentCarves) })
        return true
      }
      if (!['keys', 'aim', 'press', 'release', 'jump', 'pick', 'target'].includes(m.t as string)) return false
      // 차례인 사람만, 고르는 동안만
      if (from !== ctl || !w.canAct()) return true
      if (m.t === 'keys') keys = { left: m.l === true, right: m.r === true, up: false, down: false }
      else if (m.t === 'aim') {
        const a = clampAim(m.a)
        if (a !== null) w.aim = a
      } else if (m.t === 'press') w.press()
      else if (m.t === 'release') {
        const p = clampPower(m.p)
        if (w.charging && p !== null) w.fire(p)
      } else if (m.t === 'jump') w.jump()
      else if (m.t === 'pick' && isWeapon(m.w)) w.pick(m.w)
      else if (m.t === 'target') {
        const x = clampTarget(m.x)
        if (x !== null) w.setTarget(x)
      }
      return true
    },
    tick(now) {
      const target = Math.floor((now - t0) / STEP_MS)
      let n = 0
      let force = false
      while (steps < target && n < MAX_CATCHUP) {
        const bot = bots.get(ctl)
        if (bot) bot.step(w)
        w.step(bot ? NO_KEYS : keys)
        drain()
        steps++
        n++
        if (w.turnNo !== lastTurn) {
          turns[lastTeam]++
          lastTurn = w.turnNo
          lastTeam = w.team
          ctl = pickCtl()
          keys = NO_KEYS
          force = true
        }
        if (w.phase !== lastPhase) {
          lastPhase = w.phase
          force = true
        }
      }
      if (n > 0 && (force || steps % SEND_EVERY === 0)) send()
      if (overAt === null && w.phase === 'over') overAt = now
    },
    leave(key) {
      const p = roster.find((x) => x.id === key)
      if (!p || p.gone) return
      p.gone = true
      if (ctl === key) {
        ctl = pickCtl()
        keys = NO_KEYS
      }
      checkTeams()
      drain()
      send()
    },
    finished: () => overAt !== null && ctx.now() - overAt > 5000,
  }
}
