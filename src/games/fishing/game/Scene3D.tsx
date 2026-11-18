import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createStage, nearestOnScreen } from '../../../shared/art3d/stage'
import { type AnimalRig, ANIMALS, makeAnimal, plainLook } from '../../../shared/art3d/animals'
import { decodeLook } from '../../../shared/art3d/animalKinds'
import { BEDS, BOATS, BOUNDS, LADDERS, groundY, houseAt } from '../play/map'
import { buildWorld, makeBoat } from './worldArt'
import { fishImageUrl } from '../field/fishArt'
import { type Catch, fishById, IRO } from '../play/fish'
import { CAM_LIMITS, type World } from './useFishingRoom'
import { JUMP_HEIGHT, JUMP_MS } from '../play/protocol'

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
  /** 뿅망치 (오른손) · 마지막으로 맞은 때(별 한 번만) */
  hammer: THREE.Group
  lastHit: number
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

export function Scene3D({ world, step, onTapPlayer }: { world: World; step: (dt: number) => void; onTapPlayer: (id: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const [bigMap, setBigMap] = useState(false)
  // M: 지도 크게/작게 (채팅 칸에 쓰는 중이면 빼고)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat || (e.target as HTMLElement)?.closest?.('input, textarea')) return
      setBigMap((b) => !b)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
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
    camera.far = 460
    camera.updateProjectionMatrix()
    // 하늘·해·바다·땅·구조물 (시각 따라 낮·노을·밤) + 나를 따라다니며 그림자를 만드는 조명
    lamp.intensity = 260
    lamp.distance = 50
    lamp.angle = Math.PI / 3.4
    lamp.penumbra = 0.6
    lamp.shadow.camera.far = 50
    const art = buildWorld(scene, stage.renderer)
    if (import.meta.env.DEV) (window as unknown as { __fishStage?: unknown }).__fishStage = stage
    // 그림자는 해가 (내 주변), 따라다니는 조명은 밤에만 손전등처럼
    lamp.castShadow = false
    // 탈 수 있는 배 (탄 사람이 있으면 그 사람 자리)
    const boatObjs = BOATS.map((b) => {
      const g = makeBoat(b.color)
      scene.add(g)
      return g
    })
    const occluders = art.occluders
    // 가리는 것들은 각자 재질을 따로 (반투명을 하나씩 바꾸려고)
    for (const { g } of occluders)
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
      // 뿅망치: 빨강·노랑 장난감 망치 (평소엔 숨김, 휘두를 때만)
      const hammer = new THREE.Group()
      hammer.position.set(-0.45, 1.5, 0.25)
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), mat('#ffd23f', 0.5))
      handle.position.y = 0.65
      const headM = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.75, 14), mat('#e8473f', 0.45))
      headM.rotation.z = Math.PI / 2
      headM.position.y = 1.35
      for (const sx of [-0.38, 0.38]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 14), mat('#ffd23f', 0.45))
        cap.rotation.z = Math.PI / 2
        cap.position.set(sx, 1.35, 0)
        hammer.add(cap)
      }
      hammer.add(handle, headM)
      hammer.visible = false
      rig.root.add(hammer)
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
      return { id, rig, rod, tip, line, bob, ring, tag, bubble, bang, pop, popKey: '', avatar, held, heldKey: '', prev: 'none', castAt: -9e9, reelAt: -9e9, lastBob: null, ringMat, hammer, lastHit: 0 }
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
    let eyeReady = false
    let eyeY = 0
    let meJumpY = 0
    const head = new THREE.Vector3()
    const v = new THREE.Vector3()
    const tipW = new THREE.Vector3()
    let raf = 0
    // 미니맵: 바탕(맵) 위에 다른 사람 흰 점 · 나 노란 화살표 · 보는 쪽 부채꼴
    const mini = miniRef.current
    const mctx = mini?.getContext('2d') ?? null
    let mapTick = 0
    if (mini) {
      mini.width = art.minimap.width
      mini.height = art.minimap.height
    }
    function drawMinimap() {
      if (!mctx || !mini) return
      const K = mini.width / (BOUNDS.maxX - BOUNDS.minX)
      mctx.drawImage(art.minimap, 0, 0)
      const at = (x: number, z: number) => [(x - BOUNDS.minX) * K, (z - BOUNDS.minZ) * K] as const
      for (const p of world.players.values()) {
        if (p.id === world.me) continue
        const [x, y] = at(p.sx, p.sz)
        mctx.fillStyle = '#ffffff'
        mctx.strokeStyle = '#1f1a4d'
        mctx.lineWidth = 2
        mctx.beginPath()
        mctx.arc(x, y, 4, 0, Math.PI * 2)
        mctx.fill()
        mctx.stroke()
      }
      const me = world.players.get(world.me)
      if (me) {
        const [x, y] = at(me.sx, me.sz)
        // 보는 쪽 (카메라는 yaw 반대편에서 봄)
        const look = world.cam.yaw + Math.PI
        mctx.fillStyle = 'rgba(255,255,255,0.28)'
        mctx.beginPath()
        mctx.moveTo(x, y)
        mctx.arc(x, y, 26, Math.atan2(Math.cos(look), Math.sin(look)) - 0.55, Math.atan2(Math.cos(look), Math.sin(look)) + 0.55)
        mctx.closePath()
        mctx.fill()
        const a = Math.atan2(Math.cos(me.sr), Math.sin(me.sr))
        mctx.save()
        mctx.translate(x, y)
        mctx.rotate(a)
        mctx.fillStyle = '#ffd23f'
        mctx.strokeStyle = '#1f1a4d'
        mctx.lineWidth = 2
        mctx.beginPath()
        mctx.moveTo(8, 0)
        mctx.lineTo(-5, 5.5)
        mctx.lineTo(-2, 0)
        mctx.lineTo(-5, -5.5)
        mctx.closePath()
        mctx.fill()
        mctx.stroke()
        mctx.restore()
      }
    }
    let last = performance.now()

    function frame() {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const gap = (now - last) / 1000
      // 그림·카메라·걷기가 같은 시간으로 움직여야 안 덜컥거림 (예전엔 걷기와 카메라가 다른 시간을 써서 느린 폰에서 카메라가 밀렸다 따라붙음)
      const dt = Math.min(0.1, gap)
      last = now
      const t = now / 1000
      // 걷기는 실제 지난 시간만큼 (느린 기기에서도 같은 빠르기, 화면을 떠났다 온 긴 틈은 빼고)
      stepRef.current(dt)
      meJumpY = 0

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
        const lying = p.bed !== null && p.ride === null && BEDS[p.bed]
        const climbing = !!p.climb && now - p.climb.start < p.climb.dur
        const moving = !lying && p.ride === null && p.speed > 0.4
        const running = moving && p.speed > 7.2
        const walking = moving || climbing
        // 점프: 포물선으로 떴다가 내려옴 (자리는 그대로)
        const jk = (now - p.jumpAt) / JUMP_MS
        const jumping = jk >= 0 && jk < 1 && !lying && p.ride === null && !climbing
        const jumpY = jumping ? JUMP_HEIGHT * 4 * jk * (1 - jk) : 0
        const sitting = !walking && p.act === 'sit' && p.ride === null
        const lyingDown = !walking && p.act === 'lie' && p.ride === null
        const holding = !!p.popup && now < p.popup.until && now - p.popup.start > (p.popup.from ? 420 : 0)
        const reeling = now - a.reelAt < 500
        const pose = jumping ? 'jump' : running ? 'run' : walking ? 'walk' : lyingDown ? 'lie' : holding ? 'hold' : p.fishing !== 'none' || reeling || (p.popup && now < p.popup.until) ? 'fish' : 'idle'
        const dizzy = now - p.hitAt < 900
        const mood = dizzy ? 'ko' : p.popup && now < p.popup.until ? 'happy' : p.fishing === 'bite' ? 'scared' : 'calm'
        a.rig.update(t, dizzy && !lying ? 'scared' : sitting && pose !== 'hold' ? 'sit' : pose, mood)
        const root = a.rig.root
        if (lying) {
          // 엉덩이는 쿠션 가운데, 등은 등받이 쪽으로 기대고 다리는 쿠션 위로 쭉 (몸이 한 덩어리라 엉덩이를 축으로 젖힘)
          const b = BEDS[p.bed!]
          const lean = -1.12
          const hipY = 0.55 * SCALE
          const hx = b.x + Math.sin(b.r) * 0.05, hz = b.z + Math.cos(b.r) * 0.05, hy = 0.5
          const up = hipY * Math.cos(lean), back = hipY * Math.sin(lean)
          root.position.set(hx - Math.sin(b.r) * back, hy - up, hz - Math.cos(b.r) * back)
          root.rotation.set(lean, b.r, 0)
        } else if (climbing && p.climb) {
          // 사다리: 아래 ↔ 위 (사다리 쪽을 보고)
          const l = LADDERS[p.climb.i]
          const k0 = (now - p.climb.start) / p.climb.dur
          const k = p.climb.dir > 0 ? k0 : 1 - k0
          root.position.set(l.foot.x + (l.top.x - l.foot.x) * k, groundY(l.foot.x, l.foot.z) + l.y * k, l.foot.z + (l.top.z - l.foot.z) * k)
          root.rotation.set(0, Math.atan2(l.top.x - l.foot.x, l.top.z - l.foot.z), 0)
        } else if (p.ride !== null) {
          // 배에 앉음 (다리는 배 안에 가려짐)
          root.position.set(p.sx, 0.08 + Math.sin(t * 1.3 + p.sx) * 0.05, p.sz)
          root.rotation.set(0, p.sr, 0)
        } else {
          const gy = p.up !== null ? LADDERS[p.up].y : groundY(p.sx, p.sz)
          if (lyingDown) {
            // 바닥에 등을 대고 누움 (발끝이 서 있던 자리)
            root.position.set(p.sx, gy + 0.2 * SCALE, p.sz)
            root.rotation.set(-1.5, p.sr, 0)
          } else {
            // 앉으면 엉덩이가 바닥에 닿게 몸을 내림
            root.position.set(p.sx, gy - (sitting ? 0.5 * SCALE : 0) + jumpY, p.sz)
            if (p.id === world.me) meJumpY = jumpY
            root.rotation.set(0, p.sr, 0)
          }
        }
        // 뿅망치: 들었다가 내리치기 (0.55초)
        const swing = (now - p.bonkAt) / 550
        a.hammer.visible = swing >= 0 && swing < 1
        if (a.hammer.visible) a.hammer.rotation.x = swing < 0.35 ? -0.4 - (swing / 0.35) * 1.4 : -1.8 + Math.min(1, (swing - 0.35) / 0.2) * 3.0
        // 맞으면: 머리 위 별 + 잠깐 찌그러짐
        if (p.hitAt > a.lastHit) {
          a.lastHit = p.hitAt
          a.rig.head.getWorldPosition(v)
          stage.burst(v.clone().setY(v.y + 0.3), { color: '#ffd23f', count: 16, speed: 1.8, size: 0.16, gravity: -1, life: 0.7 })
          p.bubble = { text: '뿅!', until: now + 900 }
        }
        const squash = now - p.hitAt < 220 ? 1 - Math.sin(((now - p.hitAt) / 220) * Math.PI) * 0.28 : 1
        root.scale.set(SCALE * (2 - squash), SCALE * squash, SCALE * (2 - squash))
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

      // 배: 탄 사람이 있으면 그 사람 자리·방향, 아니면 놓인 자리 (물결에 출렁)
      boatObjs.forEach((g, i) => {
        const b = world.boats[i]
        if (!b) return
        const rider = b.rider ? world.players.get(b.rider) : null
        const x = rider ? rider.sx : b.x, z = rider ? rider.sz : b.z, r = rider ? rider.sr : b.r
        g.position.set(x, -0.18 + Math.sin(t * 1.3 + x) * 0.05, z)
        g.rotation.set(Math.sin(t * 0.9 + z) * 0.03, r + Math.PI, Math.sin(t * 1.1 + x) * 0.04)
      })

      // 카메라: 3인칭은 나를 부드럽게 따라가며 내가 돌린 방향·높이에서, 1인칭은 내 눈 자리에서 (저절로 흔들거나 돌지 않음)
      const me = world.players.get(world.me)
      if (me) {
        const cam = world.cam
        const meActor = actors.get(world.me)
        if (meActor) meActor.rig.head.visible = !cam.first
        const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw)
        if (cam.first && meActor) {
          meActor.rig.head.getWorldPosition(head)
          meActor.rig.head.visible = false
          // 눈 높이는 천천히 따라감 — 걸음마다 머리가 통통 튀는 게 1인칭에선 그대로 흔들림이 돼서
          // 점프한 높이는 빼고 (1인칭 화면이 같이 튀면 어지러워서)
          const hy = head.y - meJumpY
          if (!eyeReady) eyeY = hy
          eyeY += (hy - eyeY) * (1 - Math.exp(-dt * 3))
          eyeReady = true
          head.set(me.sx, eyeY, me.sz)
          const cp = Math.cos(cam.pitch)
          camera.position.set(head.x - fx * 0.15, head.y + 0.12, head.z - fz * 0.15)
          camera.lookAt(head.x - fx * cp * 10, head.y + 0.12 - Math.sin(cam.pitch) * 10, head.z - fz * cp * 10)
          camReady = false
        } else {
          const want = v.set(me.sx, 0.7 + (me.up !== null ? LADDERS[me.up].y : 0), me.sz)
          if (!camReady) {
            follow.copy(want)
            camReady = true
          } else follow.lerp(want, 1 - Math.exp(-dt * 7))
          eyeReady = false
          const d = cam.dist, cp = Math.cos(cam.pitch)
          camera.position.set(follow.x + fx * d * cp, follow.y + Math.sin(cam.pitch) * d, follow.z + fz * d * cp)
          camera.lookAt(follow)
        }
        // 밤엔 손전등처럼 내 주변만 따뜻하게 (낮엔 끔 — 해가 비춤)
        art.follow(me.sx, me.sz)
        lamp.intensity = art.night() * 170
        lamp.color.set(art.night() > 0.5 ? '#ffd9a0' : '#ffe6c4')
        lamp.position.set(me.sx + 2, 14, me.sz + 4)
        lamp.target.position.set(me.sx, 0, me.sz - 2)
      }
      // 카메라와 나 사이를 가리는 파라솔·나무는 반투명하게 (3인칭)
      if (me && !world.cam.first) {
        seg.set(camera.position, v.set(me.sx, 0.9, me.sz))
        const inHouse = houseAt(me.sx, me.sz)
        // 집 안이면 그 집 지붕을 숨김
        art.roofs.forEach((rf, i) => (rf.visible = i !== inHouse))
        for (const { g, r, y, house } of occluders) {
          const c = g.position.clone().setY(y)
          seg.closestPointToPoint(c, true, near)
          const hide = (house !== undefined && house === inHouse) || (near.distanceTo(c) < r && near.distanceTo(seg.end) > 0.8)
          g.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const m = o.material as THREE.MeshStandardMaterial
              m.opacity += ((hide ? 0.22 : 1) - m.opacity) * Math.min(1, dt * 8)
              m.depthWrite = m.opacity > 0.95
            }
          })
        }
      }
      art.update(t, dt)
      stage.render()
      if (++mapTick % 4 === 0) drawMinimap()

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
      art.dispose()
      bobGeo.dispose()
      ringGeo.dispose()
      stage.dispose()
    }
  }, [world])

  return (
    <div className="fs-scene">
      <div ref={hostRef} className="fs-scene__gl" />
      <div ref={layerRef} className="fs-scene__layer" aria-hidden="true" />
      <button type="button" className={`fs-minimap${bigMap ? ' fs-minimap--big' : ''}`} onClick={() => setBigMap((b) => !b)} aria-label={bigMap ? '지도 작게' : '지도 크게'} title="지도 (M)">
        <canvas ref={miniRef} />
      </button>
    </div>
  )
}
