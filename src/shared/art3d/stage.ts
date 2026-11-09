import * as THREE from 'three'

// 3D 화면 공통: 렌더러·장면·카메라·조명을 만들고, 담는 칸 크기에 맞춰 늘고 준다. 게임 규칙은 모른다.

export type Stage = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** 위에서 비추는 조명 (그림자) */
  lamp: THREE.SpotLight
  /** 화면 좌표(담는 칸 기준 px) → 3D 위치를 화면에 그릴 곳 */
  toScreen: (p: THREE.Vector3) => { x: number; y: number; visible: boolean }
  size: () => { w: number; h: number }
  render: () => void
  dispose: () => void
}

export function createStage(host: HTMLElement, opts: { background: string; fov?: number } ): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(opts.background)
  scene.fog = new THREE.Fog(opts.background, 11, 24)
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 40, 1, 0.1, 60)

  scene.add(new THREE.HemisphereLight('#fff2e0', '#2a2018', 0.9))
  const lamp = new THREE.SpotLight('#ffe6c4', 60, 22, Math.PI / 4.2, 0.55, 1.6)
  lamp.position.set(0.6, 8.5, 1.2)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.bias = -0.0004
  scene.add(lamp, lamp.target)
  const fill = new THREE.DirectionalLight('#9fb7ff', 0.35)
  fill.position.set(-5, 4, 6)
  scene.add(fill)

  let w = 1
  let h = 1
  function resize() {
    w = Math.max(1, host.clientWidth)
    h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  const v = new THREE.Vector3()
  function toScreen(p: THREE.Vector3) {
    v.copy(p).project(camera)
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 }
  }

  return {
    renderer,
    scene,
    camera,
    lamp,
    toScreen,
    size: () => ({ w, h }),
    render: () => renderer.render(scene, camera),
    dispose: () => {
      ro.disconnect()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material
          ;(Array.isArray(m) ? m : [m]).forEach((x) => {
            ;(x as THREE.MeshStandardMaterial).map?.dispose()
            x.dispose()
          })
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

/** 나무결 무늬 (캔버스로 그림). rings = 동심원(탁자 윗면), 아니면 곧은 결 */
export function woodTexture(base = '#9a5b2a', rings = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 120; i++) {
    g.strokeStyle = `rgba(55,28,8,${0.06 + rnd() * 0.2})`
    g.lineWidth = 1 + rnd() * 2.5
    g.beginPath()
    if (rings) g.arc(256 + rnd() * 6, 256 + rnd() * 6, 6 + i * 2.1 + rnd() * 3, 0, Math.PI * 2)
    else {
      const y = rnd() * 512
      g.moveTo(0, y)
      g.bezierCurveTo(170, y + rnd() * 20 - 10, 340, y + rnd() * 20 - 10, 512, y)
    }
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
