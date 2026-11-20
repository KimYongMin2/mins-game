// 듣는 소리: 상대들 소리를 Web Audio로 모아 크기를 바꾼 뒤 audio 하나로 튼다.
// audio 요소 volume은 1보다 못 키우고 아이폰에선 아예 안 먹어서, 소리 크기는 여기 GainNode로 바꾼다.
// 아이폰 무음 스위치에도 들리게 ctx.destination이 아니라 스트림(stream)으로 내보내 audio 요소로 튼다.

/** 듣는 소리 크기 배율 (사용자가 고름) */
export const LISTEN_VOLUME = { min: 0, max: 3, default: 1 }
/** 사람마다 소리 크기 배율 (디스코드처럼 그 사람만 키우거나 줄이기) */
export const PERSON_VOLUME = { min: 0, max: 2, default: 1 }
/** 듣는 소리 기본 배율 — 1.5였는데 리미터에 눌려 찌그러져 1로 (사용자 요청 2026-11-20, 작으면 사용자가 '듣는 소리'로 키움) */
const LISTEN_BOOST = 1

export class Speaker {
  /** 틀 소리 (audio 요소의 srcObject로) */
  readonly stream: MediaStream
  private ctx: AudioContext
  private gain: GainNode
  private volume = LISTEN_VOLUME.default
  private deafened = false

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
    this.apply()
  }

  /** 듣기 끄기 (디스코드 헤드셋 버튼): 모든 사람 소리를 0으로, 풀면 원래 크기 */
  setDeafened(on: boolean) {
    this.deafened = on
    this.apply()
  }

  private apply() {
    this.gain.gain.setTargetAtTime(this.deafened ? 0 : LISTEN_BOOST * this.volume, this.ctx.currentTime, 0.03)
  }

  /** 한 사람 소리를 더한다. 그 사람 크기(0~2배)를 바꾸는 함수와 빼는 함수를 돌려준다 */
  add(stream: MediaStream, volume = PERSON_VOLUME.default): { setVolume: (v: number) => void; remove: () => void } {
    const source = this.ctx.createMediaStreamSource(stream)
    const own = this.ctx.createGain()
    const clamp = (v: number) => Math.min(PERSON_VOLUME.max, Math.max(PERSON_VOLUME.min, v))
    own.gain.value = clamp(volume)
    source.connect(own)
    own.connect(this.gain)
    return {
      setVolume: (v) => own.gain.setTargetAtTime(clamp(v), this.ctx.currentTime, 0.03),
      remove: () => {
        source.disconnect()
        own.disconnect()
      },
    }
  }
}
