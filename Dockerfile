# --- Stage 1: Build dashboard ---
FROM node:20-slim AS frontend
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# --- Stage 2: Build Rust server ---
FROM rust:1.83-slim AS backend
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/ ./
RUN cargo build --release

# --- Stage 3: Final ---
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy Rust binary
COPY --from=backend /app/target/release/futureauth-server ./futureauth-server

# Copy built dashboard
COPY --from=frontend /app/dashboard/dist ./dashboard/dist

# Copy migrations
COPY server/migrations/ ./migrations/

ENV PORT=3002
EXPOSE 3002

CMD ["./futureauth-server"]
