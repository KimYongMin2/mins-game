import * as THREE from 'three'
import type { Look } from './animalKinds'
import { makeAnimal } from './animals'

// 내 캐릭터 얼굴을 한 번만 그려서 작은 그림(PNG 데이터 주소)으로 돌려준다. 메인 맨 위 내 이름 옆에 쓴다 (계속 3D를 돌리지 않게).
export function snapshotFace(look: Look, size = 128): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  let renderer: THREE.WebGLRenderer | null = null
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.setSize(size, size, false)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#fff6e8', '#6b5a48', 1.25))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.5)
    sun.position.set(2, 4, 5)
    scene.add(sun)
    const rig = makeAnimal(look, '#2563eb')
    rig.update(0, 'idle', 'happy')
    scene.add(rig.root)
    // 머리(키 약 2.05 높이)를 정면에서 조금 위로, 모자까지 들어오게
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20)
    camera.position.set(0.1, 2.2, 3.1)
    camera.lookAt(0, 2.1, 0)
    renderer.render(scene, camera)
    const url = canvas.toDataURL('image/png')
    rig.dispose()
    return url
  } catch {
    return null
  } finally {
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
}
