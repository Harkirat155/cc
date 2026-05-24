#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="$ROOT_DIR/.env.deploy"

ENV_FILE="$DEFAULT_ENV_FILE"
RUN_CHECKS=1
RUN_TESTS=1
BACKEND_URL_ARG=""
PAGES_BRANCH="${GH_PAGES_BRANCH:-gh-pages}"
PAGES_REMOTE="${GH_PAGES_REMOTE:-origin}"
PAGES_REPO="${GH_PAGES_REPO:-}"
PAGES_DEST="${GH_PAGES_DEST:-}"
PAGES_MESSAGE="${GH_PAGES_MESSAGE:-}"
PAGES_CNAME="${GH_PAGES_CNAME:-}"
NO_HISTORY="${GH_PAGES_NO_HISTORY:-0}"
NO_PUSH="${GH_PAGES_NO_PUSH:-0}"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-frontend.sh [options]

Build and publish the Vite frontend to a GitHub Pages branch using gh-pages.

Options:
  --env-file <path>     Load deploy env from a custom file
  --backend-url <url>   Backend URL baked into VITE_SOCKET_SERVER/VITE_API_BASE
  --skip-checks         Skip npm run check; npm run build still runs
  --skip-tests          Skip npm test
  --branch <branch>     Pages branch (default: gh-pages)
  --remote <remote>     Git remote (default: origin)
  --repo <url>          Repository URL passed to gh-pages
  --dest <path>         Destination path inside the Pages branch
  --message <message>   Commit message for the Pages publish
  --cname <domain>      Custom domain passed to gh-pages
  --no-history          Publish without preserving Pages branch history
  --no-push             Commit locally in gh-pages cache, do not push
  --dry-run             Alias for --no-push; gh-pages has no true dry run
  -h, --help            Show this help

Backend URL resolution order:
  --backend-url, BACKEND_URL, VITE_SOCKET_SERVER, FLY_APP -> https://<app>.fly.dev

Copy .env.deploy.example to .env.deploy before the first run.
USAGE
}

log() {
  printf '\n==> %s\n' "$*"
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

is_enabled() {
  case "${1:-0}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        [[ $# -ge 2 ]] || die "--env-file requires a path"
        ENV_FILE="$2"
        shift 2
        ;;
      --backend-url)
        [[ $# -ge 2 ]] || die "--backend-url requires a URL"
        BACKEND_URL_ARG="$2"
        shift 2
        ;;
      --skip-checks)
        RUN_CHECKS=0
        shift
        ;;
      --skip-tests)
        RUN_TESTS=0
        shift
        ;;
      --branch)
        [[ $# -ge 2 ]] || die "--branch requires a value"
        PAGES_BRANCH="$2"
        shift 2
        ;;
      --remote)
        [[ $# -ge 2 ]] || die "--remote requires a value"
        PAGES_REMOTE="$2"
        shift 2
        ;;
      --repo)
        [[ $# -ge 2 ]] || die "--repo requires a URL"
        PAGES_REPO="$2"
        shift 2
        ;;
      --dest)
        [[ $# -ge 2 ]] || die "--dest requires a path"
        PAGES_DEST="$2"
        shift 2
        ;;
      --message)
        [[ $# -ge 2 ]] || die "--message requires text"
        PAGES_MESSAGE="$2"
        shift 2
        ;;
      --cname)
        [[ $# -ge 2 ]] || die "--cname requires a domain"
        PAGES_CNAME="$2"
        shift 2
        ;;
      --no-history)
        NO_HISTORY=1
        shift
        ;;
      --no-push|--dry-run)
        NO_PUSH=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    validate_env_file_syntax
    log "Loading deploy env from ${ENV_FILE#$ROOT_DIR/}"
    export_env_file_values
  elif [[ "$ENV_FILE" != "$DEFAULT_ENV_FILE" ]]; then
    die "Env file not found: $ENV_FILE"
  else
    warn ".env.deploy not found; using shell environment and defaults"
  fi
}

export_env_file_values() {
  local line key value trimmed first_char last_char

  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"

    [[ -z "$trimmed" || "${trimmed:0:1}" == "#" ]] && continue

    key="${trimmed%%=*}"
    value="${trimmed#*=}"
    first_char="${value:0:1}"
    last_char="${value:${#value}-1:1}"

    if [[ "$first_char" == '"' && "$last_char" == '"' ]] || [[ "$first_char" == "'" && "$last_char" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$ENV_FILE"
}

validate_env_file_syntax() {
  local line line_no key trimmed
  line_no=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))
    trimmed="${line#"${line%%[![:space:]]*}"}"

    [[ -z "$trimmed" || "${trimmed:0:1}" == "#" ]] && continue
    [[ "$trimmed" == *=* ]] || die "Invalid env file line $line_no: expected KEY=value"

    key="${trimmed%%=*}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Invalid env file key on line $line_no"
  done < "$ENV_FILE"
}

load_node_version() {
  if command -v nvm >/dev/null 2>&1; then
    nvm use --lts
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
    nvm use --lts
    return
  fi

  warn "nvm is not available in this shell; continuing with $(node --version 2>/dev/null || echo unknown node)"
}

ensure_dependencies() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    log "Installing dependencies"
    npm ci
  fi
}

resolve_backend_url() {
  if [[ -n "$BACKEND_URL_ARG" ]]; then
    printf '%s' "$BACKEND_URL_ARG"
    return
  fi

  if [[ -n "${BACKEND_URL:-}" ]]; then
    printf '%s' "$BACKEND_URL"
    return
  fi

  if [[ -n "${VITE_SOCKET_SERVER:-}" ]]; then
    printf '%s' "$VITE_SOCKET_SERVER"
    return
  fi

  if [[ -n "${FLY_APP:-}" ]]; then
    printf 'https://%s.fly.dev' "$FLY_APP"
    return
  fi

  return 1
}

run_preflight_and_build() {
  local build_done=0
  ensure_dependencies

  if [[ "$RUN_CHECKS" -eq 1 ]]; then
    log "Running npm run check"
    npm run check
    build_done=1
  else
    warn "Skipping npm run check"
  fi

  if [[ "$RUN_TESTS" -eq 1 ]]; then
    log "Running npm test"
    NODE_ENV=test npm test
  else
    warn "Skipping npm test"
  fi

  if [[ "$build_done" -eq 0 ]]; then
    log "Running npm run build"
    npm run build
  fi

  [[ -d "$ROOT_DIR/dist" ]] || die "Build did not produce dist/"
  touch "$ROOT_DIR/dist/.nojekyll"
}

publish_pages() {
  local backend_url args
  backend_url="$1"

  if [[ -z "$PAGES_MESSAGE" ]]; then
    PAGES_MESSAGE="Deploy frontend to GitHub Pages ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  fi

  args=(--no-install gh-pages -d dist -b "$PAGES_BRANCH" -o "$PAGES_REMOTE" -m "$PAGES_MESSAGE" --nojekyll)
  [[ -n "$PAGES_REPO" ]] && args+=(-r "$PAGES_REPO")
  [[ -n "$PAGES_DEST" ]] && args+=(-e "$PAGES_DEST")
  [[ -n "$PAGES_CNAME" ]] && args+=(--cname "$PAGES_CNAME")
  is_enabled "$NO_HISTORY" && args+=(--no-history)
  is_enabled "$NO_PUSH" && args+=(--no-push)

  log "Publishing dist/ to $PAGES_BRANCH via gh-pages"
  npx "${args[@]}"

  log "Frontend deployment command completed"
  printf 'Frontend URL: https://harkirat155.github.io/cc/\n'
  printf 'Backend baked into build: %s\n' "$backend_url"
  if is_enabled "$NO_PUSH"; then
    printf 'No push was performed because --no-push/--dry-run was set.\n'
  fi
}

main() {
  local backend_url
  parse_args "$@"
  cd "$ROOT_DIR"
  load_env_file
  load_node_version

  backend_url="$(resolve_backend_url)" || die "Set --backend-url, BACKEND_URL, VITE_SOCKET_SERVER, or FLY_APP before deploying the frontend"
  export VITE_SOCKET_SERVER="$backend_url"
  export VITE_API_BASE="${VITE_API_BASE:-$backend_url}"

  run_preflight_and_build
  publish_pages "$backend_url"
}

main "$@"