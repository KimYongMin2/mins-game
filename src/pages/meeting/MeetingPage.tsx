import { useEffect, useMemo, useRef, useState } from 'react'
import { HomeLink } from '../../shared/ui/HomeLink'
import { levelContext, watchLevel } from '../../shared/call/level'
import { LISTEN_VOLUME, PERSON_VOLUME, Speaker } from '../../shared/call/speaker'
import { DEFAULT_VOICE_SETTINGS, MIC_VOLUME, VoiceChanger, type VoiceSettings } from '../../shared/call/voiceFx'
import type { CallPeer } from '../../shared/call/voiceMesh'
import { SfuCall } from '../../shared/call/sfuCall'
import { SFU_URL, sfuToken } from '../../shared/call/sfuToken'
import { type Member, type Room, RoomError, createRoom, joinRoom, makeRoomCode } from '../../shared/online/room'
import { advertiseRoom, cleanId, cleanList, cleanName, isInt, watchRooms } from '../../shared/online/roomList'
import { readLocal, writeLocal } from '../../shared/storage/local'
import { loadNickname } from '../../shared/storage/nickname'
import { VoiceSettingsDialog } from './VoicePanel'
import { VOICE_EFFECTS } from '../../shared/call/voiceFx'
import { AvatarFace } from '../../shared/ui/AvatarFace'
import { IconMessage, IconMic, IconMicOff, IconPhoneOff, IconSend, IconSliders, IconVolume, IconVolumeOff, IconWave } from '../../shared/ui/icons'
import { ANIMAL_EMOJI, decodeLook, encodeLook } from '../../shared/art3d/animalKinds'
import { loadLook } from '../../shared/storage/avatar'
import { CHAT_MAX, type ChatLine, type ChatSignal, type MeetMsg, cleanChat, diffMembers, pushLine, readChat } from './chat'
import { playChat, playJoin, playLeave } from './sounds'
import './meeting.css'

// 회의방: 열린 방 목록에서 골라 들어가 음성 통화. 방장이 방을 만들 때 이름과 전체 공개/비공개(코드)를 정한다.
// 비공개 방도 목록에 🔒로 보이고, 누르면 코드를 물어본다. 코드는 방 채널 이름에 들어가 있어서 틀리면 '방 없음'이 된다.
// 방 목록·사람 목록은 게임과 같은 방(Supabase Realtime), 소리는 우리 음성 서버(LiveKit, 2026-11-16부터 — 기기끼리 직접은 막힌 망에서 안 돼서).
// 들어갈 때 마이크를 허락받는다. 거절하면 듣기만 (나중에 다시 허락할 수 있음).

/** 정원 (나 포함). 음성 서버가 나눠 줘서 늘림 (api/livekit-token.ts의 CAPACITY와 같게) */
const CAPACITY = 16
const ROOM_ID = 'meeting'
/** 비공개 방 코드 자리 수 (숫자) */
const PIN_LENGTH = 4
const NAME_MAX = 20

/** 소리 크기는 기기에 기억한다 */
const MIC_VOLUME_KEY = 'meeting-mic-volume'
const LISTEN_VOLUME_KEY = 'meeting-listen-volume'
/** 돌아온 뒤 끊긴 사람과 다시 잇기를 해 보는 때 (서버 연결이 다시 붙는 데 몇 초 걸릴 수 있어 두 번) */
const REFRESH_AFTER_MS = [1500, 6000]

function loadVolume(key: string, range: { min: number; max: number; default: number }): number {
  const v = Number(readLocal(key))
  return readLocal(key) !== null && Number.isFinite(v) ? Math.min(range.max, Math.max(range.min, v)) : range.default
}

/** 목록에 올리는 방 정보 */
type RoomInfo = { id: string; name: string; locked: boolean; count: number; at: number }

/** 목록에서 받은 방 정보 검사 (누구나 올릴 수 있어서 믿지 않는다). 이상하면 null */
function readRoomInfo(x: Record<string, unknown>): RoomInfo | null {
  const id = cleanId(x.id)
  const name = cleanName(x.name)
  if (!id || !name || typeof x.locked !== 'boolean' || !isInt(x.count, 0, CAPACITY) || typeof x.at !== 'number' || !Number.isFinite(x.at)) return null
  return { id, name, locked: x.locked, count: x.count, at: x.at }
}

/** 들어간 방: 이름과, 비공개면 코드 (화면에 보여 줌) */
type Joined = { room: Room<MeetMsg>; voice: VoiceChanger | null; name: string; pin: string | null }

type View = { kind: 'list'; error?: string } | { kind: 'create' } | { kind: 'busy'; text: string } | ({ kind: 'room' } & Joined)

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '방이 없어졌어요',
  full: `회의방이 가득 찼어요 (${CAPACITY}명)`,
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

/** 방 채널 코드: 비공개면 코드를 붙여서, 코드가 틀리면 다른(빈) 채널이 된다 */
const channelCode = (id: string, pin: string | null) => (pin ? `${id}-${pin}` : id)

/** 방 사람 목록으로 알리는 내 캐릭터 (사람 칸 얼굴) */
function myAvatar(): { avatar?: string } {
  const look = loadLook()
  return look ? { avatar: encodeLook(look) } : {}
}

const randomPin = () => String(Math.floor(Math.random() * 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0')

/** 마이크 허락받기 (목소리 변조를 거쳐 보냄). 거절하거나 없으면 null (듣기만) */
async function getMic(): Promise<VoiceChanger | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    const raw = stream.getAudioTracks()[0]
    if (!raw) return null
    const voice = new VoiceChanger(levelContext(), raw)
    voice.setVolume(loadVolume(MIC_VOLUME_KEY, MIC_VOLUME))
    return voice
  } catch {
    return null
  }
}

function useSpeaking(stream: MediaStream | null): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return
    const stop = watchLevel(stream, setSpeaking)
    return () => {
      stop()
      setSpeaking(false)
    }
  }, [stream])
  return speaking
}

/** 브라우저가 소리를 막았을 때만 (다른 재생 요청에 끊긴 건 무시) */
const isBlocked = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError'

/** 소리를 audio 요소로 튼다. 브라우저가 막으면 onBlocked ([소리 켜기]를 띄움) */
function Audio({ stream, muted, onBlocked }: { stream: MediaStream; muted?: boolean; onBlocked?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    audio.srcObject = stream
    audio.play().catch((e) => isBlocked(e) && onBlocked?.())
  }, [stream, onBlocked])
  return <audio ref={ref} autoPlay playsInline muted={muted} />
}

/** 상대 한 사람 소리를 듣는 소리(Speaker)에 더한다 (그 사람 크기 volume). 크롬은 받은 소리를 audio에 걸어 둬야 Web Audio로 나와서 소리 끈 audio도 둔다 */
function PeerAudio({ stream, speaker, volume }: { stream: MediaStream; speaker: Speaker; volume: number }) {
  const handle = useRef<ReturnType<Speaker['add']> | null>(null)
  const volumeRef = useRef(volume)
  useEffect(() => {
    volumeRef.current = volume
    handle.current?.setVolume(volume)
  }, [volume])
  useEffect(() => {
    const h = speaker.add(stream, volumeRef.current)
    handle.current = h
    return () => {
      h.remove()
      handle.current = null
    }
  }, [stream, speaker])
  return <Audio stream={stream} muted />
}

function VolumeSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="meet-voice__slider">
      <span>
        {label} {Math.round(value * 100)}%
      </span>
      <input type="range" min={0} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

const CONNECTION_TEXT: Record<CallPeer['connection'], string | null> = {
  connecting: '연결 중…',
  connected: null,
  failed: '연결 안 됨',
}

/** 사람마다 소리 크기 (닉네임으로 기기에 기억 — 접속 번호는 들어올 때마다 바뀌어서) */
const PERSON_VOLUME_KEY = 'meeting-person-volume'
const PERSON_VOLUME_KEEP = 100

function loadPersonVolumes(): Record<string, number> {
  try {
    const raw = JSON.parse(readLocal(PERSON_VOLUME_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(PERSON_VOLUME.max, Math.max(PERSON_VOLUME.min, v))
    return out
  } catch {
    return {}
  }
}

function savePersonVolumes(v: Record<string, number>) {
  // 기본(100%)은 지우고, 너무 많아지면 오래된 것부터 버린다
  const entries = Object.entries(v).filter(([, x]) => x !== PERSON_VOLUME.default)
  writeLocal(PERSON_VOLUME_KEY, JSON.stringify(Object.fromEntries(entries.slice(-PERSON_VOLUME_KEEP))))
}

/** 사람 칸 얼굴: 나는 3D로 그린 얼굴, 다른 사람은 고른 동물 그림 글자 (없으면 이름 첫 글자) */
function Face({ me, avatar, name }: { me?: boolean; avatar?: string; name: string }) {
  if (me) return <AvatarFace look={loadLook()} size={64} />
  const look = decodeLook(avatar)
  return (
    <span className="meet-tile__letter" aria-hidden>
      {look ? ANIMAL_EMOJI[look.animal] : name.slice(0, 1)}
    </span>
  )
}

type TileProps = { name: string; me?: boolean; avatar?: string; stream: MediaStream | null; micOn: boolean; status: string | null; volume: number; onOpen: () => void }

/** 사람 한 칸 (디스코드 음성 채널 칸처럼): 말하면 초록 테두리, 마이크 꺼짐·소리 크기 바꿈 표시. 누르면 소리 크기 */
function Tile({ name, me, avatar, stream, micOn, status, volume, onOpen }: TileProps) {
  const speaking = useSpeaking(micOn ? stream : null)
  return (
    <li>
      <button
        type="button"
        className={`meet-tile${speaking ? ' meet-tile--speaking' : ''}${status ? ' meet-tile--waiting' : ''}`}
        onClick={onOpen}
        aria-label={`${name}${me ? ' (나)' : ''} 소리 크기`}
      >
        <span className="meet-tile__face">
          <Face me={me} avatar={avatar} name={name} />
        </span>
        {status && <span className="meet-tile__status">{status}</span>}
        {!me && volume !== PERSON_VOLUME.default && (
          <span className="meet-tile__vol">{volume === 0 ? <IconVolumeOff size={14} /> : `${Math.round(volume * 100)}%`}</span>
        )}
        <span className="meet-tile__name">
          {!micOn && <IconMicOff size={14} className="meet-tile__muted" />}
          <span>{name}</span>
          {me && <small>나</small>}
        </span>
      </button>
    </li>
  )
}

/** 아래에서 올라오는 작은 창 (Esc·바깥 누르면 닫힘) */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet__panel meet-settings">
        <h2 className="meet-settings__title">{label}</h2>
        {children}
        <button type="button" className="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

const timeText = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 채팅 칸: 위로 쌓이는 줄 + 아래 입력. 맨 아래를 보고 있으면 새 줄이 올 때 따라 내려간다 */
function ChatPanel({ lines, onSend }: { lines: ChatLine[]; onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const stickRef = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [lines])
  const send = () => {
    const t = cleanChat(text)
    if (!t) return
    onSend(t)
    setText('')
    stickRef.current = true
  }
  return (
    <div className="meet-chat">
      <ol
        ref={listRef}
        className="meet-chat__lines"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {lines.length === 0 && <li className="meet-chat__empty">아직 채팅이 없어요. 말하기 어려우면 여기에 써 주세요</li>}
        {lines.map((l) =>
          l.kind === 'chat' ? (
            <li key={l.key} className={`meet-chat__line${l.mine ? ' meet-chat__line--mine' : ''}`}>
              <span className="meet-chat__who">
                <b>{l.name}</b>
                <time>{timeText(l.at)}</time>
              </span>
              <span className="meet-chat__text">{l.text}</span>
            </li>
          ) : (
            <li key={l.key} className={`meet-chat__notice meet-chat__notice--${l.kind}`}>
              <b>{l.name}</b>님이 {l.kind === 'join' ? '들어왔어요' : '나갔어요'} · {timeText(l.at)}
            </li>
          ),
        )}
      </ol>
      <form
        className="meet-chat__form"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          className="input meet-chat__input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))}
          onKeyDown={(e) => {
            // 한글 입력 중 Enter(글자 확정)로 두 번 보내지지 않게
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            send()
          }}
          placeholder="메시지 보내기"
          autoComplete="off"
          enterKeyHint="send"
          aria-label="채팅 메시지"
        />
        <button type="submit" className="button meet-chat__send" disabled={!cleanChat(text)} aria-label="보내기">
          <IconSend size={18} />
        </button>
      </form>
    </div>
  )
}

/** 넓은 화면이면 사람 칸과 채팅을 나란히, 좁으면 탭 */
const WIDE_QUERY = '(min-width: 900px)'
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

/** 들어온 직후엔 사람 목록이 차례로 채워져서 들어옴 알림을 안 낸다 */
const SETTLE_MS = 1500

type RoomProps = Joined & {
  nickname: string
  /** 목소리 효과 (방 목록에서 고른 걸 이어서) */
  settings: VoiceSettings
  onSettings: (s: VoiceSettings) => void
  /** 나중에 마이크를 허락받음 */
  onVoice: (voice: VoiceChanger) => void
  onLeave: () => void
}

type SheetKind = { kind: 'voice' } | { kind: 'volume' } | { kind: 'person'; name: string }

/** 방을 닫고 마이크를 끄는 건 부르는 쪽(MeetingPage)이 한다 */
function MeetingRoom({ room, name, pin, nickname, voice, settings, onSettings, onVoice, onLeave }: RoomProps) {
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  // 목소리 설정 창: 열려 있는 동안 다른 사람에게 내 소리를 안 보낸다 (사용자 요청)
  const openVoice = (open: boolean) => {
    setSheet(open ? { kind: 'voice' } : null)
    voice?.setSending(!open)
  }
  const closeSheet = useMemo(() => () => setSheet(null), [])
  const [members, setMembers] = useState<Member[]>([])
  const membersRef = useRef<Member[]>([])
  const [blocked, setBlocked] = useState(false)
  const [asking, setAsking] = useState(false)
  /** 통화 상태 (바뀔 때마다 새로 받아 그린다) */
  const [call, setCall] = useState<{ peers: CallPeer[]; mic: boolean; strangers: number }>({ peers: [], mic: true, strangers: 0 })
  const meshRef = useRef<SfuCall | null>(null)
  const [micVolume, setMicVolume] = useState(() => voice?.volume ?? loadVolume(MIC_VOLUME_KEY, MIC_VOLUME))
  const [speaker] = useState(() => {
    const s = new Speaker(levelContext())
    s.setVolume(loadVolume(LISTEN_VOLUME_KEY, LISTEN_VOLUME))
    return s
  })
  const [listenVolume, setListenVolume] = useState(speaker.level)
  const [personVolumes, setPersonVolumes] = useState(loadPersonVolumes)
  const volumeOf = (who: string) => personVolumes[who] ?? PERSON_VOLUME.default
  const setPersonVolume = (who: string, v: number) => {
    const next = { ...personVolumes }
    delete next[who] // 다시 넣어 '최근'으로
    next[who] = v
    setPersonVolumes(next)
    savePersonVolumes(next)
  }

  // 채팅 (좁은 화면은 사람 / 채팅 탭, 안 보는 동안 온 줄 수를 탭에 표시)
  const wide = useWide()
  const [tab, setTab] = useState<'people' | 'chat'>('people')
  const [lines, setLines] = useState<ChatLine[]>([])
  const [unread, setUnread] = useState(0)
  const chatVisible = wide || tab === 'chat'
  const chatVisibleRef = useRef(chatVisible)
  const lineKey = useRef(0)
  useEffect(() => {
    chatVisibleRef.current = chatVisible
    if (chatVisible) setUnread(0)
  }, [chatVisible])
  const addLine = useMemo(
    () => (line: Omit<ChatLine, 'key' | 'at'>) => {
      setLines((ls) => pushLine(ls, { ...line, key: ++lineKey.current, at: Date.now() }))
      if (line.kind === 'chat' && !line.mine && !chatVisibleRef.current) setUnread((n) => n + 1)
    },
    [],
  )

  const voiceRef = useRef(voice)
  useEffect(() => {
    voiceRef.current = voice
  })
  // 효과를 바꾸면 보내는 내 목소리에 바로
  useEffect(() => {
    voice?.apply(settings)
  }, [voice, settings])

  useEffect(() => {
    const mesh: SfuCall = new SfuCall({
      url: SFU_URL ?? '',
      getToken: () => sfuToken(`meeting-${room.code}`, room.myId, nickname),
      onChange: () => setCall({ peers: mesh.peers(), mic: mesh.mic, strangers: mesh.strangers() }),
    })
    meshRef.current = mesh
    mesh.setTrack(voiceRef.current?.track ?? null)
    const since = Date.now()
    playJoin()
    const offMembers = room.onMembers((ms) => {
      // 들어옴·나감: 알림음 + 채팅에 한 줄 (들어온 직후 목록이 채워지는 건 빼고)
      const { joined, left } = diffMembers(membersRef.current, ms)
      if (Date.now() - since > SETTLE_MS) {
        for (const m of joined) addLine({ kind: 'join', name: m.nickname, text: '' })
        if (joined.length) playJoin()
      }
      for (const m of left) addLine({ kind: 'leave', name: m.nickname, text: '' })
      if (left.length) playLeave()
      membersRef.current = ms
      setMembers(ms)
      mesh.setMembers(ms.map((m) => m.id))
    })
    // 채팅: 게임 서버가 붙인 보낸 사람(from)을 믿고, 없으면(예전 방식) 메시지 안의 from. 사람 목록에 없는 사람 것은 버린다
    const offMessage = room.onMessage((msg, from) => {
      const text = readChat(msg)
      if (!text) return
      const id = from ?? (msg as ChatSignal).from
      const who = membersRef.current.find((m) => m.id === id)
      if (!who) return
      addLine({ kind: 'chat', name: who.nickname, text })
      playChat()
    })
    return () => {
      offMembers()
      offMessage()
      mesh.close()
      meshRef.current = null
    }
  }, [room, nickname, addLine])

  function sendChat(text: string) {
    room.send({ t: 'chat', from: room.myId, text })
    addLine({ kind: 'chat', name: nickname, text, mine: true })
  }

  // 폰을 다른 앱으로 보냈다 돌아오면(또는 인터넷이 다시 붙으면) 끊긴 걸 다시 잇는다:
  // 소리 처리 깨우기 → 끝나 버린 마이크 다시 받기 → 멈춘 소리 다시 틀기 → 조금 뒤(서버 연결이 다시 붙을 틈) 끊긴 사람과 다시 잇기
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const comeBack = async () => {
      if (document.visibilityState !== 'visible') return
      levelContext()
      const v = voiceRef.current
      if (v?.rawTrack && v.rawTrack.readyState === 'ended') {
        const raw = await rawMic()
        if (raw) await v.replaceRaw(raw)
      }
      document.querySelectorAll<HTMLAudioElement>('.meet audio').forEach((a) => {
        if (a.paused) void a.play().catch((e) => isBlocked(e) && !a.muted && setBlocked(true))
      })
      timers.splice(0).forEach(clearTimeout)
      for (const ms of REFRESH_AFTER_MS) timers.push(setTimeout(() => meshRef.current?.refresh(), ms))
    }
    const onVisible = () => void comeBack()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      timers.forEach(clearTimeout)
    }
  }, [])

  // 방장: 목록에 방을 올려 두고 사람 수를 고친다 (방장이 나가면 목록에서 사라짐)
  const count = members.length + 1
  const advertRef = useRef<ReturnType<typeof advertiseRoom<RoomInfo>> | null>(null)
  const [createdAt] = useState(() => Date.now())
  const infoRef = useRef<RoomInfo>({ id: room.code.split('-')[0], name, locked: !!pin, count, at: createdAt })
  useEffect(() => {
    if (room.role !== 'host') return
    const advert = advertiseRoom(ROOM_ID, infoRef.current)
    advertRef.current = advert
    return () => {
      advert.stop()
      advertRef.current = null
    }
  }, [room])
  useEffect(() => {
    infoRef.current = { ...infoRef.current, count }
    advertRef.current?.update(infoRef.current)
  }, [count])

  const micOn = !!voice && call.mic
  const myStream = useMemo(() => (voice ? new MediaStream([voice.track]) : null), [voice])
  const peers = new Map(call.peers.map((p) => [p.id, p]))
  const onBlocked = useMemo(() => () => setBlocked(true), [])
  const hostGone = room.role === 'guest' && !members.some((m) => m.role === 'host')
  const effectLabel = VOICE_EFFECTS.find((e) => e.id === settings.effect)?.label

  async function allowMic() {
    setAsking(true)
    levelContext()
    const v = await getMic()
    setAsking(false)
    if (!v) return
    v.setVolume(micVolume)
    v.apply(settings)
    onVoice(v)
    meshRef.current?.setTrack(v.track)
  }

  function unblock() {
    setBlocked(false)
    levelContext()
    document.querySelectorAll<HTMLAudioElement>('.meet audio').forEach((a) => void a.play().catch((e) => isBlocked(e) && !a.muted && setBlocked(true)))
  }

  const people = (
    <div className="meet-stage">
      <ul className="meet-grid">
        <Tile name={nickname} me stream={myStream} micOn={micOn} status={null} volume={PERSON_VOLUME.default} onOpen={() => setSheet({ kind: 'volume' })} />
        {members.map((m) => {
          const p = peers.get(m.id)
          return (
            <Tile
              key={m.id}
              name={m.nickname}
              avatar={m.avatar}
              stream={p?.stream ?? null}
              micOn={p?.micOn ?? true}
              status={p ? CONNECTION_TEXT[p.connection] : '연결 중…'}
              volume={volumeOf(m.nickname)}
              onOpen={() => setSheet({ kind: 'person', name: m.nickname })}
            />
          )
        })}
      </ul>
      {members.length === 0 && (
        <p className="meet__tip">{pin ? '친구들에게 방 이름과 코드를 알려 주세요' : '목록에서 이 방을 누르면 들어올 수 있어요'}</p>
      )}
      {[...peers.values()].some((p) => p.connection === 'failed') && (
        <p className="meet__tip">'연결 안 됨'은 인터넷이 막혀 있어서예요 (휴대폰 데이터·회사·학교 와이파이). 와이파이를 바꿔 보세요</p>
      )}
      {hostGone && <p className="meet__tip">방을 만든 사람이 나가서 새로 들어올 수는 없어요</p>}
      {!voice && <p className="meet__tip">마이크 없이 듣기만 하고 있어요</p>}
    </div>
  )

  return (
    <section className="meet">
      <div className="meet-bar">
        <IconVolume size={20} className="meet-bar__icon" />
        <strong className="meet-bar__name">{name}</strong>
        <span className="meet-bar__info">
          {pin ? (
            <>
              비공개 · 코드 <b className="meet__pin">{pin}</b>
            </>
          ) : (
            '전체 공개'
          )}{' '}
          · {count}/{CAPACITY}명
        </span>
      </div>

      {call.strangers > 0 && (
        <p className="meet__warn" role="alert">
          목록에 없는 사람 {call.strangers}명이 듣고 있어요. 모르는 사람이면 방을 나가 새 방(비공개)을 만드세요
        </p>
      )}
      {blocked && (
        <button type="button" className="button button--primary meet__unblock" onClick={unblock}>
          <IconVolume size={18} /> 소리 켜기
        </button>
      )}

      {!wide && (
        <div className="meet-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'people'} className="meet-tabs__tab" onClick={() => setTab('people')}>
            사람 {count}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'chat'} className="meet-tabs__tab" onClick={() => setTab('chat')}>
            <IconMessage size={16} /> 채팅
            {unread > 0 && <span className="meet-tabs__badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        </div>
      )}

      <div className={`meet-body${wide ? ' meet-body--wide' : ''}`}>
        {(wide || tab === 'people') && people}
        {/* 좁은 화면에서 사람 탭을 볼 때도 채팅 줄은 그대로 쌓이게 숨기기만 */}
        <div className="meet-body__chat" hidden={!chatVisible}>
          <ChatPanel lines={lines} onSend={sendChat} />
        </div>
      </div>

      <Audio stream={speaker.stream} onBlocked={onBlocked} />
      {[...peers.entries()].map(([id, p]) => {
        const who = members.find((m) => m.id === id)
        return p.stream && <PeerAudio key={id} stream={p.stream} speaker={speaker} volume={who ? volumeOf(who.nickname) : PERSON_VOLUME.default} />
      })}

      <div className="meet-controls">
        {voice ? (
          <button
            type="button"
            className={`meet-controls__btn${micOn ? '' : ' meet-controls__btn--off'}`}
            aria-pressed={!micOn}
            onClick={() => meshRef.current?.setMicOn(!micOn)}
          >
            {micOn ? <IconMic size={22} /> : <IconMicOff size={22} />}
            <span>{micOn ? '마이크' : '마이크 꺼짐'}</span>
          </button>
        ) : (
          <button type="button" className="meet-controls__btn meet-controls__btn--off" disabled={asking} onClick={allowMic}>
            <IconMicOff size={22} />
            <span>마이크 허락</span>
          </button>
        )}
        {voice && (
          <button type="button" className="meet-controls__btn" onClick={() => openVoice(true)}>
            <IconWave size={22} />
            <span>목소리 · {effectLabel}</span>
          </button>
        )}
        <button type="button" className="meet-controls__btn" onClick={() => setSheet({ kind: 'volume' })}>
          <IconSliders size={22} />
          <span>소리 크기</span>
        </button>
        <button type="button" className="meet-controls__btn meet-controls__btn--leave" onClick={onLeave}>
          <IconPhoneOff size={22} />
          <span>나가기</span>
        </button>
      </div>

      {sheet?.kind === 'voice' && voice && (
        <VoiceSettingsDialog inRoom settings={settings} onSave={onSettings} onClose={() => openVoice(false)} getRaw={async () => voice.rawTrack} />
      )}
      {sheet?.kind === 'volume' && (
        <Sheet label="소리 크기" onClose={closeSheet}>
          <VolumeSlider
            label="듣는 소리 (모두)"
            value={listenVolume}
            max={LISTEN_VOLUME.max}
            onChange={(v) => {
              setListenVolume(v)
              speaker.setVolume(v)
              writeLocal(LISTEN_VOLUME_KEY, String(v))
            }}
          />
          {voice && (
            <VolumeSlider
              label="내 마이크"
              value={micVolume}
              max={MIC_VOLUME.max}
              onChange={(v) => {
                setMicVolume(v)
                voice.setVolume(v)
                writeLocal(MIC_VOLUME_KEY, String(v))
              }}
            />
          )}
          <p className="meet-settings__hint">한 사람만 키우거나 줄이려면 그 사람 칸을 누르세요</p>
        </Sheet>
      )}
      {sheet?.kind === 'person' && (
        <Sheet label={`${sheet.name}님 소리`} onClose={closeSheet}>
          <VolumeSlider label="소리 크기" value={volumeOf(sheet.name)} max={PERSON_VOLUME.max} onChange={(v) => setPersonVolume(sheet.name, v)} />
          <button
            type="button"
            className={`button${volumeOf(sheet.name) === 0 ? ' button--primary' : ''}`}
            aria-pressed={volumeOf(sheet.name) === 0}
            onClick={() => setPersonVolume(sheet.name, volumeOf(sheet.name) === 0 ? PERSON_VOLUME.default : 0)}
          >
            {volumeOf(sheet.name) === 0 ? '이 사람 소리 다시 듣기' : '이 사람 소리 끄기'}
          </button>
          <p className="meet-settings__hint">내 기기에서만 바뀌어요. 상대는 몰라요</p>
        </Sheet>
      )}
    </section>
  )
}

/** 열린 방 목록. 비공개 방은 누르면 코드를 묻는다 */
/** 방 목록에서 쓰는 마이크 (효과 없는 그대로). 들어보기 녹음이 끝나면 놓는다 */
async function rawMic(): Promise<MediaStreamTrack | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    return stream.getAudioTracks()[0] ?? null
  } catch {
    return null
  }
}

type ListProps = {
  onJoin: (r: RoomInfo, pin: string | null) => void
  onCreate: () => void
  error?: string
  settings: VoiceSettings
  onSettings: (s: VoiceSettings) => void
}

function RoomList({ onJoin, onCreate, error, settings, onSettings }: ListProps) {
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [asking, setAsking] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  useEffect(() => watchRooms<object>(ROOM_ID, (raw) => setRooms(cleanList(raw, readRoomInfo)), () => setOffline(true)), [])

  const sorted = [...(rooms ?? [])].sort((a, b) => b.at - a.at)
  return (
    <section className="meet-list">
      <button type="button" className="button button--primary pvp-lobby__big" onClick={onCreate}>
        + 회의방 만들기
      </button>
      {error && (
        <p className="error pvp-lobby__error" role="alert">
          {error}
        </p>
      )}
      <h2 className="meet-list__title">열린 회의방</h2>
      {offline ? (
        <p className="meet__tip">서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요</p>
      ) : rooms === null ? (
        <p className="meet__tip">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <p className="meet__tip">열린 회의방이 없어요. 새로 만들어 보세요</p>
      ) : (
        <ul className="meet-list__rooms">
          {sorted.map((r) => {
            const full = r.count >= CAPACITY
            return (
              <li key={r.id} className="meet-list__item">
                <button
                  type="button"
                  className="meet-list__room"
                  disabled={full}
                  onClick={() => {
                    if (!r.locked) onJoin(r, null)
                    else {
                      setAsking(asking === r.id ? null : r.id)
                      setPin('')
                    }
                  }}
                >
                  <span className="meet-list__name">
                    {r.locked && '🔒 '}
                    {r.name}
                  </span>
                  <span className="meet-list__count">{full ? '가득' : `${r.count}/${CAPACITY}명`}</span>
                </button>
                {asking === r.id && (
                  <form
                    className="pvp-lobby__join meet-list__pin"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (pin.length === PIN_LENGTH) onJoin(r, pin)
                    }}
                  >
                    <input
                      className="input pvp-lobby__input"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                      placeholder={`코드 ${PIN_LENGTH}자리`}
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      aria-label="비공개 방 코드"
                    />
                    <button type="submit" className="button" disabled={pin.length !== PIN_LENGTH}>
                      들어가기
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {/* 들어가기 전에 목소리 효과를 골라 들어볼 수 있다. 저장한 효과로 방에 들어간다 */}
      <button type="button" className="button meet-list__voice" onClick={() => setVoiceOpen(true)}>
        ⚙️ 목소리 설정 <span className="meet-voice__now">지금: {VOICE_EFFECTS.find((e) => e.id === settings.effect)?.label}</span>
      </button>
      {voiceOpen && <VoiceSettingsDialog settings={settings} onSave={onSettings} onClose={() => setVoiceOpen(false)} getRaw={rawMic} release={(t) => t.stop()} />}
      <ul className="meet__notes">
        <li>들어갈 때 마이크 사용을 허락해 주세요 (거절하면 듣기만)</li>
        <li>이어폰을 끼면 소리가 울리지 않아요</li>
        <li>데이터는 한 사람과 1시간에 약 10MB</li>
        <li>휴대폰 데이터·회사·학교 와이파이에선 연결이 안 될 수도 있어요</li>
      </ul>
    </section>
  )
}

/** 방 만들기: 이름·공개 여부·코드. 비우면 이름은 'OO님의 방', 코드는 추천 숫자 */
function CreateForm({ nickname, onCreate, onBack }: { nickname: string; onCreate: (name: string, pin: string | null) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [suggested] = useState(randomPin)
  const defaultName = `${nickname}님의 방`
  const pinOk = pin.length === 0 || pin.length === PIN_LENGTH
  return (
    <form
      className="meet-create"
      onSubmit={(e) => {
        e.preventDefault()
        if (pinOk) onCreate(name.trim() || defaultName, locked ? pin || suggested : null)
      }}
    >
      <label className="meet-create__field">
        <span>방 이름</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))} placeholder={defaultName} autoComplete="off" />
      </label>
      <div className="meet-create__field" role="radiogroup" aria-label="공개 여부">
        <span>공개</span>
        <div className="meet-create__toggle">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={locked === v} className={`button${locked === v ? ' button--primary' : ''}`} onClick={() => setLocked(v)}>
              {v ? '🔒 비공개' : '전체 공개'}
            </button>
          ))}
        </div>
        <small>{locked ? '목록엔 보이지만 코드를 알아야 들어와요' : '목록에서 누구나 들어와요'}</small>
      </div>
      {locked && (
        <label className="meet-create__field">
          <span>코드 (숫자 {PIN_LENGTH}자리, 비우면 {suggested})</span>
          <input
            className="input pvp-lobby__input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            placeholder={suggested}
            inputMode="numeric"
            autoComplete="off"
          />
          {!pinOk && <small className="error">{PIN_LENGTH}자리로 입력하거나 비워 두세요</small>}
        </label>
      )}
      <button type="submit" className="button button--primary pvp-lobby__big" disabled={!pinOk}>
        만들기
      </button>
      <button type="button" className="button button--small pvp-lobby__back" onClick={onBack}>
        취소
      </button>
    </form>
  )
}

export function MeetingPage() {
  const nickname = loadNickname() ?? '나'
  const [view, setView] = useState<View>({ kind: 'list' })
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  })
  // 들어가는 도중에 화면을 떠나면 다 열린 방·마이크를 바로 닫는다
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 나가거나 화면을 떠나면 마이크를 끄고 방을 닫는다
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  })
  useEffect(() => () => close(viewRef.current), [])

  function close(v: View) {
    if (v.kind !== 'room') return
    v.voice?.stop()
    v.room.leave()
  }

  async function enter(name: string, pin: string | null, open: () => Promise<Room<MeetMsg>>, wrongPin: string) {
    // 누르는 순간에 소리 장치를 깨워 둔다 (폰은 사용자 동작 안에서만 됨)
    levelContext()
    setView({ kind: 'busy', text: '마이크 확인 중…' })
    const voice = await getMic()
    voice?.apply(settingsRef.current)
    setView({ kind: 'busy', text: '회의방에 들어가는 중…' })
    try {
      const room = await open()
      if (!mountedRef.current) {
        room.leave()
        voice?.stop()
        return
      }
      setView({ kind: 'room', room, voice, name, pin })
    } catch (e) {
      voice?.stop()
      if (!(e instanceof RoomError)) console.warn('[meeting] 접속 오류', e)
      const text = e instanceof RoomError ? (e.reason === 'not-found' ? wrongPin : ERROR_TEXT[e.reason]) : ERROR_TEXT.offline
      setView({ kind: 'list', error: text })
    }
  }

  function create(name: string, pin: string | null) {
    const code = channelCode(makeRoomCode(), pin)
    void enter(name, pin, () => createRoom<MeetMsg>(ROOM_ID, nickname, { capacity: CAPACITY, code, ...myAvatar() }), ERROR_TEXT['not-found'])
  }

  function join(r: RoomInfo, pin: string | null) {
    const code = channelCode(r.id, pin)
    void enter(r.name, pin, () => joinRoom<MeetMsg>(ROOM_ID, code, nickname, { capacity: CAPACITY, ...myAvatar() }), pin ? '코드가 틀렸어요 (방이 없어졌을 수도 있어요)' : ERROR_TEXT['not-found'])
  }

  return (
    <main className={`page arcade${view.kind === 'room' ? ' meet-page--room' : ''}`}>
      <header className="meet__header">
        <HomeLink className="button button--small">
          ← 목록
        </HomeLink>
        <h1 className="title">회의방</h1>
      </header>

      {view.kind === 'room' ? (
        <MeetingRoom
          room={view.room}
          name={view.name}
          pin={view.pin}
          nickname={nickname}
          voice={view.voice}
          settings={settings}
          onSettings={setSettings}
          onVoice={(voice) => setView({ ...view, voice })}
          onLeave={() => {
            close(view)
            setView({ kind: 'list' })
          }}
        />
      ) : view.kind === 'busy' ? (
        <p className="pvp-lobby__status meet__busy">{view.text}</p>
      ) : view.kind === 'create' ? (
        <CreateForm nickname={nickname} onCreate={create} onBack={() => setView({ kind: 'list' })} />
      ) : (
        <RoomList onJoin={join} onCreate={() => setView({ kind: 'create' })} error={view.error} settings={settings} onSettings={setSettings} />
      )}
    </main>
  )
}
