import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, type AnimalRig, type Mood, type Pose, makeAnimal } from '../../../shared/art3d/animals'
import { createStage, woodTexture } from '../../../shared/art3d/stage'
import { PERSON_SHIRTS } from '../../../shared/art/shapes'
import { TEAM_COLORS } from '../../../shared/team/teams'
import { TeamDot } from '../../../shared/ui/TeamResult'
import { neighborsOf } from '../play/engine'
import { type ScreenState, canThrowNow, myIndex } from '../play/view'

// 3D 탁자: 둥근 나무 탁자에 동물 캐릭터들이 둘러선다. 나는 항상 앞(카메라 쪽). 폭탄은 든 사람 손에, 던지면 포물선으로 날아가고
// 터지면 번쩍 + 연기 + 화면 흔들림. 옆 사람을 누르면 던진다(내가 들고 있을 때). 이름표는 3D 위치를 화면에 옮긴 HTML.

type Props = {
  screen: ScreenState
  onPick: (to: number) => void
}

/** 터지는 연출 시간 (ms) */
const BLAST_MS = 900

/** 자리 각도: 나(자리 0)를 앞(+z)에 두고 시계 방향 */
const seatAngle = (seat: number, count: number) => Math.PI / 2 + (seat / count) * Math.PI * 2

/** 불꽃·폭발용 둥근 빛 텍스처 */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,235,1)')
  r.addColorStop(0.25, 'rgba(255,200,80,0.9)')
  r.addColorStop(0.6, 'rgba(255,110,20,0.35)')
  r.addColorStop(1, 'rgba(255,60,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeBomb() {
  const group = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 24), new THREE.MeshStandardMaterial({ color: '#16191f', metalness: 0.55, roughness: 0.28 }))
  ball.castShadow = true
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.11, 18), new THREE.MeshStandardMaterial({ color: '#a7afb8', metalness: 0.9, roughness: 0.25 }))
  cap.position.y = 0.27
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 8), new THREE.MeshStandardMaterial({ color: '#b08b58', roughness: 0.9 }))
  fuse.position.set(0.05, 0.41, 0)
  fuse.rotation.z = -0.5
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  spark.position.set(0.12, 0.52, 0)
  spark.scale.setScalar(0.35)
  const light = new THREE.PointLight('#ffae3d', 2.5, 3)
  light.position.copy(spark.position)
  group.add(ball, cap, fuse, spark, light)
  group.scale.setScalar(1.3)
  return { group, spark, light }
}

function makeBlast() {
  const group = new THREE.Group()
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  const smokeMat = new THREE.MeshStandardMaterial({ color: '#555', roughness: 1, transparent: true, opacity: 0.8, depthWrite: false })
  const puffs = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), smokeMat)
    const a = (i / 10) * Math.PI * 2
    m.userData.dir = new THREE.Vector3(Math.cos(a), 0.6 + (i % 3) * 0.35, Math.sin(a))
    group.add(m)
    return m
  })
  const light = new THREE.PointLight('#ff9a3c', 0, 9)
  group.add(flash, light)
  group.visible = false
  return { group, flash, puffs, smokeMat, light }
}

export function Table3D({ screen, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef(screen)
  const pickRef = useRef(onPick)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    screenRef.current = screen
    pickRef.current = onPick
  })

  const v = screen.view
  const players = v?.players ?? []
  const playerKey = players.map((p) => p.id).join(',')
  const teamsKey = v?.teams?.join(',') ?? ''

  useEffect(() => {
    const host = hostRef.current
    const first = screenRef.current.view
    if (!host || !first) return
    const n = first.players.length
    const stage = createStage(host, { background: '#1f1914' })
    const { scene, camera } = stage

    // 바닥: 나무 마루 + 둥근 깔개
    const floorTex = woodTexture('#6b4a30', false)
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
    floorTex.repeat.set(4, 4)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const R = 2.55 + Math.max(0, n - 4) * 0.2
    const tableR = R - 0.95
    const rug = new THREE.Mesh(new THREE.CircleGeometry(R + 1.1, 64), new THREE.MeshStandardMaterial({ color: '#7d2f2a', roughness: 1 }))
    rug.rotation.x = -Math.PI / 2
    rug.position.y = 0.01
    rug.receiveShadow = true
    scene.add(rug)
    const rugEdge = new THREE.Mesh(new THREE.RingGeometry(R + 0.85, R + 0.98, 64), new THREE.MeshStandardMaterial({ color: '#e0b25a', roughness: 1 }))
    rugEdge.rotation.x = -Math.PI / 2
    rugEdge.position.y = 0.015
    scene.add(rugEdge)

    // 탁자
    const top = new THREE.Mesh(new THREE.CylinderGeometry(tableR, tableR, 0.14, 72), [
      new THREE.MeshStandardMaterial({ color: '#5b3216', roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: woodTexture('#a8642e'), roughness: 0.38 }),
      new THREE.MeshStandardMaterial({ color: '#3d200c', roughness: 0.7 }),
    ])
    top.position.y = 1.0
    top.castShadow = true
    top.receiveShadow = true
    scene.add(top)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.95, 24), new THREE.MeshStandardMaterial({ color: '#4a2a12', roughness: 0.55 }))
    leg.position.y = 0.48
    leg.castShadow = true
    scene.add(leg)
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.08, 32), new THREE.MeshStandardMaterial({ color: '#3d200c', roughness: 0.6 }))
    foot.position.y = 0.05
    scene.add(foot)

    // 캐릭터
    const me = first.players.findIndex((p) => p.id === screenRef.current.myId)
    const seatOf = (i: number) => (me < 0 ? i : (i - me + n) % n)
    const rigs: AnimalRig[] = first.players.map((_, i) => {
      const shirt = first.teams ? TEAM_COLORS[first.teams[i]] : PERSON_SHIRTS[i % PERSON_SHIRTS.length]
      const rig = makeAnimal(ANIMALS[i % ANIMALS.length], shirt)
      const a = seatAngle(seatOf(i), n)
      rig.root.position.set(Math.cos(a) * R, 0, Math.sin(a) * R)
      rig.root.lookAt(0, 0, 0)
      rig.root.userData.player = i
      rig.root.traverse((o) => (o.userData.player = i))
      scene.add(rig.root)
      return rig
    })
    // 던질 수 있는 사람 발밑 고리
    const rings = first.players.map((_, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.9 }))
      ring.rotation.x = Math.PI / 2
      ring.position.copy(rigs[i].root.position)
      ring.position.y = 0.06
      ring.visible = false
      scene.add(ring)
      return ring
    })

    const bomb = makeBomb()
    scene.add(bomb.group)
    const blast = makeBlast()
    scene.add(blast.group)

    // 카메라: 내 등 뒤 위에서
    const camBase = new THREE.Vector3(0, 8.2 + n * 0.35, R + 4.6 + n * 0.3)
    const look = new THREE.Vector3(0, 0.6, -0.5)
    stage.lamp.target.position.set(0, 1, 0)

    const handsWorld = (i: number) => rigs[i].root.localToWorld(rigs[i].handsAt.clone())
    const tableSpot = (i: number) => rigs[i].root.position.clone().multiplyScalar(0.55).setY(1.33)

    let boomStart = -1
    let lastPhase = ''
    let raf = 0
    function frame() {
      const s = screenRef.current
      const view = s.view
      if (view) {
        const t = s.now / 1000
        const meNow = myIndex(s)
        const canThrow = canThrowNow(s)
        const side = canThrow ? neighborsOf(view.alive, meNow) : null
        if (view.phase === 'boom' && lastPhase !== 'boom') boomStart = s.now
        lastPhase = view.phase
        const blastT = view.phase === 'boom' && view.victim !== null ? (s.now - boomStart) / BLAST_MS : -1
        const winners = view.phase === 'done' ? (view.teams && view.winner !== null ? view.players.map((_, i) => view.teams![i] === view.winner) : view.alive) : null

        rigs.forEach((rig, i) => {
          const out = !view.alive[i] && !(view.victim === i && blastT >= 0 && blastT < 0.15)
          rig.setOut(!view.alive[i] && !(view.victim === i && blastT >= 0 && blastT < 0.15))
          const holding = view.phase === 'play' && view.holder === i && !s.flight
          let pose: Pose = 'idle'
          let mood: Mood = 'calm'
          if (out) {
            pose = 'ko'
            mood = 'ko'
          } else if (winners?.[i]) {
            pose = 'cheer'
            mood = 'happy'
          } else if (holding) {
            pose = 'hold'
            mood = 'scared'
          } else if (s.flight && s.flight.to === i) {
            pose = 'scared'
            mood = 'scared'
          }
          rig.update(t + i, pose, mood)
          const target = side?.includes(i) ?? false
          rings[i].visible = target
          if (target) {
            const k = 1 + Math.sin(t * 8) * 0.06
            rings[i].scale.set(k, k, k)
          }
        })

        // 폭탄
        bomb.group.visible = false
        if (view.phase === 'play' || view.phase === 'countdown') {
          const f = s.flight
          if (f) {
            const k = Math.min(1, Math.max(0, (s.now - f.startAt) / (f.landAt - f.startAt)))
            const a = handsWorld(f.from)
            const b = handsWorld(f.to)
            bomb.group.position.lerpVectors(a, b, k)
            bomb.group.position.y += Math.sin(Math.PI * k) * 1.4
            bomb.group.rotation.z = -k * Math.PI * 2
            bomb.group.visible = true
          } else if (view.phase === 'play') {
            const p = rigs[view.holder] && !view.alive[view.holder] ? tableSpot(view.holder) : handsWorld(view.holder)
            bomb.group.position.lerp(p, 0.35)
            bomb.group.rotation.z = Math.sin(t * 18) * 0.06
            bomb.group.visible = true
          }
          // 시간이 갈수록 불꽃이 거세게
          const hot = Math.min(1, view.elapsedMs / 15000)
          const flick = 0.75 + Math.random() * 0.5
          bomb.spark.scale.setScalar((0.3 + hot * 0.25) * flick)
          bomb.light.intensity = (2 + hot * 3) * flick
        }

        // 폭발
        blast.group.visible = blastT >= 0 && blastT < 1
        let shake = 0
        if (blast.group.visible && view.victim !== null) {
          blast.group.position.copy(handsWorld(view.victim))
          const k = blastT
          blast.flash.scale.setScalar(0.5 + Math.min(1, k * 4) * 3.2)
          ;(blast.flash.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * 1.6)
          blast.light.intensity = Math.max(0, 40 * (1 - k * 2))
          blast.puffs.forEach((m) => {
            const d = m.userData.dir as THREE.Vector3
            m.position.copy(d).multiplyScalar(0.2 + k * 1.3)
            m.scale.setScalar(0.6 + k * 1.6)
          })
          blast.smokeMat.opacity = 0.75 * (1 - k)
          shake = (1 - k) * 0.18
        }
        camera.position.set(camBase.x + (Math.random() - 0.5) * shake, camBase.y + (Math.random() - 0.5) * shake, camBase.z)
        camera.lookAt(look)

        // 이름표: 발밑 (머리 위엔 든 폭탄이 있어서)
        rigs.forEach((rig, i) => {
          const el = labelRefs.current[i]
          if (!el) return
          const p = stage.toScreen(rig.root.localToWorld(new THREE.Vector3(0, 0, 0.55)))
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -30%)`
          el.classList.toggle('bm3-label--target', side?.includes(i) ?? false)
          el.classList.toggle('bm3-label--out', !view.alive[i])
        })
      }
      stage.render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // 누르기: 맞은 캐릭터가 던질 수 있는 옆 사람이면 던진다
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    function onDown(e: PointerEvent) {
      const s = screenRef.current
      if (!s.view || !canThrowNow(s)) return
      const side = neighborsOf(s.view.alive, myIndex(s))
      if (!side) return
      const r = stage.renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObjects([...rigs.map((x) => x.root), ...rings], true)
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object
        while (o && o.userData.player === undefined) o = o.parent
        const i = o?.userData.player
        if (typeof i === 'number' && i >= 0 && side.includes(i)) {
          e.preventDefault()
          pickRef.current(i)
          return
        }
      }
    }
    rings.forEach((ring, i) => (ring.userData.player = i))
    stage.renderer.domElement.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      stage.renderer.domElement.removeEventListener('pointerdown', onDown)
      rigs.forEach((r) => r.dispose())
      stage.dispose()
    }
    // 사람·팀이 바뀔 때만 장면을 새로 만든다 (나머지는 매 프레임 screenRef로)
  }, [playerKey, teamsKey])

  if (!v) return <div className="bm-table bm-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  return (
    <div className={`bm3${v.phase === 'boom' ? ' bm3--boom' : ''}`} ref={hostRef}>
      {players.map((p, i) => (
        <span
          key={p.id}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className={`bm3-label${i === me ? ' bm3-label--me' : ''}`}
        >
          {v.teams && <TeamDot team={v.teams[i]} />}
          {p.name}
          {i === me && ' (나)'}
        </span>
      ))}
    </div>
  )
}
