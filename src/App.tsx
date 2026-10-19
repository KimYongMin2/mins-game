import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
