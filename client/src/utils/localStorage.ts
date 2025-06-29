const USER_NAME_KEY = "planningpoker_username"

export function saveUserName(name: string): void {
  try {
    localStorage.setItem(USER_NAME_KEY, name)
  } catch (error) {
    console.warn("Failed to save username to localStorage:", error)
  }
}

export function loadUserName(): string | null {
  try {
    return localStorage.getItem(USER_NAME_KEY)
  } catch (error) {
    console.warn("Failed to load username from localStorage:", error)
    return null
  }
}