import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'

// 짝맞추기 위쪽 띠: 카드 테이블 너머 양쪽 끝에 두 사람의 3D 동물이 상반신으로 앉아 카드를 내려다본다 (사용자 요청 — 고도화).
// 왼쪽 나(파랑), 오른쪽 상대(빨강). 점수·차례 글자는 GameScreen이 이 위에 겹친다.
// 반응: 내 차례 = 한 손 들기, 기다림 = 가만히, 맞힘 = 만세, 틀림 = 놀람, 이김 = 만세, 짐 = 눈 ✕

export type Reaction = 'turn' | 'wait' | 'match' | 'miss' | 'win' | 'lose'

type Props = {
  looks: readonly [Look, Look]
  reactions: readonly [Reaction, Reaction]
  onReady?: () => void
}

const COLORS = ['#2563eb', '#dc2626'] as const
const FOV = 24
const CAM_Z = 6
const LOOK_Y = 1.72

export function Players3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const key = JSON.stringify(props.looks)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#fff6e8', '#5a3a22', 1.15))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.4)
    sun.position.set(2, 6, 8)
    scene.add(sun)
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
    camera.position.set(0, LOOK_Y + 0.25, CAM_Z)
    camera.lookAt(0, LOOK_Y, 0)

    const rigs: AnimalRig[] = propsRef.current.looks.map((look, i) => {
      const rig = makeAnimal(look, COLORS[i], { team: true })
      scene.add(rig.root)
      return rig
    })

    let halfW = 4
    function resize() {
      const w = Math.max(1, host!.clientWidth)
      const h = Math.max(1, host!.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      halfW = Math.tan(((FOV / 2) * Math.PI) / 180) * CAM_Z * camera.aspect
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    function frame() {
      const { reactions } = propsRef.current
      const t = performance.now() / 1000
      rigs.forEach((rig, i) => {
        const side = i === 0 ? -1 : 1
        // 양쪽 끝에서 가운데(카드) 쪽을 보며 조금 숙임
        rig.root.position.set(side * (halfW - 1.15), 0, 0)
        rig.root.rotation.y = -side * 0.55
        const r = reactions[i]
        const pose = r === 'match' || r === 'win' ? 'cheer' : r === 'turn' ? 'raise' : r === 'miss' ? 'scared' : 'idle'
        const mood = r === 'match' || r === 'win' ? 'happy' : r === 'miss' ? 'scared' : r === 'lose' ? 'ko' : 'calm'
        rig.update(t + i * 1.9, pose, mood)
        rig.body.rotation.x = r === 'wait' || r === 'turn' ? 0.12 : rig.body.rotation.x
      })
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      rigs.forEach((r) => r.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [key])

  return <div className="mm-players3d" ref={hostRef} aria-hidden />
}
