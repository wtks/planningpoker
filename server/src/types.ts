export type RoomId = string
export type UserId = string
export type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89

export interface User {
  id: UserId
  name: string
  selectedCard?: CardValue
}

export interface Room {
  id: RoomId
  users: Map<UserId, User>
  isRevealed: boolean
  countdownStartedAt?: number
}

export type ClientToServerMessage =
  | {
      type: "join"
      name: string
      roomId: RoomId
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
