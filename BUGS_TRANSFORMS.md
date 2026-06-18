# Bugs detectados en el flujo de transformadas continuas

## BUG-1 (Resuelto) — `k/cosh(bt)` falla cuando el denominador es `c*cosh(bt)`

**Síntoma**: `FT(1/(2*cosh(πt/2)))` devuelve "la transformada no existe" aunque la transformada es `1/cosh(ω)`.

**Causa raíz**: En `FT_pattern_lookup` (línea 2246 de `fourier_transforms.mac`), el detector de `k/cosh(bt)` tiene tres casos:

```
Case 1: op="/", part(e,2) = cosh(...)         ← solo cosh en denominador
Case 2: op="/", part(e,1) = k, part(e,2) = cosh(...)  ← igual de restringido
Case 3: op="*", un factor es 1/cosh(...)
```

`expand(1/(2*cosh(πt/2)))` produce `op="/"`, `part(e,1)=1`, `part(e,2)=2*cosh(πt/2)`.
El denominador es un **producto** `c*cosh(...)`, así que los tres cases fallan. Cae a `FT_raw`,
que no puede integrar `1/cosh` analíticamente y marca `exists=false`.

**Fix aplicado** (`fourier_transforms.mac`, línea 2259): se añadió Case 2b entre Case 2 y Case 3.
Extrae el coeficiente constante `c` del denominador `c*cosh(b*t)` iterando sus factores,
igual que ya hace el handler IFT `single-sech` (líneas 4296-4302). La IFT ya lo manejaba
correctamente — solo faltaba la simetría en la FT.

Verificado con Maxima: `FT(1/(2*cosh(πt/2))) = 1/cosh(w)` y el ciclo de vuelta
`IFT(1/cosh(w)) = 1/(2*cosh(πt/2))` es correcto.

---

## BUG-2 (Latente) — Wrapper IFT aplica escala sin protección de delta

**Síntoma**: No reproducible fácilmente en la UI actual, pero potencialmente incorrecto para
convenciones no-engineering cuando el resultado de la IFT contiene `delta(t)`.

**Causa raíz**: En `inverse_fourier_transform.mac` (líneas 27-29):

```maxima
f_pos      : if result[1] # false then ratsimp(IFT_SCALE * result[1]) else false$
f_neg      : if result[2] # false then ratsimp(IFT_SCALE * result[2]) else false$
f_combined : if result[3] # false then ratsimp(IFT_SCALE * result[3]) else false$
```

`ratsimp` sobre un resultado que contiene `delta(t)` puede fusionar la parte racional y el término
delta en una sola fracción, destruyendo la forma tabla. El wrapper FT ya resuelve esto con
`FT_apply_scale` (líneas 28-40 de `fourier_transform.mac`), pero el wrapper IFT no usa esa función.

**Fix**: Mover `FT_apply_scale` a `fourier_transforms.mac` (ya está en el archivo, pero declarada
en el wrapper) y usarla en el wrapper IFT:

```maxima
f_pos      : FT_apply_scale(result[1], IFT_SCALE)$
f_neg      : FT_apply_scale(result[2], IFT_SCALE)$
f_combined : FT_apply_scale(result[3], IFT_SCALE)$
```

---

## BUG-3 (Latente) — `f_out_u_form` no protege contra `false`

**Síntoma**: Si `f_pos` o `f_neg` es `false` (Maxima literal), el cálculo de la forma u(t)
produce una expresión matemáticamente incorrecta que llega al frontend.

**Causa raíz**: En `inverse_fourier_transform.mac` (línea 35):

```maxima
f_out_u_form : ratsimp(f_pos*u(TRANSVAR) + f_neg*u(-TRANSVAR))$
```

Si `f_pos = false`, Maxima evalúa `false*u(t)` sin error pero produce basura.

**Fix**:

```maxima
f_out_u_form : ratsimp(
    (if f_pos = false then 0 else f_pos) * u(TRANSVAR) +
    (if f_neg = false then 0 else f_neg) * u(-TRANSVAR))$
```

---

## BUG-4 (Cosmético) — El campo `exists` de la IFT se infiere, no se lee

**Síntoma**: Si Maxima devuelve una integral no evaluada que no es `false` pero no es útil,
`exists` queda `true` incorrectamente.

**Causa raíz**: En `fourierTransform.service.ts` (línea 498):

```typescript
exists: fPosMaxima !== "" || fNegMaxima !== "",
```

La FT tiene un marcador explícito `__EXISTS__` y lo lee directamente. La IFT deduce existencia
por si hay output no vacío, que es una heurística más frágil.

**Fix**: Emitir `__EXISTS__` en `inverse_fourier_transform.mac` basado en `IFT_exists(f_pos)
and IFT_exists(f_neg)` y leerlo en el servicio igual que se hace para la FT.
