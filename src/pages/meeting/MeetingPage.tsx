import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { levelContext, watchLevel } from '../../shared/call/level'
import { type CallPeer, type CallSignal, VoiceMesh } from '../../shared/call/voiceMesh'
import { CODE_LENGTH, type Member, type Room, RoomError, createRoom, joinRoom, normalizeCode } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import './meeting.css'

// 회의방: 방 코드로 모여 음성 통화. 게임과 같은 방(Supabase Realtime)으로 연결 정보만 주고받고, 소리는 기기끼리 직접.
// 처음 누를 때 마이크를 허락받는다. 거절하면 듣기만 (나중에 다시 허락할 수 있음).

/** 정원 (나 포함). 서로 다 잇는 방식이라 이보다 많으면 폰이 버겁다 */
const CAPACITY = 8
const ROOM_ID = 'meeting'

type View = { kind: 'menu' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string } | { kind: 'room'; room: Room<CallSignal>; track: MediaStreamTrack | null }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '그 코드의 회의방이 없어요. 코드를 다시 확인해 주세요',
  full: `회의방이 가득 찼어요 (${CAPACITY}명)`,
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

/** 마이크 허락받기. 거절하거나 없으면 null (듣기만) */
async function getMic(): Promise<MediaStreamTrack | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    return stream.getAudioTracks()[0] ?? null
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

/** 상대 소리 재생. 브라우저가 막으면 onBlocked ([소리 켜기]를 띄움) */
function PeerAudio({ stream, onBlocked }: { stream: MediaStream; onBlocked: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    audio.srcObject = stream
    audio.play().catch((e) => isBlocked(e) && onBlocked())
  }, [stream, onBlocked])
  return <audio ref={ref} autoPlay playsInline />
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

type RoomProps = {
  room: Room<CallSignal>
  nickname: string
  track: MediaStreamTrack | null
  /** 나중에 마이크를 허락받음 */
  onTrack: (track: MediaStreamTrack) => void
  onLeave: () => void
}

/** 방을 닫고 마이크를 끄는 건 부르는 쪽(MeetingPage)이 한다 */
function MeetingRoom({ room, nickname, track, onTrack, onLeave }: RoomProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [blocked, setBlocked] = useState(false)
  const [asking, setAsking] = useState(false)
  /** 통화 상태 (바뀔 때마다 새로 받아 그린다) */
  const [call, setCall] = useState<{ peers: CallPeer[]; mic: boolean }>({ peers: [], mic: true })
  const meshRef = useRef<VoiceMesh | null>(null)
  const trackRef = useRef(track)
  useEffect(() => {
    trackRef.current = track
  })

  useEffect(() => {
    const mesh: VoiceMesh = new VoiceMesh({
      myId: room.myId,
      send: (m) => room.send(m),
      onChange: () => setCall({ peers: mesh.peers(), mic: mesh.mic }),
    })
    meshRef.current = mesh
    mesh.setTrack(trackRef.current)
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

  const micOn = !!track && call.mic
  const myStream = useMemo(() => (track ? new MediaStream([track]) : null), [track])
  const peers = new Map(call.peers.map((p) => [p.id, p]))
  const onBlocked = useMemo(() => () => setBlocked(true), [])
  const hostGone = room.role === 'guest' && !members.some((m) => m.role === 'host')

  async function allowMic() {
    setAsking(true)
    levelContext()
    const t = await getMic()
    setAsking(false)
    if (!t) return
    onTrack(t)
    meshRef.current?.setTrack(t)
  }

  function unblock() {
    setBlocked(false)
    levelContext()
    document.querySelectorAll<HTMLAudioElement>('.meet audio').forEach((a) => void a.play().catch((e) => isBlocked(e) && setBlocked(true)))
  }

  return (
    <section className="meet">
      <div className="meet__code">
        <span>회의방 코드</span>
        <strong>{room.code}</strong>
        <span>
          {members.length + 1}/{CAPACITY}명
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
      {members.length === 0 && <p className="meet__tip">친구들에게 코드를 알려 주세요</p>}
      {[...peers.values()].some((p) => p.connection === 'failed') && (
        <p className="meet__tip">'연결 안 됨'은 인터넷이 막혀 있어서예요 (휴대폰 데이터·회사·학교 와이파이). 와이파이를 바꿔 보세요</p>
      )}
      {hostGone && <p className="meet__tip">방을 만든 사람이 나가서 새로 들어올 수는 없어요</p>}

      {[...peers.values()].map((p) => p.stream && <PeerAudio key={p.id} stream={p.stream} onBlocked={onBlocked} />)}

      <div className="meet__actions">
        {blocked && (
          <button type="button" className="button button--primary meet__big" onClick={unblock}>
            🔊 소리 켜기
          </button>
        )}
        {track ? (
          <button
            type="button"
            className={`button meet__big${micOn ? ' button--primary' : ''}`}
            aria-pressed={micOn}
            onClick={() => meshRef.current?.setMicOn(!micOn)}
          >
            {micOn ? '🎤 마이크 끄기' : '🔇 마이크 켜기'}
          </button>
        ) : (
          <>
            <p className="meet__tip">마이크 없이 듣기만 하고 있어요</p>
            <button type="button" className="button meet__big" disabled={asking} onClick={allowMic}>
              🎤 마이크 허락하기
            </button>
          </>
        )}
        <button type="button" className="button button--small" onClick={onLeave}>
          나가기
        </button>
      </div>
    </section>
  )
}

export function MeetingPage() {
  const nickname = loadNickname() ?? '나'
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [input, setInput] = useState('')
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
    v.track?.stop()
    v.room.leave()
  }

  async function enter(open: () => Promise<Room<CallSignal>>) {
    // 누르는 순간에 소리 장치를 깨워 둔다 (폰은 사용자 동작 안에서만 됨)
    levelContext()
    setView({ kind: 'busy', text: '마이크 확인 중…' })
    const track = await getMic()
    setView({ kind: 'busy', text: '회의방에 들어가는 중…' })
    try {
      const room = await open()
      if (!mountedRef.current) {
        room.leave()
        track?.stop()
        return
      }
      setView({ kind: 'room', room, track })
    } catch (e) {
      track?.stop()
      if (!(e instanceof RoomError)) console.warn('[meeting] 접속 오류', e)
      setView({ kind: 'error', text: e instanceof RoomError ? ERROR_TEXT[e.reason] : ERROR_TEXT.offline })
    }
  }

  function join() {
    const code = normalizeCode(input)
    if (!code) {
      setView({ kind: 'error', text: `코드 ${CODE_LENGTH}자리를 입력해 주세요` })
      return
    }
    void enter(() => joinRoom<CallSignal>(ROOM_ID, code, nickname, { capacity: CAPACITY }))
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
          nickname={nickname}
          track={view.track}
          onTrack={(track) => setView({ ...view, track })}
          onLeave={() => {
            close(view)
            setView({ kind: 'menu' })
          }}
        />
      ) : (
        <section className="pvp-lobby">
          <p className="meet__intro">방 코드로 모여 음성으로 이야기해요 (최대 {CAPACITY}명)</p>
          {view.kind === 'busy' ? (
            <p className="pvp-lobby__status">{view.text}</p>
          ) : (
            <>
              <button
                type="button"
                className="button button--primary pvp-lobby__big"
                onClick={() => void enter(() => createRoom<CallSignal>(ROOM_ID, nickname, { capacity: CAPACITY }))}
              >
                회의방 만들기
              </button>
              <form
                className="pvp-lobby__join"
                onSubmit={(e) => {
                  e.preventDefault()
                  join()
                }}
              >
                <input
                  className="input pvp-lobby__input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="코드 입력"
                  maxLength={CODE_LENGTH + 2}
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label="회의방 코드"
                />
                <button type="submit" className="button">
                  들어가기
                </button>
              </form>
              {view.kind === 'error' && (
                <p className="error pvp-lobby__error" role="alert">
                  {view.text}
                </p>
              )}
            </>
          )}
          <ul className="meet__notes">
            <li>처음에 마이크 사용을 허락해 주세요 (거절하면 듣기만)</li>
            <li>이어폰을 끼면 소리가 울리지 않아요</li>
            <li>데이터는 한 사람과 1시간에 약 10MB</li>
            <li>휴대폰 데이터·회사·학교 와이파이에선 연결이 안 될 수도 있어요</li>
          </ul>
        </section>
      )}
    </main>
  )
}
