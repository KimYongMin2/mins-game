import { readLocal, writeLocal } from '../storage/local'

// Web Audio로 직접 합성하는 효과음 도구. 음원 파일이 없어 라이선스 걱정이 없다.
// 브라우저는 사용자 입력 전에는 소리를 막으므로 첫 터치·키 입력 때 AudioContext를 깨운다.

const MUTE_KEY = 'sound-muted'

let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = readLocal(MUTE_KEY) === '1'

function context(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

let unlockInstalled = false

/** 첫 사용자 입력 때 오디오를 깨운다. 여러 번 불러도 한 번만 설치된다. */
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => {
    context()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function isMuted() {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  writeLocal(MUTE_KEY, value ? '1' : '0')
  if (value && ctx) void ctx.suspend()
  if (!value) context()
}

type Envelope = {
  /** 지금부터 몇 초 뒤에 시작 */
  delay?: number
  duration: number
  gain?: number
  attack?: number
}

function envelope(ac: AudioContext, { delay = 0, duration, gain = 0.2, attack = 0.005 }: Envelope) {
  const g = ac.createGain()
  const t0 = ac.currentTime + delay
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  g.connect(ac.destination)
  return { g, t0, t1: t0 + duration }
}

/** 음 하나. to를 주면 주파수가 미끄러진다. */
export function tone(opts: Envelope & { freq: number; to?: number; type?: OscillatorType }) {
  const ac = context()
  if (!ac) return
  const { g, t0, t1 } = envelope(ac, opts)
  const osc = ac.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t1)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t1 + 0.02)
}

/** 걸러낸 잡음. 바람 소리·타격음·관중 함성 등에 쓴다. */
export function noise(
  opts: Envelope & { filter: BiquadFilterType; freq: number; to?: number; q?: number },
) {
  const ac = context()
  if (!ac) return
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const { g, t0, t1 } = envelope(ac, opts)
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ac.createBiquadFilter()
  filter.type = opts.filter
  filter.Q.value = opts.q ?? 1
  filter.frequency.setValueAtTime(opts.freq, t0)
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t1)
  src.connect(filter).connect(g)
  src.start(t0)
  src.stop(t1 + 0.02)
}
