# Planning Poker

A real-time planning poker application for agile teams to estimate story points collaboratively. Runs entirely on Cloudflare Workers with one Durable Object per room and the WebSocket Hibernation API.

## Features

- Real-time synchronization using WebSockets (hibernation-safe)
- No database — ephemeral per-room state lives in Durable Object storage
- 6-character shareable room codes
- Fibonacci sequence cards (1, 2, 3, 5, 8, 13, 21, 34, 55, 89)
- Automatic 3-second countdown before reveal (driven by Durable Object alarm)
- Live updates when participants change their votes
- Stable identity across reconnects via `clientId` stored in `localStorage`

## Tech Stack

- **Runtime:** Cloudflare Workers (Wrangler + Bun)
- **Backend:** Durable Objects with WebSocket Hibernation API
- **Frontend:** React 19 + Vite 8 + TypeScript 6
- **State Management:** Jotai
- **Styling:** Tailwind CSS v4 (CSS-first config)
- **Code Quality:** Biome 2

## Development

1. Install dependencies:
```bash
bun install
```

2. Start development servers:
```bash
bun run dev
```

This runs Vite and Wrangler concurrently:
- **Vite** dev server on http://localhost:5173 (hot reload, proxies `/ws` to Wrangler)
- **Wrangler** Worker + Durable Object on http://localhost:8787

Run only one side:
```bash
bun run dev:client   # Vite only
bun run dev:server   # Wrangler only
```

## Production

Build the client and deploy the Worker:

```bash
bun run deploy
```

This runs `bun run build` (Vite static assets → `client/dist`) followed by `wrangler deploy`. The Worker serves the built assets via the Workers Assets binding and upgrades `/ws` to the `Room` Durable Object.

First-time deploy requires:
1. A Cloudflare account — `bunx wrangler login`
2. Durable Objects namespace is provisioned automatically on the first deploy from the `[[migrations]]` block in `server/wrangler.jsonc`

## Project Structure

```
/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── hooks/useWebSocket.ts   # WS connection + reconnect
│       ├── utils/clientId.ts       # localStorage-backed stable client ID
│       ├── store/atoms.ts          # Jotai state
│       ├── pages/                  # HomePage, RoomPage
│       └── components/             # Card, UserCard, Countdown, ...
├── server/                  # Cloudflare Worker + Durable Object
│   ├── src/
│   │   ├── index.ts               # Worker entrypoint (router)
│   │   ├── Room.ts                # Durable Object (hibernation + alarm)
│   │   ├── roomLogic.ts           # Pure helpers & validators
│   │   └── types.ts               # Shared types (re-exported as @planningpoker/server/types)
│   └── wrangler.jsonc             # Worker config, DO binding, Assets binding
└── package.json                    # Workspace root
```

## How It Works

1. Users enter a 6-character code to create or join a room
2. Client WebSocket connects to `/ws?roomId=XXXXXX`; the Worker routes to a Durable Object keyed by `roomId`
3. The DO accepts the socket via `ctx.acceptWebSocket()` — while idle, the JS instance can hibernate and the socket stays open
4. Each participant sends `selectCard` messages; everyone receives `roomUpdate` broadcasts
5. When all participants have voted (or someone clicks "Reveal"), the DO schedules a 3-second alarm (`ctx.storage.setAlarm`) — the alarm survives hibernation
6. The alarm fires, flips `isRevealed = true`, and broadcasts the final `roomUpdate` with the average
7. "Next Round" clears selections and cancels any pending alarm
8. Reconnects reuse the `clientId` from `localStorage` to re-attach to the same participant when the race window allows

See [CLAUDE.md](CLAUDE.md) for architecture notes aimed at maintainers.
