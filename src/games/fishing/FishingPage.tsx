import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { HomeLink } from '../../shared/ui/HomeLink'
import { canWebGL } from '../../shared/art3d/webgl'
import { loadNickname } from '../../shared/storage/nickname'
import { DEX_FISH, RARITY, fishById } from './play/fish'
import { CHAT_MAX, FISHING_CAPACITY } from './play/protocol'
import { IRO_FILTERS, SHADOW_FILTER, fishSvg } from './field/fishArt'
import { type Action, type Alt, CAM_LIMITS, iroName, useFishingRoom } from './game/useFishingRoom'
import { Joystick } from './game/Joystick'
import { BragSheet, DexSheet, MyTankSheet, OtherTankSheet } from './screens/Sheets'
import './fishing.css'

// 낚시터 (사용자 요청 2026-11-17): 바닷가 하나에 최대 16명, 조이스틱으로 걸어 다니며 물가나 썬베드에서 낚시.
// 입질이 오면 5초 안에 한 번 누르면 잡힘. 도감·어항은 서버(Supabase)에 남고, 희귀 이상·이로치는 모두에게 자랑.
// 폰은 가로 화면 (조이스틱 + 큰 버튼을 양손으로).

const Scene3D = lazy(() => import('./game/Scene3D').then((m) => ({ default: m.Scene3D })))

const ALT_LABEL: Record<NonNullable<Alt>, string> = { board: '배 타기', unboard: '내리기', noLand: '내리기', climb: '올라가기', down: '내려가기' }
const ACTION_LABEL: Record<Action, string> = { reel: '잡기!', reelIn: '거두기', cast: '던지기', bed: '눕기', none: '물가로 가요' }

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const isPortrait = () => window.innerHeight > window.innerWidth

/** 폰: 전체 화면 + 가로 고정 (안드로이드만 됨, 아이폰은 안내) */
async function goLandscape() {
  if (!isTouch()) return
  try {
    await document.documentElement.requestFullscreen?.()
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')
  } catch {
    /* 안 되는 브라우저는 안내만 */
  }
}

export function FishingPage() {
  const nickname = loadNickname() ?? '나'
  const [entered, setEntered] = useState(false)
  const room = useFishingRoom(nickname, entered)
  const [sheet, setSheet] = useState<'dex' | 'tank' | 'brag' | null>(null)
  const [portrait, setPortrait] = useState(() => isTouch() && isPortrait())
  const [text, setText] = useState('')
  const [firstPerson, setFirstPerson] = useState(false)
  const chatRef = useRef<HTMLInputElement>(null)
  const { world, act, send, bonk, doAlt, setPose } = room
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const on = () => setPortrait(isTouch() && isPortrait())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])

  // 나가면 전체 화면 풀기
  useEffect(() => () => void (document.fullscreenElement && document.exitFullscreen?.().catch(() => {})), [])

  /** 3인칭 ↔ 1인칭 (V) */
  const toggleView = useCallback(() => {
    const cam = world.cam
    cam.first = !cam.first
    const lim = cam.first ? CAM_LIMITS.first : CAM_LIMITS.third
    cam.pitch = cam.first ? 0.15 : 0.82
    cam.pitch = Math.min(lim.max, Math.max(lim.min, cam.pitch))
    setFirstPerson(cam.first)
  }, [world])

  // PC: WASD·방향키로 걷기, 스페이스로 던지기·잡기, Enter로 채팅
  useEffect(() => {
    if (!entered) return
    const keys = new Set<string>()
    const apply = () => {
      world.input.x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
      world.input.y = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0)
    }
    // 키 위치(e.code)로 받음 — 한글 입력 상태면 e.key가 'ㅈ·ㅁ·ㄴ·ㅇ'이라 WASD가 안 먹었음
    const dir = (code: string) => ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' })[code]
    const spin = () => (world.cam.spin = (keys.has('spinR') ? 1 : 0) - (keys.has('spinL') ? 1 : 0))
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const d = dir(e.code)
      if (d) {
        keys.add(d)
        apply()
        e.preventDefault()
      } else if (e.code === 'KeyQ' || e.code === 'KeyE') {
        keys.add(e.code === 'KeyQ' ? 'spinL' : 'spinR')
        spin()
      } else if (e.code === 'KeyF' && !e.repeat) {
        bonk()
      } else if (e.code === 'KeyR' && !e.repeat) {
        doAlt()
      } else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        // 누르는 동안 달리기
        world.input.run = true
        setRunning(true)
      } else if (e.code === 'KeyC' && !e.repeat) {
        setPose('sit')
      } else if (e.code === 'KeyZ' && !e.repeat) {
        setPose('lie')
      } else if (e.code === 'KeyV' && !e.repeat) {
        toggleView()
      } else if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) act()
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault()
        chatRef.current?.focus()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        world.input.run = false
        setRunning(false)
        return
      }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        keys.delete(e.code === 'KeyQ' ? 'spinL' : 'spinR')
        return spin()
      }
      const d = dir(e.code)
      if (!d) return
      keys.delete(d)
      apply()
    }
    const blur = () => {
      keys.clear()
      world.input.run = false
      setRunning(false)
      apply()
      spin()
    }
    // 우클릭 메뉴를 막음 (메뉴가 뜨면 키·조이스틱을 뗀 신호를 놓쳐서 계속 눌린 채로 남았음)
    const menu = (e: MouseEvent) => {
      e.preventDefault()
      blur()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    window.addEventListener('contextmenu', menu)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      window.removeEventListener('contextmenu', menu)
    }
  }, [entered, world, act, toggleView, bonk, doAlt, setPose])

  // 잡은 물고기 카드는 잠깐만
  const { myCatch, setMyCatch } = room
  useEffect(() => {
    if (!myCatch) return
    const t = setTimeout(() => setMyCatch(null), 2800)
    return () => clearTimeout(t)
  }, [myCatch, setMyCatch])

  const onTapPlayer = useCallback((id: string) => send({ t: 'look', who: id }), [send])
  const closeSheet = useCallback(() => setSheet(null), [])

  const filters = <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: IRO_FILTERS + SHADOW_FILTER }} />

  if (!entered)
    return (
      <main className="page arcade fs-start">
        {filters}
        <header className="fs-start__head">
          <HomeLink className="button button--small">← 목록</HomeLink>
          <h1 className="title">낚시터</h1>
        </header>
        <div className="fs-start__art" dangerouslySetInnerHTML={{ __html: fishSvg('redbream', 'gold', { bg: 'sea' }) }} />
        <p className="fs-start__lead">바닷가에서 친구들과 같이 낚시해요. 조이스틱으로 걸어 다니다가 물가나 썬베드에서 낚싯대를 던지고, 입질이 오면 5초 안에 한 번 눌러요.</p>
        <ul className="fs-start__rules">
          <li>바다(부두·바닷가)와 민물(개울·연못)에서 잡히는 물고기가 달라요 — 모두 {DEX_FISH.length}종 + 꽝</li>
          <li>어떤 물고기든 아주 드물게 다른 색(이로치)으로 나와요</li>
          <li>잡은 것 중 10마리를 어항에 넣으면 다른 사람이 나를 눌러 구경해요</li>
          <li>한 낚시터에 {FISHING_CAPACITY}명까지 · PC는 WASD·방향키로 걷고 스페이스, 화면을 끌거나 Q·E로 시점 돌리기, V 1인칭, F 뿅망치</li>
          <li>[뿅]을 누르면 앞에 있는 친구를 장난감 망치로 뿅 (맞아도 낚시는 그대로)</li>
        </ul>
        {!canWebGL() && <p className="error">이 기기는 3D 화면을 그릴 수 없어서 낚시터에 들어갈 수 없어요</p>}
        <button
          type="button"
          className="button button--primary fs-start__go"
          disabled={!canWebGL()}
          onClick={() => {
            void goLandscape()
            setEntered(true)
          }}
        >
          {isTouch() ? '가로 화면으로 들어가기' : '낚시터 들어가기'}
        </button>
      </main>
    )

  const myDex = room.profile ? DEX_FISH.filter((f) => room.profile!.dex[f.id]).length : 0

  return (
    <main className="fs-game">
      {filters}
      {room.status === 'ready' && (
        <Suspense fallback={<div className="fs-loading">낚시터를 그리는 중…</div>}>
          <Scene3D world={world} step={room.step} onTapPlayer={onTapPlayer} />
        </Suspense>
      )}
      {room.status !== 'ready' && <div className="fs-loading">{room.status === 'error' ? room.error : '낚시터에 들어가는 중…'}</div>}

      <div className="fs-hud fs-hud--tl">
        <HomeLink className="fs-key">나가기</HomeLink>
        <span className="fs-room">
          {room.roomLabel || '낚시터'} · {room.count}/{FISHING_CAPACITY}명
        </span>
        {!room.saving && <span className="fs-warn">기록 저장 준비 중 (서버를 다시 켜면 사라져요)</span>}
      </div>
      <div className="fs-hud fs-hud--tr">
        <button type="button" className="fs-key" onClick={toggleView} title="시점 바꾸기 (V) · 화면을 끌면 돌리기 · Q·E 좌우 · 휠 확대">
          {firstPerson ? '1인칭' : '3인칭'}
        </button>
        <button type="button" className="fs-key" onClick={() => setSheet('dex')}>
          도감 {myDex}/{DEX_FISH.length}
        </button>
        <button type="button" className="fs-key" onClick={() => setSheet('tank')}>
          내 어항
        </button>
        <button type="button" className="fs-key" onClick={() => setSheet('brag')}>
          자랑하기
        </button>
      </div>

      <div className="fs-toasts" aria-live="polite">
        {room.toasts.map((t) => (
          <div key={t.key} className="fs-toast" style={{ borderColor: t.color }}>
            {t.c && <span className="fs-toast__art" dangerouslySetInnerHTML={{ __html: fishSvg(t.c.fish, t.c.iro) }} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {myCatch && (
        <div className="fs-catch" key={myCatch.key} role="status">
          <span className="fs-catch__art" dangerouslySetInnerHTML={{ __html: fishSvg(myCatch.c.fish, myCatch.c.iro) }} />
          <b>
            {iroName(myCatch.c)}
            {fishById(myCatch.c.fish)?.name}
          </b>
          <span>
            {myCatch.c.size ? `${myCatch.c.size}cm · ` : ''}
            <i style={{ color: RARITY[fishById(myCatch.c.fish)?.rarity ?? 'common'].color }}>{RARITY[fishById(myCatch.c.fish)?.rarity ?? 'common'].name}</i>
          </span>
          {myCatch.best && <em>최고 기록!</em>}
        </div>
      )}

      <Joystick out={world.input} />
      {/* 달리기(켜고 끄기)·앉기·눕기 — PC는 Shift·C·Z */}
      <div className="fs-poses">
        <button
          type="button"
          className="fs-pose"
          aria-pressed={running}
          onPointerDown={(e) => {
            e.preventDefault()
            if (e.button !== 0) return
            world.input.run = !world.input.run
            setRunning(world.input.run)
          }}
          title="달리기 (Shift를 누르는 동안)"
        >
          달리기<small>Shift</small>
        </button>
        <button type="button" className="fs-pose" onPointerDown={(e) => { e.preventDefault(); if (e.button === 0) setPose('sit') }} title="앉기 (C) — 한 번 더 누르면 일어나요">
          앉기<small>C</small>
        </button>
        <button type="button" className="fs-pose" onPointerDown={(e) => { e.preventDefault(); if (e.button === 0) setPose('lie') }} title="눕기 (Z) — 한 번 더 누르면 일어나요">
          눕기<small>Z</small>
        </button>
      </div>
      <button
        type="button"
        className={`fs-act fs-act--${room.action}`}
        disabled={room.action === 'none'}
        onPointerDown={(e) => {
          e.preventDefault()
          if (e.button === 0) act()
        }}
      >
        {ACTION_LABEL[room.action]}
        <small>스페이스</small>
      </button>

      <button
        type="button"
        className="fs-bonk"
        onPointerDown={(e) => {
          e.preventDefault()
          if (e.button === 0) bonk()
        }}
        aria-label="뿅망치 (F)"
        title="뿅망치 (F) — 앞에 있는 사람을 장난으로 뿅"
      >
        뿅<small>F</small>
      </button>
      {room.alt && (
        <button
          type="button"
          className={`fs-alt${room.alt === 'noLand' ? ' fs-alt--off' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault()
            if (e.button === 0) doAlt()
          }}
          title={room.alt === 'noLand' ? '물가나 부두 가까이 가면 내릴 수 있어요' : undefined}
        >
          {ALT_LABEL[room.alt]}
          <small>R</small>
        </button>
      )}

      <div className="fs-chat">
        <ol className="fs-chat__log">
          {room.chat.slice(-4).map((l) => (
            <li key={l.key}>
              <b className={l.mine ? 'fs-chat__me' : ''}>{l.name}</b> {l.text}
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const t = text.trim()
            if (t) send({ t: 'chat', text: t })
            setText('')
            chatRef.current?.blur()
          }}
        >
          <input
            ref={chatRef}
            className="fs-chat__input"
            value={text}
            maxLength={CHAT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder={isTouch() ? "채팅" : "채팅 (Enter)"}
            enterKeyHint="send"
            aria-label="채팅"
            autoComplete="off"
          />
        </form>
      </div>

      {portrait && (
        <div className="fs-rotate" role="alert">
          <b>폰을 가로로 돌려 주세요</b>
          <span>낚시터는 가로 화면에서 조이스틱과 버튼을 양손으로 해요</span>
          <button type="button" className="fs-key fs-key--primary" onClick={() => void goLandscape()}>
            가로 화면으로
          </button>
        </div>
      )}

      {sheet === 'dex' && <DexSheet profile={room.profile} onClose={closeSheet} />}
      {sheet === 'tank' && (
        <MyTankSheet
          profile={room.profile}
          onClose={closeSheet}
          onSave={(keys) => {
            send({ t: 'tank', keys })
            setSheet(null)
          }}
        />
      )}
      {sheet === 'brag' && (
        <BragSheet
          profile={room.profile}
          onClose={closeSheet}
          onBrag={(key) => {
            send({ t: 'brag', key })
            setSheet(null)
          }}
        />
      )}
      {room.tankView && <OtherTankSheet name={room.tankView.name} items={room.tankView.items} onClose={() => room.setTankView(null)} />}
    </main>
  )
}
