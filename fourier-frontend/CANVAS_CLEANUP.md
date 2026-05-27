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

## Estado — Fase 1 (completada)

- [x] Commit 1: `canvas.types.ts` — `CanvasRenderConfig` + `DEFAULT_RENDER_CONFIG`
- [x] Commit 2: `canvas-renderer.service.ts` — consumir config, fix bug fuente
- [x] Commit 3: `plotting.service.ts` — consumir config, oversample adaptativo
- [x] Commit 4: `drawing-utils.service.ts` — unificar `colorWithAlpha`
- [x] Commit 5: `function-plot.component.ts` — outputs, `renderConfig` input, fix `resetView`
- [x] Commit 6: `spectrum-chart.component.ts` — usar `mathPointerMove`, eliminar duplicación
- [x] Commit 7: Verificación final de callers + build limpio

---

---

# Fase 2 — Plotter quality & piecewise fix

> Origen: `PLOTTER_EVAL.md` (evaluación 2026-04-29, nota 7/10) + bug de líneas
> verticales en funciones a trozos reportado en 2026-05-27.
>
> **Regla de oro igual que Fase 1**: cada commit deja el build verde y cero
> cambios de comportamiento para callers que no tocan las APIs nuevas.

---

## Diagnóstico: el bug de la línea vertical en trozos

### Causa raíz

`plotFnRange(ctx, fn, from, to, 400, vp, style)` muestrea `n+1` puntos con
`i = 0..n`, de modo que incluye `x = from` y `x = to` exactamente. Cuando dos
trozos adyacentes tienen la misma `x` frontera pero distintos valores de `y`, el
path del tramo anterior termina en `(to, y₁)` y el del siguiente empieza en
`(from, y₂) = (to, y₂)`. Aunque son paths independientes (`beginPath/stroke`
separados), el **punto final del tramo 1** puede caer en la misma columna de
píxeles que el **punto inicial del tramo 2**, y el alias visual de Canvas + el
antialiasing producen una línea casi vertical que el ojo ve como conexión.

El efecto es intermitente porque depende de cuánto difieren `y₁` e `y₂`:
- `a = 1.1`: `sinc(a·t)` oscila rápido, `y₁ ≠ y₂` → el salto supera
  `maxJumpPx = 120` → `drawCurve` corta el path → **no hay línea** ✅
- `a = 0.6`: función más suave, `y₁ ≈ y₂` → salto pequeño → el path dibuja
  una línea casi vertical de longitud pequeña **dentro del tramo 1**,
  justo en `x = to` (el penúltimo y último punto del muestreo son casi iguales
  pero la función real se discontinúa ahí) → **línea visible** ❌

La solución correcta es que cada tramo **nunca dibuje en su punto de frontera
exacto**, o que se fuerce un corte del path en ese punto.

---

## Commits planificados — Fase 2

### [ ] Commit 8 — `plotting.service.ts`: `plotPiecewise` + NaN-sentinel en `sampleRange`

**Archivos**: `plotting.service.ts`, `canvas.types.ts`

**Qué hace**:

**8a — `sampleRange` con opción `openEnds`**

Añadir parámetro opcional `{ openEnds?: boolean }` (default `false`):
```typescript
sampleRange(fn, xFrom, xTo, steps, { openEnds = false } = {}): MathPoint[]
```
Cuando `openEnds = true`, el array resultante termina con `{ x: xTo, y: NaN }` —
el NaN-sentinel fuerza `penDown = false` en `drawCurve`, cerrando el path
limpiamente sin trazar al punto siguiente.

Esto es la solución **correcta a nivel de biblioteca**: el tramo nunca "pinta"
su punto de cierre; cada tramo es visualmente aislado.

**8b — Nuevo método `plotPiecewise`**

```typescript
plotPiecewise(
  ctx: CanvasRenderingContext2D,
  pieces: { fn: (x: number) => number; from: number; to: number }[],
  vp: CanvasViewport,
  style: { color: string; lineWidth: number; dashed?: boolean },
  config?: CanvasRenderConfig,
): void
```

- Para cada piece: llama `sampleRange(fn, from, to, steps, { openEnds: true })`
  donde `steps = Math.round(vp.cssWidth * effectiveOversample)` proporcional al
  viewport (no fijo en 400)
- Concatena todos los arrays de puntos y hace **un solo `drawCurve`** — un único
  path con NaN-sentinelas entre trozos. Ventaja: un solo `beginPath/stroke` en
  lugar de N, más eficiente en canvas.

**Verificar callers**: método nuevo, nadie lo llama aún → cero impacto.

---

### [ ] Commit 9 — `continuous-transform.component.ts`: usar `plotPiecewise` en preview

**Archivos**: `continuous-transform.component.ts`

**Qué hace**:

Reemplazar el loop de `plotFnRange` del input preview de trozos por `plotPiecewise`:

```typescript
// ANTES (por cada seg):
plotter.plotFnRange(ctx, fn, from, to, 400, vp, style);

// DESPUÉS (una sola llamada con todos los trozos):
plotter.plotPiecewise(ctx, compiledPieces, vp, style);
```

Los trozos con `from = -∞` o `to = +∞` se mantienen con `plotFn` + función
gateada (comportamiento actual correcto, no se toca).

**Verificar callers**: solo afecta al preview visual del input en modo FT/IFT.
El cálculo simbólico (backend) no cambia. Los resultados post-cálculo
(`reFn`, `imFn`, `magFn`) ya no son a trozos — siguen usando `plotFn`.

---

### [ ] Commit 10 — `math-utils.service.ts`: caché de compilación + smoke-test fix

**Archivos**: `math-utils.service.ts`

**Qué hace**:

**10a — Caché de `compile()`** (issue −0.5 pts de PLOTTER_EVAL):

```typescript
private readonly _compileCache = new Map<string, JsFunction | null>();

compile(maxima, variable = 'x', params?): JsFunction | null {
  const key = `${variable}::${maxima}::${JSON.stringify(params ?? {})}`;
  if (this._compileCache.has(key)) return this._compileCache.get(key)!;
  const fn = this._compileUncached(maxima, variable, params);
  this._compileCache.set(key, fn);
  return fn;
}
```

La lógica actual pasa a `_compileUncached`. El cache es ilimitado en tamaño
(las expresiones son pocas y vienen del backend), pero añadimos un límite
suave de 256 entradas con LRU simple (delete el más antiguo si Map.size > 256).

**10b — Smoke-test fix** (issue de PLOTTER_EVAL: `sqrt(x)` con puntos negativos):

El smoke-test actual devuelve `null` si los 5 puntos de prueba todos son NaN.
Fix: si la función compila sintácticamente válida, **siempre retornarla** — el
muestreador ya filtra NaN. Eliminar el rechazo por smoke-test, mantenerlo solo
para detectar errores de compilación JS (try/catch del `new Function`).

```typescript
// ANTES: retorna null si todos los puntos de prueba son NaN/error
// DESPUÉS: retorna fn si new Function tuvo éxito; el muestreador decide
const fn = new Function(...) as JsFunction;
return fn; // smoke-test eliminado — NaN es un valor válido de retorno
```

**Verificar callers**: `compile()` retornaba `null` para `sqrt(x)` si todos los
puntos de prueba eran negativos. Ahora retorna la función. El muestreador ya
maneja NaN con `isFinite(y)`. Revisar `evaluate()` y `parseDeltaTerms()` —
ambos usan `compile()` y manejan correctamente `null` y `NaN`.

---

### [ ] Commit 11 — `math-utils.service.ts`: `_stubUnknownFunctions` → Proxy runtime

**Archivos**: `math-utils.service.ts`

**Qué hace**:

Reemplazar `_stubUnknownFunctions` (regex estático, frágil) por un `Proxy` que
intercepta accesos a nombres desconocidos en tiempo de ejecución:

```typescript
// En lugar de reescribir el JS, envolver la ejecución en un Proxy:
const safeGlobals = new Proxy(
  { Math, NaN, Infinity, _cot, _sec, ... },
  { get(target, prop) { return prop in target ? target[prop] : () => NaN; } }
);
const fn = new Function('__g', variable,
  `"use strict"; with(__g) { return (${js}); }`
)(safeGlobals);
```

> **Nota**: `with` está prohibido en `"use strict"`. La alternativa sin `with`
> es pasar cada helper como argumento nombrado, o usar `Function` con un scope
> object. La implementación concreta usará un wrapper sin `with`:
> ```typescript
> // Crear la función con todos los helpers inyectados explícitamente
> // igual que hoy, pero añadir un paso de validación sintáctica separado
> // del smoke-test de valores.
> ```
> Si la complejidad del Proxy resulta mayor que el beneficio (el stub regex
> funciona bien para el conjunto actual de funciones Maxima), este commit puede
> reducirse a **solo documentar la limitación** y ampliar el whitelist de
> `_stubUnknownFunctions` para cubrir los casos conocidos que fallan.
> Decisión final: al implementar.

**Verificar callers**: si la función compila y devuelve NaN en lugar de lanzar
ReferenceError, el comportamiento externo es idéntico.

---

### [ ] Commit 12 — Verificación final Fase 2 + actualizar `PLOTTER_EVAL.md`

**Archivos**: `PLOTTER_EVAL.md`, `CANVAS_CLEANUP.md`

**Qué hace**:
- `ng build --configuration=production` sin errores
- Probar manualmente: funciones a trozos con `a = 0.6` y `a = 1.1` → sin línea vertical
- Probar: `sqrt(x)` → curva visible para `x > 0`, NaN para `x < 0` (sin rechazo)
- Probar: zoom/scroll rápido → sin reconstrucción de `new Function` (log de cache hits)
- Actualizar nota en `PLOTTER_EVAL.md`: issues resueltos, nota nueva estimada

---

## Resumen de issues de PLOTTER_EVAL.md y su tratamiento

| Issue (eval) | Nota original | Commit | Tratamiento |
|---|---|---|---|
| Muestreo uniforme ciego | −1.5 pts | **Commit 3** ✅ | Oversample adaptativo `max(2, ceil(w/200))` |
| `_stubUnknownFunctions` frágil | −0.5 pts | **Commit 11** | Proxy runtime o whitelist ampliada |
| Sin caché de compilación | −0.5 pts | **Commit 10** | `Map<key, fn>` con LRU 256 |
| Smoke test rechaza funciones válidas | heurístico | **Commit 10** | Retornar `fn` siempre si compila |
| Línea vertical en trozos | no evaluado | **Commits 8+9** | `plotPiecewise` + NaN-sentinel |
| Hover/tooltip | no evaluado | **Commit 5** ✅ | `mathPointerMove` output disponible |

---

## Estado — Fase 2

- [ ] Commit 8: `plotting.service.ts` — `plotPiecewise` + `openEnds` en `sampleRange`
- [ ] Commit 9: `continuous-transform.component.ts` — usar `plotPiecewise` en preview de trozos
- [ ] Commit 10: `math-utils.service.ts` — caché de compilación + fix smoke-test
- [ ] Commit 11: `math-utils.service.ts` — `_stubUnknownFunctions` → Proxy o whitelist ampliada
- [ ] Commit 12: Verificación final Fase 2 + actualizar `PLOTTER_EVAL.md`
