// 말하는 중인지: 소리 크기(RMS)를 0.1초마다 재서, 크면 '말하는 중'으로 보고 조금 붙잡아 둔다 (말 사이 짧은 쉼에 깜빡이지 않게).

/** 이보다 크면 말하는 중 (0~1) */
const SPEAKING_RMS = 0.02
/** 조용해져도 이만큼은 말하는 중으로 */
const HOLD_MS = 400
const POLL_MS = 100

let ctx: AudioContext | null = null

/** 소리 재는 데 쓰는 AudioContext. 처음엔 누르는 순간(사용자 동작)에 불러야 폰에서 막히지 않는다 */
export function levelContext(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 말하기 시작·멈춤을 알려 준다. 멈추는 함수를 돌려준다 */
export function watchLevel(stream: MediaStream, onSpeaking: (speaking: boolean) => void): () => void {
  const c = levelContext()
  const source = c.createMediaStreamSource(stream)
  const analyser = c.createAnalyser()
  analyser.fftSize = 512
  // 몇몇 브라우저는 끝까지 이어져 있어야 재므로 소리 0으로 내보낸다
  const silent = c.createGain()
  silent.gain.value = 0
  source.connect(analyser)
  analyser.connect(silent)
  silent.connect(c.destination)
  const buf = new Float32Array(analyser.fftSize)
  let speaking = false
  let loudAt = -Infinity
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    const now = performance.now()
    if (Math.sqrt(sum / buf.length) > SPEAKING_RMS) loudAt = now
    const next = now - loudAt < HOLD_MS
    if (next !== speaking) {
      speaking = next
      onSpeaking(next)
    }
  }, POLL_MS)
  return () => {
    clearInterval(timer)
    source.disconnect()
    analyser.disconnect()
    silent.disconnect()
  }
}
