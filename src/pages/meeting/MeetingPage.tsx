import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { levelContext, watchLevel } from '../../shared/call/level'
import { LISTEN_VOLUME, Speaker } from '../../shared/call/speaker'
import { DEFAULT_VOICE_SETTINGS, MIC_VOLUME, VoiceChanger, type VoiceSettings } from '../../shared/call/voiceFx'
import { type CallPeer, type CallSignal, VoiceMesh } from '../../shared/call/voiceMesh'
import { type Member, type Room, RoomError, createRoom, joinRoom, makeRoomCode } from '../../shared/online/room'
import { advertiseRoom, cleanId, cleanList, cleanName, isInt, watchRooms } from '../../shared/online/roomList'
import { readLocal, writeLocal } from '../../shared/storage/local'
import { loadNickname } from '../../shared/storage/nickname'
import { VoicePicker, VoiceTest } from './VoicePanel'
import './meeting.css'

// 회의방: 열린 방 목록에서 골라 들어가 음성 통화. 방장이 방을 만들 때 이름과 전체 공개/비공개(코드)를 정한다.
// 비공개 방도 목록에 🔒로 보이고, 누르면 코드를 물어본다. 코드는 방 채널 이름에 들어가 있어서 틀리면 '방 없음'이 된다.
// 게임과 같은 방(Supabase Realtime)으로 연결 정보만 주고받고, 소리는 기기끼리 직접.
// 들어갈 때 마이크를 허락받는다. 거절하면 듣기만 (나중에 다시 허락할 수 있음).

/** 정원 (나 포함). 서로 다 잇는 방식이라 이보다 많으면 폰이 버겁다 */
const CAPACITY = 8
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
type Joined = { room: Room<CallSignal>; voice: VoiceChanger | null; name: string; pin: string | null }

type View = { kind: 'list'; error?: string } | { kind: 'create' } | { kind: 'busy'; text: string } | ({ kind: 'room' } & Joined)

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '방이 없어졌어요',
  full: `회의방이 가득 찼어요 (${CAPACITY}명)`,
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

/** 방 채널 코드: 비공개면 코드를 붙여서, 코드가 틀리면 다른(빈) 채널이 된다 */
const channelCode = (id: string, pin: string | null) => (pin ? `${id}-${pin}` : id)

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

/** 상대 한 사람 소리를 듣는 소리(Speaker)에 더한다. 크롬은 받은 소리를 audio에 걸어 둬야 Web Audio로 나와서 소리 끈 audio도 둔다 */
function PeerAudio({ stream, speaker }: { stream: MediaStream; speaker: Speaker }) {
  useEffect(() => speaker.add(stream), [stream, speaker])
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

function Person({ name, note, stream, micOn, status }: { name: string; note?: string; stream: MediaStream | null; micOn: boolean; status: string | null }) {
  const speaking = useSpeaking(micOn ? stream : null)
  return (
    <li className={`meet-person${speaking ? ' meet-person--speaking' : ''}${status ? ' meet-person--waiting' : ''}`}>
      <span className="meet-person__face" aria-hidden>
        {name.slice(0, 1)}
        {!micOn && <span className="meet-person__muted">🔇</span>}
      </span>
      <span className="meet-person__name">
        {name}
        {note && <span> {note}</span>}
      </span>
      <span className="meet-person__status">{status ?? (micOn ? (speaking ? '말하는 중' : '') : '마이크 꺼짐')}</span>
    </li>
  )
}

const CONNECTION_TEXT: Record<CallPeer['connection'], string | null> = {
  connecting: '연결 중…',
  connected: null,
  failed: '연결 안 됨',
}

type RoomProps = Joined & {
  nickname: string
  /** 목소리 효과 (방 목록에서 고른 걸 이어서) */
  settings: VoiceSettings
  onSettings: (s: VoiceSettings) => void
  /** 나중에 마이크를 허락받음 */
  onVoice: (voice: VoiceChanger) => void
  onLeave: () => void
}

/** 방을 닫고 마이크를 끄는 건 부르는 쪽(MeetingPage)이 한다 */
function MeetingRoom({ room, name, pin, nickname, voice, settings, onSettings, onVoice, onLeave }: RoomProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [blocked, setBlocked] = useState(false)
  const [asking, setAsking] = useState(false)
  /** 통화 상태 (바뀔 때마다 새로 받아 그린다) */
  const [call, setCall] = useState<{ peers: CallPeer[]; mic: boolean }>({ peers: [], mic: true })
  const meshRef = useRef<VoiceMesh | null>(null)
  const [micVolume, setMicVolume] = useState(() => voice?.volume ?? loadVolume(MIC_VOLUME_KEY, MIC_VOLUME))
  const [speaker] = useState(() => {
    const s = new Speaker(levelContext())
    s.setVolume(loadVolume(LISTEN_VOLUME_KEY, LISTEN_VOLUME))
    return s
  })
  const [listenVolume, setListenVolume] = useState(speaker.level)
  const voiceRef = useRef(voice)
  useEffect(() => {
    voiceRef.current = voice
  })
  // 효과를 바꾸면 보내는 내 목소리에 바로
  useEffect(() => {
    voice?.apply(settings)
  }, [voice, settings])

  useEffect(() => {
    const mesh: VoiceMesh = new VoiceMesh({
      myId: room.myId,
      send: (m) => room.send(m),
      onChange: () => setCall({ peers: mesh.peers(), mic: mesh.mic }),
    })
    meshRef.current = mesh
    mesh.setTrack(voiceRef.current?.track ?? null)
    const offMsg = room.onMessage((m) => mesh.receive(m))
    const offMembers = room.onMembers((ms) => {
      setMembers(ms)
      mesh.setMembers(ms.map((m) => m.id))
    })
    return () => {
      offMsg()
      offMembers()
      mesh.close()
      meshRef.current = null
    }
  }, [room])

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

  return (
    <section className="meet">
      <div className="meet__code">
        <strong className="meet__name">{name}</strong>
        <span>
          {pin ? (
            <>
              🔒 비공개 · 코드 <b className="meet__pin">{pin}</b>
            </>
          ) : (
            '전체 공개'
          )}{' '}
          · {count}/{CAPACITY}명
        </span>
      </div>

      <ul className="meet__people">
        <Person name={nickname} note="(나)" stream={myStream} micOn={micOn} status={null} />
        {members.map((m) => {
          const p = peers.get(m.id)
          return (
            <Person
              key={m.id}
              name={m.nickname}
              stream={p?.stream ?? null}
              micOn={p?.micOn ?? true}
              status={p ? CONNECTION_TEXT[p.connection] : '연결 중…'}
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

      <Audio stream={speaker.stream} onBlocked={onBlocked} />
      {[...peers.values()].map((p) => p.stream && <PeerAudio key={p.id} stream={p.stream} speaker={speaker} />)}

      <div className="meet__actions">
        {blocked && (
          <button type="button" className="button button--primary meet__big" onClick={unblock}>
            🔊 소리 켜기
          </button>
        )}
        {voice ? (
          <>
            <button
              type="button"
              className={`button meet__big${micOn ? ' button--primary' : ''}`}
              aria-pressed={micOn}
              onClick={() => meshRef.current?.setMicOn(!micOn)}
            >
              {micOn ? '🎤 마이크 끄기' : '🔇 마이크 켜기'}
            </button>
            {/* 목소리 변조: 다른 사람에겐 표시 안 함 */}
            <div className="meet-voice" aria-label="내 목소리">
              <span className="meet-voice__label">내 목소리</span>
              <VoicePicker settings={settings} onChange={onSettings} />
              {/* 들어보는 동안엔 다른 사람에게 내 소리를 안 보낸다 */}
              <VoiceTest settings={settings} getRaw={async () => voice.rawTrack} onBusy={(busy) => voice.setSending(!busy)} />
            </div>
          </>
        ) : (
          <>
            <p className="meet__tip">마이크 없이 듣기만 하고 있어요</p>
            <button type="button" className="button meet__big" disabled={asking} onClick={allowMic}>
              🎤 마이크 허락하기
            </button>
          </>
        )}
        <div className="meet-voice">
          <span className="meet-voice__label">소리 크기</span>
          <VolumeSlider
            label="🔊 듣는 소리"
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
              label="🎤 내 마이크"
              value={micVolume}
              max={MIC_VOLUME.max}
              onChange={(v) => {
                setMicVolume(v)
                voice.setVolume(v)
                writeLocal(MIC_VOLUME_KEY, String(v))
              }}
            />
          )}
        </div>
        <button type="button" className="button button--small" onClick={onLeave}>
          나가기
        </button>
      </div>
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
      {/* 들어가기 전에 목소리 효과를 골라 들어볼 수 있다. 고른 효과로 방에 들어간다 */}
      <div className="meet-voice meet-list__voice" aria-label="내 목소리">
        <span className="meet-voice__label">내 목소리 미리 골라 보기</span>
        <VoicePicker settings={settings} onChange={onSettings} />
        <VoiceTest settings={settings} getRaw={rawMic} release={(t) => t.stop()} />
      </div>
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

  async function enter(name: string, pin: string | null, open: () => Promise<Room<CallSignal>>, wrongPin: string) {
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
    void enter(name, pin, () => createRoom<CallSignal>(ROOM_ID, nickname, { capacity: CAPACITY, code }), ERROR_TEXT['not-found'])
  }

  function join(r: RoomInfo, pin: string | null) {
    const code = channelCode(r.id, pin)
    void enter(r.name, pin, () => joinRoom<CallSignal>(ROOM_ID, code, nickname, { capacity: CAPACITY }), pin ? '코드가 틀렸어요 (방이 없어졌을 수도 있어요)' : ERROR_TEXT['not-found'])
  }

  return (
    <main className="page">
      <header className="meet__header">
        <Link className="button button--small" to="/">
          ← 목록
        </Link>
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
