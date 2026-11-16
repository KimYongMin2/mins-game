import { LocalAudioTrack, type RemoteParticipant, type RemoteTrack, Room as LkRoom, RoomEvent, Track } from 'livekit-client'
import type { CallPeer } from './voiceMesh'

// 음성 통화를 우리 음성 서버(LiveKit, AWS Lightsail)로 (사용자 요청 2026-11-16 — 기기끼리 잇는 방식은 막힌 망에서 안 이어져서 서버를 삼).
// 모두 서버 하나에 붙고 서버가 소리를 나눠 준다. 막힌 망은 서버 안 TURN이 받아 준다.
// 방(Room)·게임은 모른다: 사람 목록(접속 번호)은 setMembers로, 입장권은 getToken으로 받는다. LiveKit 참가자 이름(identity) = 방 접속 번호.
// 화면 쪽은 VoiceMesh와 같은 모양(peers·mic·setTrack·setMicOn·setMembers·refresh·close)으로 쓴다.

/** 음성 최대 비트레이트 (한 사람 말소리 1시간 약 10MB) */
const VOICE_BITRATE = 24_000

type Options = {
  url: string
  /** 이 방 입장권 (매번 새로 받음) */
  getToken: () => Promise<string>
  onChange: () => void
}

export class SfuCall {
  private lk = new LkRoom({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true })
  private members: string[] = []
  private track: MediaStreamTrack | null = null
  private local: LocalAudioTrack | null = null
  private micOn = true
  private failed = false
  private closed = false
  private connecting: Promise<void> | null = null
  private streams = new Map<string, MediaStream>()
  private opts: Options

  constructor(opts: Options) {
    this.opts = opts
    const change = () => this.opts.onChange()
    this.lk
      .on(RoomEvent.TrackSubscribed, (t: RemoteTrack, _pub, p: RemoteParticipant) => {
        if (t.kind === Track.Kind.Audio) this.streams.set(p.identity, new MediaStream([t.mediaStreamTrack]))
        change()
      })
      .on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack, _pub, p: RemoteParticipant) => {
        if (t.kind === Track.Kind.Audio) this.streams.delete(p.identity)
        change()
      })
      .on(RoomEvent.ParticipantConnected, change)
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        this.streams.delete(p.identity)
        change()
      })
      .on(RoomEvent.TrackMuted, change)
      .on(RoomEvent.TrackUnmuted, change)
      .on(RoomEvent.Reconnected, change)
      .on(RoomEvent.Disconnected, () => {
        if (!this.closed) this.failed = true
        change()
      })
    void this.connect()
  }

  private connect(): Promise<void> {
    this.connecting ??= (async () => {
      try {
        const token = await this.opts.getToken()
        if (this.closed) return
        await this.lk.connect(this.opts.url, token)
        if (this.closed) return void this.lk.disconnect(false)
        this.failed = false
        this.local = null
        await this.publish()
      } catch (e) {
        console.warn('[call] 음성 서버 연결 실패', e)
        this.failed = true
      } finally {
        this.connecting = null
        this.opts.onChange()
      }
    })()
    return this.connecting
  }

  private async publish() {
    if (!this.track || this.local || this.lk.state !== 'connected') return
    const local = new LocalAudioTrack(this.track, undefined, true)
    this.local = local
    if (!this.micOn) await local.mute()
    await this.lk.localParticipant.publishTrack(local, { source: Track.Source.Microphone, audioPreset: { maxBitrate: VOICE_BITRATE }, dtx: true, red: true })
  }

  peers(): CallPeer[] {
    return this.members.map((id) => {
      const p = this.lk.remoteParticipants.get(id)
      const pub = p?.getTrackPublication(Track.Source.Microphone)
      return {
        id,
        connection: p ? 'connected' : this.failed ? 'failed' : 'connecting',
        micOn: !!pub && !pub.isMuted,
        stream: this.streams.get(id) ?? null,
      }
    })
  }

  get mic(): boolean {
    return this.micOn
  }

  setMembers(ids: string[]) {
    this.members = ids
    this.opts.onChange()
  }

  /** 내 마이크 (목소리 변조를 거친 트랙, 없으면 null = 듣기만). 나중에 허락받으면 그때 올린다 */
  setTrack(track: MediaStreamTrack | null) {
    if (track === this.track) return
    this.track = track
    const old = this.local
    if (old && track) void old.replaceTrack(track, true)
    else if (old) {
      void this.lk.localParticipant.unpublishTrack(old, false)
      this.local = null
    } else void this.publish().catch((e) => console.warn('[call] 마이크 올리기 실패', e))
    this.opts.onChange()
  }

  setMicOn(on: boolean) {
    this.micOn = on
    if (this.local) void (on ? this.local.unmute() : this.local.mute())
    this.opts.onChange()
  }

  /** 돌아왔을 때: 끊겨 있으면 다시 붙는다 (잠깐 끊긴 건 LiveKit이 알아서 다시 붙음) */
  refresh() {
    if (this.closed || this.connecting) return
    if (this.lk.state === 'disconnected') void this.connect()
  }

  close() {
    this.closed = true
    void this.lk.disconnect(false) // 마이크 트랙은 VoiceChanger 것이라 끄지 않음
  }
}
