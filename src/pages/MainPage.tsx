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
import { IconChevronRight, IconMic, IconX } from '../shared/ui/icons'
import { RoomPicker } from '../shared/ui/RoomPicker'
import { GAMES, type GameEntry } from './gameList'
import { OpenRooms } from './OpenRooms'
import { PlayerDots } from './PlayerDots'

// 메인 화면 (unslop 방향: 동네 문방구 오락기·보드게임 상자. 겉은 조용하게, 색은 게임 표지에만, 인원은 사람 점):
// 위: 로고 · 내 정보 → 크게 '이어서 하기'(최근 게임, 없으면 오늘의 추천) → 거르기(전체 · 1:1 · 여럿이 · 혼자) → 표지 카드들 → 수다방.
// 표지는 각 게임의 진짜 경기 장면(public/covers). 카드를 누르면 게임 창이 올라오고 그 안에 그 게임의 열린 방 목록 + 방 만들기가 바로 있다.
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
const modesOf = (g: GameEntry) => (g.play === 'pvp' ? '친구 대전 · 봇 대전' : '혼자 기록 도전 · 랭킹')

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

/** 들어가기 버튼: 친구랑(게임 창 열기) / 봇이랑·시작(시작 화면) */
function PlayButtons({ game, onGo, onFriends, onDark = false }: { game: GameEntry; onGo: (path: string) => void; onFriends?: () => void; onDark?: boolean }) {
  return (
    <div className="play-buttons">
      {game.play === 'pvp' && onFriends && (
        <button type="button" className="button button--primary" onClick={onFriends}>
          친구랑 하기
        </button>
      )}
      <button type="button" className={`button${game.play === 'solo' ? ' button--primary' : onDark ? ' button--on-dark' : ''}`} onClick={() => onGo(game.path)}>
        {game.play === 'solo' ? '시작하기' : '봇이랑 하기'}
      </button>
    </div>
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

  return (
    <main className="home">
      <header className="home__bar">
        <span className="home__logo">
          MINS<b>GAME</b>
        </span>
        <button type="button" className="me-chip" onClick={() => setSheet({ kind: 'me' })}>
          <AvatarFace look={look} size={32} />
          <span className="me-chip__name">{nickname}</span>
        </button>
      </header>

      {/* 이어서 하기 / 오늘의 추천: 경기 장면 위에 글자 */}
      <section className="hero" aria-label={last ? '이어서 하기' : '오늘의 추천'}>
        <Cover game={hero} className="hero__cover" />
        <div className="hero__shade" />
        <div className="hero__body">
          <span className="hero__eyebrow">{last ? '이어서 하기' : '오늘의 추천'}</span>
          <h1 className="hero__title">{hero.title}</h1>
          <p className="hero__desc">{hero.description}</p>
          <PlayerDots players={hero.players} />
          <PlayButtons game={hero} onGo={(path) => go(hero, path)} onFriends={() => setSheet({ kind: 'game', game: hero })} onDark />
        </div>
      </section>

      <OpenRooms games={READY.filter((g) => g.play === 'pvp')} onJoin={(g, room, pin) => go(g, pvpLink(g.path, { kind: 'join', room, pin }))} />

      <section className="shelf-section" aria-label="게임">
        <div className="shelf-head">
          <h2 className="shelf-head__title">게임 {shown.length}</h2>
          <div className="filters" role="radiogroup" aria-label="인원으로 거르기">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`filters__chip${filter === f.id ? ' filters__chip--on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="shelf">
          {shown.map((g) => (
            <li key={g.id}>
              <button type="button" className="card" onClick={() => setSheet({ kind: 'game', game: g })}>
                <span className="card__art">
                  <Cover game={g} className="card__cover" />
                </span>
                <span className="card__title">{g.title}</span>
                <span className="card__desc">{g.description}</span>
                <PlayerDots players={g.players} />
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

      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.kind === 'me' ? '내 정보' : sheet.game.title} onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet__panel">
            <button type="button" className="sheet__close" onClick={() => setSheet(null)} aria-label="닫기">
              <IconX size={18} />
            </button>
            {sheet.kind === 'game' ? (
              <div className="game-sheet">
                <Cover game={sheet.game} className="game-sheet__cover" />
                <h2 className="game-sheet__title">{sheet.game.title}</h2>
                <p className="game-sheet__desc">{sheet.game.description}</p>
                <div className="game-sheet__meta">
                  <PlayerDots players={sheet.game.players} />
                  <span>{modesOf(sheet.game)}</span>
                </div>
                <details className="howto">
                  <summary className="howto__toggle">조작법</summary>
                  <ul className="howto__list">
                    {sheet.game.howto.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
                {sheet.game.play === 'pvp' ? (
                  <>
                    <section className="game-sheet__part" aria-label="친구랑 하기">
                      <h3 className="game-sheet__label">친구랑 하기</h3>
                      <RoomPicker
                        gameId={sheet.game.id}
                        nickname={nickname}
                        onCreate={(name, pin) => go(sheet.game, pvpLink(sheet.game.path, { kind: 'create', name, pin }))}
                        onJoin={(r, pin) => go(sheet.game, pvpLink(sheet.game.path, { kind: 'join', room: r, pin }))}
                      />
                    </section>
                    <section className="game-sheet__part" aria-label="혼자 연습">
                      <h3 className="game-sheet__label">혼자 연습</h3>
                      <PlayButtons game={sheet.game} onGo={(path) => go(sheet.game, path)} />
                    </section>
                  </>
                ) : (
                  <PlayButtons game={sheet.game} onGo={(path) => go(sheet.game, path)} />
                )}
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
