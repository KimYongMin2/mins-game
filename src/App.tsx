import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { ArcheryPage } from './games/archery/ArcheryPage'
import { ArmwrestlePage } from './games/armwrestle/ArmwrestlePage'
import { BattingPage } from './games/batting/BattingPage'
import { BombPage } from './games/bomb/BombPage'
import { FightPage } from './games/fight/FightPage'
import { MemoryPage } from './games/memory/MemoryPage'
import { NumbaseballPage } from './games/numbaseball/NumbaseballPage'
import { OmokPage } from './games/omok/OmokPage'
import { RoulettePage } from './games/roulette/RoulettePage'
import { SurvivalPage } from './games/survival/SurvivalPage'
import { ArtilleryPage } from './games/artillery/ArtilleryPage'
import { NunchiPage } from './games/nunchi/NunchiPage'
import { TilesPage } from './games/tiles/TilesPage'
import { VolleyPage } from './games/volley/VolleyPage'
import { YutPage } from './games/yut/YutPage'
import { ZolaballPage } from './games/zolaball/ZolaballPage'
import { MainPage } from './pages/MainPage'
import { MeetingPage } from './pages/meeting/MeetingPage'
import { NicknamePage } from './pages/NicknamePage'
import { loadNickname } from './shared/storage/nickname'
import { setSwitchTargets } from './shared/nav'
import { GAMES } from './pages/gameList'
import { playerRange } from './pages/PlayerDots'

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
    </BrowserRouter>
  )
}

export default App
