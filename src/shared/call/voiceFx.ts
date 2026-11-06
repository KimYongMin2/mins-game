// 목소리 변조: 마이크 소리를 보내기 전에 내 기기에서 Web Audio로 바꾼다. 상대는 바뀐 소리만 듣고, 바꿨다는 표시는 없다.
// 마이크 → [효과] → 마이크 크기 → 압축(작은 소리는 키우고 큰 소리는 눌러 전체를 크게) → 보낼 트랙(track).
// 효과를 바꿔도 보낼 트랙은 그대로라 통화를 다시 잇지 않는다.

export type VoiceEffect = 'normal' | 'high' | 'low' | 'helium' | 'monster' | 'robot' | 'radio' | 'phone' | 'echo' | 'cave' | 'karaoke' | 'autotune'

export const VOICE_EFFECTS: { id: VoiceEffect; label: string }[] = [
  { id: 'normal', label: '보통' },
  { id: 'high', label: '높게' },
  { id: 'low', label: '낮게' },
  { id: 'helium', label: '헬륨' },
  { id: 'monster', label: '괴물' },
  { id: 'robot', label: '로봇' },
  { id: 'radio', label: '무전기' },
  { id: 'phone', label: '전화기' },
  { id: 'echo', label: '메아리' },
  { id: 'cave', label: '동굴' },
  { id: 'karaoke', label: '노래방' },
  { id: 'autotune', label: '오토튠' },
]

/** 사용자가 슬라이더로 고르는 세기 (0~1): 동굴 울림, 노래방 울림·에코, 오토튠 음 맞추기 */
export type VoiceMix = 'caveReverb' | 'karaokeReverb' | 'karaokeEcho' | 'autotune'
export const VOICE_MIX_DEFAULT: Record<VoiceMix, number> = { caveReverb: 0.5, karaokeReverb: 0.35, karaokeEcho: 0.4, autotune: 0.8 }

/** 오토튠 음계: 반음 전부(12음) 또는 고른 조(장조·단조)의 7음 */
export type TuneScale = { kind: 'chromatic' } | { kind: 'major' | 'minor'; root: number }
export const TUNE_ROOTS = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시']
const SCALE_STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }

/** 맞출 수 있는 음 (도=0 … 시=11) 12칸 표시 */
export function scaleMask(scale: TuneScale): boolean[] {
  if (scale.kind === 'chromatic') return Array(12).fill(true)
  const mask = Array(12).fill(false)
  for (const step of SCALE_STEPS[scale.kind]) mask[(scale.root + step) % 12] = true
  return mask
}

/** midi 음 높이(소수)를 맞출 수 있는 가장 가까운 음으로 */
export function nearestNote(midi: number, mask: boolean[]): number {
  let best = Math.round(midi)
  let dist = Infinity
  for (let n = Math.floor(midi) - 2; n <= Math.ceil(midi) + 2; n++) {
    if (!mask[((n % 12) + 12) % 12]) continue
    const d = Math.abs(n - midi)
    if (d < dist) {
      dist = d
      best = n
    }
  }
  return best
}

/** 목소리 효과 설정 한 묶음 (방 목록에서 고른 걸 방에 들고 들어간다) */
export type VoiceSettings = { effect: VoiceEffect; echo: number; mix: Record<VoiceMix, number>; scale: TuneScale }

/** 동굴: 길게 퍼지는 울림(초) · 노래방: 짧은 홀 울림 + 마이크 에코 */
const CAVE = { seconds: 3.2, decay: 2.2, wet: 1.4 }
const KARAOKE = { seconds: 1.6, decay: 3, wet: 1.1, echoDelay: 0.13, tone: 3500 }

/** 메아리: 울리는 간격(초). 노래방 마이크 에코 범위 안에서 고른다 (처음 0.1~0.8초는 너무 길게 울려 줄임) */
export const ECHO_DELAY = { min: 0.08, max: 0.3, default: 0.15 }

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { effect: 'normal', echo: ECHO_DELAY.default, mix: { ...VOICE_MIX_DEFAULT }, scale: { kind: 'chromatic' } }
/** 메아리: 되울리는 비율·크기, 되울릴수록 먹먹해지는 정도 (노래방처럼 두세 번만 옅게. 처음 38%·55%는 너무 울림) */
const ECHO = { feedback: 0.25, wet: 0.35, tone: 3200 }

/** 내 마이크 크기 배율 (사용자가 고름) */
export const MIC_VOLUME = { min: 0, max: 2, default: 1 }
/** 보내기 전에 압축한 뒤 키우는 배율 (전체 소리를 크게) */
const SEND_BOOST = 1.5

/** 높게·낮게: 소리 높이 배율 */
const PITCH = { high: 1.6, low: 0.65, helium: 2.1, monster: 0.55 }

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

// 오토튠: 목소리 높이를 재서(YIN, 4분의 1로 줄여 가볍게) 가장 가까운 음(반음 전부 또는 고른 조의 음)으로 높이를 바꾼다.
// (가장 가까운 음 찾기는 아래 nearestNote와 같은 계산)
// strength: 0 = 그대로, 1 = 바로 딱 맞춤(기계음). 중간이면 덜 맞추고 천천히 따라간다.
const DEC = 4, WIN = 384, MAXLAG = 192, HOP = 512
class AutoTune extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'strength', defaultValue: 0.8, minValue: 0, maxValue: 1 }] }
  constructor() {
    super()
    this.buf = new Float32Array(SIZE); this.w = 0; this.phase = 0
    this.det = new Float32Array(WIN + MAXLAG); this.acc = 0; this.accN = 0
    this.hop = 0; this.ratio = 1; this.target = 1
    this.d = new Float32Array(MAXLAG + 1)
    // 맞출 수 있는 음 (도=0 … 시=11). 바꾸면 메시지로 온다
    this.mask = new Array(12).fill(true)
    this.port.onmessage = (e) => { if (Array.isArray(e.data.mask)) this.mask = e.data.mask }
  }
  nearest(midi) {
    let best = Math.round(midi), dist = Infinity
    for (let n = Math.floor(midi) - 2; n <= Math.ceil(midi) + 2; n++) {
      if (!this.mask[((n % 12) + 12) % 12]) continue
      const d = Math.abs(n - midi)
      if (d < dist) { dist = d; best = n }
    }
    return best
  }
  read(pos) {
    const p = (pos + SIZE * 4) % SIZE, i = Math.floor(p), f = p - i
    return this.buf[i] * (1 - f) + this.buf[(i + 1) % SIZE] * f
  }
  /** 줄인 소리에서 높이(Hz)를 찾는다. 소리가 작거나 높이가 없으면 0 */
  detect() {
    const x = this.det, n = WIN, d = this.d
    let e = 0
    for (let i = MAXLAG; i < x.length; i++) e += x[i] * x[i]
    if (e / n < 1e-5) return 0
    const minLag = Math.floor(sampleRate / DEC / 1000)
    d[0] = 1
    let run = 0
    for (let t = 1; t <= MAXLAG; t++) {
      let sum = 0
      for (let i = 0; i < n; i++) { const v = x[MAXLAG + i] - x[MAXLAG + i - t]; sum += v * v }
      run += sum
      d[t] = run > 0 ? sum * t / run : 1
    }
    for (let t = Math.max(2, minLag); t < MAXLAG; t++) {
      if (d[t] < 0.15) {
        while (t + 1 < MAXLAG && d[t + 1] < d[t]) t++
        const a = d[t - 1], b = d[t], c = d[t + 1], den = a - 2 * b + c
        const lag = t + (den !== 0 ? (a - c) / (2 * den) : 0)
        return sampleRate / this.refine(lag * DEC)
      }
    }
    return 0
  }
  /** 줄인 소리로 찾은 주기(샘플)를 원래 소리로 다시 재서 정확하게 (높은 음일수록 줄인 소리로는 오차가 큼) */
  refine(approx) {
    const N = 1536, c = Math.round(approx), buf = this.buf, w = this.w
    let bestL = c, best = Infinity
    const at = (L) => {
      let sum = 0
      for (let i = 0; i < N; i++) {
        const j = (w - 1 - i + SIZE * 2) % SIZE
        const v = buf[j] - buf[(j - L + SIZE * 2) % SIZE]
        sum += v * v
      }
      return sum
    }
    const vals = new Map()
    for (let L = Math.max(2, c - DEC); L <= c + DEC; L++) {
      const v = at(L)
      vals.set(L, v)
      if (v < best) { best = v; bestL = L }
    }
    const a = vals.get(bestL - 1) ?? at(bestL - 1), b = best, cc = vals.get(bestL + 1) ?? at(bestL + 1)
    const den = a - 2 * b + cc
    return bestL + (den > 0 ? (a - cc) / (2 * den) : 0)
  }
  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0], out = outputs[0]
    if (!out || !out[0]) return true
    const strength = params.strength[0]
    for (let i = 0; i < out[0].length; i++) {
      const v = input ? input[i] : 0
      this.buf[this.w] = v
      // 높이 재기용으로 4개씩 평균 내어 줄인다
      this.acc += v; this.accN++
      if (this.accN === DEC) {
        this.det.copyWithin(0, 1); this.det[this.det.length - 1] = this.acc / DEC
        this.acc = 0; this.accN = 0
      }
      if (++this.hop >= HOP) {
        this.hop = 0
        const f = this.detect()
        if (f >= 70 && f <= 1000) {
          const midi = 69 + 12 * Math.log2(f / 440)
          this.target = Math.pow(2, (strength * (this.nearest(midi) - midi)) / 12)
        } else this.target = 1
        // 세게 = 빨리 따라감 (딱딱 끊기는 기계음), 약하게 = 천천히
        const k = 0.08 + 0.92 * strength * strength
        this.ratio += (this.target - this.ratio) * k
      }
      const ratio = this.ratio
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
registerProcessor('autotune', AutoTune)

// 녹음: 들어온 소리를 조각으로 그대로 보낸다 (내 목소리 들어보기)
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('capture', Capture)
`

const workletReady = new WeakMap<AudioContext, Promise<boolean>>()

/** 높이 바꾸기 모듈을 한 번만 올린다. 못 쓰는 브라우저면 false (높게·낮게가 보통으로) */
export function loadWorklet(ctx: AudioContext): Promise<boolean> {
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

/** 울림(리버브)용 잔향: 점점 작아지는 잡음. 양쪽 귀가 조금 다르게 */
function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay
  }
  return buffer
}

/** 노래방 에코 세기 → 되울림 비율·크기 */
const karaokeEcho = (amt: number) => ({ feedback: 0.12 + 0.33 * amt, wet: 0.6 * amt })

export class VoiceChanger {
  /** 보낼 소리 (효과가 들어간 것). 마이크 끄기는 이 트랙의 enabled로 */
  readonly track: MediaStreamTrack
  private ctx: AudioContext
  /** 마이크 (녹음한 소리를 넣으면 null) */
  private raw: MediaStreamTrack | null
  private input: AudioNode
  /** 압축·키우기까지 지난 소리 (들어보기는 여기서 따로 뺀다) */
  private final: GainNode
  /** 보내는 길 문 (들어보는 동안 잠깐 닫아 다른 사람에게 안 가게) */
  private gate: GainNode
  /** 효과가 끝나는 곳 = 마이크 크기 */
  private bus: GainNode
  private output: MediaStreamAudioDestinationNode
  /** 지금 효과에 쓰는 노드들 (바꿀 때 끊고 멈춘다) */
  private nodes: AudioNode[] = []
  private effect: VoiceEffect = 'normal'
  private seq = 0
  private echoDelay = ECHO_DELAY.default
  private micVolume = MIC_VOLUME.default
  /** 메아리일 때 그 지연 노드 (간격을 바로 바꾸려고) */
  private echoNode: DelayNode | null = null
  private mix: Record<VoiceMix, number> = { ...VOICE_MIX_DEFAULT }
  private scale: TuneScale = { kind: 'chromatic' }
  /** 효과를 한 번이라도 걸었는지 */
  private applied = false
  /** 오토튠 중이면 그 노드 (음계를 바로 바꾸려고) */
  private tuner: AudioWorkletNode | null = null
  /** 슬라이더를 움직이면 바로 바꿀 노드들 */
  private mixNodes: Partial<Record<VoiceMix, (v: number) => void>> = {}

  /** source: 마이크 트랙, 또는 녹음한 소리를 트는 노드 (내 목소리 들어보기) */
  constructor(ctx: AudioContext, source: MediaStreamTrack | AudioNode) {
    this.ctx = ctx
    this.raw = source instanceof AudioNode ? null : source
    this.input = source instanceof AudioNode ? source : ctx.createMediaStreamSource(new MediaStream([source]))
    this.output = ctx.createMediaStreamDestination()
    this.track = this.output.stream.getAudioTracks()[0]
    this.bus = ctx.createGain()
    this.bus.gain.value = MIC_VOLUME.default
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -28
    comp.knee.value = 12
    comp.ratio.value = 4
    comp.attack.value = 0.005
    comp.release.value = 0.2
    const boost = ctx.createGain()
    boost.gain.value = SEND_BOOST
    this.final = boost
    this.gate = ctx.createGain()
    this.bus.connect(comp)
    comp.connect(boost)
    boost.connect(this.gate)
    this.gate.connect(this.output)
    this.input.connect(this.bus)
    void loadWorklet(ctx)
    document.addEventListener('visibilitychange', this.wake)
  }

  /** 폰은 다른 앱에 갔다 오면 소리 처리가 멈춰 있을 수 있다. 멈추면 상대에게 소리가 안 가므로 다시 켠다 */
  private wake = () => {
    if (document.visibilityState === 'visible' && this.ctx.state !== 'running') void this.ctx.resume()
  }

  /** 마이크 그대로의 소리 (녹음용). 녹음한 소리로 만든 거면 null */
  get rawTrack(): MediaStreamTrack | null {
    return this.raw
  }

  /** 다른 사람에게 보내기 켬/끔 (들어보는 동안 끔). 마이크 끄기와 따로 */
  setSending(on: boolean) {
    this.gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01)
  }

  /** 바뀐 소리를 다른 곳(들어보기 스피커)에도 보낸다. 끊는 함수를 돌려준다 */
  connectOut(node: AudioNode): () => void {
    this.final.connect(node)
    return () => this.final.disconnect(node)
  }

  /** 설정 묶음을 한 번에 */
  apply(s: VoiceSettings) {
    this.setEchoDelay(s.echo)
    for (const k of Object.keys(s.mix) as VoiceMix[]) this.setMix(k, s.mix[k])
    this.setTuneScale(s.scale)
    if (s.effect !== this.effect || !this.applied) void this.setEffect(s.effect)
  }

  get current(): VoiceEffect {
    return this.effect
  }

  get echo(): number {
    return this.echoDelay
  }

  get volume(): number {
    return this.micVolume
  }

  /** 내 마이크 크기 (배율). 바로 바뀐다 */
  setVolume(v: number) {
    this.micVolume = Math.min(MIC_VOLUME.max, Math.max(MIC_VOLUME.min, v))
    this.bus.gain.setTargetAtTime(this.micVolume, this.ctx.currentTime, 0.03)
  }

  /** 메아리 울리는 간격 (초). 메아리 중이면 바로 바뀐다 */
  setEchoDelay(sec: number) {
    this.echoDelay = Math.min(ECHO_DELAY.max, Math.max(ECHO_DELAY.min, sec))
    this.echoNode?.delayTime.setTargetAtTime(this.echoDelay, this.ctx.currentTime, 0.05)
  }

  getMix(key: VoiceMix): number {
    return this.mix[key]
  }

  /** 동굴 울림·노래방 울림·에코 세기 (0~1). 그 효과 중이면 바로 바뀐다 */
  setMix(key: VoiceMix, v: number) {
    this.mix[key] = Math.min(1, Math.max(0, v))
    this.mixNodes[key]?.(this.mix[key])
  }

  get tuneScale(): TuneScale {
    return this.scale
  }

  /** 오토튠 음계. 오토튠 중이면 바로 바뀐다 */
  setTuneScale(scale: TuneScale) {
    this.scale = scale
    this.tuner?.port.postMessage({ mask: scaleMask(scale) })
  }

  async setEffect(effect: VoiceEffect) {
    this.effect = effect
    this.applied = true
    const seq = ++this.seq
    const pitch = effect === 'high' || effect === 'low' || effect === 'helium' || effect === 'monster' || effect === 'autotune'
    const canPitch = pitch && (await loadWorklet(this.ctx))
    // 그사이 다른 효과로 또 바꿨으면 이번 건 버린다
    if (seq !== this.seq) return
    this.clear()
    const { ctx, input, bus: output } = this
    const chain = (...ns: AudioNode[]) => {
      for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1])
    }
    const keep = <T extends AudioNode>(n: T) => (this.nodes.push(n), n)
    const smooth = (param: AudioParam, v: number) => param.setTargetAtTime(v, ctx.currentTime, 0.05)
    /** 울림: 원래 소리는 그대로 두고 잔향을 더한다. 크기 노드를 돌려준다 */
    const reverb = (from: AudioNode, seconds: number, decay: number) => {
      const conv = keep(ctx.createConvolver())
      conv.buffer = impulse(ctx, seconds, decay)
      const wet = keep(ctx.createGain())
      chain(from, conv, wet, output)
      return wet
    }

    if (canPitch && effect === 'autotune') {
      const tuner = keep(new AudioWorkletNode(ctx, 'autotune'))
      const strength = tuner.parameters.get('strength')!
      strength.value = this.mix.autotune
      this.mixNodes.autotune = (v) => smooth(strength, v)
      tuner.port.postMessage({ mask: scaleMask(this.scale) })
      this.tuner = tuner
      chain(input, tuner, output)
    } else if (canPitch && effect === 'monster') {
      // 아주 낮게 + 낮은 소리 키우고 조금 거칠게 + 짧은 울림
      const shifter = keep(new AudioWorkletNode(ctx, 'pitch-shift'))
      shifter.parameters.get('ratio')!.value = PITCH.monster
      const low = keep(ctx.createBiquadFilter())
      low.type = 'lowshelf'
      low.frequency.value = 250
      low.gain.value = 8
      const grit = keep(ctx.createWaveShaper())
      grit.curve = crunchCurve(3)
      const level = keep(ctx.createGain())
      level.gain.value = 0.8
      chain(input, shifter, low, grit, level, output)
      reverb(level, 0.6, 2).gain.value = 0.35
    } else if (canPitch) {
      const shifter = keep(new AudioWorkletNode(ctx, 'pitch-shift'))
      shifter.parameters.get('ratio')!.value = PITCH[effect as 'high' | 'low' | 'helium']
      chain(input, shifter, output)
    } else if (effect === 'phone') {
      // 옛날 전화처럼 가늘고 좁게 (잡음·찌그러짐 없이)
      const hp = keep(ctx.createBiquadFilter())
      hp.type = 'highpass'
      hp.frequency.value = 400
      hp.Q.value = 0.9
      const lp = keep(ctx.createBiquadFilter())
      lp.type = 'lowpass'
      lp.frequency.value = 3000
      lp.Q.value = 0.9
      const mid = keep(ctx.createBiquadFilter())
      mid.type = 'peaking'
      mid.frequency.value = 1500
      mid.gain.value = 5
      const level = keep(ctx.createGain())
      level.gain.value = 1.3
      chain(input, hp, lp, mid, level, output)
    } else if (effect === 'cave') {
      input.connect(output)
      const wet = reverb(input, CAVE.seconds, CAVE.decay)
      const apply = (v: number) => smooth(wet.gain, v * CAVE.wet)
      wet.gain.value = this.mix.caveReverb * CAVE.wet
      this.mixNodes.caveReverb = apply
    } else if (effect === 'karaoke') {
      // 노래방 마이크: 조금 밝게 + 에코(되울림) + 홀 울림. 둘 다 세기 조절
      const bright = keep(ctx.createBiquadFilter())
      bright.type = 'highshelf'
      bright.frequency.value = 3000
      bright.gain.value = 3
      chain(input, bright, output)
      const wetRev = reverb(bright, KARAOKE.seconds, KARAOKE.decay)
      wetRev.gain.value = this.mix.karaokeReverb * KARAOKE.wet
      this.mixNodes.karaokeReverb = (v) => smooth(wetRev.gain, v * KARAOKE.wet)
      const delay = keep(ctx.createDelay(1))
      delay.delayTime.value = KARAOKE.echoDelay
      const fb = keep(ctx.createGain())
      const tone = keep(ctx.createBiquadFilter())
      tone.type = 'lowpass'
      tone.frequency.value = KARAOKE.tone
      const wetEcho = keep(ctx.createGain())
      const e = karaokeEcho(this.mix.karaokeEcho)
      fb.gain.value = e.feedback
      wetEcho.gain.value = e.wet
      chain(bright, delay, tone, wetEcho, output)
      chain(tone, fb, delay)
      this.mixNodes.karaokeEcho = (v) => {
        const n = karaokeEcho(v)
        smooth(fb.gain, n.feedback)
        smooth(wetEcho.gain, n.wet)
      }
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
      delay.delayTime.value = this.echoDelay
      this.echoNode = delay
      const fb = keep(ctx.createGain())
      fb.gain.value = ECHO.feedback
      const tone = keep(ctx.createBiquadFilter())
      tone.type = 'lowpass'
      tone.frequency.value = ECHO.tone
      const wet = keep(ctx.createGain())
      wet.gain.value = ECHO.wet
      input.connect(output)
      chain(input, delay, tone, wet, output)
      chain(tone, fb, delay)
    } else {
      input.connect(output)
    }
  }

  /** 마이크와 효과를 모두 끈다 */
  stop() {
    this.seq++
    this.clear()
    document.removeEventListener('visibilitychange', this.wake)
    this.raw?.stop()
    this.track.stop()
  }

  private clear() {
    this.input.disconnect()
    for (const n of this.nodes) {
      if (n instanceof AudioScheduledSourceNode) n.stop()
      n.disconnect()
    }
    this.nodes = []
    this.echoNode = null
    this.mixNodes = {}
    this.tuner = null
  }
}
