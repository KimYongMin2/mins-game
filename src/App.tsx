import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { MainPage } from './pages/MainPage'
import { NicknamePage } from './pages/NicknamePage'
import { loadNickname } from './shared/storage/nickname'
import { setSwitchTargets } from './shared/nav'
import { GAMES } from './pages/gameList'
import { playerRange } from './pages/PlayerDots'

// 게임·회의방 화면은 들어갈 때 받는다 (사용자 요청 — 처음에 16개 게임을 한꺼번에 받아 첫 화면이 느렸음)
const ArcheryPage = lazy(() => import('./games/archery/ArcheryPage').then((m) => ({ default: m.ArcheryPage })))
const ArmwrestlePage = lazy(() => import('./games/armwrestle/ArmwrestlePage').then((m) => ({ default: m.ArmwrestlePage })))
const BattingPage = lazy(() => import('./games/batting/BattingPage').then((m) => ({ default: m.BattingPage })))
const BombPage = lazy(() => import('./games/bomb/BombPage').then((m) => ({ default: m.BombPage })))
const FightPage = lazy(() => import('./games/fight/FightPage').then((m) => ({ default: m.FightPage })))
const MemoryPage = lazy(() => import('./games/memory/MemoryPage').then((m) => ({ default: m.MemoryPage })))
const NumbaseballPage = lazy(() => import('./games/numbaseball/NumbaseballPage').then((m) => ({ default: m.NumbaseballPage })))
const OmokPage = lazy(() => import('./games/omok/OmokPage').then((m) => ({ default: m.OmokPage })))
const RoulettePage = lazy(() => import('./games/roulette/RoulettePage').then((m) => ({ default: m.RoulettePage })))
const SurvivalPage = lazy(() => import('./games/survival/SurvivalPage').then((m) => ({ default: m.SurvivalPage })))
const ArtilleryPage = lazy(() => import('./games/artillery/ArtilleryPage').then((m) => ({ default: m.ArtilleryPage })))
const NunchiPage = lazy(() => import('./games/nunchi/NunchiPage').then((m) => ({ default: m.NunchiPage })))
const TilesPage = lazy(() => import('./games/tiles/TilesPage').then((m) => ({ default: m.TilesPage })))
const VolleyPage = lazy(() => import('./games/volley/VolleyPage').then((m) => ({ default: m.VolleyPage })))
const YutPage = lazy(() => import('./games/yut/YutPage').then((m) => ({ default: m.YutPage })))
const ZolaballPage = lazy(() => import('./games/zolaball/ZolaballPage').then((m) => ({ default: m.ZolaballPage })))
const MeetingPage = lazy(() => import('./pages/meeting/MeetingPage').then((m) => ({ default: m.MeetingPage })))

// 대기실 '게임 바꾸기'에서 고를 수 있는 게임 (친구 대전 되는 게임만, shared는 게임 목록을 몰라서 여기서 넣어 줌)
setSwitchTargets(
  GAMES.filter((g) => g.ready && g.play === 'pvp').map((g) => {
    const [min, max] = playerRange(g.players)
    return { id: g.id, title: g.title, path: g.path, min, max }
  }),
)

/** 닉네임이 없으면 닉네임 화면으로. 정한 뒤 원래 주소(초대 링크의 ?mode=pvp&join=… 포함)로 돌아오게 들고 간다 */
function ToNickname() {
  const location = useLocation()
  return <Navigate to="/nickname" replace state={{ from: location.pathname + location.search }} />
}

function App() {
  const [nickname, setNickname] = useState(loadNickname)

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading" role="status">불러오는 중…</div>}>
      <Routes>
        <Route
          path="/"
          element={
            nickname ? <MainPage nickname={nickname} /> : <ToNickname />
          }
        />
        <Route path="/nickname" element={<NicknamePage onSaved={setNickname} />} />
        <Route
          path="/games/zolaball"
          element={nickname ? <ZolaballPage /> : <ToNickname />}
        />
        <Route
          path="/games/archery"
          element={nickname ? <ArcheryPage /> : <ToNickname />}
        />
        <Route
          path="/games/batting"
          element={nickname ? <BattingPage /> : <ToNickname />}
        />
        <Route
          path="/games/fight"
          element={nickname ? <FightPage /> : <ToNickname />}
        />
        <Route
          path="/games/memory"
          element={nickname ? <MemoryPage /> : <ToNickname />}
        />
        <Route
          path="/games/armwrestle"
          element={nickname ? <ArmwrestlePage /> : <ToNickname />}
        />
        <Route
          path="/games/bomb"
          element={nickname ? <BombPage /> : <ToNickname />}
        />
        <Route
          path="/games/nunchi"
          element={nickname ? <NunchiPage /> : <ToNickname />}
        />
        <Route
          path="/games/yut"
          element={nickname ? <YutPage /> : <ToNickname />}
        />
        <Route
          path="/games/tiles"
          element={nickname ? <TilesPage /> : <ToNickname />}
        />
        <Route
          path="/games/volley"
          element={nickname ? <VolleyPage /> : <ToNickname />}
        />
        <Route
          path="/games/numbaseball"
          element={nickname ? <NumbaseballPage /> : <ToNickname />}
        />
        <Route
          path="/games/omok"
          element={nickname ? <OmokPage /> : <ToNickname />}
        />
        <Route
          path="/games/survival"
          element={nickname ? <SurvivalPage /> : <ToNickname />}
        />
        <Route
          path="/games/roulette"
          element={nickname ? <RoulettePage /> : <ToNickname />}
        />
        <Route
          path="/games/artillery"
          element={nickname ? <ArtilleryPage /> : <ToNickname />}
        />
        <Route
          path="/meeting"
          element={nickname ? <MeetingPage /> : <ToNickname />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
