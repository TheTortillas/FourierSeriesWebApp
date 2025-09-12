# Fourier Web Calculator - Makefile
# Automatiza la instalación de dependencias para backend y frontend

.PHONY: install install-backend install-frontend clean clean-backend clean-frontend help dev all

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
	@echo "Backend en puerto 3000, Frontend en puerto 4200"
	@(cd backend && npm start) & (cd frontend && npm start)

# Mostrar ayuda
help:
	@echo "Comandos disponibles:"
	@echo "  make install          - Instalar dependencias de backend y frontend"
	@echo "  make install-backend  - Instalar solo dependencias del backend"
	@echo "  make install-frontend - Instalar solo dependencias del frontend"
	@echo "  make clean            - Limpiar todos los node_modules"
	@echo "  make clean-backend    - Limpiar node_modules del backend"
	@echo "  make clean-frontend   - Limpiar node_modules del frontend"
	@echo "  make dev              - Ejecutar ambos servicios en modo desarrollo"
	@echo "  make help             - Mostrar esta ayuda"

# Por defecto ejecutar install
all: install
