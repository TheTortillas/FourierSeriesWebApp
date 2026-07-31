#!/bin/bash
# ============================================================
# Fourier & Laplace Web Calculator — setup de entorno local
# ============================================================
# Valida/instala las dependencias del sistema (Maxima, Node,
# PostgreSQL, Redis), genera fourier-backend/.env con llaves
# JWT aleatorias, crea la base de datos y deja el repo listo
# con `npm install` en backend y frontend.
#
# Objetivo: Ubuntu/Debian (apt).
# Uso:      ./setup.sh
# ============================================================

set -uo pipefail

# ---------- versiones mínimas requeridas ----------
readonly REQ_MAXIMA="5.47.0"
readonly REQ_NODE_MAJOR=22
readonly REQ_PG_MAJOR=14

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/fourier-backend"
FRONTEND_DIR="$ROOT_DIR/fourier-frontend"
DB_DIR="$ROOT_DIR/fourier-database"

# ---------- colores / helpers ----------
C_GREEN='\033[0;32m'; C_RED='\033[0;31m'; C_YELLOW='\033[1;33m'; C_BLUE='\033[0;34m'; C_RESET='\033[0m'

ok()    { echo -e "  ${C_GREEN}✓${C_RESET} $1"; }
fail()  { echo -e "  ${C_RED}✗${C_RESET} $1"; }
warn()  { echo -e "  ${C_YELLOW}!${C_RESET} $1"; }
step()  { echo -e "\n${C_BLUE}▸ $1${C_RESET}"; }

ask_yes_no() {
  # ask_yes_no "pregunta" -> return 0 si sí
  local prompt="$1"
  local reply
  read -r -p "$(echo -e "  ${C_YELLOW}?${C_RESET} $prompt [y/N] ")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

version_ge() {
  # version_ge A B -> true si A >= B (versiones tipo x.y.z)
  [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

MISSING_ANY=0

# ============================================================
step "1/6 · Paquetes base de compilación"
# ============================================================
BASE_PKGS=(git curl build-essential sbcl texinfo autoconf automake)
MISSING_PKGS=()
for pkg in "${BASE_PKGS[@]}"; do
  dpkg -s "$pkg" >/dev/null 2>&1 || MISSING_PKGS+=("$pkg")
done

if [ ${#MISSING_PKGS[@]} -eq 0 ]; then
  ok "git, build-essential, sbcl, texinfo, autoconf, automake"
else
  warn "Faltan paquetes: ${MISSING_PKGS[*]}"
  if ask_yes_no "¿Instalar con apt ahora? (requiere sudo)"; then
    sudo apt update && sudo apt install -y "${MISSING_PKGS[@]}"
    ok "Paquetes base instalados"
  else
    fail "Sin estos paquetes, Maxima no se puede compilar. Continuando de todos modos."
    MISSING_ANY=1
  fi
fi

# ============================================================
step "2/6 · Maxima (requerido: $REQ_MAXIMA exacto)"
# ============================================================
CURRENT_MAXIMA=""
if command -v maxima >/dev/null 2>&1; then
  CURRENT_MAXIMA="$(maxima --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)"
fi

if [ "$CURRENT_MAXIMA" = "$REQ_MAXIMA" ]; then
  ok "Maxima $CURRENT_MAXIMA"
elif [ -n "$CURRENT_MAXIMA" ]; then
  warn "Maxima $CURRENT_MAXIMA instalado, pero se requiere exactamente $REQ_MAXIMA"
  warn "(los scripts .mac del backend fueron validados contra $REQ_MAXIMA; otras versiones pueden dar resultados distintos)"
  if ask_yes_no "¿Compilar e instalar Maxima $REQ_MAXIMA desde fuente ahora? (10-20 min)"; then
    (
      set -e
      cd /tmp
      wget -q "https://sourceforge.net/projects/maxima/files/Maxima-source/${REQ_MAXIMA}-source/maxima-${REQ_MAXIMA}.tar.gz"
      tar -xzf "maxima-${REQ_MAXIMA}.tar.gz"
      cd "maxima-${REQ_MAXIMA}"
      ./configure --with-sbcl
      make -j"$(nproc)"
      sudo make install
      cd /tmp && rm -rf "maxima-${REQ_MAXIMA}" "maxima-${REQ_MAXIMA}.tar.gz"
    )
    NEW_MAXIMA="$(maxima --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)"
    [ "$NEW_MAXIMA" = "$REQ_MAXIMA" ] && ok "Maxima $REQ_MAXIMA instalado" || fail "La compilación terminó pero la versión detectada es '$NEW_MAXIMA'"
  else
    MISSING_ANY=1
  fi
else
  warn "Maxima no está instalado (los repos de Ubuntu/Debian traen 5.46, no sirve — se necesita $REQ_MAXIMA)"
  if ask_yes_no "¿Compilar e instalar Maxima $REQ_MAXIMA desde fuente ahora? (10-20 min)"; then
    (
      set -e
      cd /tmp
      wget -q "https://sourceforge.net/projects/maxima/files/Maxima-source/${REQ_MAXIMA}-source/maxima-${REQ_MAXIMA}.tar.gz"
      tar -xzf "maxima-${REQ_MAXIMA}.tar.gz"
      cd "maxima-${REQ_MAXIMA}"
      ./configure --with-sbcl
      make -j"$(nproc)"
      sudo make install
      cd /tmp && rm -rf "maxima-${REQ_MAXIMA}" "maxima-${REQ_MAXIMA}.tar.gz"
    )
    NEW_MAXIMA="$(maxima --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)"
    [ "$NEW_MAXIMA" = "$REQ_MAXIMA" ] && ok "Maxima $REQ_MAXIMA instalado" || fail "La compilación terminó pero la versión detectada es '$NEW_MAXIMA'"
  else
    MISSING_ANY=1
  fi
fi

# ============================================================
step "3/6 · Node.js (mínimo: v$REQ_NODE_MAJOR LTS) y npm"
# ============================================================
CURRENT_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
fi

if [ "$CURRENT_NODE_MAJOR" -ge "$REQ_NODE_MAJOR" ] 2>/dev/null; then
  ok "Node $(node -v) · npm $(npm -v)"
else
  if [ "$CURRENT_NODE_MAJOR" -eq 0 ] 2>/dev/null; then
    warn "Node.js no está instalado (se requiere v$REQ_NODE_MAJOR o superior)"
  else
    warn "Node $(node -v) detectado, se requiere v$REQ_NODE_MAJOR o superior"
  fi
  if ask_yes_no "¿Instalar Node $REQ_NODE_MAJOR vía nvm ahora?"; then
    if [ -z "${NVM_DIR:-}" ] || [ ! -s "$HOME/.nvm/nvm.sh" ]; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
    fi
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
    nvm install "$REQ_NODE_MAJOR"
    nvm use "$REQ_NODE_MAJOR"
    ok "Node $(node -v) · npm $(npm -v) (activo en esta shell vía nvm — abre una nueva terminal o corre 'nvm use $REQ_NODE_MAJOR' para persistirlo)"
  else
    MISSING_ANY=1
  fi
fi

# ============================================================
step "4/6 · PostgreSQL (mínimo: v$REQ_PG_MAJOR)"
# ============================================================
CURRENT_PG_MAJOR=0
if command -v psql >/dev/null 2>&1; then
  CURRENT_PG_MAJOR="$(psql --version | grep -oE '[0-9]+' | head -n1)"
fi

if [ "$CURRENT_PG_MAJOR" -ge "$REQ_PG_MAJOR" ] 2>/dev/null; then
  ok "PostgreSQL $(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -n1)"
  systemctl is-active --quiet postgresql 2>/dev/null && ok "servicio postgresql activo" || warn "servicio postgresql no está corriendo (systemctl start postgresql)"
else
  warn "PostgreSQL no está instalado o es menor a v$REQ_PG_MAJOR"
  if ask_yes_no "¿Instalar PostgreSQL con apt ahora?"; then
    sudo apt update && sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable --now postgresql
    ok "PostgreSQL instalado y activo"
  else
    MISSING_ANY=1
  fi
fi

# ============================================================
step "5/6 · Redis (opcional — solo si vas a usar REDIS_ENABLED=true)"
# ============================================================
if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
  ok "Redis activo ($(redis-cli --version))"
else
  warn "Redis no está instalado/activo. Es opcional: sin él, el backend usa caché LRU local."
  if ask_yes_no "¿Instalar y activar redis-server ahora?"; then
    sudo apt update && sudo apt install -y redis-server
    sudo systemctl enable --now redis-server
    redis-cli ping >/dev/null 2>&1 && ok "Redis instalado y respondiendo" || fail "Redis instalado pero no responde a ping"
  else
    warn "Se omite Redis — el backend usará REDIS_ENABLED=false"
  fi
fi

# ============================================================
step "6/6 · Archivo .env, llaves JWT y base de datos"
# ============================================================
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
  ok ".env ya existe en fourier-backend/ — no se sobreescribe"
else
  if [ ! -f "$ENV_EXAMPLE" ]; then
    fail "No se encontró $ENV_EXAMPLE, no se puede generar .env"
  else
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    JWT_ACCESS_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))" 2>/dev/null)"
    JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))" 2>/dev/null)"

    if [ -n "$JWT_ACCESS_SECRET" ] && [ -n "$JWT_REFRESH_SECRET" ]; then
      # separador '|' porque los secrets en base64 pueden traer '/'
      sed -i "s|JWT_ACCESS_SECRET=your_access_secret_here|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|" "$ENV_FILE"
      sed -i "s|JWT_REFRESH_SECRET=your_refresh_secret_here|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "$ENV_FILE"
      ok "fourier-backend/.env creado con llaves JWT generadas automáticamente"
    else
      warn "No se pudieron generar las llaves JWT (¿Node disponible?). Genera manualmente con:"
      echo "    node -e \"console.log(require('crypto').randomBytes(64).toString('base64'))\""
    fi

    warn "Faltan por completar a mano en fourier-backend/.env:"
    echo "    - DATABASE_URL (usuario/password de Postgres)"
    echo "    - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (OAuth)"
    echo "    - SMTP_USER / SMTP_PASS / SMTP_FROM (envío de correo)"
  fi
fi

# --- Base de datos Postgres ---
if command -v psql >/dev/null 2>&1; then
  USER_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'fourier_user'" 2>/dev/null | tr -d '[:space:]')"
  DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'fourier_db'" 2>/dev/null | tr -d '[:space:]')"

  if [ "$USER_EXISTS" = "1" ] && [ "$DB_EXISTS" = "1" ]; then
    ok "Usuario fourier_user y base fourier_db ya existen — no se toca la contraseña"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE fourier_db TO fourier_user;" >/dev/null \
      && sudo -u postgres psql -d fourier_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fourier_user; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fourier_user;" >/dev/null \
      && ok "Permisos de fourier_user sobre fourier_db verificados/otorgados"
  else
    if ask_yes_no "¿Crear la base de datos 'fourier_db' y el usuario 'fourier_user' ahora?"; then
      read -r -p "  Password para fourier_user (Enter para generar una aleatoria): " DB_PASS
      if [ -z "$DB_PASS" ]; then
        DB_PASS="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64').replace(/[+/=]/g,''))" 2>/dev/null || openssl rand -hex 12)"
        echo "  Password generada: $DB_PASS"
      fi

      sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fourier_user') THEN
      CREATE USER fourier_user WITH PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;
SELECT 'CREATE DATABASE fourier_db OWNER fourier_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fourier_db')\gexec
GRANT ALL PRIVILEGES ON DATABASE fourier_db TO fourier_user;
SQL

      if [ $? -eq 0 ]; then
        ok "Usuario fourier_user y base fourier_db listos"

        if [ -f "$ENV_FILE" ]; then
          sed -i "s|DATABASE_URL=postgresql://your_db_user:your_db_password@localhost:5432/your_db_name|DATABASE_URL=postgresql://fourier_user:${DB_PASS}@localhost:5432/fourier_db|" "$ENV_FILE"
          ok "DATABASE_URL actualizado en .env"
        fi
      else
        fail "Error creando el usuario/base de datos. Revisa el mensaje de psql arriba."
      fi
    fi
  fi

  if [ -f "$DB_DIR/fourier_db.sql" ] && [ "$DB_EXISTS" != "1" ]; then
    if ask_yes_no "¿Cargar el schema (fourier_db.sql) en fourier_db ahora?"; then
      sudo -u postgres psql -d fourier_db -f "$DB_DIR/fourier_db.sql" \
        && sudo -u postgres psql -d fourier_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fourier_user; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fourier_user;" \
        && ok "Schema cargado y permisos otorgados a fourier_user"
    fi
  fi
else
  warn "psql no disponible, no se puede crear la base de datos automáticamente"
fi

# ============================================================
step "npm install (backend + frontend)"
# ============================================================
if command -v npm >/dev/null 2>&1; then
  if ( cd "$BACKEND_DIR" && npm install ); then
    ok "Dependencias del backend instaladas"
  else
    fail "npm install falló en fourier-backend/ (ver salida arriba)"
    MISSING_ANY=1
  fi

  if ( cd "$FRONTEND_DIR" && npm install ); then
    ok "Dependencias del frontend instaladas"
  else
    fail "npm install falló en fourier-frontend/ (ver salida arriba)"
    warn "Si es un conflicto de peer dependencies de @angular/*, revisa que todos los paquetes @angular/* usen la misma versión en package.json"
    MISSING_ANY=1
  fi
else
  fail "npm no disponible, no se pudo correr npm install"
  MISSING_ANY=1
fi

# ============================================================
echo ""
if [ "$MISSING_ANY" -eq 0 ]; then
  echo -e "${C_GREEN}✓ Entorno listo.${C_RESET} Revisa fourier-backend/.env y luego:"
else
  echo -e "${C_YELLOW}! Setup incompleto — revisa las advertencias de arriba.${C_RESET} Cuando esté todo, corre:"
fi
echo "    cd fourier-backend  && npm run dev"
echo "    cd fourier-frontend && npm start"
