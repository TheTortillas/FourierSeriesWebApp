# UX Improvements — Fourier Web Calculator

Rama: `feat/ux-improvements`  
Principio rector: **no tocar lógica ni matemática — solo reorganizar y clarificar la capa visual.**

---

## Problema 1 — Parámetros libres enterrados en el modal de canvas

**Síntoma:** cuando el usuario escribe `f(x) = x` en `[-a, a]`, el parámetro `a` solo aparece dentro del panel de settings del canvas (el engranaje). El usuario típico nunca lo encuentra.

**Solución:** mostrar los sliders de parámetros libres directamente en el panel izquierdo de input, justo antes del botón "Calcular serie". Solo aparecen cuando el resultado los detecta (`store.result()?.data.params`).

**Archivos a tocar:**
- `calculator.store.ts` — exponer `paramValues` como signal del store (actualmente vive en `ResultsSummaryComponent`)
- `results-summary.component.ts` — leer `paramValues` del store en lugar del signal local
- `calculator-form.component.html` — agregar `<app-param-sliders>` condicional después del bloque de error, antes del botón Calcular
- `calculator-form.component.ts` — importar `ParamSlidersComponent`
- `param-sliders.component.ts` — corregir clases hardcoded (`border-gray-200`, `bg-white`, `bg-blue-50`) por tokens del design system (`border-border`, `bg-paper`, `bg-accent/10`)

**Lo que NO cambia:** la lógica de evaluación en `evaluationParams`, el canvas, ni ningún cálculo.

- [ ] Mover `paramValues` signal al `CalculatorStore`
- [ ] Leer `paramValues` desde el store en `ResultsSummaryComponent`
- [ ] Agregar `<app-param-sliders>` en `calculator-form.component.html`
- [ ] Corregir design tokens en `param-sliders.component.ts`
- [ ] Verificar en browser: slider en panel izq. mueve la curva en canvas

---

## Problema 2 — Tabs de resultados sin affordance

**Síntoma:** las 5 pestañas (Coeficientes, Términos, Espectro, Validación, Parseval) son texto plano sin ninguna pista de qué contiene cada una ni de que son clicables. Un usuario nuevo no sabe que hay más información debajo.

**Solución:**
1. Agregar un subtítulo/descriptor corto debajo de cada label de tab (visible en el tab inactivo como texto muted, o como tooltip `title`).
2. Agregar un ícono SVG inline por tab para reforzar la identidad visual.
3. Evaluar si "Validación" y "Términos" pueden mostrar un badge de conteo (ej. "5 singularidades") en lugar del punto de color actual.

**Archivos a tocar:**
- `results-summary.component.ts` — agregar campos `icon` y `description` al array `tabs`
- `results-summary.component.html` — actualizar el tab bar para renderizar ícono + descripción
- `en.json` / `es.json` — agregar claves `tabXxxDescription` para cada tab

**Lo que NO cambia:** la lógica de cambio de tab, el contenido de cada tab, ni el estado `activeTab`.

- [ ] Añadir campos `icon` y `description` al array `tabs` en el `.ts`
- [ ] Añadir claves de traducción `tabCoefficientsDesc`, `tabTermsDesc`, `tabSpectrumDesc`, `tabValidationDesc`, `tabParsevalDesc` en `en.json` y `es.json`
- [ ] Actualizar el tab bar en el `.html` para mostrar ícono + descripción en tabs inactivos
- [ ] Verificar que el badge de warning/info en Validación y Parseval siga funcionando

---

## Problema 3 — Modal de canvas settings sobrecargado

**Síntoma:** el panel de engranaje mezcla 5 conceptos distintos sin jerarquía clara: términos a mostrar, armónicos, unidades del eje, estilos de línea, y parámetros libres. El usuario no sabe qué afecta qué.

**Solución:** reorganizar el contenido existente con separadores y headers más fuertes, y eliminar la sección de parámetros libres (que habrá migrado al panel izquierdo en el Problema 1). No se mueve nada al DOM fuera del modal — solo se reordena y se mejora la tipografía de los encabezados de sección.

Orden propuesto:
1. **Vista** — N términos en canvas + armónicos ON/OFF + DC harmonic + control individual
2. **Eje X** — formato (π / e / entero / parámetro)
3. **Estilo de líneas** — colores + grosor + leyenda

**Archivos a tocar:**
- `results-summary.component.html` — reordenar secciones, fortalecer headers, quitar sección freeParams

**Lo que NO cambia:** ninguna señal, ningún método del `.ts`.

- [ ] Quitar sección `freeParams` del modal (migrada al Problema 1)
- [ ] Reordenar secciones: Vista → Eje X → Estilo
- [ ] Fortalecer visualmente los headers de sección (peso, separador, color)
- [ ] Verificar que todas las funciones del modal siguen operando

---

## Problema 4 — Botones de simplificación sin jerarquía ni explicación

**Síntoma:** los 5 botones (Sin simp. / Entero / Trig. / Exp. / Completo) aparecen como una barra de opciones planas. Un usuario nuevo no sabe qué hacen, cuál elegir, ni qué diferencia hay entre ellos.

**Solución:**
1. El botón activo ("Sin simp." por defecto) muestra el estado actual claramente.
2. Los botones inactivos muestran un tooltip `title` descriptivo al hacer hover.
3. Agregar una línea de descripción debajo de la barra que explique qué hace el perfil activo (texto pequeño, muted, traducible).

**Archivos a tocar:**
- `results-summary.component.ts` — agregar campo `description` al array `profileOptions`
- `results-summary.component.html` — mostrar descripción del perfil activo bajo la barra; agregar `title` a cada botón
- `en.json` / `es.json` — agregar claves `profileRawDesc`, `profileIntegerDesc`, `profileTrigDesc`, `profileExpDesc`, `profileCompleteDesc`

**Lo que NO cambia:** la lógica de `setProfile()`, `simplifyProfile()`, ni ninguna llamada a la API de simplificación.

- [ ] Agregar campo `description` y `tooltip` al array `profileOptions`
- [ ] Agregar claves de descripción en `en.json` y `es.json`
- [ ] Mostrar descripción del perfil activo como texto muted bajo la barra de botones
- [ ] Agregar `title` a cada botón con descripción breve
- [ ] Repetir para la barra de Parseval (mismo componente de perfil)
- [ ] Verificar que cambiar de perfil sigue disparando la simplificación

---

## Observaciones pendientes de aprobación (no incluidas en este plan)

Estas son issues adicionales detectadas. **No se tocan hasta que las apruebes explícitamente.**

| # | Observación | Impacto | Archivo |
|---|-------------|---------|---------|
| A | `showCanvasSettings` arranca en `true` → el panel de settings tapa el canvas al recibir un resultado | UX medio | `results-summary.component.ts` línea 187 |
| B | `nTerms` del backend (selector del form) y `canvasNTerms` (slider del modal) son dos controles distintos que los usuarios confunden | UX bajo | `calculator-form.component.html` + `results-summary.component.html` |

---

## Orden de ejecución recomendado

1. **Problema 1** (parámetros libres) — requiere el único cambio de arquitectura (mover signal al store); hacerlo primero evita tocar los mismos archivos dos veces.
2. **Problema 3** (limpiar modal) — trivial después de que P1 quita la sección freeParams del modal.
3. **Problema 4** (simplificación) — solo HTML + i18n, no depende de nada anterior.
4. **Problema 2** (tabs) — solo HTML + i18n, independiente.
