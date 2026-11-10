import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ANIMAL_EMOJI, ANIMAL_NAMES, type Look } from '../shared/art3d/animalKinds'
import { loadLook } from '../shared/storage/avatar'
import { readLocal, writeLocal } from '../shared/storage/local'
import { loadRecent, pushRecent } from '../shared/storage/recent'
import { AvatarEditor } from '../shared/ui/AvatarPicker'
import { GAMES, type GameEntry } from './gameList'

// 메인 화면 (사용자 요청으로 다시 짬 — '색만 바뀐 것 같다', 구조를 바꿔도 되고 규칙만 그대로):
// 게임 선반처럼. 표지는 이모지가 아니라 각 게임의 진짜 경기 장면(public/covers, 직접 찍은 화면).
// 위: 로고 · 내 캐릭터 칩(누르면 내 정보·꾸미기) → 크게 '이어서 하기'(최근 게임, 없으면 오늘의 추천)
// → 거르기(전체 · 1:1 · 여럿이 · 혼자) → 표지 카드들 → 수다방. 카드를 누르면 게임 창이 올라와 [친구랑 하기]/[봇이랑]으로 바로 들어간다.
// [친구랑 하기]는 ?mode=pvp 로 시작 화면을 건너뛰고 바로 방 목록.

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

function Cover({ game, className }: { game: GameEntry; className: string }) {
  const [broken, setBroken] = useState(false)
  return broken ? (
    <span className={`${className} cover--fallback`} style={{ background: `linear-gradient(160deg, ${game.colors[0]}, ${game.colors[1]})` }} aria-hidden>
      {game.icon}
    </span>
  ) : (
    <img className={className} src={cover(game)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  )
}

/** 바로 들어가기 버튼 둘: 친구랑(방 목록) / 봇이랑·혼자(시작 화면) */
function PlayButtons({ game, onGo }: { game: GameEntry; onGo: (path: string) => void }) {
  return (
    <div className="play-buttons">
      {game.play === 'pvp' && (
        <button type="button" className="button button--primary" onClick={() => onGo(`${game.path}?mode=pvp`)}>
          친구랑 하기
        </button>
      )}
      <button type="button" className={`button${game.play === 'solo' ? ' button--primary' : ''}`} onClick={() => onGo(game.path)}>
        {game.play === 'solo' ? '시작하기' : '봇이랑 하기'}
      </button>
    </div>
  )
}

export function MainPage({ nickname }: { nickname: string }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>(() => asFilter(readLocal('lobby-filter')))
  const [look, setLook] = useState<Look | null>(loadLook)
  const [sheet, setSheet] = useState<{ kind: 'game'; game: GameEntry } | { kind: 'me' } | null>(null)
  const [recent] = useState(loadRecent)
  useEffect(() => writeLocal('lobby-filter', filter), [filter])

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
  }, [sheet])

  const go = (game: GameEntry, path: string) => {
    pushRecent(game.id)
    navigate(path)
  }
  const last = READY.find((g) => g.id === recent[0])
  const hero = last ?? todaysPick()
  const shown = READY.filter((g) => filter === 'all' || sizeOf(g) === filter)
  const emoji = look ? ANIMAL_EMOJI[look.animal] : '🐻'

  return (
    <main className="home">
      <header className="home__bar">
        <span className="home__logo" aria-label="민스 게임">
          MINS<b>GAME</b>
        </span>
        <button type="button" className="me-chip" onClick={() => setSheet({ kind: 'me' })} aria-label="내 정보·캐릭터 꾸미기">
          <span className="me-chip__face" aria-hidden>
            {emoji}
          </span>
          <span className="me-chip__name">{nickname}</span>
        </button>
      </header>

      {/* 이어서 하기 / 오늘의 추천 */}
      <section className="hero" aria-label={last ? '이어서 하기' : '오늘의 추천'}>
        <Cover game={hero} className="hero__cover" />
        <div className="hero__shade" />
        <div className="hero__body">
          <span className="hero__eyebrow">{last ? '이어서 하기' : '오늘의 추천'}</span>
          <h2 className="hero__title">{hero.title}</h2>
          <p className="hero__desc">
            {hero.description} · {hero.players}
          </p>
          <PlayButtons game={hero} onGo={(path) => go(hero, path)} />
        </div>
      </section>

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
                <span className={`card__players card__players--${sizeOf(g)}`}>{g.players}</span>
              </span>
              <span className="card__title">{g.title}</span>
              <span className="card__desc">{g.description}</span>
            </button>
          </li>
        ))}
      </ul>

      <Link className="talk" to="/meeting">
        <span className="talk__icon" aria-hidden>
          🎙️
        </span>
        <span className="talk__body">
          <strong>수다방</strong>
          <span>게임 말고 그냥 떠들기 · 음성 통화 2~8인</span>
        </span>
        <span className="talk__go" aria-hidden>
          →
        </span>
      </Link>

      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.kind === 'me' ? '내 정보' : sheet.game.title} onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet__panel">
            <button type="button" className="sheet__close" onClick={() => setSheet(null)} aria-label="닫기">
              ✕
            </button>
            {sheet.kind === 'game' ? (
              <div className="game-sheet">
                <Cover game={sheet.game} className="game-sheet__cover" />
                <div className="game-sheet__head">
                  <h2 className="game-sheet__title">{sheet.game.title}</h2>
                  <span className={`card__players card__players--${sizeOf(sheet.game)}`}>{sheet.game.players}</span>
                </div>
                <p className="game-sheet__desc">{sheet.game.description}</p>
                <p className="game-sheet__modes">{sheet.game.play === 'pvp' ? '친구 대전 · 봇 대전' : '혼자 기록 도전 · 랭킹'}</p>
                <PlayButtons game={sheet.game} onGo={(path) => go(sheet.game, path)} />
              </div>
            ) : (
              <div className="me-sheet">
                <div className="me-sheet__top">
                  <span className="me-sheet__emoji" aria-hidden>
                    {emoji}
                  </span>
                  <div>
                    <strong className="me-sheet__name">{nickname}</strong>
                    <span className="me-sheet__animal">{look ? ANIMAL_NAMES[look.animal] : '캐릭터를 골라 보세요'}</span>
                    <Link className="button button--small" to="/nickname">
                      닉네임 바꾸기
                    </Link>
                  </div>
                </div>
                <h3 className="me-sheet__label">캐릭터 꾸미기</h3>
                <AvatarEditor onChange={setLook} onDone={() => setSheet(null)} />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
