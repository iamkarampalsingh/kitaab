# Kitaab — Coolify / VPS image. Listens on 0.0.0.0:3000.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
ENV VITE_AUTH_ENABLED=true
ENV VITE_SOCIAL_LOGIN=false
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV VITE_AUTH_ENABLED=true
ENV VITE_SOCIAL_LOGIN=false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations

EXPOSE 3000
CMD ["node", "scripts/docker-entrypoint.mjs"]
