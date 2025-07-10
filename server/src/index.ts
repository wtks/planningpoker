import type { ServerWebSocket } from "bun"
import { RoomManager } from "./RoomManager"
import type { ClientToServerMessage, RoomStateUpdate, ServerToClientMessage, User, UserId } from "./types"

interface WebSocketData {
  userId?: UserId
}

const roomManager = new RoomManager()
const wsConnections = new Map<UserId, ServerWebSocket<WebSocketData>>()
const userRoomMap = new Map<UserId, string>()

function broadcastToRoom(roomId: string, message: ServerToClientMessage, excludeUserId?: UserId) {
  const room = roomManager.getRoom(roomId)
  if (!room) return

  for (const userId of room.users.keys()) {
    if (userId === excludeUserId) continue
    const ws = wsConnections.get(userId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }
}

function getRoomStateUpdate(roomId: string): RoomStateUpdate | null {
  const room = roomManager.getRoom(roomId)
  if (!room) return null

  const users = Array.from(room.users.values()).map((user) => ({
    id: user.id,
    name: user.name,
    hasSelectedCard: user.selectedCard !== undefined,
    selectedCard: room.isRevealed ? user.selectedCard : undefined,
  }))

  const average = room.isRevealed ? roomManager.calculateAverage(room) : undefined

  return {
    users,
    isRevealed: room.isRevealed,
    average,
  }
}

function generateUserId(): UserId {
  return crypto.randomUUID()
}

const server = Bun.serve({
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3001,
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === "/ws") {
      const success = server.upgrade(req)
      if (success) {
        return undefined
      }
    }

    if (process.env.NODE_ENV === "production") {
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname
      const file = Bun.file(`./dist${filePath}`)

      if (await file.exists()) {
        const response = new Response(file)

        // Set appropriate Content-Type headers
        if (filePath.endsWith(".html")) {
          response.headers.set("Content-Type", "text/html")
        } else if (filePath.endsWith(".js")) {
          response.headers.set("Content-Type", "application/javascript")
        } else if (filePath.endsWith(".css")) {
          response.headers.set("Content-Type", "text/css")
        } else if (filePath.endsWith(".svg")) {
          response.headers.set("Content-Type", "image/svg+xml")
        }

        return response
      }

      // For SPA routing, serve index.html for unmatched routes
      const indexFile = Bun.file("./dist/index.html")
      if (await indexFile.exists()) {
        const response = new Response(indexFile)
        response.headers.set("Content-Type", "text/html")
        return response
      }

      return new Response("Not found", { status: 404 })
    }

    return new Response("WebSocket server running on ws://localhost:3001/ws", {
      headers: { "Content-Type": "text/plain" },
    })
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      console.log("WebSocket connection opened")
    },
    message(ws: ServerWebSocket<WebSocketData>, message) {
      try {
        const data = JSON.parse(message.toString()) as ClientToServerMessage
        let userId = ws.data?.userId as UserId | undefined

        switch (data.type) {
          case "join": {
            // Validate input
            if (!data.name || data.name.trim().length === 0) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "名前を入力してください。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            if (data.name.trim().length > 20) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "名前は20文字以内で入力してください。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            if (!data.roomId || data.roomId.length !== 6) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "無効なルームIDです。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            userId = generateUserId()
            ws.data = { userId }
            wsConnections.set(userId, ws)
            userRoomMap.set(userId, data.roomId)

            const user: User = {
              id: userId,
              name: data.name.trim(),
            }
            roomManager.addUserToRoom(data.roomId, user)

            const roomState = getRoomStateUpdate(data.roomId)
            if (roomState) {
              const joinResponse: ServerToClientMessage = {
                type: "joined",
                userId,
                roomState,
              }
              ws.send(JSON.stringify(joinResponse))

              const updateMessage: ServerToClientMessage = {
                type: "roomUpdate",
                roomState,
              }
              broadcastToRoom(data.roomId, updateMessage, userId)
            }
            break
          }

          case "selectCard": {
            if (!userId) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "セッションが無効です。再度ルームに参加してください。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            const roomId = userRoomMap.get(userId)
            if (!roomId) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "ルームが見つかりません。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            const room = roomManager.getRoom(roomId)
            if (!room) return

            const user = room.users.get(userId)
            if (!user) return

            // Validate card value
            const validCards = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
            if (data.card !== null && !validCards.includes(data.card)) {
              const errorMsg: ServerToClientMessage = {
                type: "error",
                message: "無効なカード値です。",
              }
              ws.send(JSON.stringify(errorMsg))
              return
            }

            user.selectedCard = data.card

            const roomState = getRoomStateUpdate(roomId)
            if (roomState) {
              const updateMessage: ServerToClientMessage = {
                type: "roomUpdate",
                roomState,
              }
              broadcastToRoom(roomId, updateMessage)
            }

            if (!room.isRevealed && roomManager.checkAllUsersSelected(room) && room.users.size > 1) {
              room.countdownStartedAt = Date.now()
              const countdownMessage: ServerToClientMessage = {
                type: "countdownStarted",
                timestamp: room.countdownStartedAt,
              }
              broadcastToRoom(roomId, countdownMessage)

              setTimeout(() => {
                room.isRevealed = true
                const revealedState = getRoomStateUpdate(roomId)
                if (revealedState) {
                  const revealMessage: ServerToClientMessage = {
                    type: "roomUpdate",
                    roomState: revealedState,
                  }
                  broadcastToRoom(roomId, revealMessage)
                }
              }, 3000)
            }
            break
          }

          case "revealCards": {
            if (!userId) return

            const roomId = userRoomMap.get(userId)
            if (!roomId) return

            const room = roomManager.getRoom(roomId)
            if (!room || room.isRevealed) return

            room.countdownStartedAt = Date.now()
            const countdownMessage: ServerToClientMessage = {
              type: "countdownStarted",
              timestamp: room.countdownStartedAt,
            }
            broadcastToRoom(roomId, countdownMessage)

            setTimeout(() => {
              room.isRevealed = true
              const roomState = getRoomStateUpdate(roomId)
              if (roomState) {
                const updateMessage: ServerToClientMessage = {
                  type: "roomUpdate",
                  roomState,
                }
                broadcastToRoom(roomId, updateMessage)
              }
            }, 3000)
            break
          }

          case "nextRound": {
            if (!userId) return

            const roomId = userRoomMap.get(userId)
            if (!roomId) return

            roomManager.resetRoom(roomId)

            const roomState = getRoomStateUpdate(roomId)
            if (roomState) {
              const updateMessage: ServerToClientMessage = {
                type: "roomUpdate",
                roomState,
              }
              broadcastToRoom(roomId, updateMessage)
            }
            break
          }

          case "leave": {
            if (userId) {
              const roomId = userRoomMap.get(userId)
              if (roomId) {
                roomManager.removeUserFromRoom(roomId, userId)
                userRoomMap.delete(userId)
                wsConnections.delete(userId)

                const roomState = getRoomStateUpdate(roomId)
                if (roomState) {
                  const updateMessage: ServerToClientMessage = {
                    type: "roomUpdate",
                    roomState,
                  }
                  broadcastToRoom(roomId, updateMessage)
                }
              }
            }
            ws.close()
            break
          }
        }
      } catch (error) {
        console.error("Error handling message:", error)
        const errorMessage: ServerToClientMessage = {
          type: "error",
          message: "Failed to process message",
        }
        ws.send(JSON.stringify(errorMessage))
      }
    },
    close(ws: ServerWebSocket<WebSocketData>) {
      const userId = ws.data?.userId as UserId | undefined
      if (userId) {
        const roomId = userRoomMap.get(userId)
        if (roomId) {
          roomManager.removeUserFromRoom(roomId, userId)
          userRoomMap.delete(userId)
          wsConnections.delete(userId)

          const roomState = getRoomStateUpdate(roomId)
          if (roomState) {
            const updateMessage: ServerToClientMessage = {
              type: "roomUpdate",
              roomState,
            }
            broadcastToRoom(roomId, updateMessage)
          }
        }
      }
    },
  },
})

console.log(`WebSocket server listening on ws://localhost:${server.port}/ws`)

export type * from "./types"
