import { readLocal, writeLocal } from './local'

// 사이트 화면 테마: 밝게(기본) / 어둡게. <html data-theme>에 걸어 두면 index.css의 .arcade 색이 바뀐다.
// 기기에 기억하고, 처음 그리기 전에(main.tsx) 걸어서 깜빡이지 않게 한다.
export type Theme = 'light' | 'dark'

const KEY = 'theme'
const BAR = { light: '#f3f4f9', dark: '#1c1748' } as const

export function loadTheme(): Theme {
  return readLocal(KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme])
}

export function saveTheme(theme: Theme): void {
  writeLocal(KEY, theme)
  applyTheme(theme)
}
