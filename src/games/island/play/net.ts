import { CRATE_KINDS, W, WEAPONS, type WeaponId } from '../constants'
import type { Animal, Fx, Phase, Proj, Team, World } from './world'

// 친구 대전 통신: 우리 게임 서버가 World를 1초에 60번 돌리고(src/server/referees/island.ts), 1초에 30번 상태(snap)를 보낸다.
// 폰은 같은 씨앗값으로 섬을 만든 '거울' World에 상태를 덮어써 그리기만 하고, 차례인 사람은 입력만 보낸다.
// 조준·힘 모으기는 내 폰에서 바로 반영(지연 없이)하고 값을 보냄.

export type RosterPlayer = { id: string; name: string; kind: 'remote' | 'bot'; team: Team }

/** 방장 'start' (화면 바꾸기) · 화면 → 서버 입력 · 서버 → 화면 */
export type IslandMsg =
  | { t: 'start' }
  | { t: 'hello' }
  | { t: 'keys'; l: boolean; r: boolean }
  | { t: 'aim'; a: number }
  | { t: 'press' }
  | { t: 'release'; p: number }
  | { t: 'jump' }
  | { t: 'pick'; w: WeaponId }
  | { t: 'target'; x: number }
  | { t: 'init'; seed: number; sides: number; players: RosterPlayer[]; carves: CarveRow[] }
  | ({ t: 'snap' } & Snap)

export type CarveRow = [number, number, number, 0 | 1]
type AnimalRow = [number, number, number, number, 1 | -1, number, number, number, number, number, number, number]
type ProjRow = [number, number, number, number, number, number]
const KINDS: Proj['kind'][] = ['balloon', 'pine', 'egg']

export type Snap = {
  /** 섬 씨앗값 (심판이 새로 서면 바뀜 → 화면은 hello로 다시 받음) */
  sd?: number
  n: number
  ph: Phase
  tm: number
  wd: number
  team: Team
  act: number
  wp: WeaponId
  aim: number
  /** 힘 모으는 중이면 chargeT, 아니면 -1 */
  ch: number
  tg: number
  /** 지금 조작하는 사람 접속 번호 (없으면 '') */
  ctl: string
  win: Team | 'draw' | null
  hm: number
  rod: [number, number] | null
  an: AnimalRow[]
  pj: ProjRow[]
  gl: [number, number, 1 | -1, number, number] | null
  /** 바다 높이 · 남은 걸음 */
  wl: number
  mv: number
  /** 편마다 무기 개수 (WEAPONS 순서, -1 = 무제한) */
  am: number[][]
  /** 상자 [번호, 종류(CRATE_KINDS), x, y, 공중이면 1] */
  cr: [number, number, number, number, 0 | 1][]
  /** 이번에 보내는 파인 곳의 첫 번호 */
  cs: number
  c: CarveRow[]
  fx: Fx[]
}

const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

export function encodeSnap(w: World, ctl: string, cs: number, c: CarveRow[], fx: Fx[]): Snap {
  return {
    n: w.turnNo,
    ph: w.phase,
    tm: w.timer,
    wd: w.wind,
    team: w.team,
    act: w.active.id,
    wp: w.weapon,
    aim: r1(w.aim),
    ch: w.charging ? w.chargeT : -1,
    tg: Math.round(w.target),
    ctl,
    win: w.winner,
    hm: w.hammerT,
    rod: w.rodLine ? [r1(w.rodLine.x), r1(w.rodLine.y)] : null,
    an: w.animals.map((a) => [r1(a.x), r1(a.y), r2(a.vx), r2(a.vy), a.face, a.hp, (a.alive ? 1 : 0) | (a.air ? 2 : 0) | (a.moving ? 4 : 0), a.hit, a.squash, a.crouch, r2(a.slide), a.walkT]),
    pj: w.projs.map((p) => [KINDS.indexOf(p.kind), r1(p.x), r1(p.y), r2(p.vx), r2(p.vy), p.t]),
    gl: w.gull ? [r1(w.gull.x), w.gull.y, w.gull.dir, Math.round(w.gull.tx), w.gull.dropped] : null,
    wl: w.water,
    mv: Math.round(w.move),
    am: w.ammo.map((a) => WEAPONS.map((x) => a[x.id])),
    cr: w.crates.map((c) => [c.id, CRATE_KINDS.indexOf(c.kind), r1(c.x), r1(c.y), c.air ? 1 : 0]),
    cs,
    c,
    fx,
  }
}

const setAnimal = (a: Animal, row: AnimalRow) => {
  ;[a.x, a.y, a.vx, a.vy, a.face, a.hp] = row
  a.alive = (row[6] & 1) === 1
  a.air = (row[6] & 2) === 2
  a.moving = (row[6] & 4) === 4
  ;[a.hit, a.squash, a.crouch, a.slide, a.walkT] = [row[7], row[8], row[9], row[10], row[11]]
}

/** 거울 World에 상태를 덮어씀. prev가 있으면 위치를 그 사이로 (k = 0 → prev, 1 → snap) */
export function applySnap(w: World, s: Snap, prev: Snap | null, k: number) {
  const lerp = (a: number, b: number) => a + (b - a) * k
  w.turnNo = s.n
  w.phase = s.ph
  w.timer = s.tm
  w.wind = s.wd
  w.team = s.team
  w.weapon = s.wp
  w.aim = s.aim
  w.charging = s.ch >= 0
  w.chargeT = Math.max(0, s.ch)
  w.target = s.tg
  w.winner = s.win
  w.hammerT = s.hm
  w.rodLine = s.rod ? { x: s.rod[0], y: s.rod[1], t: 0 } : null
  s.an.forEach((row, i) => {
    const a = w.animals[i]
    if (!a) return
    setAnimal(a, row)
    const p = prev?.an[i]
    if (p && k < 1) {
      a.x = lerp(p[0], row[0])
      a.y = lerp(p[1], row[1])
    }
  })
  w.active = w.animals.find((a) => a.id === s.act) ?? w.animals[0]
  const same = prev && prev.pj.length === s.pj.length && prev.pj.every((p, i) => p[0] === s.pj[i][0])
  // 그림이 날아가는 공마다 꼬리를 이어 그릴 수 있게 같은 물건을 계속 씀
  w.projs = s.pj.map((row, i) => {
    const old = w.projs[i]
    const p: Proj = old && old.kind === KINDS[row[0]] ? old : { kind: KINDS[row[0]] ?? 'balloon', x: 0, y: 0, vx: 0, vy: 0, t: 0, owner: -1, dead: false }
    p.kind = KINDS[row[0]] ?? 'balloon'
    ;[, p.x, p.y, p.vx, p.vy, p.t] = row
    if (same && prev && k < 1) {
      p.x = lerp(prev.pj[i][1], row[1])
      p.y = lerp(prev.pj[i][2], row[2])
    }
    return p
  })
  w.water = s.wl ?? w.water
  w.move = s.mv ?? w.move
  s.am?.forEach((row, t) => {
    if (w.ammo[t]) WEAPONS.forEach((x, i) => (w.ammo[t][x.id] = row[i] ?? -1))
  })
  w.crates = (s.cr ?? []).map(([id, kind, x, y, air]) => {
    const p = prev?.cr?.find((c) => c[0] === id)
    return { id, kind: CRATE_KINDS[kind] ?? 'heal', x, y: p && k < 1 ? lerp(p[3], y) : y, vy: 0, air: air === 1 }
  })
  w.gull = s.gl ? { x: s.gl[0], y: s.gl[1], dir: s.gl[2], tx: s.gl[3], dropped: s.gl[4] } : null
  if (w.gull && prev?.gl && k < 1) w.gull.x = lerp(prev.gl[0], s.gl![0])
}

// 서버가 받는 입력 검사
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
export const clampAim = (a: unknown) => (isNum(a) ? Math.max(-60, Math.min(88, a)) : null)
export const clampPower = (p: unknown) => (isNum(p) ? Math.max(0, Math.min(1, p)) : null)
export const clampTarget = (x: unknown) => (isNum(x) ? Math.max(20, Math.min(W - 20, x)) : null)
export const isWeapon = (w: unknown): w is WeaponId => WEAPONS.some((x) => x.id === w)
