#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/web/frontend"

MODE="${1:-all}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-localhost}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_EXTRAS="${BACKEND_EXTRAS:-web cn}"

usage() {
  cat <<'EOF'
Usage:
  scripts/start.sh frontend   Start Vite frontend only
  scripts/start.sh backend    Start FastAPI backend only
  scripts/start.sh all        Start backend and frontend

Environment:
  BACKEND_HOST=127.0.0.1
  BACKEND_PORT=8000
  FRONTEND_HOST=localhost
  FRONTEND_PORT=3000
  BACKEND_EXTRAS="web cn"     uv extras used for backend startup
EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

backend_command() {
  if command_exists uv; then
    local cmd=(uv run)
    for extra in $BACKEND_EXTRAS; do
      cmd+=(--extra "$extra")
    done
    cmd+=(uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload)
    printf '%q ' "${cmd[@]}"
  else
    printf '%q ' python -m uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload
  fi
}

start_backend() {
  cd "$ROOT_DIR"
  if command_exists uv; then
    local cmd=(uv run)
    for extra in $BACKEND_EXTRAS; do
      cmd+=(--extra "$extra")
    done
    echo "Starting backend with uv: http://$BACKEND_HOST:$BACKEND_PORT"
    exec "${cmd[@]}" uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload
  fi

  echo "uv not found; falling back to current Python environment." >&2
  echo "Install dependencies first, for example: pip install -e '.[web,cn]'" >&2
  echo "Starting backend: http://$BACKEND_HOST:$BACKEND_PORT"
  exec python -m uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload
}

ensure_frontend_deps() {
  cd "$FRONTEND_DIR"
  if [[ -d node_modules ]]; then
    return
  fi

  echo "Installing frontend dependencies..."
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
}

start_frontend() {
  ensure_frontend_deps
  cd "$FRONTEND_DIR"
  echo "Starting frontend: http://$FRONTEND_HOST:$FRONTEND_PORT"
  exec npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
}

start_all() {
  local backend_pid frontend_pid

  echo "Backend command: $(backend_command)"
  (
    start_backend
  ) &
  backend_pid=$!

  (
    start_frontend
  ) &
  frontend_pid=$!

  cleanup() {
    kill "$backend_pid" "$frontend_pid" >/dev/null 2>&1 || true
  }
  trap cleanup INT TERM EXIT

  wait -n "$backend_pid" "$frontend_pid"
  cleanup
  wait "$backend_pid" "$frontend_pid" >/dev/null 2>&1 || true
}

case "$MODE" in
  frontend)
    start_frontend
    ;;
  backend)
    start_backend
    ;;
  all)
    start_all
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage >&2
    exit 2
    ;;
esac
