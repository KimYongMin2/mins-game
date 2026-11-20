import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// 낚시터 소품을 더 사실적으로 (사용자 요청 2026-11-18 '나무 돌 배 등등 모든 것 좀 더 사실적으로').
// 그림 파일 없이: 캔버스로 그린 질감(나무껍질·야자 잎·솔잎·나뭇잎·판자) + 휘고 가늘어지는 모양을 직접 만든 도형.
// 같은 질감·재질은 한 번만 만들어 나눠 씀 (폰 부담).

type Rnd = () => number
export const seeded = (seed: number): Rnd => {
  let s = Math.floor(Math.abs(seed * 9301 + 49297)) % 233280 || 1
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, opts: { repeat?: [number, number]; alpha?: boolean } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.repeat) t.repeat.set(...opts.repeat)
  t.anisotropy = 4
  return t
}

// ── 질감 ──
let cache: ReturnType<typeof makeKit> | null = null
/** 소품 재질 모음 (한 번만 만듦) */
export function kit() {
  return (cache ??= makeKit())
}

function makeKit() {
  const r = seeded(7)
  // 야자 껍질: 가로 고리 무늬
  const palmBark = canvas(64, 256, (g) => {
    g.fillStyle = '#8a6a48'
    g.fillRect(0, 0, 64, 256)
    for (let y = 0; y < 256; y += 10 + r() * 6) {
      g.fillStyle = `rgba(60,40,22,${0.5 + r() * 0.3})`
      g.fillRect(0, y, 64, 2 + r() * 2)
      g.fillStyle = 'rgba(190,160,120,0.35)'
      g.fillRect(0, y + 3, 64, 2)
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(50,35,20,${r() * 0.25})`
      g.fillRect(r() * 64, r() * 256, 1 + r() * 2, 10 + r() * 30)
    }
  })
  // 소나무·활엽수 껍질: 세로로 갈라진 무늬
  const bark = canvas(64, 256, (g) => {
    g.fillStyle = '#5e4330'
    g.fillRect(0, 0, 64, 256)
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${r() < 0.5 ? '30,20,12' : '120,95,70'},${0.3 + r() * 0.4})`
      g.lineWidth = 1 + r() * 2.5
      g.beginPath()
      let x = r() * 64
      g.moveTo(x, 0)
      for (let y = 0; y < 256; y += 16) g.lineTo((x += (r() - 0.5) * 6), y)
      g.stroke()
    }
  })
  // 야자 잎: 가운데 줄기 + 양쪽 잎조각 (투명 바탕)
  const frond = canvas(128, 512, (g) => {
    g.clearRect(0, 0, 128, 512)
    for (let y = 8; y < 504; y += 7) {
      const len = 58 * Math.sin((y / 512) * Math.PI) ** 0.6
      for (const s of [-1, 1]) {
        const grd = g.createLinearGradient(64, y, 64 + s * len, y + 26)
        grd.addColorStop(0, '#3d7a2c')
        grd.addColorStop(1, r() < 0.15 ? '#9a8a3a' : '#5fa83f')
        g.strokeStyle = grd
        g.lineWidth = 4.5
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(64, y)
        g.quadraticCurveTo(64 + s * len * 0.5, y + 4, 64 + s * len, y + 24 + r() * 6)
        g.stroke()
      }
    }
    g.strokeStyle = '#6b6a2e'
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(64, 0)
    g.lineTo(64, 512)
    g.stroke()
  })
  // 솔잎 덩어리
  const needles = canvas(128, 128, (g) => {
    g.fillStyle = '#244f2c'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = `rgba(${r() < 0.5 ? '70,120,60' : '20,50,28'},${0.4 + r() * 0.5})`
      g.lineWidth = 1
      const x = r() * 128, y = r() * 128, a = r() * Math.PI
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7)
      g.stroke()
    }
  }, { repeat: [3, 2] })
  // 나뭇잎 덩어리
  const leaves = canvas(128, 128, (g) => {
    g.fillStyle = '#3f7d31'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 500; i++) {
      const c = ['#2f6524', '#4f9440', '#6db554', '#3a7a2e', '#8cc96a'][Math.floor(r() * 5)]
      g.fillStyle = c
      g.globalAlpha = 0.5 + r() * 0.5
      g.beginPath()
      g.ellipse(r() * 128, r() * 128, 2 + r() * 4, 1.5 + r() * 2.5, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }, { repeat: [2, 2] })
  // 판자 (나뭇결 + 판자 사이 줄)
  const planks = canvas(256, 256, (g) => {
    g.fillStyle = '#a7774a'
    g.fillRect(0, 0, 256, 256)
    for (let p = 0; p < 8; p++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,200'},${r() * 0.12})`
      g.fillRect(0, p * 32, 256, 32)
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = `rgba(80,50,25,${0.15 + r() * 0.2})`
        g.lineWidth = 1
        g.beginPath()
        const y = p * 32 + r() * 32
        g.moveTo(0, y)
        g.bezierCurveTo(80, y + (r() - 0.5) * 8, 170, y + (r() - 0.5) * 8, 256, y)
        g.stroke()
      }
      g.fillStyle = 'rgba(50,30,15,0.7)'
      g.fillRect(0, p * 32 + 30, 256, 2)
      // 못
      g.fillStyle = 'rgba(40,40,40,0.6)'
      g.fillRect(20 + r() * 10, p * 32 + 14, 3, 3)
      g.fillRect(226 + r() * 10, p * 32 + 14, 3, 3)
    }
  })
  // 낡은 나무 (울타리·상자)
  const weathered = canvas(128, 128, (g) => {
    g.fillStyle = '#9c8466'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(${r() < 0.6 ? '70,55,40' : '200,185,160'},${0.25 + r() * 0.3})`
      g.lineWidth = 1
      g.beginPath()
      const x = r() * 128
      g.moveTo(x, 0)
      g.lineTo(x + (r() - 0.5) * 8, 128)
      g.stroke()
    }
  })
  // 배 바깥: 겹쳐 붙인 판자(줄) + 페인트 (색은 재질 color로 곱함)
  const hull = canvas(256, 256, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = 'rgba(0,0,0,0.18)'
      g.fillRect(0, y + 28, 256, 4)
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.fillRect(0, y, 256, 2)
    }
    // 벗겨진 페인트 자국
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(140,110,80,${r() * 0.35})`
      g.fillRect(r() * 256, r() * 256, 2 + r() * 10, 1 + r() * 3)
    }
  })
  // 바위: 얼룩 + 이끼 점
  const rock = canvas(128, 128, (g) => {
    g.fillStyle = '#8a8d92'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 700; i++) {
      g.fillStyle = ['#6f7378', '#a4a7ab', '#7d7a72', '#5d6166', '#b3b1aa'][Math.floor(r() * 5)]
      g.globalAlpha = 0.25 + r() * 0.5
      g.fillRect(r() * 128, r() * 128, 1 + r() * 4, 1 + r() * 4)
    }
    g.globalAlpha = 1
  }, { repeat: [2, 2] })
  const M = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o })
  return {
    palmBarkM: M({ map: palmBark }),
    barkM: M({ map: bark }),
    frondM: M({ map: frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }),
    needleM: M({ map: needles, vertexColors: true }),
    leafM: M({ map: leaves, vertexColors: true, roughness: 0.8 }),
    plankM: M({ map: planks, roughness: 0.8 }),
    weatheredM: M({ map: weathered }),
    rockM: M({ map: rock, vertexColors: true, roughness: 0.95 }),
    hullTex: hull,
    coconutM: M({ color: '#5a3d22', roughness: 0.7 }),
    metalM: M({ color: '#2d3140', roughness: 0.45, metalness: 0.6 }),
    ropeM: M({ color: '#c9b58a' }),
    whiteM: M({ color: '#f4f2ec', roughness: 0.6 }),
  }
}

// ── 바위: 여러 겹 잡음으로 울퉁불퉁, 위는 이끼 색, 아래는 모래 색 ──
export function rockGeo(size: number, seed: number, opts: { moss?: boolean; flat?: number; detail?: number } = {}) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(size, opts.detail ?? 2)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const r = seeded(seed)
  const o = [r() * 10, r() * 10, r() * 10]
  const n3 = (x: number, y: number, z: number) => Math.sin(x + o[0]) * Math.cos(y * 1.3 + o[1]) * Math.sin(z * 0.9 + o[2])
  const flat = opts.flat ?? 0.7
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / size, y = p.getY(i) / size, z = p.getZ(i) / size
    let k = 1 + n3(x * 2.1, y * 2.1, z * 2.1) * 0.22 + n3(x * 5.3, y * 5.3, z * 5.3) * 0.08 + n3(x * 11, y * 11, z * 11) * 0.03
    // 깎인 면 (평평한 단면이 조금씩)
    if (n3(x * 1.3, y * 1.7, z * 1.1) > 0.35) k *= 0.93
    p.setXYZ(i, x * size * k, y * size * k * flat, z * size * k)
  }
  g.computeVertexNormals()
  // 색: 위쪽은 이끼, 아래쪽은 젖은 모래 빛, 나머지는 회색 얼룩
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const ny = nrm.getY(i), y = p.getY(i) / size
    const shade = 0.85 + n3(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3) * 0.15
    c.setRGB(shade, shade, shade * 1.02)
    if (opts.moss !== false && ny > 0.55 && y > 0.1) c.lerp(new THREE.Color('#6f8f4a'), Math.min(1, (ny - 0.55) * 2.2) * 0.75)
    if (y < -0.35) c.lerp(new THREE.Color('#b8a27a'), 0.45)
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  // uv: 위에서 내려다본 좌표 (질감만 깔면 됨)
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) uv.set([p.getX(i) * 0.5, p.getZ(i) * 0.5 + p.getY(i) * 0.3], i * 2)
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** 길을 따라 가늘어지는 관 (줄기·가지) */
function taperTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg = 14, radial = 9) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const pt = new THREE.Vector3()
  for (let s = 0; s <= seg; s++) {
    const t = s / seg
    curve.getPointAt(t, pt)
    const rad = r0 + (r1 - r0) * t
    for (let k = 0; k <= radial; k++) {
      const i = s * (radial + 1) + k
      p.setXYZ(i, pt.x + (p.getX(i) - pt.x) * rad, pt.y + (p.getY(i) - pt.y) * rad, pt.z + (p.getZ(i) - pt.z) * rad)
    }
  }
  g.computeVertexNormals()
  // 껍질 무늬가 줄기 길이만큼 반복되게
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  const len = curve.getLength()
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * len * 0.8)
  return g
}

// ── 야자수: 휜 줄기(고리 무늬) + 늘어진 깃털 잎 + 코코넛 ──
export function makePalm(scale: number, seed: number) {
  const K = kit()
  const r = seeded(seed)
  const g = new THREE.Group()
  const lean = (r() - 0.5) * 2
  const dir = r() * Math.PI * 2
  const H = 5.2 + r() * 1.6
  const dx = Math.cos(dir) * lean * 1.4, dz = Math.sin(dir) * lean * 1.4
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(dx * 0.25, H * 0.35, dz * 0.25),
    new THREE.Vector3(dx * 0.7, H * 0.7, dz * 0.7),
    new THREE.Vector3(dx, H, dz),
  ])
  const trunk = new THREE.Mesh(taperTube(curve, 0.24, 0.15, 16, 10), K.palmBarkM)
  g.add(trunk)
  // 밑동 볼록
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8).scale(1, 0.55, 1), K.palmBarkM)
  g.add(base)
  // 잎: 정수리에서 사방으로, 처음엔 위로 갔다가 끝으로 갈수록 축 늘어짐
  const top = curve.getPoint(1)
  const fronds: THREE.BufferGeometry[] = []
  const N = 11
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + r() * 0.4
    const L = 2.6 + r() * 0.9
    const W = 0.95 + r() * 0.25
    const rise = 0.55 + r() * 0.5
    const droop = 1.6 + r() * 0.9
    const sx = Math.cos(a), sz = Math.sin(a)
    const segs = 10
    const pos: number[] = [], uv: number[] = [], idx: number[] = []
    for (let s = 0; s <= segs; s++) {
      const v = s / segs
      const along = v * L
      const y = along * rise - droop * v * v * L * 0.5
      for (const u of [-1, 0, 1]) {
        const w = (W / 2) * u * Math.sin(Math.min(1, v * 1.2 + 0.08) * Math.PI) ** 0.7
        // 잎은 V자로 접혀 있음 (가장자리가 조금 위)
        const fold = Math.abs(u) * 0.18 * (1 - v * 0.5)
        pos.push(top.x + sx * along - sz * w, top.y + y + fold, top.z + sz * along + sx * w)
        uv.push((u + 1) / 2, 1 - v)
      }
    }
    for (let s = 0; s < segs; s++)
      for (let k = 0; k < 2; k++) {
        const a0 = s * 3 + k, b0 = a0 + 3
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1)
      }
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    fg.setIndex(idx)
    fg.computeVertexNormals()
    fronds.push(fg)
  }
  g.add(new THREE.Mesh(mergeGeometries(fronds)!, K.frondM))
  // 코코넛 송이
  for (let i = 0; i < 4 + Math.floor(r() * 3); i++) {
    const a = r() * Math.PI * 2
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.15, 1), K.coconutM)
    c.position.set(top.x + Math.cos(a) * 0.2, top.y - 0.18 - r() * 0.12, top.z + Math.sin(a) * 0.2)
    g.add(c)
  }
  g.scale.setScalar(scale)
  return { group: g, height: H * scale }
}

// ── 소나무: 껍질 줄기 + 아래로 처지는 들쭉날쭉한 잎 층 ──
export function makePine(scale: number, seed: number) {
  const K = kit()
  const r = seeded(seed)
  const g = new THREE.Group()
  const H = 6 + r() * 2
  const trunk = new THREE.Mesh(taperTube(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3((r() - 0.5) * 0.2, H * 0.85, (r() - 0.5) * 0.2)), 0.26, 0.06, 6, 9), K.barkM)
  g.add(trunk)
  const layers: THREE.BufferGeometry[] = []
  const n = 6
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const rad = 2.1 * (1 - t * 0.78) + r() * 0.2
    const h = 1.5 - t * 0.4
    const y = 1.6 + t * (H - 2.6)
    let cg: THREE.BufferGeometry = new THREE.ConeGeometry(rad, h, 14, 3, true)
    cg.deleteAttribute('normal')
    const uvKeep = cg.getAttribute('uv').clone()
    cg.deleteAttribute('uv')
    cg = mergeVertices(cg)
    const p = cg.getAttribute('position') as THREE.BufferAttribute
    const col = new Float32Array(p.count * 3)
    const dark = new THREE.Color('#5a7d5a'), light = new THREE.Color('#ffffff'), c = new THREE.Color()
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), yy = p.getY(k), z = p.getZ(k)
      const edge = (yy + h / 2) / h // 0 = 아래 끝, 1 = 꼭대기
      const ang = Math.atan2(z, x)
      // 아래 가장자리는 들쭉날쭉하고 끝이 처짐
      const jag = edge < 0.4 ? 1 + Math.sin(ang * 7 + i * 2) * 0.12 + (r() - 0.5) * 0.12 : 1
      const sag = edge < 0.35 ? (0.35 - edge) * 0.5 : 0
      p.setXYZ(k, x * jag, yy - sag, z * jag)
      c.copy(dark).lerp(light, 0.35 + edge * 0.65)
      col.set([c.r, c.g, c.b], k * 3)
    }
    cg.setAttribute('color', new THREE.BufferAttribute(col, 3))
    if (uvKeep.count === p.count) cg.setAttribute('uv', uvKeep)
    else {
      const uv = new Float32Array(p.count * 2)
      for (let k = 0; k < p.count; k++) uv.set([Math.atan2(p.getZ(k), p.getX(k)) / Math.PI, p.getY(k)], k * 2)
      cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    }
    cg.computeVertexNormals()
    cg.rotateY(r() * Math.PI)
    cg.translate(0, y, 0)
    layers.push(cg)
  }
  g.add(new THREE.Mesh(mergeGeometries(layers)!, K.needleM))
  g.scale.setScalar(scale * 0.8)
  return { group: g, height: H * scale * 0.8 }
}

// ── 둥근 나무: 가지 뻗은 줄기 + 울퉁불퉁한 잎 덩어리 여러 개 (덩어리마다 색이 조금씩) ──
export function makeTree(scale: number, seed: number, fruit = false) {
  const K = kit()
  const r = seeded(seed)
  const g = new THREE.Group()
  const H = 2.4 + r() * 0.6
  const parts: THREE.BufferGeometry[] = [taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, H * 0.5, 0), new THREE.Vector3(-0.05, H, 0.05)]), 0.28, 0.16, 8, 9)]
  const tips: THREE.Vector3[] = [new THREE.Vector3(0, H + 0.8, 0)]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r()
    const from = new THREE.Vector3(0, H * (0.6 + r() * 0.3), 0)
    const to = new THREE.Vector3(Math.cos(a) * (1 + r() * 0.5), from.y + 0.9 + r() * 0.5, Math.sin(a) * (1 + r() * 0.5))
    parts.push(taperTube(new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.25, 0)), to]), 0.12, 0.05, 6, 6))
    tips.push(to)
  }
  g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!, K.barkM))
  const blobs: THREE.BufferGeometry[] = []
  const tones = ['#ffffff', '#d9e8c8', '#bcd5a6', '#e8f2d8']
  for (const tip of tips)
    for (let k = 0; k < 2; k++) {
      const rad = 0.9 + r() * 0.5
      let b: THREE.BufferGeometry = new THREE.IcosahedronGeometry(rad, 2)
      b.deleteAttribute('normal')
      b.deleteAttribute('uv')
      b = mergeVertices(b)
      const p = b.getAttribute('position') as THREE.BufferAttribute
      const ph = r() * 10
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
        const kk = 1 + Math.sin(x * 4 + ph) * Math.cos(y * 3.6 + ph) * Math.sin(z * 4.2) * 0.16
        p.setXYZ(i, x * kk, y * kk * 0.85, z * kk)
      }
      b.computeVertexNormals()
      const c = new THREE.Color(tones[Math.floor(r() * tones.length)])
      const col = new Float32Array(p.count * 3)
      const uv = new Float32Array(p.count * 2)
      for (let i = 0; i < p.count; i++) {
        // 아래쪽은 그늘져 어둡게
        const sh = 0.7 + Math.max(0, p.getY(i) / rad) * 0.3
        col.set([c.r * sh, c.g * sh, c.b * sh], i * 3)
        uv.set([p.getX(i) * 0.6, p.getY(i) * 0.6 + p.getZ(i) * 0.3], i * 2)
      }
      b.setAttribute('color', new THREE.BufferAttribute(col, 3))
      b.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      b.translate(tip.x + (r() - 0.5) * 0.6, tip.y + (r() - 0.5) * 0.4, tip.z + (r() - 0.5) * 0.6)
      blobs.push(b)
    }
  g.add(new THREE.Mesh(mergeGeometries(blobs)!, K.leafM))
  // 과수원 나무: 빨간 사과가 주렁주렁
  if (fruit) {
    const apples: THREE.BufferGeometry[] = []
    for (const tip of tips)
      for (let k = 0; k < 5; k++) {
        const a = r() * Math.PI * 2, e = r() * 1.2 - 0.3
        apples.push(new THREE.SphereGeometry(0.09, 8, 6).translate(tip.x + Math.cos(a) * 1.05, tip.y + e * 0.8, tip.z + Math.sin(a) * 1.05))
      }
    g.add(new THREE.Mesh(mergeGeometries(apples)!, new THREE.MeshStandardMaterial({ color: '#d8322a', roughness: 0.4 })))
  }
  g.scale.setScalar(scale)
  return { group: g, height: (H + 2) * scale }
}

// ── 나무배: 단면을 이어 만든 둥근 배 (바깥은 페인트 판자, 안쪽은 나무), 뱃전·가로대·노걸이·노 ──
export function makeBoat(color: string) {
  const K = kit()
  const g = new THREE.Group()
  const L = 3.5, W = 0.78, D = 0.62
  const ST = 16, SEC = 12
  // t: 0 = 고물(뒤, +z) → 1 = 이물(앞, -z)
  const half = (t: number) => (t < 0.62 ? W * (0.78 + 0.22 * Math.sin((t / 0.62) * Math.PI * 0.5)) : W * Math.cos(((t - 0.62) / 0.38) * Math.PI * 0.5) ** 0.85)
  const sheer = (t: number) => D + 0.12 * (t - 0.4) ** 2 * 2.4 // 앞뒤가 살짝 들림
  const depth = (t: number) => D * (1 - 0.25 * t * t)
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let s = 0; s <= ST; s++) {
    const t = s / ST
    const z = L / 2 - t * L
    const w = Math.max(0.02, half(t)), top = sheer(t), d = depth(t)
    for (let k = 0; k <= SEC; k++) {
      const th = (k / SEC) * Math.PI
      const sn = Math.sin(th)
      pos.push(Math.cos(th) * w, top - d * sn ** 0.65, z)
      uv.push(t * 2, k / SEC)
    }
  }
  for (let s = 0; s < ST; s++)
    for (let k = 0; k < SEC; k++) {
      const a = s * (SEC + 1) + k, b = a + SEC + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const hullG = new THREE.BufferGeometry()
  hullG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  hullG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  hullG.setIndex(idx)
  hullG.computeVertexNormals()
  const paint = new THREE.MeshStandardMaterial({ map: K.hullTex, color, roughness: 0.55, side: THREE.FrontSide })
  const inside = new THREE.MeshStandardMaterial({ map: K.plankM.map, roughness: 0.85, side: THREE.BackSide })
  g.add(new THREE.Mesh(hullG, paint), new THREE.Mesh(hullG, inside))
  // 고물판 (뒤 막음)
  const tr = new THREE.Shape()
  const w0 = half(0), t0 = sheer(0), d0 = depth(0)
  for (let k = 0; k <= SEC; k++) {
    const th = (k / SEC) * Math.PI
    const x = Math.cos(th) * w0, y = t0 - d0 * Math.sin(th) ** 0.65
    if (k === 0) tr.moveTo(x, y)
    else tr.lineTo(x, y)
  }
  const transom = new THREE.Mesh(new THREE.ShapeGeometry(tr), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }))
  transom.position.z = L / 2
  g.add(transom)
  // 뱃전 (위 테두리 나무)
  for (const side of [1, -1]) {
    const pts: THREE.Vector3[] = []
    for (let s = 0; s <= ST; s++) {
      const t = s / ST
      pts.push(new THREE.Vector3(side * Math.max(0.02, half(t)), sheer(t) + 0.02, L / 2 - t * L))
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.045, 6), K.plankM))
  }
  // 가로대 (앉는 판) · 바닥 깔판
  for (const t of [0.2, 0.5, 0.75]) {
    const w = half(t) * 1.9
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.28), K.plankM)
    seat.position.set(0, sheer(t) - 0.16, L / 2 - t * L)
    g.add(seat)
  }
  for (const x of [-0.18, 0, 0.18]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, L * 0.7), K.plankM)
    b.position.set(x, sheer(0.45) - depth(0.45) + 0.06, L / 2 - 0.45 * L)
    g.add(b)
  }
  // 노걸이 + 노 (뱃전에 걸쳐 뒤로 눕힘)
  for (const side of [1, -1]) {
    const t = 0.5
    const x = side * half(t), y = sheer(t) + 0.06, z = L / 2 - t * L
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI), K.metalM)
    lock.position.set(x, y + 0.02, z)
    lock.rotation.y = Math.PI / 2
    g.add(lock)
    const oar = new THREE.Group()
    oar.position.set(x, y + 0.04, z)
    oar.rotation.set(0, side * 0.12, 0)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.4, 6), K.plankM)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = 0.4
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.55).translate(0, 0, 0.27), K.plankM)
    blade.position.z = 1.55
    oar.add(shaft, blade)
    oar.rotation.z = side * -0.12
    g.add(oar)
  }
  // 이물 고리 + 감긴 밧줄
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), K.metalM)
  ring.position.set(0, sheer(1) - 0.05, -L / 2 + 0.08)
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), K.ropeM)
  coil.rotation.x = Math.PI / 2
  coil.position.set(0.1, sheer(0.9) - depth(0.9) + 0.12, -L / 2 + 0.55)
  g.add(ring, coil)
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  // 물 막이: 뱃전 안쪽을 덮는 안 보이는 판 (깊이만 씀) — 배를 먼저 그리고 이 판, 그다음 물을 그리면
  // 배 안에는 물이 안 그려짐 (물결이 배 바닥보다 높이 올라와 배 안이 잠겨 보였음). 물 쪽은 renderOrder 2
  const outline = new THREE.Shape()
  for (let s = 0; s <= ST; s++) {
    const t = s / ST
    const x = Math.max(0.02, half(t)) * 0.97, z = L / 2 - t * L
    if (s === 0) outline.moveTo(x, -z)
    else outline.lineTo(x, -z)
  }
  for (let s = ST; s >= 0; s--) {
    const t = s / ST
    outline.lineTo(-Math.max(0.02, half(t)) * 0.97, -(L / 2 - t * L))
  }
  const mask = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshBasicMaterial({ colorWrite: false }))
  mask.rotation.x = -Math.PI / 2
  mask.position.y = D - 0.03
  mask.renderOrder = 1
  g.add(mask)
  /** 가운데 앉는 판 윗면 높이 (배 기준) */
  g.userData.seatY = sheer(0.5) - 0.16 + 0.025
  /** 젓는 사람(먼저 탄 사람): 앞 판 (배 가운데에서 앞으로 seatFwd만큼) */
  g.userData.seatY2 = sheer(0.75) - 0.16 + 0.025
  g.userData.seatFwd = L * 0.25
  /** 같이 탄 사람(나중에 탄 사람): 뒤 판 (배 가운데에서 뒤로 seatBack만큼) */
  g.userData.seatY3 = sheer(0.2) - 0.16 + 0.025
  g.userData.seatBack = L * 0.3
  // 예전 배와 같은 크기·방향 (뱃머리 -z)
  return g
}

// ── 파라솔 (다시 디자인 — 사용자 요청 2026-11-18 '창살이 안 맞음'): 살은 정수리에서 천의 접힘선을 그대로 따라 가장자리까지,
// 천은 살과 살 사이가 살짝 처진 폭 8장(두 색 번갈아), 가장자리 반달 띠도 같은 폭에 맞춤, 아래엔 손잡이 링·지지대, 위엔 꼭지 ──
export function makeUmbrella(color: string) {
  const K = kit()
  const g = new THREE.Group()
  const R = 1.7, APEX = 3.12, EDGE = 2.62, N = 8
  const ca = new THREE.Color(color), cb = new THREE.Color('#f7f3ea')
  /** 살 위 점 (v: 정수리 0 → 가장자리 1) — 천은 위로 살짝 볼록 */
  const rib = (a: number, v: number, drop = 0) => new THREE.Vector3(Math.cos(a) * R * v, APEX + (EDGE - APEX) * v + Math.sin(v * Math.PI) * 0.07 - drop, Math.sin(a) * R * v)
  // 천: 폭마다 촘촘한 그물 (살 사이는 안쪽으로 조금 처짐)
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const U = 6, V = 7
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2
    const c = i % 2 ? ca : cb
    const base = pos.length / 3
    for (let vi = 0; vi <= V; vi++)
      for (let ui = 0; ui <= U; ui++) {
        const u = ui / U, v = vi / V
        const a = a0 + (a1 - a0) * u
        const sag = Math.sin(u * Math.PI) * v
        const p = rib(a, v * (1 - sag * 0.025), sag * 0.06)
        pos.push(p.x, p.y, p.z)
        col.push(c.r, c.g, c.b)
      }
    for (let vi = 0; vi < V; vi++)
      for (let ui = 0; ui < U; ui++) {
        const q = base + vi * (U + 1) + ui
        idx.push(q, q + U + 1, q + 1, q + 1, q + U + 1, q + U + 2)
      }
  }
  const cg = new THREE.BufferGeometry()
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  cg.setIndex(idx)
  cg.computeVertexNormals()
  const fabric = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.88 })
  g.add(new THREE.Mesh(cg, fabric))
  // 가장자리 반달 띠 (폭마다, 같은 색)
  const vpos: number[] = [], vcol: number[] = []
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2
    const c = i % 2 ? ca : cb
    const S = 8
    for (let k = 0; k < S; k++) {
      const t0 = k / S, t1 = (k + 1) / S
      const e0 = rib(a0 + (a1 - a0) * t0, 1 - Math.sin(t0 * Math.PI) * 0.025, Math.sin(t0 * Math.PI) * 0.06)
      const e1 = rib(a0 + (a1 - a0) * t1, 1 - Math.sin(t1 * Math.PI) * 0.025, Math.sin(t1 * Math.PI) * 0.06)
      const d0 = 0.05 + Math.sin(t0 * Math.PI) * 0.1, d1 = 0.05 + Math.sin(t1 * Math.PI) * 0.1
      const q = [[e0.x, e0.y, e0.z], [e1.x, e1.y, e1.z], [e1.x, e1.y - d1, e1.z], [e0.x, e0.y - d0, e0.z]]
      for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const n of tri) {
        vpos.push(...q[n])
        vcol.push(c.r, c.g, c.b)
      }
    }
  }
  const vg = new THREE.BufferGeometry()
  vg.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3))
  vg.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3))
  vg.computeVertexNormals()
  g.add(new THREE.Mesh(vg, fabric))
  // 살: 천 바로 밑에서 접힘선을 따라 (정확히 같은 곡선)
  const ribTubes: THREE.BufferGeometry[] = []
  const runnerY = 2.28
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const pts = Array.from({ length: 9 }, (_, k) => rib(a, 0.04 + (k / 8) * 0.96, 0.025))
    ribTubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.011, 5))
    // 끝 마개
    const tip = rib(a, 1, 0.025)
    ribTubes.push(new THREE.SphereGeometry(0.022, 6, 4).translate(tip.x, tip.y, tip.z))
    // 지지대: 손잡이 링 → 살 중간
    const mid = rib(a, 0.5, 0.03)
    const from = new THREE.Vector3(Math.cos(a) * 0.05, runnerY, Math.sin(a) * 0.05)
    ribTubes.push(new THREE.TubeGeometry(new THREE.LineCurve3(from, mid), 1, 0.008, 4))
  }
  g.add(new THREE.Mesh(mergeGeometries(ribTubes.map((t) => (t.index ? t.toNonIndexed() : t)))!, K.metalM))
  // 기둥: 나무 두 토막 + 쇠 이음새 + 손잡이 링 + 꼭지
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, APEX - 0.05, 10), K.plankM)
  pole.position.y = (APEX - 0.05) / 2
  g.add(pole)
  for (const y of [1.35, runnerY]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.08, 12), K.metalM).translateY(y))
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), K.metalM)
  knob.rotation.z = Math.PI / 2
  knob.position.set(0.09, 1.35, 0)
  g.add(knob)
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 10), K.metalM).translateY(APEX + 0.08))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), K.whiteM).translateY(APEX + 0.16))
  // 모래에 박은 자리
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8).scale(1, 0.22, 1), new THREE.MeshStandardMaterial({ color: '#d6bb82', roughness: 1 })))
  g.traverse((o) => (o.castShadow = true))
  return g
}

/** 썬베드 옆 작은 탁자: 음료(빨대·레몬) · 선글라스 · 선크림 */
export function makeSideTable(seed: number) {
  const K = kit()
  const r = seeded(seed)
  const g = new THREE.Group()
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 18), K.plankM)
  top.position.y = 0.5
  g.add(top)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 5), K.plankM)
    leg.position.set(Math.cos(a) * 0.16, 0.25, Math.sin(a) * 0.16)
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18)
    g.add(leg)
  }
  // 음료 잔
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.45, roughness: 0.05, side: THREE.DoubleSide }))
  glass.position.set(0.08, 0.59, 0.02)
  const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.1, 12), new THREE.MeshStandardMaterial({ color: ['#ff9a3c', '#e8473f', '#5fd0c0'][Math.floor(r() * 3)], roughness: 0.2 }))
  drink.position.set(0.08, 0.575, 0.02)
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), new THREE.MeshStandardMaterial({ color: '#ff5fa0' }))
  straw.position.set(0.1, 0.66, 0.02)
  straw.rotation.z = -0.3
  const lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), new THREE.MeshStandardMaterial({ color: '#f5e050' }))
  lemon.position.set(0.045, 0.655, 0.02)
  lemon.rotation.z = Math.PI / 2
  g.add(glass, drink, straw, lemon)
  // 선글라스
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.2, metalness: 0.3 })
  for (const sx of [-0.035, 0.035]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12), dark)
    lens.position.set(-0.1 + sx, 0.525, -0.06)
    g.add(lens)
  }
  // 선크림 통
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.5 }))
  tube.position.set(-0.05, 0.585, 0.11)
  g.add(tube, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 8), new THREE.MeshStandardMaterial({ color: '#e8473f' })).translateX(-0.05).translateY(0.655).translateZ(0.11))
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  return g
}

/** 모래 위 슬리퍼 한 켤레 */
export function makeFlipFlops(color: string) {
  const g = new THREE.Group()
  const sole = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  const strap = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.7 })
  for (const sx of [-0.09, 0.09]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.02, 12).scale(1, 1, 2.3), sole)
    s.position.set(sx, 0.012, 0)
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 10, Math.PI), strap)
    st.position.set(sx, 0.025, -0.02)
    g.add(s, st)
  }
  g.rotation.y = 0.4
  return g
}

// ── 물결 질감 (격자무늬 대신): 방향·크기가 제각각인 물결 40개를 겹친 높이로 만든 노멀 맵, 끝과 끝이 이어짐 ──
let waterNormCache: THREE.Texture | null = null
export function waterNormals() {
  if (waterNormCache) return waterNormCache
  const N = 256
  const r = seeded(31)
  const waves = Array.from({ length: 40 }, () => {
    // 정수 진동수라 타일 끝이 이어짐
    const fx = Math.round((r() - 0.5) * 18), fy = Math.round((r() - 0.5) * 18) || 1
    const f = Math.hypot(fx, fy)
    return { fx, fy, a: 1 / (0.6 + f), ph: r() * Math.PI * 2 }
  })
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  const img = g.createImageData(N, N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let dx = 0, dy = 0
      for (const w of waves) {
        const k = (2 * Math.PI) / N
        const cs = Math.cos(k * (w.fx * x + w.fy * y) + w.ph) * w.a
        dx += cs * w.fx * k
        dy += cs * w.fy * k
      }
      const nx = -dx * 9, ny = -dy * 9, l = Math.hypot(nx, ny, 1)
      const i = (y * N + x) * 4
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 4
  return (waterNormCache = t)
}

// ── 썬베드: 나무 틀 + 살 판 + 젖힌 등받이 + 둥근 쿠션(테두리 선) + 개어 둔 줄무늬 수건, 머리 쪽 바퀴 ──
// 크기·높이는 예전 그대로(눕는 자세가 맞게): 앉는 면 약 0.46m, 등받이는 머리 쪽(-z)에서 0.7rad
export function makeSunbed(color: string, seed: number) {
  const K = kit()
  const r = seeded(seed)
  const g = new THREE.Group()
  const wood = K.plankM
  const B = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    o.position.set(x, y, z)
    return o
  }
  // 옆 틀·다리
  for (const sx of [-0.43, 0.43]) {
    g.add(B(0.06, 0.09, 2.05, wood, sx, 0.3, 0.02))
    for (const z of [0.9, -0.85]) g.add(B(0.07, 0.3, 0.07, wood, sx, 0.15, z))
  }
  // 바퀴 (머리 쪽)
  for (const sx of [-0.43, 0.43]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), K.metalM)
    w.rotation.z = Math.PI / 2
    w.position.set(sx * 1.08, 0.07, -0.95)
    g.add(w)
  }
  // 앉는 살 판
  for (let i = 0; i < 9; i++) g.add(B(0.82, 0.03, 0.11, wood, 0, 0.36, -0.32 + i * 0.155))
  // 등받이 (경첩에서 젖힘)
  const back = new THREE.Group()
  back.position.set(0, 0.38, -0.38)
  back.rotation.x = 0.7
  for (let i = 0; i < 5; i++) back.add(B(0.82, 0.03, 0.11, wood, 0, 0, -0.08 - i * 0.15))
  for (const sx of [-0.4, 0.4]) back.add(B(0.05, 0.05, 0.8, wood, sx, -0.02, -0.38))
  g.add(back)
  // 받침 다리 (등받이 아래)
  const strut = B(0.04, 0.04, 0.55, wood, 0, 0.42, -0.7)
  strut.rotation.x = -0.9
  g.add(strut)
  // 쿠션 (둥근 상자 + 테두리 선)
  const fabric = new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
  const pipe = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.9 })
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.08, 1.4, 3, 0.035), fabric)
  cushion.position.set(0, 0.42, 0.33)
  const cBack = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.08, 0.78, 3, 0.035), fabric)
  cBack.position.set(0, 0.05, -0.38)
  back.add(cBack)
  g.add(cushion)
  for (const sx of [-0.4, 0.4]) {
    const p1 = B(0.02, 0.02, 1.38, pipe, sx, 0.46, 0.33)
    g.add(p1)
  }
  // 개어 둔 수건 (발 쪽, 줄무늬)
  const towelC = ['#ffffff', ['#3f8fd0', '#e8473f', '#2f9e6a', '#ffd23f'][Math.floor(r() * 4)]]
  for (let i = 0; i < 4; i++) g.add(B(0.5, 0.025, 0.07, new THREE.MeshStandardMaterial({ color: towelC[i % 2], roughness: 1 }), 0.05, 0.475, 0.78 + i * 0.07))
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return g
}

// ── 모래성 (부서질 수 있음): 모래 질감, 가운데 큰 탑 + 모서리 양동이 탑 4개 + 톱니 성벽 + 조개 장식 + 깃발 + 해자 ──
let sandM: THREE.MeshStandardMaterial | null = null
function sandMat() {
  if (sandM) return sandM
  const r = seeded(77)
  const t = canvas(128, 128, (g) => {
    g.fillStyle = '#dcc18a'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = ['#c9ab72', '#ead39f', '#b8995f', '#f2e2b8'][Math.floor(r() * 4)]
      g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2)
    }
  }, { repeat: [2, 2] })
  return (sandM = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }))
}
export function makeSandcastle() {
  const S = sandMat()
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = S) => {
    const o = new THREE.Mesh(geo, m)
    o.position.set(x, y, z)
    g.add(o)
    return o
  }
  // 바닥 둔덕 · 해자 (젖은 모래)
  add(new THREE.CylinderGeometry(1.05, 1.2, 0.18, 24), 0, 0.09, 0)
  const moat = add(new THREE.RingGeometry(1.2, 1.45, 32), 0, 0.012, 0, new THREE.MeshStandardMaterial({ color: '#a88a55', roughness: 0.6 }))
  moat.rotation.x = -Math.PI / 2
  const crenels = (cx: number, cz: number, rad: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      add(new THREE.BoxGeometry(rad * 0.45, 0.09, 0.08), cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad).rotation.y = -a + Math.PI / 2
    }
  }
  // 모서리 양동이 탑
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.55, 14), x, 0.45, z)
    for (const y of [0.33, 0.52]) add(new THREE.TorusGeometry(0.235 - (y - 0.33) * 0.15, 0.015, 4, 16), x, y, z).rotation.x = Math.PI / 2
    crenels(x, z, 0.19, 0.77, 6)
  }
  // 성벽 (모서리 사이, 위에 톱니)
  for (const [x, z, ry] of [[0, -0.6, 0], [0, 0.6, 0], [-0.6, 0, Math.PI / 2], [0.6, 0, Math.PI / 2]]) {
    const w = add(new THREE.BoxGeometry(0.85, 0.32, 0.14), x, 0.34, z)
    w.rotation.y = ry
    for (let k = -1; k <= 1; k++) {
      const c = add(new THREE.BoxGeometry(0.12, 0.08, 0.14), x + (ry ? 0 : k * 0.28), 0.54, z + (ry ? k * 0.28 : 0))
      c.rotation.y = ry
    }
  }
  // 문 (앞 +z 성벽에 어두운 아치)
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12, 1, false, 0, Math.PI), 0, 0.3, 0.6, new THREE.MeshStandardMaterial({ color: '#7a6040', roughness: 1 })).rotation.set(Math.PI / 2, 0, 0)
  // 가운데 큰 탑
  add(new THREE.CylinderGeometry(0.3, 0.4, 0.8, 16), 0, 0.58, 0)
  add(new THREE.CylinderGeometry(0.18, 0.24, 0.35, 14), 0, 1.15, 0)
  crenels(0, 0, 0.29, 1.0, 8)
  crenels(0, 0, 0.17, 1.36, 6)
  // 조개 장식
  const shell = new THREE.MeshStandardMaterial({ color: '#fbefe6', roughness: 0.5 })
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9
    add(new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.4, 0.8), Math.cos(a) * 1.0, 0.19, Math.sin(a) * 1.0, shell)
  }
  // 깃발
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), 0, 1.55, 0, new THREE.MeshStandardMaterial({ color: '#6b4320' }))
  const flag = new THREE.Shape()
  flag.moveTo(0, 0)
  flag.lineTo(0.24, -0.07)
  flag.lineTo(0, -0.14)
  add(new THREE.ShapeGeometry(flag), 0.005, 1.78, 0, new THREE.MeshStandardMaterial({ color: '#e8473f', side: THREE.DoubleSide }))
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return g
}

/** 무너진 모래성: 울퉁불퉁한 모래 더미 + 부러진 탑 밑동 + 쓰러진 깃발 */
export function makeSandRuin() {
  const S = sandMat()
  const g = new THREE.Group()
  const r = seeded(5)
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.12, 24), S).translateY(0.06))
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.8
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.18 + r() * 0.2, 10, 8).scale(1, 0.45, 1), S)
    lump.position.set(Math.cos(a) * d, 0.12, Math.sin(a) * d)
    g.add(lump)
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.25, 14), S).translateY(0.2))
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), new THREE.MeshStandardMaterial({ color: '#6b4320' }))
  stick.rotation.z = Math.PI / 2 - 0.1
  stick.position.set(0.55, 0.08, 0.35)
  g.add(stick)
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return g
}

// ── 1인용 카약 (사용자 요청 2026-11-19): 앞뒤가 뾰족한 날씬한 몸통, 가운데 앉는 구멍, 앞뒤 갑판 끈, 양날 노 ──
// 뱃머리는 -z (makeBoat와 같음). userData.seatY = 엉덩이 높이, userData.paddle = 노 (탄 사람이 저으면 화면이 돌림)
export function makeKayak(color: string) {
  const g = new THREE.Group()
  const L = 3.3, W = 0.36, H = 0.24
  // 몸통: 늘린 공을 앞뒤로 갈수록 더 가늘게 (뾰족하게), 위는 살짝 볼록한 갑판
  const hull = new THREE.SphereGeometry(1, 28, 14)
  const p = hull.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const taper = 1 - 0.45 * Math.abs(z) ** 1.6
    p.setXYZ(i, x * W * taper, y * (y > 0 ? H * 0.75 : H) + Math.abs(z) ** 2 * 0.1, z * (L / 2))
  }
  hull.computeVertexNormals()
  const hullM = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 })
  const body = new THREE.Mesh(hull, hullM)
  body.position.y = 0.16
  body.castShadow = true
  g.add(body)
  // 아래 흰 띠 (물에 닿는 쪽)
  const keel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 4, 40), new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5 }))
  keel.scale.set(W * 1.0, L / 2 * 0.98, 1)
  keel.rotation.x = Math.PI / 2
  keel.position.y = 0.14
  g.add(keel)
  // 앉는 구멍: 테두리 + 어두운 안
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 28), new THREE.MeshStandardMaterial({ color: '#2a2a33', roughness: 0.6 }))
  rim.scale.set(0.24, 0.42, 1)
  rim.rotation.x = Math.PI / 2
  rim.position.set(0, 0.34, 0.1)
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.9 }))
  hole.scale.set(0.23, 0.41, 1)
  hole.rotation.x = -Math.PI / 2
  hole.position.set(0, 0.33, 0.1)
  hole.renderOrder = 3
  g.add(rim, hole)
  // 갑판 끈 (앞뒤에 X자)
  const cordM = new THREE.MeshStandardMaterial({ color: '#1f1a2e', roughness: 0.8 })
  for (const zc of [-0.95, 1.05])
    for (const a of [0.5, -0.5]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.5), cordM)
      c.position.set(0, 0.36 - Math.abs(zc) * 0.02, zc)
      c.rotation.y = a
      g.add(c)
    }
  // 손잡이 고리 (앞·뒤 끝)
  for (const zc of [-L / 2 + 0.05, L / 2 - 0.05]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10), cordM)
    t.position.set(0, 0.42, zc)
    g.add(t)
  }
  // 양날 노: 가운데 자루 + 양끝 넓적한 날
  const paddle = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 6), new THREE.MeshStandardMaterial({ color: '#3a3a44', roughness: 0.4, metalness: 0.4 }))
  shaft.rotation.z = Math.PI / 2
  paddle.add(shaft)
  const bladeM = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.4, side: THREE.DoubleSide })
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), bladeM)
    blade.scale.set(0.2, 0.012, 0.085)
    blade.position.x = s * 1.08
    blade.rotation.x = s * 0.6
    paddle.add(blade)
  }
  g.add(paddle)
  g.userData.paddle = paddle
  g.userData.seatY = 0.2
  g.userData.kayak = true
  return g
}
