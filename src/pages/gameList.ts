// 메인 화면에 보여줄 게임 목록. 게임 코드를 import하지 않고 메타데이터만 둔다.
export type GameEntry = {
  id: string
  title: string
  description: string
  path: string
  ready: boolean
}

export const GAMES: GameEntry[] = [
  {
    id: 'zolaball',
    title: '야구',
    description: '졸라맨 야구. 타이밍 맞춰 스윙하고 봇을 이겨라!',
    path: '/games/zolaball',
    ready: true,
  },
  {
    id: 'fight',
    title: '격투',
    description: '2초마다 준비·방어·타격! 봇의 수를 읽고 먼저 쓰러뜨려라!',
    path: '/games/fight',
    ready: true,
  },
  {
    id: 'memory',
    title: '짝맞추기',
    description: '카드 22장, 번갈아 두 장씩. 기억해 두고 짝을 더 많이 찾아라!',
    path: '/games/memory',
    ready: true,
  },
  {
    id: 'batting',
    title: '배팅',
    description: '정면에서 날아오는 직구·슬라이더·커브. 칸을 터치해 홈런을 노려라!',
    path: '/games/batting',
    ready: true,
  },
  {
    id: 'archery',
    title: '양궁',
    description: '30m부터 100m까지 10발. 바람을 읽고 X를 노려라!',
    path: '/games/archery',
    ready: true,
  },
]
