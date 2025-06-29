import type { Room, RoomId, User, UserId } from "./types"

export class RoomManager {
  private rooms = new Map<RoomId, Room>()

  createRoom(roomId: RoomId): Room {
    const room: Room = {
      id: roomId,
      users: new Map(),
      isRevealed: false,
    }
    this.rooms.set(roomId, room)
    return room
  }

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId)
  }

  getOrCreateRoom(roomId: RoomId): Room {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = this.createRoom(roomId)
    }
    return room
  }

  addUserToRoom(roomId: RoomId, user: User): void {
    const room = this.getOrCreateRoom(roomId)
    room.users.set(user.id, user)
  }

  removeUserFromRoom(roomId: RoomId, userId: UserId): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.users.delete(userId)

    if (room.users.size === 0) {
      this.rooms.delete(roomId)
    }
  }

  resetRoom(roomId: RoomId): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.isRevealed = false
    room.countdownStartedAt = undefined
    for (const user of room.users.values()) {
      user.selectedCard = undefined
    }
  }

  checkAllUsersSelected(room: Room): boolean {
    if (room.users.size === 0) return false
    for (const user of room.users.values()) {
      if (user.selectedCard === undefined) return false
    }
    return true
  }

  calculateAverage(room: Room): number | undefined {
    const selectedCards = Array.from(room.users.values())
      .map((user) => user.selectedCard)
      .filter((card): card is number => card !== undefined)

    if (selectedCards.length === 0) return undefined

    const sum = selectedCards.reduce((acc, card) => acc + card, 0)
    return sum / selectedCards.length
  }
}
