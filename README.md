# Planning Poker

A real-time planning poker application for agile teams to estimate story points collaboratively.

## Features

- Real-time synchronization using WebSockets
- No database required - all state managed in memory
- Simple room creation with shareable codes
- Fibonacci sequence cards (0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89)
- Automatic card reveal with countdown
- Live updates when participants change their votes

## Tech Stack

- **Runtime:** Bun
- **Backend:** Bun WebSocket Server
- **Frontend:** React + Vite + TypeScript
- **State Management:** Jotai
- **Styling:** Tailwind CSS
- **Code Quality:** Biome

## Development

1. Install dependencies:
```bash
bun install
```

2. Start development servers:
```bash
bun run dev
```

This will start:
- Backend WebSocket server on http://localhost:3001
- Frontend dev server on http://localhost:5173

## Production

1. Build the frontend:
```bash
bun run build
```

2. Start the production server:
```bash
NODE_ENV=production bun run start
```

The server will serve both the WebSocket endpoint and the static frontend files.

## Project Structure

```
/
├── client/          # Frontend React application
├── server/          # Backend WebSocket server
├── Dockerfile       # Docker configuration for deployment
├── railway.toml     # Railway deployment configuration
└── package.json     # Workspace configuration
```

## Deployment

### Railway Deployment

1. Connect your GitHub repository to Railway
2. The application will automatically deploy using the included `Dockerfile`
3. Railway will detect the `railway.toml` configuration
4. Set environment variables if needed:
   - `NODE_ENV=production` (automatically set)
   - `PORT` (automatically set by Railway)

### Manual Docker Deployment

```bash
# Build the Docker image
docker build -t planningpoker .

# Run the container
docker run -p 3000:3000 -e NODE_ENV=production planningpoker
```

## How It Works

1. Users create or join rooms using 6-character codes
2. Each participant selects a card to vote
3. When all have voted (or someone clicks "Reveal"), a 3-second countdown begins
4. Cards are revealed simultaneously showing the average
5. Participants can update votes in real-time even after reveal
6. "Next Round" resets all votes for a new estimation