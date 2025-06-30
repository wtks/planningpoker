import type { CardValue } from "@planningpoker/server/types"
import { clsx } from "../utils/clsx"

interface UserCardProps {
  name: string
  hasSelected: boolean
  selectedCard?: CardValue
  isRevealed: boolean
  isCurrentUser?: boolean
}

export function UserCard({ name, hasSelected, selectedCard, isRevealed, isCurrentUser }: UserCardProps) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div
        className={clsx(
          "relative w-20 h-28 rounded-lg shadow-lg transition-all duration-300",
          "flex items-center justify-center",
          hasSelected ? "bg-blue-600" : "bg-gray-300",
          isCurrentUser && "ring-2 ring-yellow-400",
        )}
      >
        {(isRevealed || isCurrentUser) && selectedCard !== undefined ? (
          <span className="text-2xl font-bold text-white">{selectedCard}</span>
        ) : hasSelected ? (
          <div className="w-12 h-16 bg-white/20 rounded" />
        ) : (
          <span className="text-gray-500 text-4xl">?</span>
        )}
      </div>
      <span className={clsx("text-sm font-medium", isCurrentUser ? "text-yellow-600" : "text-gray-700")}>
        {name}
        {isCurrentUser && " (You)"}
      </span>
    </div>
  )
}
