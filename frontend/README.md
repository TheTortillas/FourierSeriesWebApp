# README: Fourier Web Calculator (Frontend)

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación](#instalación)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Ejecución de la Aplicación](#ejecución-de-la-aplicación)
5. [Características Principales](#características-principales)
6. [Componentes](#componentes)
7. [Servicios](#servicios)
8. [Integración con Backend](#integración-con-backend)
9. [Personalización](#personalización)
10. [Solución de Problemas](#solución-de-problemas)

## Requisitos Previos

Para utilizar este frontend correctamente, necesitas tener instalado:

- [Node.js](https://nodejs.org/) (v16 o superior)
- [npm](https://www.npmjs.com/) (viene con Node.js)
- [Angular CLI](https://angular.io/cli) (v18 o superior)

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/TheTortillas/FourierSeriesWebApp.git
cd FourierSeriesWebApp/frontend
```

2. Instala las dependencias:

```bash
npm install
```

3. Configura la conexión con el backend:
   - Asegúrate que el archivo `src/app/environments/environment.development.ts` tenga la URL correcta del backend.
   - Por defecto, apunta a `http://localhost:3000`.

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/            # Servicios core, modelos e interceptores
│   │   │   ├── services/    # Servicios principales
│   │   │   └── ...
│   │   ├── pages/           # Componentes de página
│   │   │   ├── about-us/
│   │   │   ├── fourier-calculator/
│   │   │   ├── fourier-series-plot/
│   │   │   ├── dft-plot/
│   │   │   ├── home/
│   │   │   └── ...
│   │   ├── shared/          # Componentes compartidos
│   │   │   ├── components/  # Componentes reutilizables
│   │   │   └── ...
│   │   └── ...
│   ├── assets/              # Recursos estáticos
│   ├── environments/        # Configuración de entorno
│   └── ...
└── ...
```

## Ejecución de la Aplicación

Para iniciar la aplicación en modo desarrollo:

```bash
npm start
```

O usando Angular CLI:

```bash
ng serve
```

La aplicación se ejecutará en [http://localhost:4200](http://localhost:4200) por defecto.

Para construir la aplicación para producción:

```bash
npm run build
```

## Características Principales

- **Calculadora Interactiva de Series de Fourier**:

  - Series de Fourier Trigonométricas
  - Series de Fourier Complejas
  - Series de Medio Rango

- **Visualización de Transformada Discreta de Fourier (DFT)**:

  - Análisis espectral
  - Visualización de amplitud y fase

- **Visualización Interactiva**:

  - Representaciones gráficas dinámicas
  - Personalización de parámetros visuales
  - Zoom, pan y otras interacciones

- **Entrada Matemática Avanzada**:

  - Editor de expresiones matemáticas con MathQuill
  - Soporte para funciones trigonométricas, exponenciales, logarítmicas, etc.
  - Funciones definidas por tramos

- **Accesibilidad**:
  - Modo claro/oscuro
  - Diseño responsive para dispositivos móviles y de escritorio

## Componentes

### Componentes Principales

- **Calculadora de Fourier**: Interfaz para ingresar funciones y calcular series de Fourier.
- **Visualizadores de Gráficos**: Componentes para mostrar funciones originales y sus aproximaciones por series de Fourier.
- **Canvas Cartesiano**: Componente personalizado para graficar funciones matemáticas.
- **Teclado Matemático**: Herramienta para facilitar la entrada de expresiones matemáticas.

### Componentes Compartidos

- **Theme Toggle**: Selector de tema claro/oscuro.
- **Cartesian Canvas**: Componente para graficar funciones en un plano cartesiano.
- **Survey Button**: Botón para encuestas y feedback.
- **Footer**: Pie de página con información de contacto.

## Servicios

### Servicios Core

- **ApiService**: Gestiona las comunicaciones con el backend.
- **MathquillService**: Maneja la integración con la biblioteca MathQuill.
- **MathUtilsService**: Proporciona funciones matemáticas y utilidades.
- **ThemeService**: Gestiona la apariencia del tema (claro/oscuro).
- **LatexToMaximaService**: Convierte expresiones LaTeX a formato Maxima.

## Integración con Backend

La aplicación Frontend se comunica con el backend a través de una API REST. Las principales integraciones incluyen:

- Cálculo de coeficientes de series de Fourier
- Transformación de funciones mediante DFT
- Validación de funciones matemáticas
- Generación de expansiones de series

La URL del backend se configura en el archivo de entorno (`environment.ts`).

## Personalización

### Temas

La aplicación incluye temas claro y oscuro. Puedes cambiar entre ellos utilizando el botón de alternancia de tema en la esquina superior derecha.

### Gráficos

Los componentes de visualización permiten personalizar diversos aspectos:

- Colores de funciones
- Grosores de línea
- Escalas de ejes
- Número de términos en la serie
- Visualización de componentes individuales

## Solución de Problemas

### Problemas comunes

1. **Errores de conexión con el backend**:

   - Verifica que el backend esté ejecutándose
   - Comprueba la URL configurada en `environment.ts`
   - Verifica que CORS esté correctamente configurado en el backend

2. **Problemas con las visualizaciones matemáticas**:

   - Asegúrate de que MathJax esté correctamente cargado
   - Comprueba que las expresiones LaTeX sean válidas
   - Verifica la consola del navegador para errores específicos

3. **Problemas de rendimiento**:
   - Reduce la resolución de los gráficos para dispositivos de menor rendimiento
   - Evita funciones excesivamente complejas que puedan sobrecargar el navegador

## Licencia

Este proyecto está licenciado bajo ISC License.

---
