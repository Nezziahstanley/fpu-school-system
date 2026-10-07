# ============================================================
# FPU School Management System — Dockerfile
# ------------------------------------------------------------
# Multi-stage build: install deps in a builder stage, copy
# only what's needed into a slim runtime image.
# ============================================================

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create uploads dir (mounted as volume in compose)
RUN mkdir -p /app/public/uploads

EXPOSE 3000

# Run migrations on boot, then start the server
CMD ["sh", "-c", "node db/migrate.js && node server.js"]