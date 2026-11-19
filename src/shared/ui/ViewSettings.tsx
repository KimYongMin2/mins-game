import { useEffect, useState } from 'react'
import { FOV_MAX, FOV_MIN, onViewChange, saveViewDot, saveViewFov, viewDot, viewFov } from '../storage/view3d'

/** 3D 시야 설정 (내 정보 창·낚시터): 시야각 막대 + 화면 가운데 점 — 멀미 줄이기 (사용자 요청 2026-11-19) */
export function ViewSettings() {
  const [fov, setFov] = useState(viewFov)
  const [dot, setDot] = useState(viewDot)
  useEffect(() => onViewChange(() => (setFov(viewFov()), setDot(viewDot()))), [])
  return (
    <>
      <label className="theme-pick view-pick">
        <span className="theme-pick__label">시야각 {fov}°</span>
        <input type="range" min={FOV_MIN} max={FOV_MAX} step={1} value={fov} onChange={(e) => saveViewFov(Number(e.target.value))} aria-label="3D 시야각" />
        <small>넓을수록 덜 어지러워요</small>
      </label>
      <div className="theme-pick" role="radiogroup" aria-label="화면 가운데 점">
        <span className="theme-pick__label">가운데 점</span>
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={dot === v} className={`filters__chip${dot === v ? ' filters__chip--on' : ''}`} onClick={() => saveViewDot(v)}>
            {v ? '보이기 (멀미 줄이기)' : '숨기기'}
          </button>
        ))}
      </div>
    </>
  )
}
