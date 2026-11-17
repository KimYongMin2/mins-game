import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './shared/storage/theme'

// 화면 테마(밝게/어둡게)를 그리기 전에 건다
applyTheme(loadTheme())

// 새 버전이 배포되면 예전 화면이 받으려던 게임 코드 파일이 없어져서, 게임을 바꾸거나 들어갈 때 하얀 화면이 됐다(사용자 제보 2026-11-17).
// 그럴 땐 한 번 새로 고쳐 새 버전을 받는다 (주소는 그대로라 친구 방 들어가기도 이어짐). 20초 안에 또 실패하면 오류 화면(ErrorBoundary)
const RELOAD_KEY = 'mins-game:chunk-reload-at'
window.addEventListener('vite:preloadError', (e) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 20_000) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
