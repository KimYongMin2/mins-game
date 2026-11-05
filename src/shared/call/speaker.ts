// 듣는 소리: 상대들 소리를 Web Audio로 모아 크기를 바꾼 뒤 audio 하나로 튼다.
// audio 요소 volume은 1보다 못 키우고 아이폰에선 아예 안 먹어서, 소리 크기는 여기 GainNode로 바꾼다.
// 아이폰 무음 스위치에도 들리게 ctx.destination이 아니라 스트림(stream)으로 내보내 audio 요소로 튼다.

/** 듣는 소리 크기 배율 (사용자가 고름) */
export const LISTEN_VOLUME = { min: 0, max: 3, default: 1 }
/** 기본으로 조금 키워 듣는다 (끝에 리미터가 있어 찢어지지 않음) */
const LISTEN_BOOST = 1.5

export class Speaker {
  /** 틀 소리 (audio 요소의 srcObject로) */
  readonly stream: MediaStream
  private ctx: AudioContext
  private gain: GainNode
  private volume = LISTEN_VOLUME.default

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gain = ctx.createGain()
    this.gain.gain.value = LISTEN_BOOST * this.volume
    // 너무 크게 키워도 소리가 깨지지 않게 꼭대기만 눌러 준다
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -4
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.1
    const out = ctx.createMediaStreamDestination()
    this.gain.connect(limiter)
    limiter.connect(out)
    this.stream = out.stream
  }

  get level(): number {
    return this.volume
  }

  setVolume(v: number) {
    this.volume = Math.min(LISTEN_VOLUME.max, Math.max(LISTEN_VOLUME.min, v))
    this.gain.gain.setTargetAtTime(LISTEN_BOOST * this.volume, this.ctx.currentTime, 0.03)
  }

  /** 한 사람 소리를 더한다. 빼는 함수를 돌려준다 */
  add(stream: MediaStream): () => void {
    const source = this.ctx.createMediaStreamSource(stream)
    source.connect(this.gain)
    return () => source.disconnect()
  }
}
