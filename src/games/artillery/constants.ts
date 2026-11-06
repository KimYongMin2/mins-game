// 포격전 수치. 길이는 화면 단위(가로 WORLD_W칸 = 맵 전체), 시간은 초(물리) / ms(화면).

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

/** 맵: 가로 0~WORLD_W, 세로 0(바닥)~WORLD_H(화면 위). 지형 높이는 1칸마다 하나 (COLS+1개) */
export const WORLD_W = 200
export const WORLD_H = 130
export const COLS = WORLD_W
/** 처음 지형 높이 범위 */
export const TERRAIN_MIN = 18
export const TERRAIN_MAX = 82
/** 지형이 이만큼까지 파이면 그 위 대포는 바닥으로 떨어져 탈락 */
export const FLOOR = 1

/** 물리: 고정 스텝, 중력, 힘 100일 때 포탄 속도, 바람(옆으로 미는 가속도) 최대 */
export const STEP = 1 / 60
export const GRAVITY = 30
export const MAX_SPEED = 80
export const WIND_MAX = 8
/** 포탄이 이만큼 화면 밖으로 나가면 빗나감 */
export const OUT_MARGIN = 40
/** 포탄이 날 수 있는 최대 시간 (안전장치) */
export const MAX_FLIGHT_S = 12

/** 대포: 몸 가운데 높이(땅 위), 맞는 반경, 포신 길이, 체력 */
export const TANK_CY = 3
export const TANK_R = 4.5
export const BARREL = 7.5
export const HP = 100

/** 폭발: 땅이 파이는 반경, 피해가 닿는 반경, 한가운데 피해 */
export const CRATER_R = 7
export const DAMAGE_R = 11
export const MAX_DAMAGE = 45
/** 떨어짐: 이보다 높이 떨어지면 1칸마다 FALL_DAMAGE */
export const FALL_SAFE = 5
export const FALL_DAMAGE = 2

/** 이동: 한 차례에 갈 수 있는 거리(연료), 빠르기(칸/초) */
export const MOVE_MAX = 14
export const MOVE_SPEED = 10

/** 조준 범위 */
export const ANGLE_MIN = 0
export const ANGLE_MAX = 180
export const POWER_MIN = 5
export const POWER_MAX = 100

/** 시간 (ms): 시작 안내, 한 차례, 터진 뒤 보여주기, 끝 */
export const COUNTDOWN_MS = 1500
export const TURN_MS = 20_000
export const BOOM_MS = 1600
export const DONE_MS = 2500
/** 봇이 생각하는 시간 */
export const BOT_THINK_MS = [1200, 2400] as const

/** 참가 순서별 색 (모든 기기에서 같음) */
export const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b']
