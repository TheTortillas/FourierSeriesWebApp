# Fourier Web Calculator - Makefile

.PHONY: install install-backend install-frontend clean clean-backend clean-frontend \
        dev dev-backend dev-frontend start stop help all

# ── Install ──────────────────────────────────────────────────────────────────

install: install-backend install-frontend
	@echo "All dependencies installed."

install-backend:
	@echo "Installing backend dependencies..."
	@(cd fourier-backend && npm install)

install-frontend:
	@echo "Installing frontend dependencies..."
	@(cd fourier-frontend && npm install)

# ── Clean ────────────────────────────────────────────────────────────────────

clean: clean-backend clean-frontend
	@echo "Clean complete."

clean-backend:
	@rm -rf fourier-backend/node_modules fourier-backend/dist

clean-frontend:
	@rm -rf fourier-frontend/node_modules fourier-frontend/dist

# ── Dev ──────────────────────────────────────────────────────────────────────

dev:
	@echo "Starting backend (port 3000) and frontend (port 4200)..."
	@(cd fourier-backend && npm run dev) & (cd fourier-frontend && ng serve)

dev-backend:
	@echo "Starting backend in dev mode..."
	@cd fourier-backend && npm run dev

dev-frontend:
	@echo "Starting frontend dev server..."
	@cd fourier-frontend && ng serve

start: dev

stop:
	@echo "Use Ctrl+C in the terminal running the service, or: kill \$$(lsof -ti:3000) \$$(lsof -ti:4200)"

# ── Help ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install         Install all dependencies (backend + frontend)"
	@echo "  install-backend Install backend deps only"
	@echo "  install-frontend Install frontend deps only"
	@echo ""
	@echo "  dev             Run backend + frontend simultaneously"
	@echo "  dev-backend     Run backend only (tsx watch, port 3000)"
	@echo "  dev-frontend    Run frontend only (ng serve, port 4200)"
	@echo ""
	@echo "  clean           Remove node_modules and dist from both"
	@echo "  clean-backend   Remove backend node_modules/dist"
	@echo "  clean-frontend  Remove frontend node_modules/dist"
	@echo ""
	@echo "  stop            How to stop running services"
	@echo "  help            Show this message"
	@echo ""

all: install
