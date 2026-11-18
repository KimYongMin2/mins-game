import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gameHour, weatherNow } from './clock'
import { kit, makeBoat, makePalm, makePine, makeSunbed, makeTree, makeUmbrella, rockGeo, waterNormals } from './props3d'
import { BEDS, BOUNDS, BRIDGE, DOCK, type FurnKind, HOUSES, JETTY, LADDERS, LAKE, LAKE_DOCK, PIER, PIER_END, RIVER, type Rect, SEA_EAST, STRUCTS, type Struct, shoreZ, waterAt } from '../play/map'

// 낚시터 3D 맵 그림 (2026-11-18 사용자 요청 — 더 사실적이고 넓게, 구조물 많이, 추가할 만한 것 다).
// 좌표·막힘은 play/map.ts(서버와 같이 씀), 여기는 그림만.
// - 바다: 물결 셰이더(물가에서 멀수록 짙은 색, 물가 흰 거품), 호수·강은 잔잔한 민물
// - 하늘: 실제 시각(한국 시간이 아니라 기기 시각)을 따라 낮·노을·밤 — 밤엔 별·달, 가로등·등대·창문·캠프파이어가 켜짐
// - 움직이는 것은 물건뿐(물결·배·갈매기·구름·불·깃발·분수) — 카메라는 절대 안 건드림 (사용자 3D 멀미)
// 멈춰 있는 물건은 재질별로 한 덩어리로 합쳐 그림 (폰에서도 가볍게)

/** 가리면 반투명해질 것. house = 집 번호 (그 집 안에 들어가 있으면 늘 반투명) */
export type Occluder = { g: THREE.Object3D; r: number; y: number; house?: number }
export type WorldArt = {
  /** 비 알갱이를 카메라 둘레에 (매 프레임 카메라 자리) */
  setCamera: (p: THREE.Vector3) => void
  /** 집 지붕 (안에 들어가면 숨김) — HOUSES 순서 */
  roofs: THREE.Object3D[]
  /** 해 그림자를 내 주변에 맞춤 */
  follow: (x: number, z: number) => void
  occluders: Occluder[]; update: (t: number, dt: number) => void; minimap: HTMLCanvasElement; dispose: () => void; /** 0 낮 ~ 1 밤 */ night: () => number }

const matCache = new Map<string, THREE.MeshStandardMaterial>()
function mat(color: string, rough = 0.85, metal = 0) {
  const key = `${color}.${rough}.${metal}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
    matCache.set(key, m)
  }
  return m
}

/** 잡음 무늬 텍스처 (모래·풀·나무결) */
function noiseTex(base: string, dots: [string, number, number][], repeat: number, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [color, count, r] of dots) {
    g.fillStyle = color
    for (let i = 0; i < count; i++) {
      const x = rnd() * size, y = rnd() * size, rr = r * (0.4 + rnd())
      g.globalAlpha = 0.25 + rnd() * 0.5
      g.beginPath()
      g.ellipse(x, y, rr, rr * (0.5 + rnd() * 0.8), rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** 글자 판 (간판·표지판) */
function labelTex(text: string, bg: string, fg: string, w = 512, h = 128) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.strokeStyle = fg
  g.lineWidth = 8
  g.strokeRect(8, 8, w - 16, h - 16)
  g.fillStyle = fg
  g.font = `900 ${Math.round(h * 0.48)}px "Black Han Sans", "IBM Plex Sans KR", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2 + 2, w - 40)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 세모 지붕 (가로 w, 깊이 d, 높이 h) — 꼭대기 선이 x 방향 */
function roofGeo(w: number, d: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-d / 2, 0)
  s.lineTo(d / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false })
  g.translate(0, 0, -w / 2)
  g.rotateY(Math.PI / 2)
  return g
}

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  o.position.set(x, y, z)
  return o
}
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)
  o.position.set(x, y, z)
  return o
}

/** 시각 → 낮 정도(1 낮 · 0 밤), 노을 정도 */
function skyPhase(hour: number) {
  const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)))
  const day = hour < 12 ? ramp(5.5, 7.2, hour) : 1 - ramp(17.3, 19.3, hour)
  const dusk = Math.max(0, 1 - Math.abs(hour - 18.2) / 1.3, 1 - Math.abs(hour - 6.3) / 0.9)
  return { day, dusk }
}

/** 낚시터 시각 (실제보다 6배 빠름 — clock.ts) */
const hourNow = () => gameHour()

/** 무리 안 메시를 재질별로 합침 (위치·방향은 무리 그대로). 합친 덩어리 = 그림자 냄 */
function mergeByMaterial(root: THREE.Object3D, rel: THREE.Matrix4) {
  root.updateMatrixWorld(true)
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const m4 = new THREE.Matrix4()
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return
    let geo = o.geometry.clone().applyMatrix4(m4.multiplyMatrices(rel, o.matrixWorld))
    if (geo.index) geo = geo.toNonIndexed()
    const keep = ['position', 'normal', 'uv', ...((o.material as THREE.MeshStandardMaterial).vertexColors ? ['color'] : [])]
    for (const name of Object.keys(geo.attributes)) if (!keep.includes(name)) geo.deleteAttribute(name)
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2))
    geo.clearGroups()
    const list = byMat.get(o.material) ?? []
    list.push(geo)
    byMat.set(o.material, list)
  })
  const out: THREE.Mesh[] = []
  for (const [m, list] of byMat) {
    const merged = mergeGeometries(list)
    list.forEach((g) => g.dispose())
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, m)
    mesh.castShadow = true
    mesh.receiveShadow = true
    out.push(mesh)
  }
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
  return out
}

function compact(g: THREE.Object3D) {
  g.updateMatrixWorld(true)
  const out = new THREE.Group()
  out.position.copy(g.position)
  out.rotation.copy(g.rotation)
  out.scale.copy(g.scale)
  for (const m of mergeByMaterial(g, new THREE.Matrix4().copy(g.matrixWorld).invert())) out.add(m)
  return out
}

/** 줄무늬 텍스처 (판자 벽·기와) */
function stripeTex(base: string, line: string, rows: number, opts: { tiles?: boolean; repeatX?: number; repeatY?: number } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  const h = 256 / rows
  for (let r = 0; r < rows; r++) {
    // 줄마다 조금씩 다른 밝기
    g.fillStyle = `rgba(0,0,0,${0.04 + ((r * 37) % 5) * 0.015})`
    g.fillRect(0, r * h, 256, h)
    g.fillStyle = line
    g.fillRect(0, r * h + h - 3, 256, 3)
    if (opts.tiles) for (let k = 0; k < 6; k++) g.fillRect(((k + (r % 2) * 0.5) * 256) / 6, r * h, 3, h)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export { makeBoat } from './props3d'

/** 해 그림자: 폰은 가볍게 (그리는 게 느리면 끊겨서 멀미가 남) */
const TOUCH = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
const SHADOW_RES = TOUCH ? 1024 : 2048
const SHADOW_HALF = TOUCH ? 20 : 26

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): WorldArt {
  const occluders: Occluder[] = []
  const disposables: { dispose: () => void }[] = []
  const statics = new THREE.Group() // 합칠 것 (그림자 냄)
  const dyn: ((t: number, dt: number, night: number) => void)[] = []
  const time = { value: 0 }
  const nightU = { value: 0 }

  // ── 하늘 (위아래 색이 다른 큰 공) · 해·달 · 별 ──
  const skyU = { top: { value: new THREE.Color('#5fb0ef') }, horizon: { value: new THREE.Color('#cfeaff') } }
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float k = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(horizon, top, k),1.0); }',
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat)
  sky.renderOrder = -10
  scene.add(sky)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false, transparent: true }))
  scene.add(sunDisc)
  const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: '#f1f4ff', fog: false, transparent: true }))
  scene.add(moon)
  const starPos: number[] = []
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92
    const rr = Math.sqrt(1 - y * y)
    starPos.push(Math.cos(a) * rr * 380, y * 380, Math.sin(a) * rr * 380)
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
  scene.add(stars)

  // 해: 그림자는 내 주변 50m만 (follow로 따라감)
  const sun = new THREE.DirectionalLight('#fff4dc', 1.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES)
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 200 })
  const UP = new THREE.Vector3(0, 1, 0), lightRight = new THREE.Vector3(), lightUp = new THREE.Vector3(), snapP = new THREE.Vector3()
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  const sunDir = new THREE.Vector3(0.4, 1, -0.3).normalize()
  scene.add(sun, sun.target)
  let hemi: THREE.HemisphereLight | null = null
  scene.traverse((o) => {
    if (o instanceof THREE.HemisphereLight) hemi = o
  })
  scene.fog = new THREE.Fog('#cfeaff', 55, 210)

  // ── 바다 (물결 셰이더) ──
  const seaMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.07, metalness: 0 })
  seaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.uniforms.uNight = nightU
    sh.uniforms.uNorm = { value: waterNormals() }
    const head = 'uniform float uTime;\nuniform float uNight;\nuniform sampler2D uNorm;\nvarying vec3 vW;\n'
    sh.vertexShader = head + sh.vertexShader
      .replace(
        '#include <beginnormal_vertex>',
        `float wx = position.x; float wz = -position.y;
        // 방향이 제각각인 물결 4개 (한 방향 줄무늬·격자처럼 안 보이게)
        vec2 P = vec2(wx, wz);
        vec2 D1 = vec2(0.82, 0.57); vec2 D2 = vec2(-0.37, 0.93); vec2 D3 = vec2(0.96, -0.28); vec2 D4 = vec2(-0.71, -0.70);
        float a1 = dot(P, D1)*0.31 + uTime*1.05; float a2 = dot(P, D2)*0.47 - uTime*1.3;
        float a3 = dot(P, D3)*0.83 + uTime*1.9; float a4 = dot(P, D4)*1.37 - uTime*2.6;
        float A1 = 0.065, A2 = 0.045, A3 = 0.022, A4 = 0.012;
        vec2 G = D1*(A1*0.31*cos(a1)) + D2*(A2*0.47*cos(a2)) + D3*(A3*0.83*cos(a3)) + D4*(A4*1.37*cos(a4));
        float dx = G.x; float dz = G.y;
        vec3 objectNormal = normalize(vec3(-dx, dz, 1.0));`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        transformed.z += A1*sin(a1) + A2*sin(a2) + A3*sin(a3) + A4*sin(a4);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
    sh.fragmentShader = head + sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float shore = -8.0 + sin(vW.x*0.13)*2.2 + sin(vW.x*0.31+1.0)*0.6;
      float d = shore - vW.z;
      vec3 shallow = vec3(0.09,0.55,0.6); vec3 mid = vec3(0.02,0.26,0.52); vec3 deep = vec3(0.005,0.09,0.27);
      vec3 col = mix(shallow, mid, smoothstep(0.0, 6.0, d));
      col = mix(col, deep, smoothstep(6.0, 40.0, d));
      float fn = texture2D(uNorm, vW.xz*0.09 + vec2(uTime*0.02, 0.0)).x;
      float foam = (1.0 - smoothstep(0.0, 0.9 + fn*0.5, d)) * (0.5 + 0.5*sin(uTime*1.7 + vW.x*0.6 + fn*4.0));
      foam += (1.0 - smoothstep(0.0, 0.25, abs(d - 1.6 - 0.5*sin(uTime*0.9 + vW.x*0.2)))) * 0.35;
      col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.8);
      col *= mix(1.0, 0.35, uNight);
      diffuseColor.rgb = col;`,
    ).replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      // 잔물결: 불규칙한 물결 질감 두 겹을 서로 다른 방향·빠르기로 흘려 겹침 (예전 sin 무늬는 격자처럼 보였음)
      vec3 n1 = texture2D(uNorm, vW.xz*0.045 + vec2(uTime*0.011, uTime*0.007)).xyz*2.0 - 1.0;
      vec3 n2 = texture2D(uNorm, vW.xz*0.13 + vec2(-uTime*0.017, uTime*0.013)).xyz*2.0 - 1.0;
      vec3 n3 = texture2D(uNorm, vW.xz*0.37 + vec2(uTime*0.03, -uTime*0.024)).xyz*2.0 - 1.0;
      vec2 rip = n1.xy*0.5 + n2.xy*0.35 + n3.xy*0.2;
      normal = normalize(normal + (viewMatrix * vec4(rip.x*0.5, 0.0, rip.y*0.5, 0.0)).xyz);`,
    )
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 120, 120), seaMat)
  sea.rotation.x = -Math.PI / 2
  sea.position.y = -0.14
  sea.receiveShadow = true
  // 배 안 물 막이(renderOrder 1)보다 나중에 그림
  sea.renderOrder = 2
  scene.add(sea)
  disposables.push(sea.geometry, seaMat)

  // ── 땅 ──
  const flat = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = y
    mesh.receiveShadow = true
    scene.add(mesh)
    disposables.push(geo)
    return mesh
  }
  const sandTex = noiseTex('#ecd49a', [['#d9bd7c', 900, 2.2], ['#f7e6b8', 700, 1.8], ['#c9a868', 120, 1.2]], 1)
  const grassTex = noiseTex('#6fb85c', [['#5da64b', 900, 3], ['#86c96f', 800, 2.5], ['#4f9440', 300, 1.6], ['#9bd27e', 150, 1.4]], 1)
  const woodTex = noiseTex('#a9733f', [['#8d5c2f', 500, 1.2], ['#bd8650', 400, 1.4]], 1, 128)
  disposables.push(sandTex, grassTex, woodTex)
  // 모양 좌표는 (x, -z), uv는 그대로 미터라 반복 크기는 repeat로
  const shapeGeo = (pts: [number, number][], tile: number) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ShapeGeometry(s)
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile)
    return g
  }
  const shoreLine: [number, number][] = []
  for (let x = -260; x <= SEA_EAST; x += 0.5) shoreLine.push([x, shoreZ(x)])
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 })
  flat(shapeGeo([...shoreLine, [SEA_EAST, 300], [-260, 300]], 6), sandMat, 0)
  // 젖은 모래 띠
  const wetPts: [number, number][] = [...shoreLine]
  for (let x = SEA_EAST; x >= -260; x -= 0.5) wetPts.push([x, shoreZ(x) + 1.3])
  flat(shapeGeo(wetPts, 6), new THREE.MeshStandardMaterial({ map: sandTex, color: '#bfa06a', roughness: 0.55 }), 0.004)
  // 풀밭: 마을(산책로 뒤) + 동쪽
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
  flat(shapeGeo([[-260, 16.9], [SEA_EAST, 16.9], [SEA_EAST, -52], [300, -52], [300, 300], [-260, 300]], 8), grassMat, 0.012)
  // 모래와 풀 사이 (부드럽게)
  flat(shapeGeo([[-260, 14.5], [SEA_EAST, 14.5], [SEA_EAST, 16.95], [-260, 16.95]], 6), new THREE.MeshStandardMaterial({ map: sandTex, color: '#c8c58c', roughness: 0.95 }), 0.008)
  // 동쪽 풀밭이 바다와 만나는 곳: 바위 둑
  const rockM = kit().rockM
  for (let z = shoreZ(SEA_EAST) + 1; z > -53; z -= 1.2) {
    const s = 0.7 + Math.abs(Math.sin(z * 2.1)) * 0.6
    const r = new THREE.Mesh(rockGeo(s, z, { moss: false }), rockM)
    r.position.set(SEA_EAST - 0.4 + Math.sin(z) * 0.4, 0.1, z)
    r.rotation.set(z, z * 2, 0)
    statics.add(r)
  }

  // 흙길 (동네·다리·호수로)
  const dirtMat = new THREE.MeshStandardMaterial({ map: sandTex, color: '#c9a277', roughness: 1 })
  const path = (pts: [number, number][], w: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const g = new THREE.PlaneGeometry(w, len + w * 0.6)
      const m = flat(g, dirtMat, 0.02 + i * 0.0005)
      m.position.set((ax + bx) / 2, 0.02, (az + bz) / 2)
      m.rotation.set(-Math.PI / 2, 0, -Math.atan2(bx - ax, bz - az))
      const c = flat(new THREE.CircleGeometry(w / 2, 16), dirtMat, 0.021)
      c.position.set(bx, 0.021, bz)
    }
  }
  path([[-64, 20], [64, 20]], 2.6)
  path([[-10, 20], [-10, 33]], 2.2)
  path([[24, 20], [27, 6], [29.5, -7.7]], 2.2)
  path([[41.5, -7.7], [50, -5], [58, 4]], 2)
  path([[26, 20], [29, 24]], 2)
  // 분수 광장 (돌바닥)
  const plaza = flat(new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ map: noiseTex('#c7c2b8', [['#aaa49a', 400, 3], ['#dcd8cf', 300, 3]], 2), roughness: 0.9 }), 0.025)
  plaza.position.set(-10, 0.025, 37)

  // ── 민물 (호수·강) ──
  // 호수·강: 물결 질감을 천천히 흘림
  const freshNorm = waterNormals().clone()
  freshNorm.repeat.set(5, 5)
  const freshMat = new THREE.MeshStandardMaterial({ color: '#1f6f73', roughness: 0.08, metalness: 0, normalMap: freshNorm, normalScale: new THREE.Vector2(0.45, 0.45) })
  dyn.push((t) => freshNorm.offset.set(t * 0.012, t * 0.008))
  flat(new THREE.CircleGeometry(LAKE.r + 0.15, 64).translate(LAKE.x, -LAKE.z, 0), freshMat, 0.035).renderOrder = 2
  // 강: 꺾은선을 따라 띠
  {
    const p = RIVER.pts
    const left: [number, number][] = [], right: [number, number][] = []
    for (let i = 0; i < p.length; i++) {
      const [px, pz] = p[i]
      const [ax, az] = p[Math.max(0, i - 1)], [bx, bz] = p[Math.min(p.length - 1, i + 1)]
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz)
      const nx = -dz / l, nz = dx / l, w = RIVER.half + 0.15
      left.push([px + nx * w, pz + nz * w])
      right.push([px - nx * w, pz - nz * w])
    }
    flat(shapeGeo([...left, ...right.reverse()], 4), freshMat, 0.034).renderOrder = 2
  }
  // 호수 가 돌·갈대, 연잎
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2
    if (Math.abs(a - Math.PI) < 0.2) continue // 선착장 자리
    const s = new THREE.Mesh(rockGeo(0.35 + (i % 3) * 0.12, i, { detail: 1 }), rockM)
    s.position.set(LAKE.x + Math.cos(a) * (LAKE.r + 0.35), 0.06, LAKE.z + Math.sin(a) * (LAKE.r + 0.35))
    s.scale.y = 0.55
    statics.add(s)
  }

  // ── 인스턴스 (풀포기·꽃·갈대·연잎·울타리 기둥) ──
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const tmp = new THREE.Object3D()
  const instanced = (geo: THREE.BufferGeometry, m: THREE.Material, list: { x: number; y?: number; z: number; s?: number; r?: number; color?: string }[], shadow = false) => {
    const im = new THREE.InstancedMesh(geo, m, list.length)
    list.forEach((it, i) => {
      tmp.position.set(it.x, it.y ?? 0, it.z)
      tmp.rotation.set(0, it.r ?? rnd() * 6, 0)
      tmp.scale.setScalar(it.s ?? 1)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
      if (it.color) im.setColorAt(i, new THREE.Color(it.color))
    })
    im.castShadow = shadow
    im.receiveShadow = true
    scene.add(im)
    disposables.push(geo)
    return im
  }
  const isGrass = (x: number, z: number) => (z > 17.5 || x > SEA_EAST + 1) && !waterAt(x, z) && waterAt(x + 1.2, z) === null && waterAt(x - 1.2, z) === null && waterAt(x, z + 1.2) === null && waterAt(x, z - 1.2) === null
  const nearStruct = (x: number, z: number, pad: number) => STRUCTS.some((s) => (s.w && s.d ? Math.abs(x - s.x) < s.w / 2 + pad && Math.abs(z - s.z) < s.d / 2 + pad : Math.hypot(x - s.x, z - s.z) < (s.c || 0.5) + pad))
  const onPath = (x: number, z: number) => Math.abs(z - 20) < 1.8 || (Math.abs(x + 10) < 1.6 && z > 20 && z < 33) || Math.hypot(x + 10, z - 37) < 6.4
  const tufts: { x: number; z: number; s: number }[] = []
  const flowers: { x: number; z: number; s: number; color: string }[] = []
  const FLOWER = ['#ffffff', '#ffd23f', '#ff8ab0', '#c79bff', '#ff6b5a']
  for (let i = 0; i < 9000 && tufts.length < 2600; i++) {
    const x = BOUNDS.minX - 10 + rnd() * (BOUNDS.maxX - BOUNDS.minX + 20), z = BOUNDS.minZ - 10 + rnd() * (BOUNDS.maxZ - BOUNDS.minZ + 20)
    if (!isGrass(x, z) || onPath(x, z) || nearStruct(x, z, 0.4)) continue
    if (rnd() < 0.13) flowers.push({ x, z, s: 0.8 + rnd() * 0.6, color: FLOWER[Math.floor(rnd() * FLOWER.length)] })
    else tufts.push({ x, z, s: 0.7 + rnd() * 0.8 })
  }
  // 모래사장 뒤 갯그령(바닷가 풀)
  for (let i = 0; i < 260; i++) {
    const x = BOUNDS.minX - 4 + rnd() * (SEA_EAST - BOUNDS.minX + 3), z = 13 + rnd() * 3.6
    if (!nearStruct(x, z, 0.5)) tufts.push({ x, z, s: 0.9 + rnd() * 0.6 })
  }
  // 풀포기: 가는 잎 7장 (아래 진하고 끝은 밝게)
  const tuftGeo = (() => {
    const pos: number[] = [], col: number[] = []
    const dark = new THREE.Color('#2f6b2a'), light = new THREE.Color('#9fd06e')
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + k
      const lean = 0.12 + (k % 3) * 0.06, h = 0.35 + ((k * 13) % 5) * 0.06, w = 0.035
      const cx = Math.cos(a), cz = Math.sin(a)
      const px = -cz * w, pz = cx * w
      const tip = [cx * lean, h, cz * lean]
      pos.push(px, 0, pz, -px, 0, -pz, tip[0], tip[1], tip[2])
      col.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, light.r, light.g, light.b)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  })()
  instanced(tuftGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), tufts)
  const flowerGeo = mergeGeometries([new THREE.CylinderGeometry(0.015, 0.015, 0.32, 4).translate(0, 0.16, 0).toNonIndexed(), new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.34, 0).toNonIndexed()])!
  instanced(flowerGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), flowers)
  // 갈대 (호수·강가)
  const reeds: { x: number; z: number; s: number }[] = []
  for (let i = 0; i < 360; i++) {
    const a = rnd() * Math.PI * 2
    const r = LAKE.r + 0.2 + rnd() * 1.4
    const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r
    if (Math.abs(x - 33) < 4 && Math.abs(z - LAKE_DOCK.minZ - 1) < 3) continue
    if (!nearStruct(x, z, 0.3) && !BEDS.some((b) => Math.hypot(b.x - x, b.z - z) < 2.2)) reeds.push({ x, z, s: 0.8 + rnd() * 0.7 })
  }
  for (let i = 0; i < 200; i++) {
    const k = rnd() * (RIVER.pts.length - 1), j = Math.floor(k), f = k - j
    const [ax, az] = RIVER.pts[j], [bx, bz] = RIVER.pts[j + 1]
    const side = rnd() < 0.5 ? -1 : 1
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz)
    const x = ax + dx * f + (-dz / l) * side * (RIVER.half + 0.3 + rnd()), z = az + dz * f + (dx / l) * side * (RIVER.half + 0.3 + rnd())
    if (z > BRIDGE.minZ - 1.5 && z < BRIDGE.maxZ + 1.5) continue
    reeds.push({ x, z, s: 0.8 + rnd() * 0.6 })
  }
  instanced(new THREE.CylinderGeometry(0.02, 0.03, 1.3, 4).translate(0, 0.65, 0), mat('#7f9a45', 1), reeds)
  const lily: { x: number; y: number; z: number; s: number }[] = []
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, r = 3 + rnd() * (LAKE.r - 4)
    lily.push({ x: LAKE.x + Math.cos(a) * r, y: 0.045, z: LAKE.z + Math.sin(a) * r, s: 0.6 + rnd() * 0.7 })
  }
  instanced(new THREE.CircleGeometry(0.45, 10, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4c9a3c', roughness: 0.6, side: THREE.DoubleSide }), lily)
  // 울타리 (맵 끝 — 땅에서만)
  const posts: { x: number; z: number; r: number }[] = []
  const rails: { x: number; z: number; r: number }[] = []
  const fence = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2.4), r = Math.atan2(bx - ax, bz - az)
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n
      if (waterAt(x, z)) continue
      posts.push({ x, z, r: 0 })
      if (i < n && !waterAt(x + (bx - ax) / n, z + (bz - az) / n)) rails.push({ x: x + (bx - ax) / n / 2, z: z + (bz - az) / n / 2, r })
    }
  }
  fence(BOUNDS.minX + 0.4, shoreZ(BOUNDS.minX) + 1.5, BOUNDS.minX + 0.4, BOUNDS.maxZ - 0.4)
  fence(BOUNDS.minX + 0.4, BOUNDS.maxZ - 0.4, BOUNDS.maxX - 0.4, BOUNDS.maxZ - 0.4)
  fence(BOUNDS.maxX - 0.4, BOUNDS.maxZ - 0.4, BOUNDS.maxX - 0.4, BOUNDS.minZ + 0.4)
  fence(BOUNDS.maxX - 0.4, BOUNDS.minZ + 0.4, SEA_EAST + 1.5, BOUNDS.minZ + 0.4)
  const fenceM = kit().weatheredM
  instanced(new THREE.BoxGeometry(0.16, 1.1, 0.16).translate(0, 0.55, 0), fenceM, posts, true)
  instanced(mergeGeometries([new THREE.BoxGeometry(0.07, 0.1, 2.4).translate(0, 0.85, 0), new THREE.BoxGeometry(0.07, 0.1, 2.4).translate(0, 0.45, 0)])!, fenceM, rails, true)

  // ── 판자 길 (부두·선착장·다리·산책로) ──
  const plankM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 })
  const postM = mat('#6b4320', 0.9)
  const deck = (b: Rect, y: number, along: 'x' | 'z', posts = true) => {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ
    const n = Math.floor((along === 'z' ? d : w) / 0.32)
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      const p = along === 'z' ? box(w, 0.14, 0.29, plankM, b.minX + w / 2, y - 0.07, b.minZ + d * k) : box(0.29, 0.14, d, plankM, b.minX + w * k, y - 0.07, b.minZ + d / 2)
      p.rotation.y = (rnd() - 0.5) * 0.02
      statics.add(p)
    }
    if (!posts) return
    for (let z = b.minZ + 0.2; z <= b.maxZ; z += 2.2)
      for (const x of [b.minX + 0.12, b.maxX - 0.12]) if (waterAt(x, z) || along === 'x') statics.add(cyl(0.13, 0.15, 1.6, postM, x, y - 0.8, z, 8))
  }
  const pierEndZ = shoreZ((PIER.minX + PIER.maxX) / 2) + 1
  deck({ ...PIER, maxZ: pierEndZ }, 0.21, 'z')
  deck(PIER_END, 0.21, 'z')
  // 부두 끝 난간
  for (const [ax, az, bx, bz] of [[PIER_END.minX, PIER_END.minZ, PIER_END.maxX, PIER_END.minZ], [PIER_END.minX, PIER_END.minZ, PIER_END.minX, PIER_END.maxZ], [PIER_END.maxX, PIER_END.minZ, PIER_END.maxX, PIER_END.maxZ]] as const) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.6)
    for (let i = 0; i <= n; i++) statics.add(cyl(0.05, 0.05, 0.9, postM, ax + ((bx - ax) * i) / n, 0.66, az + ((bz - az) * i) / n, 6))
    const rail = box(ax === bx ? 0.08 : len, 0.08, ax === bx ? len : 0.08, postM, (ax + bx) / 2, 1.08, (az + bz) / 2)
    statics.add(rail)
  }
  deck({ ...DOCK, maxZ: shoreZ(7) + 1 }, 0.21, 'z')
  deck(LAKE_DOCK, 0.21, 'x')
  deck({ minX: BOUNDS.minX, maxX: SEA_EAST, minZ: 15.3, maxZ: 16.9 }, 0.06, 'x', false)
  // 다리: 판자 + 난간
  deck(BRIDGE, 0.35, 'x', false)
  for (const z of [BRIDGE.minZ + 0.1, BRIDGE.maxZ - 0.1]) {
    for (let x = BRIDGE.minX; x <= BRIDGE.maxX; x += 1.1) statics.add(cyl(0.06, 0.06, 0.9, postM, x, 0.75, z, 6))
    statics.add(box(BRIDGE.maxX - BRIDGE.minX, 0.1, 0.1, postM, (BRIDGE.minX + BRIDGE.maxX) / 2, 1.2, z))
  }
  // 방파제: 큰 바위 더미 + 위 평평한 콘크리트
  const jettyEnd = shoreZ((JETTY.minX + JETTY.maxX) / 2) + 1
  statics.add(box(JETTY.maxX - JETTY.minX - 0.6, 0.5, jettyEnd - JETTY.minZ, mat('#b9b7b1', 0.95), (JETTY.minX + JETTY.maxX) / 2, 0.2, (JETTY.minZ + jettyEnd) / 2))
  for (let z = JETTY.minZ; z < jettyEnd; z += 1.1)
    for (const x of [JETTY.minX - 0.3, JETTY.maxX + 0.3]) {
      const r = new THREE.Mesh(rockGeo(0.9 + rnd() * 0.5, z + x, { moss: false }), rockM)
      r.position.set(x + (rnd() - 0.5) * 0.6, -0.1, z)
      r.rotation.set(rnd() * 3, rnd() * 3, 0)
      statics.add(r)
    }

  // ── 썬베드 (나무 틀·살 판·쿠션·수건) ──
  const cushions = ['#e8746a', '#5fa9d8', '#e8c040', '#7cbf6a', '#a98ad8']
  BEDS.forEach((b, i) => {
    const g = makeSunbed(cushions[i % cushions.length], i * 7 + 3)
    g.position.set(b.x, b.z < -30 ? 0.21 : 0, b.z)
    g.rotation.y = b.r
    statics.add(g)
  })
  // 비치 타월 (그림만 — 모래성은 3D 화면이 그림: 부서지고 다시 쌓여서)
  ;[[-15, -2.5, '#e8473f'], [-7, -3.4, '#3f8fd0'], [8, -1.8, '#ffd23f']].forEach(([x, z, c]) => {
    const t = box(1, 0.02, 1.9, mat(c as string, 1), x as number, 0.012, z as number)
    t.rotation.y = 0.3
    statics.add(t)
  })

  // ── 구조물 ──
  const lit: THREE.MeshStandardMaterial[] = [] // 밤에 켜지는 것
  const glowMat = (color: string) => {
    const m = new THREE.MeshStandardMaterial({ color: '#555', emissive: color, emissiveIntensity: 0, roughness: 0.4 })
    lit.push(m)
    return m
  }
  const windowM = glowMat('#ffd27a')
  const bulbM = glowMat('#fff1b8')
  const whiteM = mat('#f4f2ec', 0.8)
  const darkM = mat('#2b2f45', 0.6)
  /** 카메라와 나 사이에 오면 반투명해질 것: 따로 그리되 재질별로 합쳐 가볍게 */
  const occlude = (g: THREE.Object3D, r: number, y: number, house?: number) => {
    const c = compact(g)
    scene.add(c)
    occluders.push({ g: c, r, y, ...(house !== undefined ? { house } : {}) })
    return c
  }
  const roofs: THREE.Object3D[] = HOUSES.map(() => new THREE.Group())
  const sidingTex = stripeTex('#efe6d2', 'rgba(120,100,80,0.35)', 14, { repeatX: 2, repeatY: 1 })
  const roofTex = stripeTex('#ffffff', 'rgba(0,0,0,0.28)', 10, { tiles: true, repeatX: 3, repeatY: 2 })
  const floorTex = stripeTex('#b78552', 'rgba(70,40,20,0.45)', 12, { tiles: true, repeatX: 2, repeatY: 2 })
  disposables.push(sidingTex, roofTex, floorTex)
  const groundGlow: THREE.Mesh[] = []
  const glowTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const gg = c.getContext('2d')!
    const grd = gg.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,220,140,0.9)')
    grd.addColorStop(1, 'rgba(255,220,140,0)')
    gg.fillStyle = grd
    gg.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  disposables.push(glowTex)
  const addGlow = (x: number, z: number, r: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.05, z)
    scene.add(m)
    groundGlow.push(m)
  }

  /** 집: 벽(문 자리 비움, 안에 들어가면 반투명) · 지붕(안에 들어가면 숨김) · 바닥·가구 */
  function buildHouse(s: Struct) {
    const idx = HOUSES.findIndex((h) => h.s === s)
    const H = HOUSES[idx]
    const log = s.kind === 'cabin'
    const W = 2.8
    const wallM = log ? new THREE.MeshStandardMaterial({ map: stripeTex('#8f5f35', 'rgba(50,25,10,0.6)', 7), roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: sidingTex, roughness: 0.85 })
    const trimM = log ? mat('#5a3b22') : whiteM
    // 벽 (세상 좌표 → 집 가운데 기준)
    const walls = new THREE.Group()
    walls.position.set(s.x, 0, s.z)
    for (const b of H.walls) {
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ
      walls.add(box(w, W, d, wallM, (b.minX + b.maxX) / 2 - s.x, W / 2, (b.minZ + b.maxZ) / 2 - s.z))
      walls.add(box(w + 0.04, 0.18, d + 0.04, trimM, (b.minX + b.maxX) / 2 - s.x, 0.09, (b.minZ + b.maxZ) / 2 - s.z))
    }
    // 창문 (벽 안팎 양쪽에 붙임) — 집 기준 좌표로 놓고 돌림
    const local = new THREE.Group()
    local.rotation.y = s.r ?? 0
    walls.add(local)
    const w = s.w!, d = s.d!, hw = w / 2, hd = d / 2
    const win = (x: number, z: number, side: boolean) => {
      // 벽을 뚫고 안팎 양쪽에 보이게 (두께 0.25 벽보다 조금 두껍게)
      const pane = side ? box(0.29, 0.95, 1.1, windowM, x, 1.6, z) : box(1.1, 0.95, 0.29, windowM, x, 1.6, z)
      const frame = side ? box(0.33, 1.1, 1.26, trimM, x, 1.6, z) : box(1.26, 1.1, 0.33, trimM, x, 1.6, z)
      const sill = side ? box(0.45, 0.07, 1.3, trimM, x, 1.08, z) : box(1.3, 0.07, 0.45, trimM, x, 1.08, z)
      local.add(frame, pane, sill)
    }
    const T2 = 0.125
    for (const x of [-hw / 1.7, hw / 1.7]) {
      win(x, hd - T2, false)
      win(x, -hd + T2, false)
    }
    win(-hw + T2, 0.9, true)
    win(hw - T2, 0.9, true)
    // 문틀 + 활짝 연 문
    local.add(box(0.12, 2.2, 0.32, trimM, -0.81, 1.1, hd - 0.12), box(0.12, 2.2, 0.32, trimM, 0.81, 1.1, hd - 0.12), box(1.74, 0.14, 0.32, trimM, 0, 2.27, hd - 0.12))
    const door = box(1.4, 2.08, 0.06, mat(log ? '#6b4320' : '#7a4a2a', 0.7), -0.72, 1.04, hd - 0.97)
    door.rotation.y = Math.PI / 2
    local.add(door, box(0.9, 0.05, 0.6, mat('#9a6b52'), 0, 0.03, hd + 0.5))
    occlude(walls, Math.max(w, d) / 2 + 0.6, 1.6, idx)
    // 지붕
    const roof = new THREE.Group()
    roof.position.set(s.x, 0, s.z)
    roof.rotation.y = s.r ?? 0
    const roofM = log ? new THREE.MeshStandardMaterial({ map: roofTex, color: '#3f6b3a', roughness: 0.8 }) : new THREE.MeshStandardMaterial({ map: roofTex, color: s.color ?? '#c8553d', roughness: 0.7 })
    roof.add(new THREE.Mesh(roofGeo(w + 0.8, d + 1, 1.9), roofM).translateY(W))
    // 천장 (지붕 밑을 막음) · 굴뚝
    roof.add(box(w, 0.08, d, mat('#e9e2d4'), 0, W + 0.02, 0), box(0.55, 1.6, 0.55, mat('#8a6a5a', 0.9), hw / 2, W + 1.3, -hd / 3), box(0.7, 0.12, 0.7, darkM, hw / 2, W + 2.12, -hd / 3))
    const rc = compact(roof)
    scene.add(rc)
    roofs[idx] = rc
    // 지붕도 카메라를 가리면 반투명 (집 뒤에 서면 지붕에 가려 안 보였음)
    occluders.push({ g: rc, r: Math.max(w, d) / 2 + 0.8, y: 3.4, house: idx })
    // 바닥
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, d - 0.1), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(s.x, 0.03, s.z)
    floor.receiveShadow = true
    scene.add(floor)
    disposables.push(floor.geometry)
    // 가구 (집 기준 좌표로)
    const inG = new THREE.Group()
    inG.position.set(s.x, 0, s.z)
    inG.rotation.y = s.r ?? 0
    const r = s.r ?? 0
    const c = Math.round(Math.cos(r)), n = Math.round(Math.sin(r))
    // 세상 좌표 → 집 기준 (placeRect의 반대)
    const toLocal = (b: Rect) => {
      const pts = [[b.minX, b.minZ], [b.maxX, b.maxZ]].map(([x, z]) => {
        const dx = x - s.x, dz = z - s.z
        return [dx * c - dz * n, dx * n + dz * c]
      })
      return { x0: Math.min(pts[0][0], pts[1][0]), x1: Math.max(pts[0][0], pts[1][0]), z0: Math.min(pts[0][1], pts[1][1]), z1: Math.max(pts[0][1], pts[1][1]) }
    }
    const accent = mat(s.color ?? '#c8553d', 0.8)
    for (const f of H.furniture) furniture(inG, f.kind, toLocal(f.rect), accent)
    // 깔개·벽 그림·천장 등·화분
    inG.add(box(2, 0.02, 1.4, mat(log ? '#a33b2a' : '#3f6fa0', 1), -0.2, 0.045, 0.3))
    inG.add(box(0.9, 0.6, 0.04, mat('#5a3b22'), hw - 1, 1.8, -hd + 0.27), box(0.78, 0.48, 0.05, mat('#7fb6d8'), hw - 1, 1.8, -hd + 0.28))
    inG.add(cyl(0.02, 0.02, 0.5, darkM, 0, W - 0.25, 0, 4), new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bulbM).translateY(W - 0.55))
    inG.add(cyl(0.18, 0.14, 0.32, mat('#b0603a'), hw - 0.5, 0.16, hd - 0.6, 10), new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), mat('#3f8f3a')).translateX(hw - 0.5).translateY(0.6).translateZ(hd - 0.6))
    statics.add(inG)
    if (log) {
      // 통나무집 앞마루
      const porch = new THREE.Group()
      porch.position.set(s.x, 0, s.z)
      porch.rotation.y = r
      porch.add(box(w, 0.15, 1.6, plankM, 0, 0.08, hd + 0.8))
      for (const x of [-hw + 0.2, hw - 0.2]) porch.add(cyl(0.1, 0.1, 2.7, postM, x, 1.35, hd + 1.5, 6))
      porch.add(box(w + 0.4, 0.1, 1.9, mat('#3f6b3a', 0.8), 0, 2.75, hd + 0.85))
      statics.add(porch)
    }
  }

  function furniture(g: THREE.Group, kind: FurnKind, b: { x0: number; x1: number; z0: number; z1: number }, accent: THREE.Material) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0
    const wood = mat('#9a6b42', 0.8)
    switch (kind) {
      case 'bed':
        g.add(box(w, 0.32, d, wood, cx, 0.16, cz), box(w - 0.1, 0.22, d - 0.1, mat('#f4f2ec', 0.9), cx, 0.43, cz), box(w - 0.06, 0.08, d * 0.62, accent, cx, 0.56, cz + d * 0.18))
        g.add(box(w, 0.9, 0.08, wood, cx, 0.45, b.z0 + 0.04), box(w * 0.7, 0.14, 0.4, mat('#ffffff', 0.9), cx, 0.6, b.z0 + 0.35))
        break
      case 'sofa':
        g.add(box(w, 0.4, d, accent, cx, 0.2, cz), box(0.22, 0.85, d, accent, b.x0 + 0.11, 0.42, cz), box(w, 0.6, 0.2, accent, cx, 0.3, b.z0 + 0.1), box(w, 0.6, 0.2, accent, cx, 0.3, b.z1 - 0.1))
        for (const k of [0.3, 0.7]) g.add(box(w - 0.3, 0.12, d * 0.36, mat('#f4f2ec', 0.95), cx + 0.1, 0.46, b.z0 + d * k))
        break
      case 'kitchen':
        g.add(box(w, 0.88, d, mat('#e9e2d4', 0.6), cx, 0.44, cz), box(w + 0.04, 0.05, d + 0.04, mat('#4a4f5c', 0.4), cx, 0.9, cz), box(0.45, 0.04, 0.35, mat('#9aa3ad', 0.3, 0.6), cx - 0.25, 0.93, cz))
        g.add(box(w, 0.6, 0.35, mat('#e9e2d4', 0.6), cx, 1.75, b.z0 + 0.18))
        for (const k of [0.25, 0.75]) g.add(box(0.03, 0.5, 0.02, mat('#4a4f5c'), b.x0 + w * k, 0.5, b.z1 + 0.01))
        break
      case 'fireplace': {
        const stone = new THREE.MeshStandardMaterial({ map: noiseTex('#9a948a', [['#7f796f', 200, 6], ['#b5afa5', 160, 5]], 1, 128), roughness: 0.95 })
        g.add(box(w, 1.2, d, stone, cx, 0.6, cz), box(w * 0.55, 0.6, 0.1, darkM, cx, 0.4, b.z1 + 0.01), box(w * 0.45, 0.25, 0.05, glowMat('#ff8a3c'), cx, 0.25, b.z1 + 0.03), box(w * 0.5, 1.6, d * 0.6, stone, cx, 2, b.z0 + d * 0.3))
        break
      }
      case 'shelf': {
        g.add(box(w, 1.9, d, wood, cx, 0.95, cz))
        const bookC = ['#c8553d', '#3d6f9e', '#e0b030', '#3f7f5a', '#7a5c9e', '#f4f2ec']
        for (let row = 0; row < 4; row++)
          for (let k = 0; k < 9; k++) {
            const bw = w / 10
            g.add(box(bw * 0.85, 0.3 + ((k * 7 + row) % 3) * 0.04, d * 0.7, mat(bookC[(k + row * 2) % bookC.length], 0.8), b.x0 + bw * (k + 0.8), 0.3 + row * 0.45, cz + 0.02))
          }
        break
      }
      case 'table': {
        g.add(cyl(Math.min(w, d) / 2, Math.min(w, d) / 2, 0.05, wood, cx, 0.74, cz, 20), cyl(0.06, 0.1, 0.72, wood, cx, 0.36, cz, 8))
        g.add(cyl(0.07, 0.05, 0.22, mat('#7fb6d8', 0.2), cx, 0.88, cz, 10), new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat('#ff6b5a')).translateX(cx).translateY(1.02).translateZ(cz))
        // 의자 둘 (막힘 없음)
        for (const sgn of [-1, 1]) {
          const z = cz + sgn * (d / 2 + 0.25)
          g.add(box(0.42, 0.05, 0.42, wood, cx, 0.45, z), box(0.42, 0.5, 0.05, wood, cx, 0.7, z + sgn * 0.2))
          for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) g.add(box(0.04, 0.45, 0.04, wood, cx + ox, 0.22, z + oz))
        }
        break
      }
    }
  }

  function build(s: Struct): THREE.Object3D | null {
    const g = new THREE.Group()
    g.position.set(s.x, 0, s.z)
    g.rotation.y = s.r ?? 0
    const sc = s.s ?? 1
    switch (s.kind) {
      case 'lighthouse': {
        g.position.y = 0.45
        g.add(cyl(2.4, 2.6, 0.8, mat('#9a9790', 0.95), 0, 0.4, 0, 16))
        for (let i = 0; i < 5; i++) g.add(cyl(1.75 - (i + 1) * 0.12, 1.75 - i * 0.12, 2, i % 2 ? mat('#d94a3c', 0.6) : whiteM, 0, 0.8 + i * 2 + 1, 0, 18))
        g.add(cyl(1.5, 1.5, 0.15, darkM, 0, 10.9, 0, 18))
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2
          g.add(cyl(0.03, 0.03, 0.7, darkM, Math.cos(a) * 1.45, 11.3, Math.sin(a) * 1.45, 4))
        }
        // 바깥 사다리 (앞 +z, 바닥에서 전망대까지)
        const lad = LADDERS[1]
        const fz = lad.foot.z - s.z, tz = lad.top.z - s.z + 0.2, H = lad.y - 0.45
        const len = Math.hypot(H, fz - tz), tilt = Math.atan2(fz - tz, H)
        for (const x of [-0.3, 0.3]) {
          const rail = cyl(0.04, 0.04, len, darkM, x, H / 2, (fz + tz) / 2, 6)
          rail.rotation.x = -tilt
          g.add(rail)
        }
        for (let i = 1; i < Math.floor(H / 0.32); i++) {
          const k = (i * 0.32) / H
          g.add(cyl(0.022, 0.022, 0.6, darkM, 0, k * H, fz + (tz - fz) * k, 5).rotateZ(Math.PI / 2))
        }
        // 전망대 바닥
        const deck = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.55, 24), darkM)
        deck.rotation.x = -Math.PI / 2
        deck.position.y = 10.98
        g.add(deck)
        const lamp = cyl(0.8, 0.8, 1.3, glowMat('#fff3b0'), 0, 11.6, 0, 14)
        g.add(lamp, new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.9, 14), mat('#d94a3c', 0.6)).translateY(12.7))
        // 밤에 도는 불빛 (빛줄기 두 개)
        const beam = new THREE.Group()
        beam.position.y = 11.6
        const bm = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
        for (const sgn of [1, -1]) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(3, 34, 16, 1, true), bm)
          c.rotation.z = (sgn * Math.PI) / 2
          c.position.x = sgn * 17
          beam.add(c)
        }
        g.add(beam)
        dyn.push((t, _dt, night) => {
          beam.rotation.y = t * 0.6
          bm.opacity = night * 0.18
        })
        scene.add(g)
        return null
      }
      case 'house':
      case 'cabin': {
        buildHouse(s)
        return null
      }
      case 'hut': {
        const c = mat(s.color ?? '#ff8a7a', 0.8)
        g.add(box(s.w!, 2.3, s.d!, whiteM, 0, 1.15, 0))
        for (let i = 0; i < 4; i++) g.add(box(s.w! + 0.02, 0.28, s.d! + 0.02, c, 0, 0.35 + i * 0.55, 0))
        g.add(new THREE.Mesh(roofGeo(s.w! + 0.4, s.d! + 0.4, 0.8), c).translateY(2.3))
        g.add(box(0.9, 1.8, 0.06, mat('#3c4a6b'), 0, 0.95, s.d! / 2 + 0.03))
        occlude(g, 1.8, 1.4)
        return null
      }
      case 'tower': {
        // 인명구조 탑: 앞(+z) 사다리로 올라가 앞쪽 마루에 섬 (뒤쪽은 작은 오두막)
        const red = mat('#d94a3c', 0.6)
        for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
          const leg = cyl(0.08, 0.1, 2.62, whiteM, x, 1.31, z, 8)
          g.add(leg)
        }
        for (const z of [-1.1, 1.1]) {
          const brace = box(2.6, 0.06, 0.06, whiteM, 0, 1.2, z)
          brace.rotation.z = 0.7
          g.add(brace)
        }
        g.add(box(2.7, 0.15, 2.7, plankM, 0, 2.6, 0))
        g.add(box(2.0, 1.4, 1.0, red, 0, 3.38, -0.8), box(1.6, 0.55, 0.05, windowM, 0, 3.5, -0.28), box(0.6, 0.15, 0.05, whiteM, 0, 3.5, -1.32), box(0.15, 0.6, 0.05, whiteM, 0, 3.5, -1.33))
        // 난간 (사다리 자리는 비움)
        for (const [x, z, w, d] of [[-1.3, 0.25, 0.06, 2.2], [1.3, 0.25, 0.06, 2.2], [-0.85, 1.3, 0.9, 0.06], [0.85, 1.3, 0.9, 0.06]]) g.add(box(w, 0.06, d, whiteM, x, 3.55, z))
        for (const [x, z] of [[-1.3, 1.3], [1.3, 1.3], [-1.3, -0.3], [1.3, -0.3], [-0.42, 1.3], [0.42, 1.3]]) g.add(cyl(0.04, 0.04, 0.9, whiteM, x, 3.12, z, 6))
        // 지붕 (기둥 위)
        for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) g.add(cyl(0.04, 0.04, 1.9, whiteM, x, 3.6, z, 6))
        g.add(new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 4), red).translateY(4.95).rotateY(Math.PI / 4))
        // 사다리
        for (const x of [-0.32, 0.32]) {
          const rail = cyl(0.04, 0.04, 2.8, whiteM, x, 1.35, 1.65, 6)
          rail.rotation.x = -0.22
          g.add(rail)
        }
        for (let i = 0; i < 8; i++) g.add(cyl(0.025, 0.025, 0.64, whiteM, 0, 0.25 + i * 0.33, 1.95 - i * 0.075, 5).rotateZ(Math.PI / 2))
        // 구명 튜브
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), red)
        ring.position.set(1.36, 2.2, 0.6)
        ring.rotation.y = Math.PI / 2
        g.add(ring)
        occlude(g, 1.8, 2.5)
        return null
      }
      case 'fire': {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2
          g.add(new THREE.Mesh(rockGeo(0.22, i, { detail: 1, moss: false }), rockM).translateX(Math.cos(a) * 0.75).translateZ(Math.sin(a) * 0.75).translateY(0.1))
        }
        for (const r of [0.3, 1.9]) {
          const l = cyl(0.09, 0.09, 1.1, mat('#5a3b22'), 0, 0.18, 0, 6)
          l.rotation.set(Math.PI / 2, r, 0.2)
          g.add(l)
        }
        statics.add(g)
        // 앉는 통나무 (그림만)
        for (const a of [0.4, 2.1, 3.9]) {
          const lg = cyl(0.22, 0.22, 1.6, mat('#7a4e2a'), s.x + Math.cos(a) * 2.3, 0.22, s.z + Math.sin(a) * 2.3, 10)
          lg.rotation.set(Math.PI / 2, 0, a + Math.PI / 2)
          statics.add(lg)
        }
        const flames = new THREE.Group()
        flames.position.set(s.x, 0.25, s.z)
        const fm = [new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.9 }), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95 })]
        const fl = [0, 1, 2, 3].map((i) => {
          const f = new THREE.Mesh(new THREE.ConeGeometry(i < 3 ? 0.3 : 0.18, i < 3 ? 1 : 0.6, 8), fm[i < 3 ? 0 : 1])
          f.position.set(i < 3 ? Math.cos(i * 2.1) * 0.12 : 0, 0.45, i < 3 ? Math.sin(i * 2.1) * 0.12 : 0)
          flames.add(f)
          return f
        })
        scene.add(flames)
        const light = new THREE.PointLight('#ff9a4a', 0, 14, 1.6)
        light.position.set(s.x, 1.2, s.z)
        scene.add(light)
        dyn.push((t, _dt, night) => {
          fl.forEach((f, i) => {
            const k = 0.85 + Math.sin(t * (9 + i * 2.3) + i) * 0.15
            f.scale.set(k, 0.8 + Math.sin(t * (7 + i) + i * 2) * 0.25, k)
          })
          light.intensity = (6 + night * 30) * (0.9 + Math.sin(t * 13) * 0.1)
        })
        return null
      }
      case 'palm': {
        const t = makePalm(sc, s.x * 13 + s.z * 7)
        g.add(t.group)
        occlude(g, 2.2 * sc, t.height * 0.75)
        return null
      }
      case 'pine': {
        const t = makePine(sc, s.x * 11 + s.z * 5)
        g.add(t.group)
        occlude(g, 1.8 * sc, t.height * 0.45)
        return null
      }
      case 'tree': {
        const t = makeTree(sc, s.x * 17 + s.z * 3)
        g.add(t.group)
        occlude(g, 2 * sc, t.height * 0.6)
        return null
      }
      case 'rock': {
        const r = new THREE.Mesh(rockGeo(sc, s.x * 3 + s.z, { detail: 3 }), rockM)
        r.scale.set(1.15, 0.85, 0.95)
        r.position.y = sc * 0.2
        r.rotation.y = s.x
        g.add(r)
        statics.add(g)
        return null
      }
      case 'boat': {
        const hull = boatMesh(s.color ?? '#e8473f')
        g.add(hull)
        if (s.c) {
          // 모래 위: 살짝 기울어 놓임
          hull.rotation.z = 0.12
          hull.position.y = 0.1
          statics.add(g)
        } else {
          scene.add(g)
          dyn.push((t) => {
            hull.position.y = 0.02 + Math.sin(t * 1.3 + s.x) * 0.05
            hull.rotation.z = Math.sin(t * 1.1 + s.z) * 0.04
          })
        }
        return null
      }
      case 'table': {
        g.add(box(2, 0.08, 0.9, plankM, 0, 0.78, 0), box(2, 0.06, 0.3, plankM, 0, 0.45, 0.62), box(2, 0.06, 0.3, plankM, 0, 0.45, -0.62))
        for (const x of [-0.8, 0.8])
          for (const sgn of [1, -1]) {
            const l = box(0.08, 0.95, 0.08, plankM, x, 0.42, sgn * 0.35)
            l.rotation.x = sgn * 0.55
            g.add(l)
          }
        statics.add(g)
        return null
      }
      case 'bench': {
        g.add(box(2, 0.07, 0.5, plankM, 0, 0.48, 0), box(2, 0.4, 0.06, plankM, 0, 0.82, -0.25))
        for (const x of [-0.85, 0.85]) g.add(box(0.07, 0.48, 0.5, darkM, x, 0.24, 0))
        statics.add(g)
        return null
      }
      case 'lamp': {
        g.add(cyl(0.12, 0.16, 0.3, darkM, 0, 0.15, 0, 8), cyl(0.05, 0.06, 3.4, darkM, 0, 1.8, 0, 6), box(0.5, 0.06, 0.5, darkM, 0, 3.5, 0))
        g.add(box(0.36, 0.42, 0.36, bulbM, 0, 3.26, 0))
        statics.add(g)
        addGlow(s.x, s.z, 4)
        return null
      }
      case 'fountain': {
        const st = mat('#c9c4b9', 0.9)
        const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.28, 8, 32), st)
        rim.rotation.x = Math.PI / 2
        rim.position.y = 0.45
        g.add(rim, cyl(2.2, 2.2, 0.4, st, 0, 0.2, 0, 32), cyl(0.3, 0.4, 1.4, st, 0, 0.9, 0, 12), cyl(0.9, 0.5, 0.25, st, 0, 1.6, 0, 16))
        const water = cyl(2.05, 2.05, 0.05, freshMat, 0, 0.42, 0, 32)
        g.add(water, cyl(0.8, 0.8, 0.04, freshMat, 0, 1.73, 0, 16))
        statics.add(g)
        // 물줄기 알갱이
        const N = 90
        const pos = new Float32Array(N * 3)
        const life = Array.from({ length: N }, () => Math.random())
        const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: '#d8f4ff', size: 0.09, transparent: true, opacity: 0.85 }))
        pts.position.set(s.x, 0, s.z)
        pts.frustumCulled = false
        scene.add(pts)
        dyn.push((_t, dt) => {
          for (let i = 0; i < N; i++) {
            life[i] += dt * 0.9
            if (life[i] > 1) life[i] -= 1
            const k = life[i], a = i * 2.399
            const r = k * 1.3
            pos[i * 3] = Math.cos(a) * r
            pos[i * 3 + 1] = 1.9 + k * 2.2 - k * k * 3.4
            pos[i * 3 + 2] = Math.sin(a) * r
          }
          pts.geometry.getAttribute('position').needsUpdate = true
        })
        return null
      }
      case 'vending': {
        g.add(box(1.1, 2, 0.9, mat('#d94a3c', 0.5), 0, 1, 0), box(0.8, 1, 0.04, glowMat('#bfe9ff'), -0.05, 1.3, 0.46))
        for (let i = 0; i < 6; i++) g.add(box(0.14, 0.2, 0.05, mat(['#3f8fd0', '#ffd23f', '#2f9e6a'][i % 3]), -0.3 + (i % 3) * 0.25, 1.55 - Math.floor(i / 3) * 0.4, 0.49))
        g.add(box(0.6, 0.2, 0.05, darkM, 0, 0.4, 0.46))
        statics.add(g)
        return null
      }
      case 'sign': {
        g.add(cyl(0.06, 0.06, 2.2, postM, 0, 1.1, 0, 6))
        // 뒷면은 왼쪽·오른쪽이 바뀌므로 '← 바다 · 호수 →'면 뒤엔 '← 호수 · 바다 →' (사용자 제보 2026-11-18)
        const label = s.label ?? ''
        const parts = label.replace(/[←→]/g, '').split('·').map((x) => x.trim())
        const backLabel = parts.length === 2 && label.includes('←') ? `← ${parts[1]} · ${parts[0]} →` : label
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.06), [mat('#8d5f3a'), mat('#8d5f3a'), mat('#8d5f3a'), mat('#8d5f3a'), new THREE.MeshStandardMaterial({ map: labelTex(label, '#f4ead2', '#5a3b22', 512, 128) }), new THREE.MeshStandardMaterial({ map: labelTex(backLabel, '#f4ead2', '#5a3b22', 512, 128) })])
        board.position.y = 1.9
        g.add(board)
        scene.add(g)
        return null
      }
      case 'umbrella': {
        g.add(makeUmbrella(s.color ?? '#e8473f'))
        occlude(g, 1.9, 1.6)
        return null
      }
      case 'crate': {
        // 판자로 짠 상자 + 모서리 각목
        const K = kit()
        g.add(box(s.w!, 0.9, s.d!, K.plankM, 0, 0.45, 0))
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.09, 0.92, 0.09, K.weatheredM, (x * s.w!) / 2, 0.46, (z * s.d!) / 2))
        for (const y of [0.05, 0.86]) g.add(box(s.w! + 0.04, 0.08, s.d! + 0.04, K.weatheredM, 0, y, 0))
        statics.add(g)
        return null
      }
      case 'flag': {
        g.add(cyl(0.04, 0.05, 4, whiteM, 0, 2, 0, 6))
        const fg = new THREE.PlaneGeometry(1.2, 0.7, 8, 1)
        const fl = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: '#ffd23f', side: THREE.DoubleSide, roughness: 0.8 }))
        fl.position.set(0.62, 3.6, 0)
        const red = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35, 8, 1), new THREE.MeshStandardMaterial({ color: '#e8473f', side: THREE.DoubleSide, roughness: 0.8 }))
        red.position.set(0.62, 3.43, 0.001)
        g.add(fl, red)
        scene.add(g)
        const base = (fg.getAttribute('position') as THREE.BufferAttribute).array.slice()
        const geos = [fg, red.geometry]
        dyn.push((t) => {
          for (const geo of geos) {
            const p = geo.getAttribute('position') as THREE.BufferAttribute
            for (let i = 0; i < p.count; i++) {
              const x = base[i * 3] + 0.6
              p.setZ(i, Math.sin(t * 4 - x * 4) * 0.08 * x)
            }
            p.needsUpdate = true
          }
        })
        return null
      }
      case 'well': {
        const st = mat('#a9a49a', 0.95)
        g.add(cyl(1, 1, 0.8, st, 0, 0.4, 0, 16), cyl(0.82, 0.82, 0.82, darkM, 0, 0.41, 0, 16))
        for (const x of [-0.9, 0.9]) g.add(cyl(0.07, 0.07, 1.8, postM, x, 1.3, 0, 6))
        g.add(new THREE.Mesh(roofGeo(2.4, 1.6, 0.7), mat('#8d5f3a')).translateY(2.15), cyl(0.18, 0.15, 0.25, mat('#7a5a3a'), 0, 1.3, 0, 8))
        statics.add(g)
        return null
      }
    }
    return null
  }
  const boatMesh = makeBoat
  for (const s of STRUCTS) build(s)

  // ── 물 위 움직이는 것: 묶인 배·부표·멀리 돛단배 ──
  const floaters: { o: THREE.Object3D; ph: number }[] = []
  for (const [x, z] of [[-20, -30], [-6, -34], [12, -30], [-44, -28], [2, -24], [16, -22]]) {
    const b = new THREE.Group()
    b.position.set(x, 0, z)
    b.add(cyl(0.35, 0.45, 0.6, mat('#e8473f', 0.5), 0, 0.15, 0, 12), cyl(0.36, 0.36, 0.16, whiteM, 0, 0.3, 0, 12), cyl(0.04, 0.04, 0.6, darkM, 0, 0.75, 0, 5))
    scene.add(b)
    floaters.push({ o: b, ph: z })
  }
  dyn.push((t) => {
    for (const f of floaters) {
      f.o.position.y = Math.sin(t * 1.3 + f.ph) * 0.07
      f.o.rotation.z = Math.sin(t * 1.1 + f.ph * 2) * 0.05
      f.o.rotation.x = Math.sin(t * 0.9 + f.ph) * 0.04
    }
  })
  const sailboat = new THREE.Group()
  {
    const hull = boatMesh('#ffffff')
    hull.scale.set(1.6, 1.6, 2)
    sailboat.add(hull)
    sailboat.add(cyl(0.06, 0.06, 5, mat('#8d5f3a'), 0, 2.8, 0.3, 5))
    const sail = new THREE.Shape()
    sail.moveTo(0, 0)
    sail.lineTo(0, 4.2)
    sail.lineTo(2.4, 0)
    sail.closePath()
    const sm = new THREE.Mesh(new THREE.ShapeGeometry(sail), new THREE.MeshStandardMaterial({ color: '#fff8ee', side: THREE.DoubleSide }))
    sm.rotation.y = Math.PI / 2
    sm.position.set(0, 0.8, 0.3)
    sailboat.add(sm)
    sailboat.rotation.y = Math.PI / 2
    scene.add(sailboat)
  }
  dyn.push((t) => {
    sailboat.position.set(-140 + ((t * 2.2) % 280), Math.sin(t) * 0.08, -95)
  })

  // ── 먼 곳: 섬·산 (안개 없이 흐린 색) ──
  const farM = (c: string) => new THREE.MeshBasicMaterial({ color: c, fog: false })
  const farMats = [farM('#7fa5b8'), farM('#93b6c6'), farM('#6f93a8')]
  for (const [x, z, r, h, k] of [[-120, -170, 30, 22, 0], [-60, -200, 20, 12, 1], [90, -190, 34, 26, 2], [180, -120, 40, 30, 0], [-200, -60, 36, 24, 1], [230, 40, 50, 46, 2], [140, 160, 60, 50, 0], [0, 230, 70, 40, 1], [-180, 140, 50, 44, 2]] as const) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), farMats[k])
    m.position.set(x, h / 2 - 2, z)
    m.rotation.y = x
    scene.add(m)
  }
  // 구름
  const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, transparent: true, opacity: 0.95 })
  const clouds: THREE.Group[] = []
  for (let i = 0; i < 30; i++) {
    const c = new THREE.Group()
    for (let k = 0; k < 5; k++) c.add(new THREE.Mesh(new THREE.SphereGeometry(3 + rnd() * 3, 10, 8), cloudM).translateX(k * 4 - 8).translateY(rnd() * 2).translateZ(rnd() * 4 - 2))
    c.scale.y = 0.45
    c.position.set(-220 + rnd() * 440, 55 + rnd() * 25, -220 + rnd() * 440)
    scene.add(c)
    clouds.push(c)
  }
  dyn.push((_t, dt) => {
    for (const c of clouds) {
      c.position.x += dt * 1.2
      if (c.position.x > 230) c.position.x = -230
    }
  })
  // 갈매기 (바다 위를 빙빙)
  const gullM = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.9 })
  const gulls = Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6).scale(1, 0.8, 2.2), gullM))
    const wings = [1, -1].map((sgn) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3).translate((sgn * 0.45), 0, 0), gullM)
      w.rotation.x = -Math.PI / 2
      g.add(w)
      return w
    })
    scene.add(g)
    return { g, wings, cx: -30 + (i % 4) * 18, cz: -24 - (i % 3) * 8, r: 8 + (i % 3) * 5, h: 11 + (i % 4) * 2.5, sp: 0.25 + (i % 3) * 0.08, ph: i * 1.7 }
  })
  dyn.push((t) => {
    for (const gl of gulls) {
      const a = t * gl.sp + gl.ph
      gl.g.position.set(gl.cx + Math.cos(a) * gl.r, gl.h + Math.sin(t * 0.7 + gl.ph) * 0.8, gl.cz + Math.sin(a) * gl.r)
      gl.g.rotation.y = -a
      gl.g.rotation.z = 0.25
      const f = Math.sin(t * 7 + gl.ph) * 0.5
      gl.wings[0].rotation.y = f
      gl.wings[1].rotation.y = -f
    }
  })

  // ── 멈춘 것 합치기 (재질별 한 덩어리) ──
  for (const m of mergeByMaterial(statics, new THREE.Matrix4())) {
    scene.add(m)
    disposables.push(m.geometry)
  }

  // ── 시각 따라 하늘·빛 ──
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat))
  let envTex: THREE.Texture | null = null
  let envDay = -1, envDusk = -1, envCloud = -1
  const C = (c: string) => new THREE.Color(c)
  const SKY = { dayTop: C('#4fa6ec'), dayHor: C('#cdeaff'), duskTop: C('#5265b0'), duskHor: C('#ffad78'), nightTop: C('#070d2c'), nightHor: C('#1f2a58') }
  const top = new THREE.Color(), hor = new THREE.Color()
  let lastPhase = -1
  let weather = weatherNow()
  // ── 비: 카메라 둘레 상자 안에서 떨어지는 줄 (비 오는 날씨에만) ──
  const camPos = new THREE.Vector3()
  const RAIN_N = 1800, RB = 26, RH = 18
  const rainPos = new Float32Array(RAIN_N * 6)
  const rainSeed = Array.from({ length: RAIN_N }, () => [Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1])
  const rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rainMat = new THREE.LineBasicMaterial({ color: '#cfe0f0', transparent: true, opacity: 0, depthWrite: false })
  const rain = new THREE.LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  scene.add(rain)
  disposables.push(rainGeo, rainMat)
  dyn.push((t) => {
    const amt = weather.rain
    rain.visible = amt > 0.02
    if (!rain.visible) return
    rainMat.opacity = 0.55 * amt
    const n = Math.floor(RAIN_N * amt)
    for (let i = 0; i < RAIN_N; i++) {
      const [sx, sy, sz] = rainSeed[i]
      const o = i * 6
      if (i >= n) {
        rainPos.fill(0, o, o + 6)
        continue
      }
      // 칸마다 제자리에서 반복해 떨어짐 (카메라를 따라 상자가 움직임)
      const y = RH - (((t * 16 + sy * RH) % RH) + RH) % RH
      const x = camPos.x + sx * RB, z = camPos.z + sz * RB
      rainPos[o] = x
      rainPos[o + 1] = y
      rainPos[o + 2] = z
      rainPos[o + 3] = x + 0.05
      rainPos[o + 4] = y - 0.55
      rainPos[o + 5] = z + 0.03
    }
    rainGeo.getAttribute('position').needsUpdate = true
  })
  function applySky(t: number) {
    const h = hourNow()
    const { day, dusk } = skyPhase(h)
    const w = weatherNow()
    weather = w
    const cloud = w.cloud
    top.copy(SKY.nightTop).lerp(SKY.dayTop, day).lerp(SKY.duskTop, dusk * 0.7 * (1 - cloud))
    hor.copy(SKY.nightHor).lerp(SKY.dayHor, day).lerp(SKY.duskHor, dusk * 0.8 * (1 - cloud))
    // 흐리면 회색 하늘 (밤엔 더 어둡게)
    top.lerp(C('#7d8894').multiplyScalar(0.25 + 0.75 * day), cloud * 0.8)
    hor.lerp(C('#b9c0c7').multiplyScalar(0.3 + 0.7 * day), cloud * 0.7)
    skyU.top.value.copy(top)
    skyU.horizon.value.copy(hor)
    ;(scene.fog as THREE.Fog).color.copy(hor)
    if (scene.background instanceof THREE.Color) scene.background.copy(hor)
    // 해: 6시 동쪽(+x) → 12시 위 → 18시 서쪽
    const a = ((h - 6) / 12) * Math.PI
    const sx = Math.cos(a), sy = Math.sin(a)
    sunDir.set(sx * 60, Math.max(8, sy * 70), -30).normalize()
    sun.color.set(dusk > 0.3 ? '#ffc58f' : day > 0.2 ? '#fff4dc' : '#9fb3ff')
    sun.intensity = (0.22 + day * 1.4) * (1 - 0.65 * cloud)
    sunDisc.position.set(sx * 330, sy * 330 - 10, -150)
    sunDisc.lookAt(0, 0, 0)
    ;(sunDisc.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, sy * 4)) * (1 - cloud * 0.9)
    ;(sunDisc.material as THREE.MeshBasicMaterial).color.set(dusk > 0.3 ? '#ffb070' : '#fff3c4')
    moon.position.set(-sx * 320, -sy * 320 + 40, -170)
    moon.lookAt(0, 0, 0)
    const night = 1 - day
    ;(moon.material as THREE.MeshBasicMaterial).opacity = night * (1 - cloud * 0.8)
    ;(stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.2) * (1 - cloud)
    // 비가 오면 안개가 가까이
    const fog = scene.fog as THREE.Fog
    fog.near = 55 - 32 * w.rain
    fog.far = 210 - 110 * w.rain
    const hm = hemi as THREE.HemisphereLight | null
    // 밤엔 확실히 어둡게 (방 반사 빛·보조 빛도 같이 줄임) — 내 주변은 따라다니는 조명이 비춤
    scene.environmentIntensity = 0.6 * (0.2 + 0.8 * day)
    // 하늘을 반사광으로 (물·유리에 하늘이 비침) — 색이 꽤 바뀌었을 때만 다시 구움
    if (Math.abs(day - envDay) > 0.08 || Math.abs(dusk - envDusk) > 0.08 || Math.abs(cloud - envCloud) > 0.1 || !envTex) {
      envDay = day
      envDusk = dusk
      envCloud = cloud
      const old = envTex
      envTex = pmrem.fromScene(envScene, 0, 1, 500).texture
      scene.environment = envTex
      old?.dispose()
    }
    scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight && o !== sun) o.intensity = 0.35 * day
    })
    if (hm) {
      hm.intensity = 0.14 + day * 0.71
      hm.color.set(day > 0.5 ? '#fff2e0' : '#9fb3ff')
    }
    cloudM.color.copy(C('#4a5578')).lerp(C('#ffffff'), day).lerp(C('#ffc7a0'), dusk * 0.6 * (1 - cloud)).lerp(C('#6d7580').multiplyScalar(0.4 + 0.6 * day), w.rain * 0.8)
    // 흐릴수록 구름이 많이
    clouds.forEach((c, i) => (c.visible = i < 8 + Math.round(cloud * (clouds.length - 8))))
    farMats.forEach((m, i) => m.color.copy(C(['#7fa5b8', '#93b6c6', '#6f93a8'][i])).lerp(hor, 0.35).multiplyScalar(0.25 + day * 0.75))
    nightU.value = Math.max(night * 0.75, cloud * 0.3)
    for (const m of lit) m.emissiveIntensity = night * 1.6 + 0.05
    for (const g of groundGlow) (g.material as THREE.MeshBasicMaterial).opacity = night * 0.55
    lastPhase = t
    return night
  }
  let night = applySky(0)

  // ── 미니맵 바탕 (2px = 1m) ──
  const minimap = document.createElement('canvas')
  {
    const W = BOUNDS.maxX - BOUNDS.minX, H = BOUNDS.maxZ - BOUNDS.minZ, K = 2
    minimap.width = W * K
    minimap.height = H * K
    const g = minimap.getContext('2d')!
    const img = g.createImageData(minimap.width, minimap.height)
    const boards = [PIER, PIER_END, JETTY, DOCK, BRIDGE, LAKE_DOCK]
    for (let py = 0; py < minimap.height; py++)
      for (let px = 0; px < minimap.width; px++) {
        const x = BOUNDS.minX + (px + 0.5) / K, z = BOUNDS.minZ + (py + 0.5) / K
        const w = waterAt(x, z)
        const onB = boards.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)
        const c = onB ? [169, 115, 63] : w === 'sea' ? [47, 134, 198] : w === 'fresh' ? [63, 182, 201] : z < 15 && x < SEA_EAST ? [236, 212, 154] : [111, 184, 92]
        const i = (py * minimap.width + px) * 4
        img.data.set([c[0], c[1], c[2], 255], i)
      }
    g.putImageData(img, 0, 0)
    g.fillStyle = 'rgba(31,26,77,0.85)'
    for (const s of STRUCTS) {
      if (s.kind === 'umbrella' || s.kind === 'lamp' || s.kind === 'sign' || s.kind === 'flag') continue
      if (s.w && s.d) g.fillRect((s.x - s.w / 2 - BOUNDS.minX) * K, (s.z - s.d / 2 - BOUNDS.minZ) * K, s.w * K, s.d * K)
      else if (s.c) {
        g.beginPath()
        g.arc((s.x - BOUNDS.minX) * K, (s.z - BOUNDS.minZ) * K, Math.max(1.5, s.c * K), 0, Math.PI * 2)
        g.fill()
      }
    }
    g.fillStyle = '#ffffff'
    for (const b of BEDS) g.fillRect((b.x - BOUNDS.minX) * K - 1.5, (b.z - BOUNDS.minZ) * K - 1.5, 3, 3)
  }

  return {
    setCamera: (p) => camPos.copy(p),
    roofs,
    follow(x, z) {
      // 그림자 칸에 딱 맞춰 옮김 — 걸을 때마다 그림자 가장자리가 지글지글 떨리지 않게
      const texel = (2 * SHADOW_HALF) / SHADOW_RES
      lightRight.crossVectors(UP, sunDir).normalize()
      lightUp.crossVectors(sunDir, lightRight).normalize()
      snapP.set(x, 0, z)
      const a = snapP.dot(lightRight), b = snapP.dot(lightUp)
      snapP.addScaledVector(lightRight, Math.round(a / texel) * texel - a).addScaledVector(lightUp, Math.round(b / texel) * texel - b)
      sun.target.position.copy(snapP)
      sun.position.copy(snapP).addScaledVector(sunDir, 80)
    },
    occluders,
    minimap,
    update(t, dt) {
      time.value = t
      if (t - lastPhase > 5) night = applySky(t)
      for (const f of dyn) f(t, dt, night)
    },
    night: () => night,
    dispose() {
      for (const d of disposables) d.dispose()
      skyMat.dispose()
      envTex?.dispose()
      pmrem.dispose()
    },
  }
}
