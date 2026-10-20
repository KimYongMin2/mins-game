// 졸라 타격왕 수치. 시간은 ms.

export type Difficulty = 'normal' | 'hard'
/** 우타는 포수 시점 왼쪽 타석, 좌타는 오른쪽 타석 */
export type Hand = 'right' | 'left'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { normal: '일반', hard: '어려움' }
export const HAND_LABEL: Record<Hand, string> = { right: '우타', left: '좌타' }

/** 한 경기 공 개수 */
export const TOTAL_PITCHES = 10

/**
 * 타이밍 구간(일반, |터치 시각 − 도착 시각|).
 * fair 안이면 앞으로 날아가고(가까울수록 멀리), foul 안이면 파울, 밖이면 헛스윙.
 * perfect는 '딱 맞았어요' 표시용
 */
export const TIMING_MS = { perfect: 20, fair: 130, foul: 180 } as const

/** 비거리(m): 가장 약하게 맞아도 MIN, 완벽하면 MAX */
export const MIN_DISTANCE = 15
export const MAX_DISTANCE = 140
/** 펜스. 이보다 멀리 가면 홈런 */
export const FENCE_DISTANCE = 115

/** 어려움은 모든 구간 폭을 이 비율로 줄인다 */
export const HARD_WINDOW_SCALE = 0.7
