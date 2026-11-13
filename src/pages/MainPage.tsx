import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ANIMAL_NAMES, type Look } from '../shared/art3d/animalKinds'
import { pvpLink } from '../shared/nav'
import { loadLook } from '../shared/storage/avatar'
import { readLocal, writeLocal } from '../shared/storage/local'
import { loadRecent, pushRecent } from '../shared/storage/recent'
import { AvatarEditor } from '../shared/ui/AvatarPicker'
import { markFromHome } from '../shared/ui/HomeLink'
import { AvatarFace } from '../shared/ui/AvatarFace'
import { IconChevronLeft, IconChevronRight, IconMic, IconPlay, IconX } from '../shared/ui/icons'
import { RoomPicker } from '../shared/ui/RoomPicker'
import { GAMES, type GameEntry } from './gameList'
import { PlayerDots } from './PlayerDots'
import type { GameStat } from './stats'

// 메인 화면 = 게임 소개 사이트 구성 (2026-11-13, 사용자가 게임 공식 사이트의 '동영상' 페이지 형식을 보여 주며 요청 — 구성만 가져오고 로고·색·그림은 우리 것, 밝은 바탕):
// 위에 고정된 메뉴 줄(로고 · 게임 · 수다방 · 내 캐릭터) → 화면을 꽉 채운 큰 배너(이어서 하기 / 오늘의 추천, 기울인 큰 제목 + [혼자 연습] [친구랑 대전])
// → '친구랑 하기' 넘기기(큰 카드 하나 + 좁은 카드들, 좁은 걸 누르면 펼쳐지고 펼친 걸 누르면 게임 창) → '전체' 썸네일 목록(인원으로 거르기) → 수다방 띠.
// 표지는 각 게임의 진짜 경기 장면(public/covers). 게임 창 안에 [봇이랑 연습] [방 만들기] + 열린 방 목록.
// 방을 고르거나 만들면 그 게임으로 가서 바로 방에 들어간다(주소 꼬리 ?mode=pvp&join=… / &create=…, shared/nav.ts).
// 폰 백키: 창을 열 때 기록을 하나 쌓아 백키는 창만 닫는다.

type Filter = 'all' | 'duo' | 'group' | 'solo'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'duo', label: '1:1' },
  { id: 'group', label: '여럿이' },
  { id: 'solo', label: '혼자' },
]
const asFilter = (x: string | null): Filter => (x === 'duo' || x === 'group' || x === 'solo' ? x : 'all')
/** 인원으로 나눔: 혼자 / 둘 / 여럿 */
const sizeOf = (g: GameEntry): Exclude<Filter, 'all'> => (g.players === '1인' ? 'solo' : g.players === '2인' ? 'duo' : 'group')
const READY = GAMES.filter((g) => g.ready)
const cover = (g: GameEntry) => `/covers/${g.id}.jpg`

/** 오늘의 추천: 날짜마다 바뀜 (친구 대전 되는 게임 중) */
function todaysPick(): GameEntry {
  const pvp = READY.filter((g) => g.play === 'pvp')
  const day = Math.floor(Date.now() / 86_400_000)
  return pvp[day % pvp.length]
}

/** 표지: 진짜 경기 장면. 파일이 없으면 그 게임 색으로만 채운 빈 칸 */
function Cover({ game, className }: { game: GameEntry; className: string }) {
  const [broken, setBroken] = useState(false)
  return broken ? (
    <span className={`${className} cover--fallback`} style={{ background: game.colors[1] }} aria-hidden />
  ) : (
    <img className={className} src={cover(game)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  )
}

/** 인원 글자: '2~8인' → '2~8명', '2인' → '1:1', '1인' → '혼자' */
const whoOf = (g: GameEntry) => (g.players === '2인' ? '1:1' : g.players === '1인' ? '혼자' : g.players.replace('인', '명'))

/** 내 전적: 평소엔 한 줄 요약(전체 판 수 · 많이 한 게임)으로 접어 두고 누르면 펼침 (사용자 요청 — 길어지면 아래 캐릭터 꾸미기가 안 보였음) */
function MyStats() {
  // 각 게임 기록을 읽는 코드는 게임 폴더라 창을 열 때만 받는다 (첫 화면을 가볍게)
  const [stats, setStats] = useState<GameStat[] | null>(null)
  useEffect(() => {
    let alive = true
    void import('./stats').then((m) => alive && setStats(m.loadStats()))
    return () => {
      alive = false
    }
  }, [])
  if (!stats) return null
  const played = stats.filter((s) => s.played > 0).sort((a, b) => b.played - a.played)
  const total = played.reduce((n, s) => n + s.played, 0)
  const titleOf = (id: string) => GAMES.find((x) => x.id === id)!.title
  if (played.length === 0) {
    return (
      <section className="my-stats" aria-label="내 전적">
        <p className="my-stats__empty">내 전적 · 아직 한 게임이 없어요</p>
      </section>
    )
  }
  return (
    <details className="my-stats">
      <summary className="my-stats__toggle">
        <span className="my-stats__head">
          내 전적 <span className="my-stats__total">{total}판</span>
        </span>
        <span className="my-stats__top">
          {played
            .slice(0, 2)
            .map((s) => titleOf(s.id))
            .join(' · ')}
          {played.length > 2 && ` 외 ${played.length - 2}개`}
        </span>
      </summary>
      <ul className="my-stats__list">
        {played.map((s) => {
          const g = GAMES.find((x) => x.id === s.id)!
          return (
            <li key={s.id} className="my-stats__row">
              <img className="my-stats__cover" src={cover(g)} alt="" loading="lazy" />
              <span className="my-stats__name">{g.title}</span>
              <span className="my-stats__lines">
                {s.pvp && <span>친구 {s.pvp}</span>}
                {s.bot && <span>{g.play === 'solo' ? s.bot : `봇 ${s.bot}`}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

type Sheet = { kind: 'game'; game: GameEntry } | { kind: 'me' } | null
const sheetMarked = () => !!(window.history.state as { sheet?: boolean } | null)?.sheet

export function MainPage({ nickname }: { nickname: string }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>(() => asFilter(readLocal('lobby-filter')))
  const [look, setLook] = useState<Look | null>(loadLook)
  const [sheet, setSheetState] = useState<Sheet>(null)
  const [recent] = useState(loadRecent)
  useEffect(() => writeLocal('lobby-filter', filter), [filter])

  // 창을 열면 기록을 하나 쌓아서, 폰 백키·브라우저 뒤로 가기는 창만 닫는다
  const setSheet = (next: Sheet) => {
    const marked = sheetMarked()
    if (next && !marked) window.history.pushState({ ...window.history.state, sheet: true }, '')
    if (!next && marked) {
      window.history.back() // popstate에서 닫힌다
      return
    }
    setSheetState(next)
  }
  useEffect(() => {
    // 창이 열린 채 새로 고침했으면 남은 표시를 지운다 (안 그러면 닫을 때 다른 페이지로 되돌아감)
    if (sheetMarked()) {
      const { sheet: _drop, ...rest } = window.history.state as Record<string, unknown>
      void _drop
      window.history.replaceState(rest, '')
    }
    const onPop = () => {
      if (!sheetMarked()) setSheetState(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 창: Esc로 닫기, 열려 있는 동안 뒤 화면 스크롤 막기
  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [sheet]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (game: GameEntry, path: string) => {
    pushRecent(game.id)
    markFromHome(path)
    // 창이 열려 있으면 창 기록을 게임으로 바꾼다 (게임에서 돌아오면 바로 메인)
    navigate(path, { replace: sheetMarked() })
  }
  const last = READY.find((g) => g.id === recent[0])
  const hero = last ?? todaysPick()
  const shown = READY.filter((g) => filter === 'all' || sizeOf(g) === filter)
  const friends = READY.filter((g) => g.play === 'pvp')
  const [featId, setFeatId] = useState(friends[0].id)
  const featAt = Math.max(0, friends.findIndex((g) => g.id === featId))
  /** 넘기기: 앞뒤로 한 칸, 펼친 카드가 보이게 */
  const feature = (i: number) => {
    const g = friends[(i + friends.length) % friends.length]
    setFeatId(g.id)
    requestAnimationFrame(() => document.getElementById(`feat-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }))
  }
  /** 들어가기: 친구 대전 되는 게임은 게임 창, 혼자 하는 게임은 바로 시작 화면 */
  const enter = (g: GameEntry) => (g.play === 'pvp' ? setSheet({ kind: 'game', game: g }) : go(g, g.path))

  return (
    <main className="home arcade lite">
      <header className="topnav">
        <div className="topnav__in">
          <span className="topnav__logo">MINS GAME</span>
          <nav className="topnav__links" aria-label="메인 메뉴">
            <a href="#all">게임</a>
            <Link to="/meeting">수다방</Link>
          </nav>
          <button type="button" className="me-chip" onClick={() => setSheet({ kind: 'me' })}>
            <AvatarFace look={look} size={30} />
            <span className="me-chip__name">{nickname}</span>
          </button>
        </div>
      </header>

      {/* 큰 배너: 이어서 하기 / 오늘의 추천 */}
      <section className="banner" aria-label={last ? '이어서 하기' : '오늘의 추천'}>
        <Cover game={hero} className="banner__cover" />
        <div className="banner__shade" />
        <div className="banner__body">
          <span className="banner__rule" aria-hidden />
          <p className="banner__kicker">{last ? '이어서 하기' : '오늘의 추천'}</p>
          <h1 className="banner__title">{hero.title}</h1>
          <p className="banner__desc">{hero.description}</p>
          <div className="banner__buttons">
            {hero.play === 'pvp' ? (
              <>
                <button type="button" className="arc-button" onClick={() => setSheet({ kind: 'game', game: hero })}>
                  친구랑 대전
                </button>
                <button type="button" className="arc-button arc-button--ghost" onClick={() => go(hero, hero.path)}>
                  혼자 연습
                </button>
              </>
            ) : (
              <button type="button" className="arc-button" onClick={() => go(hero, hero.path)}>
                기록 도전 시작
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="home__in">
        {/* 친구랑 하기: 큰 카드 하나 + 좁은 카드들 */}
        <section className="feat" aria-label="친구랑 하는 게임">
          <div className="sec-head">
            <h2 className="sec-head__title">친구랑 하기</h2>
            <div className="feat__arrows">
              <button type="button" className="round-btn" onClick={() => feature(featAt - 1)} aria-label="이전 게임">
                <IconChevronLeft size={20} />
              </button>
              <button type="button" className="round-btn" onClick={() => feature(featAt + 1)} aria-label="다음 게임">
                <IconChevronRight size={20} />
              </button>
            </div>
          </div>
          <ul className="feat__rail">
            {friends.map((g) => {
              const on = g.id === featId
              return (
                <li key={g.id} id={`feat-${g.id}`} className={`feat__item${on ? ' feat__item--on' : ''}`}>
                  <button type="button" className="feat__card" onClick={() => (on ? enter(g) : setFeatId(g.id))} aria-label={on ? `${g.title} 들어가기` : `${g.title} 펼치기`}>
                    <Cover game={g} className="feat__cover" />
                    <span className="feat__shade" />
                    <span className="feat__text">
                      <span className="feat__rule" aria-hidden />
                      <span className="feat__who">{whoOf(g)}</span>
                      <span className="feat__title">{g.title}</span>
                    </span>
                    {on && (
                      <span className="feat__play" aria-hidden>
                        <IconPlay size={22} />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="feat__dots" aria-hidden>
            {friends.map((g) => (
              <i key={g.id} className={g.id === featId ? 'on' : ''} />
            ))}
          </div>
        </section>

        {/* 전체 게임 목록 */}
        <section className="all" id="all" aria-label="전체 게임">
          <div className="sec-head">
            <h2 className="sec-head__title">전체</h2>
            <div className="filters" role="radiogroup" aria-label="인원으로 거르기">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`filters__chip${filter === f.id ? ' filters__chip--on' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="thumbs">
            {shown.map((g) => (
              <li key={g.id}>
                <button type="button" className="thumb" onClick={() => enter(g)}>
                  <span className="thumb__art">
                    <Cover game={g} className="thumb__cover" />
                    <span className="thumb__play" aria-hidden>
                      <IconPlay size={16} />
                    </span>
                  </span>
                  <span className="thumb__title">{g.title}</span>
                  <span className="thumb__meta">
                    <PlayerDots players={g.players} />
                  </span>
                  <span className="thumb__desc">{g.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <Link className="talk" to="/meeting">
          <span className="talk__icon">
            <IconMic />
          </span>
          <span className="talk__body">
            <strong>수다방</strong>
            <span>게임 없이 음성 통화만 · 2–8명</span>
          </span>
          <IconChevronRight className="talk__go" />
        </Link>
      </div>

      <footer className="home__foot">MINS GAME · 친구들이랑 노는 미니게임 모음</footer>

      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.kind === 'me' ? '내 정보' : sheet.game.title} onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className={`sheet__panel${sheet.kind === 'game' ? ' sheet__panel--game' : ''}`}>
            <button type="button" className="sheet__close" onClick={() => setSheet(null)} aria-label="닫기">
              <IconX size={18} />
            </button>
            {sheet.kind === 'game' ? (
              <div className="game-sheet">
                <Cover game={sheet.game} className="game-sheet__cover" />
                <div className="game-sheet__body">
                  <div className="game-sheet__head">
                    <h2 className="game-sheet__title">{sheet.game.title}</h2>
                    <span className="game-sheet__who">{whoOf(sheet.game)}</span>
                  </div>
                  <p className="game-sheet__desc">{sheet.game.description}</p>
                  <details className="howto">
                    <summary className="howto__toggle">조작법 보기</summary>
                    <ul className="howto__list">
                      {sheet.game.howto.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                  {sheet.game.play === 'pvp' ? (
                    <RoomPicker
                      gameId={sheet.game.id}
                      nickname={nickname}
                      side={
                        <button type="button" className="button pvp-lobby__big arc-practice" onClick={() => go(sheet.game, sheet.game.path)}>
                          봇이랑 연습
                        </button>
                      }
                      onCreate={(name, pin) => go(sheet.game, pvpLink(sheet.game.path, { kind: 'create', name, pin }))}
                      onJoin={(r, pin) => go(sheet.game, pvpLink(sheet.game.path, { kind: 'join', room: r, pin }))}
                    />
                  ) : (
                    <button type="button" className="button button--primary pvp-lobby__big" onClick={() => go(sheet.game, sheet.game.path)}>
                      기록 도전 시작
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="me-sheet">
                <div className="me-sheet__top">
                  <div>
                    <strong className="me-sheet__name">{nickname}</strong>
                    <span className="me-sheet__animal">{look ? `${ANIMAL_NAMES[look.animal]} 캐릭터` : '캐릭터를 골라 보세요'}</span>
                  </div>
                  <Link className="button button--small" to="/nickname">
                    닉네임 바꾸기
                  </Link>
                </div>
                <MyStats />
                <h3 className="game-sheet__label">캐릭터 꾸미기</h3>
                <AvatarEditor onChange={setLook} onDone={() => setSheet(null)} />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
