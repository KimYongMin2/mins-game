import { THROW_LABEL, type Throw } from '../rules/throw'

// 윷가락 넷. 평평한 면(배)이 위면 밝게 X 무늬, 둥근 면(등)이 위면 진하게. 빽도는 표시 있는 가락 하나만 배.
// 던진 직후 잠깐 흔들린다.

const FLAT: Record<Throw, readonly boolean[]> = {
  backdo: [true, false, false, false],
  do: [false, true, false, false],
  gae: [true, true, false, false],
  geol: [true, true, true, false],
  yut: [true, true, true, true],
  mo: [false, false, false, false],
}

export function Sticks({ result, shaking }: { result: Throw | null; shaking: boolean }) {
  const flat = result ? FLAT[result] : [false, false, false, false]
  return (
    <div className={`yt-sticks${shaking ? ' yt-sticks--shake' : ''}`} aria-label={result ? THROW_LABEL[result] : '윷가락'}>
      {flat.map((f, i) => (
        <span key={i} className={`yt-stick${f ? ' yt-stick--flat' : ''}${i === 0 ? ' yt-stick--marked' : ''}`} />
      ))}
    </div>
  )
}
