#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="$ROOT_DIR/.env.deploy"
DEFAULT_CORS_ORIGIN="https://harkirat155.github.io"

ENV_FILE="$DEFAULT_ENV_FILE"
RUN_CHECKS=1
RUN_TESTS=1
PROVIDER=""

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-backend.sh <provider> [options]

Providers:
  fly       Deploy local source to Fly.io with flyctl/fly
  railway   Deploy local source to Railway with railway up
  koyeb     Redeploy an existing Koyeb service source
  render    Trigger a paid/no-sleep Render service deploy

Options:
  --env-file <path>   Load deploy env from a custom file
  --skip-checks       Skip npm run check
  --skip-tests        Skip npm test
  -h, --help          Show this help

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

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      fly|railway|koyeb|render)
        PROVIDER="$1"
        shift
        ;;
      --env-file)
        [[ $# -ge 2 ]] || die "--env-file requires a path"
        ENV_FILE="$2"
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
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  [[ -n "$PROVIDER" ]] || {
    usage
    exit 1
  }
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

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_env() {
  local missing=0
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      printf 'error: Missing required env var: %s\n' "$name" >&2
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]] || exit 1
}

ensure_dependencies() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    log "Installing dependencies"
    npm ci
  fi
}

run_preflight() {
  ensure_dependencies

  if [[ "$RUN_CHECKS" -eq 1 ]]; then
    log "Running npm run check"
    npm run check
  else
    warn "Skipping npm run check"
  fi

  if [[ "$RUN_TESTS" -eq 1 ]]; then
    log "Running npm test"
    NODE_ENV=test npm test
  else
    warn "Skipping npm test"
  fi
}

apply_common_defaults() {
  export NODE_ENV="${NODE_ENV:-production}"
  export CORS_ORIGIN="${CORS_ORIGIN:-$DEFAULT_CORS_ORIGIN}"
  export PORT="${PORT:-10000}"
}

optional_env_pairs() {
  local pairs=(
    "NODE_ENV=$NODE_ENV"
    "CORS_ORIGIN=$CORS_ORIGIN"
    "PORT=$PORT"
  )

  [[ -n "${GOOGLE_SERVICE_ACCOUNT_EMAIL:-}" ]] && pairs+=("GOOGLE_SERVICE_ACCOUNT_EMAIL=$GOOGLE_SERVICE_ACCOUNT_EMAIL")
  [[ -n "${GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:-}" ]] && pairs+=("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
  [[ -n "${GOOGLE_SHEETS_SPREADSHEET_ID:-}" ]] && pairs+=("GOOGLE_SHEETS_SPREADSHEET_ID=$GOOGLE_SHEETS_SPREADSHEET_ID")
  [[ -n "${GOOGLE_SHEETS_FEEDBACK_RANGE:-}" ]] && pairs+=("GOOGLE_SHEETS_FEEDBACK_RANGE=$GOOGLE_SHEETS_FEEDBACK_RANGE")

  printf '%s\n' "${pairs[@]}"
}

fly_bin() {
  if command -v flyctl >/dev/null 2>&1; then
    printf 'flyctl'
  elif command -v fly >/dev/null 2>&1; then
    printf 'fly'
  else
    die "Missing Fly.io CLI. Install with: brew install flyctl"
  fi
}

fly_app_name() {
  if [[ -n "${FLY_APP:-}" ]]; then
    printf '%s' "$FLY_APP"
    return
  fi

  awk -F '"' '/^app = / { print $2; exit }' "$ROOT_DIR/fly.toml"
}

deploy_fly() {
  local fly app
  fly="$(fly_bin)"
  app="$(fly_app_name)"
  [[ -n "$app" ]] || die "Set FLY_APP in .env.deploy or fly.toml"

  if [[ "${FLY_USE_LOCAL_AUTH:-0}" == "1" ]]; then
    unset FLY_API_TOKEN
  fi

  log "Setting Fly secrets/env for $app"
  local env_pairs=()
  while IFS= read -r pair; do
    env_pairs+=("$pair")
  done < <(optional_env_pairs)
  "$fly" secrets set -a "$app" "${env_pairs[@]}"

  log "Deploying local source to Fly.io app $app"
  "$fly" deploy --config "$ROOT_DIR/fly.toml" --app "$app" --remote-only

  BACKEND_URL="https://${app}.fly.dev"
  print_success "$BACKEND_URL"
}

deploy_railway() {
  require_cmd railway

  if [[ "${RAILWAY_SET_VARIABLES:-1}" == "1" ]]; then
    log "Setting Railway variables"
    local env_pairs=()
    while IFS= read -r pair; do
      env_pairs+=("$pair")
    done < <(optional_env_pairs)
    for pair in "${env_pairs[@]}"; do
      railway variables --set "$pair"
    done
  else
    warn "Skipping Railway variable sync because RAILWAY_SET_VARIABLES=0"
  fi

  log "Deploying local source to Railway"
  local args=(up --detach)
  [[ -n "${RAILWAY_SERVICE:-}" ]] && args+=(--service "$RAILWAY_SERVICE")
  railway "${args[@]}"

  print_success "${RAILWAY_PUBLIC_URL:-}"
}

deploy_koyeb() {
  require_cmd koyeb
  require_env KOYEB_SERVICE_REF

  warn "Koyeb support here redeploys an existing Koyeb service source. Use Fly or Railway for true local source upload."
  log "Redeploying Koyeb service $KOYEB_SERVICE_REF"
  koyeb service redeploy "$KOYEB_SERVICE_REF"

  print_success "${KOYEB_PUBLIC_URL:-}"
}

deploy_render() {
  require_cmd curl
  require_env RENDER_SERVICE_ID RENDER_API_KEY

  warn "Render free services sleep. Use this only for paid/no-sleep Render services."
  log "Triggering Render deploy for service $RENDER_SERVICE_ID"
  curl -fsS \
    -X POST "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'

  print_success "${RENDER_SERVICE_URL:-}"
}

print_success() {
  local backend_url="$1"
  log "Deployment command completed"

  if [[ -n "$backend_url" ]]; then
    printf 'Backend URL: %s\n' "$backend_url"
    printf 'Set GitHub Pages secret BACKEND_URL to this value before the next frontend deploy.\n'
  else
    printf 'Set BACKEND_URL to the public backend URL shown by the provider dashboard/CLI.\n'
  fi

  printf 'Smoke test: curl -fsS "$BACKEND_URL/health"\n'
}

main() {
  parse_args "$@"
  cd "$ROOT_DIR"
  load_env_file
  apply_common_defaults
  load_node_version
  run_preflight

  case "$PROVIDER" in
    fly) deploy_fly ;;
    railway) deploy_railway ;;
    koyeb) deploy_koyeb ;;
    render) deploy_render ;;
    *) die "Unsupported provider: $PROVIDER" ;;
  esac
}

main "$@"