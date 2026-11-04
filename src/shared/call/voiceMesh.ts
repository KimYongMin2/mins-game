// 음성 통화: 방에 있는 사람끼리 서로 다 잇는다(메시). 소리는 기기끼리 직접(WebRTC) 주고받고, 연결 정보만 방 메시지로 보낸다.
// 중계 서버(TURN)는 유료라 안 쓰고 무료 STUN만 쓴다. 그래서 막힌 망(일부 휴대폰 데이터·회사망)에선 연결이 안 될 수 있다.
// 방(Room)이나 게임은 모른다: 보낼 메시지를 send로 넘기고, 받은 메시지를 receive로 받는다.

export type CallSignal =
  | { t: 'offer' | 'answer'; from: string; to: string; sdp: string }
  | { t: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  /** 내 마이크 켬/끔 (모두에게) */
  | { t: 'mic'; from: string; on: boolean }

export type Connection = 'connecting' | 'connected' | 'failed'

export type CallPeer = { id: string; connection: Connection; micOn: boolean; stream: MediaStream | null }

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

/** 음성 최대 비트레이트: 말소리엔 충분하고 데이터를 아낀다 (한 사람과 1시간에 약 10MB) */
export const VOICE_BITRATE = 24_000
/** 연결이 끊기면 이만큼 뒤 한 번 더 청한다 */
const RETRY_MS = 1500
const MAX_RETRIES = 2

/** 둘 중 누가 연결을 청하나 (둘이 동시에 청해서 꼬이지 않게 한쪽만) */
export const offersTo = (myId: string, otherId: string) => myId < otherId

type Link = { pc: RTCPeerConnection; peer: CallPeer; pendingIce: RTCIceCandidateInit[]; remoteSet: boolean }

type Options = {
  myId: string
  send: (msg: CallSignal) => void
  /** 사람·연결·소리가 바뀌면 (화면을 다시 그리게) */
  onChange: () => void
  /** 테스트에서 가짜 연결을 넣을 때만 */
  createPc?: (config: RTCConfiguration) => RTCPeerConnection
}

export class VoiceMesh {
  private links = new Map<string, Link>()
  private track: MediaStreamTrack | null = null
  private micOn = true
  private members: string[] = []
  private retries = new Map<string, number>()
  private closed = false
  private opts: Options

  constructor(opts: Options) {
    this.opts = opts
  }

  peers(): CallPeer[] {
    return [...this.links.values()].map((l) => l.peer)
  }

  get mic(): boolean {
    return this.micOn
  }

  /** 방에 있는 사람들 (나 빼고). 새로 온 사람은 내가 청할 쪽이면 연결을 청하고, 나간 사람은 끊는다 */
  setMembers(ids: string[]) {
    this.members = ids
    for (const id of [...this.links.keys()]) if (!ids.includes(id)) this.drop(id)
    for (const id of ids) if (!this.links.has(id) && offersTo(this.opts.myId, id)) void this.offer(id)
    this.opts.onChange()
  }

  /** 내 마이크 (없으면 null = 듣기만) */
  setTrack(track: MediaStreamTrack | null) {
    this.track = track
    if (track) track.enabled = this.micOn
    for (const l of this.links.values()) void this.senderOf(l.pc)?.replaceTrack(track)
    this.sendMic()
    this.opts.onChange()
  }

  setMicOn(on: boolean) {
    this.micOn = on
    if (this.track) this.track.enabled = on
    this.sendMic()
    this.opts.onChange()
  }

  receive(msg: CallSignal) {
    if (this.closed || msg.from === this.opts.myId) return
    if (msg.t === 'mic') {
      const l = this.links.get(msg.from)
      if (l) {
        l.peer = { ...l.peer, micOn: msg.on }
        this.opts.onChange()
      }
      return
    }
    if (msg.to !== this.opts.myId) return
    if (msg.t === 'offer') void this.answer(msg.from, msg.sdp)
    else if (msg.t === 'answer') void this.accept(msg.from, msg.sdp)
    else if (msg.t === 'ice') void this.addIce(msg.from, msg.candidate)
  }

  close() {
    this.closed = true
    for (const id of [...this.links.keys()]) this.drop(id)
  }

  private sendMic() {
    this.opts.send({ t: 'mic', from: this.opts.myId, on: this.micOn && !!this.track })
  }

  private senderOf(pc: RTCPeerConnection): RTCRtpSender | undefined {
    return pc.getTransceivers()[0]?.sender
  }

  private link(id: string): Link {
    this.drop(id)
    const pc = (this.opts.createPc ?? ((c) => new RTCPeerConnection(c)))({ iceServers: ICE_SERVERS })
    const l: Link = { pc, peer: { id, connection: 'connecting', micOn: true, stream: null }, pendingIce: [], remoteSet: false }
    this.links.set(id, l)
    const update = (peer: Partial<CallPeer>) => {
      if (this.links.get(id) !== l) return
      l.peer = { ...l.peer, ...peer }
      this.opts.onChange()
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.opts.send({ t: 'ice', from: this.opts.myId, to: id, candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => update({ stream: e.streams[0] ?? new MediaStream([e.track]) })
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        this.retries.delete(id)
        update({ connection: 'connected' })
        this.limitBitrate(pc)
        // 새로 이어진 사람도 내 마이크 상태를 알게
        this.sendMic()
      } else if (s === 'failed') {
        update({ connection: 'failed' })
        this.retry(id)
      }
    }
    return l
  }

  private retry(id: string) {
    if (!offersTo(this.opts.myId, id)) return
    const n = this.retries.get(id) ?? 0
    if (n >= MAX_RETRIES) return
    this.retries.set(id, n + 1)
    setTimeout(() => {
      if (!this.closed && this.members.includes(id) && this.links.get(id)?.peer.connection === 'failed') void this.offer(id)
    }, RETRY_MS)
  }

  private limitBitrate(pc: RTCPeerConnection) {
    const sender = this.senderOf(pc)
    if (!sender) return
    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]
      params.encodings[0].maxBitrate = VOICE_BITRATE
      void sender.setParameters(params).catch(() => {})
    } catch {
      // 못 줄이는 브라우저는 기본 음질로
    }
  }

  private async offer(id: string) {
    const l = this.link(id)
    const { pc } = l
    const t = pc.addTransceiver('audio', { direction: 'sendrecv' })
    if (this.track) await t.sender.replaceTrack(this.track)
    try {
      await pc.setLocalDescription(await pc.createOffer())
      if (this.links.get(id) !== l) return
      this.opts.send({ t: 'offer', from: this.opts.myId, to: id, sdp: pc.localDescription!.sdp })
    } catch (e) {
      console.warn('[call] 연결 청하기 실패', e)
    }
  }

  private async answer(id: string, sdp: string) {
    const l = this.link(id)
    const { pc } = l
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp })
      await this.remoteReady(l)
      const t = pc.getTransceivers()[0]
      if (t) {
        t.direction = 'sendrecv'
        if (this.track) await t.sender.replaceTrack(this.track)
      }
      await pc.setLocalDescription(await pc.createAnswer())
      if (this.links.get(id) !== l) return
      this.opts.send({ t: 'answer', from: this.opts.myId, to: id, sdp: pc.localDescription!.sdp })
    } catch (e) {
      console.warn('[call] 연결 받기 실패', e)
    }
  }

  private async accept(id: string, sdp: string) {
    const l = this.links.get(id)
    if (!l || l.remoteSet) return
    try {
      await l.pc.setRemoteDescription({ type: 'answer', sdp })
      await this.remoteReady(l)
    } catch (e) {
      console.warn('[call] 연결 답 받기 실패', e)
    }
  }

  /** 상대 정보를 받기 전에 온 연결 후보는 모아 뒀다가 넣는다 */
  private async remoteReady(l: Link) {
    l.remoteSet = true
    for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => {})
  }

  private async addIce(id: string, candidate: RTCIceCandidateInit) {
    const l = this.links.get(id)
    if (!l) return
    if (!l.remoteSet) l.pendingIce.push(candidate)
    else await l.pc.addIceCandidate(candidate).catch(() => {})
  }

  private drop(id: string) {
    const l = this.links.get(id)
    if (!l) return
    this.links.delete(id)
    l.pc.onicecandidate = l.pc.ontrack = l.pc.onconnectionstatechange = null
    l.pc.close()
  }
}
