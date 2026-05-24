# Backend Deployment

The backend is a long-running Express + Socket.IO process. It keeps active rooms and lobby state in memory, so use a provider/plan that can keep one Node process warm for reliable multiplayer sessions.

## Recommended Order

1. Fly.io with one small always-on machine.
2. Railway with an always-on service.
3. Koyeb only if the selected service keeps at least one instance warm.
4. Render only on a paid/no-sleep service. Render free sleeps and is not reliable for realtime rooms.

## One-time Setup

Install the provider CLI you want to try:

```bash
brew install flyctl
npm install -g @railway/cli
brew install koyeb/tap/koyeb
```

Copy the deploy env template and fill in the provider values:

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

Run one provider at a time:

```bash
npm run deploy:backend -- fly
npm run deploy:backend -- railway
npm run deploy:backend -- koyeb
```

The script runs `npm run check` and `npm test` before deployment. For a quick provider experiment, you can skip one or both:

```bash
npm run deploy:backend -- fly --skip-tests
npm run deploy:backend -- railway --skip-checks --skip-tests
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

## Railway

Link the local repo once:

```bash
railway login
railway link
```

Then deploy:

```bash
npm run deploy:backend -- railway
```

If variable sync fails because your Railway CLI version changed its flags, set `RAILWAY_SET_VARIABLES=0` in `.env.deploy` and configure `NODE_ENV`, `CORS_ORIGIN`, and optional Google Sheets secrets in the Railway dashboard.

## Koyeb

The Koyeb command in `scripts/deploy-backend.sh` redeploys an existing Koyeb service source. It is included for comparison, but Fly/Railway are better for direct local source deploys.

Set `KOYEB_SERVICE_REF` in `.env.deploy`, then run:

```bash
npm run deploy:backend -- koyeb
```

Reject any Koyeb plan/configuration that scales to zero if first-user latency or realtime reliability matters.

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