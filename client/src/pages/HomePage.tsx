import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { generateRoomId, isValidRoomId } from "../utils/roomId"

export function HomePage() {
  const navigate = useNavigate()
  const [roomId, setRoomId] = useState("")

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId()
    navigate(`/room/${newRoomId}`)
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    const formattedRoomId = roomId.toUpperCase().trim()
    if (isValidRoomId(formattedRoomId)) {
      navigate(`/room/${formattedRoomId}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Planning Poker</h1>
          <p className="text-gray-600">Estimate your stories with your team in real-time</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create a New Room</h2>
            <button
              type="button"
              onClick={handleCreateRoom}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-blue-700 transition-colors"
            >
              Create Room
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>

          <form onSubmit={handleJoinRoom}>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Join Existing Room</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room code (e.g., ABC123)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase"
                maxLength={6}
              />
              <button
                type="submit"
                disabled={!isValidRoomId(roomId.toUpperCase().trim())}
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
