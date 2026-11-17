import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createStage, nearestOnScreen } from '../../../shared/art3d/stage'
import { type AnimalRig, ANIMALS, makeAnimal, plainLook } from '../../../shared/art3d/animals'
import { decodeLook } from '../../../shared/art3d/animalKinds'
import { BEDS, PIER, POND, SEA_EAST, STREAM, shoreZ } from '../play/map'
import { fishSvg } from '../field/fishArt'
import type { World } from './useFishingRoom'

// 3D 낚시터 (사용자 요청 2026-11-17). 위가 바다(부두), 오른쪽 풀밭에 개울·연못, 물가를 따라 썬베드.
// 카메라는 나를 부드럽게 따라가기만 하고 흔들거나 돌지 않음 (사용자가 3D 멀미가 심함 — 저절로 움직이는 화면 없음).
// 이름표·말풍선·입질 !·잡은 물고기는 3D 위치를 화면에 옮긴 HTML.

const SKY = '#a7dcff'
const SHIRTS = ['#5b8cff', '#ff8ab0', '#7cc8ff', '#9be08a', '#ffd23f', '#c79bff', '#ff9a5a', '#5be0f0']
/** 캐릭터 크기 (모델 키 약 2.9 → 1.6m쯤) */
const SCALE = 0.62
/** 카메라: 내 위(뒤쪽 위)에서 비스듬히 */
const CAM = new THREE.Vector3(0, 8.2, 7.6)

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
}

function mat(color: string, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough })
}

/** 맵 (땅·물·부두·썬베드·나무) */
function buildWorld(scene: THREE.Scene) {
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
  }
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
    buildWorld(scene)

    const actors = new Map<string, Actor>()
    const lineMat = new THREE.LineBasicMaterial({ color: '#1f1a4d' })
    const bobGeo = new THREE.SphereGeometry(0.12, 12, 10)
    const bobMat = mat('#e8473f', 0.4)
    const ringGeo = new THREE.RingGeometry(0.25, 0.32, 24)
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide })

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
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat)
      line.frustumCulled = false
      line.visible = false
      const bob = new THREE.Mesh(bobGeo, bobMat)
      bob.visible = false
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.visible = false
      scene.add(line, bob, ring)
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
      tag.append(pop, bang, bubble, name)
      layer!.appendChild(tag)
      return { id, rig, rod, tip, line, bob, ring, tag, bubble, bang, pop, popKey: '', avatar }
    }

    function removeActor(a: Actor) {
      scene.remove(a.rig.root, a.line, a.bob, a.ring)
      a.rig.dispose()
      a.line.geometry.dispose()
      a.tag.remove()
    }

    const camTarget = new THREE.Vector3()
    const lookAt = new THREE.Vector3()
    let camReady = false
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
        const pose = walking ? 'walk' : p.fishing !== 'none' ? 'fish' : 'idle'
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
        // 낚싯대·줄·찌
        const fishing = p.fishing !== 'none' && p.bob
        a.rod.visible = !!fishing
        a.line.visible = a.bob.visible = !!fishing
        a.ring.visible = p.fishing === 'bite'
        if (fishing && p.bob) {
          const biting = p.fishing === 'bite'
          const y = biting ? -0.06 + Math.sin(t * 24) * 0.06 : 0.02 + Math.sin(t * 2 + hash(p.id)) * 0.03
          a.bob.position.set(p.bob[0], y, p.bob[1])
          a.tip.getWorldPosition(tipW)
          const pos = a.line.geometry.getAttribute('position') as THREE.BufferAttribute
          pos.setXYZ(0, tipW.x, tipW.y, tipW.z)
          pos.setXYZ(1, p.bob[0], y + 0.1, p.bob[1])
          pos.needsUpdate = true
          if (biting) {
            const k = (t * 1.6) % 1
            a.ring.position.set(p.bob[0], 0.02, p.bob[1])
            a.ring.scale.setScalar(1 + k * 3)
            ;(a.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k)
          }
        }
      }

      // 카메라: 나를 부드럽게 따라감 (돌거나 흔들지 않음)
      const me = world.players.get(world.me)
      if (me) {
        camTarget.set(me.sx, 0, me.sz)
        const want = v.copy(camTarget).add(CAM)
        if (!camReady) {
          camera.position.copy(want)
          lookAt.set(me.sx, 0.7, me.sz - 1.2)
          camReady = true
        } else {
          camera.position.lerp(want, Math.min(1, dt * 4))
          lookAt.lerp(v.set(me.sx, 0.7, me.sz - 1.2), Math.min(1, dt * 4))
        }
        camera.lookAt(lookAt)
        lamp.position.set(me.sx + 2, 14, me.sz + 4)
        lamp.target.position.set(me.sx, 0, me.sz - 2)
      }
      stage.render()

      // 이름표·말풍선·!·잡은 물고기
      for (const a of actors.values()) {
        const p = world.players.get(a.id)
        if (!p) continue
        a.rig.head.getWorldPosition(v)
        v.y += 0.55
        const s = stage.toScreen(v)
        a.tag.style.transform = `translate(${s.x}px, ${s.y}px)`
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
          a.pop.innerHTML = popOn ? fishSvg(p.popup!.c.fish, p.popup!.c.iro) : ''
          a.pop.classList.toggle('fs-pop--on', popOn)
        }
      }
    }
    frame()

    // 다른 사람을 누르면 그 사람 어항
    const onDown = (e: PointerEvent) => {
      const list = [...actors.values()].filter((a) => a.id !== world.me)
      const i = nearestOnScreen(stage, e.clientX, e.clientY, list.map((a) => a.rig.head.getWorldPosition(new THREE.Vector3())))
      if (i !== null && list[i]) tapRef.current(list[i].id)
    }
    host.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener('pointerdown', onDown)
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
