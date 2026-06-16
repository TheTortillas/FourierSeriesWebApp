# absExpander — Test Cases

Cases for validating the abs() piecewise expansion in `absExpander.ts`.
Each case specifies the expression, interval, and expected outcome.

Legend:
- ✅ Working — expander splits correctly, Maxima integrates symbolically
- ⚠️ Graceful fallback — expander passes through, Maxima uses numeric quadrature
- ❌ Broken — wrong result or unevaluated integral

---

## 1. Single abs, standard functions

| Expression | Interval | Zeros found | Status | Notes |
|---|---|---|---|---|
| `abs(x)` | `[-π, π]` | `0` | ✅ | Canonical case |
| `abs(sin(x))` | `[-π, π]` | `0` | ✅ | |
| `abs(cos(x))` | `[-π, π]` | `-π/2, π/2` | ✅ | |
| `abs(sin(x) - 0.5)` | `[-π, π]` | `π/6, 5π/6` (and negatives) | ✅ | Decimal breakpoints |
| `abs(x - 1)` | `[-π, π]` | `1` | ✅ | |
| `abs(2*x - 1)` | `[0, π]` | `1/2` | ✅ | |
| `exp(-abs(t))` | `[-π, π]` | `0` (inner is `t`) | ✅ | abs inside exponent |
| `abs(cos(2*x))` | `[-π, π]` | `±π/4, ±3π/4` | ✅ | Multiple zeros |
| `abs(sin(x))^2` | `[-π, π]` | — | ✅ | No abs after squaring — Maxima simplifies `(sin(x))^2` directly |

---

## 2. Multiple abs in the same expression

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(sin(x)) + abs(cos(x))` | `[-π, π]` | ✅ | Recursive: pass 1 splits on `sin` zeros, pass 2 on `cos` zeros |
| `abs(x) + abs(x - 1)` | `[-2, 2]` | ✅ | Two separate singularities |
| `abs(sin(x)) * abs(cos(x))` | `[-π, π]` | ✅ | Product of two abs |
| `abs(sin(x)) - abs(cos(x))` | `[-π, π]` | ✅ | |

---

## 3. Nested abs

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(abs(x) - 1)` | `[-2, 2]` | ✅ | Pass 1: inner is `abs(x)-1`, zeros at `±1`. Pass 2: expands remaining `abs(x)` in each sub-segment |
| `abs(abs(sin(x)) - 0.5)` | `[-π, π]` | ✅ | Two passes |

---

## 4. Removable singularities (not zeros)

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(sin(x)/x)` | `[-π, π]` | ✅ | `sin(x)/x` at `x=0` is NaN — grid skips it, no spurious split |
| `abs(sin(x)/x - 1)` | `[-π, π]` | ✅ | Zero of `sinc(x)-1` is at 0 (limit=1), but NaN guards it |

---

## 5. Always-positive inner (no zeros)

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(x^2 + 1)` | `[-π, π]` | ✅ | `x^2+1 > 0` always → single segment, abs replaced by `(x^2+1)` |
| `abs(exp(x))` | `[-π, π]` | ✅ | Always positive |
| `abs(x^2 + x + 1)` | `[-2, 2]` | ✅ | Discriminant < 0, no real zeros |

---

## 6. Quadratic with explicit numeric zeros

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(x^2 - 4)` | `[-3, 3]` | ✅ | Zeros at `±2` (rational, snapped) |
| `abs(x^2 - 2)` | `[-2, 2]` | ✅ | Zeros at `±√2 ≈ ±1.41421...` (decimal breakpoints) |
| `abs(x^2 - 9)` | `[-π, π]` | ✅ | Zeros at `±3`, but `3 > π` → no interior zero → single segment |
| `abs(x*(x-1)*(x+1))` | `[-2, 2]` | ✅ | Zeros at `-1, 0, 1` |

---

## 7. Parametric expressions — BROKEN

These fail because `a` is a free symbol in the compiled inner function.
`compile('x^2 - a^2', 'x')` returns NaN everywhere → no split → abs not removed.

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(x^2 - a^2)` | `[-π, π]` | ❌ | Inner `x^2-a^2` needs `a` in scope to find zeros `±a` |
| `abs(x - a)` | `[-π, π]` | ❌ | Inner `x-a` needs `a` |
| `abs(sin(x) - a)` | `[-π, π]` | ❌ | |
| `abs(a*x)` | `[-π, π]` | ❌ | Zero is at 0 regardless of `a`, but sign determination needs `a` |
| `abs(x^2 - a*x)` | `[-π, π]` | ❌ | Zeros at `0` and `a` |

**Root cause:** `expandOneAbs` compiles the inner expression as a JS function of `varName`
only. Free parameters like `a` are not in scope → `ReferenceError` → `NaN` throughout →
`findZeros` finds nothing → the segment passes through with `abs()` intact → Maxima
receives `integrate(abs(x^2-a^2)*cos(n*x), x, -π, π)` and cannot solve it symbolically.

**Affected services:** trigonometric, complex, halfRange, parseval.

**Fix needed:** Pass slider constant values (`{a: 1.5}`) from the frontend in the API
request, thread them into `compile()` as injected `const` declarations, and also
substitute them into the output expression string so Maxima receives fully numeric
sub-integrands.

---

## 8. Poles (not zeros — mathematically correct behavior)

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(1/x)` | `[-1, 1]` | ⚠️ | `1/x` pole at 0 detected as sign-change → split at 0. Result is mathematically correct (`-1/x` on `(-1,0)`, `1/x` on `(0,1)`) but integral is still divergent |
| `abs(tan(x))` | `[-π/3, π/3]` | ✅ | Zero at 0 found correctly; poles at `±π/2` are outside the interval |

---

## 9. High-frequency oscillation (aliasing risk)

Grid has 500 points on the interval. Risk of missing zeros when period < 2·step.

| Expression | Interval | Zeros | Status | Notes |
|---|---|---|---|---|
| `abs(sin(20*x))` | `[-π, π]` | 39 | ✅ | ~10 grid cells per period |
| `abs(sin(50*x))` | `[-π, π]` | 99 | ✅ | ~5 grid cells per period |
| `abs(sin(80*x))` | `[-π, π]` | 159 | ✅ | ~3 grid cells per period (Nyquist limit) |
| `abs(sin(250*x))` | `[-π, π]` | — | ⚠️ | Period < 2·step → aliasing, zeros missed or wrong. Academically irrelevant |

**Safe limit:** approximately `n ≤ 80` for a `[-π, π]` interval with 500 grid points.

---

## 10. Symbolic bounds (non-numeric interval)

| Expression | Interval | Status | Notes |
|---|---|---|---|
| Any expression | `[a, π]` or `[0, L]` | ⚠️ | `evalBound('a')` returns NaN → segment passes through unchanged → Maxima quadrature |

---

## 11. Edge cases in interval shape

| Expression | Interval | Status | Notes |
|---|---|---|---|
| `abs(sin(x) - cos(x))` | `[-π, π]` | ✅ | Zeros where `tan(x)=1` → `x = π/4 + kπ` |
| `abs(x^3 - x)` | `[-2, 2]` | ✅ | Zeros at `-1, 0, 1` |
| `abs(cos(2*x) - 0.5)` | `[-π, π]` | ✅ | Zeros where `cos(2x)=1/2` |
| `abs(x) * sin(x)` | `[-π, π]` | ✅ | Only one `abs()` — inner is `x`, zero at 0 |
| `abs(x^2 - pi^2)` | `[-π, π]` | ✅ | Zeros at `±π` are the boundaries → open interval search finds none → single segment with sign `−1` (correct: `x^2 - π^2 ≤ 0` on `(-π,π)`) |
