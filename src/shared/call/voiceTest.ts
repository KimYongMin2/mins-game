import { VoiceChanger, type VoiceSettings, loadWorklet } from './voiceFx'

// 내 목소리 들어보기: 마이크 소리를 그대로(효과 없이) 몇 초 녹음해 두고, 틀 때 지금 고른 효과를 걸어 들려준다.
// 그래서 한 번 녹음하면 효과를 바꿔 가며 같은 말을 다시 들어 볼 수 있다. 다른 사람에겐 안 간다.

/** 한 번에 녹음하는 길이 (초) */
export const TEST_SECONDS = 5

export type Recording = { stop: () => void; done: Promise<AudioBuffer | null> }

/** 마이크 소리를 녹음한다. 다 되면(시간이 차거나 stop) 소리 묶음, 못 하면 null */
export function recordRaw(ctx: AudioContext, raw: MediaStreamTrack, seconds = TEST_SECONDS): Recording {
  let finish: () => void = () => {}
  const done = (async () => {
    if (!(await loadWorklet(ctx))) return null
    const source = ctx.createMediaStreamSource(new MediaStream([raw]))
    const capture = new AudioWorkletNode(ctx, 'capture')
    // 끝까지 이어져 있어야 도는 브라우저가 있어 소리 0으로 내보낸다
    const silent = ctx.createGain()
    silent.gain.value = 0
    source.connect(capture)
    capture.connect(silent)
    silent.connect(ctx.destination)
    const chunks: Float32Array[] = []
    const max = Math.floor(ctx.sampleRate * seconds)
    let total = 0
    await new Promise<void>((resolve) => {
      finish = resolve
      capture.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (total >= max) return
        chunks.push(e.data)
        total += e.data.length
        if (total >= max) resolve()
      }
      setTimeout(resolve, seconds * 1000 + 500)
    })
    capture.port.onmessage = null
    source.disconnect()
    capture.disconnect()
    silent.disconnect()
    const length = Math.min(total, max)
    if (length === 0) return null
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let at = 0
    for (const c of chunks) {
      if (at >= length) break
      data.set(c.subarray(0, length - at), at)
      at += c.length
    }
    return buffer
  })()
  return { stop: () => finish(), done }
}

/** 녹음한 소리를 효과를 걸어 튼다. out: 들려줄 곳. 다 틀면 onEnd */
export class TestPlayback {
  private voice: VoiceChanger
  private source: AudioBufferSourceNode
  private disconnect: () => void
  private ended = false

  constructor(ctx: AudioContext, buffer: AudioBuffer, settings: VoiceSettings, out: AudioNode, onEnd: () => void) {
    this.source = ctx.createBufferSource()
    this.source.buffer = buffer
    this.voice = new VoiceChanger(ctx, this.source)
    this.voice.setSending(false)
    this.voice.apply(settings)
    this.disconnect = this.voice.connectOut(out)
    // 효과(높이 바꾸기 모듈)가 걸린 뒤 틀고, 메아리·울림 꼬리까지 조금 더 기다린다
    setTimeout(() => {
      if (this.ended) return
      this.source.onended = () => setTimeout(() => this.finish(onEnd), 900)
      this.source.start()
    }, 150)
  }

  /** 트는 중에 효과를 바꾸면 바로 */
  apply(settings: VoiceSettings) {
    if (!this.ended) this.voice.apply(settings)
  }

  stop() {
    this.finish(() => {})
  }

  private finish(onEnd: () => void) {
    if (this.ended) return
    this.ended = true
    this.source.onended = null
    try {
      this.source.stop()
    } catch {
      // 아직 안 틀었으면
    }
    this.disconnect()
    this.voice.stop()
    onEnd()
  }
}
