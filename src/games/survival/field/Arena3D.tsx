import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, type AnimalRig, makeAnimal, plainLook } from '../../../shared/art3d/animals'
import { createStage } from '../../../shared/art3d/stage'
import { TEAM_COLORS } from '../../../shared/team/teams'
import { COUNTDOWN_MS, PLAYER_COLORS, SHOT_AT } from '../constants'
import { hitAtOf, laserMs } from '../play/engine'
import { type ScreenState, myIndex } from '../play/view'
import { type Vec, type Wall, shoot } from '../rules/geometry'

// 3D 서바이벌 맵: 비스듬히 내려다본 둥근 모래밭에 모래주머니 벽, 동물 캐릭터가 총을 들고 선다.
// 맵 좌표 (x, y) → 3D (x·S, 0, y·S). 고르는 동안엔 내 캐릭터·조준선만, 공개 때 모두 나타나 레이저가 뻗어 간다.
// 누르기는 바닥 평면에 광선을 쏴서 맵 좌표로 바꿔 넘긴다 (2D Arena와 같은 onPointer).

type Props = {
  screen: ScreenState
  onPointer?: (kind: 'down' | 'move' | 'up', at: Vec) => void
}

/** 맵 1칸 → 3D 길이 */
const S = 0.1
/** 캐릭터 크기 (맞는 반경 4칸 ≈ 몸통 폭) */
const RIG_SCALE = 0.72
/** 총구 높이 (3D) */
const GUN_Y = 1.32 * RIG_SCALE

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))

function sandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#e3c58f'
  g.fillRect(0, 0, 256, 256)
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 2600; i++) {
    const v = rnd()
    g.fillStyle = v < 0.5 ? `rgba(150,110,60,${0.12 + rnd() * 0.15})` : `rgba(255,240,210,${0.1 + rnd() * 0.2})`
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 6)
  return t
}

function hatchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#c45a4a'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = '#8f2f25'
  g.lineWidth = 10
  for (let k = -64; k < 128; k += 24) {
    g.beginPath()
    g.moveTo(k, 0)
    g.lineTo(k + 64, 64)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 10)
  return t
}

/** 모래주머니 무늬 (벽 옆면) */
function sandbagTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#8a7350'
  g.fillRect(0, 0, 256, 64)
  for (let row = 0; row < 3; row++) {
    for (let k = -1; k < 6; k++) {
      const x = k * 48 + (row % 2) * 24
      const y = row * 21 + 1
      g.fillStyle = row % 2 ? '#c2a776' : '#b89c6a'
      g.beginPath()
      g.roundRect(x + 2, y, 44, 19, 8)
      g.fill()
      g.strokeStyle = 'rgba(70,50,25,0.5)'
      g.lineWidth = 2
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

function makeGun(): THREE.Group {
  const g = new THREE.Group()
  const dark = new THREE.MeshStandardMaterial({ color: '#2b3036', metalness: 0.6, roughness: 0.35 })
  const glow = new THREE.MeshStandardMaterial({ color: '#7df9ff', emissive: '#22d3ee', emissiveIntensity: 1.5 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.5), dark)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.38, 12), dark)
  barrel.rotation.x = Math.PI / 2
  barrel.position.z = 0.4
  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 14), glow)
  tip.position.z = 0.6
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.3), glow)
  strip.position.set(0, 0.06, 0)
  for (const m of [body, barrel]) m.castShadow = true
  g.add(body, barrel, tip, strip)
  return g
}

/** 맵 좌표 → 3D 바닥 위치 */
const at3 = (p: Vec, y = 0) => new THREE.Vector3(p.x * S, y, p.y * S)
/** 맵 각도(오른쪽 0, 아래 +) → 캐릭터 rotation.y (얼굴 +z가 그쪽을 보게) */
const faceY = (angle: number) => Math.atan2(Math.cos(angle), Math.sin(angle))

type Piece = { rig: AnimalRig; gun: THREE.Group; color: string; mark: THREE.Group }

export function Arena3D({ screen, onPointer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef(screen)
  const pointerRef = useRef(onPointer)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    screenRef.current = screen
    pointerRef.current = onPointer
  })

  const v = screen.view
  const players = v?.players ?? []
  const playerKey = players.map((p) => p.id).join(',')
  const teamsKey = v?.teams?.join(',') ?? ''

  useEffect(() => {
    const host = hostRef.current
    const first = screenRef.current.view
    if (!host || !first) return
    const FULL = first.startHalf
    const stage = createStage(host, { background: '#2a2a33', fov: 38, sway: 0 }) // 정확히 눌러야 해서 손카메라 흔들림 없음
    const { scene, camera } = stage
    scene.fog = null
    stage.lamp.position.set(FULL * S * 0.4, FULL * S * 2.6, FULL * S * 0.8)
    stage.lamp.distance = FULL * S * 6
    stage.lamp.angle = Math.PI / 3.2
    stage.lamp.target.position.set(0, 0, 0)

    // 바닥: 바깥(줄어든 곳)은 빨간 빗금, 안쪽은 모래
    const outside = new THREE.Mesh(new THREE.CircleGeometry(FULL * S, 72), new THREE.MeshStandardMaterial({ map: hatchTexture(), roughness: 0.95 }))
    outside.rotation.x = -Math.PI / 2
    outside.receiveShadow = true
    scene.add(outside)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 0.95 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.005
    floor.receiveShadow = true
    scene.add(floor)
    const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshStandardMaterial({ color: '#5c3d1e', roughness: 0.7 }))
    edge.rotation.x = Math.PI / 2
    edge.position.y = 0.02
    scene.add(edge)
    // 맵 밖 둘레: 낮은 바위 띠
    const rim = new THREE.Mesh(new THREE.TorusGeometry(FULL * S + 0.15, 0.2, 10, 72), new THREE.MeshStandardMaterial({ color: '#6b6258', roughness: 0.9 }))
    rim.rotation.x = Math.PI / 2
    rim.castShadow = true
    scene.add(rim)

    // 엄폐물
    const bagTex = sandbagTexture()
    const wallGroup = new THREE.Group()
    scene.add(wallGroup)
    let wallKey = ''
    function buildWalls(walls: Wall[]) {
      const key = walls.map((w) => `${w.x},${w.y},${w.w},${w.angle}`).join('|')
      if (key === wallKey) return
      wallKey = key
      for (const c of [...wallGroup.children]) {
        wallGroup.remove(c)
        ;(c as THREE.Mesh).geometry.dispose()
      }
      for (const w of walls) {
        const tex = bagTex.clone()
        tex.repeat.set(Math.max(1, (w.w * S) / 0.9), 1)
        tex.needsUpdate = true
        const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
        const top = new THREE.MeshStandardMaterial({ color: '#c2a776', roughness: 0.95 })
        const m = new THREE.Mesh(new THREE.BoxGeometry(w.w * S, 0.55, w.h * S), [side, side, top, top, side, side])
        m.position.set(w.x * S, 0.275, w.y * S)
        m.rotation.y = -w.angle
        m.castShadow = true
        m.receiveShadow = true
        wallGroup.add(m)
      }
    }

    // 캐릭터
    const colorOf = (i: number) => (first.teams ? TEAM_COLORS[first.teams[i]] : PLAYER_COLORS[i % PLAYER_COLORS.length])
    const pieces: Piece[] = first.players.map((p, i) => {
      const rig = makeAnimal(p.avatar ?? plainLook(ANIMALS[i % ANIMALS.length]), colorOf(i), { team: !!first.teams })
      rig.root.scale.setScalar(RIG_SCALE)
      // 총은 오른손에 쥠 (armL = 캐릭터 기준 오른팔). 팔이 내려가 있으면 총구가 아래, 겨누면 팔과 같이 앞으로
      const gun = makeGun()
      gun.rotation.x = Math.PI / 2
      gun.position.set(0, -0.62, 0.06)
      gun.scale.setScalar(0.85)
      rig.armL.add(gun)
      rig.root.visible = false
      scene.add(rig.root)
      // 맞으면 발밑에 빨간 ✕
      const mark = new THREE.Group()
      const red = new THREE.MeshBasicMaterial({ color: '#dc2626' })
      for (const r of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.14), red)
        bar.rotation.y = (r * Math.PI) / 4
        mark.add(bar)
      }
      mark.position.y = 0.03
      mark.visible = false
      scene.add(mark)
      return { rig, gun, color: colorOf(i), mark }
    })

    // 조준선 (고르는 동안 내 것) · 레이저 (공개 때 모두)
    const beam = (color: string, r: number, opacity: number) =>
      new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
    const aimLine = beam('#ffffff', 0.02, 0.8)
    scene.add(aimLine)
    const lasers = first.players.map((_, i) => {
      const g = new THREE.Group()
      const core = beam('#ffffff', 0.025, 0.95)
      const halo = beam(colorOf(i), 0.08, 0.55)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: colorOf(i) }))
      g.add(core, halo, tip)
      g.visible = false
      scene.add(g)
      return { g, core, halo, tip }
    })
    /** a→b 사이에 원기둥을 눕혀 놓는다 */
    const stretch = (m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a)
      const len = Math.max(0.001, d.length())
      m.position.copy(a).add(b).multiplyScalar(0.5)
      m.scale.set(1, len, 1)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(len))
    }

    // 카메라: 비스듬히 위에서 맵 전체가 들어오게
    camera.position.set(0, FULL * S * 3.0, FULL * S * 1.5)
    camera.lookAt(0, 0, FULL * S * 0.1)

    let raf = 0
    const tmp = new THREE.Vector3()
    let burstRound: unknown = null
    const burstDone = new Set<number>()
    function frame() {
      const s = screenRef.current
      const view = s.view
      if (view) {
        const t = s.now - s.phaseStart
        const sec = s.now / 1000
        const me = myIndex(s)
        const half = view.phase === 'countdown' ? lerp(view.prevHalf, view.half, t / (COUNTDOWN_MS * 0.6)) : view.half
        floor.scale.set(half * S, half * S, 1)
        edge.scale.set(half * S, half * S, 1)
        const wallsOn = view.phase !== 'countdown' || half <= view.half + 0.01
        wallGroup.visible = wallsOn
        buildWalls(view.walls)

        const r = view.reveal
        const showing = !!r && (view.phase === 'reveal' || view.phase === 'done')
        const draft = s.draft
        const planning = view.phase === 'plan' && me >= 0 && view.alive[me]
        const shotT = (ms: number) => (view.phase === 'done' ? 1 : (t - SHOT_AT) / ms)
        const winners = view.phase === 'done' ? (view.teams && view.winTeam !== null ? view.players.map((_, i) => view.teams![i] === view.winTeam) : view.ranks.map((x) => x === 1)) : null

        pieces.forEach(({ rig, gun, mark }, i) => {
          let pos: Vec | null = null
          let angle: number | null = null
          let dead = false
          if (showing && r) {
            pos = r.positions[i]
            const sh = r.shots.find((x) => x.from === i)
            angle = sh ? Math.atan2(sh.end.y - sh.pos.y, sh.end.x - sh.pos.x) : null
            const hitAt = hitAtOf(r, i)
            dead = hitAt !== null && (view.phase === 'done' || t >= hitAt)
          } else if (planning && i === me && draft.pos) {
            pos = draft.pos
            angle = draft.angle
          }
          rig.root.visible = !!pos
          mark.visible = !!pos && dead
          // 레이저에 맞는 순간 한 번: 빨간 불똥 + 카메라 살짝 당김
          if (r !== burstRound) {
            burstRound = r
            burstDone.clear()
          }
          if (dead && pos && view.phase !== 'done' && !burstDone.has(i)) {
            burstDone.add(i)
            stage.kick(0.5)
            stage.burst(at3(pos).add(new THREE.Vector3(0, 0.25, 0)), { color: '#ff5a4a', count: 26, speed: 2.6, size: 0.12 })
          }
          if (!pos) return
          mark.position.set(pos.x * S, 0.03, pos.y * S)
          rig.root.position.copy(at3(pos))
          if (angle !== null) rig.root.rotation.y = faceY(angle)
          rig.setOut(dead)
          gun.visible = !dead
          const win = winners?.[i] && !dead
          // 맞으면 그 자리에 주저앉음 (옆으로 쓰러지면 위에서 볼 때 길게 누워 옆 사람을 덮어서)
          rig.update(sec + i, dead ? 'scared' : win ? 'cheer' : angle !== null ? 'aim' : 'idle', dead ? 'ko' : win ? 'happy' : 'calm')
          rig.root.scale.set(RIG_SCALE, RIG_SCALE * (dead ? 0.8 : 1), RIG_SCALE)
          // 확정 전 내 캐릭터는 살짝 투명하게 보이는 대신 위아래로 통통
          if (planning && i === me && !draft.locked) rig.root.position.y = Math.abs(Math.sin(sec * 5)) * 0.06
        })

        // 내 조준선
        aimLine.visible = planning && !!draft.pos && draft.angle !== null
        if (aimLine.visible && draft.pos && draft.angle !== null) {
          const end = shoot(draft.pos, draft.angle, [], half, view.walls).end
          ;(aimLine.material as THREE.MeshBasicMaterial).color.set(me >= 0 ? pieces[me].color : '#fff')
          stretch(aimLine, at3(draft.pos, GUN_Y), at3(end, GUN_Y))
        }

        // 레이저
        lasers.forEach((l, i) => {
          const sh = showing && r ? r.shots.find((x) => x.from === i) : undefined
          const p = sh ? shotT(laserMs(sh)) : 0
          l.g.visible = !!sh && p > 0
          if (!sh || p <= 0) return
          const a = at3(sh.pos, GUN_Y)
          const b = at3({ x: lerp(sh.pos.x, sh.end.x, p), y: lerp(sh.pos.y, sh.end.y, p) }, GUN_Y)
          stretch(l.core, a, b)
          stretch(l.halo, a, b)
          l.tip.position.copy(b)
          l.tip.visible = p < 1
        })

        // 이름표: 머리 위
        pieces.forEach(({ rig }, i) => {
          const el = labelRefs.current[i]
          if (!el) return
          el.style.display = rig.root.visible ? '' : 'none'
          if (!rig.root.visible) return
          const p = stage.toScreen(rig.head.getWorldPosition(tmp).add(new THREE.Vector3(0, 0.55, 0)))
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
        })
      }
      stage.render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // 누르기: 바닥 평면에 광선 → 맵 좌표
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const toMap = (e: PointerEvent): Vec | null => {
      const rc = stage.renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(ground, hit) ? { x: hit.x / S, y: hit.z / S } : null
    }
    const el = stage.renderer.domElement
    let dragging = false
    const down = (e: PointerEvent) => {
      const p = toMap(e)
      if (!p || !pointerRef.current) return
      e.preventDefault()
      el.setPointerCapture?.(e.pointerId)
      dragging = true
      pointerRef.current('down', p)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const p = toMap(e)
      if (p) pointerRef.current?.('move', p)
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      const p = toMap(e)
      if (p) pointerRef.current?.('up', p)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      pieces.forEach((p) => p.rig.dispose())
      bagTex.dispose()
      stage.dispose()
    }
  }, [playerKey, teamsKey])

  if (!v) return <div className="sv-arena sv-arena--empty">시작하는 중…</div>
  const me = myIndex(screen)
  return (
    <div className="sv3" ref={hostRef}>
      {players.map((p, i) => (
        <span
          key={p.id}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className={`sv3-label${i === me ? ' sv3-label--me' : ''}`}
          style={{ display: 'none' }}
        >
          {i === me ? '나' : p.name}
        </span>
      ))}
    </div>
  )
}
