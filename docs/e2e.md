# Browser e2e against the Worker (ADR 0001, brick 13)

Two Chromium contexts play against `wrangler dev` through the real client built with the WebSocket shim.

```sh
unset NODE_ENV CLOUDFLARE_API_TOKEN   # NODE_ENV=development breaks vite
npm run test:e2e                      # starts the Worker on :8787 and Vite on :5173, runs e2e/*.spec.js
```

Specs: `e2e/room.spec.js` (create a room, join by code, X wins the top row) and `e2e/lobby.spec.js` (two browsers
matched through the lobby hold opposite seats). If Playwright asks for a browser:
`npx playwright install chromium-headless-shell`. Ports 8787 and 5173 must be free (`reuseExistingServer` is off).

## Saved curls (Worker running: `cd worker && npx wrangler dev --port 8787 --var CORS_ORIGINS:http://127.0.0.1:5173`)

```sh
UP='-H Upgrade:websocket -H Connection:Upgrade -H Sec-WebSocket-Version:13 -H Sec-WebSocket-Key:dGhlIHNhbXBsZSBub25jZQ=='
# unlisted origin: 403
curl -i --max-time 3 -H "Origin: http://evil.example" $UP http://127.0.0.1:8787/ws/lobby
# allowed origin: 101 Switching Protocols
curl -i --max-time 3 -H "Origin: http://127.0.0.1:5173" $UP http://127.0.0.1:8787/ws/lobby
# the bare base URL is not a socket route: 404
curl -i --max-time 3 -H "Origin: http://127.0.0.1:5173" $UP http://127.0.0.1:8787/
```
(zsh does not word-split `$UP`; use `${=UP}` there.)
