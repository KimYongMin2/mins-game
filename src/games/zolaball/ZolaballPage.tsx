import { Link } from 'react-router'
import { BattingPractice } from './practice/BattingPractice'
import './zolaball.css'

// 지금은 타격 연습 화면. 경기 흐름은 이후 단계에서 이 자리에 붙인다.
export function ZolaballPage() {
  return (
    <main className="page zb-page">
      <header className="zb-header">
        <h1 className="title">졸라볼 · 타격 연습</h1>
        <Link className="button button--small" to="/">
          나가기
        </Link>
      </header>

      <BattingPractice />
    </main>
  )
}
