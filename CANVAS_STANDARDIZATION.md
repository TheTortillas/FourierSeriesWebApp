# Canvas Standardization Plan
## Objetivo

Convertir el sistema de graficación en una biblioteca interna limpia, escalable y reutilizable —
con la doble finalidad de limpiar deuda técnica actual y sentar las bases para:

1. Integrar el canvas de **plano complejo** en Laplace.
2. Extraer en el futuro una **biblioteca open-source** de canvas 2D para Angular.

---

## Estado de la auditoría

### Lo que ya está bien (no tocar)

| Artefacto | Estado |
|---|---|
| `FunctionPlotComponent` | ✅ Único dueño del `<canvas>`. HiDPI, zoom, pan centralizados. |
| `CanvasRendererService` | ✅ Grid, ejes, ticks — completamente compartido. |
| `PlottingService` | ✅ Sampling, curvas, discontinuidades, espectro — compartido. |
| `CoordinateTransformService` | ✅ Math↔screen — stateless, compartido. |
| `DrawingUtilsService` | ✅ Primitivas geométricas, `colorWithAlpha` — compartido. |
| `FourierReconstructionService` | ✅ Closures de reconstrucción — compartido. |
| `canvas.types.ts` | ✅ Tipos centralizados. |
| `ThemeService` | ✅ Señales reactivas, consumidas correctamente. |

### Deuda encontrada (6 componentes auditados)

Componentes con canvas: **ResultsSummary, ContinuousTransform, FourierIntegral, Laplace, DFT, ODE, Grapher, SpectrumChart**

| # | Deuda | Componentes afectados | Severidad |
|---|---|---|---|
| D1 | Settings panel (slide-in/bottom-sheet/inline) replicado sin componente compartido | ResultsSummary, ContinuousTransform, Laplace, FourierIntegral, DFT(×2), ODE | 🔴 Alta |
| D2 | Toolbar row (fullscreen + gear + download + share + favorite) — HTML idéntico copy-paste | Todos los 6 feature-level | 🔴 Alta |
| D3 | Favorite dialog — lógica + HTML copy-paste | ResultsSummary, ContinuousTransform, Laplace, FourierIntegral, DFT, ODE | 🔴 Alta |
| D4 | Share dialog — ídem | Ídem | 🔴 Alta |
| D5 | `isFullscreen signal` + `fullscreenchange` listener sin cleanup | Todos los 6 (ODE nunca limpia) | 🟠 Media |
| D6 | `isMobile signal` snapshot estático (no reacciona a resize) | Todos los 6 | 🟠 Media |
| D7 | Color presets inconsistentes — funciones distintas por componente; Laplace y FourierIntegral hardcodean `#dc2626`/`#2563eb` sin adaptar a tema | Laplace, FourierIntegral, DFT (sin isNeutral) | 🟠 Media |
| D8 | `customColor` tracking — signals en FT/Series, plain booleans en DFT, ausente en ODE/Laplace | DFT, ODE, Laplace, FourierIntegral | 🟡 Baja |
| D9 | `downloadCanvas()` — mismo `querySelector('canvas').toDataURL` repetido | ContinuousTransform, Laplace, FourierIntegral, ODE | 🟠 Media |
| D10 | `showCanvasSettings = signal(false)` declarado 6 veces | Todos los 6 | 🟡 Baja |
| D11 | X-axis format `'custom'` ausente en Laplace y DFT (espectro) | Laplace, DFT | 🟡 Baja |
| D12 | `drawOpenCircle/drawFilledCircle` en Grapher duplican `DrawingUtilsService` | Grapher | 🟡 Baja |
| D13 | `fullscreenchange` listener nunca removido en ODE | ODE | 🟠 Media |
| D14 | `downloadCanvas` anchor no appended al DOM (técnicamente frágil) | Todos | 🟡 Baja |
| D15 | `isMobile` se evalúa una sola vez en constructor — puede ser incorrecto tras resize | Todos los 6 | 🟡 Baja |
| D16 | `_suppressAutoLoad`, `_urlPopulated`, `_restoredFromUrl` son plain booleans fuera del grafo reactivo | ODE | 🟡 Baja |

---

## Plan de mitigación

El plan se divide en **4 fases**. Cada fase es independiente y deployable.

---

### FASE 1 — `CanvasShellComponent` (D1, D2, D5, D6, D10, D13, D15)
> *Extrae el wrapper que todos los canvas feature-level duplican.*

#### Nuevo componente: `app-canvas-shell`

```
shared/components/canvas-shell/
  canvas-shell.component.ts
  canvas-shell.component.html
```

**API propuesta:**

```typescript
// Inputs
showSettings: InputSignal<boolean>         // open/close del panel
hasResult: InputSignal<boolean>            // habilita gear + share + favorite
showFavorite: InputSignal<boolean>         // muestra el botón estrella
settingsTemplate: InputSignal<TemplateRef> // ng-template del consumer
filename: InputSignal<string>              // para download ('ft-result.png')

// Outputs
settingsToggle: OutputEmitterRef<void>     // usuario clickeó el gear
fullscreenChange: OutputEmitterRef<boolean>
downloadRequested: OutputEmitterRef<void>
shareRequested: OutputEmitterRef<void>
favoriteRequested: OutputEmitterRef<void>
```

**Responsabilidades internas:**
- `isFullscreen signal` + `fullscreenchange` listener con cleanup via `DestroyRef`
- `isMobile` como `BreakpointObserver` (reactivo, no snapshot)
- Lógica de posicionamiento del toolbar (shift cuando panel abierto)
- Tres variantes del panel: desktop slide-in, mobile bottom-sheet, mobile inline
- `downloadCanvas()` centralizado (busca `<canvas>` en su propio elemento)

**Cada consumer queda reducido a:**
```html
<app-canvas-shell
  [showSettings]="showCanvasSettings()"
  [hasResult]="hasComputedResult()"
  [settingsTemplate]="mySettingsTpl"
  filename="ft-result.png"
  (settingsToggle)="showCanvasSettings.set(!showCanvasSettings())"
  (shareRequested)="showShareDialog.set(true)"
  (favoriteRequested)="openFavoriteDialog()"
>
  <app-function-plot ... />
</app-canvas-shell>
```

**Archivos a modificar:** ResultsSummary, ContinuousTransform, Laplace, FourierIntegral, DFT, ODE.

---

### FASE 2 — `CanvasDialogsComponent` (D3, D4)
> *Extrae los diálogos de Favorito y Compartir que están copy-paste en 6 lugares.*

#### Nuevo componente: `app-canvas-dialogs`

```
shared/components/canvas-dialogs/
  canvas-dialogs.component.ts
  canvas-dialogs.component.html
```

**API propuesta:**

```typescript
// Inputs — Share
shareUrl: InputSignal<string>
showShareDialog: InputSignal<boolean>

// Inputs — Favorite
showFavoriteDialog: InputSignal<boolean>
favoriteLoading: InputSignal<boolean>
favoriteName: InputSignal<string>
isFavorited: InputSignal<boolean>

// Outputs
shareClose: OutputEmitterRef<void>
favoriteConfirm: OutputEmitterRef<string>  // emite el nombre
favoriteCancel: OutputEmitterRef<void>
```

**Alternativa más simple:** Extraer como dos componentes separados `<app-share-dialog>` y `<app-favorite-dialog>`, que es más granular y más fácil de testear.

**Archivos a modificar:** Todos los 6 feature-level canvas components.

---

### FASE 3 — `CanvasColorService` (D7, D8, D9, D12)
> *Centraliza los color presets y el tracking de customización.*

#### Nuevo servicio: `CanvasColorService`

```
core/services/canvas/canvas-color.service.ts
```

**Responsabilidades:**
- Método único `getPreset(role: 'ft' | 'series' | 'dft' | 'laplace' | 'ode', isDark: boolean, isNeutral: boolean): ColorPreset`
- Tipo `ColorPreset` con campos tipados (no magic strings)
- Elimina `getTransformColorPreset`, `getSeriesColorPreset`, `getDftPreset` dispersas
- Centraliza `downloadCanvas(canvasEl: HTMLCanvasElement, filename: string): void`

#### Mejora en `DrawingUtilsService`
- Mover `drawOpenCircle` / `drawFilledCircle` de Grapher a `DrawingUtilsService` (D12)

#### Estandarizar `customColor` tracking
- Pattern uniforme: `signal<boolean>(false)` en todos los componentes
- Reset reactivo via `effect()` sobre `theme.theme()` + `theme.palette()`

**Archivos a modificar:** ContinuousTransform, ResultsSummary, DFT, Laplace, FourierIntegral, ODE, Grapher, DrawingUtilsService.

---

### FASE 4 — X-axis format y misceláneos (D11, D14, D16)
> *Pequeñas inconsistencias que no bloquean las fases anteriores.*

- Agregar opción `'custom'` a Laplace (D11)
- Agregar control de formato de eje al espectro DFT (D11)
- Usar `document.body.appendChild(a)` + cleanup en `downloadCanvas` (D14)
- Convertir guards booleanos planos de ODE a signals privados (D16)

---

## Orden de ejecución recomendado

```
FASE 1 (canvas-shell)     ← desbloquea plano complejo en Laplace
FASE 2 (dialogs)          ← independiente, hacer en paralelo si se puede
FASE 3 (colors + utils)   ← después de FASE 1 (los consumers ya están simplificados)
FASE 4 (misceláneos)      ← último, sin prisa
```

---

## API objetivo: biblioteca futura

Una vez completadas las 4 fases, el sistema queda estructurado como:

```
@aem-lab/canvas2d-plotter (biblioteca futura)
├── components/
│   ├── function-plot/          ← ya existe y está limpio
│   ├── canvas-shell/           ← FASE 1
│   ├── spectrum-chart/         ← ya existe, requiere cleanup menor
│   └── canvas-dialogs/         ← FASE 2
├── services/
│   ├── canvas-renderer/        ← ya existe
│   ├── plotting/               ← ya existe
│   ├── coordinate-transform/   ← ya existe
│   ├── drawing-utils/          ← ya existe + D12
│   ├── fourier-reconstruction/ ← ya existe
│   └── canvas-color/           ← FASE 3 (nuevo)
└── types/
    └── canvas.types.ts         ← ya existe
```

---

## Notas sobre el plano complejo (Laplace)

El canvas de plano complejo (s = σ + jω) que se integrará en Laplace requiere:

- `CoordinateTransformService` — reutilizable sin cambios (ya es Cartesiano puro)
- `CanvasRendererService` — reutilizable con un `renderConfig` que etiquete los ejes como σ (Re) / jω (Im)
- `DrawingUtilsService` — reutilizable sin cambios
- `CanvasShellComponent` — necesario antes de integrar (FASE 1 es requisito)
- `PlottingService` — extensión mínima para dibujar polos (×) y ceros (○) en el plano complejo

El plano complejo **no requiere** `FourierReconstructionService` ni los presets de color de Fourier.

---

## Seguimiento de progreso

- [ ] **FASE 1** — `CanvasShellComponent`
  - [ ] Crear `canvas-shell.component.ts / .html`
  - [ ] Migrar ResultsSummary
  - [ ] Migrar ContinuousTransform
  - [ ] Migrar Laplace
  - [ ] Migrar FourierIntegral
  - [ ] Migrar DFT
  - [ ] Migrar ODE
- [ ] **FASE 2** — `CanvasDialogsComponent`
  - [ ] Crear `share-dialog.component.ts / .html`
  - [ ] Crear `favorite-dialog.component.ts / .html`
  - [ ] Migrar los 6 consumers
- [ ] **FASE 3** — `CanvasColorService`
  - [ ] Crear servicio con `getPreset()`
  - [ ] Centralizar `downloadCanvas()`
  - [ ] Mover `drawOpenCircle/drawFilledCircle` a `DrawingUtilsService`
  - [ ] Estandarizar `customColor` tracking
- [ ] **FASE 4** — Misceláneos
  - [ ] X-axis `'custom'` en Laplace
  - [ ] Formato de eje en espectro DFT
  - [ ] `downloadCanvas` anchor cleanup
  - [ ] Guards booleanos de ODE → signals
