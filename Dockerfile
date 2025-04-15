ARG ALPINE_VERSION=3.16

FROM oven/bun:1.0.30 AS builder
WORKDIR /build-stage

# Copy package.json and bun.lock first to leverage Docker layer caching
COPY package.json ./
COPY bun.lock ./

# Install dependencies in production mode
RUN bun install --frozen-lockfile || (echo "Lockfile mismatch detected. Regenerating..." && bun install && bun install --frozen-lockfile)

# Copy the rest of the application code
COPY src ./src
COPY frontend ./frontend

# Build the server
RUN bun build ./src/server.js --outfile=dist/server.mjs --target node && cd frontend && bun run generate

FROM oven/bun:alpine

# Install git
RUN apk add --no-cache git \
    && git --version \
    && git config --global pull.ff only

WORKDIR /usr/src/app

# Copy the built application
COPY --from=builder /build-stage/dist ./dist
COPY --from=builder /build-stage/frontend/.output/public ./frontend/.output/public

# Set the entrypoint
CMD ["bun", "dist/server.mjs"]