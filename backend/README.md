# README: Fourier Web Calculator (Backend)

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación](#instalación)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Configuración](#configuración)
5. [Ejecución del Servidor](#ejecución-del-servidor)
6. [Endpoints API](#endpoints-api)
7. [Herramientas Matemáticas](#herramientas-matemáticas)
8. [Utilidades y Servicios](#utilidades-y-servicios)
9. [Documentación](#documentación)
10. [Solución de Problemas](#solución-de-problemas)

## Requisitos Previos

Para utilizar este backend correctamente, necesitas tener instalado:

- [Node.js](https://nodejs.org/) (v14 o superior)
- [npm](https://www.npmjs.com/) (viene con Node.js)
- [Maxima](https://maxima.sourceforge.io/) (Sistema de álgebra computacional)
- **Sistema operativo Linux** (Ubuntu, Debian, Arch Linux, etc.)

### Requisito de Sistema Operativo Linux

> ⚠️ **IMPORTANTE**: Este backend SOLO FUNCIONA en sistemas Linux y no puede ejecutarse en Windows. Esto se debe a dos diferencias fundamentales:

1. **Ejecución de comandos externos:** En Linux y Windows, los comandos para invocar Maxima desde Node.js tienen sintaxis diferente:

   - En Linux: `echo "declare(n, integer)$ string(integrate(${func}, x));" | maxima --very-quiet`
   - En Windows: `echo declare(n, integer)$ string(integrate(${func}, x)); | maxima --very-quiet`

2. **Operadores matemáticos:** Windows tiene problemas con ciertos operadores matemáticos como el de potencia (`^`). En Windows se requiere reemplazar `^` por `**`, mientras que en Linux esto no es necesario.

Estas diferencias hacen que la integración entre Node.js y Maxima solo sea viable en entornos Linux para esta aplicación.

### Instalación de Maxima

Maxima es fundamental para este proyecto, ya que realiza todos los cálculos matemáticos complejos. Instrucciones de instalación:

**En Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install maxima
```

**En Arch Linux:**

```bash
sudo pacman -S maxima
```

**En macOS (usando Homebrew):**

```bash
brew install maxima
```

Verifica la instalación correcta ejecutando:

```bash
maxima --version
```

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/TheTortillas/FourierSeriesWebApp.git
cd FourierSeriesWebApp/backend
```

2. Instala las dependencias:

```bash
npm install
```

3. Verifica que Maxima esté disponible desde la línea de comandos:

```bash
maxima --version
```

## Estructura del Proyecto

```
backend/
├── package.json        # Dependencias y scripts
├── src/
│   ├── server.js       # Punto de entrada al servidor
│   ├── app.js          # Configuración de Express
│   └── api/
│       ├── config/     # Configuraciones (CORS, Swagger)
│       ├── controllers/# Controladores para cada ruta
│       ├── routes/     # Definiciones de rutas
│       ├── services/   # Lógica de negocio
│       └── utils/      # Utilidades (conexión con Maxima)
```

### Descripción de los Directorios Principales

- **api/config/**: Contiene archivos de configuración como CORS y Swagger.
- **api/controllers/**: Maneja las solicitudes HTTP y envía respuestas.
- **api/routes/**: Define las rutas de la API y asocia cada endpoint con su controlador correspondiente.
- **api/services/**: Contiene la lógica de negocio para cada tipo de cálculo.
- **api/utils/**: Incluye utilidades para comunicarse con Maxima y procesar resultados matemáticos.

## Configuración

### CORS

La configuración CORS se encuentra en `src/api/config/cors.config.js`. Por defecto, permite solicitudes desde cualquier origen (`*`).

### Swagger

La documentación Swagger se configura en `src/api/config/swagger.config.js`. Define la información básica de la API y escanea los archivos de rutas para generar documentación automática.

## Ejecución del Servidor

Para iniciar el servidor en modo desarrollo:

```bash
node src/server.js
```

El servidor se ejecutará en [http://localhost:3000](http://localhost:3000) de manera predeterminada. Puedes cambiar el puerto mediante la variable de entorno `PORT`:

```bash
PORT=8080 node src/server.js
```

## Endpoints API

La API se organiza en varios grupos de endpoints:

### Series de Fourier

#### Series Trigonométricas

- **POST** `/fourier-series/trigonometric`: Calcula los coeficientes de una serie trigonométrica de Fourier.
- **POST** `/fourier-series/trigonometric-piecewise`: Calcula coeficientes para una función definida por tramos.

#### Series Complejas

- **POST** `/fourier-series/complex`: Calcula coeficientes para series complejas de Fourier.
- **POST** `/fourier-series/complex-piecewise`: Calcula coeficientes para una función compleja por tramos.

#### Series de Medio Rango

- **POST** `/fourier-series/half-range`: Calcula series de Fourier de medio rango definida por tramos.

### Expansión de Series

- **POST** `/series-expansion/trigonometric`: Expande una serie trigonométrica en términos individuales.
- **POST** `/series-expansion/half-range`: Expande una serie de medio rango.
- **POST** `/series-expansion/complex`: Expande una serie compleja, con opción para aplicar la fórmula de De Moivre.

### Transformada Discreta de Fourier (DFT)

- **POST** `/dft/calculate`: Calcula la DFT de una función definida por tramos.

### Funciones Auxiliares

- **POST** `/auxiliar-functions/check-integrability`: Verifica si una función dada es integrable.

## Herramientas Matemáticas

### Maxima

Maxima es el motor matemático principal detrás de esta aplicación. Se utiliza para:

- Calcular coeficientes de Fourier
- Evaluar integrales
- Simplificar expresiones
- Calcular transformadas discretas de Fourier
- Generar representaciones LaTeX

### Integración con Maxima

La comunicación con Maxima se maneja principalmente a través de los módulos ubicados en `src/api/utils/`:

- **maxima.util.js**: Proporciona funciones para ejecutar comandos en Maxima.
- **maxima-rules.util.js**: Define reglas de simplificación para Maxima.
- **fourier-validation.util.js**: Verifica la integrabilidad de funciones.
- **series-expansion.util.js**: Maneja la expansión de series en términos individuales.
- **piecewise-series.util.js**: Procesa cálculos de series para funciones definidas por tramos.

## Utilidades y Servicios

### Utilidades

- **Validación**: El sistema valida matemáticamente todas las entradas antes de realizar cálculos.
- **Manejo de indeterminaciones**: Detecta valores indeterminados en coeficientes y calcula sus límites.
- **Parsing de listas**: Interpreta estructuras de datos complejas devueltas por Maxima.

### Servicios

Los servicios principales están organizados en:

- **fourier-series-maxima.service.js**: Cálculos de series de Fourier.
- **series-expansion.service.js**: Expansión de series en términos.
- **dft-maxima.service.js**: Cálculo de DFT.
- **auxiliar-functions-maxima.service.js**: Funciones auxiliares como verificación de integrabilidad.

## Documentación

La API está documentada utilizando Swagger. Puedes acceder a la documentación interactiva en:

```
http://localhost:3000/api-docs
```

Esta interfaz te permite:

- Ver todos los endpoints disponibles
- Probar las API directamente desde el navegador
- Ver los esquemas de solicitud y respuesta
- Entender los parámetros requeridos para cada endpoint

## Solución de Problemas

### Problemas comunes con Maxima

1. **Maxima no encontrado**:

   - Verifica que Maxima esté instalado correctamente: `maxima --version`
   - Asegúrate de que esté en tu PATH de sistema

2. **Error en los cálculos**:

   - Verifica si la expresión matemática es válida
   - Comprueba si hay divisiones por cero o logaritmos de valores negativos
   - Algunas funciones no son integrables en forma cerrada

3. **Rendimiento lento**:
   - Los cálculos simbólicos complejos pueden tardar tiempo
   - Considera simplificar las expresiones matemáticas
   - Las funciones a trozos con muchos segmentos son más lentas

### Errores HTTP comunes

- **500 (Error interno)**: Generalmente indica un error en la integración con Maxima o un error en el procesamiento del resultado.
- **422 (Unprocessable Entity)**: La función matemática proporcionada no puede ser procesada (no integrable, contiene funciones especiales, etc.).

## Licencia

Este proyecto está licenciado bajo ISC License.

---
