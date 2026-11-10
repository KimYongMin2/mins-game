import { Suspense, lazy, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ANIMAL_EMOJI, ANIMAL_NAMES, type Look } from '../shared/art3d/animalKinds'
import { canWebGL } from '../shared/art3d/webgl'
import { loadLook } from '../shared/storage/avatar'
import { readLocal, writeLocal } from '../shared/storage/local'
import { loadRecent, pushRecent } from '../shared/storage/recent'
import { AvatarEditor } from '../shared/ui/AvatarPicker'
import { GAMES, type GameEntry } from './gameList'

// 메인 화면 = 게임 로비 (사용자 요청 — 실제 게임처럼). 게임 규칙·흐름은 그대로, 보이는 것만:
// 위 내 프로필(3D 캐릭터·닉네임·꾸미기) → 최근에 한 게임 → 탭(친구랑 · 혼자 · 수다방) → 게임 타일.
// 친구랑 탭은 1:1 / 여럿이 거르기. 고른 탭·거르기는 기기에 기억.

const AvatarPreview3D = lazy(() => import('../shared/ui/AvatarPreview3D').then((m) => ({ default: m.AvatarPreview3D })))

type Tab = 'pvp' | 'solo' | 'talk'
type Filter = 'all' | 'duo' | 'group'

const TABS: { id: Tab; icon: string; label: string; note: string }[] = [
  { id: 'pvp', icon: '🤝', label: '친구랑', note: '친구 대전 · 봇 대전' },
  { id: 'solo', icon: '🎯', label: '혼자', note: '기록 도전 · 랭킹' },
  { id: 'talk', icon: '🎙️', label: '수다방', note: '음성 통화' },
]
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'duo', label: '1:1' },
  { id: 'group', label: '여럿이' },
]

/** 인원 표시: 혼자 / 둘 / 여럿 */
const sizeOf = (players: string) => (players === '1인' ? 'solo' : players === '2인' ? 'duo' : 'group')
const asTab = (x: string | null): Tab => (x === 'solo' || x === 'talk' ? x : 'pvp')
const asFilter = (x: string | null): Filter => (x === 'duo' || x === 'group' ? x : 'all')

const tileStyle = (colors: readonly [string, string]) => ({ '--tile-a': colors[0], '--tile-b': colors[1] }) as CSSProperties

function GameTile({ game }: { game: GameEntry }) {
  return (
    <Link className="tile" to={game.path} style={tileStyle(game.colors)} onClick={() => pushRecent(game.id)}>
      <span className="tile__art" aria-hidden>
        <span className="tile__icon">{game.icon}</span>
      </span>
      <span className="tile__body">
        <span className="tile__title">{game.title}</span>
        <span className="tile__desc">{game.description}</span>
        <span className={`tile__players tile__players--${sizeOf(game.players)}`}>{game.players}</span>
      </span>
    </Link>
  )
}

/** 위 내 프로필: 3D 캐릭터(안 되면 이모지)·닉네임·꾸미기·닉네임 변경 */
function Profile({ nickname, look, editing, onEdit }: { nickname: string; look: Look | null; editing: boolean; onEdit: () => void }) {
  const [use3D] = useState(canWebGL)
  const emoji = look ? ANIMAL_EMOJI[look.animal] : '🐻'
  return (
    <section className="profile">
      <button type="button" className="profile__avatar" onClick={onEdit} aria-label="내 캐릭터 꾸미기">
        {use3D && look && !editing ? (
          <Suspense fallback={<span className="profile__emoji">{emoji}</span>}>
            <AvatarPreview3D look={look} background="#ede9fe" className="profile__3d" />
          </Suspense>
        ) : (
          <span className="profile__emoji">{emoji}</span>
        )}
      </button>
      <div className="profile__info">
        <span className="profile__hello">어서 와요!</span>
        <strong className="profile__name">{nickname}</strong>
        <span className="profile__animal">{look ? `${ANIMAL_NAMES[look.animal]} 캐릭터` : '캐릭터를 골라 보세요'}</span>
        <div className="profile__actions">
          <button type="button" className="button button--small button--primary" onClick={onEdit}>
            ✨ 꾸미기
          </button>
          <Link className="button button--small" to="/nickname">
            닉네임 변경
          </Link>
        </div>
      </div>
    </section>
  )
}

type Props = {
  nickname: string
}

export function MainPage({ nickname }: Props) {
  const [tab, setTab] = useState<Tab>(() => asTab(readLocal('lobby-tab')))
  const [filter, setFilter] = useState<Filter>(() => asFilter(readLocal('lobby-filter')))
  const [look, setLook] = useState<Look | null>(loadLook)
  const [editing, setEditing] = useState(false)
  const [recent] = useState(loadRecent)
  useEffect(() => writeLocal('lobby-tab', tab), [tab])
  useEffect(() => writeLocal('lobby-filter', filter), [filter])

  // 꾸미기 창: Esc로 닫기, 열려 있는 동안 뒤 화면 스크롤 막기
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [editing])

  const recentGames = recent.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is GameEntry => !!g && g.ready)
  const shown = GAMES.filter((g) => g.ready && g.play === tab && (tab !== 'pvp' || filter === 'all' || sizeOf(g.players) === filter))
  const count = (t: Tab) => (t === 'talk' ? 1 : GAMES.filter((g) => g.ready && g.play === t).length)
  const current = TABS.find((t) => t.id === tab)!

  return (
    <main className="lobby">
      <header className="lobby__top">
        <span className="lobby__logo">
          <span aria-hidden>🎮</span> 미니게임 모음
        </span>
        <span className="lobby__count">게임 {GAMES.filter((g) => g.ready).length}개</span>
      </header>

      <Profile nickname={nickname} look={look} editing={editing} onEdit={() => setEditing(true)} />

      {recentGames.length > 0 && (
        <section className="recent" aria-label="최근에 한 게임">
          <h2 className="lobby__heading">최근에 한 게임</h2>
          <ul className="recent__list">
            {recentGames.map((g) => (
              <li key={g.id}>
                <Link className="recent__item" to={g.path} style={tileStyle(g.colors)} onClick={() => pushRecent(g.id)}>
                  <span className="recent__icon" aria-hidden>
                    {g.icon}
                  </span>
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="tabs" role="tablist" aria-label="놀이 종류">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tabs__tab${tab === t.id ? ' tabs__tab--on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tabs__icon" aria-hidden>
              {t.icon}
            </span>
            <span className="tabs__label">{t.label}</span>
            <span className="tabs__count">{count(t.id)}</span>
          </button>
        ))}
      </nav>

      <div className="lobby__bar">
        <p className="lobby__note">{current.note}</p>
        {tab === 'pvp' && (
          <div className="chips" role="radiogroup" aria-label="인원">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`chips__chip${filter === f.id ? ' chips__chip--on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'talk' ? (
        <Link className="talk-card" to="/meeting">
          <span className="talk-card__icon" aria-hidden>
            🎙️
          </span>
          <span className="talk-card__body">
            <strong>회의방</strong>
            <span>방 목록에서 골라 들어가 음성 통화 · 목소리 변조</span>
            <span className="tile__players tile__players--group">2~8인</span>
          </span>
          <span className="talk-card__go" aria-hidden>
            ›
          </span>
        </Link>
      ) : (
        <ul className="tiles">
          {shown.map((game) => (
            <li key={game.id}>
              <GameTile game={game} />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="내 캐릭터 꾸미기" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div className="sheet__panel">
            <div className="sheet__head">
              <strong>내 캐릭터 꾸미기</strong>
              <button type="button" className="sheet__close" onClick={() => setEditing(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            <AvatarEditor onChange={setLook} onDone={() => setEditing(false)} />
          </div>
        </div>
      )}
    </main>
  )
}
