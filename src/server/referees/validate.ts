// 서버 심판 입력 모양 검사 (누구나 아무거나 보낼 수 있어서)
export const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
export const isInt = (x: unknown, min = -1e9, max = 1e9): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max
export const isVec = (x: unknown): x is { x: number; y: number } => !!x && typeof x === 'object' && isNum((x as { x: unknown }).x) && isNum((x as { y: unknown }).y)
/** 숫자 잇기 바닥: 줄 최대 60개, 줄마다 최대 13장, 타일 번호 0~105 */
export const isTable = (x: unknown): x is number[][] =>
  Array.isArray(x) && x.length <= 60 && x.every((row) => Array.isArray(row) && row.length <= 13 && row.every((t) => isInt(t, 0, 105)))
