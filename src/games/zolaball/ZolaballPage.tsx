import { useState } from 'react'
import { Link } from 'react-router'
import { MatchScreen } from './match/MatchScreen'
import type { MatchConfig, MatchSummary } from './match/matchState'
import { BattingPractice } from './practice/BattingPractice'
import type { Difficulty } from './rules/judge'
import './zolaball.css'

type Screen =
  | { kind: 'menu' }
  | { kind: 'practice' }
  | { kind: 'match'; config: MatchConfig; key: number }
  | { kind: 'result'; summary: MatchSummary }

const OUTCOME_TEXT = { win: '승리!', lose: '패배', draw: '무승부' } as const

export function ZolaballPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })

  function startMatch(difficulty: Difficulty) {
    // 선공·후공은 매 경기 무작위
    const userSide = Math.random() < 0.5 ? 'away' : 'home'
    setScreen({ kind: 'match', config: { difficulty, userSide }, key: Date.now() })
  }

  const inGame = screen.kind !== 'menu'

  return (
    <main className="page zb-page">
      <header className="zb-header">
        <h1 className="title">졸라볼{screen.kind === 'practice' && ' · 타격 연습'}</h1>
        {inGame ? (
          <button type="button" className="button button--small" onClick={() => setScreen({ kind: 'menu' })}>
            그만하기
          </button>
        ) : (
          <Link className="button button--small" to="/">
            나가기
          </Link>
        )}
      </header>

      {screen.kind === 'menu' && (
        <section className="zb-menu">
          <p className="subtitle">봇과 3이닝 대결. 난이도를 고르세요.</p>
          <div className="zb-menu__buttons">
            <button type="button" className="button button--primary zb-menu__button" onClick={() => startMatch('normal')}>
              일반
            </button>
            <button type="button" className="button button--primary zb-menu__button" onClick={() => startMatch('hard')}>
              어려움
            </button>
          </div>
          <button type="button" className="button" onClick={() => setScreen({ kind: 'practice' })}>
            타격 연습
          </button>
        </section>
      )}

      {screen.kind === 'practice' && <BattingPractice />}

      {screen.kind === 'match' && (
        <MatchScreen
          key={screen.key}
          config={screen.config}
          onFinish={(summary) => setScreen({ kind: 'result', summary })}
        />
      )}

      {screen.kind === 'result' && (
        <section className="zb-menu">
          <strong className="title">{OUTCOME_TEXT[screen.summary.outcome]}</strong>
          <p className="subtitle">
            나 {screen.summary.userRuns} : {screen.summary.botRuns} 봇
          </p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => startMatch(screen.summary.config.difficulty)}
          >
            다시 하기
          </button>
          <button type="button" className="button" onClick={() => setScreen({ kind: 'menu' })}>
            처음으로
          </button>
        </section>
      )}
    </main>
  )
}
