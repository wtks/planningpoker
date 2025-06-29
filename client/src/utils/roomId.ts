export function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function isValidRoomId(roomId: string): boolean {
  return /^[A-Z0-9]{6}$/.test(roomId)
}
