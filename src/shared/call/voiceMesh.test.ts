import { describe, expect, it } from 'vitest'
import { type CallSignal, VoiceMesh, offersTo } from './voiceMesh'

// 가짜 연결: 설명(sdp)을 주고받으면 '연결됨'이 된다. 소리는 다루지 않는다.
class FakePc {
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  onicecandidate: ((e: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null
  ontrack: (() => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  private transceivers: { direction: string; sender: { track: unknown; replaceTrack: (t: unknown) => Promise<void>; getParameters: () => object; setParameters: () => Promise<void> } }[] = []
  ice = 0

  addTransceiver(_kind: string, init: { direction: string }) {
    const t = {
      direction: init.direction,
      sender: {
        track: null as unknown,
        replaceTrack(track: unknown) {
          this.track = track
          return Promise.resolve()
        },
        getParameters: () => ({ encodings: [] }),
        setParameters: () => Promise.resolve(),
      },
    }
    this.transceivers.push(t)
    return t
  }
  getTransceivers() {
    return this.transceivers
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'offer' }
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer' }
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d
    setTimeout(() => this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'c' }) } }), 0)
    if (d.type === 'answer') this.connect()
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    if (d.type === 'offer' && this.transceivers.length === 0) this.addTransceiver('audio', { direction: 'recvonly' })
    if (d.type === 'answer') this.connect()
  }
  async addIceCandidate() {
    this.ice++
  }
  close() {
    this.connectionState = 'closed'
  }
  private connect() {
    setTimeout(() => {
      this.connectionState = 'connected'
      this.onconnectionstatechange?.()
    }, 0)
  }
}

const settle = () => new Promise((r) => setTimeout(r, 30))

function network(ids: string[]) {
  const sent: CallSignal[] = []
  const meshes = new Map<string, VoiceMesh>()
  for (const id of ids) {
    meshes.set(
      id,
      new VoiceMesh({
        myId: id,
        // 방 메시지처럼 모두에게 (조금 늦게)
        send: (msg) => {
          sent.push(msg)
          setTimeout(() => meshes.forEach((m) => m.receive(msg)), 1)
        },
        onChange: () => {},
        createPc: () => new FakePc() as unknown as RTCPeerConnection,
      }),
    )
  }
  return { meshes, sent }
}

describe('음성 통화 (메시)', () => {
  it('둘 중 한쪽만 연결을 청한다', () => {
    expect(offersTo('a', 'b')).toBe(true)
    expect(offersTo('b', 'a')).toBe(false)
  })

  it('네 명이 서로 다 이어지고, 한 쌍에 청하기는 한 번', async () => {
    const ids = ['host-1', 'guest-2', 'guest-3', 'guest-4']
    const { meshes, sent } = network(ids)
    for (const id of ids) meshes.get(id)!.setMembers(ids.filter((x) => x !== id))
    await settle()
    for (const m of meshes.values()) {
      expect(m.peers()).toHaveLength(3)
      expect(m.peers().every((p) => p.connection === 'connected')).toBe(true)
    }
    expect(sent.filter((m) => m.t === 'offer')).toHaveLength(6)
  })

  it('늦게 들어온 사람도 이어지고, 나간 사람은 끊긴다', async () => {
    const { meshes } = network(['a', 'b', 'c'])
    meshes.get('a')!.setMembers(['b'])
    meshes.get('b')!.setMembers(['a'])
    await settle()
    for (const [id, m] of meshes) m.setMembers(['a', 'b', 'c'].filter((x) => x !== id))
    await settle()
    expect(meshes.get('c')!.peers().map((p) => p.id).sort()).toEqual(['a', 'b'])
    meshes.get('a')!.setMembers(['b'])
    expect(meshes.get('a')!.peers().map((p) => p.id)).toEqual(['b'])
  })

  it('마이크를 끄면 상대 화면에 꺼짐', async () => {
    const { meshes } = network(['a', 'b'])
    meshes.get('a')!.setMembers(['b'])
    meshes.get('b')!.setMembers(['a'])
    await settle()
    meshes.get('a')!.setMicOn(false)
    await settle()
    expect(meshes.get('b')!.peers()[0].micOn).toBe(false)
    meshes.get('a')!.setMicOn(true)
    await settle()
    expect(meshes.get('b')!.peers()[0].micOn).toBe(false) // 마이크 트랙이 없으면 켜도 '꺼짐'
  })
})
