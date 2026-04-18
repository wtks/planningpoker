import { Room } from "./Room"

export { Room }

const ROOM_ID_PATTERN = /^[A-Za-z0-9]{6}$/

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("roomId")
      if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
        return new Response("Invalid roomId", { status: 400 })
      }
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 })
      }
      const id = env.ROOM.idFromName(roomId)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
