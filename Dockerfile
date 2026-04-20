FROM node:20-alpine AS build

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
ARG VITE_LIFF_ID
ENV VITE_LIFF_ID=$VITE_LIFF_ID
RUN cd frontend && npm run build

# Generate Prisma client & build backend
RUN cd backend && npx prisma generate && npm run build

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist/
COPY --from=build /app/backend/prisma ./backend/prisma/
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma/
COPY --from=build /app/backend/node_modules/@prisma ./backend/node_modules/@prisma/
COPY --from=build /app/frontend/dist ./frontend/dist/

WORKDIR /app/backend

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && NODE_ENV=production node dist/server.js"]
