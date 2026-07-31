#!/bin/bash
# ============================================================
# Fourier & Laplace Web Calculator — levantar entorno de dev
# ============================================================
# Corre backend (tsx watch) y frontend (ng serve) en paralelo,
# con logs prefijados y apagado limpio con Ctrl+C.
#
# Requiere: haber corrido ./setup.sh al menos una vez
#           (dependencias instaladas + fourier-backend/.env listo)
#
# Uso: ./dev.sh
# ============================================================

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/fourier-backend"
FRONTEND_DIR="$ROOT_DIR/fourier-frontend"

C_GREEN='\033[0;32m'; C_RED='\033[0;31m'; C_CYAN='\033[0;36m'; C_MAGENTA='\033[0;35m'; C_YELLOW='\033[1;33m'; C_RESET='\033[0m'

fail() { echo -e "${C_RED}✗ $1${C_RESET}"; exit 1; }

# ---------- checks previos ----------
[ -f "$BACKEND_DIR/.env" ] || fail "No existe fourier-backend/.env — corre ./setup.sh primero"
[ -d "$BACKEND_DIR/node_modules" ] || fail "Faltan node_modules en fourier-backend/ — corre ./setup.sh primero"
[ -d "$FRONTEND_DIR/node_modules" ] || fail "Faltan node_modules en fourier-frontend/ — corre ./setup.sh primero"

command -v maxima >/dev/null 2>&1 || fail "maxima no está en el PATH — corre ./setup.sh primero"

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet postgresql 2>/dev/null \
    || echo -e "${C_YELLOW}! PostgreSQL no parece estar activo (systemctl start postgresql)${C_RESET}"
fi

if grep -q "^REDIS_ENABLED=true" "$BACKEND_DIR/.env" 2>/dev/null; then
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli ping >/dev/null 2>&1 \
      || echo -e "${C_YELLOW}! REDIS_ENABLED=true pero Redis no responde (systemctl start redis-server)${C_RESET}"
  fi
fi

# ---------- lanzar backend y frontend en paralelo ----------
PIDS=()

cleanup() {
  echo -e "\n${C_YELLOW}▸ Deteniendo backend y frontend...${C_RESET}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo -e "${C_CYAN}▸ Backend  (npm run dev)  → http://localhost:3000${C_RESET}"
echo -e "${C_MAGENTA}▸ Frontend (ng serve)     → http://localhost:4200${C_RESET}"
echo ""

( cd "$BACKEND_DIR" && stdbuf -oL -eL npm run dev 2>&1 | stdbuf -oL sed -e "s/^/$(printf "${C_CYAN}[backend]${C_RESET} ")/" ) &
PIDS+=($!)

( cd "$FRONTEND_DIR" && stdbuf -oL -eL npm start 2>&1 | stdbuf -oL sed -e "s/^/$(printf "${C_MAGENTA}[frontend]${C_RESET} ")/" ) &
PIDS+=($!)

wait
