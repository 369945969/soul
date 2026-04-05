#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-server}"

if [[ "$MODE" == "-h" || "$MODE" == "--help" || "$MODE" == "help" ]]; then
  cat <<'EOF'
Usage: ./start.sh [mode]

Modes:
  server       Build (best effort) + start Web UI server (default)
  index        Build (best effort) + start main entry
  dev          Start dev mode (tsx src/index.ts)
  dev-server   Start dev server (tsx src/server.ts)
  brain        Run test-brain.cjs

Env:
  SOUL_URL       URL to open when starting server (default: http://localhost:47779)
  FORCE_BUILD    If set to 1, always run build for server/index
EOF
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node not found in PATH. Install Node.js >= 18."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm not found in PATH. Install Node.js (includes npm)."
  exit 1
fi

if [[ ! -d "node_modules" ]]; then
  if [[ -f "package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
fi

URL="${SOUL_URL:-http://localhost:47779}"

run_build_if_needed() {
  if [[ "${FORCE_BUILD:-0}" == "1" || ! -d "dist" ]]; then
    if ! npm run build; then
      echo "[WARNING] Build failed, continuing with existing dist (if any)."
    fi
  else
    if ! npm run build; then
      echo "[WARNING] Build failed, continuing with existing dist (if any)."
    fi
  fi
}

open_url_background() {
  if command -v open >/dev/null 2>&1; then
    (sleep 2 && open "$URL" >/dev/null 2>&1) &
  elif command -v xdg-open >/dev/null 2>&1; then
    (sleep 2 && xdg-open "$URL" >/dev/null 2>&1) &
  fi
}

case "$MODE" in
  server)
    run_build_if_needed
    open_url_background
    echo "Starting Soul server on $URL ..."
    exec node "dist/server.js"
    ;;
  index|start)
    run_build_if_needed
    exec node "dist/index.js"
    ;;
  dev)
    exec npm run dev
    ;;
  dev-server|dev:server)
    exec npm run dev:server
    ;;
  brain)
    exec node "test-brain.cjs"
    ;;
  *)
    echo "[ERROR] Unknown mode: $MODE"
    echo "Run: ./start.sh help"
    exit 2
    ;;
esac
