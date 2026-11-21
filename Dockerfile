FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Seed JSON files are copied into the persistent volume only when it is empty.
RUN mkdir -p /app/seed /app/data && cp *.json /app/seed/ 2>/dev/null || true

ENV DATA_DIR=/app/data
ENV OAUTH_PORT=3000
EXPOSE 3000

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
