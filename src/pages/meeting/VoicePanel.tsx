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

type RecorderProps = {
  /** 들려줄 때 걸 효과 (설정 창에서 고르는 중인 것) */
  settings: VoiceSettings
  /** 녹음할 마이크 소리 (효과 없는 것). 못 받으면 null */
  getRaw: () => Promise<MediaStreamTrack | null>
  /** 녹음이 끝나면 마이크를 놓는다 (방 목록에서만) */
  release?: (raw: MediaStreamTrack) => void
}

type RecState = { kind: 'idle' } | { kind: 'asking' } | { kind: 'recording'; left: number } | { kind: 'playing' } | { kind: 'denied' }

/**
 * 내 목소리 들어보기 (사용자 요청으로 단순하게): [녹음] → [그만]이나 5초가 지나면 바로 지금 고른 효과로 **한 번만** 들려주고 끝.
 * 다시 들으려면 다시 녹음한다 (예전엔 [다시 듣기]·트는 중 효과 바꾸기가 섞여 꼬였음)
 */
export function VoiceRecorder({ settings, getRaw, release }: RecorderProps) {
  const [state, setState] = useState<RecState>({ kind: 'idle' })
  const recordingRef = useRef<Recording | null>(null)
  const playbackRef = useRef<TestPlayback | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  // 들려줄 곳: 스트림으로 내보내 audio로 튼다 (아이폰 무음 스위치에도 들리게, 회의방 듣는 소리와 같은 방식)
  const [out] = useState(() => levelContext().createMediaStreamDestination())
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  })

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = out.stream
  }, [out])

  // 창을 닫으면 멈춘다
  useEffect(
    () => () => {
      recordingRef.current?.stop()
      playbackRef.current?.stop()
    },
    [],
  )

  /** 누르는 순간에 소리를 깨워 둔다 (폰은 사용자 동작 안에서만 틀 수 있음) */
  function unlock() {
    levelContext()
    void audioRef.current?.play().catch(() => {})
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
    const rec = recordRaw(levelContext(), raw)
    recordingRef.current = rec
    const started = Date.now()
    setState({ kind: 'recording', left: TEST_SECONDS })
    const tick = setInterval(() => {
      setState((st) => (st.kind === 'recording' ? { kind: 'recording', left: Math.max(1, TEST_SECONDS - Math.floor((Date.now() - started) / 1000)) } : st))
    }, 250)
    const buffer = await rec.done
    clearInterval(tick)
    recordingRef.current = null
    release?.(raw)
    if (!buffer) {
      setState({ kind: 'idle' })
      return
    }
    // 바로 한 번만 틀고, 다 들으면 처음으로
    setState({ kind: 'playing' })
    playbackRef.current = new TestPlayback(levelContext(), buffer, settingsRef.current, out, () => {
      playbackRef.current = null
      setState({ kind: 'idle' })
    })
  }

  return (
    <div className="meet-test">
      <audio ref={audioRef} autoPlay playsInline />
      {state.kind === 'recording' ? (
        <>
          <p className="meet-test__status">녹음 중… {state.left}초 — 아무 말이나 해 보세요</p>
          <button type="button" className="button button--primary meet-test__button" onClick={() => recordingRef.current?.stop()}>
            ■ 그만 (바로 듣기)
          </button>
        </>
      ) : state.kind === 'playing' ? (
        <>
          <p className="meet-test__status">바뀐 목소리로 듣는 중…</p>
          <button type="button" className="button meet-test__button" onClick={() => playbackRef.current?.stop()}>
            ■ 멈추기
          </button>
        </>
      ) : (
        <>
          <button type="button" className="button meet-test__button" disabled={state.kind === 'asking'} onClick={() => void record()}>
            🎙 녹음해서 들어보기 (최대 {TEST_SECONDS}초)
          </button>
          {state.kind === 'denied' && <p className="meet-test__status">마이크를 쓸 수 없어요. 브라우저에서 마이크를 허락해 주세요</p>}
        </>
      )}
    </div>
  )
}

type DialogProps = RecorderProps & {
  /** 지금 통화에 쓰는 효과 (창을 열 때 시작값) */
  settings: VoiceSettings
  onSave: (s: VoiceSettings) => void
  onClose: () => void
  /** 방 안이면 true: 창이 열려 있는 동안 다른 사람에게 내 소리를 안 보낸다는 안내 */
  inRoom?: boolean
}

/**
 * 목소리 설정 창 (사용자 요청 — 환경설정처럼 눌러야 뜨게): 효과 고르기 + 녹음해서 들어보기 + [저장]·[닫기].
 * [저장]은 고른 효과를 통화에 적용하고 닫기, [닫기]는 바꾼 걸 버리고 닫기. 창이 열려 있는 동안 내 소리는 안 나간다(방 안, 부르는 쪽이 처리)
 */
export function VoiceSettingsDialog({ settings, onSave, onClose, getRaw, release, inRoom = false }: DialogProps) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="목소리 설정" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet__panel meet-settings">
        <h2 className="meet-settings__title">목소리 설정</h2>
        {inRoom && <p className="meet-settings__note">이 창이 열려 있는 동안엔 다른 사람에게 내 소리가 안 가요</p>}
        <div className="meet-voice">
          <VoicePicker settings={draft} onChange={setDraft} />
        </div>
        <VoiceRecorder settings={draft} getRaw={getRaw} release={release} />
        <div className="meet-settings__buttons">
          <button type="button" className="button" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
