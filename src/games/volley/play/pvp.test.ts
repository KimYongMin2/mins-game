import { describe, expect, it } from 'vitest'
import { botInput, createBotMind } from '../bot/volleyBot'
import { STEP_HZ } from '../constants'
import { type Guest, type VolleyMsg, STATE_HZ, createGuest, guestReceive, guestStep, sameInput, withRtt } from './net'
import { type Input, NO_INPUT, type Side, type SimState, createSim, step } from './sim'

// 방장 기기(진짜 경기)와 친구 기기(예측)를 가짜 통신(한쪽 지연)으로 이어 끝까지 해 본다.
// 양쪽 다 봇이 손을 대신한다: 방장 봇은 방장 경기를, 친구 봇은 친구 화면(예측)을 보고 누른다 — 사람처럼.

function simulate(latencyMs: number, server: Side, salt: number) {
  const ms = 1000 / STEP_HZ
  let host: SimState = createSim(server)
  let guest: Guest = withRtt(createGuest(createSim(server)), latencyMs * 2)
  for (let i = 0; i < 5; i++) guest = withRtt(guest, latencyMs * 2)
  let hostMind = createBotMind(salt)
  let guestMind = createBotMind(salt + 1)
  let remote: Input = NO_INPUT
  let lastSent: Input = NO_INPUT
  const toGuest: { at: number; msg: VolleyMsg }[] = []
  const toHost: { at: number; msg: VolleyMsg }[] = []
  let maxGap = 0
  for (let k = 0; k < STEP_HZ * 60 * 25; k++) {
    const now = k * ms
    // 방장: 친구 키 받기 → 한 스텝 → 가끔 상태 보내기
    for (const m of toHost.filter((m) => m.at <= now)) if (m.msg.t === 'input') remote = m.msg.i
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
    const h = botInput(host, 0, 'normal', hostMind)
    hostMind = h.mind
    host = step(host, [h.input, remote])
    if (host.tick % (STEP_HZ / STATE_HZ) === 0 || host.phase.kind === 'done') toGuest.push({ at: now + latencyMs, msg: { t: 'state', s: host, i: [h.input, remote] } })
    // 친구: 상태 받기 → 내 키로 한 스텝 예측 → 키가 바뀌면 보내기
    for (const m of toGuest.filter((m) => m.at <= now)) if (m.msg.t === 'state') guest = guestReceive(guest, m.msg.s, m.msg.i)
    toGuest.splice(0, toGuest.length, ...toGuest.filter((m) => m.at > now))
    const g = botInput(guest.local, 1, 'normal', guestMind)
    guestMind = g.mind
    guest = guestStep(guest, g.input)
    if (!sameInput(g.input, lastSent)) {
      toHost.push({ at: now + latencyMs, msg: { t: 'input', i: g.input } })
      lastSent = g.input
    }
    // 랠리 중 공 위치가 방장과 얼마나 다른지 (같은 스텝끼리 비교는 못 하니 대략)
    if (host.phase.kind === 'rally' && guest.local.phase.kind === 'rally') maxGap = Math.max(maxGap, Math.abs(host.score[0] - guest.local.score[0]))
    if (host.phase.kind === 'done' && guest.local.phase.kind === 'done') break
  }
  return { host, guest, maxGap }
}

describe('친구 대전 (방장 심판 + 친구 예측)', () => {
  for (const latency of [0, 50, 150]) {
    it(`지연 ${latency}ms: 끝까지 가고 친구 화면도 같은 점수로 끝난다`, () => {
      for (let i = 0; i < 2; i++) {
        const { host, guest } = simulate(latency, (i % 2) as Side, latency * 10 + i)
        expect(host.phase.kind).toBe('done')
        expect(guest.local.phase).toEqual(host.phase)
        expect(guest.local.score).toEqual(host.score)
      }
    }, 120_000)
  }

  it('예측: 방장 상태를 받으면 왕복 지연만큼 앞서고, 내 키를 다시 넣어 돌린다', () => {
    const s0 = createSim(0)
    let g = withRtt(createGuest(s0), 100)
    g = { ...g, rttMs: 100 }
    // 오른쪽으로 10스텝 누름
    const right: Input = { ...NO_INPUT, right: true }
    for (let i = 0; i < 10; i++) g = guestStep(g, right)
    const before = g.local.players[1].x
    expect(before).toBeGreaterThan(s0.players[1].x)
    // 방장은 아직 친구 키를 못 받은 2스텝 시점 상태를 보냄
    let host = s0
    for (let i = 0; i < 2; i++) host = step(host, [NO_INPUT, NO_INPUT])
    g = guestReceive(g, host, [NO_INPUT, NO_INPUT])
    // 되감은 뒤에도 내가 누른 키가 다시 들어가 오른쪽으로 가 있다
    expect(g.local.tick).toBe(2 + 6)
    expect(g.local.players[1].x).toBeGreaterThan(s0.players[1].x)
    // 옛 상태는 무시
    expect(guestReceive(g, s0, [NO_INPUT, NO_INPUT])).toBe(g)
  })
})

describe('끝난 경기', () => {
  it('끝난 상태를 받아도 멈추지 않는다', () => {
    const done: SimState = { ...createSim(0), tick: 100, score: [15, 3], phase: { kind: 'done', winner: 0 } }
    const g = guestReceive(createGuest(createSim(0)), done, [NO_INPUT, NO_INPUT])
    expect(g.local.phase).toEqual({ kind: 'done', winner: 0 })
  })
})
