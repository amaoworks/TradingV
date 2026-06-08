#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/web/frontend"

MODE="${1:-all}"
BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_PORT_START="$BACKEND_PORT"
BACKEND_PYTHON="${BACKEND_PYTHON:-${UV_PYTHON:-3.12}}"
BACKEND_LOG_LEVEL="${BACKEND_LOG_LEVEL:-${LOG_LEVEL:-error}}"
BACKEND_ACCESS_LOG="${BACKEND_ACCESS_LOG:-0}"
UV_QUIET="${UV_QUIET:-1}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
FRONTEND_PORT_START="$FRONTEND_PORT"
FRONTEND_LOG_LEVEL="${FRONTEND_LOG_LEVEL:-${LOG_LEVEL:-error}}"
BACKEND_EXTRAS="${BACKEND_EXTRAS:-web cn}"
AUTO_PORT="${AUTO_PORT:-1}"
PORT_SCAN_LIMIT="${PORT_SCAN_LIMIT:-50}"
PUBLIC_HOST="${PUBLIC_HOST:-}"
PUBLIC_IP_LOOKUP_URL="${PUBLIC_IP_LOOKUP_URL:-https://api.ipify.org}"
DETECTED_PUBLIC_HOST=""
PRINT_URLS="${PRINT_URLS:-1}"
SHOW_COMMAND="${SHOW_COMMAND:-0}"

usage() {
  cat <<'EOF'
Usage:
  scripts/start.sh frontend   Start Vite frontend only
  scripts/start.sh backend    Start FastAPI backend only
  scripts/start.sh all        Start backend and frontend

Environment:
  BACKEND_HOST=0.0.0.0
  BACKEND_PORT=8000
  BACKEND_PYTHON=3.12       Python version used by uv for backend startup
  BACKEND_LOG_LEVEL=error   uvicorn log level: debug/info/warning/error
  BACKEND_ACCESS_LOG=0      set to 1 to enable uvicorn request access logs
  UV_QUIET=1                suppress uv progress/info output
  FRONTEND_HOST=0.0.0.0
  FRONTEND_PORT=3000
  FRONTEND_LOG_LEVEL=error  Vite log level: info/warn/error/silent
  LOG_LEVEL=error           default for both backend and frontend
  AUTO_PORT=1               auto-select the next free port when occupied
  PORT_SCAN_LIMIT=50        number of ports to scan when AUTO_PORT=1
  SHOW_COMMAND=0            set to 1 to print the backend command
  BACKEND_EXTRAS="web cn"     uv extras used for backend startup
  PUBLIC_HOST=1.2.3.4         override the public host shown in debug URLs
  PUBLIC_IP_LOOKUP_URL=https://api.ipify.org
EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

is_port_open() {
  local port="$1"
  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

find_available_port() {
  local requested="$1"
  local port="$requested"
  local limit="$((requested + PORT_SCAN_LIMIT))"

  if [[ "$AUTO_PORT" != "1" ]]; then
    printf '%s' "$requested"
    return
  fi

  while (( port < limit )); do
    if ! is_port_open "$port"; then
      printf '%s' "$port"
      return
    fi
    port=$((port + 1))
  done

  echo "No free port found from $requested to $((limit - 1))" >&2
  exit 1
}

resolve_ports() {
  BACKEND_PORT="$(find_available_port "$BACKEND_PORT_START")"
  FRONTEND_PORT="$(find_available_port "$FRONTEND_PORT_START")"

  if [[ "$BACKEND_PORT" != "$BACKEND_PORT_START" ]]; then
    echo "Backend port $BACKEND_PORT_START is in use; using $BACKEND_PORT."
  fi
  if [[ "$FRONTEND_PORT" != "$FRONTEND_PORT_START" ]]; then
    echo "Frontend port $FRONTEND_PORT_START is in use; using $FRONTEND_PORT."
  fi
}

is_loopback_host() {
  case "$1" in
    localhost|127.*|::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

local_url_host() {
  case "$1" in
    0.0.0.0|::)
      printf '%s' "127.0.0.1"
      ;;
    *)
      printf '%s' "$1"
      ;;
  esac
}

detect_public_host() {
  if [[ -n "$PUBLIC_HOST" ]]; then
    printf '%s' "$PUBLIC_HOST"
    return
  fi

  if [[ -n "$DETECTED_PUBLIC_HOST" ]]; then
    printf '%s' "$DETECTED_PUBLIC_HOST"
    return
  fi

  if command_exists curl; then
    DETECTED_PUBLIC_HOST="$(curl -fsS --max-time 2 "$PUBLIC_IP_LOOKUP_URL" 2>/dev/null || true)"
  elif command_exists wget; then
    DETECTED_PUBLIC_HOST="$(wget -qO- --timeout=2 "$PUBLIC_IP_LOOKUP_URL" 2>/dev/null || true)"
  fi

  printf '%s' "$DETECTED_PUBLIC_HOST"
}

print_service_urls() {
  local name="$1"
  local host="$2"
  local port="$3"
  local public_host

  echo "$name local:     http://$(local_url_host "$host"):$port"

  public_host="$(detect_public_host)"
  if [[ -z "$public_host" ]]; then
    echo "$name public:    unavailable (set PUBLIC_HOST to show it)"
    return
  fi

  if is_loopback_host "$host"; then
    echo "$name public:    not exposed (listening on $host; set ${name^^}_HOST=0.0.0.0)"
  else
    echo "$name public:    http://$public_host:$port"
    echo "$name public:    requires firewall/security-group port $port to be open"
  fi
}

print_open_hint() {
  local public_host

  echo "Open frontend:"
  echo "  local:  http://$(local_url_host "$FRONTEND_HOST"):$FRONTEND_PORT"

  public_host="$(detect_public_host)"
  if [[ -z "$public_host" ]]; then
    echo "  public: unavailable (set PUBLIC_HOST to show it)"
  elif is_loopback_host "$FRONTEND_HOST"; then
    echo "  public: not exposed (set FRONTEND_HOST=0.0.0.0)"
  else
    echo "  public: http://$public_host:$FRONTEND_PORT"
    echo "  note:   open TCP port $FRONTEND_PORT in firewall/security group"
  fi

  echo "Backend API:"
  echo "  local:  http://$(local_url_host "$BACKEND_HOST"):$BACKEND_PORT"
  if [[ -n "$public_host" ]] && ! is_loopback_host "$BACKEND_HOST"; then
    echo "  public: http://$public_host:$BACKEND_PORT"
  fi
}

backend_command() {
  if command_exists uv; then
    local cmd=(uv run --python "$BACKEND_PYTHON")
    if [[ "$UV_QUIET" == "1" ]]; then
      cmd+=(--quiet)
    fi
    for extra in $BACKEND_EXTRAS; do
      cmd+=(--extra "$extra")
    done
    cmd+=(uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload --log-level "$BACKEND_LOG_LEVEL")
    if [[ "$BACKEND_ACCESS_LOG" != "1" ]]; then
      cmd+=(--no-access-log)
    fi
    printf '%q ' "${cmd[@]}"
  else
    local cmd=(python -m uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload --log-level "$BACKEND_LOG_LEVEL")
    if [[ "$BACKEND_ACCESS_LOG" != "1" ]]; then
      cmd+=(--no-access-log)
    fi
    printf '%q ' "${cmd[@]}"
  fi
}

start_backend() {
  cd "$ROOT_DIR"
  if command_exists uv; then
    local cmd=(uv run --python "$BACKEND_PYTHON")
    local uvicorn_args=(uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload --log-level "$BACKEND_LOG_LEVEL")
    if [[ "$UV_QUIET" == "1" ]]; then
      cmd+=(--quiet)
    fi
    for extra in $BACKEND_EXTRAS; do
      cmd+=(--extra "$extra")
    done
    if [[ "$BACKEND_ACCESS_LOG" != "1" ]]; then
      uvicorn_args+=(--no-access-log)
    fi
    if [[ "$PRINT_URLS" == "1" ]]; then
      print_service_urls "backend" "$BACKEND_HOST" "$BACKEND_PORT"
    fi
    echo "Starting backend with uv using Python $BACKEND_PYTHON..."
    exec "${cmd[@]}" "${uvicorn_args[@]}"
  fi

  echo "uv not found; falling back to current Python environment." >&2
  echo "Install dependencies first, for example: pip install -e '.[web,cn]'" >&2
  local cmd=(python -m uvicorn web.backend.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload --log-level "$BACKEND_LOG_LEVEL")
  if [[ "$BACKEND_ACCESS_LOG" != "1" ]]; then
    cmd+=(--no-access-log)
  fi
  if [[ "$PRINT_URLS" == "1" ]]; then
    print_service_urls "backend" "$BACKEND_HOST" "$BACKEND_PORT"
  fi
  echo "Starting backend..."
  exec "${cmd[@]}"
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
  if [[ "$PRINT_URLS" == "1" ]]; then
    print_service_urls "frontend" "$FRONTEND_HOST" "$FRONTEND_PORT"
  fi
  echo "Starting frontend..."
  export VITE_BACKEND_TARGET="http://127.0.0.1:$BACKEND_PORT"
  export VITE_BACKEND_WS_TARGET="ws://127.0.0.1:$BACKEND_PORT"
  exec npm --loglevel=error --silent run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort --logLevel "$FRONTEND_LOG_LEVEL"
}

start_all() {
  local backend_pid="" frontend_pid=""

  resolve_ports
  if [[ "$SHOW_COMMAND" == "1" ]]; then
    echo "Backend command: $(backend_command)"
  fi
  print_open_hint
  (
    PRINT_URLS=0
    start_backend
  ) &
  backend_pid=$!

  (
    PRINT_URLS=0
    start_frontend
  ) &
  frontend_pid=$!

  cleanup() {
    if [[ -n "${backend_pid:-}" ]]; then
      kill "$backend_pid" >/dev/null 2>&1 || true
    fi
    if [[ -n "${frontend_pid:-}" ]]; then
      kill "$frontend_pid" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup INT TERM EXIT

  wait -n "$backend_pid" "$frontend_pid"
  cleanup
  wait "$backend_pid" "$frontend_pid" >/dev/null 2>&1 || true
}

case "$MODE" in
  frontend)
    FRONTEND_PORT="$(find_available_port "$FRONTEND_PORT_START")"
    if [[ "$FRONTEND_PORT" != "$FRONTEND_PORT_START" ]]; then
      echo "Frontend port $FRONTEND_PORT_START is in use; using $FRONTEND_PORT."
    fi
    start_frontend
    ;;
  backend)
    BACKEND_PORT="$(find_available_port "$BACKEND_PORT_START")"
    if [[ "$BACKEND_PORT" != "$BACKEND_PORT_START" ]]; then
      echo "Backend port $BACKEND_PORT_START is in use; using $BACKEND_PORT."
    fi
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
