# Canvas 2D Library Cleanup Plan

Branch: `feature/canvas-cleanup`

> **Regla de oro**: por cada commit, verificar que todos los callers existentes
> (`results-summary`, `calculator`, `continuous-transform`, `dft`, `spectrum-chart`,
> y los dev panels) sigan funcionando sin cambio visible gracias a los defaults.

---

## Inventario de callers de producción

| Componente | Archivo | Inputs usados |
|---|---|---|
| Results summary (series) | `calculator/components/results-summary/results-summary.component.html` | `[layers]`, `[initialUnit]`, `[xAxisFormat]`, `[customConst]` |
| Continuous transform (FT plot) | `transforms/continuous/continuous-transform.component.html` | `[layers]`, `[initialUnit]`, `[xAxisFormat]`, `[customConst]` |
| DFT signal plot | `transforms/dft/dft.component.html` | `[layers]`, `[initialUnit]`, `[xAxisFormat]` |
| Spectrum chart | `shared/components/spectrum-chart/spectrum-chart.component.ts` | `[layers]`, `[initialUnit]="48"`, `[xAxisFormat]="'integer'"` |

## Inventario de callers dev

| Panel | Inputs usados |
|---|---|
| `canvas-panel` | `[layers]`, `[initialUnit]`, `[xAxisFormat]`, `[customConst]` |
| `canvas-plot-panel` | `[layers]`, `[initialUnit]`, `[xAxisFormat]` |
| `epicycles-panel` | `[layers]`, `[initialUnit]="100"` |
| `dft-signal-lab-panel` | `[layers]`, `[initialUnit]="38/55"`, `[xAxisFormat]` |

---

## Commits planificados

### ✅ Commit 1 — `canvas.types.ts`: Centralizar constantes en `CanvasRenderConfig`

**Archivos**: `canvas.types.ts`

**Qué hace**:
- Añadir interfaz `CanvasRenderConfig` con todos los valores hoy hardcodeados:
  ```typescript
  export interface CanvasRenderConfig {
    targetGridPx: number;      // spacing deseado entre líneas de grid (CSS px). Hoy: 80
    minLabelGap: number;       // mínimo CSS px entre labels de eje. Hoy: 44
    labelFontSize: number;     // tamaño de fuente de labels (CSS px). Hoy: 11 (bug: * dpr / dpr)
    labelFont: string;         // familia tipográfica. Hoy: 'JetBrains Mono, monospace'
    axisLineWidth: number;     // grosor de los ejes. Hoy: 1.5
    maxJumpPx: number;         // umbral de discontinuidad (CSS px). Hoy: 120
    defaultOversample: number; // factor de muestreo sobre cssWidth. Hoy: 2
    minUnit: number;           // zoom mínimo. Hoy: 1e-4 (en function-plot)
    maxUnit: number;           // zoom máximo. Hoy: 1e9 (en function-plot)
  }
  ```
- Añadir `DEFAULT_RENDER_CONFIG: CanvasRenderConfig` con los valores actuales (sin cambio de comportamiento)

**Verificar callers**: ningún caller toca `canvas.types.ts` directamente — solo añadimos, no rompemos.

---

### ✅ Commit 2 — `canvas-renderer.service.ts`: Consumir config, corregir bug fuente

**Archivos**: `canvas-renderer.service.ts`

**Qué hace**:
- Eliminar `const TARGET_GRID_PX = 80` y `const MIN_LABEL_GAP = 44` del módulo
- `drawBackground(ctx, vp, theme, config = DEFAULT_RENDER_CONFIG)` — cuarto param opcional
- Propagar `config` a `drawGrid`, `drawAxes`, `drawLabels` como param adicional
- **Bug fix**: `ctx.font = \`${(11 * vp.dpr) / vp.dpr}px JetBrains Mono, monospace\``
  → `ctx.font = \`${config.labelFontSize}px ${config.labelFont}\``
- `ctx.lineWidth = 1.5` → `ctx.lineWidth = config.axisLineWidth`
- `TARGET_GRID_PX` → `config.targetGridPx` (en `drawGrid`, `niceStepConst`, `xStep`)
- `MIN_LABEL_GAP` → `config.minLabelGap` (en `drawLabels`)

**Verificar callers**: `drawBackground` solo se llama desde `FunctionPlotComponent.draw()`.
El cuarto param es opcional con default → **cero cambios para callers**.

---

### ✅ Commit 3 — `plotting.service.ts`: Consumir config, oversample adaptativo

**Archivos**: `plotting.service.ts`

**Qué hace**:
- Eliminar `const MAX_JUMP_PX = 120` del módulo
- `drawCurve(ctx, curve, vp, config = DEFAULT_RENDER_CONFIG)` — cuarto param opcional
  - `MAX_JUMP_PX` → `config.maxJumpPx`
- `sampleVisible(fn, vp, oversample?, config?)`:
  - Si no se pasa `oversample`, calcular adaptativamente:
    `Math.max(config.defaultOversample, Math.ceil(vp.cssWidth / 200))`
  - Esto mejora la resolución en pantallas anchas (>1000px → 5+ muestras por px CSS)
- `plotFn` y `plotFnRange` aceptan `config` opcional y lo pasan a `drawCurve`

**Verificar callers**: `drawCurve` se llama desde `FunctionPlotComponent.draw()` y desde
el `onDraw` callback de varios componentes. El callback recibe `(ctx, vp)` — no llama a
`drawCurve` directamente con config, lo cual es correcto. Los callers que llaman
`plotter.plotFn(...)` directamente (en dev panels) no pasan config → usan el default.
**Cero cambios de comportamiento**.

---

### ✅ Commit 4 — `drawing-utils.service.ts`: Unificar `colorWithAlpha`

**Archivos**: `drawing-utils.service.ts`, `spectrum-chart.component.ts`

**Qué hace**:
- Renombrar/expandir `withAlpha(hsl, alpha)` → `colorWithAlpha(color, alpha)`:
  - Si `color` empieza con `hsl(` → lógica actual (CSS color-level-4)
  - Si `color` empieza con `#` (3 o 6 dígitos) → lógica de `SpectrumChartComponent.colorWithAlpha()`
  - Otros formatos → devolver sin cambio
- Mantener `withAlpha` como alias deprecado `@deprecated` que llama a `colorWithAlpha`
  (evita romper cualquier uso existente)
- En `SpectrumChartComponent`:
  - Inyectar `DrawingUtilsService`
  - Eliminar el método local `colorWithAlpha(hex, alpha)`
  - Cambiar `colorWithAlpha(...)` en el template → `drawingUtils.colorWithAlpha(...)`

**Verificar callers**: buscar todos los usos de `withAlpha` en el proyecto.

---

### ✅ Commit 5 — `function-plot.component.ts`: Outputs, `renderConfig` input, fix `resetView`

**Archivos**: `function-plot.component.ts`

**Qué hace**:
- **Input nuevo** `renderConfig = input<Partial<CanvasRenderConfig>>({})`:
  - Se mergea con `DEFAULT_RENDER_CONFIG` en una computed: `effectiveConfig = computed(() => ({ ...DEFAULT_RENDER_CONFIG, ...this.renderConfig() }))`
  - Se pasa a `renderer.drawBackground` y `plotter.drawCurve` en `draw()`
- **Output nuevo** `viewportChange = output<CanvasViewport>()`:
  - Emite en `zoom()`, `onPointerMove()` (pan), y `resizeCanvas()`
- **Output nuevo** `mathPointerMove = output<MathPoint | null>()`:
  - En `onPointerMove`: si no está dragging, calcular coordenadas math y emitir
  - En `onPointerLeave`: emitir `null`
- **Fix `resetView`**:
  - Capturar `initialScaleX = 1` y `initialScaleY = 1` en `ngAfterViewInit` (hoy siempre resetea a 1, lo cual es correcto para el caso actual — el bug potencial sería si alguien pasa scales iniciales distintos de 1, cosa que no ocurre todavía)
  - Por ahora documentar el comportamiento correctamente; preparar para futura extensión
- Mover `MIN_UNIT/MAX_UNIT` → `this.effectiveConfig().minUnit` / `this.effectiveConfig().maxUnit`

**Verificar callers**: todos los callers usan solo los inputs existentes.
Los nuevos outputs son opcionales — nadie los escucha todavía → **cero cambios**.

---

### ✅ Commit 6 — `spectrum-chart.component.ts`: Usar `mathPointerMove`, eliminar duplicación

**Archivos**: `spectrum-chart.component.ts`

**Qué hace**:
- Eliminar inyección de `CoordinateTransformService` (ya no necesaria aquí)
- Eliminar `onChartPointerMove(event)` y su lógica de transformación de coordenadas
- Eliminar el binding `(pointermove)` y `(pointerleave)` del wrapper `<div>`
- Escuchar el output `(mathPointerMove)` de `<app-function-plot>` directamente:
  ```html
  <app-function-plot
    [layers]="layers()"
    [initialUnit]="48"
    (mathPointerMove)="onMathPointerMove($event)"
  />
  ```
- `onMathPointerMove(p: MathPoint | null)`: misma lógica de hit-test pero recibe math coords directamente — elimina ~20 líneas
- Exponer input `renderConfig = input<Partial<CanvasRenderConfig>>({})` y pasarlo al `FunctionPlotComponent` interno

**Verificar callers**: `SpectrumChartComponent` es usado en:
- `results-summary.component.html` (series de Fourier)
- Verificar que el hover de stems sigue funcionando igual.

---

### ✅ Commit 7 — Verificación final de callers + lint

**Archivos**: solo lectura + posibles ajustes menores

**Qué hace**:
- Revisar todos los callers listados en el inventario arriba
- Asegurar que ningún import rompe (especialmente `CanvasRenderConfig` y `DEFAULT_RENDER_CONFIG` exportados desde `canvas.types.ts`)
- `ng build` sin errores
- Lint limpio

---

## Bugs corregidos en este plan

| Bug | Archivo | Descripción |
|---|---|---|
| Fuente no escala con DPR | `canvas-renderer.service.ts:128` | `11 * vp.dpr / vp.dpr` siempre = 11 |
| `colorWithAlpha` duplicado | `spectrum-chart` vs `drawing-utils` | Dos implementaciones paralelas distintas |
| Oversample fijo | `plotting.service.ts:32` | `2×` fijo aunque el canvas sea muy ancho |
| Outputs ausentes | `function-plot.component.ts` | No emite viewport ni coordenadas math |
| `MAX_JUMP_PX` no configurable | `plotting.service.ts:6` | Rompe con funciones muy empinadas |

## Valores que pasan de hardcoded a configurables

| Valor | Antes | Después |
|---|---|---|
| Grid spacing | `80` (const módulo) | `config.targetGridPx` |
| Label gap mínimo | `44` (const módulo) | `config.minLabelGap` |
| Tamaño fuente labels | `11` (literal) | `config.labelFontSize` |
| Familia tipográfica | `'JetBrains Mono, monospace'` (literal) | `config.labelFont` |
| Grosor ejes | `1.5` (literal) | `config.axisLineWidth` |
| Umbral discontinuidad | `120` (const módulo) | `config.maxJumpPx` |
| Oversample por defecto | `2` (parámetro default) | `config.defaultOversample` |
| Zoom mínimo | `1e-4` (const módulo) | `config.minUnit` |
| Zoom máximo | `1e9` (const módulo) | `config.maxUnit` |

---

## Estado

- [ ] Commit 1: `canvas.types.ts` — `CanvasRenderConfig` + `DEFAULT_RENDER_CONFIG`
- [ ] Commit 2: `canvas-renderer.service.ts` — consumir config, fix bug fuente
- [ ] Commit 3: `plotting.service.ts` — consumir config, oversample adaptativo
- [ ] Commit 4: `drawing-utils.service.ts` — unificar `colorWithAlpha`
- [ ] Commit 5: `function-plot.component.ts` — outputs, `renderConfig` input, fix `resetView`
- [ ] Commit 6: `spectrum-chart.component.ts` — usar `mathPointerMove`, eliminar duplicación
- [ ] Commit 7: Verificación final de callers + lint
