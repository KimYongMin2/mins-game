import { GAME_SERVER_URL } from './online/hubClient'

// 브라우저 오류를 우리 게임 서버로 짧게 보낸다 (사용자 요청 2026-11-17 — 친구 폰에서 화면이 하얘져도 알 수 없어서).
// 서버는 기록만 남김(docker logs의 '[report]'). 닉네임·계정 등 개인 정보는 안 보냄: 주소(경로), 오류 글, 짧은 위치, 브라우저 종류, 사이트 버전.
// 한 페이지에서 같은 오류는 한 번, 모두 8개까지.

const MAX_PER_PAGE = 8
const sent = new Set<string>()
/** 확장 프로그램·브라우저 잡음 */
const IGNORE = /ResizeObserver loop|Script error\.?$|extension:\/\/|Non-Error promise rejection/

const reportUrl = () => (GAME_SERVER_URL ? GAME_SERVER_URL.replace(/^ws/, 'http').replace(/\/?$/, '/report') : null)

/** 지금 사이트 버전 (첫 화면 코드 파일 이름의 해시) */
const version = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src.split('/').pop()?.slice(6, 14) ?? 'dev'

export function reportError(error: unknown, where = '') {
  const url = reportUrl()
  if (!url || import.meta.env.DEV) return
  const msg = `${where ? `${where}: ` : ''}${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`.slice(0, 300)
  if (IGNORE.test(msg) || sent.has(msg) || sent.size >= MAX_PER_PAGE) return
  sent.add(msg)
  const stack = error instanceof Error && error.stack ? error.stack.split('\n').slice(1, 5).map((l) => l.trim()).join(' / ').slice(0, 600) : ''
  const body = JSON.stringify({ msg, stack, path: location.pathname, ua: navigator.userAgent.slice(0, 160), ver: version() })
  try {
    // text/plain = 미리 묻기(preflight) 없이 보내짐, keepalive = 페이지를 떠나도 보내짐
    void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {})
  } catch {
    /* 못 보내면 그만 */
  }
}

/** 처리 안 된 오류를 모두 보낸다 (main.tsx가 한 번) */
export function installErrorReport() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'error'))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'))
}
