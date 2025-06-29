import type { ClientToServerMessage, ServerToClientMessage } from "@planningpoker/server/types"
import { useAtom, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import {
  countdownEndTimeAtom,
  isConnectedAtom,
  roomStateAtom,
  selectedCardAtom,
  userIdAtom,
  wsAtom,
} from "../store/atoms"

export function useWebSocket() {
  const [ws, setWs] = useAtom(wsAtom)
  const setIsConnected = useSetAtom(isConnectedAtom)
  const setUserId = useSetAtom(userIdAtom)
  const setRoomState = useSetAtom(roomStateAtom)
  const setSelectedCard = useSetAtom(selectedCardAtom)
  const setCountdownEndTime = useSetAtom(countdownEndTimeAtom)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Only create WebSocket if we don't have one
    if (!ws) {
      const wsUrl = import.meta.env.DEV
        ? "ws://localhost:3001/ws"
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
      
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        setWs(websocket)
        setIsConnected(true)
      }

      websocket.onmessage = (event) => {
        try {
          const message: ServerToClientMessage = JSON.parse(event.data)

          switch (message.type) {
            case "joined":
              setUserId(message.userId)
              setRoomState(message.roomState)
              break

            case "roomUpdate":
              setRoomState(message.roomState)
              if (!message.roomState.isRevealed) {
                setSelectedCard(null)
                setCountdownEndTime(null)
              }
              break

            case "countdownStarted":
              setCountdownEndTime(message.timestamp + 3000)
              break

            case "error":
              console.error("Server error:", message.message)
              break
          }
        } catch (error) {
          console.error("Failed to parse message:", error)
        }
      }

      websocket.onclose = () => {
        setIsConnected(false)
        setWs(null)
        reconnectTimeoutRef.current = setTimeout(() => {
          window.location.reload()
        }, 3000)
      }

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const sendMessage = (message: ClientToServerMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  return { sendMessage, isConnected: ws?.readyState === WebSocket.OPEN }
}