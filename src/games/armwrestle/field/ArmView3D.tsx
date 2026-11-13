import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { createStage, woodTexture } from '../../../shared/art3d/stage'

// 3D 팔씨름 (사용자 요청 — 처음엔 2D 만화풍, field/ArmView.tsx는 WebGL이 안 될 때 그대로 씀).
// 나무 벽·마루 방, 매달린 전등 아래 나무 탁자에서 두 동물이 **서서** 팔꿈치를 대고 손을 맞잡는다. 왼쪽 나(파랑), 오른쪽 상대(빨강).
// 겨루는 팔은 캐릭터의 팔을 숨기고 어깨 → 탁자 위 팔꿈치 → 맞잡은 손으로 따로 이어 그린다 (캐릭터 팔은 짧아서 탁자 가운데까지 못 닿음).
// 이기는 쪽이 손을 자기 쪽으로 끌어당긴다 (2D와 같음). 판이 끝나면 손이 닿은 자리에서 쾅.

type Props = {
  /** −1(상대 승) ~ +1(내 승) */
  pos: number
  straining: boolean
  names: readonly [string, string]
  winner: 0 | 1 | null
  looks: readonly [Look, Look]
}

const COLORS = ['#2563eb', '#dc2626'] as const
const TABLE_Y = 1.0
/** 팔꿈치에서 맞잡은 손까지 */
const FOREARM = 0.44
const MAX_TILT = (72 * Math.PI) / 180
/** 선수 서는 자리 (가운데에서) */
const STAND_X = 1.12
/** 카메라 쪽으로 조금 돌림 (옆을 똑바로 보면 납작해 보임) */
const TURN = 0.38

function starGeometry(points: number, inner: number): THREE.ShapeGeometry {
  const s = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ShapeGeometry(s)
}

const glowMat = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })

const UP = new THREE.Vector3(0, 1, 0)
/** 원기둥(높이 1)을 a→b로 눕혀 늘인다 */
function span(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a)
  const len = Math.max(0.001, d.length())
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.scale.set(1, len, 1)
  m.quaternion.setFromUnitVectors(UP, d.divideScalar(len))
}

function buildRoom(scene: THREE.Scene) {
  const floorTex = woodTexture('#6b4a30', false)
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(3, 3)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  const wallTex = woodTexture('#8a3a16', false)
  wallTex.rotation = Math.PI / 2
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(4, 2)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }))
  wall.position.set(0, 4, -2.4)
  wall.receiveShadow = true
  scene.add(floor, wall)

  // 탁자: 나무 윗면 + 다리 넷 + 손이 닿으면 끝나는 자리(내 쪽 파랑 = 이김, 상대 쪽 빨강 = 짐)
  const topTex = woodTexture('#9a5b2a', false)
  const wood = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.55 })
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.9), wood)
  top.position.y = TABLE_Y - 0.05
  top.castShadow = top.receiveShadow = true
  scene.add(top)
  const legM = new THREE.MeshStandardMaterial({ color: '#5b3416', roughness: 0.7 })
  for (const x of [-0.65, 0.65])
    for (const z of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, TABLE_Y - 0.1, 0.09), legM)
      leg.position.set(x, (TABLE_Y - 0.1) / 2, z)
      leg.castShadow = true
      scene.add(leg)
    }
  for (const [x, c] of [
    [-FOREARM * Math.sin(MAX_TILT), '#3b82f6'],
    [FOREARM * Math.sin(MAX_TILT), '#ef4444'],
  ] as const) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.25 }))
    pad.position.set(x, TABLE_Y + 0.015, 0)
    scene.add(pad)
  }
  // 팔꿈치 받침
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9 }))
  cushion.position.set(0, TABLE_Y + 0.015, 0)
  scene.add(cushion)

  // 매달린 전등
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6), new THREE.MeshStandardMaterial({ color: '#111' }))
  cord.position.set(0, 4.0, 0)
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.35, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1f513a', roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
  )
  shade.position.set(0, 3.1, 0)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff7d6' }))
  bulb.position.set(0, 2.98, 0)
  scene.add(cord, shade, bulb)
}

export function ArmView3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const nameRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const veinRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const lookKey = JSON.stringify(props.looks)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = createStage(host, { background: '#3b1608', fov: 38 })
    const { scene, camera, lamp } = stage
    scene.fog = new THREE.Fog('#3b1608', 9, 20)
    lamp.position.set(0, 2.95, 0)
    lamp.target.position.set(0, 0, 0)
    lamp.angle = Math.PI / 3
    lamp.intensity = 70
    lamp.distance = 12
    buildRoom(scene)

    const { looks } = propsRef.current
    const players = ([0, 1] as const).map((side) => {
      const dir = side === 0 ? 1 : -1
      const rig: AnimalRig = makeAnimal(looks[side], COLORS[side], { team: true })
      rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true
      })
      // 겨루는 팔 = 오른팔: 나는 카메라 쪽, 상대는 안쪽 어깨에서 탁자 가운데로 비스듬히 뻗는다
      rig.root.position.set(-STAND_X * dir, 0, 0)
      rig.root.rotation.y = dir * (Math.PI / 2 - TURN)
      scene.add(rig.root)
      // 캐릭터 기준 오른팔 = armL (-x 쪽). 숨기고 재료(소매·털)만 빌려 쓴다
      const hidden = rig.armL
      let sleeveM: THREE.Material | null = null
      let furM: THREE.Material | null = null
      hidden.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        if (o.geometry instanceof THREE.CapsuleGeometry) sleeveM = o.material as THREE.Material
        else if (o.geometry instanceof THREE.SphereGeometry && !furM) furM = o.material as THREE.Material
      })
      hidden.visible = false
      const fur = furM ?? new THREE.MeshStandardMaterial({ color: '#c08a5b' })
      const sleeve = sleeveM ?? fur
      const cyl = (r: number, m: THREE.Material) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1, 14), m)
        c.castShadow = true
        scene.add(c)
        return c
      }
      const ball = (r: number, m: THREE.Material) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m)
        b.castShadow = true
        scene.add(b)
        return b
      }
      const arm = {
        sleeve: cyl(0.14, sleeve),
        upper: cyl(0.12, fur),
        fore: cyl(0.11, fur),
        shoulder: ball(0.14, sleeve),
        elbow: ball(0.12, fur),
        fist: ball(0.15, fur),
      }
      return { side, dir, rig, hidden, arm, lean: 0 }
    })

    // 힘겨루기 불꽃 · 판 끝 쾅
    const sparks = Array.from({ length: 5 }, () => {
      const m = new THREE.Mesh(starGeometry(4, 0.3), glowMat('#fde68a', 1))
      scene.add(m)
      return m
    })
    const slam = new THREE.Group()
    const slamOuter = new THREE.Mesh(starGeometry(10, 0.5), glowMat('#fde047', 1))
    const slamCore = new THREE.Mesh(starGeometry(8, 0.5), glowMat('#ffffff', 1))
    slamCore.position.z = 0.01
    slamCore.scale.setScalar(0.45)
    slam.add(slamOuter, slamCore)
    scene.add(slam)

    camera.position.set(0, 3.2, 4.9)
    camera.lookAt(0, 1.15, 0)

    const ease = (cur: number, to: number, k = 0.2) => cur + (to - cur) * k
    const tmp = new THREE.Vector3()
    const shoulder = new THREE.Vector3()
    let shownTilt = 0
    let slamAt = 0
    let lastWinner: 0 | 1 | null = null
    let raf = 0
    function frame() {
      const { pos, straining, winner } = propsRef.current
      const t = performance.now() / 1000
      if (winner !== lastWinner) {
        lastWinner = winner
        slamAt = winner === null ? 0 : t
        // 쾅: 이긴 쪽 패드에서 먼지·불꽃 + 카메라 당김
        if (winner !== null) {
          const at = new THREE.Vector3((winner === 0 ? -1 : 1) * FOREARM * Math.sin(MAX_TILT), TABLE_Y + 0.12, 0.3)
          stage.kick(0.9)
          stage.burst(at, { color: '#ffd23f', count: 30, speed: 3.8 })
          stage.burst(at, { color: '#c9a27a', count: 20, speed: 2, size: 0.22, gravity: 2, life: 0.9 })
        }
      }
      // 끝나면 이긴 쪽 패드에 쾅 (조금 더 넘어가 닿음)
      const target = winner === null ? pos * MAX_TILT : (winner === 0 ? 1 : -1) * MAX_TILT * 1.12
      shownTilt = ease(shownTilt, target, winner === null ? 0.35 : 0.5)
      const shakeAmp = straining && winner === null ? 0.012 : 0
      const clasp = new THREE.Vector3(-Math.sin(shownTilt) * FOREARM + Math.sin(t * 40) * shakeAmp, TABLE_Y + 0.08 + Math.cos(shownTilt) * FOREARM, 0)

      for (const pl of players) {
        const { rig, side, dir, arm } = pl
        const won = winner === side
        const lost = winner !== null && winner !== side
        rig.update(t + side, won ? 'raise' : 'idle', won ? 'happy' : lost ? 'ko' : straining ? 'scared' : 'calm')
        // 몸: 탁자 쪽으로 숙이고, 이기는 쪽은 뒤로 당기며 젖힘. 힘줄 땐 바르르
        const winning = (side === 0 ? 1 : -1) * Math.sin(shownTilt)
        pl.lean = ease(pl.lean, 0.2 - winning * 0.12 - (lost ? 0.08 : 0))
        rig.body.rotation.x = pl.lean
        rig.body.rotation.z = straining && winner === null ? Math.sin(t * 38 + side * 2) * 0.015 : 0
        // 한 손 번쩍(raise)은 armR이 위로 — 이기면 안 쓰는 손으로 만세
        // 겨루는 팔: 어깨(숨긴 팔 자리) → 팔꿈치(탁자 위 가운데 조금 내 쪽) → 맞잡은 손
        rig.root.updateMatrixWorld(true)
        pl.hidden.getWorldPosition(shoulder)
        const elbow = tmp.set(-0.1 * dir, TABLE_Y + 0.08, 0).clone()
        const fistAt = clasp.clone().add(new THREE.Vector3(-0.05 * dir, 0, 0))
        const sleeveEnd = shoulder.clone().lerp(elbow, 0.32)
        span(arm.sleeve, shoulder, sleeveEnd)
        span(arm.upper, sleeveEnd, elbow)
        span(arm.fore, elbow, fistAt)
        arm.shoulder.position.copy(shoulder)
        arm.elbow.position.copy(elbow)
        arm.fist.position.copy(fistAt)
      }

      sparks.forEach((m, k) => {
        m.visible = straining && winner === null
        if (!m.visible) return
        const a = t * 11 + k * 1.3
        const r = 0.24 + Math.sin(t * 25 + k) * 0.04
        m.position.set(clasp.x + Math.cos(a) * r, clasp.y + Math.sin(a) * r, 0.25)
        m.quaternion.copy(camera.quaternion)
        m.scale.setScalar(0.05 + 0.03 * Math.abs(Math.sin(t * 20 + k)))
      })
      const sa = t - slamAt
      slam.visible = winner !== null && sa < 0.6
      if (slam.visible) {
        slam.position.set((winner === 0 ? -1 : 1) * FOREARM * Math.sin(MAX_TILT), TABLE_Y + 0.12, 0.3)
        slam.quaternion.copy(camera.quaternion)
        slam.scale.setScalar(0.18 + sa * 0.5)
        for (const c of slam.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - sa / 0.6
      }

      stage.render()

      players.forEach((pl, i) => {
        const foot = stage.toScreen(tmp.set(-STAND_X * pl.dir, 0, 0.55))
        const nm = nameRefs[i].current
        if (nm) nm.style.transform = `translate(${foot.x}px, ${Math.min(foot.y, stage.size().h - 18)}px) translate(-50%, 0)`
        const head = stage.toScreen(pl.rig.head.getWorldPosition(tmp).add(new THREE.Vector3(-0.45 * pl.dir, 0.45, 0)))
        const vein = veinRefs[i].current
        if (vein) {
          vein.style.transform = `translate(${head.x}px, ${head.y}px) translate(-50%, -50%) scale(${1 + Math.sin(t * 12 + i) * 0.12})`
          vein.style.opacity = straining && winner === null ? '1' : '0'
        }
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      players.forEach((p) => p.rig.dispose())
      stage.dispose()
    }
  }, [lookKey])

  return (
    <div className="aw-view aw-view3d" role="img" aria-label="팔씨름하는 두 선수">
      <div className="aw-view3d__stage" ref={hostRef} />
      {props.names.map((n, i) => (
        <div key={i}>
          <div className="aw-view3d__name" ref={nameRefs[i]}>
            {n}
          </div>
          <div className="aw-view3d__vein" ref={veinRefs[i]}>
            💢
          </div>
        </div>
      ))}
    </div>
  )
}
