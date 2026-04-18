const CLIENT_ID_KEY = "planningpoker_clientId"

export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
    return id
  } catch (error) {
    console.warn("Failed to access localStorage for clientId:", error)
    return crypto.randomUUID()
  }
}
