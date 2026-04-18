import type { ClientToServerMessage, ServerToClientMessage } from "@planningpoker/server/types"
import { useAtom, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import {
  countdownEndTimeAtom,
  errorMessageAtom,
  isConnectedAtom,
  roomStateAtom,
  selectedCardAtom,
  userIdAtom,
  wsAtom,
} from "../store/atoms"

export function useWebSocket(roomId: string | null) {
  const [ws, setWs] = useAtom(wsAtom)
  const setIsConnected = useSetAtom(isConnectedAtom)
  const setUserId = useSetAtom(userIdAtom)
  const setRoomState = useSetAtom(roomStateAtom)
  const setSelectedCard = useSetAtom(selectedCardAtom)
  const setCountdownEndTime = useSetAtom(countdownEndTimeAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const userIdRef = useRef<string | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const isManuallyClosedRef = useRef(false)
  const pingIntervalRef = useRef<NodeJS.Timeout>()
  const messageQueueRef = useRef<ClientToServerMessage[]>([])
  const roomIdRef = useRef<string | null>(roomId)
  roomIdRef.current = roomId

  const connectWebSocket = () => {
    if (isManuallyClosedRef.current) return
    const currentRoomId = roomIdRef.current
    if (!currentRoomId) return

    const query = `?roomId=${encodeURIComponent(currentRoomId)}`
    const wsUrl = import.meta.env.DEV
      ? `ws://localhost:5173/ws${query}`
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws${query}`

    const websocket = new WebSocket(wsUrl)
    websocket.onopen = () => {
      console.log("WebSocket connected")
      setWs(websocket)
      setIsConnected(true)
      reconnectAttemptsRef.current = 0
      setErrorMessage(null)

      // Send any queued messages
      while (messageQueueRef.current.length > 0) {
        const message = messageQueueRef.current.shift()
        if (message) {
          try {
            websocket.send(JSON.stringify(message))
          } catch (error) {
            console.error("Failed to send queued message:", error)
            messageQueueRef.current.unshift(message) // Re-queue on failure
            setErrorMessage("メッセージの送信に失敗しました。")
            break // Stop processing queue if a message fails
          }
        }
      }

      // Start sending pings
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      pingIntervalRef.current = setInterval(() => {
        sendMessage({ type: "ping" })
      }, 30000)
    }

    websocket.onmessage = (event) => {
      try {
        const message: ServerToClientMessage = JSON.parse(event.data)

        switch (message.type) {
          case "joined":
            userIdRef.current = message.userId
            setUserId(message.userId)
            setRoomState(message.roomState)
            // If reconnecting, restore selected card state
            if (reconnectAttemptsRef.current > 0 && message.roomState.users) {
              const currentUser = message.roomState.users.find((u) => u.id === message.userId)
              if (currentUser?.selectedCard) {
                setSelectedCard(currentUser.selectedCard)
              }
            }
            break

          case "roomUpdate":
            setRoomState(message.roomState)
            // Reset selected card when starting a new round
            if (!message.roomState.isRevealed && userIdRef.current) {
              // Check if the current user's card has been reset on the server
              const currentUser = message.roomState.users.find((u) => u.id === userIdRef.current)
              if (currentUser && !currentUser.hasSelectedCard) {
                setSelectedCard(null)
              }
              setCountdownEndTime(null)
            }
            break

          case "countdownStarted":
            setCountdownEndTime(message.timestamp + 3000)
            break

          case "error":
            console.error("Server error:", message.message)
            setErrorMessage(message.message)
            break

          case "pong":
            // console.log("Received pong")
            break
        }
      } catch (error) {
        console.error("Failed to parse message:", error)
      }
    }

    websocket.onclose = () => {
      setIsConnected(false)
      setWs(null)

      if (!isManuallyClosedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        const backoffDelay = Math.min(1000 * 2 ** (reconnectAttemptsRef.current - 1), 30000)

        console.log(
          `WebSocket disconnected. Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`,
        )

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, backoffDelay)
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error("Max reconnection attempts reached. Please refresh the page.")
        setErrorMessage("接続の再試行回数が上限に達しました。ページを更新してください。")
      }
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      if (reconnectAttemptsRef.current === 0) {
        setErrorMessage("接続エラーが発生しました。再接続を試みています...")
      }
    }

    return websocket
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: Setter functions from atoms don't change
  useEffect(() => {
    if (!roomId) return

    isManuallyClosedRef.current = false
    // Only create WebSocket if we don't have one
    if (!ws) {
      connectWebSocket()
    }

    return () => {
      isManuallyClosedRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (ws) {
        ws.close()
      }
    }
  }, [roomId])

  const sendMessage = (message: ClientToServerMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message))
      } catch (error) {
        console.error("Failed to send message:", error)
        setErrorMessage("メッセージの送信に失敗しました。")
      }
    } else {
      // Don't show error for ping, just drop it if not connected
      if (message.type === "ping") {
        return
      }

      console.warn("WebSocket is not connected, queuing message.")
      messageQueueRef.current.push(message)

      // If the connection is closed or not yet initiated, try to connect
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        connectWebSocket()
      }

      if (!isManuallyClosedRef.current && reconnectAttemptsRef.current === 0) {
        setErrorMessage("サーバーに接続されていません。接続を確認しています...")
      }
    }
  }

  return { sendMessage, isConnected: ws?.readyState === WebSocket.OPEN }
}
