# Tablas de la Transformada de Fourier

## Convención

$$F(\omega) = \mathcal{F}\{f(t)\} = \int_{-\infty}^{\infty} f(t)\, e^{-i\omega t}\, dt$$

$$f(t) = \mathcal{F}^{-1}\{F(\omega)\} = \frac{1}{2\pi} \int_{-\infty}^{\infty} F(\omega)\, e^{i\omega t}\, d\omega$$

> **Parámetros**: $a, b > 0$ salvo que se indique lo contrario. $k$ es una constante real o compleja. $n \geq 1$ entero.

---

## 1. Propiedades y Reglas

| Propiedad | $f(t)$ | $F(\omega)$ | Condiciones |
|-----------|--------|-------------|-------------|
| **Linealidad** | $\alpha f(t) + \beta g(t)$ | $\alpha F(\omega) + \beta G(\omega)$ | $\alpha, \beta \in \mathbb{C}$ |
| **Escalar** | $k \cdot f(t)$ | $k \cdot F(\omega)$ | $k$ cte. |
| **Desplazamiento en tiempo** | $f(t - t_0)$ | $e^{-i\omega t_0} F(\omega)$ | $t_0 \in \mathbb{R}$ |
| **Desplazamiento en frecuencia** (modulación) | $e^{i\omega_0 t} f(t)$ | $F(\omega - \omega_0)$ | $\omega_0 \in \mathbb{R}$ |
| **Desplazamiento en tiempo (IFT)** | $f(t + t_0)$ | $e^{i\omega t_0} F(\omega)$ | $t_0 \in \mathbb{R}$ |
| **Escalado** | $f(at)$ | $\dfrac{1}{\lvert a \rvert} F\!\left(\dfrac{\omega}{a}\right)$ | $a \neq 0$ |
| **Conjugado** | $f^*(t)$ | $F^*(-\omega)$ | |
| **Simetría / Dualidad** | $F(t)$ | $2\pi f(-\omega)$ | |
| **Diferenciación en tiempo** | $f^{(n)}(t)$ | $(i\omega)^n F(\omega)$ | |
| **Multiplicación por $t$** | $t^n f(t)$ | $i^n F^{(n)}(\omega)$ | |
| **Convolución** | $(f * g)(t)$ | $F(\omega) \cdot G(\omega)$ | |
| **Producto** | $f(t) \cdot g(t)$ | $\dfrac{1}{2\pi}(F * G)(\omega)$ | |
| **Modulación por seno (IFT)** | $\dfrac{f(t+b) - f(t-b)}{2i}$ | $\sin(b\omega)\, F(\omega)$ | $b > 0$ |
| **Modulación por coseno (FT)** | $\cos(bt)\, f(t)$ | $\dfrac{G(\omega-b) + G(\omega+b)}{2}$ | $b > 0$,\; $G = \mathcal{F}\{f\}$ |
| **Modulación por seno (FT)** | $\sin(bt)\, f(t)$ | $\dfrac{G(\omega-b) - G(\omega+b)}{2i}$ | $b > 0$,\; $G = \mathcal{F}\{f\}$ |
| **Parseval** | $\displaystyle\int_{\mathbb{R}} \lvert f(t)\rvert^2 dt$ | $\dfrac{1}{2\pi}\displaystyle\int_{\mathbb{R}} \lvert F(\omega)\rvert^2 d\omega$ | |

---

## 2. Pares — Señales Básicas y Distribuciones

| # | $f(t)$ | $F(\omega) = \mathcal{F}\{f(t)\}$ |
|---|--------|----------------------------------|
| 1 | $\delta(t)$ | $1$ |
| 2 | $\delta(t - a)$ | $e^{-i\omega a}$ |
| 3 | $1$ | $2\pi\,\delta(\omega)$ |
| 4 | $c$ (constante) | $2\pi c\,\delta(\omega)$ |
| 5 | $e^{i\omega_0 t}$ | $2\pi\,\delta(\omega - \omega_0)$ |
| 6 | $\cos(\omega_0 t)$ | $\pi\bigl[\delta(\omega - \omega_0) + \delta(\omega + \omega_0)\bigr]$ |
| 7 | $\sin(\omega_0 t)$ | $-i\pi\bigl[\delta(\omega - \omega_0) - \delta(\omega + \omega_0)\bigr]$ |
| 8 | $\cos(\omega_0 t + \theta)$ | $\pi\bigl[e^{i\theta}\delta(\omega - \omega_0) + e^{-i\theta}\delta(\omega + \omega_0)\bigr]$ |
| 9 | $\sin(\omega_0 t + \theta)$ | $-i\pi\bigl[e^{i\theta}\delta(\omega - \omega_0) - e^{-i\theta}\delta(\omega + \omega_0)\bigr]$ |
| 10 | $u(t)$ | $\pi\,\delta(\omega) + \dfrac{1}{i\omega}$ |
| 11 | $u(t - t_0)$ | $\left(\pi\,\delta(\omega) + \dfrac{1}{i\omega}\right)e^{-i\omega t_0}$ |
| 12 | $k\,u(t - t_0)$ | $k\!\left(\pi\,\delta(\omega) + \dfrac{e^{-i\omega t_0}}{i\omega}\right)$ | 
| 13 | $\text{sgn}(t)$ | $\dfrac{2}{i\omega}$ |
| 14 | $\dfrac{\sin(at)}{\pi t}$ | $u(\omega + a) - u(\omega - a)$ (rect) |
| 15 | $\dfrac{k}{t}$ | $-ik\pi\,\text{sgn}(\omega)$ | V.P. de Cauchy, $n=1$ |
| 16 | $\dfrac{k}{t^n}$ | $\dfrac{k\,(-i\omega)^{n-1}}{(n-1)!}\,(-i\pi\,\text{sgn}(\omega))$ | V.P., $n \geq 1$ entero |

---

## 3. Pares — Exponenciales Causales (unilaterales)

| # | $f(t)$ | $F(\omega)$ | Condiciones |
|---|--------|-------------|-------------|
| 15 | $k\,e^{-at}u(t)$ | $\dfrac{k}{i\omega + a}$ | $a > 0$ |
| 16 | $k\,e^{-at}u(t - t_0)$ | $\dfrac{k\,e^{-at_0}\,e^{-i\omega t_0}}{i\omega + a}$ | $a > 0,\; t_0 \neq 0$ |
| 17 | $k\,t\,e^{-at}u(t)$ | $\dfrac{k}{(i\omega + a)^2}$ | $a > 0$ |
| 18 | $k\,t^2 e^{-at}u(t)$ | $\dfrac{2k}{(i\omega + a)^3}$ | $a > 0$ |
| 19 | $k\,t^n e^{-at}u(t)$ | $\dfrac{k\,n!}{(i\omega + a)^{n+1}}$ | $a > 0,\; n \geq 1$ |
| 20 | $k\,t^n e^{-at}u(t-t_0)$ | $k\,e^{-at_0}e^{-i\omega t_0}\displaystyle\sum_{j=0}^{n}\binom{n}{j}\frac{t_0^{n-j}\,j!}{(i\omega+a)^{j+1}}$ | $a>0,\;n\geq 1$ |
| 21 | $k\,e^{-at}\cos(bt)\,u(t)$ | $\dfrac{k\,(i\omega + a)}{(i\omega + a)^2 + b^2}$ | $a, b > 0$ |
| 22 | $k\,e^{-at}\sin(bt)\,u(t)$ | $\dfrac{k\,b}{(i\omega + a)^2 + b^2}$ | $a, b > 0$ |
| 23 | $\sin(\omega_0 t)\,u(t)$ | $\dfrac{\omega_0}{\omega_0^2 - \omega^2} + \dfrac{\pi}{2i}\bigl[\delta(\omega-\omega_0) - \delta(\omega+\omega_0)\bigr]$ | $\omega_0 > 0$ |
| 24 | $\cos(\omega_0 t)\,u(t)$ | $\dfrac{i\omega}{\omega_0^2 - \omega^2} + \dfrac{\pi}{2}\bigl[\delta(\omega-\omega_0) + \delta(\omega+\omega_0)\bigr]$ | $\omega_0 > 0$ |

---

## 4. Pares — Funciones de Energía (bilaterales)

| # | $f(t)$ | $F(\omega)$ | Condiciones |
|---|--------|-------------|-------------|
| 25 | $e^{-a\lvert t\rvert}$ | $\dfrac{2a}{a^2 + \omega^2}$ | $a > 0$ |
| 26 | $\dfrac{1}{a^2 + t^2}$ | $\dfrac{\pi}{a}\,e^{-a\lvert\omega\rvert}$ | $a > 0$ |
| 27 | $\dfrac{k}{A t^2 + B t + C}$ | $\dfrac{k\pi}{Aa}\,e^{-a\lvert\omega\rvert}\,e^{-i\omega t_0}$ | $B^2 - 4AC < 0$,<br>$A > 0$,<br>$t_0 = -B/(2A)$,<br>$a = \sqrt{(4AC - B^2)/(4A^2)}$ |
| 28 | $\dfrac{t}{a^2 + t^2}$ | $-i\pi\,\text{sgn}(\omega)\,e^{-a\lvert\omega\rvert}$ | $a > 0$ |
| 29 | $\dfrac{\cos(bt)}{a^2 + t^2}$ | $\dfrac{\pi}{2a}\bigl[e^{-a\lvert\omega - b\rvert} + e^{-a\lvert\omega + b\rvert}\bigr]$ | $a, b > 0$ |
| 30 | $\dfrac{\sin(bt)}{a^2 + t^2}$ | $\dfrac{\pi}{2ai}\bigl[e^{-a\lvert\omega - b\rvert} - e^{-a\lvert\omega + b\rvert}\bigr]$ | $a, b > 0$ |
| 31 | $e^{-t^2/(2\sigma^2)}$ (gaussiana) | $\sigma\sqrt{2\pi}\,e^{-\sigma^2\omega^2/2}$ | $\sigma > 0$ |
| 32 | $e^{i\omega_0 t}\,g(t)$ | $G(\omega - \omega_0)$ | desplazamiento en $\omega$ |

---

## 5. Pares — Transformada Inversa (IFT → tiempo)

Pares adicionales expresados desde el dominio de frecuencia, útiles al aplicar $\mathcal{F}^{-1}$.

| # | $F(\omega)$ | $f(t) = \mathcal{F}^{-1}\{F(\omega)\}$ | Condiciones |
|---|-------------|----------------------------------------|-------------|
| 33 | $1$ | $\delta(t)$ | |
| 34 | $\delta(\omega - a)$ | $\dfrac{e^{iat}}{2\pi}$ | |
| 35 | $2\pi\,\delta(\omega - a)$ | $e^{iat}$ | |
| 36 | $e^{-i\omega t_0}$ | $\delta(t - t_0)$ | |
| 37 | $e^{+i\omega t_0}$ | $\delta(t + t_0)$ | |
| 38 | $\dfrac{k}{i\omega}$ | $\dfrac{k}{2}\,\text{sgn}(t)$ | |
| 39 | $\pi\,\delta(\omega) + \dfrac{1}{i\omega}$ | $u(t)$ | |
| 40 | $\dfrac{k}{i\omega + a}$ | $k\,e^{-at}u(t)$ | $a > 0$ |
| 41 | $\dfrac{k}{(i\omega + a)^2}$ | $k\,t\,e^{-at}u(t)$ | $a > 0$ |
| 42 | $\dfrac{k}{(i\omega + a)^n}$ | $\dfrac{k\,t^{n-1}}{(n-1)!}\,e^{-at}u(t)$ | $a > 0,\;n \geq 1$ entero |
| 43 | $\dfrac{b}{(i\omega+a)^2+b^2}$ | $e^{-at}\sin(bt)\,u(t)$ | $a, b > 0$ |
| 44 | $\dfrac{i\omega+a}{(i\omega+a)^2+b^2}$ | $e^{-at}\cos(bt)\,u(t)$ | $a, b > 0$ |
| 45 | $\dfrac{2a}{a^2 + \omega^2}$ | $e^{-a\lvert t\rvert}$ | $a > 0$ |
| 46 | $\dfrac{k}{a^2 + \omega^2}$ | $\dfrac{k}{2a}\,e^{-a\lvert t\rvert}$ | $a > 0$ |
| 47 | $\dfrac{\pi}{a}\,e^{-a\lvert\omega\rvert}$ | $\dfrac{1}{a^2 + t^2}$ | $a > 0$ |
| 48 | $e^{-a\lvert\omega + \omega_0\rvert}$ | $\dfrac{a}{\pi}\,\dfrac{e^{-i\omega_0 t}}{a^2 + t^2}$ | $a > 0,\;\omega_0 \in \mathbb{R}$ |
| 49 | $\dfrac{k}{\omega(i\omega + a)}$ | $\dfrac{ik}{a}\!\left(\dfrac{\text{sgn}(t)}{2} - e^{-at}u(t)\right)$ | $a > 0$ |
| 50 | $e^{it_0\omega}\,G(\omega)$ | $g(t + t_0)$ | desplazamiento en $t$ |
| 51 | $\sin(b\omega)\,F(\omega)$ | $\dfrac{f(t+b) - f(t-b)}{2i}$ | $b > 0$ |
| 52 | $\cos(b\omega)\,F(\omega)$ | $\dfrac{f(t+b) + f(t-b)}{2}$ | $b > 0$ |
| 53 | $\dfrac{k}{A\omega^2 + B\omega + C}$ | $\dfrac{k}{2Aa}\,e^{-a\lvert t\rvert}\,e^{i\omega_0 t}$ | $A > 0$,\; $4AC - B^2 > 0$,<br>$\omega_0 = -B/(2A)$,<br>$a = \sqrt{(4AC-B^2)/(4A^2)}$ |
| 54 | $\dfrac{k\,e^{-i\omega t_0}}{(i\omega+a)^n}$ | $\dfrac{k\,(t-t_0)^{n-1}}{(n-1)!}\,e^{-a(t-t_0)}\,u(t-t_0)$ | $a > 0,\;n \geq 1,\;t_0 \in \mathbb{R}$ |
| 55 | $\dfrac{k\,\sin\!\bigl(c(\omega-\omega_0)\bigr)}{\omega - \omega_0}$ | $\dfrac{k}{2}\,e^{-i\omega_0 t}\,\bigl(u(t+c)-u(t-c)\bigr)$ | $c > 0,\;\omega_0 \in \mathbb{R}$ |
| 56 | $\dfrac{P(\omega)}{Q(\omega)}$ (fracción propia) | $\displaystyle\sum_i \mathcal{F}^{-1}\!\left\{\frac{r_i}{(i\omega+a_i)^{n_i}}\right\}$ | vía descomposición en fracciones parciales sobre los pares anteriores |

---

## 6. Resumen de Meta-operadores

Estos operadores se aplican **por encima** de cualquier par de la tabla, permitiendo construir transformadas compuestas.

| Operador | Dominio tiempo | Dominio frecuencia |
|----------|---------------|--------------------|
| Escalar | $k\,f(t)$ | $k\,F(\omega)$ |
| Linealidad | $\sum_i c_i f_i(t)$ | $\sum_i c_i F_i(\omega)$ |
| **Desplazamiento en tiempo** | $f(t - t_0)$ | $e^{-i\omega t_0}F(\omega)$ |
| **Desplazamiento en frecuencia (FT)** | $e^{i\omega_0 t}g(t)$ | $G(\omega - \omega_0)$ |
| **Desplazamiento en tiempo (IFT)** | $g(t + t_0)$ | $e^{it_0\omega}G(\omega)$ |
| **Modulación por seno (IFT)** | $\dfrac{f(t+b)-f(t-b)}{2i}$ | $\sin(b\omega)\,F(\omega)$ |
| **Modulación por coseno (IFT)** | $\dfrac{f(t+b)+f(t-b)}{2}$ | $\cos(b\omega)\,F(\omega)$ |
| **Modulación por coseno (FT)** | $\cos(bt)\,f(t)$ | $\dfrac{G(\omega-b)+G(\omega+b)}{2}$ |
| **Modulación por seno (FT)** | $\sin(bt)\,f(t)$ | $\dfrac{G(\omega-b)-G(\omega+b)}{2i}$ |

---

## 7. Identidades útiles

$$e^{i\omega_0 t} = \cos(\omega_0 t) + i\sin(\omega_0 t)$$

$$\cos(\omega_0 t) = \frac{e^{i\omega_0 t} + e^{-i\omega_0 t}}{2}, \qquad \sin(\omega_0 t) = \frac{e^{i\omega_0 t} - e^{-i\omega_0 t}}{2i}$$

$$\int_{-\infty}^{\infty} \delta(t-a)\,f(t)\,dt = f(a)$$

$$\text{sgn}(t) = 2u(t) - 1, \qquad u(t) = \frac{1 + \text{sgn}(t)}{2}$$

$$\frac{d}{dt}u(t) = \delta(t), \qquad \frac{d}{dt}\text{sgn}(t) = 2\delta(t)$$

---

## 8. Notas sobre la Lorentziana Generalizada (par #27)

Para una fracción de la forma $\dfrac{k}{At^2 + Bt + C}$ con discriminante $B^2 - 4AC < 0$:

1. Completar el cuadrado: $At^2 + Bt + C = A\bigl[(t - t_0)^2 + a^2\bigr]$
2. Donde $t_0 = -\dfrac{B}{2A}$ y $a = \sqrt{\dfrac{4AC - B^2}{4A^2}}$
3. Transformada: $F(\omega) = \dfrac{k\pi}{Aa}\,e^{-a|\omega|}\,e^{-i\omega t_0}$

**Caso simple** ($B = 0$, es decir $t_0 = 0$): $\dfrac{k}{a^2 + t^2} \;\longrightarrow\; \dfrac{k\pi}{a}\,e^{-a|\omega|}$

---

## 9. Notas sobre la fracción $k/[\omega(i\omega+a)]$ (par #49)

Derivado por fracciones parciales:
$$\frac{1}{\omega(i\omega + a)} = \frac{1/a}{\omega} - \frac{i/a}{i\omega + a}$$

$$\mathcal{F}^{-1}\left\{\frac{k}{\omega(i\omega+a)}\right\} = \frac{k}{a}\left[\mathcal{F}^{-1}\!\left\{\frac{1}{\omega}\right\} - i\,\mathcal{F}^{-1}\!\left\{\frac{i}{i\omega+a}\right\}\right]= \frac{ik}{a}\left(\frac{\text{sgn}(t)}{2} - e^{-at}u(t)\right)$$

---

## 10. Notas sobre las FT distribucionales $k/t^n$ (pares #15–16)

Estas transformadas se definen en el sentido del **valor principal de Cauchy (V.P.)**, ya que $1/t^n$ no es integrable en el origen:

$$\mathcal{F}\!\left\{\frac{k}{t^n}\right\} \stackrel{\text{V.P.}}{=} \frac{k\,(-i\omega)^{n-1}}{(n-1)!}\cdot(-i\pi\,\text{sgn}(\omega))$$

**Casos explícitos:**

| $n$ | $f(t)$ | $F(\omega)$ |
|-----|--------|-------------|
| 1 | $k/t$ | $-ik\pi\,\text{sgn}(\omega)$ |
| 2 | $k/t^2$ | $-k\pi\omega\,\text{sgn}(\omega)$ |
| 3 | $k/t^3$ | $\dfrac{ik\pi\omega^2}{2}\,\text{sgn}(\omega)$ |

**Derivación**: por inducción usando $\mathcal{F}\{f'(t)\} = i\omega F(\omega)$ y el hecho de que $\mathcal{F}\{1/t\} = -i\pi\,\text{sgn}(\omega)$.

---

## 12. Notas sobre la Lorentziana IFT generalizada (par #53)

Para una fracción de la forma $\dfrac{k}{A\omega^2 + B\omega + C}$ con $A > 0$ y $4AC - B^2 > 0$ (discriminante negativo):

1. Completar el cuadrado: $A\omega^2 + B\omega + C = A\bigl[(\omega - \omega_0)^2 + a^2\bigr]$
2. Donde $\omega_0 = -\dfrac{B}{2A}$ y $a = \sqrt{\dfrac{4AC - B^2}{4A^2}}$
3. Transformada inversa: $f(t) = \dfrac{k}{2Aa}\,e^{-a|t|}\,e^{i\omega_0 t}$

**Caso particular** ($B = 0$, es decir $\omega_0 = 0$): coincide con el par #46 ($k/(a^2+\omega^2) \to ke^{-a|t|}/(2a)$).

**Nota**: la restricción $B \neq 0$ es necesaria para que este handler se active; $B = 0$ lo cubre el handler anterior más simple. La condición $4AC - B^2 > 0$ garantiza que el denominador no tenga raíces reales (señal de energía finita).

---

## 11. Notas sobre modulación por seno y coseno en IFT (pares #51–52)

Ambas se derivan de la fórmula de Euler aplicada a $e^{\pm ib\omega}$:

$$\sin(b\omega) = \frac{e^{ib\omega} - e^{-ib\omega}}{2i}, \qquad \cos(b\omega) = \frac{e^{ib\omega} + e^{-ib\omega}}{2}$$

Combinado con el **desplazamiento en tiempo** ($e^{ib\omega}F(\omega) \leftrightarrow f(t+b)$):

$$\mathcal{F}^{-1}\{\sin(b\omega)\,F(\omega)\} = \frac{f(t+b) - f(t-b)}{2i}$$

$$\mathcal{F}^{-1}\{\cos(b\omega)\,F(\omega)\} = \frac{f(t+b) + f(t-b)}{2}$$

> **Nota**: los análogos directos (pares #15–16 de la tabla de propiedades, y meta-operadores FT de la sección 6) tienen handlers explícitos en la tabla de patrones. Se activan siempre que $G = \mathcal{F}\{f\}$ sea resoluble por otro patrón de la tabla.

---

## 13. Polo causal de orden n con desplazamiento en tiempo — par #54

$$\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-i\omega t_0}}{(i\omega+a)^n}\right\} = \frac{k\,(t-t_0)^{n-1}}{(n-1)!}\,e^{-a(t-t_0)}\,u(t-t_0), \qquad a > 0,\; n \geq 1$$

Caso general del par #42 con desplazamiento en tiempo ($e^{-i\omega t_0} F(\omega) \leftrightarrow f(t-t_0)$):

$$\mathcal{F}^{-1}\!\left\{\frac{k}{(i\omega+a)^n}\right\} = \frac{k\,t^{n-1}}{(n-1)!}\,e^{-at}\,u(t) \quad\xrightarrow{t_0\text{-shift}}\quad \frac{k\,(t-t_0)^{n-1}}{(n-1)!}\,e^{-a(t-t_0)}\,u(t-t_0)$$

Implementado combinando el **handler general** `k/(iω+a)^n` (par #42) con el **time-shift handler**, que detecta el factor $e^{it_0\omega}$ y delega el resto recursivamente.

---

## 14. Sinc desplazado en frecuencia — par #55

$$\mathcal{F}^{-1}\!\left\{\frac{k\,\sin\!\bigl(c(\omega-\omega_0)\bigr)}{\omega - \omega_0}\right\} = \frac{k}{2}\,e^{+i\omega_0 t}\,\bigl(u(t+c)-u(t-c)\bigr), \qquad c > 0$$

Derivado aplicando la propiedad de desplazamiento en frecuencia $\mathcal{F}^{-1}\{G(\omega-\omega_0)\} = e^{+i\omega_0 t}\,g(t)$ al sinc base:

$$\frac{\sin(c(\omega-\omega_0))}{\omega-\omega_0} \;\xrightarrow{\mathcal{F}^{-1}}\; e^{+i\omega_0 t}\cdot\frac{u(t+c)-u(t-c)}{2}$$

> **Signo positivo**: la convención IFT lleva $e^{+i\omega t}$ en el integrando, así que un desplazamiento $\omega \to \omega - \omega_0$ en el dominio frecuencia multiplica por $e^{+i\omega_0 t}$ en el dominio tiempo. El signo **negativo** aparece solo en la dirección FT directa ($f(t) \to F(\omega)$).

El caso $\omega_0 = 0$ recupera el sinc no desplazado. Cuando $k=1$ y $\omega_0=0$, la función de tiempo es la función **rect** de ancho $2c$ escalada por $1/2$.

---

## 15. Handler general para polos causales de orden n — par #42

El detector en `IFT_pattern_lookup` identifica denominadores de la forma $s \cdot (i\omega+a)^n$ para cualquier $n \geq 1$ y escalar real $s \neq 0$:

1. Extraer grado $n = \deg_\omega(\text{denom})$ y coeficiente líder $c_n = s \cdot i^n$
2. Calcular $s = c_n / i^n$ (escalar real absorbido)
3. Extraer $a = (c_0/s)^{1/n}$ donde $c_0 = \text{denom}\big|_{\omega=0}$
4. Verificar $\text{denom} = s \cdot (i\omega+a)^n$ exactamente
5. Resultado: $k_{\text{eff}} = \text{num}/s$, $f(t) = k_{\text{eff}}\,\dfrac{t^{n-1}}{(n-1)!}\,e^{-at}\,u(t)$

El escalar $s$ en el denominador aparece naturalmente en las fracciones parciales (p.ej. $1/(2\,(i\omega+3))$ da $s=2$, $k_\text{eff} = 1/2$). Este handler **reemplaza** los handlers separados para $n=1$ y $n=2$.

---

## 16. Fracciones racionales propias via fracciones parciales — par #56

Cualquier fracción racional causal propia $P(\omega)/Q(\omega)$ con $\deg P < \deg Q$ y raíces de $Q$ en el semiplano izquierdo ($\text{Re}(p_i) < 0$) se descompone automáticamente:

$$\frac{P(\omega)}{Q(\omega)} = \sum_{i}\sum_{j=1}^{n_i} \frac{r_{ij}}{(i\omega - p_i)^j}
\quad\xrightarrow{\mathcal{F}^{-1}}\quad
\sum_{i}\sum_{j=1}^{n_i} \frac{r_{ij}\,t^{j-1}}{(j-1)!}\,e^{p_i t}\,u(t)$$

Implementado como último recurso en `IFT_pattern_lookup`: aplica `partfrac(F, ω)` y si el resultado es una suma, delega cada término al resto del lookup via linealidad.

**Ejemplos cubiertos automáticamente:**

| $F(\omega)$ | Descomposición | $f(t)$ |
|---|---|---|
| $\dfrac{1}{(i\omega+1)(i\omega+2)}$ | $\dfrac{1}{i\omega+1} - \dfrac{1}{i\omega+2}$ | $(e^{-t} - e^{-2t})\,u(t)$ |
| $\dfrac{i\omega+3}{(i\omega+1)(i\omega+2)}$ | $\dfrac{2}{i\omega+1} - \dfrac{1}{i\omega+2}$ | $(2e^{-t} - e^{-2t})\,u(t)$ |
| $\dfrac{i\omega}{(i\omega+1)^2}$ | $\dfrac{1}{i\omega+1} - \dfrac{1}{(i\omega+1)^2}$ | $(1-t)\,e^{-t}\,u(t)$ |
| $\dfrac{1}{(i\omega+1)^2(i\omega+2)}$ | $\dfrac{1}{i\omega+1} - \dfrac{1}{(i\omega+1)^2} + \dfrac{1}{i\omega+2}$ | $(1-t)\,e^{-t}\,u(t) + e^{-2t}\,u(t)$ |

---

## 17. Handler de desplazamiento en frecuencia (IFT) — propiedad de modulación

$$\mathcal{F}^{-1}\{F(\omega - \omega_0)\} = e^{+i\omega_0 t}\,f(t)$$

El detector extrae $\omega_0$ directamente del denominador expandido de $F(\omega)$, sin requerir que el usuario exprese el desplazamiento explícitamente:

1. Sea $D(\omega)$ el denominador de $F(\omega)$; expandir: $D_{\exp} = c_1 \omega + c_0$ (lineal en $\omega$)
2. Calcular $\omega_0 = -\text{Im}(c_0)\,/\,\text{Im}(c_1)$
3. Sustituir $\omega \to \omega + \omega_0$ en $F(\omega)$ para obtener $G(\omega)$ (denominador con parte imaginaria constante nula)
4. Resolver $g(t) = \mathcal{F}^{-1}\{G(\omega)\}$ vía los handlers existentes
5. Resultado: $f(t) = e^{+i\omega_0 t}\,g(t)$

> **Importante**: el handler usa `F_expr` sin `ratsimp` en la sustitución — `ratsimp` dentro del contexto de `IFT_pattern_lookup` puede expandir exponenciales negativas al denominador (moviendo $e^{-i\omega t_0}$ de numerador a denominador), ocultando el factor exponencial necesario para el handler de desplazamiento en tiempo.

**Ejemplos:**

| $F(\omega)$ | $\omega_0$ | $G(\omega) = F(\omega+\omega_0)$ | $f(t) = e^{i\omega_0 t}\,g(t)$ |
|---|---|---|---|
| $\dfrac{1}{i(\omega-3)+5}$ | $3$ | $\dfrac{1}{i\omega+5}$ | $e^{3it}\,e^{-5t}\,u(t)$ |
| $\dfrac{e^{-2i(\omega-3)}}{i(\omega-3)+5}$ | $3$ | $\dfrac{e^{-2i\omega}}{i\omega+5}$ | $e^{3it}\,e^{-5(t-2)}\,u(t-2)$ |
| $\dfrac{1}{(i(\omega-2)+3)^2}$ | $2$ | $\dfrac{1}{(i\omega+3)^2}$ | $e^{2it}\,t\,e^{-3t}\,u(t)$ |
| $\dfrac{2\sin(\omega-1)}{\omega-1}$ | $1$ | $\dfrac{2\sin\omega}{\omega}$ | $e^{it}(u(t+1)-u(t-1))$ |

---

## 18. Polo de orden fraccionario $k/\sqrt{i\omega+a}$ — par #57

$$\mathcal{F}^{-1}\!\left\{\frac{k}{\sqrt{i\omega+a}}\right\} = \frac{k\,e^{-at}}{\sqrt{\pi\,t}}\,u(t), \qquad a > 0$$

Aparece en sistemas con dinámica de difusión o respuestas de "medio orden". El handler detecta `sqrt(iw+a)` en el denominador (incluyendo escalares reales absorbidos) y combina con el desplazamiento en tiempo para el caso `e^{-iωt₀}/sqrt(iw+a)`.

| $F(\omega)$ | $f(t)$ |
|---|---|
| $\dfrac{1}{\sqrt{i\omega+1}}$ | $\dfrac{e^{-t}}{\sqrt{\pi t}}\,u(t)$ |
| $\dfrac{5}{\sqrt{i\omega+2}}$ | $\dfrac{5\,e^{-2t}}{\sqrt{\pi t}}\,u(t)$ |
| $\dfrac{1}{\sqrt{2(i\omega+1)}}$ | $\dfrac{e^{-t}}{\sqrt{2\pi t}}\,u(t)$ |
| $\dfrac{e^{-i\omega}}{\sqrt{i\omega+1}}$ | $\dfrac{e^{-(t-1)}}{\sqrt{\pi(t-1)}}\,u(t-1)$ |

> **Nota**: `1/sqrt(w)` bilateral no está soportado — diverge en $\omega=0$ y solo tiene sentido como distribución unilateral ($\omega>0$).

