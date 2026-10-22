import { type Rng, pickOne } from '../../../shared/random'
import type { Length } from '../constants'

// 숫자야구 규칙: 0~9 중 서로 다른 숫자로 3·4자리, 맨 앞은 0이 아님.
// 같은 숫자가 같은 자리면 스트라이크, 다른 자리면 볼, 하나도 없으면 아웃.

export type Digits = readonly number[]
export type Score = { strike: number; ball: number }

export function isValidNumber(digits: Digits, length: Length): boolean {
  return (
    digits.length === length &&
    digits[0] !== 0 &&
    digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) &&
    new Set(digits).size === length
  )
}

/** 지금까지 누른 숫자 뒤에 d를 붙일 수 있는지 (입력 중 버튼 막기) */
export function canAppend(digits: Digits, d: number, length: Length): boolean {
  return digits.length < length && !(digits.length === 0 && d === 0) && !digits.includes(d)
}

export function score(secret: Digits, guess: Digits): Score {
  let strike = 0
  let ball = 0
  guess.forEach((d, i) => {
    if (secret[i] === d) strike++
    else if (secret.includes(d)) ball++
  })
  return { strike, ball }
}

export const isSolved = (s: Score, length: Length) => s.strike === length

export function scoreText(s: Score, length: Length): string {
  if (isSolved(s, length)) return `${length}S`
  if (s.strike === 0 && s.ball === 0) return 'OUT'
  return [s.strike && `${s.strike}S`, s.ball && `${s.ball}B`].filter(Boolean).join(' ')
}

const cache = new Map<Length, number[][]>()

/** 만들 수 있는 숫자 전부 (3자리 648개, 4자리 4536개) */
export function allNumbers(length: Length): number[][] {
  let list = cache.get(length)
  if (!list) {
    list = []
    const build = (prefix: number[]) => {
      if (prefix.length === length) {
        list!.push(prefix)
        return
      }
      for (let d = 0; d <= 9; d++) if (canAppend(prefix, d, length)) build([...prefix, d])
    }
    build([])
    cache.set(length, list)
  }
  return list
}

export function randomNumber(rng: Rng, length: Length): number[] {
  return [...pickOne(rng, allNumbers(length))]
}

/** 부른 숫자와 결과들에 모두 맞는 후보 */
export function consistent(candidates: readonly Digits[], clues: readonly { digits: Digits; score: Score }[]): Digits[] {
  return candidates.filter((c) =>
    clues.every(({ digits, score: s }) => {
      const t = score(c, digits)
      return t.strike === s.strike && t.ball === s.ball
    }),
  )
}
