# Evaluación del Graficador — Fourier Web Calculator

**Calificación original: 7/10** (2026-04-29)  
**Calificación post-refactor: 8.5/10** (2026-05-27, branch `feature/canvas-cleanup`)

---

## Lo que está bien (original)

- **Arquitectura limpia.** Separación correcta en `PlottingService`, `CanvasRendererService`, `CoordinateTransformService`, `MathUtilsService`. Cada servicio tiene una responsabilidad única.
- **Traducción Maxima→JS cuidadosa.** `_fixUnaryMinusPow`, `_replaceNestedFn`, `_replaceMathEPow` manejan edge cases que la mayoría de graficadores ad-hoc ignoran.
- **Discontinuidades.** `MAX_JUMP_PX` corta el path en saltos grandes — correcto sin necesitar análisis simbólico.
- **Deltas de Dirac.** `parseDeltaTerms` + `drawImpulse` es una solución elegante para algo que casi todos los graficadores omiten.
- **HiDPI / ResizeObserver / RAF.** Los fundamentos del canvas están bien hechos.

---

## Problemas originales → Estado post-refactor

### ✅ 1. Valores hardcodeados esparcidos (−0.5 pts → RESUELTO)

`MAX_JUMP_PX = 120`, `TARGET_GRID_PX = 80`, `MIN_LABEL_GAP = 44`, `MIN_UNIT = 1e-4`, font strings
hardcodeados en múltiples servicios. → Centralizado en `CanvasRenderConfig` / `DEFAULT_RENDER_CONFIG`
en `canvas.types.ts`. Todos los servicios reciben `config` como parámetro opcional.

### ✅ 2. Sin caché de compilación (−0.5 pts → RESUELTO)

`compile()` recrea `new Function` en cada frame del RAF. → `Map<string, JsFunction | null>` keyed por
`variable::maxima::paramJSON`, LRU eviction a 256 entradas. Diferencia real en scroll/zoom con sliders.

### ✅ 3. Smoke test con falsos negativos (→ RESUELTO)

Funciones válidas como `sqrt(-x)` (definida para x < 0) eran rechazadas porque los puntos de prueba
`[0, 1, -1, 0.5, π]` todos devolvían NaN. → Smoke test eliminado: `compile()` retorna `fn` si
`new Function` tiene éxito sintáctico; el sampler filtra NaN naturalmente.

### ✅ 4. `_stubUnknownFunctions` frágil (−0.5 pts → MEJORADO)

Whitelist expandida con: todos los métodos de `Math`, todos los JS keywords/globals relevantes,
`_fAux`/`_gAux`, `delta`/`u`. JSDoc explica por qué `Proxy + with(scope){}` fue descartado
(`"use strict"` lo prohíbe). El regex tiene lookbehind negativo `(?<!\.)` para no matchear `Math.sin`.

### ✅ 5. Línea vertical espuria en funciones a trozos (→ RESUELTO)

`sampleRange` de piezas adyacentes compartía el x de frontera, causando artefactos visuales en
ciertas combinaciones de parámetros. → `openEnds = true` añade sentinel `{ x: xTo, y: NaN }` al
final de cada pieza; `drawCurve` levanta el lápiz. Nuevo `plotPiecewise` consolida todas las piezas
en un único `beginPath/stroke` separadas por sentinels.

### ✅ 6. Oversample fijo en `sampleVisible` (→ MEJORADO)

`cssWidth × 2` fijo. → `Math.max(config.defaultOversample, Math.ceil(vp.cssWidth / 200))`
— adaptivo: canvas anchos aumentan densidad automáticamente.

### ✅ 7. `colorWithAlpha` duplicado (→ RESUELTO)

Dos implementaciones distintas en `DrawingUtilsService` y `SpectrumChartComponent`. → Unificado en
`colorWithAlpha(color, alpha)` en `DrawingUtilsService`; soporta `hsl(...)`, `#rgb`, `#rrggbb`.

### ✅ 8. `FunctionPlotComponent` sin outputs observables (→ RESUELTO)

`SpectrumChartComponent` hacía conversión CSS→math manual inyectando `CoordinateTransformService`.
→ `mathPointerMove = output<MathPoint | null>()` emite coordenadas math pre-convertidas;
`viewportChange = output<CanvasViewport>()` emite en zoom/pan/resize.
`renderConfig = input<Partial<CanvasRenderConfig>>({})` permite override por instancia.

---

## Pendiente (no resuelto en esta fase)

### ⏳ Muestreo adaptivo (−1.5 pts en original, sigue pendiente)

`sampleVisible` sigue siendo uniforme. Para funciones de variación rápida localizada (`sinc`, `e^{-x²}`,
resonancias) el muestreo adaptivo (refinamiento donde `|f''|` es grande) daría curvas más suaves con
el mismo número de puntos. Es el problema más grande que queda. Estimado: medio sprint.

---

## Lo que añadiría para convertirlo en biblioteca

| Feature | Por qué importa | Estado |
|---|---|---|
| **API declarativa de capas** | `addCurve(expr, opts)`, `addParametric(x(t), y(t))` | `PlotLayer[]` es el punto de partida |
| **Hover / tooltip** | `(x, y)` al pasar el mouse | `mathPointerMove` ya disponible ✅ |
| **Coordenadas marcables** | Raíces, extremos, intersecciones | Pendiente |
| **Exportación SVG real** | El canvas exporta raster; SVG es útil para publicaciones | Pendiente |
| **Soporte paramétrico y polar** | `r(θ)` y `(x(t), y(t))` triviales sobre la infraestructura | Pendiente |
| **Animación de parámetros** | Slider que anima `a`; signals ya lo permiten | Pendiente |
