import type { CardValue } from "@planningpoker/server/types"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card } from "../components/Card"
import { Countdown } from "../components/Countdown"
import { UserCard } from "../components/UserCard"
import { useWebSocket } from "../hooks/useWebSocket"
import { isConnectedAtom, roomIdAtom, roomStateAtom, selectedCardAtom, userIdAtom, userNameAtom } from "../store/atoms"
import { loadUserName, saveUserName } from "../utils/localStorage"
import { isValidRoomId } from "../utils/roomId"

const CARD_VALUES: CardValue[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [userName, setUserName] = useAtom(userNameAtom)
  const [storedRoomId, setRoomId] = useAtom(roomIdAtom)
  const [selectedCard, setSelectedCard] = useAtom(selectedCardAtom)
  const userId = useAtomValue(userIdAtom)
  const roomState = useAtomValue(roomStateAtom)
  const isConnected = useAtomValue(isConnectedAtom)
  const { sendMessage } = useWebSocket()
  const [hasJoined, setHasJoined] = useState(false)
  const [nameInput, setNameInput] = useState(() => loadUserName() || "")

  useEffect(() => {
    if (!roomId || !isValidRoomId(roomId)) {
      navigate("/")
      return
    }
    setRoomId(roomId)
  }, [roomId, navigate, setRoomId])

  useEffect(() => {
    if (isConnected && storedRoomId && userName && !hasJoined) {
      sendMessage({
        type: "join",
        name: userName,
        roomId: storedRoomId,
      })
      setHasJoined(true)
    }
  }, [isConnected, storedRoomId, userName, hasJoined, sendMessage])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (nameInput.trim()) {
      const trimmedName = nameInput.trim()
      saveUserName(trimmedName)
      setUserName(trimmedName)
    }
  }

  const handleSelectCard = (card: CardValue) => {
    setSelectedCard(card)
    sendMessage({ type: "selectCard", card })
  }

  const handleRevealCards = () => {
    sendMessage({ type: "revealCards" })
  }

  const handleNextRound = () => {
    sendMessage({ type: "nextRound" })
  }

  const allUsersSelected = roomState?.users.every((user) => user.hasSelectedCard) ?? false

  if (!userName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Join Room {roomId}</h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected || !roomState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Connecting to room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Countdown />

      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Planning Poker</h1>
              <span className="text-sm text-gray-500">Room: {roomId}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{roomState.users.length} participants</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-6xl w-full">
            {roomState.isRevealed && roomState.average !== undefined && (
              <div className="text-center mb-8">
                <h2 className="text-lg text-gray-600 mb-2">Average</h2>
                <div className="text-6xl font-bold text-blue-600">{roomState.average.toFixed(1)}</div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-6">
              {roomState.users.map((user) => (
                <UserCard
                  key={user.id}
                  name={user.name}
                  hasSelected={user.hasSelectedCard}
                  selectedCard={user.selectedCard}
                  isRevealed={roomState.isRevealed}
                  isCurrentUser={user.id === userId}
                />
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              {!roomState.isRevealed && (
                <button
                  type="button"
                  onClick={handleRevealCards}
                  disabled={!allUsersSelected}
                  className="bg-green-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Reveal Cards
                </button>
              )}
              {roomState.isRevealed && (
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
                >
                  Next Round
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-center gap-3 flex-wrap">
              {CARD_VALUES.map((value) => (
                <Card
                  key={value}
                  value={value}
                  isSelected={selectedCard === value}
                  onClick={() => handleSelectCard(value)}
                  isRevealed={roomState.isRevealed}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
