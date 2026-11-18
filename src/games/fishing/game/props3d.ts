import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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
export function makeTree(scale: number, seed: number) {
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
  /** 같이 탄 사람: 앞 판 (배 가운데에서 앞으로 seatFwd만큼) */
  g.userData.seatY2 = sheer(0.75) - 0.16 + 0.025
  g.userData.seatFwd = L * 0.25
  // 예전 배와 같은 크기·방향 (뱃머리 -z)
  return g
}

// ── 파라솔: 색이 번갈아 칠한 천(살 8개) + 술 + 나무 기둥 ──
export function makeUmbrella(color: string) {
  const K = kit()
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.7, 8), K.plankM)
  pole.position.y = 1.35
  g.add(pole)
  const R = 1.65, H = 0.55, ribs = 8
  const pos: number[] = [], col: number[] = []
  const a = new THREE.Color(color), b = new THREE.Color('#f7f3ea')
  for (let i = 0; i < ribs; i++) {
    const a0 = (i / ribs) * Math.PI * 2, a1 = ((i + 1) / ribs) * Math.PI * 2
    const c = i % 2 ? a : b
    // 살과 살 사이 천은 조금 처짐 (가운데 점을 낮춤)
    const am = (a0 + a1) / 2
    const pts = [[0, 2.62 + H, 0], [Math.cos(a0) * R, 2.62, Math.sin(a0) * R], [Math.cos(am) * R * 0.96, 2.56, Math.sin(am) * R * 0.96], [Math.cos(a1) * R, 2.62, Math.sin(a1) * R]]
    for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const k of tri) {
      pos.push(...pts[k])
      col.push(c.r, c.g, c.b)
    }
  }
  const cg = new THREE.BufferGeometry()
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  cg.computeVertexNormals()
  g.add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 })))
  // 술 (가장자리 띠)
  const fr = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.99, R * 0.99, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }))
  fr.position.y = 2.56
  g.add(fr)
  // 살
  for (let i = 0; i < ribs; i++) {
    const ang = (i / ribs) * Math.PI * 2
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), K.metalM)
    rib.position.set(Math.cos(ang) * 0.55, 2.4, Math.sin(ang) * 0.55)
    rib.rotation.set(0, -ang, 0)
    rib.rotateZ(1.1)
    g.add(rib)
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), K.whiteM).translateY(2.62 + H + 0.03))
  g.traverse((o) => (o.castShadow = true))
  return g
}
