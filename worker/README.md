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

Google Sheets feedback sync is optional and uses secrets, never `vars` (the service account needs edit access to the sheet; the range defaults to `Feedback!A:E`):

```sh
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   # literal \n in the value is accepted
npx wrangler secret put GOOGLE_SHEETS_SPREADSHEET_ID
npx wrangler secret put GOOGLE_SHEETS_FEEDBACK_RANGE         # optional
```

For `npm run dev`, put the same names in `.dev.vars`.

POST /feedback (`npm run dev`; rows are stored in the Lobby DO's SQLite, newest 200; `sheetsSync` is `skipped` unless Sheets secrets are set, then `queued`; the append runs in `waitUntil`):

```sh
# happy path: 201 {"status":"received","id":"<base36>-<6 chars>","sheetsSync":"skipped"} ("queued" with the Sheets secrets set)
curl -sS -w '\n%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"rating":4,"message":"great game"}' http://127.0.0.1:8787/feedback
# bad rating: 400 {"error":"Rating must be a number between 1 and 5."}
curl -sS -w '\n%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"rating":9,"message":"great game"}' http://127.0.0.1:8787/feedback
# short message: 400 {"error":"Feedback should be at least 5 characters long."}
curl -sS -w '\n%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"rating":3,"message":"hi"}' http://127.0.0.1:8787/feedback
# malformed JSON: 400 {"error":"Invalid JSON payload."}
curl -sS -w '\n%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{oops' http://127.0.0.1:8787/feedback
# over 32 KiB: 413, Express's HTML "Payload Too Large" page
python3 -c "print('{\"rating\":4,\"message\":\"hello there\",\"p\":\"'+'a'*33000+'\"}')" > /tmp/big.json
curl -sS -w '\n%{http_code}\n' -X POST -H 'Content-Type: application/json' --data-binary @/tmp/big.json http://127.0.0.1:8787/feedback
```
