import type { CardValue, PersistedRoomState, RoomStateUpdate } from "./types"

export const VALID_CARDS: readonly CardValue[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

export function isValidCard(value: unknown): value is CardValue {
  return typeof value === "number" && (VALID_CARDS as readonly number[]).includes(value)
}

export function allUsersSelected(state: PersistedRoomState): boolean {
  const users = Object.values(state.users)
  if (users.length === 0) return false
  return users.every((u) => u.selectedCard !== undefined)
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

export function findUserIdByClientId(state: PersistedRoomState, clientId: string): string | undefined {
  for (const user of Object.values(state.users)) {
    if (user.clientId === clientId) return user.id
  }
  return undefined
}
