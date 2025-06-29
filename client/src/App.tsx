import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { HomePage } from "./pages/HomePage"
import { RoomPage } from "./pages/RoomPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
