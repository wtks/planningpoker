import { Room } from "./Room"
import { ROOM_ID_PATTERN } from "./roomLogic"

export { Room }

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
      return env.ROOM.get(env.ROOM.idFromName(roomId)).fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
