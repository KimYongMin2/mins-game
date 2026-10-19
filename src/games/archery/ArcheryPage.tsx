import { useState } from 'react'
import { Link } from 'react-router'
import { type Distance, ROUNDS } from './constants'
import { SideView } from './field/SideView'
import { TargetView } from './field/TargetView'
import './archery.css'

// 지금은 그림 미리보기. 경기 흐름은 다음 단계에서 이 자리에 붙인다.
export function ArcheryPage() {
  const [distance, setDistance] = useState<Distance>(30)
  const [draw, setDraw] = useState(1)

  return (
    <main className="page ar-page">
      <header className="ar-header">
        <h1 className="title">졸라 양궁</h1>
        <Link className="button button--small" to="/">
          나가기
        </Link>
      </header>

      <SideView distance={distance} draw={draw} />
      <div className="ar-target-wrap">
        <TargetView
          distance={distance}
          reticle={{ x: 0.05, y: 0.08 }}
          drawProgress={draw}
          arrows={[
            { at: { x: -0.03, y: 0.02 }, latest: false },
            { at: { x: 0.2, y: -0.15 }, latest: true },
          ]}
        />
      </div>

      <div className="ar-preview-controls">
        {ROUNDS.map((r) => (
          <button
            key={r.distance}
            type="button"
            className="button button--small"
            aria-pressed={distance === r.distance}
            onClick={() => setDistance(r.distance)}
          >
            {r.distance}m
          </button>
        ))}
        <button type="button" className="button button--small" onClick={() => setDraw(draw === 1 ? 0 : 1)}>
          {draw === 1 ? '활 내리기' : '활 당기기'}
        </button>
      </div>
    </main>
  )
}
