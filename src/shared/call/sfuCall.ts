import { LocalAudioTrack, LocalVideoTrack, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication, Room as LkRoom, RoomEvent, ScreenSharePresets, Track, VideoPresets } from 'livekit-client'
import type { CallPeer } from './voiceMesh'

// 음성 통화를 우리 음성 서버(LiveKit, AWS Lightsail)로 (사용자 요청 2026-11-16 — 기기끼리 잇는 방식은 막힌 망에서 안 이어져서 서버를 삼).
// 모두 서버 하나에 붙고 서버가 소리를 나눠 준다. 막힌 망은 서버 안 TURN이 받아 준다.
// 방(Room)·게임은 모른다: 사람 목록(접속 번호)은 setMembers로, 입장권은 getToken으로 받는다.
// LiveKit 참가자 이름(identity) = '방 접속 번호.사용자 ID 앞 8자'(입장권 서버가 붙임) → 점 앞이 접속 번호.
// 화면 쪽은 VoiceMesh와 같은 모양(peers·mic·setTrack·setMicOn·setMembers·refresh·close)으로 쓴다.

/** 음성 최대 비트레이트 (한 사람 말소리 1시간 약 10MB) */
const VOICE_BITRATE = 24_000

/**
 * 화상 (사용자 요청 2026-11-17 — 회의방에 카메라). 큰 칸용 360p + 작은 칸용 180p 두 겹(simulcast)으로 올리고,
 * 보는 쪽은 adaptiveStream이 칸 크기에 맞는 겹만 받는다 (작은 칸은 낮은 화질 → 서버 데이터 줄임)
 */
const CAMERA_ENCODING = VideoPresets.h360.encoding
const CAMERA_LAYERS = [VideoPresets.h180]

/** 화면 공유: 글자가 보이게 720p·초당 15장 (보는 칸이 작으면 360p·초당 3장 겹을 받음) */
const SCREEN_ENCODING = ScreenSharePresets.h720fps15.encoding
const SCREEN_LAYERS = [ScreenSharePresets.h360fps3]

/** 화면에 붙이는 영상 (LiveKit 원격 영상 트랙 — attach하면 칸 크기를 보고 화질을 고른다) */
export type VideoSource = { attach(el: HTMLMediaElement): HTMLMediaElement; detach(el: HTMLMediaElement): HTMLMediaElement }

/** 참가자 이름에서 방 접속 번호 */
export const memberIdOf = (identity: string) => identity.split('.')[0]

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
  private camera: MediaStreamTrack | null = null
  private localVideo: LocalVideoTrack | null = null
  private screen: { video: MediaStreamTrack; audio: MediaStreamTrack | null } | null = null
  private localScreen: { video: LocalVideoTrack; audio: LocalAudioTrack | null } | null = null
  /** 화면 공유 소리 (그 사람 접속 번호 → 소리) */
  private screenStreams = new Map<string, MediaStream>()
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
      // 소리는 마이크와 화면 공유 소리를 따로 둔다 (같은 사람 것이라도 섞이면 마이크 소리를 덮어씀)
      .on(RoomEvent.TrackSubscribed, (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (t.kind === Track.Kind.Audio) (pub.source === Track.Source.ScreenShareAudio ? this.screenStreams : this.streams).set(memberIdOf(p.identity), new MediaStream([t.mediaStreamTrack]))
        change()
      })
      .on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (t.kind === Track.Kind.Audio) (pub.source === Track.Source.ScreenShareAudio ? this.screenStreams : this.streams).delete(memberIdOf(p.identity))
        change()
      })
      .on(RoomEvent.ParticipantConnected, change)
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        this.streams.delete(memberIdOf(p.identity))
        this.screenStreams.delete(memberIdOf(p.identity))
        change()
      })
      .on(RoomEvent.TrackPublished, change)
      .on(RoomEvent.TrackUnpublished, change)
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
        this.localVideo = null
        this.localScreen = null
        await this.publish()
        await this.publishCamera()
        await this.publishScreen()
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

  private async publishCamera() {
    if (!this.camera || this.localVideo || this.lk.state !== 'connected') return
    const video = new LocalVideoTrack(this.camera, undefined, true)
    this.localVideo = video
    await this.lk.localParticipant.publishTrack(video, { source: Track.Source.Camera, simulcast: true, videoEncoding: CAMERA_ENCODING, videoSimulcastLayers: CAMERA_LAYERS })
  }

  /** 내 카메라 (없으면 null = 끔). 켜는 중에 바꾸면(앞·뒤 카메라) 트랙만 갈아 끼운다. 카메라 트랙을 끄는 건 부르는 쪽 */
  setCamera(track: MediaStreamTrack | null) {
    if (track === this.camera) return
    this.camera = track
    const old = this.localVideo
    if (old && track) void old.replaceTrack(track, true)
    else if (old) {
      void this.lk.localParticipant.unpublishTrack(old, false)
      this.localVideo = null
    } else void this.publishCamera().catch((e) => console.warn('[call] 카메라 올리기 실패', e))
    this.opts.onChange()
  }

  private async publishScreen() {
    if (!this.screen || this.localScreen || this.lk.state !== 'connected') return
    const video = new LocalVideoTrack(this.screen.video, undefined, true)
    const audio = this.screen.audio ? new LocalAudioTrack(this.screen.audio, undefined, true) : null
    this.localScreen = { video, audio }
    await this.lk.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare, simulcast: true, videoEncoding: SCREEN_ENCODING, videoSimulcastLayers: SCREEN_LAYERS, degradationPreference: 'maintain-resolution' })
    if (audio) await this.lk.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio, audioPreset: { maxBitrate: 64_000 }, dtx: false, red: false })
  }

  /** 내 화면 공유 (영상 + 있으면 소리, null = 그만). 트랙을 끄는 건 부르는 쪽 */
  setScreen(screen: { video: MediaStreamTrack; audio: MediaStreamTrack | null } | null) {
    const old = this.localScreen
    this.screen = screen
    if (old) {
      void this.lk.localParticipant.unpublishTrack(old.video, false)
      if (old.audio) void this.lk.localParticipant.unpublishTrack(old.audio, false)
      this.localScreen = null
    }
    if (screen) void this.publishScreen().catch((e) => console.warn('[call] 화면 공유 올리기 실패', e))
    this.opts.onChange()
  }

  /** 그 사람의 화면 공유 영상 (안 하면 null) */
  screenOf(id: string): VideoSource | null {
    for (const p of this.lk.remoteParticipants.values()) {
      if (memberIdOf(p.identity) !== id) continue
      const pub = p.getTrackPublication(Track.Source.ScreenShare)
      if (pub?.videoTrack && !pub.isMuted) return pub.videoTrack
    }
    return null
  }

  /** 그 사람이 화면 공유를 하고 있는지 (영상을 아직 못 받았어도) */
  sharing(id: string): boolean {
    for (const p of this.lk.remoteParticipants.values()) if (memberIdOf(p.identity) === id && p.getTrackPublication(Track.Source.ScreenShare)) return true
    return false
  }

  /** 그 사람의 화면 공유 소리 */
  screenAudioOf(id: string): MediaStream | null {
    return this.screenStreams.get(id) ?? null
  }

  /** 그 사람(방 접속 번호)의 카메라 영상. 안 켰거나 아직 못 받았으면 null */
  videoOf(id: string): VideoSource | null {
    for (const p of this.lk.remoteParticipants.values()) {
      if (memberIdOf(p.identity) !== id) continue
      const pub = p.getTrackPublication(Track.Source.Camera)
      if (pub?.videoTrack && !pub.isMuted) return pub.videoTrack
    }
    return null
  }

  peers(): CallPeer[] {
    return this.members.map((id) => {
      const p = [...this.lk.remoteParticipants.values()].find((x) => memberIdOf(x.identity) === id)
      const pub = p?.getTrackPublication(Track.Source.Microphone)
      return {
        id,
        connection: p ? 'connected' : this.failed ? 'failed' : 'connecting',
        micOn: !!pub && !pub.isMuted,
        stream: this.streams.get(id) ?? null,
      }
    })
  }

  /**
   * 음성 서버엔 붙어 있는데 방 사람 목록엔 없는 사람 수 (보안: 방 코드를 알고 목록에 안 보이게 몰래 듣는 사람을 화면에 드러냄).
   * 같은 접속 번호로 둘이 붙어 있어도 하나는 여기로 센다
   */
  strangers(): number {
    const seen = new Set<string>()
    let n = 0
    for (const p of this.lk.remoteParticipants.values()) {
      const id = memberIdOf(p.identity)
      if (!this.members.includes(id) || seen.has(id)) n++
      seen.add(id)
    }
    return n
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
