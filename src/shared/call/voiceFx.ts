// 목소리 변조: 마이크 소리를 보내기 전에 내 기기에서 Web Audio로 바꾼다. 상대는 바뀐 소리만 듣고, 바꿨다는 표시는 없다.
// 마이크 → [효과] → 보낼 트랙(track). 효과를 바꿔도 보낼 트랙은 그대로라 통화를 다시 잇지 않는다.

export type VoiceEffect = 'normal' | 'high' | 'low' | 'robot' | 'radio' | 'echo'

export const VOICE_EFFECTS: { id: VoiceEffect; label: string }[] = [
  { id: 'normal', label: '보통' },
  { id: 'high', label: '높게' },
  { id: 'low', label: '낮게' },
  { id: 'robot', label: '로봇' },
  { id: 'radio', label: '무전기' },
  { id: 'echo', label: '메아리' },
]

/** 높게·낮게: 소리 높이 배율 */
const PITCH = { high: 1.6, low: 0.65 }

// 소리 높이 바꾸기 (실시간): 지난 소리를 담아 두고 두 읽기 위치를 다른 빠르기로 훑으며, 이음매는 서로 엇갈려 부드럽게 섞는다.
// 지연은 GRAIN 정도(약 0.02~0.04초). 짧게 끊어 붙이는 방식이라 조금 지글거린다.
const PITCH_WORKLET = `
const GRAIN = 1536
const SIZE = 8192
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4 }] }
  constructor() { super(); this.buf = new Float32Array(SIZE); this.w = 0; this.phase = 0 }
  read(pos) {
    const p = (pos + SIZE * 4) % SIZE, i = Math.floor(p), f = p - i
    return this.buf[i] * (1 - f) + this.buf[(i + 1) % SIZE] * f
  }
  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0], out = outputs[0]
    if (!out || !out[0]) return true
    const ratio = params.ratio[0]
    for (let i = 0; i < out[0].length; i++) {
      this.buf[this.w] = input ? input[i] : 0
      this.phase = (this.phase + (1 - ratio) + GRAIN) % GRAIN
      const d1 = this.phase, d2 = (this.phase + GRAIN / 2) % GRAIN
      const g1 = Math.sin(Math.PI * d1 / GRAIN) ** 2, g2 = Math.sin(Math.PI * d2 / GRAIN) ** 2
      const y = this.read(this.w - d1) * g1 + this.read(this.w - d2) * g2
      for (const ch of out) ch[i] = y
      this.w = (this.w + 1) % SIZE
    }
    return true
  }
}
registerProcessor('pitch-shift', PitchShift)
`

const workletReady = new WeakMap<AudioContext, Promise<boolean>>()

/** 높이 바꾸기 모듈을 한 번만 올린다. 못 쓰는 브라우저면 false (높게·낮게가 보통으로) */
function loadWorklet(ctx: AudioContext): Promise<boolean> {
  let ready = workletReady.get(ctx)
  if (!ready) {
    const url = URL.createObjectURL(new Blob([PITCH_WORKLET], { type: 'application/javascript' }))
    ready = (ctx.audioWorklet?.addModule(url) ?? Promise.reject(new Error('no worklet')))
      .then(() => true)
      .catch((e) => {
        console.warn('[voice] 높이 바꾸기를 못 써요', e)
        return false
      })
    workletReady.set(ctx, ready)
  }
  return ready
}

/** 무전기 찌그러짐 */
function crunchCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}

/** 계속 나는 작은 잡음 (무전기 지지직). 말하는 중 표시가 안 켜질 만큼 작게 */
function noiseSource(ctx: AudioContext): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  return src
}

export class VoiceChanger {
  /** 보낼 소리 (효과가 들어간 것). 마이크 끄기는 이 트랙의 enabled로 */
  readonly track: MediaStreamTrack
  private ctx: AudioContext
  private raw: MediaStreamTrack
  private input: MediaStreamAudioSourceNode
  private output: MediaStreamAudioDestinationNode
  /** 지금 효과에 쓰는 노드들 (바꿀 때 끊고 멈춘다) */
  private nodes: AudioNode[] = []
  private effect: VoiceEffect = 'normal'
  private seq = 0

  constructor(ctx: AudioContext, raw: MediaStreamTrack) {
    this.ctx = ctx
    this.raw = raw
    this.input = ctx.createMediaStreamSource(new MediaStream([raw]))
    this.output = ctx.createMediaStreamDestination()
    this.track = this.output.stream.getAudioTracks()[0]
    this.input.connect(this.output)
    void loadWorklet(ctx)
    document.addEventListener('visibilitychange', this.wake)
  }

  /** 폰은 다른 앱에 갔다 오면 소리 처리가 멈춰 있을 수 있다. 멈추면 상대에게 소리가 안 가므로 다시 켠다 */
  private wake = () => {
    if (document.visibilityState === 'visible' && this.ctx.state !== 'running') void this.ctx.resume()
  }

  get current(): VoiceEffect {
    return this.effect
  }

  async setEffect(effect: VoiceEffect) {
    this.effect = effect
    const seq = ++this.seq
    const pitch = effect === 'high' || effect === 'low'
    const canPitch = pitch && (await loadWorklet(this.ctx))
    // 그사이 다른 효과로 또 바꿨으면 이번 건 버린다
    if (seq !== this.seq) return
    this.clear()
    const { ctx, input, output } = this
    const chain = (...ns: AudioNode[]) => {
      for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1])
    }
    const keep = <T extends AudioNode>(n: T) => (this.nodes.push(n), n)

    if (canPitch) {
      const shifter = keep(new AudioWorkletNode(ctx, 'pitch-shift'))
      shifter.parameters.get('ratio')!.value = PITCH[effect as 'high' | 'low']
      chain(input, shifter, output)
    } else if (effect === 'robot') {
      // 낮은 떨림으로 곱하기(링 변조) + 짧은 울림
      const ring = keep(ctx.createGain())
      ring.gain.value = 0
      const osc = keep(ctx.createOscillator())
      osc.frequency.value = 55
      osc.connect(ring.gain)
      osc.start()
      const comb = keep(ctx.createDelay(0.1))
      comb.delayTime.value = 0.008
      const fb = keep(ctx.createGain())
      fb.gain.value = 0.45
      const boost = keep(ctx.createGain())
      boost.gain.value = 1.8
      chain(input, ring, comb, boost, output)
      chain(comb, fb, comb)
      chain(ring, boost)
    } else if (effect === 'radio') {
      const hp = keep(ctx.createBiquadFilter())
      hp.type = 'highpass'
      hp.frequency.value = 500
      const lp = keep(ctx.createBiquadFilter())
      lp.type = 'lowpass'
      lp.frequency.value = 2800
      const crunch = keep(ctx.createWaveShaper())
      crunch.curve = crunchCurve(8)
      const level = keep(ctx.createGain())
      level.gain.value = 0.7
      chain(input, hp, crunch, lp, level, output)
      const noise = keep(noiseSource(ctx))
      const noiseBand = keep(ctx.createBiquadFilter())
      noiseBand.type = 'bandpass'
      noiseBand.frequency.value = 1800
      const noiseLevel = keep(ctx.createGain())
      noiseLevel.gain.value = 0.006
      chain(noise, noiseBand, noiseLevel, output)
      noise.start()
    } else if (effect === 'echo') {
      const delay = keep(ctx.createDelay(1))
      delay.delayTime.value = 0.28
      const fb = keep(ctx.createGain())
      fb.gain.value = 0.38
      const wet = keep(ctx.createGain())
      wet.gain.value = 0.55
      input.connect(output)
      chain(input, delay, wet, output)
      chain(delay, fb, delay)
    } else {
      input.connect(output)
    }
  }

  /** 마이크와 효과를 모두 끈다 */
  stop() {
    this.seq++
    this.clear()
    document.removeEventListener('visibilitychange', this.wake)
    this.raw.stop()
    this.track.stop()
  }

  private clear() {
    this.input.disconnect()
    for (const n of this.nodes) {
      if (n instanceof AudioScheduledSourceNode) n.stop()
      n.disconnect()
    }
    this.nodes = []
  }
}
