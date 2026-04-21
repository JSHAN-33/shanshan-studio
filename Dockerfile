FROM node:20-alpine AS build

RUN apk add --no-cache openssl

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Install frontend dependencies
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# Copy all source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build frontend
ENV VITE_LIFF_ID=2009682315-3j8aqE0E
RUN cd frontend && npm run build

# Generate Prisma client & build backend
RUN cd backend && npx prisma generate && npm run build

# --- Production image ---
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy Prisma schema & generate client in production image
COPY --from=build /app/backend/prisma ./backend/prisma/
RUN cd backend && npx prisma generate

COPY --from=build /app/backend/dist ./backend/dist/
COPY --from=build /app/frontend/dist ./frontend/dist/

WORKDIR /app/backend

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && NODE_ENV=production node dist/server.js"]
