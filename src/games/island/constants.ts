// 동물 섬 대작전 수치 (2026-11-24 사용자 요청 — 시안 https://claude.ai/artifact/ERrqRqCUy7zGJmE4XjSkNp)
// 좌표는 1920×1080 섬 그림의 칸(px), 시간은 1/60초 스텝

export const W = 1920
export const H = 1080
/** 바다 높이 — 이보다 아래로 떨어지면 탈락 */
export const WATER = 1010
/** 중력 (칸/스텝²) — 시안에서 '뚝 떨어진다'고 해서 낮춤 */
export const G = 0.13
/** 몸 반 폭·키 */
export const BODY_R = 12
export const TALL = 34
export const TEAM_SIZE = 3
export const HP = 100
export const TURN_SEC = 45
export const TURN_STEPS = TURN_SEC * 60
/** 힘 막대가 0 → 100까지 차오르는 스텝 수 (다시 내려갔다 올라옴) */
export const CHARGE_STEPS = 75
/** 던진 뒤 모두 멈추고 이만큼 지나면 다음 차례 */
export const SETTLE_STEPS = 55
export const PINE_FUSE = 180

export type WeaponId = 'balloon' | 'pine' | 'gull' | 'hammer' | 'rod' | 'drill'

export type WeaponInfo = {
  id: WeaponId
  name: string
  sub: string
  desc: string
  /** 꾹 눌러 힘을 모으는 무기 */
  charge: boolean
  /** 버튼 글자 */
  action: string
}

// 피해: 솔방울은 맞히기 어려워 가장 세게, 물풍선이 기본, 특수한 기능이 있는 건 적게 (사용자 요청)
export const DAMAGE = { balloon: 45, pine: 60, egg: 8, hammer: 12, drill: 8 } as const

export const WEAPONS: WeaponInfo[] = [
  { id: 'balloon', name: '물풍선', sub: '바람 탐', charge: true, action: '꾹 눌러 던지기', desc: '바람에 크게 휘고, 닿는 순간 터져 땅을 파고 주변을 날려요. 피해 최대 45' },
  { id: 'pine', name: '솔방울', sub: '3초 뒤', charge: true, action: '꾹 눌러 던지기', desc: '통통 튀고 굴러가다 3초 뒤 크게 터져요. 맞히기 어려운 만큼 가장 세요. 피해 최대 60' },
  { id: 'gull', name: '갈매기 떼', sub: '목표 고르기', charge: false, action: '갈매기 부르기', desc: '지도를 눌러 목표를 정하면 갈매기가 조개 다섯 개를 떨어뜨려요. 하나에 최대 8' },
  { id: 'hammer', name: '뿅망치', sub: '바로 앞', charge: false, action: '뿅망치 휘두르기', desc: '바로 앞 상대를 쳐서 날려 보내요. 물가로 밀어 빠뜨리기 좋아요. 피해 12' },
  { id: 'rod', name: '낚싯대', sub: '이동', charge: false, action: '낚싯줄 던지기', desc: '땅에 걸면 그쪽으로 끌려가요. 쓰면 그 차례는 끝나요' },
  { id: 'drill', name: '두더지 삽', sub: '땅 뚫기', charge: false, action: '땅 파기', desc: '조준한 쪽으로 땅을 작게 파며 나아가요. 가는 길의 상대는 8. 쓰면 그 차례는 끝나요' },
]

export const weaponOf = (id: WeaponId) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0]
