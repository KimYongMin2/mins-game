import { type Rng, createRng } from '../../../shared/random'

// 다른 그림 찾기 그림 만들기 (사용자 요청 2026-11-23, 시안 https://claude.ai/artifact/SyjcXBvJ2Qb7wFxmLxUbJK).
// 씨앗값 하나로 장면(바닷가·방·공원·바닷속·겨울·부엌·캠핑)에 물건을 무작위로 놓고, 오른쪽 그림에서 7곳을 바꾼다.
// 같은 씨앗값이면 폰·서버 어디서나 같은 그림·같은 정답 자리 (서버 심판이 이 파일로 판정).
// 좌표는 그림 한 장 400×300.

export const W = 400
export const H = 300
export const DIFFS = 7

export type DiffKind = 'color' | 'detail' | 'flip' | 'size' | 'remove' | 'add'
type Zone = 'sky' | 'wall' | 'swim' | 'sea' | 'ground'
export type Obj = { id: number; t: string; x: number; y: number; s: number; f: 1 | -1; d: boolean; c: string; c2?: string; hidden?: boolean }
type Thing = {
  z: Zone
  ground?: boolean
  max?: number
  dy?: number
  r: number
  sz: [number, number]
  colors?: string[]
  diffs: Exclude<DiffKind, 'add'>[]
  flip?: boolean
  need?: Partial<Record<DiffKind, (o: Obj) => boolean>>
  init?: (o: Obj, r: Rng) => void
  draw: (o: Obj) => string
}
type Theme = {
  name: string
  zones: Partial<Record<Zone, { x: [number, number]; y: [number, number] }>>
  items: [string, number, number][]
  adds: string[]
  bg: (id: string) => string
}
export type Diff = { kind: DiffKind; x: number; y: number; r: number }
export type Scene = { theme: string; left: Obj[]; right: Obj[]; diffs: Diff[] }

const INK = '#1c1748'
const P = { red:'#e8483b', orange:'#f28c28', yellow:'#ffd23f', green:'#43b05c', sky:'#5bc8f0', blue:'#3b6fe0', purple:'#8e5bd8', pink:'#f27aa8', brown:'#a0643c', white:'#ffffff', teal:'#22b3a6', gray:'#9aa0a6', tan:'#e2b071' }

const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r.next() * arr.length)]
const between = (r: Rng, a: number, b: number) => a + r.next() * (b - a)
function shuffle<T>(r: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
function star(cx: number, cy: number, ro: number, ri: number) {
  let s = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? ri : ro
    s += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1)
  }
  return s + 'Z'
}

/* 물건: z 놓을 곳, dy 맞히는 원 중심(바닥 기준), r 맞히는 원 반지름, diffs 바꿀 수 있는 방법 */
/* eslint-disable */
// prettier-ignore
export const THINGS: Record<string, Thing> = {
  cloud: { z:'sky', r:26, sz:[.8,1.25], diffs:['size','remove','detail'], flip:true,
    draw:o => `<g stroke="none" fill="#fff"><ellipse cx="-12" cy="3" rx="14" ry="10"/><ellipse cx="5" cy="-4" rx="16" ry="13"/><ellipse cx="19" cy="4" rx="11" ry="8"/><rect x="-24" y="2" width="52" height="10" rx="5"/>${o.d ? '<ellipse cx="-27" cy="7" rx="10" ry="7"/><ellipse cx="-30" cy="-1" rx="7" ry="6"/>' : ''}</g>` },
  sun: { z:'sky', max:1, r:28, sz:[1,1.1], colors:[P.yellow, P.orange], diffs:['color','detail','size'],
    draw:o => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += `<line x1="${(19*Math.cos(a)).toFixed(1)}" y1="${(19*Math.sin(a)).toFixed(1)}" x2="${(27*Math.cos(a)).toFixed(1)}" y2="${(27*Math.sin(a)).toFixed(1)}" stroke="${o.c}" stroke-width="3.5"/>`; }
      return s + `<circle r="16" fill="${o.c}"/>` + (o.d ? `<circle cx="-5" cy="-3" r="1.8" fill="${INK}" stroke="none"/><circle cx="5" cy="-3" r="1.8" fill="${INK}" stroke="none"/><path d="M-6 4 Q0 10 6 4" fill="none"/>` : ''); } },
  seagull: { z:'sky', r:14, sz:[.8,1.2], diffs:['remove','flip','size'], flip:true,
    draw:() => `<path d="M-14 0 Q-7 -9 0 0 Q5 -6 12 -3" fill="none" stroke-width="2.6"/>` },
  boat: { z:'sea', ground:true, dy:-22, r:25, sz:[.8,1.05], colors:[P.red, P.blue, P.teal, P.orange, P.purple], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<line x1="-2" y1="-10" x2="-2" y2="-46"/><path d="M0 -44 L0 -14 L20 -14 Z" fill="#fff"/>${o.d ? `<path d="M-2 -46 L-14 -42 L-2 -38 Z" fill="${P.yellow}"/>` : ''}<path d="M-24 -12 L24 -12 L17 0 L-17 0 Z" fill="${o.c}"/>` },
  umbrella: { z:'ground', ground:true, dy:-34, r:30, sz:[.85,1.05], colors:[P.red, P.blue, P.green, P.purple, P.orange, P.pink], diffs:['color','detail','remove','size'],
    draw:o => `<rect x="-1.5" y="-50" width="3" height="50" fill="${P.brown}"/><path d="M-30 -42 Q0 -76 30 -42 Q15 -48 0 -42 Q-15 -48 -30 -42 Z" fill="${o.c}"/>${o.d ? '<path d="M0 -59 L-9 -44.5 Q-4 -46 0 -42 Q4 -46 9 -44.5 Z" fill="#fff"/>' : ''}` },
  palm: { z:'ground', ground:true, dy:-48, r:34, sz:[.85,1.1], diffs:['flip','detail','remove','size'], flip:true,
    draw:o => { let s = `<path d="M-4 0 Q6 -34 -2 -64 L4 -64 Q12 -34 4 0 Z" fill="${P.brown}"/>`;
      for (const a of [-170, -135, -95, -45, -8]) s += `<path d="M0 0 Q14 -10 32 3 Q14 -2 0 0 Z" fill="${P.green}" transform="translate(1 -64) rotate(${a})"/>`;
      return s + (o.d ? `<circle cx="-3" cy="-59" r="4" fill="#7a4a26"/><circle cx="5" cy="-58" r="4" fill="#7a4a26"/>` : ''); } },
  ball: { z:'ground', ground:true, dy:-11, r:13, sz:[.8,1.05], colors:[P.red, P.blue, P.yellow, P.green, P.purple, P.orange], diffs:['color','remove','size'],
    draw:o => `<circle cx="0" cy="-11" r="11" fill="${o.c}"/><path d="M-11 -11 Q0 -3 11 -11 Q0 -19 -11 -11 Z" fill="#fff"/>` },
  crab: { z:'ground', ground:true, dy:-14, r:20, sz:[.85,1.05], colors:[P.red, P.orange, P.purple], diffs:['color','detail','remove'],
    draw:o => { const cy = o.d ? -27 : -19; return `<path d="M-10 -6 L-18 0 M-8 -3 L-14 3 M10 -6 L18 0 M8 -3 L14 3 M-11 -10 L-16 ${cy+3} M11 -10 L16 ${cy+3} M-4 -14 V-18 M4 -14 V-18" fill="none"/><circle cx="-17" cy="${cy}" r="5" fill="${o.c}"/><circle cx="17" cy="${cy}" r="5" fill="${o.c}"/><ellipse cx="0" cy="-9" rx="13" ry="8" fill="${o.c}"/><circle cx="-4" cy="-19" r="2.6" fill="#fff"/><circle cx="4" cy="-19" r="2.6" fill="#fff"/><circle cx="-4" cy="-19" r="1.1" fill="${INK}" stroke="none"/><circle cx="4" cy="-19" r="1.1" fill="${INK}" stroke="none"/>`; } },
  bucket: { z:'ground', ground:true, dy:-16, r:18, sz:[.85,1.05], colors:[P.blue, P.red, P.yellow, P.green, P.pink], diffs:['color','detail','remove'], flip:true,
    draw:o => `${o.d ? `<path d="M5 -22 L15 -40" fill="none" stroke-width="2.6"/><path d="M11 -45 L21 -39 L17 -34 L9 -39 Z" fill="${P.orange}"/>` : ''}<path d="M-12 -22 Q0 -36 12 -22" fill="none"/><path d="M-12 -22 L12 -22 L9 0 L-9 0 Z" fill="${o.c}"/>` },
  starfish: { z:'ground', ground:true, dy:-8, r:13, sz:[.85,1.1], colors:[P.orange, P.pink, P.red, P.yellow, P.purple], diffs:['color','size','remove'],
    draw:o => `<path d="${star(0, -8, 12, 5.5)}" fill="${o.c}"/>` },
  castle: { z:'ground', ground:true, dy:-22, r:26, sz:[.9,1.05], diffs:['detail','remove','size'], flip:true,
    draw:o => { const s = '#e9c37a'; return `${o.d ? `<line x1="16" y1="-38" x2="16" y2="-52"/><path d="M16 -52 L27 -48 L16 -44 Z" fill="${P.red}"/>` : ''}<rect x="-22" y="-34" width="12" height="34" fill="${s}"/><rect x="10" y="-34" width="12" height="34" fill="${s}"/><rect x="-22" y="-38" width="4" height="4" fill="${s}"/><rect x="-14" y="-38" width="4" height="4" fill="${s}"/><rect x="10" y="-38" width="4" height="4" fill="${s}"/><rect x="18" y="-38" width="4" height="4" fill="${s}"/><rect x="-12" y="-22" width="24" height="22" fill="${s}"/><path d="M-5 0 V-9 Q0 -15 5 -9 V0 Z" fill="#8a6430"/>`; } },

  window: { z:'wall', max:2, r:31, sz:[.9,1.05], colors:[P.pink, P.red, P.green, P.purple, P.yellow], diffs:['detail','color','remove'], need:{ color:o => o.d },
    draw:o => `<rect x="-26" y="-22" width="52" height="44" fill="#fff"/><rect x="-22" y="-18" width="44" height="36" fill="#bfeaff"/><line x1="0" y1="-18" x2="0" y2="18"/><line x1="-22" y1="0" x2="22" y2="0"/><rect x="-30" y="22" width="60" height="5" fill="#fff"/>${o.d ? `<path d="M-30 -25 H-15 Q-19 0 -10 20 H-30 Z" fill="${o.c}"/><path d="M30 -25 H15 Q19 0 10 20 H30 Z" fill="${o.c}"/>` : ''}` },
  frame: { z:'wall', r:24, sz:[.9,1.1], colors:[P.red, P.blue, P.yellow, P.green, P.purple, P.brown], diffs:['color','detail','remove'],
    draw:o => `<rect x="-20" y="-16" width="40" height="32" fill="${o.c}"/><rect x="-15" y="-11" width="30" height="22" fill="#d9f3ff"/><path d="M-15 11 L-5 -3 L2 5 L7 0 L15 11 Z" fill="${P.green}"/>${o.d ? `<circle cx="8" cy="-5" r="3.5" fill="${P.yellow}"/>` : ''}` },
  clock: { z:'wall', max:1, r:20, sz:[.95,1.1], colors:[P.red, P.blue, P.green, P.orange, P.purple], diffs:['detail','color','remove'],
    draw:o => `<circle r="18" fill="${o.c}"/><circle r="14" fill="#fff"/><line x1="0" y1="0" x2="0" y2="-10" stroke-width="2.4"/><line x1="0" y1="0" x2="${o.d ? 7 : -7}" y2="4" stroke-width="3"/><circle r="2" fill="${INK}"/>` },
  books: { z:'wall', r:28, sz:[.9,1.05], colors:[P.red, P.green, P.purple, P.orange, P.yellow, P.teal], diffs:['color','detail','remove'],
    draw:o => `<rect x="-24" y="-12" width="8" height="22" fill="${P.blue}"/><rect x="-15" y="-16" width="9" height="26" fill="${o.c}"/><rect x="-5" y="-10" width="7" height="20" fill="${P.green === o.c ? P.pink : P.green}"/>${o.d ? `<rect x="3" y="-14" width="8" height="24" fill="${P.red === o.c ? P.yellow : P.red}"/>` : ''}<rect x="-28" y="10" width="56" height="5" fill="${P.brown}"/>` },
  lamp: { z:'ground', ground:true, dy:-36, r:28, sz:[.9,1.05], colors:[P.yellow, P.red, P.blue, P.green, P.pink, P.teal], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<ellipse cx="0" cy="-2" rx="12" ry="3.5" fill="${INK}"/><path d="M0 -2 V-58 L10 -64" fill="none" stroke-width="2.6"/>${o.d ? '<path d="M6 -56 L-6 -24 L36 -24 L24 -56 Z" fill="#fff6a8" stroke="none" opacity=".8"/>' : ''}<path d="M4 -72 L24 -72 L30 -56 L-2 -56 Z" fill="${o.c}"/>` },
  plant: { z:'ground', ground:true, dy:-26, r:24, sz:[.85,1.1], colors:[P.orange, P.blue, P.red, P.purple, P.teal, P.yellow], diffs:['color','detail','remove','size'],
    draw:o => `<path d="M0 -20 Q-18 -30 -16 -44 Q-4 -36 0 -20 Z" fill="${P.green}"/><path d="M0 -20 Q16 -34 12 -48 Q2 -38 0 -20 Z" fill="${P.green}"/><path d="M0 -20 Q-2 -40 4 -52 Q8 -36 0 -20 Z" fill="#2f9447"/>${o.d ? `<circle cx="4" cy="-53" r="5.5" fill="${P.pink}"/><circle cx="4" cy="-53" r="2" fill="${P.yellow}"/>` : ''}<path d="M-12 -20 L12 -20 L9 0 L-9 0 Z" fill="${o.c}"/>` },
  chair: { z:'ground', ground:true, dy:-24, r:22, sz:[.85,1.05], colors:[P.red, P.blue, P.green, P.yellow, P.purple, P.teal], diffs:['color','flip','remove'], flip:true,
    draw:o => `<rect x="-14" y="-20" width="3" height="20" fill="${P.brown}"/><rect x="11" y="-20" width="3" height="20" fill="${P.brown}"/><rect x="-15" y="-48" width="5" height="28" fill="${o.c}"/><rect x="-15" y="-48" width="16" height="5" fill="${o.c}"/><rect x="-16" y="-22" width="32" height="5" fill="${o.c}"/>` },
  cat: { z:'ground', ground:true, dy:-24, r:22, sz:[.85,1.05], colors:[P.orange, P.gray, P.white, P.brown, '#3a3a44'], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<path d="M10 -6 Q27 -10 20 -30" fill="none" stroke="${INK}" stroke-width="6"/><path d="M10 -6 Q27 -10 20 -30" fill="none" stroke="${o.c}" stroke-width="3"/><ellipse cx="0" cy="-13" rx="12" ry="13" fill="${o.c}"/><path d="M-9 -37 L-7 -47 L-2 -41 Z M9 -37 L7 -47 L2 -41 Z" fill="${o.c}"/><circle cx="0" cy="-32" r="10" fill="${o.c}"/>${o.d ? '<path d="M-7 -22 Q0 -19 7 -22 M-9 -15 Q0 -12 9 -15 M-9 -8 Q0 -5 9 -8" fill="none" stroke-width="1.6" opacity=".7"/>' : ''}<circle cx="-3.5" cy="-33" r="1.5" fill="${INK}" stroke="none"/><circle cx="3.5" cy="-33" r="1.5" fill="${INK}" stroke="none"/><path d="M-1.5 -29 L1.5 -29 L0 -27.5 Z" fill="${P.pink}" stroke-width="1"/>` },
  table: { z:'ground', ground:true, dy:-26, r:28, sz:[.9,1.05], colors:[P.red, P.blue, P.yellow, P.green, P.white, P.pink], diffs:['color','detail','flip','remove'], flip:true,
    draw:o => `<rect x="-22" y="-30" width="4" height="30" fill="${P.brown}"/><rect x="18" y="-30" width="4" height="30" fill="${P.brown}"/><rect x="-28" y="-34" width="56" height="5" fill="#c07a44"/>${o.d ? '<path d="M9 -50 Q7 -54 10 -57 Q13 -60 11 -63 M14 -50 Q12 -54 15 -57 Q18 -60 16 -63" fill="none" stroke="#c9ccd6" stroke-width="2"/>' : ''}<path d="M17 -43 Q23 -40 17 -37" fill="none"/><rect x="6" y="-46" width="11" height="12" fill="${o.c}"/>` },

  house: { z:'ground', ground:true, dy:-30, r:34, sz:[.9,1.05], colors:[P.yellow, '#f6efe0', P.pink, P.sky, P.orange], diffs:['color','flip','detail','remove'], flip:true,
    init:(o, r) => { o.c2 = pick(r, [P.red, P.blue, P.brown, P.purple]); },
    draw:o => `${o.d ? `<rect x="8" y="-58" width="7" height="16" fill="${P.brown}"/>` : ''}<path d="M-29 -34 L0 -57 L29 -34 Z" fill="${o.c2}"/><rect x="-22" y="-34" width="44" height="34" fill="${o.c}"/><rect x="-14" y="-18" width="10" height="18" fill="${P.brown}"/><rect x="4" y="-26" width="12" height="10" fill="#bfeaff"/><path d="M10 -26 V-16 M4 -21 H16" fill="none" stroke-width="1.4"/>` },
  tree: { z:'ground', ground:true, dy:-40, r:30, sz:[.85,1.2], diffs:['detail','size','remove','flip'], flip:true,
    draw:o => `<rect x="-4" y="-30" width="8" height="30" fill="${P.brown}"/><g stroke="none" fill="${INK}"><circle cx="0" cy="-48" r="19.5"/><circle cx="-14" cy="-37" r="13.5"/><circle cx="13" cy="-39" r="14.5"/></g><g stroke="none" fill="${P.green}"><circle cx="0" cy="-48" r="18"/><circle cx="-14" cy="-37" r="12"/><circle cx="13" cy="-39" r="13"/></g>${o.d ? `<g fill="${P.red}" stroke-width="1.2"><circle cx="-8" cy="-46" r="3"/><circle cx="6" cy="-54" r="3"/><circle cx="11" cy="-37" r="3"/><circle cx="-15" cy="-34" r="3"/></g>` : ''}` },
  flower: { z:'ground', ground:true, dy:-16, r:13, sz:[.85,1.1], colors:[P.red, P.pink, P.yellow, P.purple, P.orange, P.white, P.blue], diffs:['color','detail','remove','size'],
    draw:o => { let s = `<path d="M0 0 V-18" fill="none" stroke="${P.green}" stroke-width="2.6"/>` + (o.d ? `<path d="M0 -6 Q8 -13 11 -7 Q6 -3 0 -6 Z" fill="${P.green}" stroke-width="1.2"/>` : '');
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; s += `<circle cx="${(5.5*Math.cos(a)).toFixed(1)}" cy="${(-22 + 5.5*Math.sin(a)).toFixed(1)}" r="4.5" fill="${o.c}" stroke-width="1.3"/>`; }
      return s + `<circle cx="0" cy="-22" r="3" fill="${o.c === P.yellow ? P.orange : P.yellow}" stroke-width="1.3"/>`; } },
  bench: { z:'ground', ground:true, dy:-16, r:26, sz:[.9,1.05], colors:[P.brown, P.red, P.blue, P.green], diffs:['color','remove'],
    draw:o => `<rect x="-20" y="-12" width="3" height="12" fill="${INK}"/><rect x="17" y="-12" width="3" height="12" fill="${INK}"/><rect x="-20" y="-28" width="3" height="16" fill="${INK}"/><rect x="17" y="-28" width="3" height="16" fill="${INK}"/><rect x="-25" y="-15" width="50" height="4" fill="${o.c}"/><rect x="-25" y="-28" width="50" height="4" fill="${o.c}"/><rect x="-25" y="-22" width="50" height="4" fill="${o.c}"/>` },
  balloon: { z:'sky', r:18, sz:[.9,1.1], colors:[P.red, P.blue, P.yellow, P.green, P.purple, P.pink, P.orange], diffs:['color','detail','remove'], flip:true,
    draw:o => `${o.d ? `<path d="M12 6 Q8 18 2 30" fill="none" stroke-width="1.3"/><ellipse cx="12" cy="-6" rx="8" ry="10" fill="${o.c === P.yellow ? P.pink : P.yellow}"/>` : ''}<path d="M0 12 Q-4 22 2 30" fill="none" stroke-width="1.3"/><ellipse cx="0" cy="0" rx="10" ry="12" fill="${o.c}"/><path d="M-2 13 L2 13 L0 10 Z" fill="${o.c}"/>` },
  bird: { z:'sky', r:12, sz:[.9,1.15], colors:[P.blue, P.red, P.yellow, P.teal, P.orange], diffs:['color','flip','remove'], flip:true,
    draw:o => `<circle r="8" fill="${o.c}"/><path d="M-3 -1 Q-10 -9 -13 2 Q-6 2 -3 -1 Z" fill="${o.c}"/><path d="M7 -2 L13 0 L7 2 Z" fill="#ffb02e" stroke-width="1.2"/><circle cx="3" cy="-2.5" r="1.4" fill="${INK}" stroke="none"/>` },
  dog: { z:'ground', ground:true, dy:-16, r:22, sz:[.85,1.05], colors:[P.brown, P.white, P.tan, P.gray], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<path d="M-14 -16 Q-22 -22 -19 -30" fill="none" stroke-width="2.6"/><rect x="-11" y="-10" width="4" height="10" fill="${o.c}"/><rect x="7" y="-10" width="4" height="10" fill="${o.c}"/><ellipse cx="0" cy="-14" rx="15" ry="8" fill="${o.c}"/>${o.d ? '<circle cx="-4" cy="-15" r="4" fill="#4a3426" stroke="none"/>' : ''}<circle cx="14" cy="-24" r="8" fill="${o.c}"/><ellipse cx="11" cy="-25" rx="3" ry="6.5" fill="#6b4a2e"/><circle cx="17" cy="-26" r="1.4" fill="${INK}" stroke="none"/><circle cx="22" cy="-22" r="1.8" fill="${INK}" stroke="none"/>` },
  mushroom: { z:'ground', ground:true, dy:-12, r:14, sz:[.85,1.15], colors:[P.red, P.orange, P.purple, P.blue, P.brown], diffs:['color','detail','remove','size'],
    draw:o => `<rect x="-4" y="-11" width="8" height="11" fill="#fff6e8"/><path d="M-13 -9 Q0 -30 13 -9 Z" fill="${o.c}"/>${o.d ? '<g fill="#fff" stroke="none"><circle cx="-5" cy="-15" r="2.2"/><circle cx="4" cy="-18" r="2.4"/><circle cx="7" cy="-12" r="1.8"/></g>' : ''}` },
  fish: { z:'swim', r:16, sz:[.8,1.25], colors:[P.orange, P.yellow, P.red, P.blue, P.purple, P.teal, P.pink], diffs:['color','flip','detail','remove','size'], flip:true,
    draw:o => `<path d="M-10 0 L-21 -9 L-21 9 Z" fill="${o.c}"/><ellipse cx="2" cy="0" rx="13" ry="9" fill="${o.c}"/>${o.d ? '<path d="M-2 -8 Q-5 0 -2 8" fill="none" stroke="#fff" stroke-width="2.6"/>' : ''}<circle cx="8" cy="-2" r="2.2" fill="#fff" stroke-width="1"/><circle cx="8.6" cy="-2" r="1" fill="${INK}" stroke="none"/>` },
  jelly: { z:'swim', dy:4, r:18, sz:[.85,1.15], colors:[P.pink, P.purple, P.sky, P.orange], diffs:['color','detail','remove','size'],
    draw:o => `<path d="M-8 2 q-3 6 0 12 t0 10 M0 2 q3 6 0 12 t0 10 M8 2 q-3 6 0 12 t0 10" fill="none" stroke-width="1.6"/><path d="M-13 2 Q-13 -16 0 -16 Q13 -16 13 2 Z" fill="${o.c}"/>${o.d ? '<g fill="#fff" stroke="none" opacity=".85"><circle cx="-5" cy="-7" r="2.2"/><circle cx="4" cy="-10" r="1.8"/><circle cx="6" cy="-3" r="1.6"/></g>' : ''}` },
  bubble: { z:'swim', dy:-10, r:13, sz:[.8,1.3], diffs:['remove','detail','size'],
    draw:o => `<g fill="#dff6ff" fill-opacity=".45" stroke="#fff" stroke-width="1.6"><circle r="6"/><circle cx="5" cy="-11" r="4"/><circle cx="-2" cy="-19" r="3"/>${o.d ? '<circle cx="6" cy="-26" r="2.5"/>' : ''}</g>` },
  turtle: { z:'swim', r:22, sz:[.9,1.1], colors:[P.green, P.teal, P.brown], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<g fill="#9ccc65"><ellipse cx="-11" cy="-10" rx="7" ry="3.5" transform="rotate(-30 -11 -10)"/><ellipse cx="11" cy="-10" rx="7" ry="3.5" transform="rotate(30 11 -10)"/><ellipse cx="-11" cy="10" rx="6" ry="3" transform="rotate(30 -11 10)"/><ellipse cx="11" cy="10" rx="6" ry="3" transform="rotate(-30 11 10)"/><circle cx="19" cy="-1" r="6"/></g><circle cx="21" cy="-3" r="1.2" fill="${INK}" stroke="none"/><ellipse cx="0" cy="0" rx="16" ry="11" fill="${o.c}"/>${o.d ? '<path d="M-7 -4 L0 -7 L7 -4 L7 4 L0 7 L-7 4 Z M-7 -4 L-14 -2 M7 -4 L14 -2 M-7 4 L-14 2 M7 4 L14 2" fill="none" stroke-width="1.3"/>' : ''}` },
  coral: { z:'ground', ground:true, dy:-18, r:18, sz:[.85,1.2], colors:[P.pink, P.orange, P.red, P.purple], diffs:['color','flip','size','remove'], flip:true,
    draw:o => { const p = 'M-2 0 L-2 -14 L-10 -22 M-2 -14 L6 -26 M2 -6 L12 -16 L12 -28 M-2 -14 L-4 -33'; return `<path d="${p}" fill="none" stroke="${INK}" stroke-width="8"/><path d="${p}" fill="none" stroke="${o.c}" stroke-width="5"/>`; } },
  seaweed: { z:'ground', ground:true, dy:-24, r:16, sz:[.8,1.25], diffs:['flip','size','remove'], flip:true,
    draw:() => { const p = 'M0 0 Q-8 -12 0 -24 T0 -48 M6 0 Q12 -10 6 -20 T8 -36'; return `<path d="${p}" fill="none" stroke="${INK}" stroke-width="7.5"/><path d="${p}" fill="none" stroke="${P.green}" stroke-width="4.5"/>`; } },
  shell: { z:'ground', ground:true, dy:-9, r:12, sz:[.85,1.15], colors:[P.pink, P.white, P.tan, P.orange], diffs:['color','size','remove'],
    draw:o => `<path d="M0 0 L-12 -10 Q0 -23 12 -10 Z" fill="${o.c}"/><path d="M0 0 L-6 -15 M0 0 L0 -16 M0 0 L6 -15" fill="none" stroke-width="1.3"/>` },
  chest: { z:'ground', ground:true, dy:-16, r:20, sz:[.9,1.05], colors:[P.brown, '#7a4a26', P.red], diffs:['color','detail','remove'],
    draw:o => `${o.d ? `<path d="M-16 -17 L-14 -32 Q2 -38 16 -30 L16 -17 Z" fill="${o.c}"/><g fill="${P.yellow}" stroke-width="1.2"><circle cx="-8" cy="-18" r="4"/><circle cx="0" cy="-21" r="4"/><circle cx="8" cy="-18" r="4"/></g>` : `<path d="M-16 -16 Q0 -30 16 -16 Z" fill="${o.c}"/>`}<rect x="-16" y="-16" width="32" height="16" fill="${o.c}"/><rect x="-3" y="-14" width="6" height="6" fill="${P.yellow}"/>` },
  octopus: { z:'swim', r:20, sz:[.85,1.1], colors:[P.red, P.purple, P.orange, P.pink], diffs:['color','detail','remove','size'],
    draw:o => { const p = 'M-10 4 q-7 8 -2 16 M-4 6 q-3 9 0 16 M4 6 q3 9 0 16 M10 4 q7 8 2 16'; return `<path d="${p}" fill="none" stroke="${INK}" stroke-width="6.5"/><path d="${p}" fill="none" stroke="${o.c}" stroke-width="3.8"/><ellipse cx="0" cy="-6" rx="13" ry="14" fill="${o.c}"/>${o.d ? '<g fill="#fff" stroke="none" opacity=".55"><circle cx="-6" cy="-13" r="2.4"/><circle cx="5" cy="-15" r="2"/><circle cx="8" cy="-8" r="1.6"/></g>' : ''}<circle cx="-4.5" cy="-4" r="2.6" fill="#fff" stroke-width="1"/><circle cx="4.5" cy="-4" r="2.6" fill="#fff" stroke-width="1"/><circle cx="-4.5" cy="-4" r="1.1" fill="${INK}" stroke="none"/><circle cx="4.5" cy="-4" r="1.1" fill="${INK}" stroke="none"/>`; } },

  snowman: { z:'ground', ground:true, dy:-26, r:24, sz:[.9,1.1], colors:[P.red, P.blue, P.green, P.purple, P.orange], diffs:['color','detail','flip','remove'], flip:true,
    draw:o => `<circle cx="0" cy="-12" r="12" fill="#fff"/><circle cx="0" cy="-33" r="9" fill="#fff"/><rect x="-9" y="-26" width="18" height="4" fill="${o.c}"/><rect x="3" y="-25" width="4" height="10" fill="${o.c}"/><rect x="-7" y="-50" width="14" height="9" fill="${INK}"/><rect x="-10" y="-42" width="20" height="2.5" fill="${INK}"/><path d="M1 -33 L10 -31 L1 -30 Z" fill="${P.orange}" stroke-width="1"/><circle cx="-3" cy="-36" r="1.2" fill="${INK}" stroke="none"/><circle cx="3" cy="-36" r="1.2" fill="${INK}" stroke="none"/>${o.d ? `<g fill="${INK}" stroke="none"><circle cx="0" cy="-17" r="1.5"/><circle cx="0" cy="-11" r="1.5"/><circle cx="0" cy="-5" r="1.5"/></g>` : ''}` },
  pine: { z:'ground', ground:true, dy:-32, r:24, sz:[.85,1.25], diffs:['detail','size','remove'],
    draw:o => `<rect x="-3.5" y="-8" width="7" height="8" fill="${P.brown}"/><path d="M0 -36 L-23 -8 L23 -8 Z" fill="#2f8f4e"/><path d="M0 -50 L-19 -24 L19 -24 Z" fill="#37a058"/><path d="M0 -62 L-14 -40 L14 -40 Z" fill="#43b05c"/><path d="M0 -62 L-5 -55 L5 -55 Z" fill="#fff" stroke-width="1.2"/>${o.d ? `<path d="${star(0, -64, 6, 2.6)}" fill="${P.yellow}" stroke-width="1.3"/>` : ''}` },
  sled: { z:'ground', ground:true, dy:-8, r:20, sz:[.9,1.05], colors:[P.red, P.blue, P.green, P.orange], diffs:['color','flip','remove'], flip:true,
    draw:o => `<path d="M-18 0 H14 Q20 0 20 -6 M-12 0 V-7 M8 0 V-7" fill="none" stroke-width="2.4"/><rect x="-16" y="-12" width="28" height="6" fill="${o.c}"/>` },
  penguin: { z:'ground', ground:true, dy:-16, r:16, sz:[.85,1.1], diffs:['flip','detail','remove','size'], flip:true,
    draw:o => `<path d="M-6 0 L-1 0 M2 0 L7 0" stroke="${P.orange}" stroke-width="3"/><ellipse cx="0" cy="-15" rx="10" ry="15" fill="#2b2b3a"/><ellipse cx="2" cy="-12" rx="6" ry="10" fill="#fff" stroke="none"/><path d="M8 -22 L14 -20 L8 -18 Z" fill="${P.orange}" stroke-width="1"/><circle cx="4" cy="-23" r="1.6" fill="#fff" stroke="none"/>${o.d ? `<rect x="-9" y="-19" width="18" height="3.5" fill="${P.red}" stroke-width="1.2"/>` : ''}` },
  present: { z:'ground', ground:true, dy:-11, r:14, sz:[.85,1.15], colors:[P.red, P.blue, P.green, P.purple, P.pink, P.yellow], diffs:['color','detail','remove','size'],
    draw:o => `<rect x="-11" y="-20" width="22" height="20" fill="${o.c}"/><rect x="-2" y="-20" width="4" height="20" fill="#fff" stroke-width="1.2"/>${o.d ? '<path d="M0 -20 Q-10 -29 -6 -20 Z M0 -20 Q10 -29 6 -20 Z" fill="#fff" stroke-width="1.4"/>' : ''}` },
  snowflake: { z:'sky', r:10, sz:[.8,1.3], diffs:['size','remove'],
    draw:() => '<g stroke="#fff" stroke-width="2.2"><line x1="-8" y1="0" x2="8" y2="0"/><line x1="-4" y1="-7" x2="4" y2="7"/><line x1="-4" y1="7" x2="4" y2="-7"/></g>' },

  jars: { z:'wall', r:26, sz:[.9,1.05], colors:[P.red, P.orange, P.green, P.purple, P.yellow], diffs:['color','detail','remove'],
    draw:o => `<rect x="-22" y="-6" width="12" height="18" fill="#e9f6ff"/><rect x="-21" y="2" width="10" height="9" fill="${P.orange}" stroke="none"/><rect x="-23" y="-10" width="14" height="4" fill="${o.c}"/><rect x="-5" y="-2" width="11" height="14" fill="#e9f6ff"/><rect x="-4" y="5" width="9" height="6" fill="${P.green}" stroke="none"/><rect x="-6" y="-6" width="13" height="4" fill="${P.blue}"/>${o.d ? `<rect x="11" y="-4" width="10" height="16" fill="#e9f6ff"/><rect x="10" y="-8" width="12" height="4" fill="${P.red === o.c ? P.purple : P.red}"/>` : ''}<rect x="-26" y="12" width="52" height="4" fill="${P.brown}"/>` },
  pan: { z:'wall', r:20, sz:[.9,1.1], colors:['#3a3a44', P.red, P.blue, P.teal], diffs:['color','flip','remove'], flip:true,
    draw:o => `<line x1="24" y1="-12" x2="24" y2="-2"/><rect x="10" y="-2" width="18" height="4" fill="${P.brown}"/><circle r="12" fill="${o.c}"/><circle r="8" fill="#fff" fill-opacity=".15" stroke="none"/>` },
  fridge: { z:'ground', ground:true, dy:-40, r:30, sz:[.9,1], colors:[P.white, '#bde8df', '#f6c9d0', '#cfe3ff'], diffs:['color','detail','remove'],
    draw:o => `<rect x="-17" y="-80" width="34" height="80" rx="3" fill="${o.c}"/><line x1="-17" y1="-52" x2="17" y2="-52"/><rect x="10" y="-72" width="3" height="14" fill="#9aa0a6"/><rect x="10" y="-46" width="3" height="18" fill="#9aa0a6"/>${o.d ? `<rect x="-11" y="-74" width="10" height="12" fill="${P.yellow}" stroke-width="1.2"/><circle cx="-6" cy="-74" r="2.2" fill="${P.red}" stroke-width="1"/>` : ''}` },
  trash: { z:'ground', ground:true, dy:-14, r:16, sz:[.9,1.05], colors:[P.gray, P.green, P.blue, P.red], diffs:['color','detail','remove'],
    draw:o => `<path d="M-10 -24 L10 -24 L8 0 L-8 0 Z" fill="${o.c}"/><path d="M-4 -20 V-4 M4 -20 V-4" fill="none" stroke-width="1.3"/>${o.d ? `<rect x="-12" y="-28" width="24" height="4" fill="${o.c}" transform="rotate(-35 -12 -24)"/>` : `<rect x="-12" y="-28" width="24" height="4" fill="${o.c}"/>`}` },
  basket: { z:'ground', ground:true, dy:-13, r:18, sz:[.9,1.1], colors:[P.red, P.orange, P.green, P.purple], diffs:['color','detail','remove'],
    draw:o => `${o.d ? `<path d="M2 -14 Q12 -30 18 -22 Q10 -22 6 -12 Z" fill="${P.yellow}"/>` : ''}<g fill="${o.c}"><circle cx="-7" cy="-14" r="5.5"/><circle cx="3" cy="-15" r="5.5"/></g><path d="M-15 -12 L15 -12 L11 0 L-11 0 Z" fill="#c48a4a"/><path d="M-13 -6 H13" fill="none" stroke-width="1.2"/>` },

  moon: { z:'sky', max:1, r:22, sz:[1,1.1], colors:['#fff4b0', P.yellow], diffs:['color','detail','size','flip'], flip:true,
    draw:o => `<path d="M5 -15 A16 16 0 1 0 5 15 A18 18 0 0 1 5 -15 Z" fill="${o.c}"/>${o.d ? `<path d="${star(16, -12, 5, 2.2)}" fill="#ffe98a" stroke-width="1.2"/>` : ''}` },
  twinkle: { z:'sky', r:9, sz:[.7,1.35], diffs:['size','remove'],
    draw:() => `<path d="${star(0, 0, 7, 3)}" fill="#ffe98a" stroke-width="1.2"/>` },
  tent: { z:'ground', ground:true, dy:-20, r:28, sz:[.9,1.05], colors:[P.orange, P.red, P.green, P.blue, P.yellow], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `${o.d ? `<line x1="0" y1="-36" x2="0" y2="-48"/><path d="M0 -48 L10 -44 L0 -40 Z" fill="${P.yellow === o.c ? P.red : P.yellow}"/>` : ''}<path d="M-26 0 L0 -36 L26 0 Z" fill="${o.c}"/><path d="M-6 0 L0 -26 L5 0 Z" fill="#3a2a1a"/>` },
  fire: { z:'ground', ground:true, dy:-14, r:16, sz:[.9,1.2], diffs:['detail','size','remove'],
    draw:o => `<rect x="-14" y="-5" width="28" height="5" fill="${P.brown}" transform="rotate(12)"/><rect x="-14" y="-5" width="28" height="5" fill="${P.brown}" transform="rotate(-12)"/>${o.d ? '<path d="M7 -4 Q15 -10 11 -21 Q6 -12 3 -6 Z" fill="#ff8a1e"/>' : ''}<path d="M0 -4 Q-11 -14 -2 -30 Q0 -20 5 -22 Q12 -12 0 -4 Z" fill="#ff8a1e"/><path d="M0 -5 Q-5 -11 0 -19 Q5 -11 0 -5 Z" fill="${P.yellow}" stroke="none"/>` },
  lantern: { z:'ground', ground:true, dy:-14, r:14, sz:[.9,1.1], colors:[P.yellow, P.red, P.green, P.sky], diffs:['color','detail','remove'],
    draw:o => `${o.d ? `<circle cx="0" cy="-12" r="17" fill="${o.c}" opacity=".3" stroke="none"/>` : ''}<path d="M-5 -23 Q0 -31 5 -23" fill="none"/><rect x="-6" y="-20" width="12" height="16" fill="${o.c}"/><rect x="-7" y="-23" width="14" height="3" fill="${INK}"/><rect x="-7" y="-4" width="14" height="4" fill="${INK}"/>` },
  backpack: { z:'ground', ground:true, dy:-14, r:14, sz:[.9,1.05], colors:[P.red, P.blue, P.green, P.orange, P.purple], diffs:['color','detail','remove'],
    draw:o => `<rect x="-10" y="-26" width="20" height="26" rx="4" fill="${o.c}"/><path d="M-10 -18 Q0 -12 10 -18" fill="none"/>${o.d ? '<rect x="-6" y="-11" width="12" height="8" fill="#fff" fill-opacity=".45" stroke-width="1.3"/>' : ''}` },
  rabbit: { z:'ground', ground:true, dy:-16, r:16, sz:[.85,1.05], colors:[P.white, P.gray, P.tan], diffs:['color','flip','detail','remove'], flip:true,
    draw:o => `<circle cx="-10" cy="-11" r="3.5" fill="#fff"/><ellipse cx="0" cy="-10" rx="10" ry="9" fill="${o.c}"/><ellipse cx="6" cy="-33" rx="2.6" ry="7.5" fill="${o.c}"/><ellipse cx="11" cy="-32" rx="2.6" ry="7.5" fill="${o.c}" transform="rotate(18 11 -32)"/><circle cx="8" cy="-20" r="7" fill="${o.c}"/><circle cx="11" cy="-21" r="1.3" fill="${INK}" stroke="none"/>${o.d ? `<path d="M4 -26 L0 -29 L0 -23 Z M4 -26 L8 -29 L8 -23 Z" fill="${P.red}" stroke-width="1"/>` : ''}` },
  kite: { z:'sky', r:20, sz:[.9,1.1], colors:[P.red, P.blue, P.yellow, P.green, P.purple, P.pink], diffs:['color','detail','flip','remove'], flip:true,
    draw:o => `<path d="M0 20 q6 8 0 14 q-6 8 3 14" fill="none" stroke-width="1.4"/>${o.d ? `<g fill="${P.red === o.c ? P.yellow : P.red}" stroke-width="1"><path d="M2 26 L-3 24 L-3 29 Z"/><path d="M-1 40 L4 38 L4 43 Z"/></g>` : ''}<path d="M0 -16 L11 0 L0 20 L-11 0 Z" fill="${o.c}"/><path d="M0 -16 V20 M-11 0 H11" fill="none" stroke-width="1.2"/>` },
  surfboard: { z:'ground', ground:true, dy:-24, r:16, sz:[.9,1.1], colors:[P.red, P.blue, P.yellow, P.teal, P.pink, P.orange], diffs:['color','detail','remove','flip'], flip:true,
    draw:o => `<g transform="rotate(10 0 -24)"><ellipse cx="0" cy="-24" rx="7" ry="24" fill="${o.c}"/>${o.d ? '<path d="M-6.6 -30 H6.6 V-24 H-6.6 Z" fill="#fff" stroke="none"/>' : ''}<line x1="0" y1="-46" x2="0" y2="-2" stroke-width="1"/></g>` },
  teddy: { z:'ground', ground:true, dy:-16, r:16, sz:[.85,1.05], colors:[P.tan, P.brown, '#f2b8c6'], diffs:['color','detail','remove'],
    draw:o => `<circle cx="-6" cy="-31" r="3.6" fill="${o.c}"/><circle cx="6" cy="-31" r="3.6" fill="${o.c}"/><ellipse cx="0" cy="-9" rx="10" ry="10" fill="${o.c}"/><circle cx="0" cy="-24" r="8" fill="${o.c}"/><ellipse cx="0" cy="-21.5" rx="3.6" ry="2.6" fill="#fff3e0" stroke-width="1"/><circle cx="-3" cy="-26" r="1.2" fill="${INK}" stroke="none"/><circle cx="3" cy="-26" r="1.2" fill="${INK}" stroke="none"/>${o.d ? `<path d="M0 -16 L-5 -19 L-5 -13 Z M0 -16 L5 -19 L5 -13 Z" fill="${P.red}" stroke-width="1"/>` : ''}` },
  tv: { z:'ground', ground:true, dy:-22, r:22, sz:[.9,1.05], colors:['#3a3a44', P.red, P.blue, P.teal, P.orange], diffs:['color','detail','remove'],
    draw:o => `${o.d ? '<path d="M-2 -34 L-10 -46 M2 -34 L10 -46" fill="none"/>' : ''}<path d="M-12 0 L-8 -8 M12 0 L8 -8" fill="none"/><rect x="-18" y="-34" width="36" height="26" fill="${o.c}"/><rect x="-14" y="-30" width="28" height="18" fill="#8fd0ff"/>` },
};

export const THEMES: Record<string, Theme> = {
  beach: { name:'바닷가',
    zones:{ sky:{ x:[30,370], y:[22,100] }, sea:{ x:[40,360], y:[152,170] }, ground:{ x:[24,376], y:[205,292] } },
    items:[['sun',1,1],['castle',1,1],['palm',1,2],['umbrella',2,2],['cloud',2,3],['boat',1,2],['seagull',2,3],['crab',1,2],['bucket',1,2],['ball',1,2],['surfboard',1,1],['starfish',2,3],['shell',1,2]],
    adds:['crab','starfish','ball','bucket','seagull','cloud','shell'],
    bg:id => { let w = ''; for (const y of [146, 160]) { let d = `M0 ${y}`; for (let x = 0; x < 400; x += 24) d += ` q6 -3 12 0 t12 0`; w += `<path d="${d}" fill="none" stroke="#9fd8f7" stroke-width="1.5"/>`; }
      return `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fc3f0"/><stop offset="1" stop-color="#cdeffc"/></linearGradient></defs><rect width="400" height="140" fill="url(#${id}s)"/><rect y="132" width="400" height="52" fill="#2f95d6"/>${w}<path d="M0 182 Q100 172 200 180 T400 177 V300 H0 Z" fill="#f2d08a"/><path d="M0 182 Q100 172 200 180 T400 177" fill="none" stroke="#fff" stroke-width="3"/><g fill="#d9b06a"><circle cx="60" cy="230" r="1.5"/><circle cx="140" cy="270" r="1.5"/><circle cx="250" cy="215" r="1.5"/><circle cx="330" cy="260" r="1.5"/><circle cx="200" cy="290" r="1.5"/></g>`; } },
  room: { name:'방',
    zones:{ wall:{ x:[42,358], y:[42,140] }, ground:{ x:[28,372], y:[220,292] } },
    items:[['window',1,1],['table',1,1],['lamp',1,1],['books',1,1],['clock',1,1],['frame',1,2],['chair',1,2],['cat',1,1],['plant',1,2],['teddy',1,1],['tv',0,1],['ball',1,1]],
    adds:['ball','plant','frame','teddy'],
    bg:(_id: string) => { let s = ''; for (let x = 0; x < 400; x += 40) s += `<rect x="${x}" y="0" width="20" height="196" fill="#efd8ae"/>`;
      return `<rect width="400" height="200" fill="#f6e5c4"/>${s}<rect y="192" width="400" height="9" fill="#fff" stroke="${INK}" stroke-width="1.5"/><rect y="201" width="400" height="99" fill="#c88c55"/><path d="M0 226 H400 M0 252 H400 M0 279 H400 M90 201 V226 M260 226 V252 M150 252 V279 M330 279 V300" stroke="#a8703f" stroke-width="1.5"/><ellipse cx="200" cy="258" rx="150" ry="26" fill="#6a5acd" opacity=".3"/>`; } },
  park: { name:'공원',
    zones:{ sky:{ x:[30,370], y:[22,110] }, ground:{ x:[24,376], y:[172,292] } },
    items:[['house',1,2],['sun',1,1],['tree',2,3],['bench',1,1],['cloud',2,2],['balloon',1,2],['kite',1,1],['bird',2,2],['rabbit',0,1],['dog',1,1],['mushroom',1,2],['flower',3,4],['ball',1,1]],
    adds:['flower','mushroom','bird','ball','balloon','rabbit'],
    bg:id => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fcbf2"/><stop offset="1" stop-color="#d6f2fc"/></linearGradient></defs><rect width="400" height="160" fill="url(#${id}s)"/><ellipse cx="90" cy="158" rx="140" ry="30" fill="#a6dc8a"/><ellipse cx="320" cy="160" rx="160" ry="34" fill="#9bd47e"/><rect y="152" width="400" height="148" fill="#7cc75b"/><path d="M170 300 Q205 220 262 152 L282 152 Q232 222 246 300 Z" fill="#ead6a4"/>` },
  sea: { name:'바닷속',
    zones:{ swim:{ x:[30,370], y:[30,195] }, ground:{ x:[24,376], y:[230,292] } },
    items:[['chest',1,1],['turtle',1,1],['octopus',1,1],['coral',2,3],['seaweed',2,3],['jelly',1,2],['fish',3,5],['bubble',2,3],['shell',1,2],['starfish',1,2],['crab',1,1]],
    adds:['fish','bubble','shell','starfish','jelly'],
    bg:id => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2aa3dd"/><stop offset="1" stop-color="#0d4f8c"/></linearGradient></defs><rect width="400" height="300" fill="url(#${id}s)"/><g fill="#fff" opacity=".08"><path d="M60 0 L110 0 L40 220 L10 220 Z"/><path d="M200 0 L240 0 L190 220 L160 220 Z"/><path d="M320 0 L350 0 L330 220 L300 220 Z"/></g><path d="M0 226 Q80 214 160 224 T320 220 T400 222 V300 H0 Z" fill="#e6c98a"/><g fill="#cfae6c"><circle cx="70" cy="262" r="1.6"/><circle cx="180" cy="285" r="1.6"/><circle cx="300" cy="250" r="1.6"/></g>` },
  winter: { name:'겨울',
    zones:{ sky:{ x:[30,370], y:[22,105] }, ground:{ x:[24,376], y:[176,292] } },
    items:[['house',1,1],['pine',2,3],['snowman',1,2],['sled',1,1],['penguin',1,2],['present',1,2],['cloud',1,2],['snowflake',4,6],['bird',1,1],['dog',0,1]],
    adds:['snowflake','present','penguin','bird'],
    bg:id => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc8e8"/><stop offset="1" stop-color="#e6f2fb"/></linearGradient></defs><rect width="400" height="170" fill="url(#${id}s)"/><ellipse cx="110" cy="164" rx="150" ry="30" fill="#e3eef8"/><ellipse cx="330" cy="166" rx="150" ry="32" fill="#d8e7f5"/><rect y="158" width="400" height="142" fill="#f6fafd"/><g fill="#dde9f5"><ellipse cx="80" cy="250" rx="60" ry="8"/><ellipse cx="290" cy="280" rx="80" ry="9"/><ellipse cx="230" cy="200" rx="50" ry="6"/></g>` },
  kitchen: { name:'부엌',
    zones:{ wall:{ x:[42,358], y:[42,140] }, ground:{ x:[28,372], y:[222,292] } },
    items:[['fridge',1,1],['window',1,1],['table',1,1],['jars',1,1],['pan',1,2],['clock',1,1],['chair',1,2],['basket',1,1],['trash',1,1],['cat',0,1],['plant',1,1]],
    adds:['plant','basket','frame','ball'],
    bg:(_id: string) => { let t = ''; for (let x = 0; x < 400; x += 25) for (let y = 201; y < 300; y += 25) if (((x + y - 201) / 25) % 2 === 0) t += `<rect x="${x}" y="${y}" width="25" height="25" fill="#cdb592"/>`;
      let g = ''; for (let x = 20; x < 400; x += 20) g += `M${x} 0 V196 `; for (let y = 20; y < 196; y += 20) g += `M0 ${y} H400 `;
      return `<rect width="400" height="200" fill="#e8f3f0"/><path d="${g}" stroke="#d3e5e0" stroke-width="1"/><rect y="192" width="400" height="9" fill="#fff" stroke="${INK}" stroke-width="1.5"/><rect y="201" width="400" height="99" fill="#e2ceb0"/>${t}`; } },
  camp: { name:'캠핑',
    zones:{ sky:{ x:[30,370], y:[20,110] }, ground:{ x:[24,376], y:[180,292] } },
    items:[['moon',1,1],['tent',1,2],['fire',1,1],['pine',2,3],['lantern',1,1],['backpack',1,1],['rabbit',1,1],['mushroom',1,2],['twinkle',5,7]],
    adds:['twinkle','mushroom','lantern','rabbit'],
    bg:id => `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a4a"/><stop offset="1" stop-color="#454c8c"/></linearGradient></defs><rect width="400" height="175" fill="url(#${id}s)"/><path d="M0 170 L60 120 L110 150 L180 100 L250 150 L310 115 L400 160 V175 H0 Z" fill="#2a2f5e"/><rect y="165" width="400" height="135" fill="#2f5a3a"/><path d="M150 300 Q190 230 230 165 L248 165 Q215 230 230 300 Z" fill="#5a6b48"/><g fill="#3d7049"><ellipse cx="70" cy="240" rx="40" ry="5"/><ellipse cx="320" cy="270" rx="50" ry="6"/></g>` },
};

/* eslint-enable */

export const THEME_KEYS = Object.keys(THEMES)

/** 거리의 제곱. Math.hypot은 브라우저·서버(Node)마다 끝자리가 조금 달라서 같은 씨앗값인데 그림이 달라질 수 있어 안 씀 (더하기·곱하기만은 어디서나 같음) */
const dist2 = (dx: number, dy: number) => dx * dx + dy * dy

function persp(zone: { y: [number, number] }, y: number) {
  return 0.78 + (0.36 * (y - zone.y[0])) / (zone.y[1] - zone.y[0])
}

function hitOf(o: Obj, mul = 1): { x: number; y: number; r: number } {
  const d = THINGS[o.t]
  return { x: o.x, y: o.y + (d.dy ?? 0) * o.s, r: d.r * o.s * mul }
}

function place(theme: Theme, type: string, objs: Obj[], r: Rng, id: number): Obj | null {
  const d = THINGS[type]
  const zone = theme.zones[d.z]
  if (!zone) return null
  for (let k = 0; k < 80; k++) {
    const x = between(r, zone.x[0], zone.x[1])
    const y = between(r, zone.y[0], zone.y[1])
    let s = between(r, d.sz[0], d.sz[1])
    if (d.ground) s *= persp(zone, y)
    const o: Obj = { id, t: type, x, y, s, f: d.flip && r.next() < 0.5 ? -1 : 1, d: d.diffs.includes('detail') ? r.next() < 0.5 : false, c: d.colors ? pick(r, d.colors) : '' }
    d.init?.(o, r)
    const h = hitOf(o)
    if (h.x - h.r * 0.7 < 0 || h.x + h.r * 0.7 > W) continue
    if (objs.every((p) => { const q = hitOf(p); const m = q.r + h.r - 3; return m < 0 || dist2(q.x - h.x, q.y - h.y) > m * m })) return o
  }
  return null
}

const CAP: Record<Exclude<DiffKind, 'add'>, number> = { remove: 2, color: 3, detail: 3, flip: 2, size: 2 }

/** 씨앗값 → 장면 (장면 종류도 씨앗값이 정함) */
export function makeScene(seed: number): Scene {
  const r = createRng(seed)
  const themeKey = pick(r, THEME_KEYS)
  const theme = THEMES[themeKey]
  const objs: Obj[] = []
  let id = 0
  for (const [type, lo, hi] of theme.items) {
    const n = lo + Math.floor(r.next() * (hi - lo + 1))
    for (let i = 0; i < n; i++) {
      const o = place(theme, type, objs, r, id++)
      if (o) objs.push(o)
    }
  }
  const right = objs.map((o) => ({ ...o }))
  const diffs: Diff[] = []
  const used: Partial<Record<DiffKind, number>> = {}
  for (const o of shuffle(r, objs.slice())) {
    if (diffs.length >= DIFFS - 1) break
    const d = THINGS[o.t]
    const kinds = d.diffs.filter((k) => (used[k] ?? 0) < CAP[k] && (!d.need?.[k] || d.need[k]!(o)))
    if (!kinds.length) continue
    const k = pick(r, kinds)
    const ro = right.find((x) => x.id === o.id)!
    let mul = 1
    if (k === 'color') ro.c = pick(r, d.colors!.filter((c) => c !== o.c))
    else if (k === 'detail') ro.d = !ro.d
    else if (k === 'flip') ro.f = ro.f === 1 ? -1 : 1
    else if (k === 'size') {
      const f = r.next() < 0.5 ? 0.68 : 1.4
      ro.s *= f
      mul = Math.max(1, f)
    } else ro.hidden = true
    used[k] = (used[k] ?? 0) + 1
    diffs.push({ kind: k, ...hitOf(o, mul) })
  }
  // 나머지는 오른쪽에만 물건 더하기 (자리가 없으면 다시 해 봄)
  for (let tries = 0; diffs.length < DIFFS && tries < 40; tries++) {
    const o = place(theme, pick(r, theme.adds), right.filter((x) => !x.hidden).concat(objs), r, id++)
    if (!o) continue
    right.push(o)
    diffs.push({ kind: 'add', ...hitOf(o) })
  }
  return { theme: themeKey, left: objs, right, diffs }
}

const ORDER: Record<Zone, number> = { sky: 0, wall: 0, swim: 0, sea: 1, ground: 2 }

function drawObj(o: Obj) {
  return `<g transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) scale(${(o.s * o.f).toFixed(3)} ${o.s.toFixed(3)})">${THINGS[o.t].draw(o)}</g>`
}

/** 그림 한 장 (SVG 글자). idPrefix는 한 화면에 두 장이 있어 그라데이션 이름이 겹치지 않게 */
export function sceneSvg(scene: Scene, side: 'A' | 'B', idPrefix: string): string {
  const list = (side === 'A' ? scene.left : scene.right)
    .filter((o) => !o.hidden)
    .sort((a, b) => ORDER[THINGS[a.t].z] - ORDER[THINGS[b.t].z] || (THINGS[a.t].ground ? a.y - b.y : 0))
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${THEMES[scene.theme].bg(idPrefix + side)}<g stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${list.map(drawObj).join('')}</g></svg>`
}

/** 누른 자리(그림 좌표)가 아직 못 찾은 차이에 닿으면 그 번호, 아니면 -1 */
export function hitDiff(diffs: readonly Diff[], found: readonly number[], x: number, y: number): number {
  let best = -1
  let bestD = Infinity
  diffs.forEach((d, i) => {
    if (found.includes(i)) return
    const dist = dist2(d.x - x, d.y - y)
    const reach = Math.max(d.r, 16) + 6
    if (dist <= reach * reach && dist < bestD) {
      best = i
      bestD = dist
    }
  })
  return best
}

const cache = new Map<number, Scene>()
/** 같은 씨앗값은 한 번만 만든다 (서버 심판이 누를 때마다 부름) */
export function sceneOf(seed: number): Scene {
  let s = cache.get(seed)
  if (!s) {
    s = makeScene(seed)
    if (cache.size > 200) cache.clear()
    cache.set(seed, s)
  }
  return s
}
