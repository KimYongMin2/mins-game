import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { encodeLook } from '../art3d/animalKinds'
import { type Look, makeAnimal } from '../art3d/animals'
import { createStage } from '../art3d/stage'

// 내 캐릭터 미리 보기: 3D로 천천히 돌아간다. 꾸미기를 바꾸면 바로 새로 그림. (three.js라 고르는 창을 열 때만 불러옴)

export function AvatarPreview3D({ look, shirt = '#2563eb', background = '#f1e7d8', className = 'avatar-preview' }: { look: Look; shirt?: string; background?: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const key = encodeLook(look)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = createStage(host, { background, fov: 30 })
    stage.scene.fog = null
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshStandardMaterial({ color: '#d9c4a3', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    stage.scene.add(floor)
    const rig = makeAnimal(look, shirt)
    stage.scene.add(rig.root)
    stage.camera.position.set(0, 2.4, 7.2)
    stage.camera.lookAt(0, 1.35, 0)
    stage.lamp.position.set(1.5, 7, 4)
    stage.lamp.target.position.set(0, 1, 0)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    function frame(now: number) {
      const t = (now - t0) / 1000
      // 한 바퀴씩 돌아 등번호도 보이게
      rig.root.rotation.y = reduce ? 0.4 : t * 0.6
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
  }, [key, background]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={className} ref={hostRef} aria-label="내 캐릭터 미리 보기" role="img" />
}
