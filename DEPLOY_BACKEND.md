# Backend Deployment

The backend is a long-running Express + Socket.IO process. It keeps active rooms and lobby state in memory, so use a provider/plan that can keep one Node process warm for reliable multiplayer sessions.

## Provider

Fly.io is the supported backend deployment target. The backend runs as one long-lived machine using the repo's `Dockerfile` and `fly.toml`.

## One-time Setup

Install the Fly CLI:

```bash
brew install flyctl
```

Copy the deploy env template and fill in the Fly values:

```bash
cp .env.deploy.example .env.deploy
```

At minimum, keep:

```bash
NODE_ENV=production
CORS_ORIGIN=https://harkirat155.github.io
PORT=10000
```

## Deploy From Local

Deploy to Fly:

```bash
npm run deploy:backend -- fly
```

The script runs `npm run check` and `npm test` before deployment. For a quick Fly deploy check, you can skip one or both:

```bash
npm run deploy:backend -- fly --skip-tests
```

## Fly.io

Create the app once if it does not exist yet:

```bash
flyctl auth login
flyctl apps create crisscross-backend
```

Set `FLY_APP` in `.env.deploy` if you use a different app name, then run:

```bash
npm run deploy:backend -- fly
```

If you authenticated with `flyctl auth login` and do not want the script to use `FLY_API_TOKEN`, set this in `.env.deploy`:

```bash
FLY_USE_LOCAL_AUTH=1
```

The `fly.toml` keeps the machine warm with `auto_stop_machines = "off"` while avoiding Fly's extra high-availability machine during ramp-up. Fly deploys with the repo's `Dockerfile`, which packages only the backend runtime files.

## GitHub Pages Wiring

After the backend deploys, set the GitHub repository secret used by the frontend workflow:

```bash
gh secret set BACKEND_URL --body https://your-backend.example.com
```

The frontend workflow injects this as `VITE_SOCKET_SERVER`. Feedback uses `VITE_API_BASE` if set, otherwise it falls back to `VITE_SOCKET_SERVER`.

## Smoke Test

After deploy:

```bash
curl -fsS https://your-backend.example.com/health
curl -fsS https://your-backend.example.com/metrics
```

Then open the GitHub Pages app and test room creation, second-browser join, moves, lobby matchmaking, feedback submission, and reconnect after a backend restart.