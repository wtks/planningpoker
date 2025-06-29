import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { countdownEndTimeAtom } from "../store/atoms"

export function Countdown() {
  const countdownEndTime = useAtomValue(countdownEndTimeAtom)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!countdownEndTime) {
      setTimeLeft(0)
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((countdownEndTime - now) / 1000))
      setTimeLeft(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)

    return () => clearInterval(interval)
  }, [countdownEndTime])

  if (!countdownEndTime || timeLeft === 0) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-12 shadow-2xl">
        <div className="text-8xl font-bold text-blue-600 animate-pulse text-center">{timeLeft}</div>
        <p className="text-xl text-gray-600 mt-4 text-center">Revealing cards...</p>
      </div>
    </div>
  )
}
