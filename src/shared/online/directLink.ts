import type { Room } from './room'

// 방장 기기와 친구 기기를 직접(WebRTC 데이터 채널) 잇는다. Supabase 서버를 거치지 않아 지연이 훨씬 짧다.
// 1:1 게임이면 둘이, 여럿이 하는 게임이면 방장이 친구들 각자와 하나씩 잇는다(별 모양). 친구끼리는 안 잇는다
// (방장이 심판인 게임만 쓰므로 친구 메시지는 방장만 쓴다).
// 연결 정보만 방 메시지로 보내고, 이어지기 전이나 끊겼을 땐 예전처럼 방(서버 경유)으로 보낸다.
// 무료 STUN만 쓰고 중계 서버(TURN)는 안 쓴다 → 막힌 망에선 직접 연결이 안 되고 계속 서버 경유로 간다.
// 게임 규칙은 모른다: 감싼 방을 예전 방처럼 쓰면 된다.

export type LinkSignal =
  /** 친구 → 방장: 직접 연결을 청해 달라 (방장이 아직 안 듣고 있을 수 있어 이어질 때까지 가끔) */
  | { rtc: 'hello'; from: string }
  | { rtc: 'offer' | 'answer'; from: string; to: string; sdp: string; gen: number }
  | { rtc: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit; gen: number }

/** 서버 경유로 보내는 게임 메시지 겉봉. skip: 이미 직접 받은 사람 (두 번 받지 않게) */
type Relayed = { dl: 1; m: unknown; skip?: string[] }

export type LinkStatus = 'relay' | 'direct'

export interface DirectRoom<M> extends Room<M> {
  /** 지금 메시지가 가는 길: 직접(direct) / 서버 경유(relay). 방장은 친구 모두와 직접 이어졌을 때만 direct */
  status(): LinkStatus
  onStatus(fn: (s: LinkStatus) => void): () => void
}

type Options<M> = {
  /** 빠졌다 해도 괜찮은 메시지 (자주 보내는 상태 등). 직접 연결에선 다시 보내지 않고 순서도 안 지키는 채널로 → 늦은 패킷이 뒤를 막지 않음.
   *  순서가 바뀌어 와도 괜찮은 메시지만 (예: 스텝 번호가 있어 옛것을 버리는 상태) */
  lossy?: (msg: M) => boolean
  /** 테스트에서 가짜 연결을 넣을 때만 */
  createPc?: (config: RTCConfiguration) => RTCPeerConnection
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
/** 친구가 hello를 다시 보내는 간격·횟수 (그 뒤엔 서버 경유로 계속) */
const HELLO_MS = 2000
const MAX_HELLOS = 8
/** 방장: 청한 연결이 이만큼 안 이어지면 hello에 새로 청한다 */
const OFFER_TIMEOUT_MS = 5000

const isSignal = (m: unknown): m is LinkSignal => typeof m === 'object' && m !== null && 'rtc' in m
const isRelayed = (m: unknown): m is Relayed => typeof m === 'object' && m !== null && (m as Relayed).dl === 1

type Link = { peer: string; pc: RTCPeerConnection; rel: RTCDataChannel; fast: RTCDataChannel; gen: number; at: number; remoteSet: boolean; pendingIce: RTCIceCandidateInit[] }

// 망이 잠깐 끊기면(disconnected) 채널은 열린 채로 메시지가 안 가서, 연결이 살아 있을 때만 직접 보낸다
const isUp = (l: Link | undefined): boolean => !!l && l.pc.connectionState === 'connected' && l.rel.readyState === 'open' && l.fast.readyState === 'open'

export function withDirectLink<M>(room: Room<M>, opts: Options<M> = {}): DirectRoom<M> {
  const raw = room as unknown as Room<M | LinkSignal | Relayed>
  const me = room.myId
  const isHost = room.role === 'host'
  const messageFns = new Set<(msg: M) => void>()
  const statusFns = new Set<(s: LinkStatus) => void>()
  let status: LinkStatus = 'relay'
  let closed = false
  /** 상대별 연결 (친구 기기엔 방장 하나) */
  const links = new Map<string, Link>()
  /** 이을 수 있는 상대: 친구 기기 = 방장, 방장 기기 = 방에 있는 친구들 (보안: 방 밖에서 온 연결 요청으로 가로채지 못하게) */
  let peers: string[] = []

  const deliver = (msg: M) => {
    for (const fn of messageFns) fn(msg)
  }
  const refresh = () => {
    const next: LinkStatus = peers.length > 0 && peers.every((p) => isUp(links.get(p))) ? 'direct' : 'relay'
    if (next === status) return
    status = next
    for (const fn of statusFns) fn(next)
  }

  function drop(peer: string) {
    const l = links.get(peer)
    if (!l) return
    links.delete(peer)
    l.pc.onicecandidate = l.pc.onconnectionstatechange = null
    l.rel.onopen = l.rel.onclose = l.rel.onmessage = null
    l.fast.onopen = l.fast.onclose = l.fast.onmessage = null
    l.pc.close()
    refresh()
  }

  function makeLink(peer: string, gen: number): Link {
    drop(peer)
    const pc = (opts.createPc ?? ((c) => new RTCPeerConnection(c)))({ iceServers: ICE_SERVERS })
    // 양쪽이 같은 번호로 미리 만들어 두면(negotiated) 상대가 열 때까지 기다릴 필요가 없다
    const rel = pc.createDataChannel('rel', { negotiated: true, id: 0 })
    const fast = pc.createDataChannel('fast', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 })
    const l: Link = { peer, pc, rel, fast, gen, at: Date.now(), remoteSet: false, pendingIce: [] }
    links.set(peer, l)
    const current = () => links.get(peer) === l
    const onMessage = (e: MessageEvent) => {
      if (!current() || typeof e.data !== 'string') return
      try {
        deliver(JSON.parse(e.data) as M)
      } catch {
        // 깨진 메시지는 버린다
      }
    }
    for (const ch of [rel, fast]) {
      ch.onopen = ch.onclose = () => current() && refresh()
      ch.onmessage = onMessage
    }
    pc.onicecandidate = (e) => {
      if (e.candidate && current()) raw.send({ rtc: 'ice', from: me, to: peer, candidate: e.candidate.toJSON(), gen })
    }
    pc.onconnectionstatechange = () => {
      if (!current()) return
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop(peer)
      else refresh()
    }
    return l
  }

  async function offer(peer: string) {
    const l = makeLink(peer, (links.get(peer)?.gen ?? 0) + 1)
    try {
      await l.pc.setLocalDescription(await l.pc.createOffer())
      if (links.get(peer) === l) raw.send({ rtc: 'offer', from: me, to: peer, sdp: l.pc.localDescription!.sdp, gen: l.gen })
    } catch (e) {
      console.warn('[direct] 연결 청하기 실패', e)
    }
  }

  async function answer(peer: string, sdp: string, gen: number) {
    const l = makeLink(peer, gen)
    try {
      await l.pc.setRemoteDescription({ type: 'offer', sdp })
      await remoteReady(l)
      await l.pc.setLocalDescription(await l.pc.createAnswer())
      if (links.get(peer) === l) raw.send({ rtc: 'answer', from: me, to: peer, sdp: l.pc.localDescription!.sdp, gen })
    } catch (e) {
      console.warn('[direct] 연결 받기 실패', e)
    }
  }

  async function remoteReady(l: Link) {
    l.remoteSet = true
    for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => {})
  }

  const offMembers = room.onMembers((ms) => {
    peers = isHost ? ms.filter((m) => m.role === 'guest').map((m) => m.id) : ms.filter((m) => m.role === 'host').map((m) => m.id)
    // 나간 사람과의 연결은 끊는다
    for (const peer of [...links.keys()]) if (!peers.includes(peer)) drop(peer)
    refresh()
  })

  function onSignal(s: LinkSignal) {
    if (s.from === me || !peers.includes(s.from)) return
    if (s.rtc !== 'hello' && s.to !== me) return
    const l = links.get(s.from)
    if (s.rtc === 'hello') {
      if (!isHost) return
      // 이어져 있거나 막 청한 참이면 그대로
      if (l && (isUp(l) || Date.now() - l.at < OFFER_TIMEOUT_MS)) return
      void offer(s.from)
    } else if (s.rtc === 'offer') {
      // 이미 직접 이어져 있으면 새 요청은 무시 (방장 이름을 사칭해 가로채는 것 막기). 끊기면 다시 받는다
      if (!isHost && !isUp(l)) void answer(s.from, s.sdp, s.gen)
    } else if (s.rtc === 'answer') {
      if (l && l.gen === s.gen && !l.remoteSet) {
        l.pc
          .setRemoteDescription({ type: 'answer', sdp: s.sdp })
          .then(() => remoteReady(l))
          .catch((e) => console.warn('[direct] 연결 답 받기 실패', e))
      }
    } else if (s.rtc === 'ice') {
      if (!l || l.gen !== s.gen) return
      if (!l.remoteSet) l.pendingIce.push(s.candidate)
      else void l.pc.addIceCandidate(s.candidate).catch(() => {})
    }
  }

  const offRaw = raw.onMessage((msg) => {
    if (isSignal(msg)) onSignal(msg)
    else if (isRelayed(msg)) {
      if (!msg.skip?.includes(me)) deliver(msg.m as M)
    }
  })

  // 친구: 이어질 때까지 가끔 hello (방장이 나중에 들어와도, 끊겼다가도 다시)
  let hellos = 0
  const helloTimer = !isHost
    ? setInterval(() => {
        if (status === 'direct') {
          hellos = 0
          return
        }
        if (hellos >= MAX_HELLOS) return
        hellos++
        raw.send({ rtc: 'hello', from: me })
      }, HELLO_MS)
    : undefined
  if (!isHost) raw.send({ rtc: 'hello', from: me })

  /** 한 상대에게 직접 보낸다. 못 보냈으면 false */
  function sendDirect(l: Link, data: string, lossy: boolean): boolean {
    try {
      ;(lossy ? l.fast : l.rel).send(data)
      return true
    } catch {
      return false
    }
  }

  return {
    code: room.code,
    role: room.role,
    myId: room.myId,
    send(msg) {
      if (closed) return
      const data = JSON.stringify(msg)
      const lossy = !!opts.lossy?.(msg)
      // 직접 이어진 상대에겐 직접, 나머지는 서버로 한 번 (직접 받은 사람은 건너뛰게 표시)
      const sent = peers.filter((p) => {
        const l = links.get(p)
        return !!l && isUp(l) && sendDirect(l, data, lossy)
      })
      if (sent.length < peers.length || peers.length === 0) raw.send({ dl: 1, m: msg, skip: sent.length ? sent : undefined })
    },
    onMessage(fn) {
      messageFns.add(fn)
      return () => messageFns.delete(fn)
    },
    onPeer: (fn) => room.onPeer(fn),
    onMembers: (fn) => room.onMembers(fn),
    setPlaying: (p) => room.setPlaying(p),
    status: () => status,
    onStatus(fn) {
      statusFns.add(fn)
      return () => statusFns.delete(fn)
    },
    leave() {
      if (closed) return
      closed = true
      clearInterval(helloTimer)
      offRaw()
      offMembers()
      messageFns.clear()
      statusFns.clear()
      for (const peer of [...links.keys()]) drop(peer)
      room.leave()
    },
  }
}
