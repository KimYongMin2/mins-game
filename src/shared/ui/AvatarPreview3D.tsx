import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { type Look, makeAnimal } from '../art3d/animals'
import { createStage } from '../art3d/stage'

// 내 캐릭터 미리 보기: 3D로 천천히 돌아간다. 꾸미기를 바꾸면 바로 새로 그림. (three.js라 고르는 창을 열 때만 불러옴)

export function AvatarPreview3D({ look, shirt = '#2563eb' }: { look: Look; shirt?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const key = `${look.animal}.${look.hat}.${look.glasses}.${look.neck}.${look.fur}`

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = createStage(host, { background: '#f1e7d8', fov: 30 })
    stage.scene.fog = null
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshStandardMaterial({ color: '#d9c4a3', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    stage.scene.add(floor)
    const rig = makeAnimal(look, shirt)
    // 게임에선 탁자에 가려지는 아랫부분이 비어 있어서 바닥에 닿게 내린다
    rig.root.position.y = -0.45
    stage.scene.add(rig.root)
    stage.camera.position.set(0, 2.6, 6.4)
    stage.camera.lookAt(0, 1.55, 0)
    stage.lamp.position.set(1.5, 7, 4)
    stage.lamp.target.position.set(0, 1, 0)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    function frame(now: number) {
      const t = (now - t0) / 1000
      rig.root.rotation.y = reduce ? 0.4 : Math.sin(t * 0.7) * 0.9
      rig.update(t, 'idle', 'happy')
      stage.render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      rig.dispose()
      stage.dispose()
    }
    // 꾸미기가 바뀌면 새로 만든다
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="avatar-preview" ref={hostRef} aria-label="내 캐릭터 미리 보기" role="img" />
}
