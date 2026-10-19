// localStorage는 사생활 보호 모드 등에서 예외를 던질 수 있어 모든 접근을 감싼다.
const PREFIX = 'mins-game:'

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // 저장 실패는 무시: 이번 세션 동안만 값이 유지된다.
  }
}
