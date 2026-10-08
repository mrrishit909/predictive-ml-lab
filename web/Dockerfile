# Web image: build the Vite/React static bundle with Node, serve it with nginx.
# Build context is the repo root (see docker-compose.yml), so paths below are
# rooted at `web/`.
FROM node:22-slim AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q --spider http://localhost/ || exit 1
