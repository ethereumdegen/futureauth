# --- Stage 1: Build dashboard ---
FROM node:20-slim AS frontend
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# --- Stage 2: Final ---
FROM node:20-slim
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY src/ src/
COPY migrations/ migrations/
COPY migrate.js ./

# Copy built dashboard
COPY --from=frontend /app/dashboard/dist ./dashboard/dist

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD node src/index.js
