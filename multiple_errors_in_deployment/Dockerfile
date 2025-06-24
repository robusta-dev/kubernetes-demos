
FROM node:alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm ci --only=production

ENV NODE_ENV=production

# Default arguments (can be overridden)
ENV SHOW_LOGIN_ERRORS=true
ENV LOGIN_ERRORS_FREQUENCY=100
ENV SHOW_DB_ERRORS=true
ENV DB_ERRORS_FREQUENCY=100

CMD ["sh", "-c", "node dist/main.js "]
