// 메인 화면에 보여줄 게임 목록. 게임 코드를 import하지 않고 메타데이터만 둔다.
export type GameEntry = {
  id: string
  title: string
  description: string
  path: string
  ready: boolean
  /** pvp = 친구 대전과 봇 대전 / solo = 혼자 하는 기록 도전 (메인 화면에서 나눠 보여줌) */
  play: 'pvp' | 'solo'
}

export const GAMES: GameEntry[] = [
  {
    id: 'zolaball',
    title: '야구',
    description: '졸라맨 야구. 타이밍 맞춰 스윙하고 봇을 이겨라!',
    path: '/games/zolaball',
    ready: true,
    play: 'pvp',
  },
  {
    id: 'fight',
    title: '격투',
    description: '2초마다 준비·방어·타격! 봇의 수를 읽고 먼저 쓰러뜨려라!',
    path: '/games/fight',
    ready: true,
    play: 'pvp',
  },
  {
    id: 'memory',
    title: '짝맞추기',
    description: '카드 22장, 번갈아 두 장씩. 기억해 두고 짝을 더 많이 찾아라!',
    path: '/games/memory',
    ready: true,
    play: 'pvp',
  },
  {
    id: 'armwrestle',
    title: '팔씨름',
    description: '연타전 또는 타이밍전. 손을 내 쪽으로 끝까지 당겨 3판 2선승!',
    path: '/games/armwrestle',
    ready: true,
    play: 'pvp',
  },
  {
    id: 'bomb',
    title: '폭탄 돌리기',
    description: '2~6명. 폭탄을 들면 얼른 넘겨라! 터질 때 들고 있으면 탈락',
    path: '/games/bomb',
    ready: true,
    play: 'pvp',
  },
  {
    id: 'batting',
    title: '배팅',
    description: '정면에서 날아오는 직구·슬라이더·커브. 칸을 터치해 홈런을 노려라!',
    path: '/games/batting',
    ready: true,
    play: 'solo',
  },
  {
    id: 'archery',
    title: '양궁',
    description: '30m부터 100m까지 10발. 바람을 읽고 X를 노려라!',
    path: '/games/archery',
    ready: true,
    play: 'solo',
  },
]
