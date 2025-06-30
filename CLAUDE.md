# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Installation
```bash
bun install
```

### Development
```bash
# Start both frontend and backend dev servers
bun run dev

# Start only backend WebSocket server (port 3001)
bun run dev:server

# Start only frontend Vite server (port 5173)
bun run dev:client
```

### Build & Production
```bash
# Build frontend static files
bun run build

# Start production server (serves both WebSocket and static files)
NODE_ENV=production bun run start
```

### Code Quality
```bash
# Format code with Biome
bun run format

# Run linting checks
bun run lint

# Run all checks (format + lint)
bun run check
```

## Architecture Overview

This is a real-time Planning Poker application built with Bun, React, and WebSockets. The architecture follows a monorepo structure with shared types between client and server.

### Key Design Decisions

1. **No Database**: All state is managed in-memory on the server. Rooms are automatically cleaned up when empty.

2. **Type Safety**: Uses Bun workspaces to share TypeScript types between client and server via the `@planningpoker/server` package.

3. **Real-time Communication**: WebSocket-based with defined message types in `server/src/types.ts`:
   - Client → Server: join, selectCard, revealCards, nextRound, leave
   - Server → Client: joined, roomUpdate, countdownStarted, error

4. **State Management**: 
   - Server: In-memory `RoomManager` class manages rooms and users
   - Client: Jotai atoms for reactive state management

### WebSocket Flow

1. User enters name and room ID → Client sends `join` message
2. Server creates/joins room → Sends `joined` with initial state
3. User selects card → Client sends `selectCard`
4. All users selected or someone clicks reveal → Server sends `countdownStarted`
5. After 3 seconds → Server reveals cards and sends `roomUpdate`
6. Users can change cards even after reveal → Real-time updates via `roomUpdate`
7. Anyone clicks "Next Round" → Server resets and sends fresh `roomUpdate`

### Project Structure

- `/client` - React frontend with Vite
  - `/src/hooks/useWebSocket.ts` - WebSocket connection management
  - `/src/store/atoms.ts` - Jotai state atoms
  - `/src/pages/` - HomePage and RoomPage components
  - `/src/components/` - Card, UserCard, Countdown components

- `/server` - Bun WebSocket server
  - `/src/types.ts` - Shared TypeScript types (exported)
  - `/src/RoomManager.ts` - Room state management
  - `/src/index.ts` - WebSocket server and static file serving

### Development Notes

- Frontend connects to `ws://localhost:3001/ws` in dev, or relative WebSocket URL in production
- Room IDs are 6-character alphanumeric codes generated client-side
- Card values follow Fibonacci sequence: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
- Biome is configured for formatting (2 spaces, double quotes) and linting