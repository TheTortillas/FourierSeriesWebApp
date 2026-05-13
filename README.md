<div align="center">
  <h1>Fourier Web Calculator</h1>
  
  <p>
    <img src="https://img.shields.io/badge/Version-1.0.0-brightgreen" alt="Version"/>
    <img src="https://img.shields.io/badge/Angular-18-red" alt="Angular"/>
    <img src="https://img.shields.io/badge/Node.js-16+-green" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Maxima-CAS-blue" alt="Maxima"/>
  </p>

  <p>Una aplicación web completa para el cálculo, visualización y exploración interactiva<br>de Series de Fourier y la Transformada Discreta de Fourier (DFT)</p>
  
  <hr>
</div>
<!--deepwiki-title: Fourier Web Calculator-->
<!--deepwiki-description: Una aplicación web completa para el cálculo, visualización y exploración interactiva de Series de Fourier y la Transformada Discreta de Fourier (DFT). Combina un potente motor matemático basado en Maxima con una interfaz visual moderna desarrollada en Angular.-->
<!--deepwiki-stack: Angular 18, Node.js, Express, Maxima CAS, TypeScript, TailwindCSS, MathJax, MathQuill-->
<!--deepwiki-keywords: series de fourier, transformada discreta de fourier, DFT, cálculo matemático, visualización interactiva, maxima cas, funciones por tramos, análisis de espectro, procesamiento de señales-->
<!--deepwiki-main: frontend/src/app/-->
<!--deepwiki-main: backend/src/server.js-->
<!--deepwiki-main: backend/src/routes/-->
<!--deepwiki-main: frontend/src/app/components/-->

**Fourier Web Calculator** es una herramienta educativa que combina un potente motor matemático basado en Maxima con una interfaz visual moderna desarrollada en Angular para facilitar la comprensión y el análisis de Series de Fourier y Transformada Discreta de Fourier.

## 🌟 Características Destacadas

- **Cálculo avanzado de series de Fourier:**

  - Series Trigonométricas
  - Series Complejas
  - Series de Medio Rango
  - Transformada Discreta de Fourier (DFT)

- **Visualizaciones interactivas:**

  - Gráficos dinámicos de funciones y sus aproximaciones
  - Análisis de espectro de amplitud y fase
  - Visualización de términos individuales

- **Interfaz matemática intuitiva:**
  - Editor de expresiones matemáticas integrado
  - Soporte para funciones definidas por tramos
  - Validación matemática instantánea

El proyecto está dividido en dos componentes principales:

```
Fourier-Web-Calculator/
├── frontend/        # Aplicación Angular (interfaz de usuario)
└── backend/         # Servidor Node.js con Express (motor matemático)
```

Cada componente tiene su propio README.md con instrucciones detalladas:

- [Documentación del Frontend](./frontend/README.md)
- [Documentación del Backend](./backend/README.md)

## 📋 Requisitos Previos

Para ejecutar el proyecto completo necesitas:

- **Node.js** (v16 o superior)
- **npm** (viene con Node.js)
- **Angular CLI** (v18 o superior)
- **Maxima CAS** (Sistema de Álgebra Computacional)
- **Sistema operativo Linux** (Ubuntu, Debian, etc.) para el backend
- **Make** (opcional, para usar la instalación automatizada)

> ⚠️ **IMPORTANTE**: El backend DEBE ejecutarse en un sistema operativo Linux. Esto se debe a diferencias fundamentales en cómo Node.js ejecuta los comandos de Maxima en distintos sistemas operativos. No es posible ejecutar el backend en Windows.

### Instalación de Maxima

Maxima es esencial para los cálculos matemáticos. Instrucciones básicas:

**Linux:**

```bash
# Ubuntu/Debian
sudo apt-get install maxima

# Arch Linux
sudo pacman -S maxima
```

**macOS:**

```bash
brew install maxima
```

**Windows:**
Descarga el instalador desde la [página oficial de Maxima](https://maxima.sourceforge.io/download.html).

## 🚀 Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/TheTortillas/FourierSeriesWebApp.git
cd FourierSeriesWebApp
```

### 2. Configurar el Backend

```bash
cd backend
npm install
# Inicia el servidor (por defecto en puerto 3000)
node src/server.js
```

### 3. Configurar el Frontend

```bash
cd ../frontend
npm install
# Inicia la aplicación Angular (por defecto en puerto 4200)
ng serve
```

### 🔥 Instalación Rápida con Makefile

Para simplificar el proceso de instalación, el proyecto incluye un **Makefile** que automatiza la instalación de dependencias en ambos proyectos con un solo comando:

```bash
# Instalar dependencias de backend y frontend automáticamente
make install
```

#### Comandos disponibles del Makefile:

| Comando                 | Descripción                                |
| ----------------------- | ------------------------------------------ |
| `make install`          | Instala dependencias de backend y frontend |
| `make install-backend`  | Instala solo dependencias del backend      |
| `make install-frontend` | Instala solo dependencias del frontend     |
| `make clean`            | Limpia todos los node_modules              |
| `make clean-backend`    | Limpia node_modules del backend            |
| `make clean-frontend`   | Limpia node_modules del frontend           |
| `make help`             | Muestra todos los comandos disponibles     |

> **💡 Ventaja**: Con `make install` evitas tener que entrar manualmente a cada directorio y ejecutar `npm install` por separado. Ideal para clonar el repositorio y ponerlo en funcionamiento rápidamente.

### 🚀 Ejecutar los Servicios

Una vez instaladas las dependencias, puedes ejecutar los servicios de desarrollo con el Makefile:

#### Comandos de ejecución disponibles:

| Comando             | Descripción                                              |
| ------------------- | -------------------------------------------------------- |
| `make dev`          | Ejecuta backend y frontend simultáneamente en background |
| `make run-backend`  | Ejecuta solo el backend con `node --watch` (puerto 3000) |
| `make run-frontend` | Ejecuta solo el frontend con `ng serve` (puerto 4200)    |
| `make stop`         | Detiene todos los procesos en background                 |

#### Ejemplos de uso:

```bash
# Opción 1: Ejecutar ambos servicios simultáneamente
make dev

# Opción 2: Ejecutar cada servicio por separado (recomendado para desarrollo)
# Terminal 1:
make run-backend

# Terminal 2:
make run-frontend

# Para detener servicios en background:
make stop
```

> **🔧 Detalles técnicos**:
>
> - El backend se ejecuta con `node --watch server.js` para reinicio automático
> - El frontend se ejecuta con `ng serve` en modo desarrollo
> - Los servicios corren en puertos 3000 (backend) y 4200 (frontend) respectivamente

### 4. Acceder a la Aplicación

Una vez que ambos servicios estén ejecutándose (ya sea con `make dev` o ejecutándolos por separado), abre tu navegador y visita:

```
http://localhost:4200
```

> **📌 Nota**: Asegúrate de que tanto el backend (puerto 3000) como el frontend (puerto 4200) estén ejecutándose antes de acceder a la aplicación.

## 💡 Uso

1. **Selecciona el tipo de cálculo:**

   - Serie de Fourier Trigonométrica
   - Serie de Fourier Compleja
   - Serie de Medio Rango
   - Transformada Discreta de Fourier (DFT)

2. **Define tu función:**

   - Utiliza el editor matemático para ingresar tu función
   - Añade múltiples tramos si es necesario
   - Define el intervalo de análisis

3. **Visualiza los resultados:**
   - Explora la función original y su aproximación por series
   - Ajusta el número de términos
   - Analiza el espectro de frecuencias
   - Personaliza la visualización

## 🔧 Tecnologías Utilizadas

### Frontend

- **Angular 18**
- **TypeScript**
- **TailwindCSS**
- **MathJax** y **MathQuill** para renderizado matemático

### Backend

- **Node.js** con **Express**
- **Maxima CAS** para cálculos simbólicos

## 📜 Licencia

Este proyecto se distribuye bajo una licencia personalizada de uso no comercial.  
Puedes consultar los términos completos en el archivo [`LICENSE`](./LICENSE).  
Para uso comercial, contacta al autor.

## 🙏 Agradecimientos

Esta herramienta ha sido desarrollada con propósitos educativos para facilitar la comprensión de las Series de Fourier y la Transformada Discreta de Fourier, conceptos fundamentales en procesamiento de señales, telecomunicaciones y muchos otros campos.

---
