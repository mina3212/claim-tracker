# Stage 1: Build React/Vite frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server (Node.js + Express)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/dist ./dist
RUN mkdir -p /data/uploads /data/stage-images
EXPOSE 3000
CMD ["node", "server/index.mjs"]
