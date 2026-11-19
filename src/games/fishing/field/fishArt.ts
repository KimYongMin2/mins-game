// @ts-nocheck — SVG 그림 글자를 만드는 코드 (물고기 시안 https://claude.ai/artifact/7sSYAiXXQZnqB2P9NtqtCE 에서 옮김). 숫자·글자만 다뤄서 타입 검사는 생략
import type { Iro } from '../play/fish'
import { BUG_ART } from './bugArt'

// 낚시터 물고기 그림: 몸 틀 8가지에 색·무늬·지느러미를 바꿔 25종 + 꽝 3개. 굵은 먹선 만화풍 2D(SVG).
// 이로치는 밝기에 따라 다시 칠하는 SVG 필터(IRO_FILTERS를 페이지에 한 번 넣어 둠).

const INK = '#1f1a4d'
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
let uid = 0
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const lg = (id, a, b, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
const eye = (x, y, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x + r * 0.2}" cy="${y}" r="${r * 0.5}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.3}" r="${r * 0.18}" fill="#fff"/>`

/* ── 1. 보통 물고기 (몸 길이·높이·꼬리·지느러미·무늬를 바꿔 여러 종) ── */
function stdFish(o) {
  const id = `f${uid++}`
  const c = 65, h = o.h, xN = o.nose === 'pointed' ? 176 : 168, xT = 52
  const th = o.th ?? h * 0.95
  const body = `M${xN},${c} C${xN - 12},${c - h * 0.95} ${xT + 40},${c - h * 1.02} ${xT},${c - h * 0.28} L${xT},${c + h * 0.28} C${xT + 40},${c + h * 0.98} ${xN - 14},${c + h * 0.85} ${xN},${c} Z`
  const tails = {
    fork: `M${xT + 6},${c} L${xT - 32},${c - th} Q${xT - 20},${c - th * 0.2} ${xT - 16},${c} Q${xT - 20},${c + th * 0.2} ${xT - 32},${c + th} Z`,
    round: `M${xT + 6},${c - 7} C${xT - 20},${c - th} ${xT - 36},${c - th * 0.6} ${xT - 36},${c} C${xT - 36},${c + th * 0.6} ${xT - 20},${c + th} ${xT + 6},${c + 7} Z`,
    moon: `M${xT + 6},${c} L${xT - 26},${c - th * 1.15} Q${xT - 12},${c - th * 0.3} ${xT - 8},${c} Q${xT - 12},${c + th * 0.3} ${xT - 26},${c + th * 1.15} Z`,
  }
  const fin = o.fin
  const dors = {
    soft: `M88,${c - h * 0.6} Q104,${c - h - 22} 136,${c - h * 0.55} Z`,
    tall: `M84,${c - h * 0.6} Q96,${c - h - 30} 128,${c - h * 0.6} Z`,
    spiky: `M78,${c - h * 0.6} L84,${c - h - 16} L92,${c - h * 0.75} L99,${c - h - 18} L106,${c - h * 0.75} L113,${c - h - 16} L120,${c - h * 0.72} L127,${c - h - 12} L136,${c - h * 0.58} Z`,
    sail: `M70,${c - h * 0.55} C80,${c - h - 52} 120,${c - h - 52} 150,${c - h * 0.5} Z`,
    small: `M100,${c - h * 0.6} Q110,${c - h - 14} 126,${c - h * 0.6} Z`,
  }
  const pattern = (o.pattern ?? []).map((p) => p(c, h, xN, xT)).join('')
  const ex = xN - 20, ey = c - h * 0.24
  return `<defs>${lg(id + 'b', o.top, o.belly)}${lg(id + 'f', fin, o.fin2 ?? fin)}<clipPath id="${id}c"><path d="${body}"/></clipPath></defs>
  <g class="fish">
    ${o.aura ?? ''}
    <path d="${tails[o.tail ?? 'fork']}" fill="url(#${id}f)" ${S}/>
    <path d="${dors[o.dorsal ?? 'soft']}" fill="url(#${id}f)" ${S}/>
    <path d="M84,${c + h * 0.6} Q96,${c + h + 12} 112,${c + h * 0.55} Z" fill="url(#${id}f)" ${S}/>
    ${o.finlets ? [0, 1, 2, 3].map((i) => `<path d="M${62 + i * 7},${c - h * 0.42 + i} l3,-6 l3,6 Z M${62 + i * 7},${c + h * 0.42 - i} l3,6 l3,-6 Z" fill="${o.finlets}" stroke="${INK}" stroke-width="1.5"/>`).join('') : ''}
    <path d="${body}" fill="url(#${id}b)"/>
    <g clip-path="url(#${id}c)">${pattern}<path d="M${xT},${c + h * 0.3} C${xT + 50},${c + h * 0.9} ${xN - 30},${c + h * 0.6} ${xN},${c + 2}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3"/></g>
    <path d="${body}" fill="none" ${S}/>
    ${o.bill ? `<path d="M${xN - 2},${c - 3} L198,${c - 1} L${xN - 2},${c + 2} Z" fill="${o.top}" ${S} stroke-width="2.5"/>` : ''}
    <path d="M${xN - 34},${c - h * 0.55} Q${xN - 43},${c} ${xN - 34},${c + h * 0.5}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    <path d="M${xN - 30},${c + 4} Q${xN - 52},${c + 8} ${xN - 56},${c + 20} Q${xN - 42},${c + 18} ${xN - 30},${c + 10} Z" fill="url(#${id}f)" ${S} stroke-width="2.5"/>
    ${o.barbels ? `<path d="M${xN - 4},${c + 4} q4,10 -4,16 M${xN - 8},${c + 5} q0,8 -8,11" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` : ''}
    <path d="M${xN},${c + 1} l-8,2" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    ${eye(ex, ey, o.eyeR ?? 6)}
    ${o.extra ? o.extra(c, h, xN, xT) : ''}
  </g>`
}
// 무늬
const scales = (col = 'rgba(31,26,77,0.22)') => (c, h) => { let s = ''; for (let y = c - h; y < c + h; y += 8) for (let x = 56 + ((y / 8) % 2) * 5; x < 150; x += 10) s += `<path d="M${x},${y} q5,6 10,0" fill="none" stroke="${col}" stroke-width="1.6"/>`; return s }
const waves = (col) => (c, h) => { let s = ''; for (let i = 0; i < 8; i++) { const x = 58 + i * 13; s += `<path d="M${x},${c - h} q7,6 0,12 q-7,6 0,12 q7,6 0,10" fill="none" stroke="${col}" stroke-width="3"/>` } return s }
const spots = (col, seed, n, area = 'top', r = [2, 4]) => (c, h) => { const R = rng(seed); let s = ''; for (let i = 0; i < n; i++) { const x = 58 + R() * 100, y = area === 'top' ? c - h * (0.15 + R() * 0.8) : c - h + R() * h * 2; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r[0] + R() * (r[1] - r[0])).toFixed(1)}" fill="${col}"/>` } return s }
const band = (col) => (c, h) => `<path d="M40,${c - 2} C90,${c - h * 0.35} 130,${c - h * 0.3} 180,${c - 3} L180,${c + 7} C130,${c - h * 0.05} 90,${c - h * 0.05} 40,${c + 10} Z" fill="${col}"/>`
const vstripes = (col, n, x0 = 70, gap = 18, w = 7) => (c, h) => Array.from({ length: n }, (_, i) => `<rect x="${x0 + i * gap}" y="${c - h - 5}" width="${w}" height="${h * 2 + 10}" fill="${col}"/>`).join('')
const sparkle = (x, y, s = 6, col = '#fff7c2') => `<path d="M${x},${y - s} L${x + s * 0.28},${y - s * 0.28} L${x + s},${y} L${x + s * 0.28},${y + s * 0.28} L${x},${y + s} L${x - s * 0.28},${y + s * 0.28} L${x - s},${y} L${x - s * 0.28},${y - s * 0.28} Z" fill="${col}" stroke="${INK}" stroke-width="1.5"/>`

/* ── 2. 납작한 몸 (위에서 본 광어·가자미: 테두리 지느러미, 눈 둘이 한쪽) ── */
function flatFish(o) {
  const id = `f${uid++}`, c = 65
  const body = 'M40,65 C40,30 150,22 172,52 C180,62 180,70 172,78 C150,108 40,100 40,65 Z'
  let fringe = ''
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, a = Math.PI * (0.08 + t * 1.84)
    const x = 106 + Math.cos(a + Math.PI / 2) * 74, y = 65 - Math.sin(a + Math.PI / 2) * 42
    fringe += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
  }
  const eyeX = o.left ? 150 : 152, eyeY1 = o.left ? 48 : 52, eyeY2 = o.left ? 60 : 64
  return `<defs>${lg(id + 'b', o.top, o.belly, false)}<clipPath id="${id}c"><path d="${body}"/></clipPath></defs>
  <g class="fish">
    <path d="M42,65 L14,48 Q22,65 14,82 Z" fill="${o.fin}" ${S}/>
    <path d="${body}" fill="${o.fin}" ${S} transform="translate(106 65) scale(1.1 1.22) translate(-106 -65)"/>
    <g opacity="0.5">${Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2; return `<line x1="${106 + Math.cos(a) * 64}" y1="${65 + Math.sin(a) * 34}" x2="${106 + Math.cos(a) * 76}" y2="${65 + Math.sin(a) * 45}" stroke="${INK}" stroke-width="1.5"/>` }).join('')}</g>
    <path d="${body}" fill="url(#${id}b)"/>
    <g clip-path="url(#${id}c)">${spots(o.spot, o.seed, 16, 'all', [2.5, 5.5])(65, 40)}${o.spot2 ? spots(o.spot2, o.seed + 7, 10, 'all', [2, 3.5])(65, 40) : ''}</g>
    <path d="${body}" fill="none" ${S}/>
    <path d="M60,65 Q110,${o.left ? 60 : 70} 160,65" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5"/>
    ${eye(eyeX, eyeY1, 5.5)}${eye(eyeX + 6, eyeY2, 5.5)}
    <path d="M172,${o.left ? 72 : 58} q-6,3 -10,0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`
}

/* ── 3. 긴 몸 (장어: 굵은 S자 · 갈치: 은빛 띠) ── */
function eel() {
  const p = 'M182,52 C160,40 140,82 112,72 C84,62 74,40 48,52 C30,60 22,80 12,84'
  return `<g class="fish">
    <path d="${p}" fill="none" stroke="${INK}" stroke-width="27" stroke-linecap="round"/>
    <path d="${p}" fill="none" stroke="#4d5a2c" stroke-width="21" stroke-linecap="round"/>
    <path d="${p}" fill="none" stroke="#8a9a52" stroke-width="7" stroke-linecap="round" transform="translate(0 6)" opacity="0.8"/>
    <path d="M150,48 Q140,40 128,50" fill="none" stroke="#3b4720" stroke-width="5" stroke-linecap="round"/>
    <path d="M166,58 q-10,6 -6,14 q8,-2 10,-10 Z" fill="#6c7b3c" ${S} stroke-width="2.5"/>
    <path d="M190,54 l-9,2" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    ${eye(178, 47, 4.5)}
  </g>`
}
function cutlass() {
  const id = `f${uid++}`
  const body = 'M184,56 C150,46 100,50 60,58 C40,62 22,66 6,72 C24,70 44,70 62,68 C102,64 150,70 184,64 Z'
  return `<defs>${lg(id, '#e9eef7', '#9aa6bd')}</defs><g class="fish">
    <path d="M60,57 C100,40 150,42 176,52" fill="none" stroke="#b9e3ff" stroke-width="6" opacity="0.9"/>
    <path d="M60,57 C100,40 150,42 176,52" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 3"/>
    <path d="${body}" fill="url(#${id})" ${S}/>
    <path d="M70,62 C110,57 150,59 180,60" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>
    <path d="M184,56 L194,59 L184,64" fill="#d4dbe8" ${S} stroke-width="2.5"/>
    <path d="M186,59 l2,3 l2,-3 l2,3" fill="none" stroke="${INK}" stroke-width="1.4"/>
    ${eye(172, 57, 5)}
    ${sparkle(120, 48, 5)}
  </g>`
}

/* ── 4. 동그란 몸 (복어 · 개복치) ── */
function puffer() {
  const id = `f${uid++}`
  let spikes = ''
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, x = 102 + Math.cos(a) * 44, y = 65 + Math.sin(a) * 40; spikes += `<path d="M${(x - Math.sin(a) * 4).toFixed(1)},${(y + Math.cos(a) * 4).toFixed(1)} L${(102 + Math.cos(a) * 54).toFixed(1)},${(65 + Math.sin(a) * 50).toFixed(1)} L${(x + Math.sin(a) * 4).toFixed(1)},${(y - Math.cos(a) * 4).toFixed(1)} Z" fill="#f3e3a1" stroke="${INK}" stroke-width="2"/>` }
  return `<defs>${lg(id, '#c89a3c', '#fff3c4')}<clipPath id="${id}c"><ellipse cx="102" cy="65" rx="45" ry="41"/></clipPath></defs><g class="fish">
    <path d="M58,65 L36,50 Q44,65 36,80 Z" fill="#e2b85a" ${S}/>
    ${spikes}
    <ellipse cx="102" cy="65" rx="45" ry="41" fill="url(#${id})" ${S}/>
    <g clip-path="url(#${id}c)">${spots('#6b4a1c', 31, 14, 'top', [2.5, 4.5])(65, 40)}</g>
    <ellipse cx="102" cy="65" rx="45" ry="41" fill="none" ${S}/>
    <path d="M110,74 q-12,8 -8,18 q10,-4 12,-14 Z" fill="#e2b85a" ${S} stroke-width="2.5"/>
    <ellipse cx="148" cy="68" rx="5" ry="4" fill="#e8806a" ${S} stroke-width="2.5"/>
    ${eye(130, 52, 7.5)}
  </g>`
}
function sunfish() {
  const id = `f${uid++}`
  return `<defs>${lg(id, '#8f9bb0', '#e4e9f1')}</defs><g class="fish">
    <path d="M100,30 Q96,0 114,-2 Q124,12 120,34 Z" fill="#7d889e" ${S} transform="translate(0 6)"/>
    <path d="M100,100 Q96,130 114,132 Q124,118 120,96 Z" fill="#7d889e" ${S} transform="translate(0 -6)"/>
    <path d="M62,40 Q40,52 42,65 Q40,78 62,90 Z" fill="#a8b2c4" ${S}/>
    <path d="M58,42 q-10,12 -8,23 M58,88 q-10,-12 -8,-23" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>
    <ellipse cx="108" cy="65" rx="50" ry="40" fill="url(#${id})" ${S}/>
    <path d="M70,52 q30,-12 70,0 M70,78 q30,12 70,0" fill="none" stroke="#fff" stroke-width="2" opacity="0.5"/>
    <path d="M118,74 q-10,6 -6,14 q8,-3 9,-10 Z" fill="#a8b2c4" ${S} stroke-width="2.5"/>
    <ellipse cx="157" cy="66" rx="3.5" ry="3" fill="${INK}"/>
    ${eye(140, 56, 6.5)}
  </g>`
}

/* ── 5. 큰 지느러미 (상어: 뾰족 코·아가미 틈) ── */
function shark() {
  const id = `f${uid++}`
  const body = 'M186,66 C172,44 120,38 80,48 C60,53 50,58 40,62 L40,68 C60,74 90,90 130,86 C160,84 178,76 186,66 Z'
  return `<defs>${lg(id, '#6d7d93', '#f1f4f8')}<clipPath id="${id}c"><path d="${body}"/></clipPath></defs><g class="fish">
    <path d="M44,64 L10,26 Q22,58 18,66 Q24,76 22,96 Z" fill="#5f6f86" ${S}/>
    <path d="M100,44 L118,10 Q124,30 134,44 Z" fill="#5f6f86" ${S}/>
    <path d="M70,52 L78,40 L84,51 Z" fill="#5f6f86" ${S} stroke-width="2.5"/>
    <path d="M90,84 L98,98 L106,85 Z" fill="#5f6f86" ${S} stroke-width="2.5"/>
    <path d="${body}" fill="url(#${id})"/>
    <g clip-path="url(#${id}c)"><path d="M40,66 C80,64 140,64 186,66 L186,100 L40,100 Z" fill="#f4f6fa"/></g>
    <path d="${body}" fill="none" ${S}/>
    <path d="M140,72 Q118,82 112,100 Q128,92 146,80 Z" fill="#5f6f86" ${S} stroke-width="2.5"/>
    <path d="M150,58 q-3,8 0,16 M144,58 q-3,8 0,16 M138,59 q-3,7 0,14" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M182,72 q-10,6 -20,4" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M166,75 l2,3 l2,-3 l2,3 l2,-3" fill="none" stroke="${INK}" stroke-width="1.3"/>
    ${eye(166, 60, 4.5)}
  </g>`
}

/* ── 6. 넓적한 몸 (가오리) ── */
function ray() {
  const id = `f${uid++}`
  const body = 'M100,22 C120,40 150,52 180,62 C150,72 124,90 100,110 C76,90 50,72 20,62 C50,52 80,40 100,22 Z'
  return `<defs>${lg(id, '#8a6a4a', '#c9a77f')}<clipPath id="${id}c"><path d="${body}"/></clipPath></defs><g class="fish">
    <path d="M100,104 C104,116 100,124 96,129" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <path d="M100,104 C104,116 100,124 96,129" fill="none" stroke="#7a5c3e" stroke-width="3" stroke-linecap="round"/>
    <path d="${body}" fill="url(#${id})"/>
    <g clip-path="url(#${id}c)">${spots('#5a4128', 77, 18, 'all', [2, 4])(65, 45)}<path d="M100,22 L100,110" stroke="rgba(255,255,255,0.25)" stroke-width="3"/></g>
    <path d="${body}" fill="none" ${S}/>
    <path d="M86,104 q-8,6 -6,12 q8,-2 10,-10 Z M114,104 q8,6 6,12 q-8,-2 -10,-10 Z" fill="#a98563" ${S} stroke-width="2"/>
    ${eye(88, 44, 4.5)}${eye(112, 44, 4.5)}
    <path d="M92,54 q8,4 16,0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  </g>`
}

/* ── 7. 다리 달린 것 (꽃게 · 가재 · 문어 · 오징어) ── */
function crab() {
  const leg = (x, y, dx, dy) => `<path d="M${x},${y} q${dx * 0.6},${dy * 0.2} ${dx},${dy}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${x},${y} q${dx * 0.6},${dy * 0.2} ${dx},${dy}" fill="none" stroke="#6b78c2" stroke-width="3.5" stroke-linecap="round"/>`
  return `<g class="fish">
    ${leg(70, 74, -30, 18)}${leg(74, 80, -26, 28)}${leg(80, 84, -18, 34)}${leg(130, 74, 30, 18)}${leg(126, 80, 26, 28)}${leg(120, 84, 18, 34)}
    <path d="M62,58 Q40,40 46,24" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M62,58 Q40,40 46,24" fill="none" stroke="#6b78c2" stroke-width="4" stroke-linecap="round"/>
    <path d="M138,58 Q160,40 154,24" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M138,58 Q160,40 154,24" fill="none" stroke="#6b78c2" stroke-width="4" stroke-linecap="round"/>
    <path d="M46,26 C30,20 30,4 44,4 C52,4 56,12 50,18 L58,10 C60,22 56,28 46,26 Z" fill="#e8705a" ${S}/>
    <path d="M154,26 C170,20 170,4 156,4 C148,4 144,12 150,18 L142,10 C140,22 144,28 154,26 Z" fill="#e8705a" ${S}/>
    <path d="M44,62 L58,48 L80,42 L120,42 L142,48 L156,62 L144,78 L100,86 L56,78 Z" fill="#5d6ab8" ${S}/>
    <path d="M44,62 L36,58 M156,62 L164,58" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${[[70, 58, 3], [84, 52, 2.2], [100, 56, 3.2], [118, 51, 2.4], [132, 60, 3], [92, 68, 2.4], [110, 70, 2.8], [76, 70, 2], [126, 72, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#d8ddff"/>`).join('')}
    <path d="M88,44 l0,-10 M112,44 l0,-10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${eye(88, 32, 4.5)}${eye(112, 32, 4.5)}
  </g>`
}
function crayfish() {
  const red = '#c4452e', light = '#e8805e'
  let segs = ''
  for (let i = 0; i < 5; i++) segs += `<path d="M${62 - i * 10},${56 + i * 0.5} q-6,9 0,18 l10,0 q-4,-9 0,-18 Z" fill="${i % 2 ? red : light}" ${S} stroke-width="2.5"/>`
  return `<g class="fish">
    <path d="M150,58 Q182,30 196,26 M150,62 Q184,52 198,58" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M14,52 L4,44 L6,65 L4,86 L14,78 Z" fill="${red}" ${S} stroke-width="2.5"/>
    ${segs}
    <path d="M70,52 C90,46 126,46 148,56 C156,60 156,70 148,74 C126,84 90,84 70,78 Z" fill="${red}" ${S}/>
    <path d="M78,58 C100,54 124,55 140,60" fill="none" stroke="${light}" stroke-width="3"/>
    <path d="M120,50 Q140,20 160,18 M120,80 Q140,110 160,112" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M120,50 Q140,20 160,18 M120,80 Q140,110 160,112" fill="none" stroke="${light}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M156,22 C160,4 186,6 186,16 C186,24 174,26 166,22 L184,26 C180,34 164,32 156,22 Z" fill="${red}" ${S}/>
    <path d="M156,108 C160,126 186,124 186,114 C186,106 174,104 166,108 L184,104 C180,96 164,98 156,108 Z" fill="${red}" ${S}/>
    ${[96, 108, 120].map((x) => `<path d="M${x},80 l-4,12 M${x},50 l-4,-12" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
    ${eye(146, 58, 4)}
  </g>`
}
function octopus() {
  const col = '#d9534f', dark = '#a8322f'
  const arm = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round"/>`
  const suck = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#ffd2c8" stroke="${INK}" stroke-width="1"/>`).join('')
  return `<g class="fish">
    ${arm('M80,80 C60,92 40,96 30,84 C24,76 30,70 36,74')}
    ${arm('M90,86 C84,104 70,118 56,116')}
    ${arm('M112,86 C118,104 132,118 146,116')}
    ${arm('M120,80 C140,92 160,96 170,84 C176,76 170,70 164,74')}
    ${arm('M100,88 C100,104 96,116 102,124')}
    ${suck([[58, 95], [44, 92], [80, 108], [124, 108], [146, 95], [158, 92], [99, 106]])}
    <path d="M60,62 C56,24 144,24 140,62 C138,82 62,82 60,62 Z" fill="${col}" ${S}/>
    <path d="M74,40 q8,-10 22,-10" fill="none" stroke="#ff9a8f" stroke-width="5" stroke-linecap="round"/>
    ${spots(dark, 5, 6, 'all', [2, 3.5])(50, 14)}
    ${eye(86, 64, 6)}${eye(114, 64, 6)}
    <path d="M94,76 q6,5 12,0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`
}
function squid() {
  const col = '#f1d9d2', dot = '#d9806a'
  const t = (d, w = 7) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`
  return `<g class="fish">
    ${t('M50,60 C34,56 22,60 10,52', 5)}${t('M50,70 C34,74 22,70 10,78', 5)}
    ${t('M54,58 C40,48 26,44 16,46')}${t('M54,72 C40,82 26,86 16,84')}${t('M52,65 C36,65 26,64 14,65')}
    <path d="M172,65 L188,44 L196,65 L188,86 Z" fill="${col}" ${S}/>
    <path d="M56,52 C90,44 150,46 180,58 C186,62 186,68 180,72 C150,84 90,86 56,78 C50,74 50,56 56,52 Z" fill="${col}" ${S}/>
    ${spots(dot, 19, 16, 'all', [1.5, 3])(65, 12).replace(/cx="([\d.]+)/g, (m, x) => `cx="${(70 + (+x - 58) * 1.0).toFixed(1)}`)}
    <path d="M60,66 C100,62 140,62 176,64" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.8"/>
    ${eye(66, 62, 6.5)}
  </g>`
}

/* ── 8. 특이한 것 (해파리 · 해마 · 아귀) ── */
function jelly() {
  const id = `f${uid++}`
  let ten = ''
  for (let i = 0; i < 6; i++) { const x = 66 + i * 14; ten += `<path d="M${x},70 q-8,12 0,24 q8,12 0,24" fill="none" stroke="#d6b8ff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>` }
  return `<defs><radialGradient id="${id}" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#f3e6ff"/><stop offset="1" stop-color="#a77be0"/></radialGradient></defs><g class="fish">
    ${ten}
    <path d="M86,72 q-4,20 4,36 M114,72 q4,20 -4,36" fill="none" stroke="#f5d0ff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
    <path d="M50,70 C50,22 150,22 150,70 Q141,64 133,72 Q125,64 117,72 Q108,64 100,72 Q92,64 84,72 Q75,64 67,72 Q58,64 50,70 Z" fill="url(#${id})" ${S} opacity="0.95"/>
    <path d="M70,46 q14,-14 34,-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <circle cx="88" cy="56" r="3" fill="${INK}"/><circle cx="112" cy="56" r="3" fill="${INK}"/>
    <path d="M95,62 q5,4 10,0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  </g>`
}
function seahorse() {
  const col = '#f2a541', light = '#ffd27f'
  const body = 'M118,28 C132,26 140,36 134,46 C130,52 122,52 120,58 C132,64 140,78 132,92 C126,102 112,104 104,96 C98,90 102,82 108,84 C114,86 112,94 106,96 M106,96 C96,100 84,110 92,120 C100,128 112,118 104,112'
  return `<g class="fish">
    <path d="M122,64 C108,58 96,66 98,80" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="${body}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${body}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M118,28 C102,26 88,30 74,30 L74,38 C88,40 104,40 116,42 Z" fill="${col}" ${S}/>
    <path d="M118,18 l4,8 l6,-6 l2,8" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M134,74 q14,-6 16,6 q-8,6 -16,2" fill="${light}" ${S} stroke-width="2.5"/>
    ${[54, 62, 70, 78, 86].map((y) => `<path d="M${118 + (y - 54) * 0.4},${y} q8,2 12,0" fill="none" stroke="#c97a1e" stroke-width="2" stroke-linecap="round"/>`).join('')}
    ${eye(122, 34, 5)}
  </g>`
}
function angler() {
  const id = `f${uid++}`
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#fffbd1"/><stop offset="0.45" stop-color="#ffe066"/><stop offset="1" stop-color="rgba(255,224,102,0)"/></radialGradient></defs><g class="fish">
    <circle cx="176" cy="24" r="20" fill="url(#${id})"/>
    <path d="M118,34 Q150,0 172,22" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="174" cy="24" r="6" fill="#fff2a0" ${S} stroke-width="2.5"/>
    <path d="M40,66 L14,50 Q22,66 14,84 Z" fill="#4a3a52" ${S}/>
    <path d="M44,62 C50,30 120,22 160,44 C176,54 178,70 172,80 C150,104 70,104 44,72 Z" fill="#5d4a66" ${S}/>
    <path d="M60,48 q30,-16 70,-8" fill="none" stroke="#8a7394" stroke-width="5" stroke-linecap="round"/>
    <path d="M172,62 C150,66 120,70 106,84 C126,98 160,92 176,78 Z" fill="#2a1e30" ${S}/>
    <path d="M112,82 l5,-8 l5,8 l5,-9 l5,9 l5,-9 l5,9 l5,-8 l5,8 l5,-7 l4,6" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M116,86 l5,6 l5,-6 l5,7 l5,-7 l5,7 l5,-6 l5,6" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M86,82 q-10,10 -4,18 q8,-4 10,-14 Z" fill="#4a3a52" ${S} stroke-width="2.5"/>
    ${eye(140, 46, 5)}
  </g>`
}

/* ── 꽝 ── */
function boot() {
  return `<g class="fish" transform="rotate(-8 100 65)">
    <path d="M78,14 L120,14 L122,78 C150,80 168,88 168,104 L168,112 L74,112 L76,62 Z" fill="#4f8a4a" ${S}/>
    <path d="M74,104 L168,104 L168,114 L74,114 Z" fill="#2f4f2c" ${S}/>
    <path d="M76,14 L122,14 L122,24 L76,24 Z" fill="#6fb065" ${S}/>
    <path d="M90,30 q4,30 -2,60" fill="none" stroke="#7fc276" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <path d="M130,84 q12,6 18,16" fill="none" stroke="#7fc276" stroke-width="3" opacity="0.7"/>
    <path d="M150,70 q4,-8 10,-6 q-2,8 -10,6 Z" fill="#9ad3ff" ${S} stroke-width="2"/>
  </g>`
}
function can() {
  return `<g class="fish" transform="rotate(14 100 65)">
    <path d="M70,30 L130,30 L130,100 L70,100 Z" fill="#c9ced8" ${S}/>
    <ellipse cx="100" cy="30" rx="30" ry="8" fill="#e6e9ef" ${S}/>
    <path d="M70,46 L130,46 L130,84 L70,84 Z" fill="#e8473f" stroke="${INK}" stroke-width="2.5"/>
    <path d="M78,60 q22,-10 44,0 M78,70 q22,10 44,0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M70,100 Q100,110 130,100" fill="none" ${S}/>
    <path d="M118,88 q6,4 8,10 M80,92 q4,-4 10,-2" fill="none" stroke="#9a6b3c" stroke-width="3" stroke-linecap="round"/>
    <path d="M98,24 l8,-6 l6,4" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`
}
function kelp() {
  const strand = (x, col, d) => `<path d="M${x},120 C${x - 14},${100 - d} ${x + 14},${80 - d} ${x - 6},${54 - d} C${x - 20},${36 - d} ${x + 6},${22 - d} ${x},${8}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M${x},120 C${x - 14},${100 - d} ${x + 14},${80 - d} ${x - 6},${54 - d} C${x - 20},${36 - d} ${x + 6},${22 - d} ${x},${8}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"/>`
  return `<g class="fish">${strand(84, '#3f6b2a', 0)}${strand(104, '#567f34', 6)}${strand(120, '#2f5520', -4)}
    <path d="M70,120 L134,120" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="140" cy="40" r="4" fill="none" stroke="#bfe3ff" stroke-width="2"/><circle cx="148" cy="26" r="2.5" fill="none" stroke="#bfe3ff" stroke-width="2"/>
  </g>`
}


const legendAura = `<ellipse cx="100" cy="65" rx="96" ry="56" fill="rgba(255,200,90,0.16)"/>` + sparkle(30, 22, 7) + sparkle(178, 24, 5) + sparkle(166, 112, 6) + sparkle(40, 108, 4)
/* 철갑상어 (민물 전설): 들린 뾰족 코 + 수염, 등·옆구리에 갑옷 같은 뼈 비늘 줄, 위쪽이 긴 꼬리. 짙은 녹갈색 + 초록빛 테두리 */
function sturgeon() {
  const id = `f${uid++}`
  const body = 'M186,58 C176,48 150,46 120,48 C90,50 62,56 40,62 L40,70 C62,74 92,80 122,80 C152,80 172,74 182,66 Z'
  const aura = `<ellipse cx="100" cy="65" rx="96" ry="54" fill="rgba(120,255,190,0.15)"/>` + sparkle(28, 24, 7, '#d9ffe9') + sparkle(172, 22, 5, '#d9ffe9') + sparkle(166, 110, 6, '#d9ffe9') + sparkle(36, 106, 4, '#d9ffe9')
  const scute = (x, y, r = 4.5) => `<path d="M${x - r},${y} L${x},${y - r} L${x + r},${y} L${x},${y + r} Z" fill="#e9e2c8" stroke="${INK}" stroke-width="2"/>`
  return `<defs>${lg(id, '#3e4a30', '#d8d2b0')}<clipPath id="${id}c"><path d="${body}"/></clipPath></defs><g class="fish">
    ${aura}
    <path d="M44,64 L6,30 Q22,56 20,68 Q24,76 16,90 Z" fill="#4c5a3a" ${S}/>
    <path d="M86,52 Q96,34 112,50 Z" fill="#4c5a3a" ${S} stroke-width="2.5"/>
    <path d="M74,76 Q82,90 96,78 Z" fill="#4c5a3a" ${S} stroke-width="2.5"/>
    <path d="${body}" fill="url(#${id})"/>
    <g clip-path="url(#${id}c)"><path d="M40,70 C80,70 140,72 186,64 L186,90 L40,90 Z" fill="#efe9cf" opacity="0.8"/></g>
    <path d="${body}" fill="none" ${S}/>
    ${[60, 74, 88, 102, 116, 130, 144, 158].map((x, i) => scute(x, 52 - Math.sin(i / 2.2) * 1.5 - (x > 120 ? 1 : 0))).join('')}
    ${[64, 80, 96, 112, 128, 144].map((x) => scute(x, 64, 3.6)).join('')}
    <path d="M182,60 L198,50 L190,64 Z" fill="#5d6b46" ${S} stroke-width="2.5"/>
    <path d="M176,70 q2,8 -2,12 M170,71 q1,8 -3,11 M164,72 q0,7 -4,10" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M150,62 Q144,72 150,80" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    <path d="M144,70 q-14,4 -18,12 q12,-1 18,-7 Z" fill="#4c5a3a" ${S} stroke-width="2.5"/>
    ${eye(166, 58, 4.5)}
  </g>`
}

/* 실러캔스: 살 붙은 지느러미(다리처럼 생긴 동그란 지느러미) + 세 갈래 꼬리, 짙은 파랑에 흰 얼룩 */
const lobe = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0,0 C6,-4 14,-4 18,2 C22,8 16,14 8,12 C2,10 -2,6 0,0 Z" fill="#7a3a8f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M4,3 q6,-2 11,3" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.6"/></g>`
const coelacanth = () => stdFish({
  h: 30, top: '#4a1d5e', belly: '#a65bb8', fin: '#7a3a8f', fin2: '#c27ad1', tail: 'round', dorsal: 'soft', aura: legendAura,
  pattern: [spots('#ffd75a', 52, 14, 'all', [2, 4.5]), spots('#fff3c4', 9, 8, 'all', [1, 1.8])],
  extra: (c, h) => lobe(98, c + h * 0.62, 70) + lobe(76, c + h * 0.5, 80) + lobe(92, c - h * 0.72, -100) +  `<path d="M16,${c - 6} q-8,6 0,12" fill="#7a3a8f" stroke="${INK}" stroke-width="2.5"/>`,
})

const FISH_ART: Record<string, () => string> = {
  crucian: () => stdFish({ h: 34, top: '#8a7a3a', belly: '#e9dca2', fin: '#9c8a44', tail: 'round', pattern: [scales()] }),
  carp: () => stdFish({ h: 28, top: '#6c6a4a', belly: '#d9cf9a', fin: '#a4664a', tail: 'fork', barbels: true, pattern: [scales('rgba(31,26,77,0.25)')] }),
  mackerel: () => stdFish({ h: 22, top: '#2f7f8a', belly: '#e8eef4', fin: '#4a8a94', nose: 'pointed', finlets: '#8fc6cc', pattern: [waves('#173a3f')] }),
  seabass: () => stdFish({ h: 24, top: '#5f6e86', belly: '#e6ebf2', fin: '#7d8aa0', dorsal: 'spiky', pattern: [spots('#2c3446', 9, 14, 'top', [1.5, 2.8])] }),
  flounder: () => flatFish({ top: '#9c8462', belly: '#c9b48c', fin: '#b39a72', spot: '#f1e6cf', seed: 14, left: false }),
  crab,
  squid,
  jelly,
  redbream: () => stdFish({ h: 34, top: '#e0566e', belly: '#ffd6dd', fin: '#ef7f8f', dorsal: 'spiky', pattern: [spots('#7fd3ff', 3, 16, 'top', [1.2, 2.2])] }),
  halibut: () => flatFish({ top: '#6a5638', belly: '#8e7652', fin: '#7c6644', spot: '#3e3020', spot2: '#d9c79d', seed: 41, left: true }),
  salmon: () => stdFish({ h: 24, top: '#5d7088', belly: '#f2f4f7', fin: '#7a8aa0', pattern: [band('rgba(240,110,120,0.55)'), spots('#2b3244', 21, 12, 'top', [1.5, 2.5])] }),
  cutlass,
  puffer,
  crayfish,
  octopus,
  eel,
  ray,
  seahorse,
  angler,
  tuna: () => stdFish({ h: 30, top: '#1f3a6e', belly: '#dfe6f0', fin: '#3a5a94', tail: 'moon', nose: 'pointed', dorsal: 'small', finlets: '#ffd23f', pattern: [band('rgba(120,170,230,0.35)')] }),
  shark,
  marlin: () => stdFish({ h: 22, top: '#203f7a', belly: '#e3ebf6', fin: '#2f5aa8', tail: 'moon', nose: 'pointed', dorsal: 'sail', bill: true, pattern: [vstripes('rgba(140,200,255,0.55)', 6, 68, 16, 4)] }),
  sunfish,
  coelacanth,
  sturgeon,
  boot,
  can,
  kelp,
}

/** 이로치 필터 정의 (페이지에 한 번: <svg width=0 height=0>{IRO_FILTERS}</svg>) */
/** 물고기 + 곤충 (곤충 그림은 bugArt.ts) */
const ART: Record<string, () => string> = { ...FISH_ART, ...BUG_ART }

export const IRO_FILTERS = `<filter id="iro-gold" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="0.12 0.62 0.95 1"/><feFuncG type="table" tableValues="0.08 0.42 0.78 0.98"/><feFuncB type="table" tableValues="0.18 0.08 0.25 0.72"/></feComponentTransfer>
    </filter>
    <filter id="iro-silver" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="0.12 0.55 0.86 1"/><feFuncG type="table" tableValues="0.1 0.58 0.88 1"/><feFuncB type="table" tableValues="0.3 0.68 0.95 1"/></feComponentTransfer>
    </filter>
    <filter id="iro-neon" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer result="c"><feFuncR type="table" tableValues="0.12 0.1 0.55 0.92"/><feFuncG type="table" tableValues="0.08 0.95 1 1"/><feFuncB type="table" tableValues="0.3 0.55 0.3 0.75"/></feComponentTransfer>
      <feGaussianBlur in="c" stdDeviation="2.5" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="c"/></feMerge>
    </filter>
    <filter id="iro-sakura" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="0.16 0.86 1 1"/><feFuncG type="table" tableValues="0.08 0.42 0.72 0.95"/><feFuncB type="table" tableValues="0.22 0.62 0.84 0.97"/></feComponentTransfer>
    </filter>
    <filter id="iro-obsidian" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="thick"/>
      <feFlood flood-color="#c4b0ff"/><feComposite in2="thick" operator="in" result="rim"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer result="c"><feFuncR type="table" tableValues="0.04 0.14 0.36 0.72"/><feFuncG type="table" tableValues="0.03 0.1 0.26 0.6"/><feFuncB type="table" tableValues="0.08 0.26 0.56 0.95"/></feComponentTransfer>
      <feMerge><feMergeNode in="rim"/><feMergeNode in="c"/></feMerge>
    </filter>
    <filter id="iro-ghost" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer result="c"><feFuncR type="table" tableValues="0.55 0.8 0.95 1"/><feFuncG type="table" tableValues="0.75 0.92 1 1"/><feFuncB type="table" tableValues="0.85 0.97 1 1"/><feFuncA type="linear" slope="0.6"/></feComponentTransfer>
      <feGaussianBlur in="c" stdDeviation="3" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="c"/></feMerge>
    </filter>
    <filter id="iro-rainbow" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="0.12 0.95 1 1 0.25 0.3 0.75 1"/><feFuncG type="table" tableValues="0.08 0.25 0.6 0.95 0.9 0.6 0.4 1"/><feFuncB type="table" tableValues="0.3 0.35 0.15 0.2 0.45 1 1 1"/></feComponentTransfer>
    </filter>
  `

/** 물고기 그림 (viewBox 200×130 SVG 글자). bg = 바다·민물 바탕을 깔지 */
export function fishSvg(id: string, iro: Iro | null = null, opts: { bg?: 'sea' | 'fresh' | 'forest' | 'meadow' | null; silhouette?: boolean } = {}): string {
  const draw = ART[id]
  if (!draw) return ''
  const bgId = `bg${uid++}`
  const BG = { sea: ['#2d5f9e', '#173a6b'], fresh: ['#3f7a5a', '#1f4a37'], forest: ['#4a6a3a', '#26381e'], meadow: ['#7a9a4a', '#4a6a2a'] }
  const bg = opts.bg
    ? `<defs>${lg(bgId, BG[opts.bg][0], BG[opts.bg][1])}</defs><rect width="200" height="130" fill="url(#${bgId})"/>`
    : ''
  const filter = opts.silhouette ? ' filter="url(#fish-shadow)"' : iro ? ` filter="url(#iro-${iro})"` : ''
  return `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg">${bg}<g${filter}>${draw()}</g></svg>`
}

/** 못 잡은 물고기 실루엣 필터 (IRO_FILTERS와 같이 넣음) */
export const SHADOW_FILTER = `<filter id="fish-shadow" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.14  0 0 0 0 0.4  0 0 0 0.85 0"/></filter>`

/** 3D 화면에 붙일 그림 주소 (이로치 필터를 SVG 안에 넣어 따로 떼어 써도 색이 나옴) */
export function fishImageUrl(id: string, iro: Iro | null): string {
  const draw = ART[id]
  if (!draw) return ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130" width="400" height="260"><defs>${IRO_FILTERS}</defs><g${iro ? ` filter="url(#iro-${iro})"` : ''}>${draw()}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dedupeAttrs(svg))}`
}

/**
 * 같은 속성이 한 태그에 두 번 있으면 앞의 것만 (예: 공통 선 굵기 뒤에 다시 쓴 굵기).
 * 화면에 바로 넣을 땐 브라우저가 앞의 것을 쓰고 넘어가지만, 그림 파일(XML)로 읽으면 오류라 3D에 안 나왔음
 */
export function dedupeAttrs(svg) {
  return svg.replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, (_m, tag, attrs, close) => {
    const seen = new Set()
    const kept = (attrs.match(/\s+[\w:-]+="[^"]*"/g) ?? []).filter((a) => {
      const name = a.trim().split('=')[0]
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })
    return `<${tag}${kept.join('')}${close ? ' /' : ''}>`
  })
}
