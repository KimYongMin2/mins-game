import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// 3D 화면 공통: 렌더러·장면·카메라·조명을 만들고, 담는 칸 크기에 맞춰 늘고 준다. 게임 규칙은 모른다.
// 2026-11-13 '더 사실적이고 역동적이게'(사용자 요청): 방 반사 빛(환경광)으로 재질이 살고, 카메라가 손으로 든 것처럼 아주 살짝 흔들리며,
// 게임이 부딪히는 순간 kick(세기)로 카메라를 확 당기고 흔들고, burst(위치)로 불꽃·먼지를 튀긴다.
// 게임이 매 프레임 카메라 위치를 정한 뒤 render()가 그 위에 흔들림을 더해 그리고 되돌린다(누르기 판정은 흔들림 없는 카메라로).

export type BurstOpts = {
  /** 알갱이 색 */
  color?: string
  /** 알갱이 수 (기본 26) */
  count?: number
  /** 튀는 빠르기 m/s (기본 3) */
  speed?: number
  /** 알갱이 크기 (기본 0.16) */
  size?: number
  /** 아래로 끌림 m/s² (기본 6, 연기는 음수로 떠오름) */
  gravity?: number
  /** 사라지기까지 초 (기본 0.7) */
  life?: number
}

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
  /** 부딪힘 연출: 카메라를 확 당기고 흔든다 (세기 0.3 = 가볍게, 1 = 크게) */
  kick: (strength?: number) => void
  /** 불꽃·먼지 알갱이를 튀긴다 */
  burst: (at: THREE.Vector3, opts?: BurstOpts) => void
  dispose: () => void
}

/** 동그랗게 번지는 알갱이 무늬 (한 번만 만듦) */
let dotTex: THREE.CanvasTexture | null = null
function softDot(): THREE.CanvasTexture {
  if (dotTex) return dotTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.85)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  dotTex = new THREE.CanvasTexture(c)
  return dotTex
}

export function createStage(host: HTMLElement, opts: { background: string; fov?: number; /** 손카메라 흔들림 크기 (기본 0.02, 정확히 눌러야 하는 게임은 0) */ sway?: number }): Stage {
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

  // 방 반사 빛: 털·나무·쇠에 은은한 반사가 생겨 덜 장난감 같아 보임 (한 번 만들어 두고 끝)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = envTex
  scene.environmentIntensity = 0.35

  scene.add(new THREE.HemisphereLight('#fff2e0', '#2a2018', 0.75))
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

  // 카메라 연출 + 알갱이
  const sway = opts.sway ?? 0.02
  let kickAt = -1
  let kickAmp = 0
  const KICK_MS = 380
  type Burst = { pts: THREE.Points; vel: Float32Array; born: number; life: number; gravity: number }
  const bursts: Burst[] = []
  let lastT = performance.now()

  function kick(strength = 1) {
    const now = performance.now()
    // 이미 흔들리는 중이면 더 센 쪽으로
    const left = kickAt >= 0 ? Math.max(0, 1 - (now - kickAt) / KICK_MS) * kickAmp : 0
    kickAmp = Math.max(left, strength)
    kickAt = now
  }

  function burst(at: THREE.Vector3, o: BurstOpts = {}) {
    const n = o.count ?? 26
    const speed = o.speed ?? 3
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3)
      // 공 모양으로 퍼지되 조금 위쪽으로
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const sp = speed * (0.45 + Math.random() * 0.75)
      vel.set([r * Math.cos(a) * sp, (Math.abs(u) * 0.8 + 0.3) * sp, r * Math.sin(a) * sp], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: o.color ?? '#ffd23f', size: o.size ?? 0.16, map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    scene.add(pts)
    bursts.push({ pts, vel, born: performance.now(), life: (o.life ?? 0.7) * 1000, gravity: o.gravity ?? 6 })
  }

  const camOff = new THREE.Vector3()
  function render() {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    // 알갱이 움직이기
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      const age = now - b.born
      const attr = b.pts.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      for (let j = 0; j < arr.length; j += 3) {
        b.vel[j + 1] -= b.gravity * dt
        b.vel[j] *= 0.985
        b.vel[j + 2] *= 0.985
        arr[j] += b.vel[j] * dt
        arr[j + 1] += b.vel[j + 1] * dt
        arr[j + 2] += b.vel[j + 2] * dt
      }
      attr.needsUpdate = true
      const m = b.pts.material as THREE.PointsMaterial
      m.opacity = Math.max(0, 1 - age / b.life)
      if (age >= b.life) {
        scene.remove(b.pts)
        b.pts.geometry.dispose()
        m.dispose()
        bursts.splice(i, 1)
      }
    }
    // 손카메라 살랑임 + 부딪힘 흔들림·당김 (그린 뒤 되돌림)
    const t = now / 1000
    camOff.set(Math.sin(t * 0.53) * sway, Math.sin(t * 0.37 + 1) * sway * 0.6, 0)
    const k = kickAt >= 0 ? Math.max(0, 1 - (now - kickAt) / KICK_MS) : 0
    const baseFov = camera.fov
    if (k > 0) {
      const amp = kickAmp * k * k
      camOff.x += (Math.random() - 0.5) * 0.22 * amp
      camOff.y += (Math.random() - 0.5) * 0.16 * amp
      camera.fov = baseFov * (1 - 0.07 * amp)
      camera.updateProjectionMatrix()
    } else kickAt = -1
    camera.position.add(camOff)
    renderer.render(scene, camera)
    camera.position.sub(camOff)
    if (camera.fov !== baseFov) {
      camera.fov = baseFov
      camera.updateProjectionMatrix()
    }
  }

  return {
    renderer,
    scene,
    camera,
    lamp,
    toScreen,
    size: () => ({ w, h }),
    render,
    kick,
    burst,
    dispose: () => {
      ro.disconnect()
      for (const b of bursts) {
        b.pts.geometry.dispose()
        ;(b.pts.material as THREE.Material).dispose()
      }
      envTex.dispose()
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

/** 방 반사 빛(환경광)을 장면에 건다 — createStage를 안 쓰는 3D 화면용. 끝낼 때 돌려준 함수를 부른다 */
export function addRoomLight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.35): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = tex
  scene.environmentIntensity = intensity
  return () => tex.dispose()
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

/**
 * 누른 곳(clientX·Y)에서 가장 가까운 대상 번호 (화면에서 몸 가운데까지 거리). 화면 폭의 15% 안에 없으면 null.
 * 폰에서 작은 3D 캐릭터를 정확히 누르기 어려워서 광선 대신 이걸로 고른다
 */
export function nearestOnScreen(stage: Stage, clientX: number, clientY: number, points: (THREE.Vector3 | null)[]): number | null {
  const r = stage.renderer.domElement.getBoundingClientRect()
  const x = clientX - r.left
  const y = clientY - r.top
  let best: number | null = null
  let bestD = Math.max(48, r.width * 0.15)
  points.forEach((p, i) => {
    if (!p) return
    const s = stage.toScreen(p)
    const d = Math.hypot(s.x - x, s.y - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
