import type { CardValue, ClientToServerMessage, PersistedRoomState, RoomStateUpdate, UserId } from "./types"

export const VALID_CARDS: readonly CardValue[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
export const ROOM_ID_PATTERN = /^[A-Za-z0-9]{6}$/
export const MAX_NAME_LENGTH = 20

export function isValidCard(value: unknown): value is CardValue {
  return typeof value === "number" && (VALID_CARDS as readonly number[]).includes(value)
}

type JoinPayload = Extract<ClientToServerMessage, { type: "join" }>

export function validateJoinPayload(data: JoinPayload): { name: string } | { error: string } {
  const name = data.name.trim()
  if (name.length === 0) return { error: "名前を入力してください。" }
  if (name.length > MAX_NAME_LENGTH) return { error: `名前は${MAX_NAME_LENGTH}文字以内で入力してください。` }
  if (!data.roomId || !ROOM_ID_PATTERN.test(data.roomId)) return { error: "無効なルームIDです。" }
  if (!data.clientId) return { error: "無効なクライアントIDです。" }
  return { name }
}

export function allUsersSelected(state: PersistedRoomState): boolean {
  const users = Object.values(state.users)
  return users.length > 0 && users.every((u) => u.selectedCard !== undefined)
}

export function calculateAverage(state: PersistedRoomState): number | undefined {
  const cards = Object.values(state.users)
    .map((u) => u.selectedCard)
    .filter((c): c is CardValue => c !== undefined)
  if (cards.length === 0) return undefined
  return cards.reduce((a, b) => a + b, 0) / cards.length
}

export function buildRoomStateUpdate(state: PersistedRoomState): RoomStateUpdate {
  return {
    users: Object.values(state.users).map((user) => ({
      id: user.id,
      name: user.name,
      hasSelectedCard: user.selectedCard !== undefined,
      selectedCard: state.isRevealed ? user.selectedCard : undefined,
    })),
    isRevealed: state.isRevealed,
    average: state.isRevealed ? calculateAverage(state) : undefined,
  }
}

export function findUserIdByClientId(state: PersistedRoomState, clientId: string): UserId | undefined {
  for (const user of Object.values(state.users)) {
    if (user.clientId === clientId) return user.id
  }
  return undefined
}
