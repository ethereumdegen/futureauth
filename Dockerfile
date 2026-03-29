# --- Stage 1: Build frontend ---
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Rust backend ---
FROM rust:1.85-slim AS backend
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/ ./
RUN cargo build --release

# --- Stage 3: Final ---
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy Rust binary
COPY --from=backend /app/target/release/futureauth-server ./futureauth-server

# Copy built frontend
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Copy migrations
COPY backend/migrations/ ./migrations/

ENV PORT=3002
EXPOSE 3002

CMD ["./futureauth-server"]
