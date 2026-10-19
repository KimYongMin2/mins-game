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
    title: '졸라볼',
    description: '졸라맨 야구. 타이밍 맞춰 스윙하고 봇을 이겨라!',
    path: '/games/zolaball',
    ready: false,
  },
]
