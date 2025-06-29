import type { CardValue } from "@planningpoker/server/types"
import { clsx } from "../utils/clsx"

interface CardProps {
  value: CardValue
  isSelected?: boolean
  isRevealed?: boolean
  onClick?: () => void
  disabled?: boolean
}

export function Card({ value, isSelected, isRevealed, onClick, disabled }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "relative w-16 h-24 rounded-lg font-bold text-xl transition-all transform hover:scale-105",
        "flex items-center justify-center cursor-pointer select-none",
        isSelected && "ring-4 ring-blue-500 scale-105",
        isRevealed ? "bg-white text-gray-900 shadow-lg" : "bg-blue-600 text-white shadow-md hover:bg-blue-700",
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
      )}
    >
      {value}
    </button>
  )
}
