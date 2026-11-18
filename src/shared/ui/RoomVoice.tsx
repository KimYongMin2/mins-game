import { useEffect, useRef, useState } from 'react'
import { levelContext, watchLevel } from '../call/level'
import { SfuCall } from '../call/sfuCall'
import { SFU_URL } from '../call/sfuToken'
import { Speaker } from '../call/speaker'
import type { Member, Room } from '../online/room'
import { IconHeadphoneOff, IconHeadphones, IconMic, IconMicOff, IconPhoneOff } from './icons'

// 게임 방 음성 (RoomDock이 [음성]을 누르면 그때 받음). 이 방 사람끼리 우리 음성 서버(LiveKit)로.
// 입장권은 게임 서버가 '이 방에 들어와 있는 사람'인지 보고 줌. 마이크는 여기서 켜고, 나가면(창이 사라지면) 끔.

type Props = { room: Room<unknown>; members: Member[]; onLeave: () => void }

export default function RoomVoice({ room, members, onLeave }: Props) {
  const [, setTick] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [deaf, setDeaf] = useState(false)
  const [noMic, setNoMic] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [speaking, setSpeaking] = useState<Set<string>>(new Set())
  const callRef = useRef<SfuCall | null>(null)
  const speakerRef = useRef<Speaker | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // 연결 (한 번)
  useEffect(() => {
    const speaker = new Speaker(levelContext())
    speakerRef.current = speaker
    let mic: MediaStreamTrack | null = null
    let stopMine: (() => void) | null = null
    const call = new SfuCall({
      url: SFU_URL ?? '',
      getToken: async () => {
        const t = room.sfuToken ? await room.sfuToken() : null
        if (!t) throw new Error('입장권을 못 받음')
        return t
      },
      onChange: () => setTick((n) => n + 1),
    })
    callRef.current = call
    let alive = true
    void navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        mic = s.getAudioTracks()[0] ?? null
        if (!alive) return mic?.stop()
        call.setTrack(mic)
        if (mic) stopMine = watchLevel(new MediaStream([mic]), (on) => setSpeaking((p) => toggle(p, room.myId, on)))
      })
      .catch(() => setNoMic(true))
    const audio = audioRef.current
    if (audio) {
      audio.srcObject = speaker.stream
      audio.play().catch(() => setBlocked(true))
    }
    // 화면으로 돌아오면 끊겼는지 보고 다시 붙음
    const onVisible = () => document.visibilityState === 'visible' && call.refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      stopMine?.()
      call.close()
      mic?.stop()
      callRef.current = null
    }
  }, [room])

  // 방 사람 목록 (음성 서버엔 있는데 목록에 없는 사람은 안 받음)
  useEffect(() => {
    callRef.current?.setMembers(members.map((m) => m.id))
  }, [members])

  const call = callRef.current
  const peers = call?.peers() ?? []
  const inVoice = peers.filter((p) => p.connection === 'connected')

  return (
    <div className="rvoice">
      <audio ref={audioRef} autoPlay playsInline />
      {peers.map((p) => p.stream && <PeerSound key={p.id} id={p.id} stream={p.stream} speaker={speakerRef.current} onSpeaking={(on) => setSpeaking((s) => toggle(s, p.id, on))} />)}
      <button
        type="button"
        className={`rdock__btn rdock__btn--live${micOn && !noMic ? '' : ' rdock__btn--muted'}`}
        onClick={() => {
          const next = !micOn
          setMicOn(next)
          call?.setMicOn(next)
        }}
        disabled={noMic}
        aria-label={noMic ? '마이크를 쓸 수 없어요 (듣기만)' : micOn ? '마이크 끄기' : '마이크 켜기'}
        title={noMic ? '마이크를 허락하지 않아서 듣기만 해요' : micOn ? '마이크 끄기' : '마이크 켜기'}
      >
        {micOn && !noMic ? <IconMic width={20} height={20} /> : <IconMicOff width={20} height={20} />}
        {speaking.has(room.myId) && micOn && <span className="rdock__ring" />}
      </button>
      <div className="rvoice__more">
        <button
          type="button"
          className={`rdock__mini${deaf ? ' rdock__mini--on' : ''}`}
          onClick={() => {
            const next = !deaf
            setDeaf(next)
            speakerRef.current?.setDeafened(next)
          }}
          aria-label={deaf ? '듣기 켜기' : '듣기 끄기'}
          title={deaf ? '듣기 켜기' : '듣기 끄기'}
        >
          {deaf ? <IconHeadphoneOff width={16} height={16} /> : <IconHeadphones width={16} height={16} />}
        </button>
        <button type="button" className="rdock__mini rdock__mini--leave" onClick={onLeave} aria-label="음성 나가기" title="음성 나가기">
          <IconPhoneOff width={16} height={16} />
        </button>
      </div>
      <ul className="rvoice__who" aria-label="음성에 들어온 사람">
        <li className={speaking.has(room.myId) && micOn ? 'is-speaking' : undefined}>나</li>
        {inVoice.map((p) => (
          <li key={p.id} className={speaking.has(p.id) ? 'is-speaking' : undefined}>
            {!p.micOn && <IconMicOff width={11} height={11} />}
            {members.find((m) => m.id === p.id)?.nickname ?? '?'}
          </li>
        ))}
      </ul>
      {blocked && (
        <button
          type="button"
          className="rvoice__unblock"
          onClick={() => {
            levelContext()
            void audioRef.current?.play().then(() => setBlocked(false))
          }}
        >
          소리 켜기
        </button>
      )}
    </div>
  )
}

const toggle = (s: Set<string>, id: string, on: boolean) => {
  if (s.has(id) === on) return s
  const n = new Set(s)
  if (on) n.add(id)
  else n.delete(id)
  return n
}

/** 상대 한 사람 소리: 듣는 소리(Speaker)에 더하고 말하는 중을 잼. 크롬은 받은 소리를 audio에 걸어 둬야 Web Audio로 나와서 소리 끈 audio도 둠 */
function PeerSound({ stream, speaker, onSpeaking }: { id: string; stream: MediaStream; speaker: Speaker | null; onSpeaking: (on: boolean) => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const cb = useRef(onSpeaking)
  cb.current = onSpeaking
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream
      void ref.current.play().catch(() => {})
    }
    const h = speaker?.add(stream)
    const stop = watchLevel(stream, (on) => cb.current(on))
    return () => {
      h?.remove()
      stop()
      cb.current(false)
    }
  }, [stream, speaker])
  return <audio ref={ref} autoPlay playsInline muted />
}
