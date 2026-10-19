import { useState } from 'react'
import { Link } from 'react-router'
import { GameScreen } from './game/GameScreen'
import type { RoundSummary } from './play/roundState'
import './archery.css'

// 화면 흐름: 경기 → 결과. 시작 화면과 기록은 다음 단계에서.
type Screen = { kind: 'game'; key: number } | { kind: 'result'; summary: RoundSummary }

export function ArcheryPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'game', key: 0 })
  const [games, setGames] = useState(0)
  const restart = () => {
    setGames((n) => n + 1)
    setScreen({ kind: 'game', key: games + 1 })
  }

  return (
    <main className="page ar-page">
      <header className="ar-header">
        <h1 className="title">졸라 양궁</h1>
        <Link className="button button--small" to="/">
          나가기
        </Link>
      </header>

      {screen.kind === 'game' && (
        <GameScreen key={screen.key} onFinish={(summary) => setScreen({ kind: 'result', summary })} />
      )}

      {screen.kind === 'result' && (
        <section className="ar-result">
          <strong className="title">{screen.summary.points}점</strong>
          <p className="subtitle">X {screen.summary.xCount}개</p>
          <button
            type="button"
            className="button button--primary"
            onClick={restart}
          >
            다시 하기
          </button>
        </section>
      )}
    </main>
  )
}
