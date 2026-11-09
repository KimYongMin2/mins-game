import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { makeAnimal } from '../../../shared/art3d/animals'
import { FENCE_DISTANCE, MOUND_HEIGHT, PITCHER_DISTANCE, PLAYER_HEIGHT } from '../constants'
import { type Point, STRIKE_ZONE } from '../play/pitch'
import type { Impact } from './impact'

// 3D 야구장 (three.js). 2D Field와 같은 정보(공 위치·스윙·투구 동작·맞은 순간)를 받아 그린다. 판정은 바뀌지 않는다.
// 좌표: 2D의 (x = 홈에서 투수 쪽 거리, y = 높이) → 3D (옆, 높이, -x). 타구는 spray 각도만큼 옆으로 돌려 외야로.
// 카메라: broadcast(투수 뒤 높은 곳 망원, 내가 투수일 때) · catcher(타자 뒤) · side(옆) — 내가 타자일 때 고름.
// 공을 치면(following) 홈 뒤 높은 카메라로 바뀌어 타구를 따라간다.

export type FieldView = 'broadcast' | 'catcher' | 'side'

type Props = {
  view: FieldView
  ball?: Point | null
  trail?: Point[]
  /** 타구를 따라가는 중 (공을 친 뒤) */
  following?: boolean
  /** 타구 방향 (라디안, 0 = 가운데, - = 3루 쪽) */
  spray?: number
  swing?: number | null
  throwT?: number | null
  mark?: Point | null
  impact?: Impact | null
  celebrate?: boolean
  looks: { batter: Look; pitcher: Look; catcher: Look }
  now?: number
}

/** 동물(키 약 2.6) → 야구 선수 키(PLAYER_HEIGHT 3, 스트라이크 존 기준)에 맞춤 */
const RIG_SCALE = PLAYER_HEIGHT / 2.6
const BATTER_POS = new THREE.Vector3(-1.05, 0, 0.15)
const CATCHER_POS = new THREE.Vector3(0, 0, 1.5)

const toPitch = (p: Point) => new THREE.Vector3(0, p.y, -p.x)
const toBatted = (p: Point, spray: number) => new THREE.Vector3(Math.sin(spray) * p.x, p.y, -Math.cos(spray) * p.x)

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  return t
}

const glowTex = () =>
  canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,255,240,1)')
    r.addColorStop(0.3, 'rgba(255,215,90,0.85)')
    r.addColorStop(0.65, 'rgba(255,140,30,0.3)')
    r.addColorStop(1, 'rgba(255,100,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  })

function buildStadium(scene: THREE.Scene) {
  const std = (c: string, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, rotZ = 0, x = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.rotation.z = rotZ
    m.position.set(x, y, z)
    m.receiveShadow = true
    scene.add(m)
    return m
  }
  const grassTex = canvasTex(
    256,
    256,
    (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#3f8f3a' : '#4aa043'
        g.fillRect(0, i * 32, 256, 32)
      }
    },
    [12, 12],
  )
  const grassM = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
  flat(new THREE.CircleGeometry(170, 72), grassM, 0)
  const dirt = std('#c9925a', 0.95)
  flat(new THREE.CircleGeometry(29, 48, Math.PI * 1.25, Math.PI * 0.5), dirt, 0.01)
  flat(new THREE.PlaneGeometry(19.4, 19.4), grassM, 0.02, Math.PI / 4, 0, -13.7)
  flat(new THREE.CircleGeometry(4, 32), dirt, 0.03)
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, MOUND_HEIGHT, 32), dirt)
  mound.position.set(0, MOUND_HEIGHT / 2, -PITCHER_DISTANCE)
  mound.receiveShadow = true
  scene.add(mound)
  const white = std('#ffffff', 0.5)
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.15), white)
  rubber.position.set(0, MOUND_HEIGHT + 0.02, -PITCHER_DISTANCE)
  scene.add(rubber)
  const plate = new THREE.Shape()
  plate.moveTo(-0.22, 0)
  plate.lineTo(0.22, 0)
  plate.lineTo(0.22, 0.22)
  plate.lineTo(0, 0.43)
  plate.lineTo(-0.22, 0.22)
  plate.closePath()
  flat(new THREE.ShapeGeometry(plate), white, 0.04, 0, 0, 0.2)
  for (const [x, z] of [
    [13.7, -13.7],
    [0, -27.4],
    [-13.7, -13.7],
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), white)
    b.position.set(x, 0.05, z)
    b.rotation.y = Math.PI / 4
    scene.add(b)
  }
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  for (const s of [-1, 1]) flat(new THREE.PlaneGeometry(0.12, FENCE_DISTANCE * 1.42), lineM, 0.04, s * (Math.PI / 4), s * -FENCE_DISTANCE * 0.5, -FENCE_DISTANCE * 0.5)
  for (const s of [-1, 1]) {
    const box = flat(new THREE.RingGeometry(0.9, 0.97, 4, 1), lineM, 0.045, Math.PI / 4, s * 1.1, 0.2)
    box.scale.set(0.7, 1.3, 1)
  }
  // 외야 펜스 + 노란 윗줄 + 거리
  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(FENCE_DISTANCE, FENCE_DISTANCE, 5, 72, 1, true, Math.PI * 0.75, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: '#1f6b3a', side: THREE.DoubleSide, roughness: 0.8 }),
  )
  fence.position.y = 2.5
  scene.add(fence)
  const cap = new THREE.Mesh(new THREE.TorusGeometry(FENCE_DISTANCE, 0.2, 6, 72, Math.PI * 0.5), std('#ffd43b', 0.5))
  cap.rotation.x = Math.PI / 2
  cap.rotation.z = Math.PI * 0.75
  cap.position.y = 5
  scene.add(cap)
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: canvasTex(256, 96, (g) => {
        g.fillStyle = '#ffffff'
        g.font = '900 72px system-ui, sans-serif'
        g.textAlign = 'center'
        g.fillText(`${FENCE_DISTANCE}m`, 128, 74)
      }),
    }),
  )
  label.position.set(0, 2.8, -FENCE_DISTANCE + 0.6)
  label.scale.set(8, 3, 1)
  scene.add(label)
  // 관중석 + 관중
  for (let k = 0; k < 7; k++) {
    const r = FENCE_DISTANCE + 4 + k * 4
    const tier = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 3 + k * 3, 72, 1, true, Math.PI * 0.68, Math.PI * 0.64),
      new THREE.MeshStandardMaterial({ color: k % 2 ? '#4a5568' : '#5a6578', side: THREE.DoubleSide }),
    )
    tier.position.y = 1.5 + k * 1.5
    scene.add(tier)
  }
  const COUNT = 1100
  const crowd = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 6, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), COUNT)
  const colors = ['#e03131', '#1971c2', '#f59f00', '#ffffff', '#2f9e44', '#ae3ec9', '#f06595']
  const seats: THREE.Vector3[] = []
  const m4 = new THREE.Matrix4()
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < COUNT; i++) {
    const k = i % 7
    const a = Math.PI * 0.68 + rnd() * Math.PI * 0.64
    const r = FENCE_DISTANCE + 5 + k * 4
    const p = new THREE.Vector3(Math.cos(a) * r, 3.4 + k * 3, Math.sin(a) * r)
    seats.push(p)
    m4.setPosition(p)
    crowd.setMatrixAt(i, m4)
    crowd.setColorAt(i, new THREE.Color(colors[i % colors.length]))
  }
  scene.add(crowd)
  // 조명탑
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 40, 10), std('#9aa3ad', 0.5))
    pole.position.set(s * 95, 20, -95)
    scene.add(pole)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1), new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff3b0', emissiveIntensity: 0.8 }))
    lamp.position.set(s * 95, 41, -95)
    lamp.lookAt(0, 0, 0)
    scene.add(lamp)
  }
  return { crowd, seats }
}

export function Field3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const lookKey = JSON.stringify(props.looks)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#8fc3e8')
    scene.fog = new THREE.Fog('#8fc3e8', 110, 260)
    const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 500)
    scene.add(new THREE.HemisphereLight('#ffffff', '#4a6b3a', 0.85))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.6)
    sun.position.set(18, 40, 12)
    sun.target.position.set(0, 0, -9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 100 })
    scene.add(sun, sun.target)

    const { crowd, seats } = buildStadium(scene)

    // 선수: 투수·타자·포수 (동물)
    const { looks } = propsRef.current
    const rig = (look: Look) => {
      const r = makeAnimal(look, '#f4f4f1')
      r.root.scale.setScalar(RIG_SCALE)
      scene.add(r.root)
      return r
    }
    const pitcher = rig(looks.pitcher)
    pitcher.root.position.set(0, MOUND_HEIGHT, -PITCHER_DISTANCE)
    const batter = rig(looks.batter)
    batter.root.position.copy(BATTER_POS)
    batter.root.rotation.y = Math.PI / 2
    batter.head.rotation.y = Math.PI / 2 - 0.2
    const catcher = rig(looks.catcher)
    catcher.root.position.copy(CATCHER_POS)
    catcher.root.rotation.y = Math.PI
    // 포수 미트
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: '#7a4220', roughness: 0.6 }))
    mitt.scale.set(1, 1, 0.6)
    catcher.armR.add(mitt)
    mitt.position.set(0, -0.6, 0.05)

    // 배트: 타자 몸에 붙여 몸이 도는 대로
    const batPivot = new THREE.Group()
    batPivot.position.set(0, 1.45, 0.38)
    batter.body.add(batPivot)
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.032, 1.05, 14), new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.45 }))
    bat.position.y = 0.45
    bat.castShadow = true
    batPivot.add(bat)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: '#3a2a1a' }))
    knob.position.y = -0.08
    batPivot.add(knob)
    const UP = new THREE.Vector3(0, 1, 0)
    const BAT_READY = new THREE.Vector3(-0.5, 0.86, -0.1).normalize()
    const BAT_HIT = new THREE.Vector3(0.05, 0.12, 1).normalize()
    const BAT_FOLLOW = new THREE.Vector3(0.85, 0.35, -0.4).normalize()
    const qa = new THREE.Quaternion()
    const qb = new THREE.Quaternion()

    // 스트라이크 존 (옅은 상자)
    const zoneH = STRIKE_ZONE.top - STRIKE_ZONE.bottom
    const zone = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, zoneH, 0.43)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }))
    zone.position.set(0, STRIKE_ZONE.bottom + zoneH / 2, 0.2)
    scene.add(zone)

    // 공: 흰 공 + 화면 크기 그대로인 빛 테두리(멀리 날아가도 잘 보이게) + 주황 꼬리
    const ballG = new THREE.Group()
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.25 }))
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: '#d6262b' }))
    seam.rotation.x = 1.1
    const gt = glowTex()
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false, transparent: true }))
    halo.scale.setScalar(0.07)
    ballG.add(core, seam, halo)
    ballG.visible = false
    scene.add(ballG)
    const trailSprites = Array.from({ length: 6 }, (_, k) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ color: '#ff9f1c', map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false, transparent: true, opacity: 0.7 - k * 0.1 }),
      )
      sp.scale.setScalar(0.05 - k * 0.006)
      sp.visible = false
      scene.add(sp)
      return sp
    })
    // 지나간 자리 ✕
    const markSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTex(64, 64, (g) => {
          g.strokeStyle = '#ff3b30'
          g.lineWidth = 9
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(12, 12)
          g.lineTo(52, 52)
          g.moveTo(52, 12)
          g.lineTo(12, 52)
          g.stroke()
        }),
        depthTest: false,
        sizeAttenuation: false,
      }),
    )
    markSprite.scale.setScalar(0.04)
    scene.add(markSprite)
    // 맞은 순간 번쩍
    const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false, transparent: true }))
    burst.visible = false
    scene.add(burst)

    function resize() {
      const w = Math.max(1, host!.clientWidth)
      const h = Math.max(1, host!.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const camPos = new THREE.Vector3()
    const camLook = new THREE.Vector3()
    let lastView = ''
    let raf = 0
    function frame() {
      const p = propsRef.current
      const now = p.now ?? performance.now()
      const t = now / 1000
      const spray = p.spray ?? 0
      const map = (pt: Point) => (p.following ? toBatted(pt, spray) : toPitch(pt))

      // 투수 동작: 공 놓기 전 0.75초 와인드업 → 놓는 순간 팔 휘두름 → 마무리
      pitcher.update(t, 'idle', 'calm')
      const tt = p.throwT
      pitcher.body.rotation.y = 0
      if (tt !== null && tt !== undefined && tt > -800 && tt < 900) {
        const k = tt / 750
        if (tt < 0) {
          // 팔을 뒤로 높이, 몸은 살짝 뒤로
          pitcher.armL.rotation.x = 2.5 * (1 + k)
          pitcher.armR.rotation.x = -0.8 * (1 + k)
          pitcher.body.rotation.x = -0.15 * (1 + k)
          pitcher.body.rotation.y = 0.5 * (1 + k)
        } else {
          const f = Math.min(1, tt / 160)
          pitcher.armL.rotation.x = 2.5 - f * 4.1
          pitcher.armR.rotation.x = -0.8 + f * 0.8
          pitcher.body.rotation.x = 0.35 * Math.min(1, tt / 200) * Math.max(0, 1 - (tt - 300) / 600)
          pitcher.body.rotation.y = 0.5 - f * 0.9
        }
      }

      // 타자: 준비 자세 → 스윙 (몸 비틀기 + 배트가 존을 지나 돌아감)
      batter.update(t, 'idle', 'calm')
      const sw = p.swing
      const prog = sw === null || sw === undefined ? -1 : sw
      for (const arm of [batter.armL, batter.armR]) {
        arm.rotation.x = -1.25
        arm.rotation.z = arm === batter.armL ? -0.15 : 0.15
      }
      if (prog < 0) {
        // 준비: 포수 쪽으로 살짝 꼬았다가 (몸 회전 + 쪽이 투수 쪽)
        batter.body.rotation.y = -0.35 + Math.sin(t * 3) * 0.03
        batPivot.quaternion.setFromUnitVectors(UP, BAT_READY)
      } else {
        batter.body.rotation.y = -0.35 + Math.min(1, prog * 1.4) * 1.7
        if (prog < 0.4) {
          qa.setFromUnitVectors(UP, BAT_READY)
          qb.setFromUnitVectors(UP, BAT_HIT)
          batPivot.quaternion.slerpQuaternions(qa, qb, prog / 0.4)
        } else {
          qa.setFromUnitVectors(UP, BAT_HIT)
          qb.setFromUnitVectors(UP, BAT_FOLLOW)
          batPivot.quaternion.slerpQuaternions(qa, qb, Math.min(1, (prog - 0.4) / 0.6))
        }
      }

      // 포수: 쪼그려 앉아 미트를 내밈
      catcher.update(t, 'idle', 'calm')
      catcher.body.position.y = -0.75
      catcher.armR.rotation.x = -1.35
      catcher.armL.rotation.x = -0.6

      // 공·꼬리
      ballG.visible = !!p.ball
      if (p.ball) {
        ballG.position.copy(map(p.ball))
        core.rotation.x += 0.4
      }
      trailSprites.forEach((sp, k) => {
        const q = p.trail?.[k]
        sp.visible = !!q && !!p.ball
        if (q) sp.position.copy(map(q))
      })
      markSprite.visible = !!p.mark && !p.following
      if (p.mark) markSprite.position.set(0, p.mark.y, 0.2)

      // 맞은 순간 번쩍 + 흔들림
      const im = p.impact
      let shake = 0
      burst.visible = !!im && im.ms >= 0 && im.ms < 260
      if (im && burst.visible) {
        burst.position.set(0, im.at.y, 0.1)
        const big = im.power === 'homerun' ? 0.5 : im.power === 'strong' ? 0.35 : 0.2
        burst.scale.setScalar(0.05 + (im.ms / 260) * big)
        ;(burst.material as THREE.SpriteMaterial).opacity = 1 - im.ms / 260
      }
      if (im && im.power !== 'weak' && im.ms >= 0 && im.ms < 350) shake = (im.power === 'homerun' ? 0.5 : 0.25) * (1 - im.ms / 350)

      // 홈런: 관중이 일어나 들썩
      if (p.celebrate) {
        const m4 = new THREE.Matrix4()
        seats.forEach((s, i) => {
          m4.setPosition(s.x, s.y + Math.abs(Math.sin(t * 9 + i)) * 1.2, s.z)
          crowd.setMatrixAt(i, m4)
        })
        crowd.instanceMatrix.needsUpdate = true
      }

      // 카메라
      catcher.root.visible = true
      const view = p.following ? 'follow' : p.view
      let fov = 40
      if (view === 'follow') {
        fov = 46
        const b = p.ball ? map(p.ball) : new THREE.Vector3(0, 1, -20)
        camPos.set(4, 16, 22)
        const target = new THREE.Vector3(b.x * 0.85, Math.min(b.y, 22) * 0.65, b.z * 0.85 - 8)
        camLook.lerp(target, lastView === 'follow' ? 0.2 : 1)
      } else if (view === 'broadcast') {
        fov = 13
        // 투수 몸이 타자를 가리지 않게 살짝 옆에서
        camPos.set(3.4, 6.6, -48)
        camLook.set(0, 1.4, 0)
      } else if (view === 'catcher') {
        fov = 40
        camPos.set(0.75, 3.0, 5.6)
        camLook.set(0, 1.6, -18)
        catcher.root.visible = false
      } else {
        fov = 44
        camPos.set(17, 2.6, -9.2)
        camLook.set(0, 1.5, -9.2)
      }
      lastView = view
      // 공 빛 테두리: 화면 크기 그대로라 망원(중계)에선 작게, 멀리 날아가는 타구는 크게
      const glow = view === 'broadcast' ? 0.03 : view === 'follow' ? 0.075 : 0.05
      halo.scale.setScalar(glow)
      markSprite.scale.setScalar(view === 'broadcast' ? 0.022 : 0.04)
      trailSprites.forEach((sp, k) => sp.scale.setScalar(glow * (0.7 - k * 0.09)))
      if (camera.fov !== fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
      camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake, camPos.z)
      camera.lookAt(camLook)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const r of [pitcher, batter, catcher]) r.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.LineSegments) {
          o.geometry?.dispose()
          const m = o.material as THREE.Material | THREE.Material[]
          ;(Array.isArray(m) ? m : [m]).forEach((x) => {
            ;(x as THREE.MeshStandardMaterial).map?.dispose()
            x.dispose()
          })
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [lookKey])

  return <div className="zb-field3d" ref={hostRef} role="img" aria-label="3D 야구장" />
}
