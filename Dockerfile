# Build stage: needs devDependencies (vite, svelte, tsc), which the runtime image drops.
FROM node:22-bookworm-slim AS build

# NOT /app, the usual choice. `app/vite.config.ts` aliases the `/app/` import prefix to
# `app/src/`, and Vite applies aliases to absolute filesystem paths too -- so with the
# project at /app, the entry's own path `/app/app/index.html` is rewritten to
# `/app/app/src/app/index.html` and the build fails to find it. Any working directory that
# does not start with an aliased prefix (`/app/`, `/common/`, `/srv/`) is fine.
WORKDIR /usr/src/agnai

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
RUN echo "${SHA}" > /usr/src/agnai/version.txt

# Runtime stage.
FROM node:22-bookworm-slim AS runtime

WORKDIR /usr/src/agnai

RUN corepack enable

# ASSET_FOLDER must NOT be inside dist/. Vite emits the client bundle to dist/assets/ with
# content-hashed filenames, so pointing uploads there -- and mounting a volume over it --
# hides the bundle: index.html asks for a hash the volume does not have, the SPA fallback
# answers with index.html, and the browser refuses it as the wrong MIME type. White screen.
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    DB_NAME=agnai \
    ASSET_FOLDER=/usr/src/agnai/assets

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# The server runs the compiled .js emitted beside the sources, so `common/` and `srv/` are
# copied from the build stage rather than from the context.
COPY --from=build /usr/src/agnai/common/ ./common/
COPY --from=build /usr/src/agnai/srv/ ./srv/
COPY --from=build /usr/src/agnai/dist/ ./dist/
COPY --from=build /usr/src/agnai/version.txt ./version.txt
COPY db/ ./db/

VOLUME [ "/usr/src/agnai/db", "/usr/src/agnai/assets", "/usr/src/agnai/extras" ]

EXPOSE 3001

# `node srv/start.js` directly rather than through pnpm, so signals reach the server and it
# is PID 1's child rather than a grandchild that misses SIGTERM.
CMD ["node", "srv/start.js"]
