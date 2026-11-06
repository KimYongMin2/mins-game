import { describe, expect, it } from 'vitest'
import { withDirectLink } from './directLink'
import type { Room } from './room'

// 가짜 방(서버 경유)과 가짜 WebRTC: 설명(sdp)을 주고받으면 두 연결의 데이터 채널이 서로 이어진다.

type Msg = { t: 'state'; n: number } | { t: 'input'; n: number }

class FakeChannel {
  readyState: RTCDataChannelState = 'connecting'
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  other: FakeChannel | null = null
  sent = 0
  constructor(readonly label: string) {}
  send(data: string) {
    if (this.readyState !== 'open') throw new Error('closed')
    this.sent++
    const o = this.other
    setTimeout(() => o?.onmessage?.({ data }), 0)
  }
  open() {
    this.readyState = 'open'
    this.onopen?.()
  }
  close() {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    this.onclose?.()
  }
}

const pcs: FakePc[] = []

class FakePc {
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  onicecandidate: ((e: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  channels: FakeChannel[] = []
  /** 막힌 망 흉내: 이어지지 않음 */
  static blocked = false
  constructor() {
    pcs.push(this)
  }
  createDataChannel(label: string) {
    const ch = new FakeChannel(label)
    this.channels.push(ch)
    return ch
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: `offer-${pcs.indexOf(this)}` }
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: `answer-${pcs.indexOf(this)}` }
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d
    setTimeout(() => this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'c' }) } }), 0)
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    if (d.type !== 'answer' || FakePc.blocked) return
    // 답을 받으면 답한 연결과 잇는다
    const other = pcs[Number(d.sdp!.split('-')[1])]
    setTimeout(() => {
      for (const pc of [this, other]) pc.connectionState = 'connected'
      this.channels.forEach((ch, i) => {
        ch.other = other.channels[i]
        other.channels[i].other = ch
      })
      for (const pc of [this, other]) {
        pc.onconnectionstatechange?.()
        pc.channels.forEach((c) => c.open())
      }
    }, 5)
  }
  async addIceCandidate() {}
  close() {
    this.connectionState = 'closed'
    this.channels.forEach((c) => c.close())
  }
  cut() {
    this.connectionState = 'failed'
    this.onconnectionstatechange?.()
  }
}

function fakeRooms() {
  const fns: [Set<(m: unknown) => void>, Set<(m: unknown) => void>] = [new Set(), new Set()]
  const relayed: unknown[] = []
  const make = (i: 0 | 1): Room<Msg> => ({
    code: 'ABCD',
    role: i === 0 ? 'host' : 'guest',
    myId: i === 0 ? 'host-1' : 'guest-1',
    send(msg) {
      relayed.push(msg)
      setTimeout(() => fns[1 - i].forEach((f) => f(msg)), 2)
    },
    onMessage(fn) {
      fns[i].add(fn as (m: unknown) => void)
      return () => fns[i].delete(fn as (m: unknown) => void)
    },
    onPeer: () => () => {},
    onMembers: () => () => {},
    leave() {},
  })
  return { host: make(0), guest: make(1), relayed }
}

const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms))
const opts = { lossy: (m: Msg) => m.t === 'state', createPc: () => new FakePc() as unknown as RTCPeerConnection }

describe('직접 연결 (WebRTC)', () => {
  it('이어지면 게임 메시지는 서버를 안 거치고, 자주 오는 상태는 빠져도 되는 채널로 간다', async () => {
    FakePc.blocked = false
    const { host, guest, relayed } = fakeRooms()
    const h = withDirectLink(host, opts)
    const g = withDirectLink(guest, opts)
    const got: Msg[] = []
    g.onMessage((m) => got.push(m))
    const toHost: Msg[] = []
    h.onMessage((m) => toHost.push(m))
    await settle()
    expect(h.status()).toBe('direct')
    expect(g.status()).toBe('direct')
    const before = relayed.length
    h.send({ t: 'state', n: 1 })
    g.send({ t: 'input', n: 2 })
    await settle()
    expect(got).toEqual([{ t: 'state', n: 1 }])
    expect(toHost).toEqual([{ t: 'input', n: 2 }])
    expect(relayed.length).toBe(before)
    const hostPc = pcs.find((p) => p.channels.some((c) => c.sent > 0 && c.label === 'fast'))
    expect(hostPc).toBeDefined()
    h.leave()
    g.leave()
  })

  it('이어지기 전·막힌 망·끊긴 뒤엔 서버 경유로 보내고, 연결 정보는 게임에 안 보인다', async () => {
    FakePc.blocked = true
    const { host, guest } = fakeRooms()
    const h = withDirectLink(host, opts)
    const g = withDirectLink(guest, opts)
    const got: Msg[] = []
    g.onMessage((m) => got.push(m))
    h.send({ t: 'state', n: 1 })
    await settle()
    expect(h.status()).toBe('relay')
    expect(got).toEqual([{ t: 'state', n: 1 }])
    h.leave()
    g.leave()

    FakePc.blocked = false
    const r2 = fakeRooms()
    const h2 = withDirectLink(r2.host, opts)
    const g2 = withDirectLink(r2.guest, opts)
    const got2: Msg[] = []
    g2.onMessage((m) => got2.push(m))
    await settle()
    expect(h2.status()).toBe('direct')
    // 연결이 끊기면 서버로
    pcs.filter((p) => p.connectionState === 'connected').forEach((p) => p.cut())
    expect(h2.status()).toBe('relay')
    const before = r2.relayed.length
    h2.send({ t: 'state', n: 9 })
    await settle()
    expect(got2).toEqual([{ t: 'state', n: 9 }])
    expect(r2.relayed.length).toBe(before + 1)
    h2.leave()
    g2.leave()
  })
})
