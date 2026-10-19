import { readLocal, writeLocal } from './local'

const KEY = 'nickname'

export const NICKNAME_MAX_LENGTH = 10

export function loadNickname(): string | null {
  return readLocal(KEY)
}

export function saveNickname(nickname: string): void {
  writeLocal(KEY, nickname)
}

/** 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지를 돌려준다. */
export function validateNickname(raw: string): string | null {
  const nickname = raw.trim()
  if (nickname.length === 0) return '닉네임을 입력해 주세요.'
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`
  }
  return null
}
