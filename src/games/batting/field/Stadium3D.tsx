import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import type { Hand } from '../constants'
import { CAMERA, FOCAL, HORIZON_Y, VIEW_H, VIEW_W } from './view'
import type { PitcherPose, SwingPose } from './FrontView'

// 배팅 실사풍 3D 뒤 배경 (사용자 요청 — '실사처럼'): 잔디·흙 내야·마운드·홈플레이트·파울선·외야 펜스·관중석·하늘,
// 투수와 타자는 3D 동물. 존·공·궤적·× 표시는 위의 2D 그림(FrontView scene3d) 그대로라 판정·타이밍은 예전과 똑같다.
// 카메라를 2D 원근 투영(view.ts의 project)과 똑같이 맞춘다: 포수 뒤 (0, 1.6, −4)에서 +z(투수)를 봄, 초점 FOCAL, 지평선 HORIZON_Y.
// three 카메라는 −z를 보고 오른쪽이 +x라, +z를 보면 오른쪽이 −x가 된다 → 장면 전체를 x로 뒤집어(root.scale.x = −1) 2D와 같은 쪽에 놓는다.

type Props = {
  hand: Hand
  pitcher: PitcherPose
  swing: SwingPose | null
  looks: { batter: Look; pitcher: Look }
  onReady?: () => void
}

/** 동물(키 약 2.6) → 사람 키 약 1.85m */
const RIG_SCALE = 1.85 / 2.6

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#3f8f3a' : '#4a9c43'
    g.fillRect(0, i * 32, 256, 32)
  }
  // 잔디 결
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 40},${70 + Math.random() * 60},${20 + Math.random() * 30},0.18)`
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 16)
  t.anisotropy = 8
  return t
}

function dirtTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#b07a4a'
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 1800; i++) {
    const v = Math.random()
    g.fillStyle = v > 0.5 ? 'rgba(90,55,25,0.25)' : 'rgba(220,180,130,0.2)'
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 6)
  return t
}

function buildStadium(root: THREE.Group) {
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.position.y = y
    m.receiveShadow = true
    root.add(m)
    return m
  }
  // 잔디 (투수 쪽으로 줄무늬)
  const grass = flat(new THREE.PlaneGeometry(220, 240), new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.95 }))
  grass.position.z = 100
  // 흙 내야: 홈 둘레 원 + 마운드 쪽 띠 + 베이스 라인을 따라 부채꼴
  const dirt = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1 })
  const fan = flat(new THREE.CircleGeometry(29, 64, Math.PI / 4, Math.PI / 2), dirt, 0.005)
  fan.rotation.z = 0
  const grassIn = flat(new THREE.CircleGeometry(19, 64, Math.PI / 4, Math.PI / 2), new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.95 }), 0.01)
  void grassIn
  flat(new THREE.CircleGeometry(4.2, 48), dirt, 0.015)
  // 마운드 (살짝 솟은 흙) + 투수판
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.25, 48), dirt)
  mound.position.set(0, 0.12, 18.4)
  mound.receiveShadow = true
  root.add(mound)
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.15), new THREE.MeshStandardMaterial({ color: '#f4f4f0' }))
  rubber.position.set(0, 0.26, 18.4)
  root.add(rubber)
  // 홈플레이트 (오각형) + 타석 선
  const plate = new THREE.Shape([new THREE.Vector2(-0.22, 0.22), new THREE.Vector2(0.22, 0.22), new THREE.Vector2(0.22, 0), new THREE.Vector2(0, -0.22), new THREE.Vector2(-0.22, 0)])
  const plateMesh = flat(new THREE.ShapeGeometry(plate), new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.6 }), 0.02)
  plateMesh.rotation.z = Math.PI
  const chalk = new THREE.MeshBasicMaterial({ color: '#f3efe6' })
  const line = (x1: number, z1: number, x2: number, z2: number, w = 0.08) => {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const m = flat(new THREE.PlaneGeometry(w, len), chalk, 0.025)
    m.position.set((x1 + x2) / 2, 0.025, (z1 + z2) / 2)
    m.rotation.z = Math.atan2(x2 - x1, z2 - z1)
  }
  for (const s of [-1, 1]) {
    line(0, 0, s * 85, 85, 0.1)
    // 타석 네모
    line(s * 0.45, -0.9, s * 0.45, 0.9, 0.06)
    line(s * 1.7, -0.9, s * 1.7, 0.9, 0.06)
    line(s * 0.45, -0.9, s * 1.7, -0.9, 0.06)
    line(s * 0.45, 0.9, s * 1.7, 0.9, 0.06)
  }
  // 외야 펜스·관중석은 같은 모양이 수백 개라 InstancedMesh로 한 번에 그린다
  // (처음엔 하나씩 만들어 물체가 1,400개쯤 — 오래된 폰에서 버벅일 수 있어서 바꿈)
  const dummy = new THREE.Object3D()
  const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rotY: number) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, rotY, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const angles: number[] = []
  for (let a = -0.85; a <= 0.851; a += 0.05) angles.push(a)
  // 외야 펜스 (짙은 초록 + 노란 윗줄) — 부채꼴로
  const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, 3.2, 0.5), new THREE.MeshStandardMaterial({ color: '#1f4d33', roughness: 0.8 }), angles.length)
  const wallTop = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, 0.25, 0.55), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 }), angles.length)
  angles.forEach((a, i) => {
    place(wall, i, Math.sin(a) * 115, 1.6, Math.cos(a) * 115, a)
    place(wallTop, i, Math.sin(a) * 115, 3.25, Math.cos(a) * 115, a)
  })
  root.add(wall, wallTop)
  // 관중석: 펜스 뒤 계단 + 색색 관중 (색마다 하나의 InstancedMesh)
  const stepM = new THREE.MeshStandardMaterial({ color: '#5b6573', roughness: 0.9 })
  const ROWS = 8
  const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(6.3, 2.2, 3), stepM, ROWS * angles.length)
  const fanColors = ['#e03131', '#1971c2', '#f8f9fa', '#f08c00', '#2f9e44', '#ffd43b', '#862e9c', '#343a40']
  const fanGeo = new THREE.BoxGeometry(0.9, 1.1, 0.6)
  const fanSpots: { x: number; y: number; z: number; a: number }[][] = fanColors.map(() => [])
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let k = 0
  for (let row = 0; row < ROWS; row++) {
    const r = 121 + row * 3
    const y = 3.5 + row * 2.2
    for (const a of angles) {
      place(steps, k++, Math.sin(a) * r, y - 1.1, Math.cos(a) * r, a)
      for (let j = -2; j <= 2; j++) {
        if (rnd() < 0.25) continue
        const aa = a + j * 0.0095
        fanSpots[Math.floor(rnd() * fanColors.length)].push({ x: Math.sin(aa) * (r - 0.4), y: y + 0.55, z: Math.cos(aa) * (r - 0.4), a: aa })
      }
    }
  }
  root.add(steps)
  fanColors.forEach((c, ci) => {
    const spots = fanSpots[ci]
    const fans = new THREE.InstancedMesh(fanGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), spots.length)
    spots.forEach((p, i) => place(fans, i, p.x, p.y, p.z, p.a))
    root.add(fans)
  })
  // 조명탑 둘
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 38, 8), stepM)
    pole.position.set(s * 70, 19, 112)
    root.add(pole)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 1), new THREE.MeshBasicMaterial({ color: '#fff9db' }))
    lamp.position.set(s * 70, 39, 112)
    root.add(lamp)
  }
}

export function Stadium3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const lookKey = JSON.stringify(props.looks) + props.hand

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // 하늘: 위는 짙은 파랑 → 지평선 쪽 옅게 (큰 공 안쪽에 그림)
    const skyTex = (() => {
      const c = document.createElement('canvas')
      c.width = 2
      c.height = 256
      const g = c.getContext('2d')!
      const grad = g.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, '#3d7fd6')
      grad.addColorStop(0.55, '#8fc2ef')
      grad.addColorStop(1, '#dcecf8')
      g.fillStyle = grad
      g.fillRect(0, 0, 2, 256)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    })()
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }))
    scene.add(sky)
    scene.fog = new THREE.Fog('#cfe3f4', 90, 260)
    scene.add(new THREE.HemisphereLight('#e8f3ff', '#4a6b3a', 1.1))
    const sun = new THREE.DirectionalLight('#fff3dc', 2.2)
    sun.position.set(-25, 40, -10)
    sun.target.position.set(0, 0, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -8
    sun.shadow.camera.right = 8
    sun.shadow.camera.top = 25
    sun.shadow.camera.bottom = -6
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 90
    scene.add(sun, sun.target)

    // 2D와 같은 쪽에 보이도록 x로 뒤집은 뿌리
    const root = new THREE.Group()
    root.scale.x = -1
    scene.add(root)
    buildStadium(root)

    const { looks, hand } = propsRef.current
    const rig = (look: Look, shirt: string) => {
      const r = makeAnimal(look, shirt)
      r.root.scale.setScalar(RIG_SCALE)
      r.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true
      })
      root.add(r.root)
      return r
    }
    // 투수: 마운드 위, 홈(카메라) 쪽을 봄
    const pitcher: AnimalRig = rig(looks.pitcher, '#dc2626')
    pitcher.root.position.set(0, 0.25, 18.2)
    pitcher.root.rotation.y = Math.PI
    // 타자: 우타는 포수 시점 왼쪽 타석(2D와 같게 x 음수), 홈플레이트 쪽을 보고 서서 투수 쪽으로 고개
    const side = hand === 'right' ? -1 : 1
    const batter: AnimalRig = rig(looks.batter, '#2563eb')
    batter.root.position.set(side * 0.95, 0, 0.9)
    batter.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
    batter.head.rotation.y = side < 0 ? -1.1 : 1.1
    const batPivot = new THREE.Group()
    batPivot.position.set(0, 1.45, 0.35)
    batter.body.add(batPivot)
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.04, 1.35, 14), new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.45 }))
    bat.position.y = 0.6
    bat.castShadow = true
    batPivot.add(bat)
    const UP = new THREE.Vector3(0, 1, 0)
    // 방향은 타자 몸 기준. 타자가 홈 쪽을 보면 몸의 +x가 우타는 포수 쪽, 좌타는 투수 쪽이라 swingSign으로 맞춘다
    // (처음엔 부호가 반대라 방망이가 몸 뒤에 숨어 안 보이다가 투수 반대쪽으로 휘둘렀음)
    const swingSign = side < 0 ? 1 : -1
    // 준비: 뒤쪽 어깨 위로 세워 포수 쪽으로 · 맞히는 순간: 홈 위로 수평 · 마무리: 투수 쪽으로 감아 돌림
    const READY = new THREE.Vector3(0.2 * swingSign, 0.95, 0.35).normalize()
    const HIT = new THREE.Vector3(-0.05 * swingSign, 0.1, 1).normalize()
    const FOLLOW = new THREE.Vector3(-0.85 * swingSign, 0.4, -0.35).normalize()
    const qa = new THREE.Quaternion()
    const qb = new THREE.Quaternion()

    // 카메라: 2D 투영과 똑같이 (주점이 가운데가 아니라 지평선 높이라 view offset으로 맞춤)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 700)
    const fullH = 2 * Math.max(HORIZON_Y, VIEW_H - HORIZON_Y)
    camera.fov = (2 * Math.atan(fullH / 2 / FOCAL) * 180) / Math.PI
    camera.aspect = VIEW_W / fullH
    camera.setViewOffset(VIEW_W, fullH, 0, fullH / 2 - HORIZON_Y, VIEW_W, VIEW_H)
    camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z)
    camera.lookAt(CAMERA.x, CAMERA.y, CAMERA.z + 10)
    camera.updateProjectionMatrix()

    function resize() {
      renderer.setSize(Math.max(1, host!.clientWidth), Math.max(1, host!.clientHeight), false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    function frame() {
      const p = propsRef.current
      const t = performance.now() / 1000
      // 투수(우완): 와인드업(0~1) → 놓기(1) → 팔로스루(1~2). 장면을 좌우로 뒤집어 그려서 던지는 팔은 armR
      // (armL로 했더니 공은 오른손 쪽에서 나오는데 왼팔로 던지는 것처럼 보였음)
      pitcher.update(t, 'idle', 'calm')
      const pose = p.pitcher
      if (pose > 0 && pose < 2.2) {
        if (pose <= 1) {
          pitcher.armR.rotation.x = 2.6 * pose
          pitcher.armL.rotation.x = -0.9 * pose
          pitcher.body.rotation.y = -0.55 * pose
          pitcher.body.rotation.x = -0.12 * pose
        } else {
          const f = Math.min(1, (pose - 1) * 4)
          pitcher.armR.rotation.x = 2.6 - f * 4.2
          pitcher.armL.rotation.x = -0.9 + f * 0.9
          pitcher.body.rotation.y = -0.55 + f * 0.9
          pitcher.body.rotation.x = 0.35 * f * Math.max(0, 1 - (pose - 1.4))
        }
      }
      // 타자: 준비 → 스윙 (몸 비틀기 + 배트 돌기)
      batter.update(t, 'idle', 'calm')
      for (const arm of [batter.armL, batter.armR]) {
        arm.rotation.x = -1.25
        arm.rotation.z = arm === batter.armL ? -0.15 : 0.15
      }
      const prog = p.swing ? p.swing.progress : -1
      if (prog < 0) {
        batter.body.rotation.y = swingSign * 0.35 + Math.sin(t * 3) * 0.03
        batPivot.quaternion.setFromUnitVectors(UP, READY)
      } else {
        // 몸을 투수 쪽으로 열며 돈다
        batter.body.rotation.y = swingSign * (0.35 - Math.min(1, prog * 1.6) * 1.7)
        if (prog < 0.25) {
          qa.setFromUnitVectors(UP, READY)
          qb.setFromUnitVectors(UP, HIT)
          batPivot.quaternion.slerpQuaternions(qa, qb, prog / 0.25)
        } else {
          qa.setFromUnitVectors(UP, HIT)
          qb.setFromUnitVectors(UP, FOLLOW)
          batPivot.quaternion.slerpQuaternions(qa, qb, Math.min(1, (prog - 0.25) / 0.75))
        }
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      pitcher.dispose()
      batter.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material as THREE.Material & { map?: THREE.Texture | null }
          m.map?.dispose()
          m.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [lookKey])

  return <div className="bt-stadium3d" ref={hostRef} aria-hidden />
}
