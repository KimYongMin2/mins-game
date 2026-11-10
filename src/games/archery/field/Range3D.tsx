import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import type { Distance } from '../constants'

// 양궁 위쪽 띠의 실사풍 3D 사로 (사용자 요청 — '실사처럼'). 예전 옆모습 선화(SideView)와 같은 배치:
// 왼쪽에 내 캐릭터가 활을 들고, 거리가 멀수록 과녁(볏짚 받침)이 오른쪽으로 멀어진다. 단위는 SideView와 같은 화면 단위(가로 100).
// 당기면 시위가 뒤로 늘어나고, 쏘면 화살이 살짝 포물선으로 날아가 과녁에 닿는다. 그림만 바뀌고 점수·조준은 아래 과녁 화면 그대로.

type Props = {
  distance: Distance
  draw: number
  arrowProgress: number | null
  look: Look
  onReady?: () => void
}

const ARCHER_X = 9
const SHOULDER_Y = 8.5
/** 동물(키 약 2.6) → 화면 단위 (예전 졸라맨 키 약 12.4) */
const RIG_SCALE = 12.4 / 2.6
const targetX = (distance: Distance) => 30 + ((distance - 30) / 70) * 62

function grassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#5c9a44'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    g.fillRect(i * 43, 0, 43, 256)
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${30 + Math.random() * 50},${90 + Math.random() * 70},${30 + Math.random() * 30},0.25)`
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(8, 3)
  return t
}

function strawTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#d8b46a'
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 400; i++) {
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(150,110,40,0.5)' : 'rgba(240,215,150,0.6)'
    g.lineWidth = 1
    const x = Math.random() * 128
    const y = Math.random() * 128
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 10 + Math.random() * 14, y + (Math.random() - 0.5) * 5)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 과녁지 (정면 그림): 규격 색 링 */
function faceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const fills = ['#ffffff', '#ffffff', '#24201d', '#24201d', '#00a3d9', '#00a3d9', '#e8414a', '#e8414a', '#ffd93b', '#ffd93b']
  for (let i = 0; i < 10; i++) {
    g.beginPath()
    g.arc(128, 128, 128 - i * 12.8, 0, Math.PI * 2)
    g.fillStyle = fills[i]
    g.fill()
    g.strokeStyle = i === 2 || i === 3 ? '#ddd' : '#333'
    g.lineWidth = 1
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Range3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const lookKey = JSON.stringify(props.look)

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
    scene.background = new THREE.Color('#bfdcf2')
    scene.fog = new THREE.Fog('#bfdcf2', 90, 220)
    scene.add(new THREE.HemisphereLight('#eef6ff', '#4f7a3a', 1.2))
    const sun = new THREE.DirectionalLight('#fff2d6', 2)
    sun.position.set(30, 60, 40)
    sun.target.position.set(50, 0, 0)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 512)
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 30, bottom: -30, near: 1, far: 200 })
    scene.add(sun, sun.target)

    // 잔디 사로 + 거리 선 + 먼 나무 줄
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 320), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(50, 0, 0)
    ground.receiveShadow = true
    scene.add(ground)
    const chalk = new THREE.MeshBasicMaterial({ color: '#eef3e6' })
    for (const d of [30, 50, 70, 100] as Distance[]) {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 30), chalk)
      ln.rotation.x = -Math.PI / 2
      ln.position.set(targetX(d), 0.02, -6)
      scene.add(ln)
    }
    const shoot = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 30), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    shoot.rotation.x = -Math.PI / 2
    shoot.position.set(ARCHER_X + 3, 0.02, -6)
    scene.add(shoot)
    const treeM = new THREE.MeshStandardMaterial({ color: '#2f5d33', roughness: 1 })
    let seed = 5
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 40; i++) {
      const tree = new THREE.Mesh(new THREE.SphereGeometry(5 + rnd() * 4, 10, 8), treeM)
      tree.position.set(-40 + i * 5 + rnd() * 3, 3 + rnd() * 3, -70 - rnd() * 10)
      scene.add(tree)
    }

    // 과녁: 볏짚 받침(정사각) + 과녁지 + A자 나무 다리. 옆에서 보면 납작해서 궁수 쪽으로 반쯤 돌려 놓는다
    const target = new THREE.Group()
    const boss = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 7), new THREE.MeshStandardMaterial({ map: strawTexture(), roughness: 1 }))
    boss.castShadow = true
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.8 }))
    face.position.x = -0.72
    face.rotation.y = -Math.PI / 2
    const legM = new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.8 })
    const legs = [-1, 1].map((s) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), legM)
      leg.position.set(1.2, -4, s * 2.6)
      leg.rotation.z = -0.25
      leg.castShadow = true
      return leg
    })
    boss.position.y = 0
    target.add(boss, face, ...legs)
    target.rotation.y = -0.85
    scene.add(target)

    // 궁수 = 내 캐릭터 + 활(나무 활대·시위)
    const { look } = propsRef.current
    const rig: AnimalRig = makeAnimal(look, '#2563eb')
    rig.root.scale.setScalar(RIG_SCALE)
    rig.root.position.set(ARCHER_X, 0, 0)
    rig.root.rotation.y = Math.PI / 2 - 0.35
    rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true
    })
    scene.add(rig.root)
    const bowM = new THREE.MeshStandardMaterial({ color: '#5b3416', roughness: 0.5 })
    const bow = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.16, 8, 32, Math.PI * 0.8), bowM)
    bow.castShadow = true
    scene.add(bow)
    const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: '#f1efe8' }))
    scene.add(string)
    // 화살 (대 + 깃)
    const arrow = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7, 6), new THREE.MeshStandardMaterial({ color: '#c9c3b6' }))
    shaft.rotation.z = Math.PI / 2
    const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 3), new THREE.MeshStandardMaterial({ color: '#2fb36b' }))
    fletch.rotation.z = Math.PI / 2
    fletch.position.x = -3.1
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#555' }))
    tip.rotation.z = -Math.PI / 2
    tip.position.x = 3.6
    arrow.add(shaft, fletch, tip)
    scene.add(arrow)

    // 카메라: 사로를 비스듬히 앞에서, 가로 100단위가 화면에 들어오게
    const camera = new THREE.PerspectiveCamera(18, 100 / 22, 1, 600)
    camera.position.set(47, 11, 66)
    camera.lookAt(47, 5, 0)

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

    const v = new THREE.Vector3()
    let shownTx = targetX(propsRef.current.distance)
    let raf = 0
    function frame() {
      const { distance, draw, arrowProgress } = propsRef.current
      const t = performance.now() / 1000
      const tx = targetX(distance)
      shownTx += (tx - shownTx) * 0.15
      target.position.set(shownTx, 7.6, 0)

      // 궁수: 활 든 팔은 앞으로 쭉, 시위 당기는 팔은 당긴 만큼 접힘
      const pulling = arrowProgress === null ? draw : 0
      rig.update(t, 'idle', 'calm')
      rig.armR.rotation.set(-1.5, 0, 0.1)
      rig.armL.rotation.set(-1.5 + pulling * 0.4, 0, -0.5 * pulling - 0.1)
      // 활: 앞 손 위치에 세워서
      const bowX = ARCHER_X + 5.2
      bow.position.set(bowX - 2.9, SHOULDER_Y, 0.6)
      bow.rotation.set(0, 0, -Math.PI * 0.4)
      // 시위: 활 양끝 → 당기는 손(당길수록 뒤로)
      // 활 양끝 (활대 호의 시작·끝)
      const end0 = new THREE.Vector3(4.2, 0, 0).applyEuler(bow.rotation).add(bow.position)
      const end1 = new THREE.Vector3(Math.cos(Math.PI * 0.8) * 4.2, Math.sin(Math.PI * 0.8) * 4.2, 0).applyEuler(bow.rotation).add(bow.position)
      const nock = new THREE.Vector3((end0.x + end1.x) / 2 - pulling * 4.6, SHOULDER_Y, 0.6)
      const pos = stringGeo.getAttribute('position') as THREE.BufferAttribute
      pos.setXYZ(0, end0.x, end0.y, end0.z)
      pos.setXYZ(1, nock.x, nock.y, nock.z)
      pos.setXYZ(2, end1.x, end1.y, end1.z)
      pos.needsUpdate = true

      // 화살: 당기는 중엔 시위에 걸려 있고, 날아가는 중엔 과녁까지 살짝 포물선 (SideView와 같은 식)
      if (arrowProgress !== null) {
        const startX = ARCHER_X + 6
        const x = startX + (tx - startX) * arrowProgress
        const y = SHOULDER_Y + Math.sin(arrowProgress * Math.PI) * (1 + distance / 40)
        arrow.visible = true
        arrow.position.set(x - 3, y, 0.6)
        arrow.rotation.z = Math.cos(arrowProgress * Math.PI) * 0.12
      } else if (pulling > 0) {
        arrow.visible = true
        arrow.position.set(nock.x + 3.4, SHOULDER_Y, 0.6)
        arrow.rotation.z = 0
      } else arrow.visible = false

      renderer.render(scene, camera)
      // 거리 글자: 궁수와 과녁 사이 바닥
      v.set((ARCHER_X + tx) / 2, 0, 6).project(camera)
      if (labelRef.current) labelRef.current.style.left = `${((v.x + 1) / 2) * 100}%`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      rig.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
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

  return (
    <div className="ar-range3d" ref={hostRef} role="img" aria-label={`궁수와 ${props.distance}m 떨어진 과녁`}>
      <span className="ar-range3d__label" ref={labelRef}>
        {props.distance}m
      </span>
    </div>
  )
}
