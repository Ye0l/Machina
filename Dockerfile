# Build stage: needs devDependencies (vite, svelte, tsc), which the runtime image drops.
FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable

# Dependencies first, so a source-only change reuses the install layer.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Only what the build actually reads, verified by building from exactly this set.
#
# `web/` is deliberately absent: the shipped frontend is the Svelte client in `app/`, and
# the legacy SolidJS client is dev-only (`legacy:build`). The root tailwind/babel/postcss
# configs go with it -- `app/` carries its own.
COPY tsconfig.json srv.tsconfig.json ./
COPY common/ ./common/
COPY srv/ ./srv/
COPY app/ ./app/

# `build` emits the client into dist/, `build:server` compiles srv/ and common/ in place.
RUN pnpm run build:all

ARG SHA=unknown
RUN echo "${SHA}" > /app/version.txt

# Runtime stage.
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    DB_NAME=agnai \
    ASSET_FOLDER=/app/dist/assets

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# The server runs the compiled .js emitted beside the sources, so `common/` and `srv/` are
# copied from the build stage rather than from the context.
COPY --from=build /app/common/ ./common/
COPY --from=build /app/srv/ ./srv/
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/version.txt ./version.txt
COPY db/ ./db/

VOLUME [ "/app/db", "/app/assets", "/app/dist/assets", "/app/extras" ]

EXPOSE 3001

# `node srv/start.js` directly rather than through pnpm, so signals reach the server and it
# is PID 1's child rather than a grandchild that misses SIGTERM.
CMD ["node", "srv/start.js"]
