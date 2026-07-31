# UX Improvements — Fourier & Laplace Web Calculator (Series de Fourier)

Rama: `feat/ux-improvements`  
Principio rector: **no tocar lógica ni matemática — solo reorganizar y clarificar la capa visual.**

---

## Estado general

| #   | Problema                                          | Estado        |
| --- | ------------------------------------------------- | ------------- |
| 1   | Parámetros libres enterrados                      | ✅ Completado |
| 2   | Tabs de resultados sin affordance                 | ✅ Completado |
| 3   | Side panel del canvas sobrecargado / mal ordenado | ✅ Completado |
| 4   | Botones de simplificación sin jerarquía           | ✅ Completado |
| 5   | Side panel del espectro                           | ✅ Completado |

---

## Problema 1 — Parámetros libres ✅

**Síntoma:** cuando el usuario escribe `f(x) = x` en `[-a, a]`, el parámetro `a` solo aparecía dentro del modal del canvas. Difícil de descubrir.

**Solución implementada:**

- `paramValues` movido al `CalculatorStore` como signal compartido
- `ResultsSummaryComponent` lo lee desde el store
- Sliders con rango editable (Min / Max) y valor actual editable viven en el side panel del canvas
- Se eliminó `<app-param-sliders>` del panel izquierdo (ya no se necesita ahí — el side panel del canvas es el lugar correcto)
- Tokens de design system corregidos en `param-sliders.component.ts`

**Archivos modificados:**

- `calculator.store.ts` ✅
- `results-summary.component.ts` ✅
- `calculator-form.component.html` ✅ (eliminado)
- `calculator-form.component.ts` ✅ (import eliminado)
- `param-sliders.component.ts` ✅

---

## Problema 2 — Tabs de resultados sin affordance 🔲

**Síntoma:** las 5 pestañas (Coeficientes, Términos, Espectro, Validación, Parseval) son texto plano sin ninguna pista visual de qué contiene cada una.

**Solución propuesta:**

1. Agregar un ícono SVG inline por tab
2. Agregar un subtítulo/descriptor corto debajo de cada label (visible en tab inactivo, estilo muted)
3. Evaluar si el badge de Validación/Parseval puede mostrar un conteo en lugar del punto de color

**Archivos a tocar:**

- `results-summary.component.ts` — agregar campos `icon` y `descriptionKey` al array `tabs`
- `results-summary.component.html` — actualizar tab bar para renderizar ícono + descripción
- `en.json` / `es.json` — agregar claves `tabCoefficientsDesc`, `tabTermsDesc`, `tabSpectrumDesc`, `tabValidationDesc`, `tabParsevalDesc`

**Lo que NO cambia:** lógica de cambio de tab, contenido de cada tab, estado `activeTab`.

- [x] Añadir campos `icon` y `descKey` al array `tabs`
- [x] Añadir claves de descripción en `en.json` y `es.json`
- [x] Actualizar tab bar en `.html`: ícono SVG + label + descriptor muted (9px)
- [x] Verificar que el badge de warning/info en Validación y Parseval sigue funcionando

---

## Problema 3 — Side panel del canvas ✅

**Síntoma:** el modal de engranaje mezclaba 5 conceptos sin jerarquía. Panel flotante frágil, no funcionaba en fullscreen.

**Solución implementada:**

- Panel colapsable slide-from-left (1/3 ancho, `absolute` dentro de `#canvasWrapper`, fullscreen-safe)
- Animación global en `styles.css` (evita hash-scoping de `ViewEncapsulation.Emulated`)
- Botones overlay (fullscreen, settings, descarga, share, fav) se desplazan a la derecha con `transition-[left]`
- Secciones reordenadas por importancia: **N términos → Armónicos → Constantes detectadas → Eje X → Estilo de líneas**
- "Parámetros libres" renombrado a "Constantes detectadas" (i18n)
- Sección "Estilo de líneas" fusionada con leyenda; toggle sólido/discontinuo + preview SVG en vivo por curva
- Sliders de parámetros con valor editable + etiquetas Min/Máx

**Archivos modificados:**

- `results-summary.component.html` ✅
- `results-summary.component.ts` ✅ (signals, LowerCasePipe, DecimalPipe)
- `styles.css` ✅ (keyframes globales)
- `en.json` / `es.json` ✅

---

## Problema 4 — Botones de simplificación sin jerarquía 🔲

**Síntoma:** los 5 botones (Sin simp. / Entero / Trig. / Exp. / Completo) aparecen como barra plana. El usuario no sabe qué hace cada perfil ni cuál elegir.

**Solución propuesta:**

1. Agregar `title` descriptivo a cada botón (visible en hover)
2. Mostrar una línea de descripción del perfil activo bajo la barra (texto pequeño, muted, traducible)

**Archivos a tocar:**

- `results-summary.component.ts` — agregar campo `descriptionKey` al array `profileOptions`
- `results-summary.component.html` — mostrar descripción activa + `[title]` en cada botón
- `en.json` / `es.json` — agregar claves `profileRawDesc`, `profileIntegerDesc`, `profileTrigDesc`, `profileExpDesc`, `profileCompleteDesc`

**Lo que NO cambia:** lógica de `setProfile()`, `simplifyProfile()`, llamadas a la API.

- [x] Agregar campo `descriptionKey` al array `profileOptions`
- [x] Agregar claves de descripción en `en.json` y `es.json`
- [x] Mostrar descripción del perfil activo como texto muted bajo la barra
- [x] Agregar `[title]` a cada botón con la descripción breve
- [x] Aplicar el mismo patrón a la barra de simplificación de Parseval
- [x] Verificar que cambiar perfil sigue disparando simplificación

---

## Problema 5 — Side panel del espectro ✅

**Síntoma:** el espectro tenía una toolbar en la parte superior y un dropdown flotante "Personalizar stems" que no funcionaba en fullscreen y no era consistente con el canvas principal.

**Solución implementada:**

- Mismo patrón de panel slide-from-left que el canvas principal
- Selector de modo (Vista) con color picker inline por fila — cada modo conserva su color de forma independiente
- Fix de bug: cambiar modo ya no sobreescribe un color manual elegido por el usuario (`customColors` por modo)
- Formas del marcador: Rellena / Vacía / Cuadrado / Diamante — selector visual con previews SVG
- Fix visual: tallo "open" acortado al borde del círculo para no atravesar el interior hueco
- Todos los strings vía `TranslocoPipe`; nuevas claves en `en.json` / `es.json`

**Archivos modificados:**

- `spectrum-chart.component.ts` ✅
- `drawing-utils.service.ts` ✅ (parámetro `markerStyle` en `drawStem`)
- `en.json` / `es.json` ✅

---

## Observaciones menores pendientes

| #   | Observación                                                                              | Prioridad | Archivo                                         |
| --- | ---------------------------------------------------------------------------------------- | --------- | ----------------------------------------------- |
| A   | Tooltip del hover en espectro no se desplaza cuando el panel está abierto                | Baja      | `spectrum-chart.component.ts`                   |
| B   | `nTerms` del form y `canvasNTerms` del panel son controles distintos — posible confusión | Baja      | `calculator-form.html` + `results-summary.html` |

---

## Siguiente paso: Transformadas

Una vez cerrados los Problemas 2 y 4, aplicar el mismo patrón de side panel a `continuous-transform.component.html`, reemplazando su toolbar y dropdown, y corrigiendo los `gray-*` hardcodeados.
