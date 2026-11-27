# cc-api

Worker skeleton and `GET /health` (ADR 0001, brick 1). Vitest lives here; root Jest ignores `worker/`.

## Dev

`npm run dev` is `wrangler dev --local` (no login) on port 8787.

```sh
cd worker && npm install && npm run dev
```

## Test

```sh
cd worker && npm test
npx tsc --noEmit
```

## curls

```sh
curl -sS -D - http://127.0.0.1:8787/health
curl -sS -D - http://127.0.0.1:8787/no-such-route
```
