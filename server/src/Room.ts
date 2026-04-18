import { DurableObject } from "cloudflare:workers"
import { allUsersSelected, buildRoomStateUpdate, findUserIdByClientId, isValidCard } from "./roomLogic"
import type { ClientToServerMessage, PersistedRoomState, ServerToClientMessage, StoredUser, UserId } from "./types"

interface Attachment {
  userId: UserId
  clientId: string
}

const STATE_KEY = "state"
const COUNTDOWN_MS = 3000
const PING_FRAME = JSON.stringify({ type: "ping" } satisfies ClientToServerMessage)
const PONG_FRAME = JSON.stringify({ type: "pong" } satisfies ServerToClientMessage)

export class Room extends DurableObject<Env> {
  private room: PersistedRoomState = { users: {}, isRevealed: false }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<PersistedRoomState>(STATE_KEY)
      if (stored) this.room = stored
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME))
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message)
    let data: ClientToServerMessage
    try {
      data = JSON.parse(raw) as ClientToServerMessage
    } catch {
      this.sendError(ws, "Invalid message")
      return
    }

    switch (data.type) {
      case "join":
        await this.handleJoin(ws, data)
        return
      case "selectCard":
        await this.handleSelectCard(ws, data.card)
        return
      case "revealCards":
        await this.handleReveal()
        return
      case "nextRound":
        await this.handleNextRound()
        return
      case "leave":
        await this.handleLeave(ws)
        return
      case "ping":
        this.sendTo(ws, { type: "pong" })
        return
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    await this.removeUserForSocket(ws)
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    await this.removeUserForSocket(ws)
  }

  async alarm() {
    if (this.room.isRevealed) return
    if (Object.keys(this.room.users).length === 0) return
    this.room.isRevealed = true
    this.room.countdownStartedAt = undefined
    await this.persist()
    this.broadcast({ type: "roomUpdate", roomState: buildRoomStateUpdate(this.room) })
  }

  // ---------------- handlers ----------------

  private async handleJoin(ws: WebSocket, data: Extract<ClientToServerMessage, { type: "join" }>) {
    const name = data.name.trim()
    if (name.length === 0) {
      this.sendError(ws, "名前を入力してください。")
      return
    }
    if (name.length > 20) {
      this.sendError(ws, "名前は20文字以内で入力してください。")
      return
    }
    if (!data.roomId || data.roomId.length !== 6) {
      this.sendError(ws, "無効なルームIDです。")
      return
    }
    if (!data.clientId) {
      this.sendError(ws, "無効なクライアントIDです。")
      return
    }

    // Reuse existing user if clientId already present (rapid reconnect race before webSocketClose fires).
    let userId = findUserIdByClientId(this.room, data.clientId)
    if (userId) {
      this.room.users[userId].name = name
    } else {
      userId = crypto.randomUUID()
      const user: StoredUser = { id: userId, name, clientId: data.clientId }
      this.room.users[userId] = user
    }

    ws.serializeAttachment({ userId, clientId: data.clientId } satisfies Attachment)
    await this.persist()

    const roomState = buildRoomStateUpdate(this.room)
    this.sendTo(ws, { type: "joined", userId, roomState })
    this.broadcast({ type: "roomUpdate", roomState }, userId)
  }

  private async handleSelectCard(ws: WebSocket, card: unknown) {
    const att = this.getAttachment(ws)
    if (!att) {
      this.sendError(ws, "セッションが無効です。再度ルームに参加してください。")
      return
    }
    const user = this.room.users[att.userId]
    if (!user) {
      this.sendError(ws, "ユーザーが見つかりません。")
      return
    }
    if (card !== null && !isValidCard(card)) {
      this.sendError(ws, "無効なカード値です。")
      return
    }
    user.selectedCard = card === null ? undefined : card
    await this.persist()
    this.broadcast({ type: "roomUpdate", roomState: buildRoomStateUpdate(this.room) })

    if (!this.room.isRevealed && allUsersSelected(this.room) && Object.keys(this.room.users).length > 1) {
      await this.startCountdown()
    }
  }

  private async handleReveal() {
    if (this.room.isRevealed) return
    if (Object.keys(this.room.users).length === 0) return
    await this.startCountdown()
  }

  private async handleNextRound() {
    this.room.isRevealed = false
    this.room.countdownStartedAt = undefined
    for (const user of Object.values(this.room.users)) {
      user.selectedCard = undefined
    }
    await this.ctx.storage.deleteAlarm()
    await this.persist()
    this.broadcast({ type: "roomUpdate", roomState: buildRoomStateUpdate(this.room) })
  }

  private async handleLeave(ws: WebSocket) {
    await this.removeUserForSocket(ws)
    try {
      ws.close(1000, "bye")
    } catch {
      // already closed
    }
  }

  // ---------------- helpers ----------------

  private async startCountdown() {
    this.room.countdownStartedAt = Date.now()
    await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_MS)
    await this.persist()
    this.broadcast({ type: "countdownStarted", timestamp: this.room.countdownStartedAt })
  }

  private async removeUserForSocket(ws: WebSocket) {
    const att = this.getAttachment(ws)
    if (!att) return
    if (!this.room.users[att.userId]) return
    delete this.room.users[att.userId]
    if (Object.keys(this.room.users).length === 0) {
      await this.ctx.storage.deleteAlarm()
      await this.ctx.storage.deleteAll()
      this.room = { users: {}, isRevealed: false }
      return
    }
    await this.persist()
    this.broadcast({ type: "roomUpdate", roomState: buildRoomStateUpdate(this.room) })
  }

  private getAttachment(ws: WebSocket): Attachment | null {
    const raw = ws.deserializeAttachment()
    if (!raw || typeof raw !== "object") return null
    return raw as Attachment
  }

  private broadcast(message: ServerToClientMessage, excludeUserId?: UserId) {
    const payload = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      if (excludeUserId) {
        const att = this.getAttachment(ws)
        if (att?.userId === excludeUserId) continue
      }
      try {
        ws.send(payload)
      } catch {
        // socket is closing; cleanup happens via webSocketClose
      }
    }
  }

  private sendTo(ws: WebSocket, message: ServerToClientMessage) {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // ignore
    }
  }

  private sendError(ws: WebSocket, errMessage: string) {
    this.sendTo(ws, { type: "error", message: errMessage })
  }

  private async persist() {
    await this.ctx.storage.put(STATE_KEY, this.room)
  }
}
