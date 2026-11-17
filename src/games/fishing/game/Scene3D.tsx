import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createStage, nearestOnScreen } from '../../../shared/art3d/stage'
import { type AnimalRig, ANIMALS, makeAnimal, plainLook } from '../../../shared/art3d/animals'
import { decodeLook } from '../../../shared/art3d/animalKinds'
import { BEDS, PIER, POND, SEA_EAST, STREAM, shoreZ } from '../play/map'
import { fishImageUrl } from '../field/fishArt'
import { type Catch, fishById, IRO } from '../play/fish'
import { CAM_LIMITS, type World } from './useFishingRoom'

// 3D 낚시터 (사용자 요청 2026-11-17). 위가 바다(부두), 오른쪽 풀밭에 개울·연못, 물가를 따라 썬베드.
// 카메라는 나를 부드럽게 따라가기만 하고 흔들거나 돌지 않음 (사용자가 3D 멀미가 심함 — 저절로 움직이는 화면 없음).
// 이름표·말풍선·입질 !·잡은 물고기는 3D 위치를 화면에 옮긴 HTML.

const SKY = '#a7dcff'
const SHIRTS = ['#5b8cff', '#ff8ab0', '#7cc8ff', '#9be08a', '#ffd23f', '#c79bff', '#ff9a5a', '#5be0f0']
/** 캐릭터 크기 (모델 키 약 2.9 → 1.6m쯤) */
const SCALE = 0.62
/** 낚싯줄 점 수 (처지는 곡선) */
const LINE_PTS = 16

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

type Actor = {
  id: string
  rig: AnimalRig
  rod: THREE.Group
  tip: THREE.Object3D
  line: THREE.Line
  bob: THREE.Mesh
  ring: THREE.Mesh
  tag: HTMLDivElement
  bubble: HTMLDivElement
  bang: HTMLDivElement
  pop: HTMLDivElement
  popKey: string
  avatar: string | undefined
  /** 머리 위로 든 물고기 (실제 크기에 맞춰) */
  held: THREE.Sprite
  heldKey: string
  /** 낚싯대 움직임: 지난 상태, 던진 때·거둔 때, 마지막 찌 자리, 줄 시작점 */
  prev: 'none' | 'cast' | 'bite'
  castAt: number
  reelAt: number
  lastBob: [number, number] | null
  ringMat: THREE.MeshBasicMaterial
}

/** 잡은 물고기를 들었을 때 그림 너비 (m): 실제 크기를 따르되 너무 작거나 크지 않게 (캐릭터 키 약 1.6m) */
export function heldWidth(c: Catch) {
  if (fishById(c.fish)?.rarity === 'junk') return 0.7
  // 예: 30cm → 0.7m · 60cm → 1m · 2m → 2.6m · 4m → 3.6m (화면에서 작은 물고기도 보이게 실제보다 조금 크게)
  return Math.min(3.6, Math.max(0.6, 0.35 + (c.size / 100) * 1.1))
}

/** 던질 때 낚싯대 각도 (뒤로 젖혔다 휙 → 제자리), k = 던지고 지난 초 */
function castAngle(k: number) {
  const ease = (a: number, b: number, x: number) => a + (b - a) * (1 - Math.cos(Math.min(1, Math.max(0, x)) * Math.PI)) / 2
  if (k < 0.22) return ease(0.95, -0.3, k / 0.22)
  if (k < 0.4) return ease(-0.3, 1.4, (k - 0.22) / 0.18)
  return ease(1.4, 0.95, (k - 0.4) / 0.35)
}

function mat(color: string, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough })
}

/** 맵 (땅·물·부두·썬베드·나무). 돌려주는 것 = 카메라와 나 사이에 오면 반투명해질 것 (파라솔·나무) */
function buildWorld(scene: THREE.Scene): THREE.Group[] {
  const occluders: THREE.Group[] = []
  const flat = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = y
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  }
  // 바다 (아주 넓게)
  flat(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#2f86c6', roughness: 0.3, metalness: 0.05 }), -0.12)
  // 모래사장: 물가선을 따라 (모양 좌표는 (x, -z))
  const sand = new THREE.Shape()
  sand.moveTo(-80, -shoreZ(-80))
  for (let x = -80; x <= SEA_EAST; x += 0.5) sand.lineTo(x, -shoreZ(x))
  sand.lineTo(SEA_EAST, -60)
  sand.lineTo(-80, -60)
  flat(new THREE.ShapeGeometry(sand), mat('#efd9a0'), 0)
  // 젖은 모래 띠
  const wet = new THREE.Shape()
  wet.moveTo(-80, -shoreZ(-80))
  for (let x = -80; x <= SEA_EAST; x += 0.5) wet.lineTo(x, -shoreZ(x))
  for (let x = SEA_EAST; x >= -80; x -= 0.5) wet.lineTo(x, -(shoreZ(x) + 0.9))
  flat(new THREE.ShapeGeometry(wet), mat('#d9bf86'), 0.004)
  // 풀밭 (오른쪽, 북쪽 끝까지)
  flat(new THREE.PlaneGeometry(80, 140).translate(SEA_EAST + 40, -10, 0), mat('#7cc46a'), 0.01)
  // 연못·개울
  const fresh = new THREE.MeshStandardMaterial({ color: '#3fa3a8', roughness: 0.25 })
  flat(new THREE.CircleGeometry(POND.r, 40).translate(POND.x, -POND.z, 0), fresh, 0.03)
  const len = Math.hypot(STREAM.bx - STREAM.ax, STREAM.bz - STREAM.az)
  const stream = flat(new THREE.PlaneGeometry(STREAM.half * 2, len + 2), fresh, 0.03)
  stream.position.set((STREAM.ax + STREAM.bx) / 2, 0.03, (STREAM.az + STREAM.bz) / 2)
  stream.rotation.set(-Math.PI / 2, 0, -Math.atan2(STREAM.bx - STREAM.ax, STREAM.bz - STREAM.az))
  // 연못 돌
  const stone = mat('#9aa3ad')
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + (i % 3) * 0.1, 8, 6), stone)
    s.position.set(POND.x + Math.cos(a) * (POND.r + 0.3), 0.08, POND.z + Math.sin(a) * (POND.r + 0.3))
    s.scale.y = 0.5
    s.castShadow = true
    scene.add(s)
  }
  // 바다와 풀밭 사이 바위
  for (let z = shoreZ(SEA_EAST); z > -22; z -= 1.4) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + (Math.abs(z) % 3) * 0.2), mat('#8b8f99'))
    s.position.set(SEA_EAST - 0.2, 0.2, z)
    s.castShadow = true
    scene.add(s)
  }
  // 부두 (나무 판 + 기둥)
  const wood = mat('#a9733f', 0.7)
  const pierEnd = shoreZ((PIER.minX + PIER.maxX) / 2) + 0.5
  const pierLen = pierEnd - PIER.minZ
  const deck = new THREE.Mesh(new THREE.BoxGeometry(PIER.maxX - PIER.minX, 0.18, pierLen), wood)
  deck.position.set((PIER.minX + PIER.maxX) / 2, 0.12, (PIER.minZ + pierEnd) / 2)
  deck.receiveShadow = true
  deck.castShadow = true
  scene.add(deck)
  for (let z = PIER.minZ + 0.4; z < pierEnd; z += 2.4) {
    for (const x of [PIER.minX + 0.15, PIER.maxX - 0.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 8), mat('#6b4320'))
      post.position.set(x, -0.3, z)
      scene.add(post)
    }
  }
  for (let z = PIER.minZ + 0.6; z < pierEnd; z += 0.6) {
    const gap = new THREE.Mesh(new THREE.BoxGeometry(PIER.maxX - PIER.minX, 0.01, 0.04), mat('#7a4e26'))
    gap.position.set((PIER.minX + PIER.maxX) / 2, 0.215, z)
    scene.add(gap)
  }
  // 썬베드 (앞이 물 쪽, 머리 쪽 등받이)
  const cushions = ['#ff8a7a', '#7cc8ff', '#ffd23f', '#9be08a', '#c79bff']
  BEDS.forEach((b, i) => {
    const g = new THREE.Group()
    g.position.set(b.x, 0, b.z)
    g.rotation.y = b.r
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 2.1), mat('#f4f2ff', 0.5))
    frame.position.y = 0.32
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.6), mat(cushions[i % cushions.length], 0.9))
    cushion.position.set(0, 0.42, 0.2)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.8), mat(cushions[i % cushions.length], 0.9))
    back.position.set(0, 0.62, -0.75)
    back.rotation.x = 0.7
    for (const [x, z] of [[-0.4, 0.9], [0.4, 0.9], [-0.4, -0.9], [0.4, -0.9]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6), mat('#cfd3e6'))
      leg.position.set(x, 0.16, z)
      g.add(leg)
    }
    g.add(frame, cushion, back)
    g.traverse((o) => (o.castShadow = true))
    scene.add(g)
  })
  // 파라솔
  for (const x of [-5, 3]) {
    const g = new THREE.Group()
    // 물가 바로 뒤 (카메라와 나 사이를 가리지 않게 썬베드 사이에)
    g.position.set(x, 0, shoreZ(x) + 1.4)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), mat('#f4f2ff'))
    pole.position.y = 1.3
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: x < 0 ? '#e8473f' : '#3f8fd0', side: THREE.DoubleSide, roughness: 0.8 }))
    top.position.y = 2.6
    g.add(pole, top)
    g.traverse((o) => (o.castShadow = true))
    scene.add(g)
    occluders.push(g)
  }
  // 나무
  const trunk = mat('#7a4e26')
  const leaf = mat('#3f8a3a')
  for (const [x, z, s] of [[16, -10, 1.2], [26, -4, 1], [25, 12, 1.3], [14, 14, 0.9], [-24, 10, 1.1], [-18, 13, 0.9], [8, 13, 1]] as const) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.scale.setScalar(s)
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 8), trunk)
    t.position.y = 0.8
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), leaf)
    l.position.y = 2.2
    const l2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), leaf)
    l2.position.set(0.6, 1.9, 0.3)
    g.add(t, l, l2)
    g.traverse((o) => (o.castShadow = true))
    scene.add(g)
    occluders.push(g)
  }
  return occluders
}

export function Scene3D({ world, step, onTapPlayer }: { world: World; step: (dt: number) => void; onTapPlayer: (id: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const tapRef = useRef(onTapPlayer)
  const stepRef = useRef(step)
  useEffect(() => {
    tapRef.current = onTapPlayer
    stepRef.current = step
  })

  useEffect(() => {
    const host = hostRef.current
    const layer = layerRef.current
    if (!host || !layer) return
    const stage = createStage(host, { background: SKY, fov: 42, sway: 0 })
    const { scene, camera, lamp } = stage
    scene.fog = new THREE.Fog(SKY, 32, 70)
    camera.far = 140
    camera.updateProjectionMatrix()
    // 야외: 해(넓게 밝게) + 나를 따라다니며 그림자를 만드는 조명
    scene.add(new THREE.DirectionalLight('#fff4dc', 1.5).translateX(-10).translateY(20).translateZ(8))
    lamp.intensity = 260
    lamp.distance = 50
    lamp.angle = Math.PI / 3.4
    lamp.penumbra = 0.6
    lamp.shadow.camera.far = 50
    const occluders = buildWorld(scene)
    // 가리는 것들은 각자 재질을 따로 (반투명을 하나씩 바꾸려고)
    for (const g of occluders)
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = (o.material as THREE.MeshStandardMaterial).clone()
          ;(o.material as THREE.MeshStandardMaterial).transparent = true
        }
      })
    const seg = new THREE.Line3()
    const near = new THREE.Vector3()

    const actors = new Map<string, Actor>()
    const lineMat = new THREE.LineBasicMaterial({ color: '#1f1a4d' })
    const bobGeo = new THREE.SphereGeometry(0.12, 12, 10)
    const bobMat = mat('#e8473f', 0.4)
    const ringGeo = new THREE.RingGeometry(0.25, 0.32, 24)
    // 물고기 그림 (종류·이로치마다 한 번만 읽음)
    const textures = new Map<string, THREE.Texture>()
    const textureOf = (c: Catch) => {
      const key = `${c.fish}.${c.iro}`
      let tex = textures.get(key)
      if (!tex) {
        const img = new Image()
        tex = new THREE.Texture(img)
        tex.colorSpace = THREE.SRGBColorSpace
        const t = tex
        img.onload = () => (t.needsUpdate = true)
        img.src = fishImageUrl(c.fish, c.iro)
        textures.set(key, tex)
      }
      return tex
    }
    const hands = new THREE.Vector3()
    const bobPos = new THREE.Vector3()
    const ctrl = new THREE.Vector3()

    function makeActor(id: string, avatar: string | undefined): Actor {
      const look = decodeLook(avatar) ?? plainLook(ANIMALS[hash(id) % ANIMALS.length])
      const rig = makeAnimal(look, SHIRTS[hash(id) % SHIRTS.length])
      rig.root.scale.setScalar(SCALE)
      rig.root.rotation.order = 'YXZ'
      rig.root.traverse((o) => (o.castShadow = true))
      scene.add(rig.root)
      // 낚싯대: 두 손 앞에서 앞쪽 위로 (모델 단위)
      const rod = new THREE.Group()
      rod.position.set(0, 1.35, 0.55)
      rod.rotation.x = 0.95
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 3.2, 6), mat('#6b4320', 0.6))
      stick.position.y = 1.6
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), mat('#c9ced8', 0.4))
      reel.rotation.z = Math.PI / 2
      reel.position.y = 0.4
      const tip = new THREE.Object3D()
      tip.position.y = 3.2
      rod.add(stick, reel, tip)
      rod.visible = false
      rig.root.add(rod)
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: LINE_PTS }, () => new THREE.Vector3())), lineMat)
      line.frustumCulled = false
      line.visible = false
      const bob = new THREE.Mesh(bobGeo, bobMat)
      bob.visible = false
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.visible = false
      const held = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
      held.visible = false
      held.renderOrder = 2
      scene.add(line, bob, ring, held)
      const tag = document.createElement('div')
      tag.className = 'fs-tag'
      const bubble = document.createElement('div')
      bubble.className = 'fs-bubble'
      const bang = document.createElement('div')
      bang.className = 'fs-bang'
      bang.textContent = '!'
      const pop = document.createElement('div')
      pop.className = 'fs-pop'
      const name = document.createElement('span')
      name.className = 'fs-tag__name'
      // 위에서부터 말풍선 · ! · 들고 있는 물고기 이름 · 내 이름 (기준점이 맨 아래 = 머리 위)
      tag.append(bubble, bang, pop, name)
      layer!.appendChild(tag)
      return { id, rig, rod, tip, line, bob, ring, tag, bubble, bang, pop, popKey: '', avatar, held, heldKey: '', prev: 'none', castAt: -9e9, reelAt: -9e9, lastBob: null, ringMat }
    }

    function removeActor(a: Actor) {
      scene.remove(a.rig.root, a.line, a.bob, a.ring, a.held)
      a.held.material.dispose()
      a.ringMat.dispose()
      a.rig.dispose()
      a.line.geometry.dispose()
      a.tag.remove()
    }

    const follow = new THREE.Vector3()
    let camReady = false
    const head = new THREE.Vector3()
    const v = new THREE.Vector3()
    const tipW = new THREE.Vector3()
    let raf = 0
    let last = performance.now()
    const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

    function frame() {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const gap = (now - last) / 1000
      const dt = Math.min(0.05, gap)
      last = now
      const t = now / 1000
      // 걷기는 실제 지난 시간만큼 (느린 기기에서도 같은 빠르기, 화면을 떠났다 온 긴 틈은 빼고)
      stepRef.current(Math.min(0.25, gap))

      // 사람 맞추기
      for (const [id, a] of actors) {
        const p = world.players.get(id)
        if (!p || p.avatar !== a.avatar) {
          removeActor(a)
          actors.delete(id)
        }
      }
      for (const p of world.players.values()) {
        let a = actors.get(p.id)
        if (!a) {
          a = makeActor(p.id, p.avatar)
          actors.set(p.id, a)
        }
        const isMe = p.id === world.me
        if (!isMe) {
          p.sx += (p.x - p.sx) * Math.min(1, dt * 10)
          p.sz += (p.z - p.sz) * Math.min(1, dt * 10)
          p.sr = angleLerp(p.sr, p.r, Math.min(1, dt * 10))
        }
        const lying = p.bed !== null && BEDS[p.bed]
        const walking = !lying && now < p.walkUntil
        const holding = !!p.popup && now < p.popup.until && now - p.popup.start > (p.popup.from ? 420 : 0)
        const reeling = now - a.reelAt < 500
        const pose = walking ? 'walk' : holding ? 'hold' : p.fishing !== 'none' || reeling || (p.popup && now < p.popup.until) ? 'fish' : 'idle'
        const mood = p.popup && now < p.popup.until ? 'happy' : p.fishing === 'bite' ? 'scared' : 'calm'
        a.rig.update(t, pose, mood)
        const root = a.rig.root
        if (lying) {
          const b = BEDS[p.bed!]
          root.position.set(b.x - Math.sin(b.r) * 0.25, 0.42, b.z - Math.cos(b.r) * 0.25)
          root.rotation.set(-1.15, b.r, 0)
        } else {
          root.position.set(p.sx, onPierY(p.sx, p.sz), p.sz)
          root.rotation.set(0, p.sr, 0)
        }
        // 낚싯대·줄·찌: 던지면 뒤로 젖혔다 휙 → 찌가 포물선으로 날아가 퐁, 입질엔 낚싯대가 끄덕끄덕 당겨짐,
        // 거두면 찌가 끌려오고, 잡으면 낚싯대를 확 들며 물고기가 물에서 날아와 두 손으로 머리 위에 (실제 크기에 맞춰)
        if (p.fishing !== 'none' && a.prev === 'none') a.castAt = now
        if (p.fishing === 'none' && a.prev !== 'none') a.reelAt = now
        if (p.bob) a.lastBob = p.bob
        a.prev = p.fishing
        const castK = (now - a.castAt) / 1000
        const reelK = (now - a.reelAt) / 1000
        const caught = !!p.popup && !!p.popup.from && now - p.popup.start < 420
        const showRod = p.fishing !== 'none' || reelK < 0.5 || caught
        a.rod.visible = showRod && !holding
        let rodX = 0.95
        if (p.fishing === 'bite') rodX = 1.22 + Math.sin(t * 26) * 0.12
        else if (p.fishing === 'cast') rodX = castAngle(castK)
        else if (caught) rodX = 0.95 - Math.min(1, (now - p.popup!.start) / 160) * 1.1
        else if (reelK < 0.5) rodX = 0.95 - Math.sin((reelK / 0.5) * Math.PI) * 0.55
        // 누워 있으면 몸을 젖힌 만큼 낚싯대를 앞으로 (안 그러면 머리 쪽을 향함)
        a.rod.rotation.x = rodX + (lying ? 1.0 : 0)
        a.rig.root.updateMatrixWorld(true)
        a.tip.getWorldPosition(tipW)
        // 찌 자리
        let bobVisible = false
        let sag = 0.5
        const target = p.bob ?? a.lastBob
        if (p.fishing !== 'none' && target) {
          bobVisible = true
          const fly = (castK - 0.32) / 0.45
          if (fly < 0) {
            bobPos.copy(tipW)
            sag = 0.05
          } else if (fly < 1) {
            bobPos.set(tipW.x + (target[0] - tipW.x) * fly, tipW.y + (0.05 - tipW.y) * fly + Math.sin(fly * Math.PI) * 1.6, tipW.z + (target[1] - tipW.z) * fly)
            sag = 0.1
          } else {
            const biting = p.fishing === 'bite'
            bobPos.set(target[0], biting ? -0.06 + Math.sin(t * 24) * 0.06 : 0.02 + Math.sin(t * 2 + hash(p.id)) * 0.03, target[1])
            sag = biting ? 0.15 : 0.55
          }
        } else if (reelK < 0.45 && target && !caught) {
          bobVisible = true
          const k = reelK / 0.45
          bobPos.set(target[0] + (tipW.x - target[0]) * k, 0.03 + (tipW.y - 0.03) * k * k, target[1] + (tipW.z - target[1]) * k)
          sag = 0.2
        }
        a.bob.visible = bobVisible
        a.line.visible = bobVisible
        if (bobVisible) {
          a.bob.position.copy(bobPos)
          // 처지는 줄 (끝 두 점 사이 가운데를 아래로)
          ctrl.set((tipW.x + bobPos.x) / 2, (tipW.y + bobPos.y) / 2 - sag * Math.min(1, tipW.distanceTo(bobPos) / 3), (tipW.z + bobPos.z) / 2)
          const pos = a.line.geometry.getAttribute('position') as THREE.BufferAttribute
          for (let k = 0; k < LINE_PTS; k++) {
            const u = k / (LINE_PTS - 1), w = 1 - u
            pos.setXYZ(k, w * w * tipW.x + 2 * w * u * ctrl.x + u * u * bobPos.x, w * w * tipW.y + 2 * w * u * ctrl.y + u * u * (bobPos.y + 0.1), w * w * tipW.z + 2 * w * u * ctrl.z + u * u * bobPos.z)
          }
          pos.needsUpdate = true
        }
        // 물결: 입질 중엔 계속, 찌가 떨어진 순간엔 한 번 퐁
        const landK = castK - 0.77
        const splash = p.fishing !== 'none' && landK >= 0 && landK < 0.6
        a.ring.visible = !!target && (p.fishing === 'bite' || splash)
        if (a.ring.visible && target) {
          const k = p.fishing === 'bite' ? (t * 1.6) % 1 : landK / 0.6
          a.ring.position.set(target[0], 0.02, target[1])
          a.ring.scale.setScalar(1 + k * 3)
          a.ringMat.opacity = 0.8 * (1 - k)
        }
        // 머리 위로 든 물고기 (잡았으면 물에서 날아옴)
        const popOn = !!p.popup && now < p.popup.until
        a.held.visible = popOn
        if (popOn && p.popup) {
          const c = p.popup.c
          const key = `${c.fish}.${c.iro}`
          if (a.heldKey !== key) {
            a.heldKey = key
            a.held.material.map = textureOf(c)
            a.held.material.needsUpdate = true
          }
          const wdt = heldWidth(c), hgt = wdt * 0.65
          hands.copy(a.rig.handsAt)
          a.rig.root.localToWorld(hands)
          const topY = hands.y + hgt * 0.45
          const k = p.popup.from ? Math.min(1, (now - p.popup.start) / 420) : 1
          if (k < 1 && p.popup.from) {
            const [fx0, fz0] = p.popup.from
            a.held.position.set(fx0 + (hands.x - fx0) * k, topY * k + Math.sin(k * Math.PI) * 1.4, fz0 + (hands.z - fz0) * k)
            a.held.scale.set(wdt * (0.4 + 0.6 * k), hgt * (0.4 + 0.6 * k), 1)
          } else {
            a.held.position.set(hands.x, topY + Math.sin(t * 5) * 0.03, hands.z)
            a.held.scale.set(wdt, hgt, 1)
          }
        }
      }

      // 카메라: 3인칭은 나를 부드럽게 따라가며 내가 돌린 방향·높이에서, 1인칭은 내 눈 자리에서 (저절로 흔들거나 돌지 않음)
      const me = world.players.get(world.me)
      if (me) {
        const cam = world.cam
        const meActor = actors.get(world.me)
        if (meActor) meActor.rig.head.visible = !cam.first
        const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw)
        if (cam.first && meActor) {
          meActor.rig.head.visible = true
          meActor.rig.head.getWorldPosition(head)
          meActor.rig.head.visible = false
          const cp = Math.cos(cam.pitch)
          camera.position.set(head.x - fx * 0.15, head.y + 0.12, head.z - fz * 0.15)
          camera.lookAt(head.x - fx * cp * 10, head.y + 0.12 - Math.sin(cam.pitch) * 10, head.z - fz * cp * 10)
          camReady = false
        } else {
          const want = v.set(me.sx, 0.7, me.sz)
          if (!camReady) {
            follow.copy(want)
            camReady = true
          } else follow.lerp(want, Math.min(1, dt * 6))
          const d = cam.dist, cp = Math.cos(cam.pitch)
          camera.position.set(follow.x + fx * d * cp, follow.y + Math.sin(cam.pitch) * d, follow.z + fz * d * cp)
          camera.lookAt(follow)
        }
        lamp.position.set(me.sx + 2, 14, me.sz + 4)
        lamp.target.position.set(me.sx, 0, me.sz - 2)
      }
      // 카메라와 나 사이를 가리는 파라솔·나무는 반투명하게 (3인칭)
      if (me && !world.cam.first) {
        seg.set(camera.position, v.set(me.sx, 0.9, me.sz))
        for (const g of occluders) {
          seg.closestPointToPoint(g.position.clone().setY(1.6), true, near)
          const hide = near.distanceTo(g.position.clone().setY(1.6)) < 1.9 && near.distanceTo(seg.end) > 0.8
          g.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const m = o.material as THREE.MeshStandardMaterial
              m.opacity += ((hide ? 0.22 : 1) - m.opacity) * Math.min(1, dt * 8)
              m.depthWrite = m.opacity > 0.95
            }
          })
        }
      }
      stage.render()

      // 이름표·말풍선·!·잡은 물고기
      for (const a of actors.values()) {
        const p = world.players.get(a.id)
        if (!p) continue
        a.rig.head.getWorldPosition(v)
        v.y += 0.55
        // 물고기를 들고 있으면 이름표는 물고기 위로
        if (a.held.visible) v.set(a.held.position.x, Math.max(v.y, a.held.position.y + a.held.scale.y / 2 + 0.12), a.held.position.z)
        const s = stage.toScreen(v)
        a.tag.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`
        a.tag.style.visibility = s.visible ? 'visible' : 'hidden'
        const name = a.tag.lastChild as HTMLSpanElement
        const label = p.id === world.me ? `${p.name} (나)` : p.name
        if (name.textContent !== label) name.textContent = label
        a.tag.classList.toggle('fs-tag--me', p.id === world.me)
        const bubbleOn = !!p.bubble && now < p.bubble.until
        if (bubbleOn && a.bubble.textContent !== p.bubble!.text) a.bubble.textContent = p.bubble!.text
        a.bubble.hidden = !bubbleOn
        a.bang.hidden = p.fishing !== 'bite'
        const popOn = !!p.popup && now < p.popup.until
        const key = popOn ? `${p.popup!.c.fish}.${p.popup!.c.iro}.${p.popup!.until}` : ''
        if (key !== a.popKey) {
          a.popKey = key
          const c = p.popup?.c
          a.pop.textContent = popOn && c ? `${c.iro ? `${IRO.find((x) => x.id === c.iro)?.name} ` : ''}${fishById(c.fish)?.name ?? ''}${c.size ? ` ${c.size}cm` : ''}` : ''
          a.pop.classList.toggle('fs-pop--on', popOn)
        }
      }
    }
    frame()

    // 화면을 끌면 시점 돌리기(좌우·위아래), 끌지 않고 떼면 누른 사람의 어항 (폰은 빈 곳을 한 손가락으로, PC는 마우스 왼쪽)
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || drag) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
      host.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 6) return
      drag.moved = true
      drag.x = e.clientX
      drag.y = e.clientY
      const cam = world.cam
      cam.yaw -= dx * 0.006
      const lim = cam.first ? CAM_LIMITS.first : CAM_LIMITS.third
      cam.pitch = Math.min(lim.max, Math.max(lim.min, cam.pitch + dy * 0.005))
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const tap = !drag.moved
      drag = null
      if (!tap) return
      const list = [...actors.values()].filter((a) => a.id !== world.me)
      const i = nearestOnScreen(stage, e.clientX, e.clientY, list.map((a) => a.rig.head.getWorldPosition(new THREE.Vector3())))
      if (i !== null && list[i]) tapRef.current(list[i].id)
    }
    const onCancel = () => (drag = null)
    // 휠: 3인칭 거리
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cam = world.cam
      if (!cam.first) cam.dist = Math.min(CAM_LIMITS.dist.max, Math.max(CAM_LIMITS.dist.min, cam.dist * (1 + Math.sign(e.deltaY) * 0.1)))
    }
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onCancel)
    host.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onCancel)
      host.removeEventListener('wheel', onWheel)
      for (const a of actors.values()) removeActor(a)
      bobGeo.dispose()
      ringGeo.dispose()
      stage.dispose()
    }
  }, [world])

  return (
    <div className="fs-scene">
      <div ref={hostRef} className="fs-scene__gl" />
      <div ref={layerRef} className="fs-scene__layer" aria-hidden="true" />
    </div>
  )
}

/** 부두 위면 판자 높이만큼 */
const onPierY = (x: number, z: number) => (x >= PIER.minX && x <= PIER.maxX && z < shoreZ(x) + 0.5 ? 0.21 : 0)
