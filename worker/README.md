# cc-api

Worker skeleton and `GET /health` (ADR 0001, brick 1) and the `CORS_ORIGINS` allow-list (brick 2). Vitest lives here; root Jest ignores `worker/`.

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

CORS (start with `npx wrangler dev --local --port 8787 --var CORS_ORIGINS:https://a.example`;
unset or empty `CORS_ORIGINS` allows no origin, `*` is not honoured):

```sh
# listed origin: 200, Access-Control-Allow-Origin echoed, Vary: Origin
curl -sS -D - -o /dev/null -H 'Origin: https://a.example' http://127.0.0.1:8787/health
# unlisted origin: 200, no Access-Control-Allow-Origin
curl -sS -D - -o /dev/null -H 'Origin: https://evil.example' http://127.0.0.1:8787/health
# preflight: 204 with Allow-Origin, Methods, Headers
curl -sS -D - -o /dev/null -X OPTIONS -H 'Origin: https://a.example' http://127.0.0.1:8787/health
# websocket upgrade from an unlisted origin: 403
curl -sS -D - -o /dev/null -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Origin: https://evil.example' http://127.0.0.1:8787/health
```
