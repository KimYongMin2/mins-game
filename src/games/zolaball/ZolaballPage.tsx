import { useState } from 'react'
import { Link } from 'react-router'
import { MatchScreen } from './match/MatchScreen'
import type { MatchConfig, MatchSummary } from './match/matchState'
import { BattingPractice } from './practice/BattingPractice'
import { type ZolaballRecord, addMatch, loadRecord, saveRecord } from './records'
import type { Difficulty } from './rules/judge'
import { MenuScreen } from './screens/MenuScreen'
import { ResultScreen } from './screens/ResultScreen'
import './zolaball.css'

// 화면 흐름: 난이도 선택 → 경기 → 결과 (타격 연습은 난이도 선택에서)
type Screen =
  | { kind: 'menu' }
  | { kind: 'practice' }
  | { kind: 'match'; config: MatchConfig; key: number }
  | { kind: 'result'; summary: MatchSummary }

export function ZolaballPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [record, setRecord] = useState<ZolaballRecord>(() => loadRecord())

  function startMatch(difficulty: Difficulty) {
    // 선공·후공은 매 경기 무작위
    const userSide = Math.random() < 0.5 ? 'away' : 'home'
    setScreen({ kind: 'match', config: { difficulty, userSide }, key: Date.now() })
  }

  function finishMatch(summary: MatchSummary) {
    const next = addMatch(record, summary)
    saveRecord(next)
    setRecord(next)
    setScreen({ kind: 'result', summary })
  }

  const toMenu = () => setScreen({ kind: 'menu' })

  return (
    <main className="page zb-page">
      <header className="zb-header">
        <h1 className="title">졸라볼{screen.kind === 'practice' && ' · 타격 연습'}</h1>
        {screen.kind === 'match' || screen.kind === 'practice' ? (
          <button type="button" className="button button--small" onClick={toMenu}>
            그만하기
          </button>
        ) : (
          <Link className="button button--small" to="/">
            나가기
          </Link>
        )}
      </header>

      {screen.kind === 'menu' && (
        <MenuScreen record={record} onStart={startMatch} onPractice={() => setScreen({ kind: 'practice' })} />
      )}

      {screen.kind === 'practice' && <BattingPractice />}

      {screen.kind === 'match' && <MatchScreen key={screen.key} config={screen.config} onFinish={finishMatch} />}

      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          onRematch={() => startMatch(screen.summary.config.difficulty)}
          onMenu={toMenu}
        />
      )}
    </main>
  )
}
