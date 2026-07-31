# Agnaistic

AI roleplay chat with personalized characters and multiple AI providers.

This fork is based on [Agnaistic](https://github.com/agnaistic/agnai), which in turn was based on the early work of [Galatea-UI](https://github.com/PygmalionAI/galatea-ui).

## Requirements

- [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`
- [Corepack](https://nodejs.org/api/corepack.html), used to select the pnpm version pinned in `package.json`
- [MongoDB](https://www.mongodb.com/docs/manual/installation/)
- Redis only for distributed or multi-instance deployments
- Docker Compose or Podman Compose if you want the repository to run MongoDB and Redis
- Python 3.10+ only for the optional pipeline service

## Setup

```sh
git clone https://github.com/Ye0l/agnai.git
cd agnai

corepack enable
pnpm install --frozen-lockfile

# Start MongoDB and Redis with Docker Compose or Podman Compose.
pnpm run up

# Build the frontend and server once, then start development watchers.
pnpm run build:all
pnpm start
```

The API and built application are available at <http://localhost:3001>. The Vite development frontend with hot reload is available at <http://localhost:1234>.

Run `pnpm install --frozen-lockfile` again after pulling changes to `package.json` or `pnpm-lock.yaml`.

## Commands

| Command                 | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `pnpm start`            | Run the Vite frontend, API server, and server TypeScript watcher           |
| `pnpm run start:web`    | Run the Vite frontend and server TypeScript watcher without the API server |
| `pnpm run start:debug`  | Run development services with debug logging and the Node inspector         |
| `pnpm run start:public` | Run development services and expose port 3001 through LocalTunnel          |
| `pnpm run start:all`    | Run development services plus the optional Python pipeline                 |
| `pnpm run build`        | Build the Svelte frontend into `dist/`                                     |
| `pnpm run build:server` | Compile the server and shared TypeScript                                   |
| `pnpm run build:all`    | Build both frontend and server                                             |
| `pnpm run selfhost`     | Build everything and start the server with `SELF_HOST=1`                   |
| `pnpm run model`        | Install and run the optional Python pipeline                               |
| `pnpm run up`           | Start MongoDB and Redis with Docker Compose or Podman Compose              |
| `pnpm run legacy:web`   | Run the legacy SolidJS/Parcel frontend                                     |
| `pnpm run legacy:build` | Build the legacy SolidJS/Parcel frontend                                   |

`pnpm start` launches the Node.js server with `--inspect`. Attach a debugger with the default VS Code launch task or through `chrome://inspect`.

## Features

- Group conversations with multiple users and characters
- Multiple AI providers, including Kobold, NovelAI, AI Horde, OpenAI, Claude, Replicate, and OpenRouter
- Multiple persona schema formats
- User authentication, settings, and generation presets
- Subscriptions
- Memory and lore books
- AI-assisted character and image generation
- Optional long-term memory, Wikipedia, and PDF pipeline features

## Self-hosting settings

MongoDB is required. Without Redis, the server runs in non-distributed mode.

Create `settings.json` in the repository root to apply application-wide settings. See [`template.settings.json`](./template.settings.json) for the available values. Restart the server after changing this file.

Use this file for deployment-specific behavior, such as adding response end tokens or applying a default memory book.

## Development

The main stack is:

- MongoDB for persistence
- Redis for distributed WebSocket messaging
- Svelte 5 and Vite for the current frontend
- SolidJS and Parcel for the temporary legacy frontend
- Tailwind CSS for styling
- Express for the API server
- pnpm for dependency management
- Poetry for the optional Python pipeline

Before submitting changes, run:

```sh
pnpm run format:fix
pnpm run check
```

`pnpm run check` runs formatting validation, TypeScript/Svelte checks, and the test suite. Individual checks are also available through `pnpm run format`, `pnpm run typecheck`, and `pnpm test`.
