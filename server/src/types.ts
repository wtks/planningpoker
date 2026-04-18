export type RoomId = string
export type UserId = string
export type ClientId = string
export type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89

export interface User {
  id: UserId
  name: string
  selectedCard?: CardValue
}

export interface StoredUser extends User {
  clientId: ClientId
}

export interface PersistedRoomState {
  users: Record<UserId, StoredUser>
  isRevealed: boolean
  countdownStartedAt?: number
}

export type ClientToServerMessage =
  | {
      type: "join"
      name: string
      roomId: RoomId
      clientId: ClientId
    }
  | {
      type: "selectCard"
      card: CardValue
    }
  | {
      type: "revealCards"
    }
  | {
      type: "nextRound"
    }
  | {
      type: "leave"
    }
  | {
      type: "ping"
    }

export type ServerToClientMessage =
  | {
      type: "joined"
      userId: UserId
      roomState: RoomStateUpdate
    }
  | {
      type: "roomUpdate"
      roomState: RoomStateUpdate
    }
  | {
      type: "countdownStarted"
      timestamp: number
    }
  | {
      type: "error"
      message: string
    }
  | {
      type: "pong"
    }

export interface RoomStateUpdate {
  users: Array<{
    id: UserId
    name: string
    hasSelectedCard: boolean
    selectedCard?: CardValue
  }>
  isRevealed: boolean
  average?: number
}
