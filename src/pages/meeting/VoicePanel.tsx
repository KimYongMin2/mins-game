import { useEffect, useRef, useState } from 'react'
import { levelContext } from '../../shared/call/level'
import { ECHO_DELAY, TUNE_ROOTS, type TuneScale, VOICE_EFFECTS, type VoiceMix, type VoiceSettings } from '../../shared/call/voiceFx'
import { type Recording, TEST_SECONDS, TestPlayback, recordRaw } from '../../shared/call/voiceTest'

// 목소리 효과 고르기 + 내 목소리 들어보기. 방 목록과 방 안에서 같이 쓴다.

type PickerProps = { settings: VoiceSettings; onChange: (s: VoiceSettings) => void }

/** 효과 버튼과 그 효과의 슬라이더·음계 */
export function VoicePicker({ settings, onChange }: PickerProps) {
  const { effect, echo, mix, scale } = settings
  const set = (patch: Partial<VoiceSettings>) => onChange({ ...settings, ...patch })
  const setMix = (key: VoiceMix, v: number) => set({ mix: { ...mix, [key]: v } })
  const setScale = (next: TuneScale) => set({ scale: next })
  const mixSlider = (key: VoiceMix, label: string) => (
    <label className="meet-voice__slider" key={key}>
      <span>
        {label} {Math.round(mix[key] * 100)}%
      </span>
      <input type="range" min={0} max={1} step={0.05} value={mix[key]} onChange={(e) => setMix(key, Number(e.target.value))} />
    </label>
  )

  return (
    <>
      <div className="meet-voice__options" role="radiogroup" aria-label="목소리 효과">
        {VOICE_EFFECTS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={effect === e.id}
            className={`button button--small${effect === e.id ? ' button--primary' : ''}`}
            onClick={() => set({ effect: e.id })}
          >
            {e.label}
          </button>
        ))}
      </div>
      {effect === 'echo' && (
        <label className="meet-voice__slider">
          <span>울리는 간격 {echo.toFixed(2)}초</span>
          <input
            type="range"
            min={ECHO_DELAY.min}
            max={ECHO_DELAY.max}
            step={0.01}
            value={echo}
            onChange={(e) => set({ echo: Number(e.target.value) })}
          />
        </label>
      )}
      {effect === 'cave' && mixSlider('caveReverb', '울림')}
      {effect === 'autotune' && (
        <>
          {mixSlider('autotune', '음 맞추기 세기')}
          {/* 음계: 반음 전부 또는 조(으뜸음 + 장조/단조) */}
          <div className="meet-voice__scale">
            <select
              className="input"
              aria-label="맞출 음"
              value={scale.kind}
              onChange={(e) => {
                const kind = e.target.value as TuneScale['kind']
                setScale(kind === 'chromatic' ? { kind } : { kind, root: scale.kind === 'chromatic' ? 0 : scale.root })
              }}
            >
              <option value="chromatic">반음 전부 (12음)</option>
              <option value="major">장조 (7음)</option>
              <option value="minor">단조 (7음)</option>
            </select>
            {scale.kind !== 'chromatic' && (
              <select className="input" aria-label="조" value={scale.root} onChange={(e) => setScale({ kind: scale.kind, root: Number(e.target.value) })}>
                {TUNE_ROOTS.map((name, i) => (
                  <option key={name} value={i}>
                    {name} {scale.kind === 'major' ? '장조' : '단조'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </>
      )}
      {effect === 'karaoke' && (
        <>
          {mixSlider('karaokeReverb', '울림 (리버브)')}
          {mixSlider('karaokeEcho', '에코')}
        </>
      )}
    </>
  )
}

type TestProps = {
  settings: VoiceSettings
  /** 녹음할 마이크 소리 (효과 없는 것). 못 받으면 null */
  getRaw: () => Promise<MediaStreamTrack | null>
  /** 녹음이 끝나면 마이크를 놓는다 (방 목록에서만) */
  release?: (raw: MediaStreamTrack) => void
  /** 녹음·듣는 동안 true (방 안에선 그동안 다른 사람에게 내 소리를 안 보냄) */
  onBusy?: (busy: boolean) => void
}

type TestState = { kind: 'idle' } | { kind: 'asking' } | { kind: 'recording'; left: number } | { kind: 'ready' } | { kind: 'playing' } | { kind: 'denied' }

/** 내 목소리 들어보기: 녹음 → 바로 지금 효과로 틀어 줌. 효과를 바꿔 [다시 듣기]하면 같은 말을 다른 효과로 */
export function VoiceTest({ settings, getRaw, release, onBusy }: TestProps) {
  const [state, setState] = useState<TestState>({ kind: 'idle' })
  const bufferRef = useRef<AudioBuffer | null>(null)
  const recordingRef = useRef<Recording | null>(null)
  const playbackRef = useRef<TestPlayback | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  // 들려줄 곳: 스트림으로 내보내 audio로 튼다 (아이폰 무음 스위치에도 들리게, 회의방 듣는 소리와 같은 방식)
  const [out] = useState(() => levelContext().createMediaStreamDestination())
  const settingsRef = useRef(settings)
  const onBusyRef = useRef(onBusy)
  useEffect(() => {
    settingsRef.current = settings
    onBusyRef.current = onBusy
    playbackRef.current?.apply(settings)
  })

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = out.stream
  }, [out])

  // 화면을 떠나면 멈춘다
  useEffect(
    () => () => {
      recordingRef.current?.stop()
      playbackRef.current?.stop()
      onBusyRef.current?.(false)
    },
    [],
  )

  /** 누르는 순간에 소리를 깨워 둔다 (폰은 사용자 동작 안에서만 틀 수 있음) */
  function unlock() {
    levelContext()
    void audioRef.current?.play().catch(() => {})
  }

  function play() {
    const buffer = bufferRef.current
    if (!buffer) return
    unlock()
    playbackRef.current?.stop()
    onBusyRef.current?.(true)
    setState({ kind: 'playing' })
    playbackRef.current = new TestPlayback(levelContext(), buffer, settingsRef.current, out, () => {
      playbackRef.current = null
      onBusyRef.current?.(false)
      setState({ kind: 'ready' })
    })
  }

  function stopPlay() {
    playbackRef.current?.stop()
  }

  async function record() {
    unlock()
    playbackRef.current?.stop()
    setState({ kind: 'asking' })
    const raw = await getRaw()
    if (!raw) {
      setState({ kind: 'denied' })
      return
    }
    onBusyRef.current?.(true)
    const rec = recordRaw(levelContext(), raw)
    recordingRef.current = rec
    const started = Date.now()
    setState({ kind: 'recording', left: TEST_SECONDS })
    const tick = setInterval(() => {
      setState((s) => (s.kind === 'recording' ? { kind: 'recording', left: Math.max(1, TEST_SECONDS - Math.floor((Date.now() - started) / 1000)) } : s))
    }, 250)
    const buffer = await rec.done
    clearInterval(tick)
    recordingRef.current = null
    release?.(raw)
    if (!buffer) {
      onBusyRef.current?.(false)
      setState({ kind: 'idle' })
      return
    }
    bufferRef.current = buffer
    play()
  }

  return (
    <div className="meet-test">
      <audio ref={audioRef} autoPlay playsInline />
      {state.kind === 'recording' ? (
        <>
          <p className="meet-test__status">🔴 녹음 중… {state.left}초 — 아무 말이나 해 보세요</p>
          <button type="button" className="button button--small" onClick={() => recordingRef.current?.stop()}>
            그만 녹음하고 듣기
          </button>
        </>
      ) : state.kind === 'playing' ? (
        <>
          <p className="meet-test__status">🔊 바뀐 목소리로 듣는 중 (효과를 바꾸면 바로 바뀌어요)</p>
          <button type="button" className="button button--small" onClick={stopPlay}>
            ■ 멈추기
          </button>
        </>
      ) : state.kind === 'ready' ? (
        <div className="meet-test__row">
          <button type="button" className="button button--small button--primary" onClick={play}>
            ▶ 다시 듣기
          </button>
          <button type="button" className="button button--small" onClick={() => void record()}>
            🎙 다시 녹음
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="button button--small" disabled={state.kind === 'asking'} onClick={() => void record()}>
            🎙 내 목소리 들어보기 ({TEST_SECONDS}초 녹음)
          </button>
          {state.kind === 'denied' && <p className="meet-test__status">마이크를 쓸 수 없어요. 브라우저에서 마이크를 허락해 주세요</p>}
        </>
      )}
      {state.kind === 'ready' && <p className="meet-test__hint">효과를 바꾸고 [다시 듣기]를 누르면 같은 말을 다른 목소리로 들을 수 있어요</p>}
    </div>
  )
}
