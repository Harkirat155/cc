# Frontend Deployment

The frontend is a Vite build served from GitHub Pages at `https://harkirat155.github.io/cc/`. The app must be built with a public backend URL so Socket.IO and feedback API calls point at the deployed backend instead of a local port.

## Default CI Path

The default deployment path remains `.github/workflows/deploy.yml`. That workflow builds on pushes to `main` and publishes through GitHub's Pages Actions flow. It reads the backend URL from the repository secret `BACKEND_URL`.

Use this after deploying the backend:

```bash
gh secret set BACKEND_URL --body https://crisscross-backend.fly.dev
```

## Local Direct Deploy

For a manual local deploy, use:

```bash
npm run deploy:frontend -- --backend-url https://crisscross-backend.fly.dev
```

The script runs `npm run check` and `npm test` by default. It then publishes `dist/` with the installed `gh-pages` package.

For a faster local publish when preflight has already passed:

```bash
npm run deploy:frontend -- --backend-url https://crisscross-backend.fly.dev --skip-tests
```

For a no-push verification run:

```bash
npm run deploy:frontend -- --backend-url https://crisscross-backend.fly.dev --skip-checks --skip-tests --no-push
```

`--dry-run` is accepted as an alias for `--no-push`. The `gh-pages` package does not provide a true dry run; `--no-push` builds and creates the local publish commit in the gh-pages cache without pushing it.

## Backend URL Resolution

The script resolves the backend URL in this order:

1. `--backend-url`
2. `BACKEND_URL`
3. `VITE_SOCKET_SERVER`
4. `FLY_APP`, converted to `https://<FLY_APP>.fly.dev`

It exports both `VITE_SOCKET_SERVER` and `VITE_API_BASE` before building. If `VITE_API_BASE` is already set, that explicit value is kept; otherwise it uses the same backend URL.

## GitHub Pages Source Caveat

This local script publishes to a `gh-pages` branch. It updates the public site only when the repository's Pages source is configured as `Deploy from a branch` with branch `gh-pages` and folder `/root`.

If GitHub Pages is configured to use `GitHub Actions`, direct pushes to `gh-pages` are ignored. In that mode, keep using the existing workflow as the source of truth and trigger it by pushing to `main` or with `workflow_dispatch`.

## Options

```bash
scripts/deploy-frontend.sh [options]

--env-file <path>     Load deploy env from a custom file
--backend-url <url>   Backend URL baked into VITE_SOCKET_SERVER/VITE_API_BASE
--skip-checks         Skip npm run check; npm run build still runs
--skip-tests          Skip npm test
--branch <branch>     Pages branch, default gh-pages
--remote <remote>     Git remote, default origin
--repo <url>          Repository URL passed to gh-pages
--dest <path>         Destination path inside the Pages branch
--message <message>   Commit message for the Pages publish
--cname <domain>      Custom domain passed to gh-pages
--no-history          Publish without preserving Pages branch history
--no-push             Commit locally in gh-pages cache, do not push
--dry-run             Alias for --no-push
```

## Smoke Test

After a deploy, open the Pages URL and verify:

```bash
open https://harkirat155.github.io/cc/
```

Then test room creation, second-browser join, lobby matchmaking, in-room game switching, and feedback submission against the deployed backend.