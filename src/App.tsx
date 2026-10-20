import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ArcheryPage } from './games/archery/ArcheryPage'
import { BattingPage } from './games/batting/BattingPage'
import { FightPage } from './games/fight/FightPage'
import { MemoryPage } from './games/memory/MemoryPage'
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
