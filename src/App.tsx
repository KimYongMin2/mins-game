import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
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
import { NunchiPage } from './games/nunchi/NunchiPage'
import { TilesPage } from './games/tiles/TilesPage'
import { YutPage } from './games/yut/YutPage'
import { ZolaballPage } from './games/zolaball/ZolaballPage'
import { MainPage } from './pages/MainPage'
import { NicknamePage } from './pages/NicknamePage'
import { loadNickname } from './shared/storage/nickname'

function App() {
  const [nickname, setNickname] = useState(loadNickname)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            nickname ? <MainPage nickname={nickname} /> : <Navigate to="/nickname" replace />
          }
        />
        <Route path="/nickname" element={<NicknamePage onSaved={setNickname} />} />
        <Route
          path="/games/zolaball"
          element={nickname ? <ZolaballPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/archery"
          element={nickname ? <ArcheryPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/batting"
          element={nickname ? <BattingPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/fight"
          element={nickname ? <FightPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/memory"
          element={nickname ? <MemoryPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/armwrestle"
          element={nickname ? <ArmwrestlePage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/bomb"
          element={nickname ? <BombPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/nunchi"
          element={nickname ? <NunchiPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/yut"
          element={nickname ? <YutPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/tiles"
          element={nickname ? <TilesPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/numbaseball"
          element={nickname ? <NumbaseballPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/omok"
          element={nickname ? <OmokPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/survival"
          element={nickname ? <SurvivalPage /> : <Navigate to="/nickname" replace />}
        />
        <Route
          path="/games/roulette"
          element={nickname ? <RoulettePage /> : <Navigate to="/nickname" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
