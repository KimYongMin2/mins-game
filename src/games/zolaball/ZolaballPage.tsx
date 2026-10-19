import { useState } from 'react'
import { Link } from 'react-router'
import { Field } from './field/Field'
import { CAMERA_FULL, CAMERA_PITCH } from './field/camera'
import './zolaball.css'

const VIEWS = [
  { id: 'pitch', label: '투수-타자', camera: CAMERA_PITCH },
  { id: 'full', label: '전체 필드', camera: CAMERA_FULL },
] as const

// 지금은 필드 그림 미리보기. 경기 흐름은 이후 단계에서 이 자리에 붙인다.
export function ZolaballPage() {
  const [viewId, setViewId] = useState<(typeof VIEWS)[number]['id']>('pitch')
  const view = VIEWS.find((v) => v.id === viewId) ?? VIEWS[0]

  return (
    <main className="page zb-page">
      <header className="zb-header">
        <h1 className="title">졸라볼</h1>
        <Link className="button button--small" to="/">
          나가기
        </Link>
      </header>

      <div className="zb-field-wrap">
        <Field camera={view.camera} />
      </div>

      <div className="zb-view-toggle" role="group" aria-label="시점">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="button button--small"
            aria-pressed={v.id === viewId}
            onClick={() => setViewId(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </main>
  )
}
