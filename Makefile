# Fourier Web Calculator - Makefile
# Automatiza la instalación de dependencias para backend y frontend

.PHONY: install install-backend install-frontend clean clean-backend clean-frontend help dev dev-backend dev-frontend start stop all

# Instalar dependencias en ambos proyectos
install: install-backend install-frontend
	@echo "✅ Todas las dependencias instaladas correctamente"

# Instalar dependencias del backend
install-backend:
	@echo "📦 Instalando dependencias del backend..."
	@(cd backend && npm install)
	@echo "✅ Backend instalado"

# Instalar dependencias del frontend
install-frontend:
	@echo "🎨 Instalando dependencias del frontend..."
	@(cd frontend && npm install)
	@echo "✅ Frontend instalado"

# Limpiar node_modules
clean: clean-backend clean-frontend
	@echo "🧹 Limpieza completada"

clean-backend:
	@echo "🧹 Limpiando node_modules del backend..."
	@rm -rf backend/node_modules
	@rm -f backend/package-lock.json

clean-frontend:
	@echo "🧹 Limpiando node_modules del frontend..."
	@rm -rf frontend/node_modules
	@rm -f frontend/package-lock.json

# Ejecutar en modo desarrollo (ambos servicios)
dev:
	@echo "🚀 Iniciando servicios en modo desarrollo..."
	@echo "📡 Backend en puerto 3000 (con --watch)"
	@echo "🎨 Frontend en puerto 4200"
	@echo "💡 Usa Ctrl+C para detener ambos servicios"
	@(cd backend/src && node --watch server.js) & (cd frontend && ng serve)

# Ejecutar solo el backend en modo desarrollo
dev-backend:
	@echo "📡 Iniciando backend en modo desarrollo..."
	@echo "🔄 Servidor con auto-reload habilitado"
	@echo "🌐 Disponible en http://localhost:3000"
	@cd backend/src && node --watch server.js

# Ejecutar solo el frontend en modo desarrollo
dev-frontend:
	@echo "🎨 Iniciando frontend en modo desarrollo..."
	@echo "🌐 Disponible en http://localhost:4200"
	@cd frontend && ng serve

# Alias para dev
start: dev

# Detener servicios (ayuda para recordar el comando)
stop:
	@echo "⚠️  Para detener los servicios usa Ctrl+C en la terminal correspondiente"
	@echo "💡 O cierra las terminales donde están ejecutándose"

# Mostrar ayuda
help:
	@echo "📖 Comandos disponibles:"
	@echo ""
	@echo "🔧 INSTALACIÓN:"
	@echo "  make install          - Instalar dependencias de backend y frontend"
	@echo "  make install-backend  - Instalar solo dependencias del backend"
	@echo "  make install-frontend - Instalar solo dependencias del frontend"
	@echo ""
	@echo "🚀 DESARROLLO:"
	@echo "  make dev              - Ejecutar ambos servicios en modo desarrollo"
	@echo "  make dev-backend      - Ejecutar solo el backend (con --watch)"
	@echo "  make dev-frontend     - Ejecutar solo el frontend (ng serve)"
	@echo "  make start            - Alias para 'make dev'"
	@echo ""
	@echo "🧹 LIMPIEZA:"
	@echo "  make clean            - Limpiar todos los node_modules"
	@echo "  make clean-backend    - Limpiar node_modules del backend"
	@echo "  make clean-frontend   - Limpiar node_modules del frontend"
	@echo ""
	@echo "ℹ️  AYUDA:"
	@echo "  make help             - Mostrar esta ayuda"
	@echo "  make stop             - Información sobre cómo detener servicios"

# Por defecto ejecutar install
all: install
