import type { CardValue, RoomStateUpdate, UserId } from "@planningpoker/server/types"
import { atom } from "jotai"

export const roomIdAtom = atom<string | null>(null)
export const userIdAtom = atom<UserId | null>(null)
export const userNameAtom = atom<string>("")
export const roomStateAtom = atom<RoomStateUpdate | null>(null)
export const selectedCardAtom = atom<CardValue | null>(null)
export const isConnectedAtom = atom(false)
export const countdownEndTimeAtom = atom<number | null>(null)
export const wsAtom = atom<WebSocket | null>(null)
