// 졸라 타격왕 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'
/** 우타는 포수 시점 왼쪽 타석, 좌타는 오른쪽 타석 */
export type Hand = 'right' | 'left'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }
export const HAND_LABEL: Record<Hand, string> = { right: '우타', left: '좌타' }

/** 한 경기 공 개수 */
export const TOTAL_PITCHES = 10

/**
 * 타이밍 구간(일반): |터치 시각 − 도착 시각|이 이 안이면 그 등급.
 * 순서대로 정타 기준 홈런 · 3루타 · 2루타 · 안타 · 범타 · 파울. 밖이면 헛스윙
 */
export const TIMING_WINDOWS_MS = [20, 35, 55, 80, 110, 160] as const

/** 어려움은 모든 구간 폭을 이 비율로 줄인다 */
export const HARD_WINDOW_SCALE = 0.7
