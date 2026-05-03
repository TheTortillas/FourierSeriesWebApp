# Evaluación del Graficador — Fourier Web Calculator

**Calificación: 7/10**  
Fecha: 2026-04-29

---

## Lo que está bien

- **Arquitectura limpia.** Separación correcta en `PlottingService`, `CanvasRendererService`, `CoordinateTransformService`, `MathUtilsService`. Cada servicio tiene una responsabilidad única.
- **Traducción Maxima→JS cuidadosa.** `_fixUnaryMinusPow`, `_replaceNestedFn`, `_replaceMathEPow` manejan edge cases que la mayoría de graficadores ad-hoc ignoran.
- **Discontinuidades.** `MAX_JUMP_PX` corta el path en saltos grandes — correcto sin necesitar análisis simbólico.
- **Deltas de Dirac.** `parseDeltaTerms` + `drawImpulse` es una solución elegante para algo que casi todos los graficadores omiten.
- **HiDPI / ResizeObserver / RAF.** Los fundamentos del canvas están bien hechos.
- **Smoke-test multi-punto.** Probar en `[0, 1, -1, 0.5, π]` antes de rechazar evita falsos negativos por singularidades en x=0.

---

## Lo que arreglaría

### 1. Muestreo uniforme ciego — el problema más grande (−1.5 pts)

`sampleVisible` distribuye `cssWidth × 2` puntos uniformemente. Para funciones con variación rápida en una zona pequeña (`sinc`, `e^{-x²}`, resonancias) el muestreo es denso donde sobra y escaso donde importa. Un muestreador adaptivo que refine donde `|f''|` es grande daría curvas más suaves con el mismo costo.

### 2. `_stubUnknownFunctions` es frágil (−0.5 pts)

El regex de identificadores puede matchear tokens inesperados tras las sustituciones. Alternativa más robusta: compilar el JS con un `Proxy` que atrape `ReferenceError` en tiempo de ejecución, en lugar de reescribir la expresión estáticamente.

### 3. Sin caché de compilación (−0.5 pts)

`compile()` recrea `new Function` en cada frame del RAF para cada curva. Para expresiones que no cambian, un `Map<string, JsFunction>` haría diferencia real al hacer scroll/zoom.

### 4. Smoke test aún heurístico

Si la función es válida pero devuelve `NaN` en todos los puntos de prueba (e.g. `sqrt(x)` con todos puntos negativos), `compile()` devuelve `null`. Mejor: nunca rechazar si el JS es sintácticamente válido; dejar que el muestreador filtre los `NaN`.

---

## Lo que añadiría para convertirlo en biblioteca

| Feature | Por qué importa |
|---|---|
| **API declarativa de capas** | Hoy el `onDraw` es un closure monolítico. Una biblioteca expone `addCurve(expr, opts)`, `addParametric(x(t), y(t))`, `addVectorField()`. |
| **Hover / tooltip** | Mostrar `(x, y)` al pasar el mouse. La feature más pedida en graficadores, completamente ausente. |
| **Coordenadas marcables** | Raíces, extremos, intersecciones — marcados automáticamente o manualmente. |
| **Exportación SVG real** | El canvas actual exporta raster. Un SVG con paths matemáticos es útil para publicaciones. |
| **Soporte paramétrico y polar** | `r(θ)` y `(x(t), y(t))` son triviales sobre la infraestructura existente. |
| **Animación de parámetros** | Slider que anima `a` de 0 a 5 mientras la curva se redibuja. La estructura con signals ya lo permite; solo falta la UI. |
