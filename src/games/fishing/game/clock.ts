// 낚시터 시각·날씨 (사용자 요청 2026-11-18 — 실제 시각보다 빠르게, 날씨도 바뀌게).
// 모두 같은 걸 보게 실제 시각(한국 시간)에서 계산: 시간은 6배 빠르게(하루 = 4시간), 날씨는 40분마다 맑음·흐림·비 중 하나(정해진 무작위),
// 바뀔 때는 3분 동안 천천히. 그림만 바뀌고 낚시 규칙은 그대로.

/** 낚시터 시간 흐르는 빠르기 (실제의 몇 배) */
export const TIME_SPEED = 6
const KST = 9 * 3600_000
const WEATHER_MS = 40 * 60_000
const FADE_MS = 3 * 60_000

/** 낚시터 시각 (0~24). 주소 꼬리 ?hour=21 이면 그 시각으로 고정 (확인용) */
export function gameHour(now = Date.now()): number {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') : null
  if (q !== null && !Number.isNaN(Number(q))) return Number(q)
  return ((((now + KST) / 3600_000) * TIME_SPEED) % 24 + 24) % 24
}

export type WeatherKind = 'clear' | 'cloudy' | 'rain'
const frac = (x: number) => x - Math.floor(x)
function kindOf(seg: number): WeatherKind {
  const v = frac(Math.sin(seg * 12.9898 + 78.233) * 43758.5453)
  return v < 0.58 ? 'clear' : v < 0.82 ? 'cloudy' : 'rain'
}
const CLOUD: Record<WeatherKind, number> = { clear: 0.1, cloudy: 0.65, rain: 1 }
const RAIN: Record<WeatherKind, number> = { clear: 0, cloudy: 0, rain: 1 }

/** 지금 날씨: 이름 + 구름 양(0~1) + 비(0~1), 바뀌는 중엔 섞임. 주소 꼬리 ?weather=rain 이면 고정 (확인용) */
export function weatherNow(now = Date.now()): { kind: WeatherKind; cloud: number; rain: number } {
  const q = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('weather') as WeatherKind | null) : null
  if (q && q in CLOUD) return { kind: q, cloud: CLOUD[q], rain: RAIN[q] }
  const seg = Math.floor(now / WEATHER_MS)
  const cur = kindOf(seg), prev = kindOf(seg - 1)
  const k = Math.min(1, (now - seg * WEATHER_MS) / FADE_MS)
  return { kind: cur, cloud: CLOUD[prev] + (CLOUD[cur] - CLOUD[prev]) * k, rain: RAIN[prev] + (RAIN[cur] - RAIN[prev]) * k }
}

export const WEATHER_NAME: Record<WeatherKind, string> = { clear: '맑음', cloudy: '흐림', rain: '비' }

/** '오후 3:20' */
export function hourLabel(h: number): string {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60)
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}
