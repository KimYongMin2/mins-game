import { Component, type ReactNode } from 'react'
import { reportError } from '../report'

// 화면을 그리다 오류가 나면 하얀 화면 대신 안내 + [새로 고침] (사용자 제보 2026-11-17 — 게임을 바꾸면 화면이 안 보임).
// 대개는 새 버전이 배포된 뒤 예전 화면에서 다른 게임 코드를 받으려다 실패한 것 (main.tsx가 먼저 한 번 저절로 새로 고침).

type Props = { children: ReactNode }
type State = { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[화면 오류]', error)
    reportError(error, 'render')
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page page--center arcade">
        <h1 className="title">화면을 불러오지 못했어요</h1>
        <p>새 버전이 나왔거나 인터넷이 잠깐 끊겼을 수 있어요.</p>
        <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
          새로 고침
        </button>
        <a className="button" href="/">
          메인으로
        </a>
      </main>
    )
  }
}
