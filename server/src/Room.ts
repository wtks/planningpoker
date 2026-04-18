import { DurableObject } from "cloudflare:workers"
import {
  allUsersSelected,
  buildRoomStateUpdate,
  findUserIdByClientId,
  isValidCard,
  validateJoinPayload,
} from "./roomLogic"
import type { ClientToServerMessage, PersistedRoomState, ServerToClientMessage, UserId } from "./types"

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
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message)
    let data: ClientToServerMessage
    try {
      data = JSON.parse(raw) as ClientToServerMessage
    } catch {
      return this.sendError(ws, "Invalid message")
    }

    switch (data.type) {
      case "join":
        return this.handleJoin(ws, data)
      case "selectCard":
        return this.handleSelectCard(ws, data.card)
      case "revealCards":
        return this.handleReveal()
      case "nextRound":
        return this.handleNextRound()
      case "leave":
        return this.handleLeave(ws)
      case "ping":
        // Normally handled by setWebSocketAutoResponse without waking the DO; safety net.
        return this.sendTo(ws, { type: "pong" })
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.removeUserForSocket(ws)
  }

  async webSocketError(ws: WebSocket) {
    await this.removeUserForSocket(ws)
  }

  async alarm() {
    if (this.room.isRevealed || this.userCount === 0) return
    this.room.isRevealed = true
    this.room.countdownStartedAt = undefined
    await this.persist()
    this.broadcastRoomState()
  }

  // ---------------- handlers ----------------

  private async handleJoin(ws: WebSocket, data: Extract<ClientToServerMessage, { type: "join" }>) {
    const result = validateJoinPayload(data)
    if ("error" in result) return this.sendError(ws, result.error)

    // Reuse existing user if clientId already present (rapid reconnect race before webSocketClose fires).
    let userId = findUserIdByClientId(this.room, data.clientId)
    if (userId) {
      this.room.users[userId].name = result.name
    } else {
      userId = crypto.randomUUID()
      this.room.users[userId] = { id: userId, name: result.name, clientId: data.clientId }
    }

    ws.serializeAttachment({ userId, clientId: data.clientId } satisfies Attachment)
    await this.persist()

    const roomState = buildRoomStateUpdate(this.room)
    this.sendTo(ws, { type: "joined", userId, roomState })
    this.broadcast({ type: "roomUpdate", roomState }, userId)
  }

  private async handleSelectCard(ws: WebSocket, card: unknown) {
    const att = this.getAttachment(ws)
    if (!att) return this.sendError(ws, "セッションが無効です。再度ルームに参加してください。")

    const user = this.room.users[att.userId]
    if (!user) return this.sendError(ws, "ユーザーが見つかりません。")

    if (card !== null && !isValidCard(card)) return this.sendError(ws, "無効なカード値です。")

    user.selectedCard = card === null ? undefined : card
    await this.persist()
    this.broadcastRoomState()

    if (!this.room.isRevealed && this.userCount > 1 && allUsersSelected(this.room)) {
      await this.startCountdown()
    }
  }

  private async handleReveal() {
    if (this.room.isRevealed || this.userCount === 0) return
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
    this.broadcastRoomState()
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

  private get userCount(): number {
    return Object.keys(this.room.users).length
  }

  private async startCountdown() {
    this.room.countdownStartedAt = Date.now()
    await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_MS)
    await this.persist()
    this.broadcast({ type: "countdownStarted", timestamp: this.room.countdownStartedAt })
  }

  private async removeUserForSocket(ws: WebSocket) {
    const att = this.getAttachment(ws)
    if (!att || !this.room.users[att.userId]) return
    delete this.room.users[att.userId]

    if (this.userCount === 0) {
      await this.ctx.storage.deleteAlarm()
      await this.ctx.storage.deleteAll()
      this.room = { users: {}, isRevealed: false }
      return
    }
    await this.persist()
    this.broadcastRoomState()
  }

  private getAttachment(ws: WebSocket): Attachment | null {
    const raw = ws.deserializeAttachment()
    if (!raw || typeof raw !== "object") return null
    return raw as Attachment
  }

  private broadcastRoomState() {
    this.broadcast({ type: "roomUpdate", roomState: buildRoomStateUpdate(this.room) })
  }

  private broadcast(message: ServerToClientMessage, excludeUserId?: UserId) {
    const payload = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      if (excludeUserId && this.getAttachment(ws)?.userId === excludeUserId) continue
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
