# Use Bun base image
FROM oven/bun:1.1.34-alpine as base

# Set working directory
WORKDIR /app

# Copy package.json files for dependency installation
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install client dependencies
WORKDIR /app/client
RUN bun install

# Install server dependencies
WORKDIR /app/server
RUN bun install

# Back to root
WORKDIR /app

# Copy source code
COPY . .

# Build the client
WORKDIR /app/client
RUN bun run build

# Move back to app root and prepare for production
WORKDIR /app
RUN mkdir -p server/dist && cp -r client/dist/* server/dist/

# Production stage
FROM oven/bun:1.1.34-alpine as production

WORKDIR /app

# Copy only production files
COPY --from=base /app/server ./server
COPY --from=base /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Change to server directory and start the application
WORKDIR /app/server
CMD ["bun", "src/index.ts"]