// @ts-nocheck — SVG 그림 글자를 만드는 코드 (숫자·글자만 다뤄서 타입 검사는 생략)
// 낚시터 곤충 그림 (사용자 요청 2026-11-19): 물고기 그림(fishArt.ts)과 같은 굵은 먹선 만화풍, viewBox 200×130.
// 틀 몇 가지(나비·딱정벌레·잠자리·메뚜기·…)에 색·무늬·뿔을 바꿔 25종 + 꽝 3개. 머리는 오른쪽, 위에서 본 모습.

const INK = '#1f1a4d'
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
const T = (w = 2.2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
let uid = 0
const lg = (id, a, b, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
const rg = (id, a, b) => `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`
const eyes = (x, y, r = 4, gap = 9) => [-1, 1].map((s) => `<circle cx="${x}" cy="${y + s * gap}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.3}" cy="${y + s * gap - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`).join('')
const shine = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(255,255,255,0.45)"/>`
/** 다리 세 쌍 (몸 가운데 x0~x1, 위아래로) */
const legs = (x0, x1, c = 65, len = 26, w = 2.6) =>
  [0, 1, 2].map((i) => {
    const x = x0 + ((x1 - x0) * i) / 2
    const dx = (i - 1) * 12
    return [-1, 1].map((s) => `<path d="M${x},${c + s * 8} L${x + dx * 0.6},${c + s * (len * 0.6)} L${x + dx},${c + s * len}" fill="none" ${T(w)}/>`).join('')
  }).join('')
const antennae = (x, c = 65, len = 26, curl = true) =>
  [-1, 1].map((s) => `<path d="M${x},${c + s * 4} Q${x + len * 0.5},${c + s * (len * 0.2)} ${x + len},${c + s * (len * 0.55)}" fill="none" ${T(2.2)}/>${curl ? `<circle cx="${x + len}" cy="${c + s * (len * 0.55)}" r="3" fill="${INK}"/>` : ''}`).join('')

/* ── 나비·나방: 위에서 본 날개 네 장 ── */
function butterfly(o) {
  const id = `b${uid++}`
  const c = 65
  // 앞날개(오른쪽 위·아래), 뒷날개(왼쪽 위·아래)
  const fw = (s) => `M102,${c + s * 3} C98,${c + s * 30} 112,${c + s * 62} 146,${c + s * 60} C172,${c + s * 58} 174,${c + s * 38} 156,${c + s * 24} C140,${c + s * 12} 120,${c + s * 5} 106,${c + s * 3} Z`
  const hw = (s) =>
    o.tail
      ? `M100,${c + s * 4} C82,${c + s * 10} 52,${c + s * 22} 56,${c + s * 42} C58,${c + s * 50} 62,${c + s * 54} 70,${c + s * 54} L60,${c + s * 64} L80,${c + s * 54} C94,${c + s * 50} 104,${c + s * 30} 102,${c + s * 6} Z`
      : `M100,${c + s * 4} C82,${c + s * 10} 52,${c + s * 24} 58,${c + s * 46} C64,${c + s * 60} 92,${c + s * 58} 100,${c + s * 40} C104,${c + s * 28} 104,${c + s * 12} 102,${c + s * 5} Z`
  const pat = (o.pattern ?? []).map((p) => p(c)).join('')
  const wings = [-1, 1].map((s) => `<path d="${hw(s)}" fill="url(#${id}h)" ${S}/><path d="${fw(s)}" fill="url(#${id}f)" ${S}/>`).join('')
  return `<defs>${lg(id + 'f', o.f1, o.f2, false)}${lg(id + 'h', o.h1 ?? o.f2, o.h2 ?? o.f1, false)}<clipPath id="${id}c">${[-1, 1].map((s) => `<path d="${hw(s)}"/><path d="${fw(s)}"/>`).join('')}</clipPath></defs>
  <g class="bug">
    ${o.aura ?? ''}
    ${wings}
    <g clip-path="url(#${id}c)">${pat}</g>
    ${[-1, 1].map((s) => `<path d="${fw(s)}" fill="none" ${S}/>`).join('')}
    <ellipse cx="102" cy="${c}" rx="${o.moth ? 30 : 26}" ry="${o.moth ? 8 : 6}" fill="${o.body ?? '#3a2f2a'}" ${S}/>
    <circle cx="130" cy="${c}" r="7" fill="${o.body ?? '#3a2f2a'}" ${S}/>
    ${o.moth ? [-1, 1].map((s) => `<path d="M134,${c + s * 3} q12,${s * 4} 18,${s * 16} M140,${c + s * 6} l4,${s * 6} M146,${c + s * 9} l4,${s * 4}" fill="none" ${T(2)}/>`).join('') : antennae(134, c, 22)}
  </g>`
}
const wingSpots = (col, pts, r = 5) => () => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="${INK}" stroke-width="1.5"/>`).join('')
const wingEdge = (col) => (c) => [-1, 1].map((s) => `<path d="M112,${c + s * 58} C140,${c + s * 64} 176,${c + s * 56} 166,${c + s * 30}" fill="none" stroke="${col}" stroke-width="9"/><path d="M52,${c + s * 38} C56,${c + s * 62} 90,${c + s * 64} 100,${c + s * 42}" fill="none" stroke="${col}" stroke-width="8"/>`).join('')
const wingStripes = (col, xs) => (c) => xs.map((x) => `<path d="M${x},${c - 70} L${x - 14},${c + 70}" stroke="${col}" stroke-width="7"/>`).join('')
const wingVeins = (col = 'rgba(31,26,77,0.35)') => (c) => [-1, 1].map((s) => [0.25, 0.5, 0.75].map((k) => `<path d="M104,${c + s * 3} L${110 + 56 * k},${c + s * (62 - 34 * k)}" stroke="${col}" stroke-width="1.6"/><path d="M100,${c + s * 4} L${86 - 30 * k},${c + s * (54 - 22 * k)}" stroke="${col}" stroke-width="1.6"/>`).join('')).join('')
const eyeSpot = (x, y, r, a, b) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}" stroke="${INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="${b}"/>`

/* ── 딱정벌레: 위에서 본 둥근 등껍질 ── */
function beetle(o) {
  const id = `e${uid++}`
  const c = 65, L = o.len ?? 1, W = o.wid ?? 1
  const x0 = 100 - 46 * L, x1 = 100 + 30 * L, hw = 34 * W
  const shell = `M${x1},${c} C${x1},${c - hw} ${x0 + 10},${c - hw * 1.05} ${x0},${c - hw * 0.4} C${x0 - 8},${c} ${x0 - 8},${c} ${x0},${c + hw * 0.4} C${x0 + 10},${c + hw * 1.05} ${x1},${c + hw} ${x1},${c} Z`
  const head = o.horn === 'stag' ? 126 : 124
  const horns = {
    none: '',
    stag: [-1, 1].map((s) => `<path d="M${x1 + 18},${c + s * 8} C${x1 + 40},${c + s * 22} ${x1 + 52},${c + s * 14} ${x1 + 56},${c + s * 2} L${x1 + 48},${c + s * 6} C${x1 + 42},${c + s * 14} ${x1 + 32},${c + s * 14} ${x1 + 22},${c + s * 4} Z" fill="${o.hornCol ?? o.c2}" ${T(2.4)}/><path d="M${x1 + 36},${c + s * 14} l4,${-s * 6}" ${T(2)}/>`).join(''),
    rhino: `<path d="M${x1 + 18},${c - 4} C${x1 + 36},${c - 6} ${x1 + 46},${c - 14} ${x1 + 50},${c - 26} L${x1 + 56},${c - 22} L${x1 + 48},${c - 10} C${x1 + 44},${c + 2} ${x1 + 30},${c + 6} ${x1 + 18},${c + 4} Z" fill="${o.hornCol ?? o.c2}" ${T(2.4)}/>`,
    hercules: `<path d="M${x1 - 4},${c - 4} C${x1 + 30},${c - 8} ${x1 + 58},${c - 6} ${x1 + 66},${c + 4} L${x1 + 58},${c + 2} L${x1 + 52},${c + 8} C${x1 + 40},${c + 2} ${x1 + 20},${c + 2} ${x1 - 4},${c + 4} Z" fill="${o.hornCol ?? INK}" ${T(2.4)}/>
      <path d="M${x1 + 18},${c + 3} C${x1 + 34},${c + 8} ${x1 + 44},${c + 12} ${x1 + 48},${c + 20} L${x1 + 40},${c + 18} C${x1 + 34},${c + 12} ${x1 + 26},${c + 10} ${x1 + 18},${c + 8} Z" fill="${o.hornCol ?? INK}" ${T(2.2)}/>`,
    long: [-1, 1].map((s) => `<path d="M${x1 + 22},${c + s * 5} C${x1 + 50},${c + s * 22} ${x1 + 40},${c + s * 52} ${x1 + 10},${c + s * 60}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x1 + 22},${c + s * 5} C${x1 + 50},${c + s * 22} ${x1 + 40},${c + s * 52} ${x1 + 10},${c + s * 60}" fill="none" stroke="${o.antCol ?? '#8fa0c8'}" stroke-width="2.8" stroke-dasharray="7 5" stroke-linecap="round"/>`).join(''),
    short: antennae(x1 + 22, c, 18),
  }
  const pat = (o.pattern ?? []).map((p) => p(c, x0, x1, hw)).join('')
  return `<defs>${rg(id + 'b', o.c1, o.c2)}<clipPath id="${id}c"><path d="${shell}"/></clipPath></defs>
  <g class="bug">
    ${o.aura ?? ''}
    ${legs(x0 + 20, x1 - 10, c, hw + 14)}
    ${horns[o.horn ?? 'short']}
    <ellipse cx="${x1 + 4}" cy="${c}" rx="14" ry="${hw * 0.55}" fill="${o.pron ?? o.c2}" ${S}/>
    <ellipse cx="${x1 + 18}" cy="${c}" rx="8" ry="${Math.max(8, hw * 0.32)}" fill="${o.headCol ?? o.pron ?? o.c2}" ${S}/>
    <path d="${shell}" fill="url(#${id}b)"/>
    <g clip-path="url(#${id}c)">${pat}${shine(x0 + (x1 - x0) * 0.55, c - hw * 0.45, 22 * L, 6)}</g>
    <path d="${shell}" fill="none" ${S}/>
    <path d="M${x1},${c} L${x0 + 2},${c}" ${T(2.4)}/>
    ${eyes(x1 + 22, c, 2.6, Math.max(6, hw * 0.24))}
  </g>`
}
const dots = (col, pts, r = 6) => () => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`).join('')
const stripesL = (col, n) => (c, x0, x1, hw) => Array.from({ length: n }, (_, i) => `<path d="M${x0},${c - hw + ((i + 0.5) * hw * 2) / n} L${x1},${c - hw + ((i + 0.5) * hw * 2) / n}" stroke="${col}" stroke-width="3"/>`).join('')
const speckles = (col, n, seed) => (c, x0, x1, hw) => {
  let s = seed, out = ''
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) out += `<circle cx="${(x0 + R() * (x1 - x0)).toFixed(1)}" cy="${(c - hw + R() * hw * 2).toFixed(1)}" r="${(1.5 + R() * 2.5).toFixed(1)}" fill="${col}"/>`
  return out
}

/* ── 잠자리: 긴 몸 + 투명한 날개 넷 ── */
function dragonfly(o) {
  const c = 65
  const wing = (x, s, len) => `<path d="M${x},${c + s * 3} C${x - 6},${c + s * 20} ${x - 10},${c + s * len} ${x + 4},${c + s * (len + 2)} C${x + 14},${c + s * len} ${x + 10},${c + s * 20} ${x + 6},${c + s * 3} Z" fill="rgba(220,240,255,0.55)" ${T(2)}/>`
  return `<g class="bug">
    ${[-1, 1].map((s) => wing(120, s, 54) + wing(104, s, 50)).join('')}
    ${[-1, 1].map((s) => `<path d="M118,${c + s * 22} L122,${c + s * 46} M104,${c + s * 20} L106,${c + s * 42}" stroke="rgba(31,26,77,0.3)" stroke-width="1.5"/>`).join('')}
    <path d="M28,${c} L104,${c}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <path d="M28,${c} L104,${c}" stroke="${o.tail}" stroke-width="7" stroke-linecap="round"/>
    ${[40, 52, 64, 76, 88].map((x) => `<path d="M${x},${c - 3} L${x},${c + 3}" stroke="${o.ring ?? INK}" stroke-width="2"/>`).join('')}
    <ellipse cx="116" cy="${c}" rx="16" ry="9" fill="${o.chest}" ${S}/>
    <circle cx="138" cy="${c - 8}" r="9" fill="${o.eye}" ${S}/>
    <circle cx="138" cy="${c + 8}" r="9" fill="${o.eye}" ${S}/>
    ${shine(140, c - 11, 3, 2)}${shine(140, c + 5, 3, 2)}
  </g>`
}

/* ── 메뚜기·귀뚜라미·방아깨비: 옆에서 본 긴 몸 + 큰 뒷다리 ── */
function hopper(o) {
  const id = `h${uid++}`
  const c = 70, L = o.len ?? 1
  const x0 = 100 - 62 * L, x1 = 100 + 40 * L
  const body = `M${x1},${c - 8} C${x1 - 10},${c - 22} ${x0 + 20},${c - 20} ${x0},${c - 4} C${x0 + 10},${c + 12} ${x1 - 10},${c + 14} ${x1},${c + 4} Z`
  return `<defs>${lg(id, o.c1, o.c2)}</defs>
  <g class="bug">
    <path d="M${x0 + 40},${c - 6} L${x0 + 18},${c - 40} L${x0 - 6},${c + 26}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M${x0 + 40},${c - 6} L${x0 + 18},${c - 40} L${x0 - 6},${c + 26}" fill="none" stroke="${o.c1}" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M${x1 - 12},${c + 6} l-6,26 M${x1 - 28},${c + 8} l-4,24" fill="none" ${T(2.6)}/>
    ${o.wing ? `<path d="M${x1 - 12},${c - 14} C${x0 + 40},${c - 26} ${x0 + 6},${c - 18} ${x0 - 6},${c - 8} C${x0 + 20},${c - 2} ${x1 - 30},${c - 2} ${x1 - 12},${c - 8} Z" fill="${o.wing}" ${T(2.2)}/>` : ''}
    <path d="${body}" fill="url(#${id})" ${S}/>
    ${o.stripe ? `<path d="M${x0 + 8},${c + 2} C${x0 + 40},${c + 8} ${x1 - 30},${c + 8} ${x1 - 4},${c}" fill="none" stroke="${o.stripe}" stroke-width="3"/>` : ''}
    <path d="M${x1 - 4},${c - 10} C${x1 + 8},${c - 18} ${x1 + 22},${c - 10} ${x1 + 22},${c + 2} C${x1 + 20},${c + 12} ${x1 + 6},${c + 14} ${x1 - 4},${c + 6} Z" fill="${o.c1}" ${S}/>
    <circle cx="${x1 + 10}" cy="${c - 4}" r="4.5" fill="${INK}"/><circle cx="${x1 + 11.5}" cy="${c - 5.5}" r="1.4" fill="#fff"/>
    <path d="M${x1 + 16},${c - 12} C${x1 + 40},${c - (o.ant ?? 30)} ${x1 + 50},${c - (o.ant ?? 30) - 6} ${x1 + 56},${c - (o.ant ?? 30) - 4}" fill="none" ${T(2.2)}/>
  </g>`
}

/* ── 그 밖 ── */
function bee() {
  const c = 65
  return `<g class="bug">
    ${[-1, 1].map((s) => `<ellipse cx="96" cy="${c + s * 22}" rx="26" ry="14" transform="rotate(${s * -20} 96 ${c + s * 22})" fill="rgba(225,240,255,0.7)" ${T(2.2)}/>`).join('')}
    ${legs(90, 116, c, 30)}
    <ellipse cx="78" cy="${c}" rx="34" ry="22" fill="#ffc83a" ${S}/>
    ${[66, 82, 98].map((x) => `<path d="M${x},${c - 20} Q${x - 4},${c} ${x},${c + 20}" stroke="${INK}" stroke-width="7" fill="none"/>`).join('')}
    <path d="M44,${c} l-12,0" ${T(3)}/>
    <circle cx="118" cy="${c}" r="12" fill="#5a4030" ${S}/>
    <circle cx="136" cy="${c}" r="12" fill="#3a2f2a" ${S}/>
    ${eyes(140, c, 3, 7)}${antennae(146, c, 20)}
    ${shine(70, c - 10, 12, 4)}
  </g>`
}
function ant() {
  const c = 65
  return `<g class="bug">
    ${legs(96, 120, c, 34, 3)}
    <ellipse cx="62" cy="${c}" rx="30" ry="22" fill="#3a2a26" ${S}/>
    <circle cx="96" cy="${c}" r="9" fill="#3a2a26" ${S}/>
    <ellipse cx="118" cy="${c}" rx="16" ry="12" fill="#3a2a26" ${S}/>
    <circle cx="146" cy="${c}" r="16" fill="#3a2a26" ${S}/>
    <path d="M160,${c - 6} l10,-4 M160,${c + 6} l10,4" ${T(3)}/>
    ${eyes(152, c, 3, 8)}
    ${[-1, 1].map((s) => `<path d="M150,${c + s * 12} L162,${c + s * 32} L182,${c + s * 38}" fill="none" ${T(2.4)}/>`).join('')}
    ${shine(56, c - 10, 12, 4)}${shine(144, c - 7, 6, 3)}
  </g>`
}
function cicada() {
  const c = 65
  return `<g class="bug">
    ${[-1, 1].map((s) => `<path d="M124,${c + s * 10} C100,${c + s * 46} 40,${c + s * 40} 22,${c + s * 12} C40,${c + s * 6} 100,${c + s * 4} 124,${c + s * 6} Z" fill="rgba(220,240,230,0.6)" ${T(2.2)}/><path d="M118,${c + s * 12} C90,${c + s * 30} 54,${c + s * 26} 30,${c + s * 12}" fill="none" stroke="rgba(31,26,77,0.35)" stroke-width="1.6"/>`).join('')}
    <ellipse cx="96" cy="${c}" rx="38" ry="18" fill="#4a5a3a" ${S}/>
    <path d="M70,${c - 14} Q60,${c} 70,${c + 14} M84,${c - 17} Q74,${c} 84,${c + 17}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <ellipse cx="136" cy="${c}" rx="14" ry="22" fill="#5d6b44" ${S}/>
    <path d="M128,${c - 12} L140,${c} L128,${c + 12}" fill="none" stroke="#b9c36a" stroke-width="2.5"/>
    <circle cx="150" cy="${c - 16}" r="6" fill="#b04a3a" ${S}/><circle cx="150" cy="${c + 16}" r="6" fill="#b04a3a" ${S}/>
  </g>`
}
function mantis() {
  const c = 74
  return `<g class="bug">
    <path d="M30,${c} C50,${c - 14} 90,${c - 12} 110,${c - 4} C90,${c + 8} 50,${c + 10} 30,${c} Z" fill="#7cc24a" ${S}/>
    <path d="M40,${c - 4} C60,${c - 14} 90,${c - 12} 106,${c - 6}" fill="none" stroke="#a7dd6a" stroke-width="3"/>
    <path d="M100,${c + 2} l-10,28 M76,${c + 4} l-6,28 M60,${c + 4} l-10,26" fill="none" ${T(2.6)}/>
    <path d="M108,${c - 4} L140,${c - 26}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M108,${c - 4} L140,${c - 26}" stroke="#7cc24a" stroke-width="5" stroke-linecap="round"/>
    <path d="M132,${c - 20} L150,${c + 4} L160,${c - 14}" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M132,${c - 20} L150,${c + 4} L160,${c - 14}" fill="none" stroke="#9bd35a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M136,${c - 34} L162,${c - 40} L148,${c - 22} Z" fill="#8fd04f" ${S}/>
    <circle cx="160" cy="${c - 39}" r="5" fill="#d7f08a" ${T(2)}/><circle cx="161" cy="${c - 39}" r="2" fill="${INK}"/>
    <path d="M158,${c - 44} C170,${c - 64} 182,${c - 66} 190,${c - 60}" fill="none" ${T(2)}/>
  </g>`
}
function stick() {
  const c = 65
  return `<g class="bug">
    ${[50, 96, 126].map((x, i) => [-1, 1].map((s) => `<path d="M${x},${c} L${x + (i - 1) * 10},${c + s * 22} L${x + (i - 1) * 22},${c + s * 40}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x},${c} L${x + (i - 1) * 10},${c + s * 22} L${x + (i - 1) * 22},${c + s * 40}" fill="none" stroke="#9a7a4a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')).join('')}
    <path d="M14,${c} L160,${c}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <path d="M14,${c} L160,${c}" stroke="#a8875a" stroke-width="7" stroke-linecap="round"/>
    ${[40, 70, 100, 130].map((x) => `<path d="M${x},${c - 3} L${x},${c + 3}" stroke="#6b5232" stroke-width="2"/>`).join('')}
    <circle cx="166" cy="${c}" r="8" fill="#a8875a" ${S}/>
    ${[-1, 1].map((s) => `<path d="M172,${c + s * 3} L196,${c + s * 12}" fill="none" ${T(2)}/>`).join('')}
  </g>`
}
function firefly() {
  const c = 65
  return `<g class="bug">
    <circle cx="66" cy="${c}" r="40" fill="rgba(230,255,120,0.28)"/>
    <circle cx="66" cy="${c}" r="26" fill="rgba(230,255,120,0.45)"/>
    ${legs(90, 120, c, 28)}
    <path d="M136,${c} C136,${c - 26} 60,${c - 28} 48,${c - 10} C44,${c} 44,${c} 48,${c + 10} C60,${c + 28} 136,${c + 26} 136,${c} Z" fill="#3a3530" ${S}/>
    <path d="M48,${c - 10} C44,${c} 44,${c} 48,${c + 10} C60,${c + 22} 80,${c + 22} 80,${c} C80,${c - 22} 60,${c - 22} 48,${c - 10} Z" fill="#eaff7a" ${T(2.4)}/>
    <path d="M136,${c} L72,${c}" ${T(2.2)}/>
    <ellipse cx="142" cy="${c}" rx="10" ry="14" fill="#e86a4a" ${S}/>
    <circle cx="154" cy="${c}" r="7" fill="#2f2a26" ${S}/>
    ${antennae(158, c, 20)}
  </g>`
}

/* ── 꽝 ── */
function leaf() {
  return `<g class="bug">
    <path d="M30,70 C60,20 140,14 176,52 C140,104 70,112 30,70 Z" fill="#7cb84a" ${S}/>
    <path d="M30,70 C80,60 130,56 176,52" fill="none" ${T(2.4)}/>
    ${[60, 90, 120, 150].map((x, i) => `<path d="M${x},${66 - i * 3} L${x + 16},${40 - i * 2} M${x},${66 - i * 3} L${x + 14},${90 - i * 6}" stroke="#4f8a2e" stroke-width="2"/>`).join('')}
    <path d="M30,70 L12,84" ${T(3)}/>
    <circle cx="120" cy="80" r="7" fill="#c9a24a" opacity="0.8"/>
  </g>`
}
function twig() {
  return `<g class="bug">
    <path d="M18,86 L180,46" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
    <path d="M18,86 L180,46" stroke="#8a6a44" stroke-width="9" stroke-linecap="round"/>
    <path d="M90,68 L120,26" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M90,68 L120,26" stroke="#8a6a44" stroke-width="5" stroke-linecap="round"/>
    <path d="M140,56 L160,88" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M140,56 L160,88" stroke="#8a6a44" stroke-width="4" stroke-linecap="round"/>
    <path d="M120,26 c6,-8 18,-6 16,4 c-8,2 -14,0 -16,-4 Z" fill="#7cb84a" ${T(2)}/>
    ${[40, 70, 150].map((x) => `<path d="M${x},${86 - (x - 18) * 0.25} l6,-2" stroke="#5a4428" stroke-width="2"/>`).join('')}
  </g>`
}
function web() {
  const cx = 100, cy = 65
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return `<path d="M${cx},${cy} L${(cx + Math.cos(a) * 80).toFixed(1)},${(cy + Math.sin(a) * 56).toFixed(1)}" stroke="#e8ecf5" stroke-width="2"/>`
  }).join('')
  const rings = [16, 30, 44, 58, 72].map((r) => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.7).toFixed(1)}`
    })
    return `<path d="M${pts.join(' L')}" fill="none" stroke="#e8ecf5" stroke-width="1.6"/>`
  }).join('')
  return `<g class="bug"><g stroke="${INK}" stroke-width="5" opacity="0.5">${spokes.replace(/stroke="#e8ecf5" stroke-width="2"/g, '')}</g>${spokes}${rings}<circle cx="${cx + 30}" cy="${cy - 20}" r="3" fill="#cfe8ff"/><circle cx="${cx - 40}" cy="${cy + 14}" r="2.5" fill="#cfe8ff"/></g>`
}

const sparkle = (x, y, s = 6, col = '#fff7c2') => `<path d="M${x},${y - s} L${x + s * 0.28},${y - s * 0.28} L${x + s},${y} L${x + s * 0.28},${y + s * 0.28} L${x},${y + s} L${x - s * 0.28},${y + s * 0.28} L${x - s},${y} L${x - s * 0.28},${y - s * 0.28} Z" fill="${col}" stroke="${INK}" stroke-width="1.5"/>`
const legendAura = `<ellipse cx="100" cy="65" rx="96" ry="58" fill="rgba(255,200,90,0.16)"/>` + sparkle(24, 20, 7) + sparkle(182, 22, 5) + sparkle(170, 114, 6) + sparkle(30, 110, 4)

export const BUG_ART: Record<string, () => string> = {
  whitebfly: () => butterfly({ f1: '#fbfbf4', f2: '#eef0e2', h1: '#f7f7ee', h2: '#fbfbf4', body: '#4a4a44', pattern: [wingSpots('#3a3a38', [[150, 30], [150, 100]], 5), (c) => `<path d="M160,${c - 56} L178,${c - 48} M160,${c + 56} L178,${c + 48}" stroke="#555" stroke-width="7"/>`] }),
  ladybug: () => beetle({ c1: '#ff5a44', c2: '#c8261a', pron: '#1f1a2e', headCol: '#1f1a2e', len: 0.75, wid: 1.05, horn: 'short', pattern: [dots(INK, [[74, 44], [74, 86], [96, 54], [96, 76], [52, 60], [52, 70]], 6)] }),
  reddfly: () => dragonfly({ tail: '#e8432f', chest: '#c8462e', eye: '#d44a3a', ring: '#8a1f14' }),
  grasshopper: () => hopper({ c1: '#8fcf4a', c2: '#5c9a2e', wing: '#a5d66a', stripe: '#d8f08a', ant: 22 }),
  cricket: () => hopper({ c1: '#5a3c2a', c2: '#2e1f16', wing: '#3f2a1e', len: 0.8, ant: 46 }),
  honeybee: () => bee(),
  ant: () => ant(),
  cicada: () => cicada(),
  swallowtail: () => butterfly({ f1: '#ffe066', f2: '#f5c93a', h1: '#f5c93a', h2: '#ffe066', tail: true, pattern: [wingStripes(INK, [116, 132, 150, 168, 88, 70]), wingEdge(INK), (c) => eyeSpot(62, c - 46, 6, '#3f8fd0', '#e8473f') + eyeSpot(62, c + 46, 6, '#3f8fd0', '#e8473f')] }),
  mantis: () => mantis(),
  longhopper: () => hopper({ c1: '#9edb5a', c2: '#6aa83a', wing: '#c2e88a', len: 1.25, stripe: '#e9f7b8', ant: 14 }),
  bigdfly: () => dragonfly({ tail: '#3f9ad0', chest: '#5aa64a', eye: '#4ac0a0', ring: '#1f4a78' }),
  chafer: () => beetle({ c1: '#6ee08a', c2: '#2a8a4a', len: 0.8, wid: 0.9, horn: 'short', pattern: [stripesL('rgba(255,255,255,0.18)', 4)] }),
  firefly: () => firefly(),
  stick: () => stick(),
  stag: () => beetle({ c1: '#6a3a24', c2: '#2a160e', horn: 'stag', hornCol: '#5a2f1c', len: 1, wid: 0.85 }),
  rhino: () => beetle({ c1: '#8a4a2a', c2: '#3a1e10', horn: 'rhino', hornCol: '#4a2614', len: 1.05, wid: 1.05 }),
  longhorn: () => beetle({ c1: '#3a3a44', c2: '#16161c', horn: 'long', antCol: '#e8ecf5', len: 0.95, wid: 0.7, pattern: [speckles('#e8ecf5', 14, 7)] }),
  jewel: () => beetle({ c1: '#6af0b0', c2: '#1f8a6a', pron: '#c84ac8', headCol: '#2a9a7a', horn: 'short', len: 1, wid: 0.75, pattern: [stripesL('rgba(220,60,200,0.55)', 2), stripesL('rgba(255,255,255,0.2)', 6)] }),
  morpho: () => butterfly({ f1: '#5ad8ff', f2: '#1f6ae0', h1: '#1f6ae0', h2: '#5ad8ff', pattern: [wingEdge('#1a1a3a'), wingVeins('rgba(255,255,255,0.3)'), wingSpots('#fff', [[168, 22], [168, 108], [60, 30], [60, 100]], 2.5)] }),
  bighorn: () => beetle({ c1: '#6a4a3a', c2: '#2e1e16', horn: 'long', antCol: '#c9a27a', len: 1.15, wid: 0.75, pattern: [speckles('#d9b48a', 22, 11)], aura: `<ellipse cx="100" cy="65" rx="90" ry="54" fill="rgba(199,155,255,0.14)"/>` }),
  atlas: () => butterfly({ moth: true, f1: '#e88a3a', f2: '#9a3a1e', h1: '#b2481e', h2: '#e88a3a', body: '#8a3a1e', pattern: [wingEdge('#f2d6a8'), wingVeins('rgba(60,20,10,0.45)'), (c) => [-1, 1].map((s) => `<path d="M140,${c + s * 28} l12,${s * 6} l-4,${s * 8} Z M70,${c + s * 30} l12,${s * 4} l-6,${s * 8} Z" fill="#fff8e6" stroke="${INK}" stroke-width="1.5"/>`).join('') + `<path d="M170,${c - 50} q8,-4 8,6 M170,${c + 50} q8,4 8,-6" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/>`], aura: `<ellipse cx="100" cy="65" rx="96" ry="58" fill="rgba(199,155,255,0.14)"/>` }),
  goliath: () => beetle({ c1: '#f5f0e0', c2: '#c9bfa8', pron: '#f5f0e0', headCol: '#2a2420', horn: 'short', len: 1.1, wid: 1.05, pattern: [stripesL('#2a2420', 5), (c, x0, x1) => `<rect x="${x0 - 4}" y="${c - 50}" width="22" height="100" fill="#3a2a20"/>`], aura: `<ellipse cx="100" cy="65" rx="92" ry="56" fill="rgba(199,155,255,0.14)"/>` }),
  hercules: () => beetle({ c1: '#e8d27a', c2: '#a08a3a', pron: '#1f1a16', headCol: '#1f1a16', horn: 'hercules', hornCol: '#1f1a16', len: 1.05, wid: 0.95, pattern: [speckles('#3a2a1a', 16, 5)], aura: legendAura }),
  birdwing: () => butterfly({ f1: '#3a3a44', f2: '#1a1a22', h1: '#7af0c8', h2: '#2ab08a', body: '#ffd23f', pattern: [wingStripes('#5af0d0', [150, 166]), (c) => [-1, 1].map((s) => `<path d="M104,${c + s * 6} C130,${c + s * 30} 150,${c + s * 44} 166,${c + s * 46}" fill="none" stroke="#5af0d0" stroke-width="5"/>`).join(''), wingSpots('#ffd23f', [[70, 30], [70, 100], [84, 40], [84, 90]], 4)], aura: legendAura }),
  leaf: () => leaf(),
  twig: () => twig(),
  web: () => web(),
}
