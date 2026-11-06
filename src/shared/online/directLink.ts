import type { Room } from './room'

// 1:1 방에서 기기끼리 직접(WebRTC 데이터 채널) 메시지를 주고받는다. Supabase 서버를 거치지 않아 지연이 훨씬 짧다.
// 연결 정보만 방 메시지로 보내고, 이어지기 전이나 끊겼을 땐 예전처럼 방(서버 경유)으로 보낸다.
// 무료 STUN만 쓰고 중계 서버(TURN)는 안 쓴다 → 막힌 망에선 직접 연결이 안 되고 계속 서버 경유로 간다.
// 게임 규칙은 모른다: 감싼 방을 예전 방처럼 쓰면 된다.

export type LinkSignal =
  /** 친구 → 방장: 직접 연결을 청해 달라 (방장이 아직 안 듣고 있을 수 있어 이어질 때까지 가끔) */
  | { rtc: 'hello'; from: string }
  | { rtc: 'offer' | 'answer'; from: string; sdp: string; gen: number }
  | { rtc: 'ice'; from: string; candidate: RTCIceCandidateInit; gen: number }

export type LinkStatus = 'relay' | 'direct'

export interface DirectRoom<M> extends Room<M> {
  /** 지금 메시지가 가는 길: 직접(direct) / 서버 경유(relay) */
  status(): LinkStatus
  onStatus(fn: (s: LinkStatus) => void): () => void
}

type Options<M> = {
  /** 빠졌다 해도 괜찮은 메시지 (자주 보내는 상태 등). 직접 연결에선 다시 보내지 않고 순서도 안 지키는 채널로 → 늦은 패킷이 뒤를 막지 않음 */
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

export function withDirectLink<M>(room: Room<M>, opts: Options<M> = {}): DirectRoom<M> {
  const raw = room as unknown as Room<M | LinkSignal>
  const me = room.myId
  const messageFns = new Set<(msg: M) => void>()
  const statusFns = new Set<(s: LinkStatus) => void>()
  let status: LinkStatus = 'relay'
  let closed = false

  type Link = { pc: RTCPeerConnection; rel: RTCDataChannel; fast: RTCDataChannel; gen: number; at: number; remoteSet: boolean; pendingIce: RTCIceCandidateInit[] }
  let link: Link | null = null

  const deliver = (msg: M) => {
    for (const fn of messageFns) fn(msg)
  }
  const setStatus = (s: LinkStatus) => {
    if (s === status) return
    status = s
    for (const fn of statusFns) fn(s)
  }
  // 망이 잠깐 끊기면(disconnected) 채널은 열린 채로 메시지가 안 가서, 연결이 살아 있을 때만 직접 보낸다
  const refresh = () =>
    setStatus(link && link.pc.connectionState === 'connected' && link.rel.readyState === 'open' && link.fast.readyState === 'open' ? 'direct' : 'relay')

  function drop() {
    if (!link) return
    const l = link
    link = null
    l.pc.onicecandidate = l.pc.onconnectionstatechange = null
    l.rel.onopen = l.rel.onclose = l.rel.onmessage = null
    l.fast.onopen = l.fast.onclose = l.fast.onmessage = null
    l.pc.close()
    refresh()
  }

  function makeLink(gen: number): Link {
    drop()
    const pc = (opts.createPc ?? ((c) => new RTCPeerConnection(c)))({ iceServers: ICE_SERVERS })
    // 양쪽이 같은 번호로 미리 만들어 두면(negotiated) 상대가 열 때까지 기다릴 필요가 없다
    const rel = pc.createDataChannel('rel', { negotiated: true, id: 0 })
    const fast = pc.createDataChannel('fast', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 })
    const l: Link = { pc, rel, fast, gen, at: Date.now(), remoteSet: false, pendingIce: [] }
    link = l
    const onMessage = (e: MessageEvent) => {
      if (link !== l || typeof e.data !== 'string') return
      try {
        deliver(JSON.parse(e.data) as M)
      } catch {
        // 깨진 메시지는 버린다
      }
    }
    for (const ch of [rel, fast]) {
      ch.onopen = ch.onclose = () => link === l && refresh()
      ch.onmessage = onMessage
    }
    pc.onicecandidate = (e) => {
      if (e.candidate && link === l) raw.send({ rtc: 'ice', from: me, candidate: e.candidate.toJSON(), gen })
    }
    pc.onconnectionstatechange = () => {
      if (link !== l) return
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop()
      else refresh()
    }
    return l
  }

  async function offer() {
    const l = makeLink((link?.gen ?? 0) + 1)
    try {
      await l.pc.setLocalDescription(await l.pc.createOffer())
      if (link === l) raw.send({ rtc: 'offer', from: me, sdp: l.pc.localDescription!.sdp, gen: l.gen })
    } catch (e) {
      console.warn('[direct] 연결 청하기 실패', e)
    }
  }

  async function answer(sdp: string, gen: number) {
    const l = makeLink(gen)
    try {
      await l.pc.setRemoteDescription({ type: 'offer', sdp })
      await remoteReady(l)
      await l.pc.setLocalDescription(await l.pc.createAnswer())
      if (link === l) raw.send({ rtc: 'answer', from: me, sdp: l.pc.localDescription!.sdp, gen })
    } catch (e) {
      console.warn('[direct] 연결 받기 실패', e)
    }
  }

  async function remoteReady(l: Link) {
    l.remoteSet = true
    for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => {})
  }

  // 보안: 방에 있는 상대하고만 잇는다 (친구는 방장, 방장은 방에 들어온 친구). 방 밖에서 보낸 연결 요청으로 가로채지 못하게
  let peerId: string | null = null
  const offMembers = room.onMembers((ms) => {
    peerId = (room.role === 'guest' ? ms.find((m) => m.role === 'host') : ms.find((m) => m.role === 'guest'))?.id ?? null
  })

  function onSignal(s: LinkSignal) {
    if (s.from === me || s.from !== peerId) return
    if (s.rtc === 'hello') {
      if (room.role !== 'host') return
      // 이어져 있거나 막 청한 참이면 그대로
      if (link && (status === 'direct' || Date.now() - link.at < OFFER_TIMEOUT_MS)) return
      void offer()
    } else if (s.rtc === 'offer') {
      // 이미 직접 이어져 있으면 새 요청은 무시 (방장 이름을 사칭해 가로채는 것 막기). 끊기면 다시 받는다
      if (room.role === 'guest' && status !== 'direct') void answer(s.sdp, s.gen)
    } else if (s.rtc === 'answer') {
      if (link && link.gen === s.gen && !link.remoteSet) {
        const l = link
        l.pc
          .setRemoteDescription({ type: 'answer', sdp: s.sdp })
          .then(() => remoteReady(l))
          .catch((e) => console.warn('[direct] 연결 답 받기 실패', e))
      }
    } else if (s.rtc === 'ice') {
      if (!link || link.gen !== s.gen) return
      if (!link.remoteSet) link.pendingIce.push(s.candidate)
      else void link.pc.addIceCandidate(s.candidate).catch(() => {})
    }
  }

  const offRaw = raw.onMessage((msg) => {
    if (isSignal(msg)) onSignal(msg)
    else deliver(msg)
  })

  // 친구: 이어질 때까지 가끔 hello (방장이 나중에 들어와도, 끊겼다가도 다시)
  let hellos = 0
  const helloTimer =
    room.role === 'guest'
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
  if (room.role === 'guest') raw.send({ rtc: 'hello', from: me })

  return {
    code: room.code,
    role: room.role,
    myId: room.myId,
    send(msg) {
      if (closed) return
      const l = link
      if (l && status === 'direct') {
        const ch = opts.lossy?.(msg) ? l.fast : l.rel
        try {
          ch.send(JSON.stringify(msg))
          return
        } catch {
          // 막 끊겼으면 서버로
        }
      }
      raw.send(msg)
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
      closed = true
      clearInterval(helloTimer)
      offRaw()
      offMembers()
      messageFns.clear()
      statusFns.clear()
      drop()
      room.leave()
    },
  }
}
