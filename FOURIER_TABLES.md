# Compendio de Análisis de Fourier

> Documento de referencia completo para **fouriersolver.com**.
> Cubre todas las herramientas disponibles: series trigonométricas, complejas,
> de medio rango, DFT/FFT y la transformada continua de Fourier.
> Las fórmulas coinciden exactamente con la implementación en Maxima CAS.

---

# PARTE I — SERIES DE FOURIER

---

## I.1 Conceptos Fundamentales

### Señal periódica

Una función $f$ es **periódica de período $T$** si para todo $x$ en su dominio:

$$f(x + T) = f(x), \qquad T > 0$$

El **período fundamental** es el menor valor positivo de $T$ con esa propiedad.
Cualquier múltiplo entero de $T$ es también un período.

### Período T y frecuencias

| Magnitud                       | Símbolo    | Definición                     | Unidades                              |
| ------------------------------ | ---------- | ------------------------------ | ------------------------------------- |
| Período                        | $T$        | Duración de un ciclo completo  | s (o cualquier unidad de la variable) |
| Frecuencia fundamental         | $f_0$      | $f_0 = 1/T$                    | Hz = ciclos/s                         |
| Frecuencia angular fundamental | $\omega_0$ | $\omega_0 = 2\pi/T = 2\pi f_0$ | rad/s                                 |

Relación directa:

$$\omega_0 = \frac{2\pi}{T}, \qquad T = \frac{2\pi}{\omega_0}$$

Los **armónicos** tienen frecuencias $n\omega_0$, amplitudes $a_n$, $b_n$ (o $c_n$) para $n = 1, 2, 3, \ldots$

### Determinación del período a partir del intervalo

La aplicación calcula el período directamente de los extremos del intervalo de entrada:

$$T = x_{\text{fin}} - x_{\text{inicio}}$$

**Ejemplo:** si la función se define en $[-\pi, \pi]$, entonces $T = 2\pi$ y $\omega_0 = 2\pi / 2\pi = 1\,\text{rad/s}$.

### Condiciones de Dirichlet (convergencia)

La serie de Fourier de $f$ converge a $f(x)$ en todo punto de continuidad si se cumplen las **condiciones de Dirichlet**:

1. $f$ es absolutamente integrable en un período: $\displaystyle\int_0^T |f(x)|\,dx < \infty$
2. $f$ tiene un número finito de máximos y mínimos por período
3. $f$ tiene un número finito de discontinuidades de salto por período

En un punto de **discontinuidad de salto** $x_0$, la serie converge al promedio de los límites laterales:

$$S(x_0) = \frac{f(x_0^+) + f(x_0^-)}{2}$$

---

## I.2 Serie de Fourier Trigonométrica

### Definición

Toda función que satisface las condiciones de Dirichlet admite la representación:

$$\boxed{f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} \Bigl[a_n \cos(n\omega_0 x) + b_n \sin(n\omega_0 x)\Bigr]}$$

donde $\omega_0 = 2\pi/T$.

> **Nota de convención:** en la fórmula de la serie, el término constante se escribe
> como $a_0/2$ (no $a_0$). Esto mantiene la fórmula de $a_n$ uniforme para todos los $n \geq 0$:
> el mismo integral con $\cos(0) = 1$ produce $a_0$.
> Algunos textos definen $A_0 = a_0/2$ para evitar la división.

### Coeficientes (fórmulas de Euler–Fourier)

Para una función definida por tramos en $[a, b]$ con $T = b - a$:

$$a_0 = \frac{2}{T}\int_a^b f(x)\,dx$$

$$a_n = \frac{2}{T}\int_a^b f(x)\cos(n\omega_0 x)\,dx, \qquad n = 1, 2, 3, \ldots$$

$$b_n = \frac{2}{T}\int_a^b f(x)\sin(n\omega_0 x)\,dx, \qquad n = 1, 2, 3, \ldots$$

El término constante de la serie es:

$$\frac{a_0}{2} = \frac{1}{T}\int_a^b f(x)\,dx = \overline{f} \quad \text{(valor medio de } f\text{)}$$

### Cálculo por tramos

Si $f$ está definida por $m$ tramos con expresiones $f_1, f_2, \ldots, f_m$ en los subintervalos $[a_1,b_1], [a_2,b_2], \ldots, [a_m,b_m]$ tales que $a_1 = a$ y $b_m = b$:

$$a_0 = \sum_{i=1}^{m} \frac{2}{T}\int_{a_i}^{b_i} f_i(x)\,dx$$

$$a_n = \sum_{i=1}^{m} \frac{2}{T}\int_{a_i}^{b_i} f_i(x)\cos(n\omega_0 x)\,dx$$

$$b_n = \sum_{i=1}^{m} \frac{2}{T}\int_{a_i}^{b_i} f_i(x)\sin(n\omega_0 x)\,dx$$

### Propiedades de simetría

Las simetrías de $f$ anulan la mitad de los coeficientes:

| Tipo de función            | Condición            | Coeficientes nulos                         | Coeficientes no nulos   |
| -------------------------- | -------------------- | ------------------------------------------ | ----------------------- |
| **Par**                    | $f(-x) = f(x)$       | $b_n = 0$ para todo $n$                    | $a_0, a_1, a_2, \ldots$ |
| **Impar**                  | $f(-x) = -f(x)$      | $a_n = 0$ para todo $n$ (incluyendo $a_0$) | $b_1, b_2, \ldots$      |
| **Simetría de media onda** | $f(x + T/2) = -f(x)$ | $a_n, b_n = 0$ para $n$ par                | Solo $n$ impares        |

> Estas propiedades solo aplican cuando el intervalo de análisis es **simétrico respecto al origen** ($a = -T/2$, $b = T/2$). Si el intervalo es $[0, T]$, la función no es par ni impar en sentido estricto.

### Serie parcial de orden N

La **suma parcial** se obtiene truncando la serie infinita:

$$S_N(x) = \frac{a_0}{2} + \sum_{n=1}^{N} \Bigl[a_n \cos(n\omega_0 x) + b_n \sin(n\omega_0 x)\Bigr]$$

La aplicación visualiza $S_N$ para el valor de $N$ que el usuario ingresa.

**Fenómeno de Gibbs:** cerca de una discontinuidad de salto, $S_N$ siempre sobrepasa el valor de $f$ en aproximadamente $8.9\%$ de la amplitud del salto, sin importar cuán grande sea $N$. Es un fenómeno intrínseco de la convergencia puntual de series de Fourier, no un error numérico.

---

## I.3 Serie de Fourier Compleja (Exponencial)

### Motivación

Usando las identidades de Euler:

$$\cos(n\omega_0 x) = \frac{e^{in\omega_0 x} + e^{-in\omega_0 x}}{2}, \qquad \sin(n\omega_0 x) = \frac{e^{in\omega_0 x} - e^{-in\omega_0 x}}{2i}$$

la serie trigonométrica se reescribe compactamente como una suma de exponenciales complejas.

### Definición

$$\boxed{f(x) = \sum_{n=-\infty}^{+\infty} c_n\, e^{in\omega_0 x}}$$

donde el índice $n$ recorre todos los enteros (positivos, negativos y cero).

### Coeficiente complejo $c_n$

$$\boxed{c_n = \frac{1}{T}\int_a^b f(x)\, e^{-in\omega_0 x}\,dx}, \qquad n \in \mathbb{Z}$$

**Coeficiente $c_0$** (caso $n = 0$, que es el término constante):

$$c_0 = \frac{1}{T}\int_a^b f(x)\,dx = \frac{a_0}{2} = \overline{f}$$

### Relación con los coeficientes trigonométricos

Para $n \geq 1$:

$$c_n = \frac{a_n - ib_n}{2}, \qquad c_{-n} = \frac{a_n + ib_n}{2} = c_n^*$$

Y la inversa:

$$a_n = c_n + c_{-n} = 2\,\text{Re}(c_n), \qquad b_n = i(c_n - c_{-n}) = -2\,\text{Im}(c_n)$$

### Espectro de amplitudes y fases

Cada coeficiente $c_n$ representa un **fasor** en el plano complejo:

$$c_n = |c_n|\,e^{i\phi_n}, \qquad |c_n| = \frac{\sqrt{a_n^2 + b_n^2}}{2}, \qquad \phi_n = \arg(c_n) = \arctan\!\left(\frac{-b_n}{a_n}\right)$$

La **amplitud** del $n$-ésimo armónico es $2|c_n|$ para $n \neq 0$ (hay contribuciones de $c_n$ y $c_{-n}$).

### Función real → espectro conjugado

Si $f(x) \in \mathbb{R}$, entonces:

$$c_{-n} = c_n^* \quad \Rightarrow \quad |c_{-n}| = |c_n|, \quad \phi_{-n} = -\phi_n$$

El espectro de amplitudes es **par** y el espectro de fases es **impar** respecto a $n$.

---

## I.4 Serie de Fourier de Medio Rango

### Concepto

Dada una función $f$ definida solo en un intervalo $[x_0,\, x_0+L]$, es posible construir dos series de Fourier distintas:

1. **Serie Coseno** — extendiendo $f$ como función **par** al intervalo doble $[x_0-L,\, x_0+L]$, y luego periódicamente con período $T_{\text{ef}} = 2L$.
2. **Serie Seno** — extendiendo $f$ como función **impar** al mismo intervalo doble.

Ambas representan exactamente a $f$ en el intervalo original $[x_0, x_0+L]$.

### Parámetros

Sea $L = x_{\text{fin}} - x_{\text{inicio}}$ la longitud del intervalo. Definimos:

$$T_{\text{ef}} = 2L \qquad \text{(período efectivo de la extensión)}$$

$$\omega_0^{(\text{MR})} = \frac{2\pi}{T_{\text{ef}}} = \frac{\pi}{L}$$

> **Diferencia clave respecto a la serie trigonométrica completa:**
> La serie trigonométrica completa tiene $\omega_0 = 2\pi/T$ con $T = L$.
> La serie de medio rango tiene $\omega_0 = \pi/L$ (la mitad), porque el período
> efectivo de la extensión es $2L$, no $L$.

### Desplazamiento de origen

La implementación trabaja con la variable desplazada $\xi = x - x_0$ (donde $x_0 = x_{\text{inicio}}$), de modo que los armónicos se evalúan en $\xi \in [0, L]$. Esto permite aplicar las fórmulas estándar de medio rango (que normalmente asumen intervalo $[0, L]$) a cualquier intervalo $[x_0, x_0+L]$.

### Serie Coseno (extensión par)

$$\boxed{f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} a_n \cos\!\left(\frac{n\pi}{L}(x - x_0)\right)}$$

**Coeficientes coseno:**

$$a_0 = \frac{2}{L}\int_{x_0}^{x_0+L} f(x)\,dx \qquad \text{(término constante, igual a } 2\overline{f}\text{)}$$

$$a_n = \frac{2}{L}\int_{x_0}^{x_0+L} f(x)\cos\!\left(\frac{n\pi}{L}(x - x_0)\right)dx, \qquad n = 1, 2, 3, \ldots$$

### Serie Seno (extensión impar)

$$\boxed{f(x) = \sum_{n=1}^{\infty} b_n \sin\!\left(\frac{n\pi}{L}(x - x_0)\right)}$$

**Coeficientes seno:**

$$b_n = \frac{2}{L}\int_{x_0}^{x_0+L} f(x)\sin\!\left(\frac{n\pi}{L}(x - x_0)\right)dx, \qquad n = 1, 2, 3, \ldots$$

### Cálculo por tramos

Al igual que en la serie trigonométrica general:

$$a_n = \sum_{i=1}^{m} \frac{2}{L}\int_{a_i}^{b_i} f_i(x)\cos\!\left(\frac{n\pi}{L}(x-x_0)\right)dx$$

$$b_n = \sum_{i=1}^{m} \frac{2}{L}\int_{a_i}^{b_i} f_i(x)\sin\!\left(\frac{n\pi}{L}(x-x_0)\right)dx$$

### ¿Cuándo usar serie seno vs. coseno?

| Criterio                | Serie Coseno                                | Serie Seno                            |
| ----------------------- | ------------------------------------------- | ------------------------------------- |
| Extensión implícita     | Par: $f(x_0 - \xi) = f(x_0 + \xi)$          | Impar: $f(x_0 - \xi) = -f(x_0 + \xi)$ |
| Condiciones de frontera | Tipo Neumann ($f'(0) = 0$)                  | Tipo Dirichlet ($f(0) = 0$)           |
| Término constante       | $a_0/2 = \overline{f}$ (puede ser $\neq 0$) | Cero siempre (serie parte de cero)    |
| Uso típico              | Temperatura con aislamiento en bordes       | Temperatura nula en los extremos      |

### Comparación de los tres tipos de serie

|                 | Trigonométrica         | Compleja                   | Medio Rango                       |
| --------------- | ---------------------- | -------------------------- | --------------------------------- |
| $\omega_0$      | $2\pi/T$               | $2\pi/T$                   | $\pi/L$                           |
| Índice $n$      | $1, 2, 3, \ldots$      | $\ldots, -1, 0, 1, \ldots$ | $1, 2, 3, \ldots$                 |
| Coeficientes    | $a_0, a_n, b_n$        | $c_n \in \mathbb{C}$       | $a_n$ o $b_n$ (no ambos a la vez) |
| Integración     | Sobre período $[a, b]$ | Sobre período $[a, b]$     | Sobre intervalo $[x_0, x_0+L]$    |
| Factor integral | $2/T$                  | $1/T$                      | $2/L$                             |
| Aplicación      | Función periódica dada | Representación compacta    | Función definida en $[0,L]$       |

---

## I.5 Propiedades de las Series de Fourier

### Parseval — Potencia media

La **igualdad de Parseval** relaciona la energía de $f$ con la energía de sus coeficientes.

**Para la serie trigonométrica:**

$$\frac{1}{T}\int_a^b |f(x)|^2\,dx = \frac{a_0^2}{4} + \frac{1}{2}\sum_{n=1}^{\infty}(a_n^2 + b_n^2)$$

**Para la serie compleja:**

$$\frac{1}{T}\int_a^b |f(x)|^2\,dx = \sum_{n=-\infty}^{+\infty} |c_n|^2$$

**Para la serie coseno de medio rango:**

$$\frac{1}{L}\int_{x_0}^{x_0+L} |f(x)|^2\,dx = \frac{a_0^2}{4} + \frac{1}{2}\sum_{n=1}^{\infty} a_n^2$$

**Para la serie seno de medio rango:**

$$\frac{1}{L}\int_{x_0}^{x_0+L} |f(x)|^2\,dx = \frac{1}{2}\sum_{n=1}^{\infty} b_n^2$$

> **Interpretación física:** el lado izquierdo es la potencia media de $f$.
> Parseval dice que la suma de las potencias de todos los armónicos es igual a la potencia total.

### Linealidad

Si $f$ y $g$ tienen la misma frecuencia fundamental y coeficientes $\{a_n^{(f)}, b_n^{(f)}\}$ y $\{a_n^{(g)}, b_n^{(g)}\}$, entonces $\alpha f + \beta g$ tiene coeficientes $\alpha a_n^{(f)} + \beta a_n^{(g)}$ y $\alpha b_n^{(f)} + \beta b_n^{(g)}$.

### Desplazamiento en tiempo (fase)

Si $f$ tiene coeficientes $a_n, b_n$, entonces $g(x) = f(x - x_0)$ tiene:

$$a_n^{(g)} = a_n \cos(n\omega_0 x_0) + b_n \sin(n\omega_0 x_0)$$
$$b_n^{(g)} = -a_n \sin(n\omega_0 x_0) + b_n \cos(n\omega_0 x_0)$$

O equivalentemente, en forma compleja: $c_n^{(g)} = c_n \cdot e^{-in\omega_0 x_0}$.

### Diferenciación término a término

Si $f$ es continua y $f'$ satisface las condiciones de Dirichlet, entonces la serie de $f'$ se obtiene derivando la serie de $f$ término a término:

$$f'(x) = \sum_{n=1}^{\infty} \Bigl[-a_n n\omega_0 \sin(n\omega_0 x) + b_n n\omega_0 \cos(n\omega_0 x)\Bigr]$$

> **Condición necesaria:** $f$ debe ser continua y periódica. Si tiene discontinuidades,
> la derivación término a término no es válida en los puntos de salto.

### Integración término a término

La integral de $f$ siempre puede calcularse integrando la serie término a término, siempre que $a_0 = 0$ (valor medio nulo) para preservar la periodicidad:

$$\int_0^x f(t)\,dt = \sum_{n=1}^{\infty} \left[\frac{a_n}{n\omega_0}\sin(n\omega_0 x) - \frac{b_n}{n\omega_0}\cos(n\omega_0 x)\right] + \frac{a_0}{2}x + C$$

### Decaimiento de los coeficientes

La velocidad con que $|c_n|, |a_n|, |b_n| \to 0$ al crecer $n$ depende de la regularidad de $f$:

| Regularidad de $f$        | Decaimiento de $          | c_n | $                                   |
| ------------------------- | ------------------------- | --- | ----------------------------------- |
| Solo integrable ($L^1$)   | $                         | c_n | \to 0$ (Riemann-Lebesgue, sin tasa) |
| Discontinuidad de salto   | $                         | c_n | = O(1/n)$                           |
| Continua con $f'$ acotada | $                         | c_n | = O(1/n^2)$                         |
| De clase $C^k$            | $                         | c_n | = O(1/n^{k+1})$                     |
| Analítica                 | Decaimiento exponencial $ | c_n | = O(r^{-n})$ con $r > 1$            |

---

## I.6 Transformada Discreta de Fourier (DFT)

### Motivación

La DFT extiende la idea de las series de Fourier al caso **discreto**: en lugar de una función continua periódica, tenemos una secuencia finita de $N$ muestras $x[0], x[1], \ldots, x[N-1]$.

### Definición (convención de la aplicación)

La aplicación usa la **DFT normalizada** (factor $1/N$ en la transformada directa):

$$\boxed{C[k] = \frac{1}{N}\sum_{n=0}^{N-1} x[n]\, e^{-2\pi i k n / N}}, \qquad k = 0, 1, \ldots, N-1$$

Y la **IDFT** (sin factor $1/N$, ya absorbido por la DFT):

$$\boxed{x[n] = \sum_{k=0}^{N-1} C[k]\, e^{+2\pi i k n / N}}, \qquad n = 0, 1, \ldots, N-1$$

> **Nota sobre convenciones:** existen tres convenciones estándar para el factor de normalización.
> La aplicación usa la convención $1/N$ en la DFT directa (similar a Maxima y MATLAB's `ifft`).
> Otras convenciones: factor $1$ en directa y $1/N$ en inversa (numpy por defecto),
> o factor $1/\sqrt{N}$ en ambas (convención unitaria).

### Comparación de convenciones DFT

| Convención            | $C[k]$ (directa)                        | $x[n]$ (inversa)                        | Factor en directa |
| --------------------- | --------------------------------------- | --------------------------------------- | ----------------- |
| **Esta app (Maxima)** | $(1/N)\sum x[n] e^{-2\pi ikn/N}$        | $\sum C[k] e^{+2\pi ikn/N}$             | $1/N$             |
| NumPy default         | $\sum x[n] e^{-2\pi ikn/N}$             | $(1/N)\sum X[k] e^{+2\pi ikn/N}$        | $1$               |
| Unitaria ($\ell^2$)   | $(1/\sqrt{N})\sum x[n] e^{-2\pi ikn/N}$ | $(1/\sqrt{N})\sum X[k] e^{+2\pi ikn/N}$ | $1/\sqrt{N}$      |

### Frecuencias discretas

Cada índice $k$ corresponde a una **frecuencia discreta**:

$$f_k = \frac{k}{N \cdot \Delta t}, \qquad \omega_k = \frac{2\pi k}{N \cdot \Delta t}$$

donde $\Delta t$ es el intervalo de muestreo (tiempo entre muestras consecutivas).

La frecuencia de Nyquist es $f_N = 1/(2\Delta t)$, y corresponde al índice $k = N/2$.

**Interpretación de los índices:**

| Índice $k$                         | Frecuencia física                | Observación                             |
| ---------------------------------- | -------------------------------- | --------------------------------------- |
| $0$                                | $0$ (continua, DC)               | $C[0] = \overline{x}$ (valor medio)     |
| $1$ to $\lfloor N/2 \rfloor$       | Frecuencias positivas            | Espectro de frecuencias bajas a Nyquist |
| $\lfloor N/2 \rfloor + 1$ to $N-1$ | Frecuencias negativas aliaseadas | Equivalentes a $k - N$                  |

### Amplitud y fase de cada componente

$$|C[k]| = \sqrt{\text{Re}(C[k])^2 + \text{Im}(C[k])^2} \qquad \text{(amplitud)}$$

$$\phi_k = \arctan\!\left(\frac{\text{Im}(C[k])}{\text{Re}(C[k])}\right) = \text{atan2}(\text{Im}(C[k]),\,\text{Re}(C[k])) \qquad \text{(fase)}$$

Si $|C[k]| < \epsilon$ (muy pequeño), la fase se define como $0$ para evitar inestabilidades numéricas.

### Propiedades fundamentales de la DFT

| Propiedad                   | Secuencia                              | DFT                                     |
| --------------------------- | -------------------------------------- | --------------------------------------- |
| **Linealidad**              | $\alpha x[n] + \beta y[n]$             | $\alpha C_x[k] + \beta C_y[k]$          |
| **Desplazamiento circular** | $x[(n-m)\bmod N]$                      | $C[k]\,e^{-2\pi i km/N}$                |
| **Modulación discreta**     | $x[n]\,e^{2\pi i mn/N}$                | $C[(k-m)\bmod N]$                       |
| **Convolución circular**    | $(x \circledast y)[n]$                 | $N\,C_x[k]\,C_y[k]$                     |
| **Conjugado**               | $x^*[n]$                               | $C^*[N-k]$                              |
| **Parseval discreta**       | $\sum_{n=0}^{N-1} \lvert x[n]\rvert^2$ | $N\sum_{k=0}^{N-1} \lvert C[k]\rvert^2$ |

### Reconstrucción y error RMS

La aplicación calcula la reconstrucción de la señal original a partir de los coeficientes $C[k]$ y reporta el **error RMS**:

$$\text{RMS} = \sqrt{\frac{1}{N}\sum_{n=0}^{N-1}\Bigl[(\text{Re}(x_{\text{rec}}[n]) - \text{Re}(x[n]))^2 + (\text{Im}(x_{\text{rec}}[n]) - \text{Im}(x[n]))^2\Bigr]}$$

Un error RMS $\approx 0$ confirma que la DFT es exactamente invertible (sin error de redondeo más allá de la precisión de punto flotante).

### Frecuencias dominantes

La aplicación ordena los $N$ coeficientes por amplitud $|C[k]|$ y muestra los **10 más grandes**. Estas son las componentes frecuenciales que más contribuyen a la señal. En señales periódicas o casi periódicas, la mayoría de la energía se concentra en pocos armónicos.

---

## I.7 FFT — Transformada Rápida de Fourier

### Concepto

La FFT es un **algoritmo eficiente** para calcular la DFT, no una transformada diferente. El resultado es matemáticamente idéntico a la DFT definida en la sección anterior.

El algoritmo clásico **Cooley-Tukey** (1965) explota la estructura recursiva de la DFT:

$$C[k] = \frac{1}{N}\left[\sum_{n \text{ par}} x[n]\,e^{-2\pi i k n/N} + \sum_{n \text{ impar}} x[n]\,e^{-2\pi i k n/N}\right]$$

$$= \frac{1}{N}\left[E[k] + e^{-2\pi i k/N} O[k]\right]$$

donde $E[k]$ y $O[k]$ son DFTs de longitud $N/2$ de las muestras pares e impares respectivamente.

### Complejidad computacional

| Método             | Operaciones     | $N = 1024$              |
| ------------------ | --------------- | ----------------------- |
| DFT directa        | $O(N^2)$        | $\approx 1{,}000{,}000$ |
| FFT (Cooley-Tukey) | $O(N \log_2 N)$ | $\approx 10{,}240$      |
| Ganancia           | $N / \log_2 N$  | $\approx 100\times$     |

La FFT es especialmente eficiente cuando $N$ es **potencia de 2** ($N = 2^m$). Para $N$ arbitrario existen variantes (Bluestein, Rader, chirp-z), aunque son más complejas.

### Implementación en la aplicación

La aplicación carga la biblioteca de Maxima (`load("fft")`), pero utiliza el cálculo manual `manual_coeffs` para garantizar compatibilidad con cualquier $N$, incluyendo los que no son potencia de 2. Para valores grandes de $N$ con potencia de 2, Maxima puede usar internamente el algoritmo FFT.

El código `manual_coeffs` implementa directamente:

```maxima
C[k] = (1/N) * sum(x[n] * exp(-2*pi*i*k*n/N), n, 0, N-1)
```

con aritmética de punto flotante de doble precisión para garantizar velocidad y estabilidad numérica.

### Interpretación espectral de los epiciclos

El modo **epicycles** de la aplicación utiliza la DFT para descomponer una trayectoria en el plano complejo $x[n] = \text{Re}[n] + i\cdot\text{Im}[n]$ como suma de círculos giratorios. Cada componente $C[k]$ corresponde a un epiciclo de:

- **Radio** $= |C[k]|$ (amplitud)
- **Velocidad angular** $= 2\pi k / N$ radianes por paso
- **Fase inicial** $= \phi_k = \arg(C[k])$

La señal reconstruida al sumar todos los epiciclos es exactamente la trayectoria original.

---

# PARTE II — TRANSFORMADA CONTINUA DE FOURIER

---

## Convención

$$F(\omega) = \mathcal{F}\{f(t)\} = \int_{-\infty}^{\infty} f(t)\, e^{-i\omega t}\, dt$$

$$f(t) = \mathcal{F}^{-1}\{F(\omega)\} = \frac{1}{2\pi} \int_{-\infty}^{\infty} F(\omega)\, e^{i\omega t}\, d\omega$$

> **Convención de ingeniería** (usada en la app): factor $1$ en la FT directa, factor $1/(2\pi)$ en la inversa.
> Otras convenciones difieren en la distribución del factor $2\pi$ y en el signo del exponente.

> **Parámetros**: $a, b > 0$ salvo que se indique lo contrario. $k$ es una constante real o compleja. $n \geq 1$ entero.

---

## 1. Propiedades y Reglas

| Propiedad                                     | $f(t)$                                                  | $F(\omega)$                                                                      | Condiciones                       |
| --------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| **Linealidad**                                | $\alpha f(t) + \beta g(t)$                              | $\alpha F(\omega) + \beta G(\omega)$                                             | $\alpha, \beta \in \mathbb{C}$    |
| **Escalar**                                   | $k \cdot f(t)$                                          | $k \cdot F(\omega)$                                                              | $k$ cte.                          |
| **Desplazamiento en tiempo**                  | $f(t - t_0)$                                            | $e^{-i\omega t_0} F(\omega)$                                                     | $t_0 \in \mathbb{R}$              |
| **Desplazamiento en frecuencia** (modulación) | $e^{i\omega_0 t} f(t)$                                  | $F(\omega - \omega_0)$                                                           | $\omega_0 \in \mathbb{R}$         |
| **Desplazamiento en tiempo (IFT)**            | $f(t + t_0)$                                            | $e^{i\omega t_0} F(\omega)$                                                      | $t_0 \in \mathbb{R}$              |
| **Escalado**                                  | $f(at)$                                                 | $\dfrac{1}{\lvert a \rvert} F\!\left(\dfrac{\omega}{a}\right)$                   | $a \neq 0$                        |
| **Conjugado**                                 | $f^*(t)$                                                | $F^*(-\omega)$                                                                   |                                   |
| **Simetría / Dualidad**                       | $F(t)$                                                  | $2\pi f(-\omega)$                                                                |                                   |
| **Diferenciación en tiempo**                  | $f^{(n)}(t)$                                            | $(i\omega)^n F(\omega)$                                                          |                                   |
| **Multiplicación por $t$**                    | $t^n f(t)$                                              | $i^n F^{(n)}(\omega)$                                                            |                                   |
| **Convolución**                               | $(f * g)(t)$                                            | $F(\omega) \cdot G(\omega)$                                                      |                                   |
| **Producto**                                  | $f(t) \cdot g(t)$                                       | $\dfrac{1}{2\pi}(F * G)(\omega)$                                                 |                                   |
| **Modulación por seno (IFT)**                 | $\dfrac{f(t+b) - f(t-b)}{2i}$                           | $\sin(b\omega)\, F(\omega)$                                                      | $b > 0$                           |
| **Modulación por coseno (FT)**                | $\cos(bt)\, f(t)$                                       | $\dfrac{G(\omega-b) + G(\omega+b)}{2}$                                           | $b > 0$,\; $G = \mathcal{F}\{f\}$ |
| **Modulación por seno (FT)**                  | $\sin(bt)\, f(t)$                                       | $\dfrac{G(\omega-b) - G(\omega+b)}{2i}$                                          | $b > 0$,\; $G = \mathcal{F}\{f\}$ |
| **Parseval**                                  | $\displaystyle\int_{\mathbb{R}} \lvert f(t)\rvert^2 dt$ | $\dfrac{1}{2\pi}\displaystyle\int_{\mathbb{R}} \lvert F(\omega)\rvert^2 d\omega$ |                                   |

---

## 2. Pares — Señales Básicas y Distribuciones

| #   | $f(t)$                                    | $F(\omega)=\mathcal{F}\{f(t)\}$                                                                                                   | Observaciones                                 |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | $\delta(t)$                               | $1$                                                                                                                               |                                               |
| 2   | $\delta(t-a)$                             | $e^{-i\omega a}$                                                                                                                  |                                               |
| 3   | $1$                                       | $2\pi\,\delta(\omega)$                                                                                                            |                                               |
| 4   | $c$ (constante)                           | $2\pi c\,\delta(\omega)$                                                                                                          |                                               |
| 5   | $e^{i\omega_0 t}$                         | $2\pi\,\delta(\omega-\omega_0)$                                                                                                   |                                               |
| 6   | $\cos(\omega_0 t)$                        | $\pi\left[\delta(\omega-\omega_0)+\delta(\omega+\omega_0)\right]$                                                                 |                                               |
| 7   | $\sin(\omega_0 t)$                        | $-i\pi\left[\delta(\omega-\omega_0)-\delta(\omega+\omega_0)\right]$                                                               |                                               |
| 8   | $\cos(\omega_0 t+\theta)$                 | $\pi\left[e^{i\theta}\delta(\omega-\omega_0)+e^{-i\theta}\delta(\omega+\omega_0)\right]$                                          |                                               |
| 9   | $\sin(\omega_0 t+\theta)$                 | $-i\pi\left[e^{i\theta}\delta(\omega-\omega_0)-e^{-i\theta}\delta(\omega+\omega_0)\right]$                                        |                                               |
| 10  | $u(t)$                                    | $\pi\,\delta(\omega)+\dfrac{1}{i\omega}$                                                                                          |                                               |
| 11  | $u(t-t_0)$                                | $\left(\pi\,\delta(\omega)+\dfrac{1}{i\omega}\right)e^{-i\omega t_0}$                                                             |                                               |
| 12  | $k\,u(t-t_0)$                             | $k\left(\pi\,\delta(\omega)+\dfrac{e^{-i\omega t_0}}{i\omega}\right)$                                                             |                                               |
| 13  | $\operatorname{sgn}(t)$                   | $\dfrac{2}{i\omega}$                                                                                                              |                                               |
| 13b | $k\,\operatorname{sgn}(t-t_0)$            | $\dfrac{2k\,e^{-i\omega t_0}}{i\omega}$                                                                                           | $k$ cte., $t_0\neq0$                          |
| 14  | $\dfrac{\sin(at)}{\pi t}$                 | $u(\omega+a)-u(\omega-a)$                                                                                                         | rect en frecuencia                            |
| 14b | $k\,u(\omega+a)-k\,u(\omega-a)$           | $\dfrac{k\sin(at)}{\pi t}$                                                                                                        | rect en frecuencia                            |
| 15  | $\dfrac{k}{t}$                            | $-ik\pi\,\operatorname{sgn}(\omega)$                                                                                              | V.P. de Cauchy, $n=1$                         |
| 15b | $\dfrac{k}{ct}$                           | $-\dfrac{ik\pi}{c}\,\operatorname{sgn}(\omega)$                                                                                   | $c\neq0$ cte.; equiv. a #15 con $k\to k/c$    |
| 16  | $\dfrac{k}{t^n}$                          | $\dfrac{k(-i\omega)^{n-1}}{(n-1)!}\left(-i\pi\,\operatorname{sgn}(\omega)\right)$                                                 | V.P., $n\geq1$ entero                         |
| 16g | $\dfrac{k}{(t-a)^n}$                      | $e^{-i\omega a}\dfrac{k(-i\omega)^{n-1}}{(n-1)!}\left(-i\pi\,\operatorname{sgn}(\omega)\right)$                                   | V.P., $a\neq0$, $n\geq1$ entero               |
| 16b | $\sin^2(\omega_0 t)$                      | $\dfrac{\pi}{2}\left[2\delta(\omega)-\delta(\omega-2\omega_0)-\delta(\omega+2\omega_0)\right]$                                    | vía $\cos(2\omega_0 t)=1-2\sin^2(\omega_0 t)$ |
| 16c | $\cos^2(\omega_0 t)$                      | $\dfrac{\pi}{2}\left[\delta(\omega-2\omega_0)+2\delta(\omega)+\delta(\omega+2\omega_0)\right]$                                    | vía $2\cos^2(\omega_0 t)-1=\cos(2\omega_0 t)$ |
| 16d | $\sin^3(\omega_0 t)$                      | $\dfrac{i\pi}{4}\left[3\delta(\omega+\omega_0)-3\delta(\omega-\omega_0)-\delta(\omega+3\omega_0)+\delta(\omega-3\omega_0)\right]$ | reducción trigonométrica                      |
| 16e | $\cos^3(\omega_0 t)$                      | $\dfrac{\pi}{4}\left[3\delta(\omega-\omega_0)+3\delta(\omega+\omega_0)+\delta(\omega-3\omega_0)+\delta(\omega+3\omega_0)\right]$  | reducción trigonométrica                      |
| 16f | $\sin^n(\omega_0 t),\ \cos^n(\omega_0 t)$ | suma de deltas vía reducción trigonométrica                                                                                       | caso general                                  |

---

## 3. Pares — Exponenciales Causales (unilaterales)

| #   | $f(t)$                     | $F(\omega)$                                                                                                              | Condiciones           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 15  | $k\,e^{-at}u(t)$           | $\dfrac{k}{i\omega + a}$                                                                                                 | $a > 0$               |
| 16  | $k\,e^{-at}u(t - t_0)$     | $\dfrac{k\,e^{-at_0}\,e^{-i\omega t_0}}{i\omega + a}$                                                                    | $a > 0,\; t_0 \neq 0$ |
| 17  | $k\,t\,e^{-at}u(t)$        | $\dfrac{k}{(i\omega + a)^2}$                                                                                             | $a > 0$               |
| 18  | $k\,t^2 e^{-at}u(t)$       | $\dfrac{2k}{(i\omega + a)^3}$                                                                                            | $a > 0$               |
| 19  | $k\,t^n e^{-at}u(t)$       | $\dfrac{k\,n!}{(i\omega + a)^{n+1}}$                                                                                     | $a > 0,\; n \geq 1$   |
| 20  | $k\,t^n e^{-at}u(t-t_0)$   | $k\,e^{-at_0}e^{-i\omega t_0}\displaystyle\sum_{j=0}^{n}\binom{n}{j}\frac{t_0^{n-j}\,j!}{(i\omega+a)^{j+1}}$             | $a>0,\;n\geq 1$       |
| 21  | $k\,e^{-at}\cos(bt)\,u(t)$ | $\dfrac{k\,(i\omega + a)}{(i\omega + a)^2 + b^2}$                                                                        | $a, b > 0$            |
| 22  | $k\,e^{-at}\sin(bt)\,u(t)$ | $\dfrac{k\,b}{(i\omega + a)^2 + b^2}$                                                                                    | $a, b > 0$            |
| 23  | $\sin(\omega_0 t)\,u(t)$   | $\dfrac{\omega_0}{\omega_0^2 - \omega^2} + \dfrac{\pi}{2i}\bigl[\delta(\omega-\omega_0) - \delta(\omega+\omega_0)\bigr]$ | $\omega_0 > 0$        |
| 24  | $\cos(\omega_0 t)\,u(t)$   | $\dfrac{i\omega}{\omega_0^2 - \omega^2} + \dfrac{\pi}{2}\bigl[\delta(\omega-\omega_0) + \delta(\omega+\omega_0)\bigr]$   | $\omega_0 > 0$        |

---

## 4. Pares — Funciones de Energía (bilaterales)

| #   | $f(t)$                                      | $F(\omega)$                                                                               | Condiciones                                                                         |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 25  | $e^{-a\lvert t\rvert}$                      | $\dfrac{2a}{a^2 + \omega^2}$                                                              | $a > 0$                                                                             |
| 26  | $\dfrac{1}{a^2 + t^2}$                      | $\dfrac{\pi}{a}\,e^{-a\lvert\omega\rvert}$                                                | $a > 0$                                                                             |
| 27  | $\dfrac{k}{A t^2 + B t + C}$                | $\dfrac{k\pi}{Aa}\,e^{-a\lvert\omega\rvert}\,e^{-i\omega t_0}$                            | $B^2 - 4AC < 0$,<br>$A > 0$,<br>$t_0 = -B/(2A)$,<br>$a = \sqrt{(4AC - B^2)/(4A^2)}$ |
| 27b | $\dfrac{k\,\omega}{\omega_0^2 + \omega^2}$  | $-\dfrac{ik}{2}\,\text{sgn}(t)\,e^{-\omega_0\lvert t\rvert}$                              | $\omega_0 > 0$; bilateral impar                                                     |
| 27c | $\dfrac{k\,i\omega}{\omega_0^2 + \omega^2}$ | $\dfrac{k}{2}\,\text{sgn}(t)\,e^{-\omega_0\lvert t\rvert}$                                | $\omega_0 > 0$                                                                      |
| 28  | $\dfrac{t}{a^2 + t^2}$                      | $-i\pi\,\text{sgn}(\omega)\,e^{-a\lvert\omega\rvert}$                                     | $a > 0$                                                                             |
| 29  | $\dfrac{\cos(bt)}{a^2 + t^2}$               | $\dfrac{\pi}{2a}\bigl[e^{-a\lvert\omega - b\rvert} + e^{-a\lvert\omega + b\rvert}\bigr]$  | $a, b > 0$                                                                          |
| 30  | $\dfrac{\sin(bt)}{a^2 + t^2}$               | $\dfrac{\pi}{2ai}\bigl[e^{-a\lvert\omega - b\rvert} - e^{-a\lvert\omega + b\rvert}\bigr]$ | $a, b > 0$                                                                          |
| 31  | $e^{-t^2/(2\sigma^2)}$ (gaussiana)          | $\sigma\sqrt{2\pi}\,e^{-\sigma^2\omega^2/2}$                                              | $\sigma > 0$                                                                        |
| 32  | $e^{i\omega_0 t}\,g(t)$                     | $G(\omega - \omega_0)$                                                                    | desplazamiento en $\omega$                                                          |

---

## 5. Pares — Transformada Inversa (IFT → tiempo)

Pares adicionales expresados desde el dominio de frecuencia, útiles al aplicar $\mathcal{F}^{-1}$.

| #   | $F(\omega)$                                                          | $f(t) = \mathcal{F}^{-1}\{F(\omega)\}$                                                 | Condiciones                                                                           |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 33  | $1$                                                                  | $\delta(t)$                                                                            |                                                                                       |
| 34  | $\delta(\omega - a)$                                                 | $\dfrac{e^{iat}}{2\pi}$                                                                |                                                                                       |
| 35  | $2\pi\,\delta(\omega - a)$                                           | $e^{iat}$                                                                              |                                                                                       |
| 36  | $e^{-i\omega t_0}$                                                   | $\delta(t - t_0)$                                                                      |                                                                                       |
| 37  | $e^{+i\omega t_0}$                                                   | $\delta(t + t_0)$                                                                      |                                                                                       |
| 38  | $\dfrac{k}{i\omega}$                                                 | $\dfrac{k}{2}\,\text{sgn}(t)$                                                          |                                                                                       |
| 38b | $\dfrac{k\,e^{-i\omega t_0}}{i\omega}$                               | $\dfrac{k}{2}\,\text{sgn}(t - t_0)$                                                    | $t_0 \neq 0$; sgn desplazado                                                          |
| 39  | $\pi\,\delta(\omega) + \dfrac{1}{i\omega}$                           | $u(t)$                                                                                 |                                                                                       |
| 40  | $\dfrac{k}{i\omega + a}$                                             | $k\,e^{-at}u(t)$                                                                       | $a > 0$                                                                               |
| 41  | $\dfrac{k}{(i\omega + a)^2}$                                         | $k\,t\,e^{-at}u(t)$                                                                    | $a > 0$                                                                               |
| 42  | $\dfrac{k}{(i\omega + a)^n}$                                         | $\dfrac{k\,t^{n-1}}{(n-1)!}\,e^{-at}u(t)$                                              | $a > 0,\;n \geq 1$ entero                                                             |
| 43  | $\dfrac{b}{(i\omega+a)^2+b^2}$                                       | $e^{-at}\sin(bt)\,u(t)$                                                                | $a, b > 0$                                                                            |
| 44  | $\dfrac{i\omega+a}{(i\omega+a)^2+b^2}$                               | $e^{-at}\cos(bt)\,u(t)$                                                                | $a, b > 0$                                                                            |
| 45  | $\dfrac{2a}{a^2 + \omega^2}$                                         | $e^{-a\lvert t\rvert}$                                                                 | $a > 0$                                                                               |
| 46  | $\dfrac{k}{a^2 + \omega^2}$                                          | $\dfrac{k}{2a}\,e^{-a\lvert t\rvert}$                                                  | $a > 0$                                                                               |
| 47  | $\dfrac{\pi}{a}\,e^{-a\lvert\omega\rvert}$                           | $\dfrac{1}{a^2 + t^2}$                                                                 | $a > 0$                                                                               |
| 48  | $e^{-a\lvert\omega + \omega_0\rvert}$                                | $\dfrac{a}{\pi}\,\dfrac{e^{-i\omega_0 t}}{a^2 + t^2}$                                  | $a > 0,\;\omega_0 \in \mathbb{R}$                                                     |
| 49  | $\dfrac{k}{\omega(i\omega + a)}$                                     | $\dfrac{ik}{a}\!\left(\dfrac{\text{sgn}(t)}{2} - e^{-at}u(t)\right)$                   | $a > 0$                                                                               |
| 50  | $e^{it_0\omega}\,G(\omega)$                                          | $g(t + t_0)$                                                                           | desplazamiento en $t$                                                                 |
| 51  | $\sin(b\omega)\,F(\omega)$                                           | $\dfrac{f(t+b) - f(t-b)}{2i}$                                                          | $b > 0$                                                                               |
| 52  | $\cos(b\omega)\,F(\omega)$                                           | $\dfrac{f(t+b) + f(t-b)}{2}$                                                           | $b > 0$                                                                               |
| 53  | $\dfrac{k}{A\omega^2 + B\omega + C}$                                 | $\dfrac{k}{2Aa}\,e^{-a\lvert t\rvert}\,e^{i\omega_0 t}$                                | $A > 0$,\; $4AC - B^2 > 0$,<br>$\omega_0 = -B/(2A)$,<br>$a = \sqrt{(4AC-B^2)/(4A^2)}$ |
| 54  | $\dfrac{k\,e^{-i\omega t_0}}{(i\omega+a)^n}$                         | $\dfrac{k\,(t-t_0)^{n-1}}{(n-1)!}\,e^{-a(t-t_0)}\,u(t-t_0)$                            | $a > 0,\;n \geq 1,\;t_0 \in \mathbb{R}$                                               |
| 55  | $\dfrac{k\,\sin\!\bigl(c(\omega-\omega_0)\bigr)}{\omega - \omega_0}$ | $\dfrac{k}{2}\,e^{-i\omega_0 t}\,\bigl(u(t+c)-u(t-c)\bigr)$                            | $c > 0,\;\omega_0 \in \mathbb{R}$                                                     |
| 56  | $\dfrac{P(\omega)}{Q(\omega)}$ (fracción propia)                     | $\displaystyle\sum_i \mathcal{F}^{-1}\!\left\{\frac{r_i}{(i\omega+a_i)^{n_i}}\right\}$ | vía descomposición en fracciones parciales sobre los pares anteriores                 |
| 57  | $\cos(b\,\omega)$                                                    | $\dfrac{\delta(t+b) + \delta(t-b)}{2}$                                                  | $b \in \mathbb{R}$; dual distribucional del par FT $\cos(\omega_0 t) \to \pi[\delta(\omega-\omega_0)+\delta(\omega+\omega_0)]$ |
| 58  | $\sin(b\,\omega)$                                                    | $\dfrac{i}{2}\bigl[\delta(t-b) - \delta(t+b)\bigr]$                                    | $b \in \mathbb{R}$                                                                    |
| 59  | $A\,\cos(b\,\omega + \theta)$                                        | $\dfrac{A}{2}\bigl[e^{i\theta}\,\delta(t+b) + e^{-i\theta}\,\delta(t-b)\bigr]$         | $A, b, \theta \in \mathbb{R}$; generaliza #57                                         |
| 60  | $A\,\sin(b\,\omega + \theta)$                                        | $\dfrac{A}{2i}\bigl[e^{i\theta}\,\delta(t+b) - e^{-i\theta}\,\delta(t-b)\bigr]$        | $A, b, \theta \in \mathbb{R}$; generaliza #58                                         |

---

## 6. Resumen de Meta-operadores

Estos operadores se aplican **por encima** de cualquier par de la tabla, permitiendo construir transformadas compuestas.

| Operador                              | Dominio tiempo              | Dominio frecuencia                    |
| ------------------------------------- | --------------------------- | ------------------------------------- |
| Escalar                               | $k\,f(t)$                   | $k\,F(\omega)$                        |
| Linealidad                            | $\sum_i c_i f_i(t)$         | $\sum_i c_i F_i(\omega)$              |
| **Desplazamiento en tiempo**          | $f(t - t_0)$                | $e^{-i\omega t_0}F(\omega)$           |
| **Desplazamiento en frecuencia (FT)** | $e^{i\omega_0 t}g(t)$       | $G(\omega - \omega_0)$                |
| **Desplazamiento en tiempo (IFT)**    | $g(t + t_0)$                | $e^{it_0\omega}G(\omega)$             |
| **Modulación por seno (IFT)**         | $\dfrac{f(t+b)-f(t-b)}{2i}$ | $\sin(b\omega)\,F(\omega)$            |
| **Modulación por coseno (IFT)**       | $\dfrac{f(t+b)+f(t-b)}{2}$  | $\cos(b\omega)\,F(\omega)$            |
| **Modulación por coseno (FT)**        | $\cos(bt)\,f(t)$            | $\dfrac{G(\omega-b)+G(\omega+b)}{2}$  |
| **Modulación por seno (FT)**          | $\sin(bt)\,f(t)$            | $\dfrac{G(\omega-b)-G(\omega+b)}{2i}$ |

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

| $n$ | $f(t)$  | $F(\omega)$                                    |
| --- | ------- | ---------------------------------------------- |
| 1   | $k/t$   | $-ik\pi\,\text{sgn}(\omega)$                   |
| 2   | $k/t^2$ | $-k\pi\omega\,\text{sgn}(\omega)$              |
| 3   | $k/t^3$ | $\dfrac{ik\pi\omega^2}{2}\,\text{sgn}(\omega)$ |

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

$$
\frac{P(\omega)}{Q(\omega)} = \sum_{i}\sum_{j=1}^{n_i} \frac{r_{ij}}{(i\omega - p_i)^j}
\quad\xrightarrow{\mathcal{F}^{-1}}\quad
\sum_{i}\sum_{j=1}^{n_i} \frac{r_{ij}\,t^{j-1}}{(j-1)!}\,e^{p_i t}\,u(t)
$$

Implementado como último recurso en `IFT_pattern_lookup`: aplica `partfrac(F, ω)` y si el resultado es una suma, delega cada término al resto del lookup via linealidad.

**Ejemplos cubiertos automáticamente:**

| $F(\omega)$                                 | Descomposición                                                           | $f(t)$                                |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| $\dfrac{1}{(i\omega+1)(i\omega+2)}$         | $\dfrac{1}{i\omega+1} - \dfrac{1}{i\omega+2}$                            | $(e^{-t} - e^{-2t})\,u(t)$            |
| $\dfrac{i\omega+3}{(i\omega+1)(i\omega+2)}$ | $\dfrac{2}{i\omega+1} - \dfrac{1}{i\omega+2}$                            | $(2e^{-t} - e^{-2t})\,u(t)$           |
| $\dfrac{i\omega}{(i\omega+1)^2}$            | $\dfrac{1}{i\omega+1} - \dfrac{1}{(i\omega+1)^2}$                        | $(1-t)\,e^{-t}\,u(t)$                 |
| $\dfrac{1}{(i\omega+1)^2(i\omega+2)}$       | $\dfrac{1}{i\omega+1} - \dfrac{1}{(i\omega+1)^2} + \dfrac{1}{i\omega+2}$ | $(1-t)\,e^{-t}\,u(t) + e^{-2t}\,u(t)$ |

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

| $F(\omega)$                                | $\omega_0$ | $G(\omega) = F(\omega+\omega_0)$   | $f(t) = e^{i\omega_0 t}\,g(t)$ |
| ------------------------------------------ | ---------- | ---------------------------------- | ------------------------------ |
| $\dfrac{1}{i(\omega-3)+5}$                 | $3$        | $\dfrac{1}{i\omega+5}$             | $e^{3it}\,e^{-5t}\,u(t)$       |
| $\dfrac{e^{-2i(\omega-3)}}{i(\omega-3)+5}$ | $3$        | $\dfrac{e^{-2i\omega}}{i\omega+5}$ | $e^{3it}\,e^{-5(t-2)}\,u(t-2)$ |
| $\dfrac{1}{(i(\omega-2)+3)^2}$             | $2$        | $\dfrac{1}{(i\omega+3)^2}$         | $e^{2it}\,t\,e^{-3t}\,u(t)$    |
| $\dfrac{2\sin(\omega-1)}{\omega-1}$        | $1$        | $\dfrac{2\sin\omega}{\omega}$      | $e^{it}(u(t+1)-u(t-1))$        |

---

## 18. Polo de orden fraccionario $k/\sqrt{i\omega+a}$ — par #57

$$\mathcal{F}^{-1}\!\left\{\frac{k}{\sqrt{i\omega+a}}\right\} = \frac{k\,e^{-at}}{\sqrt{\pi\,t}}\,u(t), \qquad a > 0$$

Aparece en sistemas con dinámica de difusión o respuestas de "medio orden". El handler detecta `sqrt(iw+a)` en el denominador (incluyendo escalares reales absorbidos) y combina con el desplazamiento en tiempo para el caso `e^{-iωt₀}/sqrt(iw+a)`.

| $F(\omega)$                              | $f(t)$                                        |
| ---------------------------------------- | --------------------------------------------- |
| $\dfrac{1}{\sqrt{i\omega+1}}$            | $\dfrac{e^{-t}}{\sqrt{\pi t}}\,u(t)$          |
| $\dfrac{5}{\sqrt{i\omega+2}}$            | $\dfrac{5\,e^{-2t}}{\sqrt{\pi t}}\,u(t)$      |
| $\dfrac{1}{\sqrt{2(i\omega+1)}}$         | $\dfrac{e^{-t}}{\sqrt{2\pi t}}\,u(t)$         |
| $\dfrac{e^{-i\omega}}{\sqrt{i\omega+1}}$ | $\dfrac{e^{-(t-1)}}{\sqrt{\pi(t-1)}}\,u(t-1)$ |

> **Nota**: `1/sqrt(w)` bilateral no está soportado — diverge en $\omega=0$ y solo tiene sentido como distribución unilateral ($\omega>0$).

---

## 19. Potencias de seno y coseno — pares #16b–16f

Para $\sin^n(\omega_0 t)$ y $\cos^n(\omega_0 t)$ se aplica **reducción trigonométrica** (`trigreduce`) que expresa la potencia como suma de senos/cosenos de múltiplos, y luego cada término usa los pares #6–9.

**Casos explícitos** ($\omega_0 = 1$ para brevedad):

| $f(t)$      | Reducción                     | $F(\omega)$                                                                              |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| $\sin^2(t)$ | $\frac{1-\cos(2t)}{2}$        | $\pi\delta(\omega) - \frac{\pi}{2}[\delta(\omega-2)+\delta(\omega+2)]$                   |
| $\cos^2(t)$ | $\frac{1+\cos(2t)}{2}$        | $\pi\delta(\omega) + \frac{\pi}{2}[\delta(\omega-2)+\delta(\omega+2)]$                   |
| $\sin^3(t)$ | $\frac{3\sin(t)-\sin(3t)}{4}$ | $\frac{i\pi}{4}[-3\delta(\omega-1)+3\delta(\omega+1)+\delta(\omega-3)-\delta(\omega+3)]$ |
| $\cos^3(t)$ | $\frac{3\cos(t)+\cos(3t)}{4}$ | $\frac{\pi}{4}[3\delta(\omega-1)+3\delta(\omega+1)+\delta(\omega-3)+\delta(\omega+3)]$   |

El handler activa `trigreduce` cuando detecta `sin(...)^n` o `cos(...)^n` con $n \geq 2$ entero, y solo acepta el resultado si **desaparece el exponente** (guard contra falsos positivos).

### Fórmula general explícita — reducción de potencias

Las identidades de reducción que aplica `trigreduce` internamente son:

**Para $\sin^n(\omega_0 t)$:**

$$\sin^n(\omega_0 t) = \begin{cases} \dfrac{1}{2^n}\dbinom{n}{n/2} + \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{n/2-1}(-1)^{n/2-k}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ par} \\[10pt] \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{(n-1)/2}(-1)^{(n-1)/2-k}\dbinom{n}{k}\sin\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ impar} \end{cases}$$

**Para $\cos^n(\omega_0 t)$:**

$$\cos^n(\omega_0 t) = \begin{cases} \dfrac{1}{2^n}\dbinom{n}{n/2} + \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{n/2-1}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ par} \\[10pt] \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{(n-1)/2}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ impar} \end{cases}$$

### Transformada general resultante

Aplicando $\mathcal{F}\{\cos(m\omega_0 t)\} = \pi[\delta(\omega-m\omega_0)+\delta(\omega+m\omega_0)]$ y $\mathcal{F}\{\sin(m\omega_0 t)\} = -i\pi[\delta(\omega-m\omega_0)-\delta(\omega+m\omega_0)]$ a cada término:

**$\mathcal{F}\{\sin^n(\omega_0 t)\}$, $n$ par:**

$$F(\omega) = \frac{\pi}{2^{n-1}}\dbinom{n}{n/2}\delta(\omega) + \frac{\pi}{2^{n-1}}\sum_{k=0}^{n/2-1}(-1)^{n/2-k+1}\dbinom{n}{k}\bigl[\delta(\omega-(n-2k)\omega_0)+\delta(\omega+(n-2k)\omega_0)\bigr]$$

**$\mathcal{F}\{\sin^n(\omega_0 t)\}$, $n$ impar:**

$$F(\omega) = \frac{-i\pi}{2^{n-1}}\sum_{k=0}^{(n-1)/2}(-1)^{(n-1)/2-k}\dbinom{n}{k}\bigl[\delta(\omega-(n-2k)\omega_0)-\delta(\omega+(n-2k)\omega_0)\bigr]$$

**$\mathcal{F}\{\cos^n(\omega_0 t)\}$, $n$ par:**

$$F(\omega) = \frac{\pi}{2^{n-1}}\dbinom{n}{n/2}\delta(\omega) + \frac{\pi}{2^{n-1}}\sum_{k=0}^{n/2-1}\dbinom{n}{k}\bigl[\delta(\omega-(n-2k)\omega_0)+\delta(\omega+(n-2k)\omega_0)\bigr]$$

**$\mathcal{F}\{\cos^n(\omega_0 t)\}$, $n$ impar:**

$$F(\omega) = \frac{\pi}{2^{n-1}}\sum_{k=0}^{(n-1)/2}\dbinom{n}{k}\bigl[\delta(\omega-(n-2k)\omega_0)+\delta(\omega+(n-2k)\omega_0)\bigr]$$

> **Patrón de paridad:** $\sin^n$ con $n$ par produce solo cosenos (parte par de la señal, espectro real con deltas simétricas más el término DC). $\sin^n$ con $n$ impar produce solo senos (parte impar, espectro puramente imaginario sin término DC). $\cos^n$ siempre produce solo cosenos (señal par → espectro real).

**Verificación con los casos explícitos** ($\omega_0 = 1$):

| $f(t)$ | $n$ | Paridad | Término DC $\pi\binom{n}{n/2}/2^{n-1}$ | Armónicos |
|---|---|---|---|---|
| $\sin^2(t)$ | 2, par | — | $\pi\binom{2}{1}/2 = \pi$ | $k=0$: $(-1)^1\binom{2}{0}= -1$ → $-\pi[\delta(\omega-2)+\delta(\omega+2)]/2$ |
| $\cos^2(t)$ | 2, par | — | $\pi$ | $k=0$: $+\binom{2}{0}=1$ → $+\pi[\delta(\omega-2)+\delta(\omega+2)]/2$ |
| $\sin^3(t)$ | 3, impar | — | sin DC | $k=0,1$: coef $(-1)^1\binom{3}{0}=-1$, $(-1)^0\binom{3}{1}=3$ |
| $\cos^3(t)$ | 3, impar | — | sin DC | $k=0,1$: coef $\binom{3}{0}=1$, $\binom{3}{1}=3$ |---

## 20. Función bilateral impar: $k\omega / (a^2 + \omega^2)$ — pares #27b–27c

$$\mathcal{F}^{-1}\!\left\{\frac{k\,\omega}{a^2 + \omega^2}\right\} = -\frac{ik}{2}\,\text{sgn}(t)\,e^{-a|t|}, \qquad a > 0$$

$$\mathcal{F}^{-1}\!\left\{\frac{k\,i\omega}{a^2 + \omega^2}\right\} = \frac{k}{2}\,\text{sgn}(t)\,e^{-a|t|}, \qquad a > 0$$

Derivados del par #25 via diferenciación en frecuencia: si $\mathcal{F}\{e^{-a|t|}\} = \frac{2a}{a^2+\omega^2}$, entonces $\mathcal{F}\{-it\,e^{-a|t|}\} = \frac{d}{d\omega}\frac{2a}{a^2+\omega^2} = \frac{-4a\omega}{(a^2+\omega^2)^2}$. La forma bilateral de $\omega/(a^2+\omega^2)$ sigue directamente de la distribución de sgn·exponencial.

El detector clasifica el numerador: si contiene $\omega$ real → resultado lleva $-i/2$; si contiene $i\omega$ → resultado lleva $+1/2$.

**Ejemplos:**

| $F(\omega)$                   | $f(t)$                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| $\dfrac{\omega}{\omega^2+4}$  | $\dfrac{i}{2}\,\operatorname{sgn}(t)\,e^{-2\lvert t\rvert}$  |
| $\dfrac{3\omega}{\omega^2+9}$ | $\dfrac{3i}{2}\,\operatorname{sgn}(t)\,e^{-3\lvert t\rvert}$ |
| $\dfrac{i\omega}{\omega^2+4}$ | $-\dfrac{1}{2}\,\operatorname{sgn}(t)\,e^{-2\lvert t\rvert}$ |

---

## 21. sgn desplazado — pares #13b y #38b

$$\mathcal{F}\{k\,\text{sgn}(t-t_0)\} = \frac{2k\,e^{-i\omega t_0}}{i\omega}, \qquad t_0 \neq 0$$

$$\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-i\omega t_0}}{i\omega}\right\} = \frac{k}{2}\,\text{sgn}(t - t_0)$$

Se deriva de $\text{sgn}(t-t_0) = 2u(t-t_0) - 1$, cuya transformada es $2(\pi\delta(\omega) + e^{-i\omega t_0}/(i\omega)) - 2\pi\delta(\omega) = 2e^{-i\omega t_0}/(i\omega)$. El detector en `FT_pattern_lookup` extrae el desplazamiento $t_0$ del argumento de sgn directamente; el detector IFT multiplica la expresión por $i\omega$ y factoriza el exponencial resultante.

**Ejemplos:**

| Dirección | $f(t)$ / $F(\omega)$          | Resultado                       |
| --------- | ----------------------------- | ------------------------------- |
| FT        | $\text{sgn}(t-2)$             | $-2i\,e^{-2i\omega}/\omega$     |
| FT        | $3\,\text{sgn}(t-a)$          | $-6i\,e^{-ia\omega}/\omega$     |
| FT        | $5\,\text{sgn}(t-a)/b$        | $-10i\,e^{-ia\omega}/(b\omega)$ |
| IFT       | $2\,e^{-2i\omega}/(i\omega)$  | $\text{sgn}(t-2)$               |
| IFT       | $k\,e^{-ia\omega}/(i\omega)$  | $\frac{k}{2}\,\text{sgn}(t-a)$  |
| IFT       | $6\,e^{-ia\omega}/(ib\omega)$ | $3\,\text{sgn}(t-a)/b$          |

---

## 22. FT distribucional desplazada $k/(t-a)^n$ — pares #15b y #16g

$$\mathcal{F}\!\left\{\frac{k}{(t-a)^n}\right\} \stackrel{\text{V.P.}}{=} e^{-i\omega a}\,\frac{k\,(-i\omega)^{n-1}}{(n-1)!}\cdot(-i\pi\,\text{sgn}(\omega)), \qquad a \neq 0,\; n \geq 1 \text{ entero}$$

**Derivación**: por la propiedad de desplazamiento en tiempo, $\mathcal{F}\{f(t-a)\} = e^{-i\omega a}\,F(\omega)$, aplicada al par distribucional base:

$$\mathcal{F}\!\left\{\frac{1}{t^n}\right\} = \frac{(-i\omega)^{n-1}}{(n-1)!}\cdot(-i\pi\,\text{sgn}(\omega))$$

Combinando:

$$\frac{1}{(t-a)^n} = \left.\frac{1}{t^n}\right|_{t \to t-a} \quad\Rightarrow\quad \mathcal{F}\!\left\{\frac{1}{(t-a)^n}\right\} = e^{-i\omega a}\cdot\frac{(-i\omega)^{n-1}}{(n-1)!}\cdot(-i\pi\,\text{sgn}(\omega))$$

**Casos explícitos** ($k=1$):

| $n$ | $f(t)$      | $F(\omega)$                                                   |
| --- | ----------- | ------------------------------------------------------------- |
| 1   | $1/(t-a)$   | $-i\pi\,e^{-i\omega a}\,\text{sgn}(\omega)$                   |
| 2   | $1/(t-a)^2$ | $-\pi\omega\,e^{-i\omega a}\,\text{sgn}(\omega)$              |
| 3   | $1/(t-a)^3$ | $\dfrac{i\pi\omega^2}{2}\,e^{-i\omega a}\,\text{sgn}(\omega)$ |

**Par #15b — escalar en el denominador:** $k/(c\,t)$ es equivalente a $k/c \cdot 1/t$, cuyo resultado es simplemente el par #15 con $k \to k/c$:

$$\mathcal{F}\!\left\{\frac{k}{c\,t}\right\} = -\frac{ik\pi}{c}\,\text{sgn}(\omega)$$

**Implementación**: el detector extrae el coeficiente constante $c$ del denominador producto $c \cdot t^n$, y el bloque de tiempo desplazado aplica `factor()` sobre el denominador expandido (ya que `expand(1/(t-a)^n)` produce un polinomio en $t$) para recuperar la forma compacta $(t-a)^n$ antes de aplicar el patrón.

---

## 23. Familia anti-causal — señales con soporte $t < 0$

Las señales **anti-causales** son no nulas solo para $t < 0$. Sus polos de FT están en el **semiplano inferior** del plano $\omega$ complejo (parte imaginaria de $\omega$ negativa), a diferencia de las causales cuyos polos están en el semiplano superior.

### 23.1 Pares FT directos anti-causales

| #  | $f(t)$                                 | $F(\omega)$                                                         | Condiciones        |
|----|----------------------------------------|---------------------------------------------------------------------|--------------------|
| AC-1 | $k\,e^{at}\,u(-t)$                  | $\dfrac{k}{a - i\omega}$                                            | $a > 0$            |
| AC-2 | $k\,e^{at}\cos(bt)\,u(-t)$          | $\dfrac{k\,(a-i\omega)}{(a-i\omega)^2 + b^2}$                       | $a, b > 0$         |
| AC-3 | $k\,e^{at}\sin(bt)\,u(-t)$          | $\dfrac{-k\,b}{(a-i\omega)^2 + b^2}$                                | $a, b > 0$         |

> **Comparación con causales**: el causal $k\,e^{-at}u(t)$ tiene polo en $i\omega = -a$ (semiplano superior). El anti-causal $k\,e^{at}u(-t)$ tiene polo en $i\omega = a$ (semiplano inferior), expresado como $a - i\omega$ en el denominador. El signo del exponente **y** de la puerta $u(\cdot)$ cambian simultáneamente.

**Derivación de AC-1:**

$$\mathcal{F}\{e^{at}u(-t)\} = \int_{-\infty}^{0} e^{at}\,e^{-i\omega t}\,dt = \int_{-\infty}^{0} e^{(a-i\omega)t}\,dt = \frac{1}{a-i\omega} \qquad (\text{Re}(a-i\omega) = a > 0)$$

**Derivación de AC-2 y AC-3** por modulación: $e^{at}\cos(bt)\,u(-t) = \frac{1}{2}\bigl[e^{(a+ib)t}+e^{(a-ib)t}\bigr]u(-t)$, aplicando AC-1 con $a \to a \pm ib$ y combinando.

### 23.2 Pares IFT inversa anti-causales

| #  | $F(\omega)$                                       | $f(t) = \mathcal{F}^{-1}\{F(\omega)\}$                                             | Condiciones        |
|----|---------------------------------------------------|------------------------------------------------------------------------------------|--------------------|
| AC-4 | $\dfrac{k}{a-i\omega}$                         | $k\,e^{at}\,u(-t)$                                                                 | $a > 0$            |
| AC-5 | $\dfrac{k}{(a-i\omega)^n}$                     | $\dfrac{(-1)^{n-1}\,k\,t^{n-1}}{(n-1)!}\,e^{at}\,u(-t)$                           | $a > 0$, $n \geq 1$ entero |
| AC-6 | $\dfrac{-b}{(a-i\omega)^2+b^2}$                | $e^{at}\sin(bt)\,u(-t)$                                                             | $a, b > 0$         |
| AC-7 | $\dfrac{a-i\omega}{(a-i\omega)^2+b^2}$          | $e^{at}\cos(bt)\,u(-t)$                                                             | $a, b > 0$         |
| AC-8 | $\dfrac{k}{(a-i\omega)^2+b^2}$                 | $\dfrac{-k}{b}\,e^{at}\sin(bt)\,u(-t)$                                              | $a, b > 0$         |

> **Signo en AC-5**: el factor $(-1)^{n-1}$ distingue la familia anti-causal de la causal.
> Para $n=1$: $(-1)^0 = 1$, recuperando AC-4.  Para $n=2$: $(-1)^1 = -1$, el resultado lleva signo negativo.

**Derivación de AC-5** via contorno de integración cerrado por el semiplano inferior:

$$\frac{k}{(a-i\omega)^n} = \frac{k\,(-1)^n}{(i\omega-a)^n}$$

Residuos en el polo $\omega = -ia$ (semiplano inferior $\text{Im}(\omega) < 0$), integración en sentido horario para $t < 0$:

$$f(t) = (-1)^{n-1}\,k\,\frac{t^{n-1}}{(n-1)!}\,e^{at}\,u(-t)$$

**Nota sobre representación en Maxima:** `rat(1/(a-iw))` produce `-(1/(iw-a))` con `op="-"` en lugar de `op="/"`. Los handlers IFT anti-causales usan `expand(F_expr)` directamente — sin `rat` — para evitar este cambio de signo que rompe el reconocimiento de patrones.

---

## 24. Pares trigonométricos/hiperbólicos — señales de energía con cocientes trig/hip

### 24.1 Seno sobre senh

$$\boxed{\mathcal{F}\!\left\{\frac{k\,\sin(at)}{\sinh(bt)}\right\} = \frac{k\pi}{2b}\left[\tanh\!\left(\frac{\pi(a-\omega)}{2b}\right) + \tanh\!\left(\frac{\pi(a+\omega)}{2b}\right)\right]}, \quad a,b > 0$$

**Forma alternativa** (identidad de semi-ángulo $\tanh(x) = \sinh(2x)/(\cosh(2x)+1)$):

$$= \frac{k\pi}{2b}\left[\frac{\sinh\!\left(\tfrac{\pi(a-\omega)}{b}\right)}{\cosh\!\left(\tfrac{\pi(a-\omega)}{b}\right)+1} + \frac{\sinh\!\left(\tfrac{\pi(a+\omega)}{b}\right)}{\cosh\!\left(\tfrac{\pi(a+\omega)}{b}\right)+1}\right]$$

**Derivación** via el kernel de Ramanujan / función de Plancherel:

$$K(\lambda) = \int_{-\infty}^{\infty} \frac{e^{i\lambda t}}{\sinh(\pi t)}\,dt = i\,\tanh\!\left(\frac{\lambda}{2}\right)$$

Aplicando al caso escalado ($\sinh(bt)$, sustitución $t \to t/b$) y usando $\sin(at) = \operatorname{Im}(e^{iat})$:

$$\int_{-\infty}^{\infty} \frac{\sin(at)\,e^{-i\omega t}}{\sinh(bt)}\,dt = \frac{1}{b}\cdot\frac{1}{2i}\bigl[K\bigl(\tfrac{\pi(a-\omega)}{b}\bigr) - K\bigl(-\tfrac{\pi(a+\omega)}{b}\bigr)\bigr]$$

Sustituyendo $K$ y simplificando con $\tanh(-x) = -\tanh(x)$ se obtiene la fórmula de la caja.

**Propiedades:**
- La señal tiene energía finita ($\sin(at)/\sinh(bt) \in L^2$) para todo $a,b>0$
- Para $a = b$: $\sin(t)/\sinh(t)$ tiene transformada $(\pi/2)[\tanh(\pi(1-\omega)/2)+\tanh(\pi(1+\omega)/2)]$, que es una función sigmoide doble centrada en $\omega = \pm 1$

### 24.2 Coseno sobre cosh

$$\boxed{\mathcal{F}\!\left\{\frac{k\,\cos(at)}{\cosh(bt)}\right\} = \frac{k\pi}{2b}\left[\operatorname{sech}\!\left(\frac{\pi(\omega-a)}{2b}\right) + \operatorname{sech}\!\left(\frac{\pi(\omega+a)}{2b}\right)\right]}, \quad a \geq 0,\; b > 0$$

Equivalentemente (en términos de $1/\cosh$, forma usada internamente para evaluación numérica):

$$= \frac{k\pi}{2b}\left[\frac{1}{\cosh\!\left(\tfrac{\pi(\omega-a)}{2b}\right)} + \frac{1}{\cosh\!\left(\tfrac{\pi(\omega+a)}{2b}\right)}\right]$$

**Derivación** via el kernel simétrico:

$$K_{\text{par}}(\lambda) = \int_{-\infty}^{\infty} \frac{e^{i\lambda t}}{\cosh(\pi t)}\,dt = \frac{1}{\cosh(\lambda/2)}$$

Escalando ($\cosh(bt)$, sustitución $t \to t/b$) y usando $\cos(at) = \operatorname{Re}(e^{iat})$:

$$\int_{-\infty}^{\infty} \frac{\cos(at)\,e^{-i\omega t}}{\cosh(bt)}\,dt = \frac{1}{b}\cdot\frac{1}{2}\bigl[K_{\text{par}}\bigl(\tfrac{\pi(a-\omega)}{b}\bigr) + K_{\text{par}}\bigl(\tfrac{\pi(a+\omega)}{b}\bigr)\bigr]$$

**Propiedades:**
- Para $a=0$: $\mathcal{F}\{k/\cosh(bt)\} = (k\pi/b)\,\text{sech}(\pi\omega/(2b))$ (sech en frecuencia)
- La transformada es real y no negativa para $\omega$ real (señal par y positiva definida)
- Caso simétrico: $\cos(t)/\cosh(t) \to (\pi/2)[\text{sech}(\pi(\omega-1)/2)+\text{sech}(\pi(\omega+1)/2)]$

### 24.3 Tabla resumen

| #  | $f(t)$                             | $F(\omega)$ (forma canónica)                                                                                         | Condiciones        |
|----|------------------------------------|----------------------------------------------------------------------------------------------------------------------|--------------------|
| TH-1 | $k\,\dfrac{\sin(at)}{\sinh(bt)}$ | $\dfrac{k\pi}{2b}\!\left[\tanh\!\left(\dfrac{\pi(a-\omega)}{2b}\right)+\tanh\!\left(\dfrac{\pi(a+\omega)}{2b}\right)\right]$ | $a,b > 0$ |
| TH-2 | $k\,\dfrac{\cos(at)}{\cosh(bt)}$ | $\dfrac{k\pi}{2b}\!\left[\operatorname{sech}\!\left(\dfrac{\pi(\omega-a)}{2b}\right)+\operatorname{sech}\!\left(\dfrac{\pi(\omega+a)}{2b}\right)\right]$ | $a \geq 0$, $b > 0$ |
| TH-3 | $k\,\operatorname{sech}(bt)$ | $\dfrac{k\pi}{b}\,\operatorname{sech}\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b > 0$; caso $a=0$ de TH-2 |

> **TH-3 es el caso especial $a = 0$ de TH-2** y tiene su propio handler directo. La fórmula $1/\cosh(bt)$ produce $(\pi/b)\,\text{sech}(\pi\omega/(2b))$. La inversa también está implementada: $\mathcal{F}^{-1}\{k/\cosh(p\omega)\}(t) = (kb/\pi)\,\text{sech}(bt)$ con $b = \pi/(2p)$.

---

## 24b. Otras transformadas hiperbólicas

Las siguientes funciones tienen transformadas de Fourier cerradas. Se indica el estado de implementación en el motor para cada una.

### 24b.1 $k/\sinh(bt)$ — transformada con tanh

$$\boxed{\mathcal{F}\!\left\{\frac{k}{\sinh(bt)}\right\}(\omega) = \frac{-ik\pi\,\tanh\!\left(\dfrac{\pi\omega}{2b}\right)}{|b|}}, \qquad b \in \mathbb{R},\; b \neq 0$$

(Fuente: Wolfram Alpha. Convención: factor oscilatorio $-1$.)

> **✓ Implementado** (FT + IFT). La fórmula se obtiene del kernel de Ramanujan $K(\lambda) = \int e^{i\lambda t}/\sinh(\pi t)\,dt = i\tanh(\lambda/2)$ escalado a $\sinh(bt)$ vía $t \to t/b$. La inversa: $\mathcal{F}^{-1}\!\left\{k\,\tanh(p\omega)\right\}(t) = \tfrac{ik|b|}{\pi\sinh(bt)}$ con $b = \pi/(2p)$.

### 24b.2 $k\,\tanh(bt)$ — transformada con csch

$$\boxed{\mathcal{F}\!\left\{k\,\tanh(bt)\right\}(\omega) = \frac{-ik\pi\,\operatorname{csch}\!\left(\dfrac{\pi\omega}{2b}\right)}{|b|}}, \qquad b \in \mathbb{R},\; b \neq 0$$

(Fuente: Wolfram Alpha. Convención: factor oscilatorio $-1$.)

> **✓ Implementado** (FT + IFT). $\tanh(bt)$ no es $L^1$ ni $L^2$ — la fórmula existe como transformada de distribución temperada. La inversa: $\mathcal{F}^{-1}\!\left\{k/\sinh(p\omega)\right\}(t) = \tfrac{ik|b|}{\pi}\tanh(bt)$ con $b = \pi/(2p)$.

### 24b.3 $k\,\operatorname{csch}^2(bt)$ — cuadrado de la cosecante hiperbólica

Para el caso canónico $b=1$, $k=1$:

$$\boxed{\mathcal{F}\!\left\{\operatorname{csch}^2(t)\right\}(\omega) = -2\pi\,\omega\,\coth\!\left(\frac{\pi\omega}{2}\right)}$$

Forma general escalada:

$$\mathcal{F}\!\left\{k\,\operatorname{csch}^2(bt)\right\}(\omega) = \frac{-2k\pi\omega}{b^2}\coth\!\left(\frac{\pi\omega}{2b}\right), \qquad b > 0$$

(Fuente: Wolfram Alpha.)

> **✓ Implementado** (FT + IFT). La inversa: $\mathcal{F}^{-1}\!\left\{k\,\omega/\sinh(p\omega)\right\}(t) = \tfrac{kb^2}{\pi}\operatorname{sech}^2(bt)$ con $b = \pi/(2p)$.

### 24b.4 $k\,\operatorname{sech}^2(bt)$ — cuadrado de la secante hiperbólica

$$\boxed{\mathcal{F}\!\left\{k\,\operatorname{sech}^2(bt)\right\}(\omega) = \frac{k\pi\omega}{b^2}\operatorname{csch}\!\left(\frac{\pi\omega}{2b}\right)}, \qquad b > 0$$

Equivalentemente $= \dfrac{k\pi\omega}{b^2\,\sinh(\pi\omega/(2b))}$.

**Derivación** via diferenciación en tiempo: $\operatorname{sech}^2(bt) = -\tfrac{1}{b}\tfrac{d}{dt}\tanh(bt)$, luego propiedad de derivada $\mathcal{F}\{f'\} = i\omega F(\omega)$ sobre TH-3.

Para $\omega = 0$: $F(0) = 2k/b$ (L'Hôpital sobre $\omega/\sinh(\pi\omega/(2b))$).

> **✓ Implementado** (FT + IFT). La inversa: $\mathcal{F}^{-1}\!\left\{k\,\omega\coth(p\omega)\right\}(t) = \tfrac{-kb^2}{2\pi}\operatorname{csch}^2(bt)$ con $b = \pi/(2p)$.

### 24b.5 Familias avanzadas: $\operatorname{sech}^{2n+1}$, $\tanh^{2m}\operatorname{sech}^{2n+1}$, $\tanh\operatorname{sech}$

#### Familia par (potencias impares de sech, potencias pares de tanh) — ✓ Implementada general

La recurrencia fundamental (derivada vía propiedad de derivada en tiempo):

$$P_0(u) = 1, \qquad P_{n+1}(u) = \frac{u^2 + (2n+1)^2}{(2n+1)(2n+2)}\,P_n(u)$$

$$\boxed{\mathcal{F}\!\left\{k\operatorname{sech}^{2n+1}(bt)\right\}(\omega) = \frac{k\pi}{b}\,\frac{P_n(u)}{\cosh(u)},\qquad u = \frac{\pi\omega}{2b}}$$

Para $\tanh^{2m}(bt)\operatorname{sech}^{2n+1}(bt)$, se usa $\tanh^2 = 1 - \operatorname{sech}^2$ para expandir:

$$\boxed{\mathcal{F}\!\left\{k\tanh^{2m}(bt)\operatorname{sech}^{2n+1}(bt)\right\}(\omega) = \frac{k\pi}{b}\,\frac{1}{\cosh(u)}\sum_{r=0}^{m}(-1)^r\binom{m}{r}P_{n+r}(u)}$$

Casos particulares ($b=1$, polinomio en $u=\pi\omega/2$):

| $f(t)$ | $F(\omega)$ | Estado |
|--------|-------------|--------|
| $\operatorname{sech}^3(t)$ | $\frac{\pi}{2}(1+u^2)\operatorname{sech}(u)$ | ✓ |
| $\operatorname{sech}^5(t)$ | $\frac{\pi}{24}(9+10u^2+u^4)\operatorname{sech}(u)$ | ✓ |
| $\operatorname{sech}^7(t)$ | $\frac{\pi}{720}(225+259u^2+35u^4+u^6)\operatorname{sech}(u)$ | ✓ |
| $\operatorname{sech}^{2n+1}(t)$ | $\frac{\pi}{(2n)!}\prod_{k=0}^{n-1}(u^2+(2k+1)^2)\cdot\operatorname{sech}(u)$ | ✓ cualquier $n$ |
| $\tanh^2(t)\operatorname{sech}(t)$ | $\frac{\pi}{2}(1-u^2)\operatorname{sech}(u)$ | ✓ |
| $\tanh^2(t)\operatorname{sech}^3(t)$ | $\frac{\pi}{2}[(1+u^2)-\frac{1}{12}(9+10u^2+u^4)]\operatorname{sech}(u)$ | ✓ |
| $\tanh^4(t)\operatorname{sech}(t)$ | $\frac{\pi}{384}(144-56u^2+u^4)\operatorname{sech}(u) \cdot \frac{1}{?}$ | ✓ vía recurrencia |
| $\tanh^{2m}(t)\operatorname{sech}^{2n+1}(t)$ | suma binomial de $P_{n+r}$, ver fórmula general | ✓ cualquier $m,n$ |

> Las inversas (IFT) también están implementadas: dado $F(\omega) = K \cdot \text{poly}(u^2)/\cosh(u)$, el motor identifica $(m,n)$ por división racional y devuelve $k\tanh^{2m}(bt)\operatorname{sech}^{2n+1}(bt)$.

#### Familia impar ($\tanh\operatorname{sech}$) — ✓ Parcialmente implementada

$$\boxed{\mathcal{F}\!\left\{k\tanh(bt)\operatorname{sech}(bt)\right\}(\omega) = \frac{-ik\pi\omega}{b}\operatorname{sech}\!\left(\frac{\pi\omega}{2b}\right)}$$

Verificado numéricamente. Es el caso $n=0$ de $\tanh\operatorname{sech}^{2n+1}$. Los casos superiores ($\tanh\operatorname{sech}^3$, $\tanh^3\operatorname{sech}$, etc.) tienen fórmulas en otras referencias pero su adaptación a la convención $e^{-i\omega t}$ requiere derivación adicional — quedan en fallback numérico.

#### Familia con factor $t$ — ✗ Sin handler directo

Las funciones $t\operatorname{sech}(t)$, $t\tanh(t)\operatorname{sech}(t)$, etc. se obtienen por derivación en frecuencia $\mathcal{F}\{tf(t)\} = i\tfrac{d}{d\omega}F(\omega)$ sobre las fórmulas anteriores. No están implementadas como patrones directos (el integrador numérico sí converge para valores concretos de $b$).

### 24b.6 Tabla resumen de hiperbólicas

| # | $f(t)$ | $F(\omega)$ | Estado | Condiciones |
|---|--------|-------------|--------|-------------|
| TH-1 | $k\,\sin(at)/\sinh(bt)$ | $\frac{k\pi}{2b}[\tanh(\frac{\pi(a-\omega)}{2b})+\tanh(\frac{\pi(a+\omega)}{2b})]$ | ✓ FT+IFT | $a,b>0$ |
| TH-2 | $k\,\cos(at)/\cosh(bt)$ | $\frac{k\pi}{2b}[\operatorname{sech}(\frac{\pi(\omega-a)}{2b})+\operatorname{sech}(\frac{\pi(\omega+a)}{2b})]$ | ✓ FT+IFT | $a\geq0,b>0$ |
| TH-3 | $k\,\operatorname{sech}(bt)$ | $\frac{k\pi}{b}\operatorname{sech}(\frac{\pi\omega}{2b})$ | ✓ FT+IFT | $b>0$ |
| TH-4 | $k/\sinh(bt)$ | $\frac{-ik\pi}{|b|}\tanh(\frac{\pi\omega}{2b})$ | ✓ FT+IFT | $b\neq0$ |
| TH-5 | $k\,\tanh(bt)$ | $\frac{-ik\pi}{|b|}\operatorname{csch}(\frac{\pi\omega}{2b})$ | ✓ FT+IFT | $b\neq0$ |
| TH-6 | $k\,\operatorname{sech}^2(bt)$ | $\frac{k\pi\omega}{b^2}\operatorname{csch}(\frac{\pi\omega}{2b})$ | ✓ FT+IFT | $b>0$ |
| TH-7 | $k\,\operatorname{csch}^2(bt)$ | $\frac{-2k\pi\omega}{b^2}\coth(\frac{\pi\omega}{2b})$ | ✓ FT+IFT | $b>0$ |
| TH-8 | $k\,\operatorname{sech}^{2n+1}(bt)$, $n\geq1$ | $\frac{k\pi}{b}\frac{P_n(u)}{\cosh(u)}$ vía recurrencia | ✓ FT+IFT, cualquier $n$ | $b>0$ |
| TH-9 | $k\,\tanh^{2m}(bt)\operatorname{sech}^{2n+1}(bt)$, $m\geq1$ | suma binomial de $P_{n+r}$, ver 24b.5 | ✓ FT+IFT, cualquier $m,n$ | $b>0$ |
| TH-9b | $k\,\tanh(bt)\operatorname{sech}(bt)$ | $\frac{-ik\pi\omega}{b}\operatorname{sech}(\frac{\pi\omega}{2b})$ | ✓ FT (solo $n=0$) | $b>0$ |
| — | $k\,\tanh^{2j+1}(bt)\operatorname{sech}^{2n+1}(bt)$, $j\geq1$ | imaginaria pura, fórmulas pendientes | ✗ fallback numérico | — |
| — | $k\,t^p\tanh^q(bt)\operatorname{sech}^{2n+1}(bt)$ | derivación en $\omega$ de las anteriores | ✗ sin handler | — |

---

## 24c. Familia gaussiana — $k\,e^{-at^2}\cdot\text{trig}$

La **gaussiana** $e^{-at^2}$ ($a > 0$) es su propia transformada de Fourier (auto-dual). Es la única función $L^2$ que conserva forma gaussiana bajo la TF.

**Fórmula base:**

$$\boxed{\mathcal{F}\!\left\{k\,e^{-at^2}\right\}(\omega) = k\sqrt{\frac{\pi}{a}}\,e^{-\omega^2/(4a)}}, \qquad a > 0$$

**Con modulación coseno** (uso de propiedad de desplazamiento en frecuencia):

$$\boxed{\mathcal{F}\!\left\{k\,e^{-at^2}\cos(bt)\right\}(\omega) = k\sqrt{\frac{\pi}{a}}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\cosh\!\left(\frac{b\omega}{2a}\right)}, \qquad a>0$$

**Con modulación seno:**

$$\boxed{\mathcal{F}\!\left\{k\,e^{-at^2}\sin(bt)\right\}(\omega) = -ik\sqrt{\frac{\pi}{a}}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\sinh\!\left(\frac{b\omega}{2a}\right)}, \qquad a>0$$

**Con fase** $\theta$ en el argumento trigonométrico:

$$\mathcal{F}\!\left\{k\,e^{-at^2}\cos(bt+\theta)\right\}(\omega) = \frac{k}{2}\sqrt{\frac{\pi}{a}}\left[e^{i\theta}\,e^{-(\omega-b)^2/(4a)} + e^{-i\theta}\,e^{-(\omega+b)^2/(4a)}\right]$$

**Derivación** por la propiedad de modulación $\mathcal{F}\{f(t)e^{i\omega_0 t}\}(\omega) = F(\omega-\omega_0)$:

$$\mathcal{F}\{e^{-at^2}\cos(bt)\} = \tfrac{1}{2}\bigl[F(\omega-b) + F(\omega+b)\bigr], \quad F(\omega) = \sqrt{\pi/a}\,e^{-\omega^2/(4a)}$$

$$= \tfrac{1}{2}\sqrt{\pi/a}\bigl[e^{-(\omega-b)^2/(4a)} + e^{-(\omega+b)^2/(4a)}\bigr] = \sqrt{\pi/a}\,e^{-(\omega^2+b^2)/(4a)}\cosh\!\left(\tfrac{b\omega}{2a}\right)$$

La última igualdad usa $e^{-(\omega-b)^2/(4a)} + e^{-(\omega+b)^2/(4a)} = 2e^{-(\omega^2+b^2)/(4a)}\cosh(b\omega/(2a))$.

### 24c.1 Tabla de pares gaussianos

| # | $f(t)$ | $F(\omega)$ | Estado |
|---|--------|-------------|--------|
| G-0 | $k\,e^{-at^2}$ | $k\sqrt{\pi/a}\,e^{-\omega^2/(4a)}$ | ✓ Implementado |
| G-1 | $k\,e^{-at^2}\cos(bt)$ | $k\sqrt{\pi/a}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\cosh\!\left(\frac{b\omega}{2a}\right)$ | ✓ Implementado |
| G-2 | $k\,e^{-at^2}\sin(bt)$ | $-ik\sqrt{\pi/a}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\sinh\!\left(\frac{b\omega}{2a}\right)$ | ✓ Implementado |
| G-3 | $k\,e^{-at^2}\cos(bt+\theta)$ | $\frac{k}{2}\sqrt{\pi/a}\!\left[e^{i\theta}e^{-(\omega-b)^2/(4a)}+e^{-i\theta}e^{-(\omega+b)^2/(4a)}\right]$ | ✓ Implementado |
| G-4 | $k\,e^{-at^2}\sin(bt+\theta)$ | $\frac{k}{2i}\sqrt{\pi/a}\!\left[e^{i\theta}e^{-(\omega-b)^2/(4a)}-e^{-i\theta}e^{-(\omega+b)^2/(4a)}\right]$ | ✓ Implementado |

**Casos canónicos** ($a = 1/2$, convención normalizada $e^{-t^2/2}$):

| $f(t)$ | $F(\omega)$ |
|--------|-------------|
| $e^{-t^2/2}$ | $\sqrt{2\pi}\,e^{-\omega^2/2}$ |
| $e^{-t^2/2}\cos(\omega_0 t)$ | $\sqrt{2\pi}\,e^{-\omega_0^2/2}\,e^{-\omega^2/2}\cosh(\omega_0\omega)$ |
| $e^{-t^2/2}\sin(\omega_0 t)$ | $-i\sqrt{2\pi}\,e^{-\omega_0^2/2}\,e^{-\omega^2/2}\sinh(\omega_0\omega)$ |

**Nota técnica:** Antes de este handler, `FT_is_periodic_nondecaying` clasificaba incorrectamente `e^{-at^2}\cos(bt)` como "integral divergente" porque la detección de decay solo cubría el caso lineal $e^{-at}$. Se extendió para reconocer el caso cuadrático $e^{-at^2}$.

---

## 24d. Familia arctan — $k\,\arctan(bt)$ y variantes

La función arctan no es $L^1(\mathbb{R})$ (tiende a $\pm\pi/2$ en infinito), por lo que su transformada de Fourier es **distribucional**. Los cuatro pares implementados se derivan de propiedades conocidas del toolbox de TF (derivada en tiempo, división por $t$, identidades trigonométricas).

### AT-1: $k\cdot\arctan(bt)$ — caso base ✓ FT + IFT

$$\boxed{\mathcal{F}\!\left\{k\,\arctan(bt)\right\}(\omega) = \frac{-ik\pi}{b\omega}\,e^{-|\omega|/b}}, \qquad b > 0$$

**Derivación:** $\frac{d}{dt}\arctan(bt) = \frac{b}{1+b^2t^2}$, cuya TF es $\pi\,e^{-|\omega|/b}\operatorname{sgn}(\omega)$. Integrando en frecuencia (propiedad de derivada en tiempo $\mathcal{F}[f'] = i\omega F$):

$$F(\omega) = \frac{\pi\,e^{-|\omega|/b}\operatorname{sgn}(\omega)}{i\omega} = \frac{-i\pi\,e^{-|\omega|/b}}{b\omega}$$

**Inversa:** dada $F(\omega) = -ik\pi\,e^{-|\omega|/b}/(b\omega)$, el motor extrae $b$ del exponente y $k$ del coeficiente restante.

**Casos automáticos por teoremas:**
- Desplazamiento temporal: $\arctan(bt - t_0) \to F(\omega)\,e^{-i\omega t_0}$ (teorema de traslación)
- Diferencia: $\arctan(\alpha t) - \arctan(\beta t) \to F_\alpha(\omega) - F_\beta(\omega)$ (linealidad)

### AT-2: $k\cdot\arctan\!\left(\dfrac{1}{bt}\right)$ — solo FT ✓

$$\boxed{\mathcal{F}\!\left\{k\,\arctan\!\left(\frac{1}{bt}\right)\right\}(\omega) = \frac{ik\pi}{\omega}\!\left(\frac{e^{-|\omega|/b}}{b} - 1\right)}, \qquad b > 0$$

**Derivación:** identidad $\arctan(1/x) = \tfrac{\pi}{2}\operatorname{sgn}(x) - \arctan(x)$ para $x \neq 0$, luego linealidad:

$$\mathcal{F}\!\left[\frac{\pi}{2}\operatorname{sgn}(t)\right] = \frac{\pi}{i\omega}, \qquad \mathcal{F}[-\arctan(bt)] = \frac{i\pi\,e^{-|\omega|/b}}{b\omega}$$

No tiene IFT directo (la expresión en frecuencia no es de forma estándar invertible con los patrones actuales).

### AT-3: diferencia $\arctan(\alpha t) - \arctan(\beta t)$ — automático

$$\mathcal{F}\!\left\{\arctan(\alpha t) - \arctan(\beta t)\right\}(\omega) = \frac{-i\pi}{\omega}\!\left(\frac{e^{-|\omega|/\alpha}}{\alpha} - \frac{e^{-|\omega|/\beta}}{\beta}\right)$$

Cubierto por **linealidad** sobre AT-1. Resultado que Maxima devuelve en forma factorizada equivalente.

### AT-4: $k\cdot\arctan(bt)/t$ — solo FT ✓

$$\boxed{\mathcal{F}\!\left\{\frac{k\,\arctan(bt)}{t}\right\}(\omega) = -k\pi\,\operatorname{Ei}(-|\omega|/b)}, \qquad b > 0$$

**Derivación:** propiedad de división por $t$: $\mathcal{F}[f(t)/t](\omega) = i\int_\omega^\infty F(\xi)\,d\xi$ (para $f$ impar). Sustituyendo $F(\xi) = -i\pi e^{-|\xi|/b}/(b\xi)$:

$$i \int_{|\omega|}^\infty \frac{-i\pi\,e^{-\xi/b}}{b\xi}\,d\xi = \pi\int_{|\omega|/b}^\infty \frac{e^{-u}}{u}\,du = \pi\,E_1(|\omega|/b) = -\pi\,\operatorname{Ei}(-|\omega|/b)$$

Verificado numéricamente con integral regularizada $\int_0^\infty \arctan(bt)\,e^{-\varepsilon t}\cos(\omega t)\,dt \xrightarrow{\varepsilon\to 0} -\pi\operatorname{Ei}(-|\omega|/b)/2$.

### Tabla resumen arctan

| # | $f(t)$ | $F(\omega)$ | FT | IFT |
|---|--------|-------------|-----|-----|
| AT-1 | $k\,\arctan(bt)$ | $\dfrac{-ik\pi}{b\omega}\,e^{-|\omega|/b}$ | ✓ | ✓ |
| AT-1t | $k\,\arctan(b(t-t_0))$ | $F_{\text{AT-1}}(\omega)\,e^{-i\omega t_0}$ | ✓ auto | ✗ |
| AT-2 | $k\,\arctan\!\left(\tfrac{1}{bt}\right)$ | $\dfrac{ik\pi}{\omega}\!\left(\tfrac{e^{-|\omega|/b}}{b}-1\right)$ | ✓ | ✗ |
| AT-3 | $\arctan(\alpha t)-\arctan(\beta t)$ | $\dfrac{-i\pi}{\omega}\!\left(\tfrac{e^{-|\omega|/\alpha}}{\alpha}-\tfrac{e^{-|\omega|/\beta}}{\beta}\right)$ | ✓ auto | ✗ |
| AT-4 | $k\,\arctan(bt)/t$ | $-k\pi\,\operatorname{Ei}(-|\omega|/b)$ | ✓ | ✗ |

---

## 24e. Función error — $k\,\operatorname{erf}(bt)$

La función error $\operatorname{erf}(t) = \tfrac{2}{\sqrt{\pi}}\int_0^t e^{-u^2}\,du$ es impar y acotada ($\to \pm 1$ en infinito), no $L^1$. Su TF es distribucional pero tiene forma cerrada limpia gracias a la gaussiana.

### ERF-1: $k\cdot\operatorname{erf}(bt)$ — ✓ FT + IFT

$$\boxed{\mathcal{F}\!\left\{k\,\operatorname{erf}(bt)\right\}(\omega) = \frac{-2ik}{\omega}\,e^{-\omega^2/(4b^2)}}, \qquad b > 0$$

**Derivación:** $\frac{d}{dt}\operatorname{erf}(bt) = \frac{2b}{\sqrt{\pi}}\,e^{-b^2t^2}$, cuya TF es $\frac{2b}{\sqrt{\pi}}\cdot\sqrt{\pi/b^2}\,e^{-\omega^2/(4b^2)} = 2\,e^{-\omega^2/(4b^2)}$. Por la propiedad de derivada en tiempo $\mathcal{F}[f'] = i\omega F$:

$$F(\omega) = \frac{2\,e^{-\omega^2/(4b^2)}}{i\omega} = \frac{-2i}{\omega}\,e^{-\omega^2/(4b^2)}$$

Verificado numéricamente con regularización $e^{-\varepsilon t}$: converge a $-2i\,e^{-\omega^2/4}/\omega$ para $b=1$.

**Inversa:** dada $F(\omega) = -2ik/\omega\cdot e^{-\omega^2/(4b^2)}$, el motor extrae $b = 1/(2\sqrt{p})$ donde $p$ es el coeficiente de $\omega^2$ en el exponente, y $k$ del coeficiente restante.

### Nota sobre erfc

$\operatorname{erfc}(bt) = 1 - \operatorname{erf}(bt)$, por lo que por linealidad:

$$\mathcal{F}\!\left\{\operatorname{erfc}(bt)\right\}(\omega) = 2\pi\,\delta(\omega) - \frac{2i}{\omega}\,e^{-\omega^2/(4b^2)}$$

Implementado con handler directo: el FT handler reconoce `erfc(bt)` y construye la suma; el IFT handler detecta la suma `2kπδ(ω) + erf_term` (en cualquier orden) y reconstruye `k·erfc(bt)`. Funciona para `k` positivo, negativo y escalado.

### Tabla resumen erf/erfc

| # | $f(t)$ | $F(\omega)$ | FT | IFT |
|---|--------|-------------|-----|-----|
| ERF-1 | $k\,\operatorname{erf}(bt)$ | $\dfrac{-2ik}{\omega}\,e^{-\omega^2/(4b^2)}$ | ✓ | ✓ |
| ERF-1t | $k\,\operatorname{erf}(b(t-t_0))$ | $F_{\text{ERF-1}}(\omega)\,e^{-i\omega t_0}$ | ✓ auto | ✗ |
| ERFC-1 | $k\,\operatorname{erfc}(bt)$ | $2k\pi\,\delta(\omega) - \dfrac{2ik}{\omega}\,e^{-\omega^2/(4b^2)}$ | ✓ | ✓ |

---

## 24f. Familia gaussiana-Lorentziana — $k\,e^{-at^2}/(t^2+b^2)$

### Derivación

Esta familia se resuelve por **convolución en frecuencia** (producto en tiempo → convolución en frecuencia):

$$\mathcal{F}\!\left\{f(t)\cdot g(t)\right\} = \frac{1}{2\pi}\,F(\omega)*G(\omega)$$

Con $f(t)=e^{-at^2}$ y $g(t)=1/(t^2+b^2)$:
- $\mathcal{F}\{e^{-at^2}\} = \sqrt{\pi/a}\,e^{-\omega^2/(4a)}$
- $\mathcal{F}\{1/(t^2+b^2)\} = (\pi/b)\,e^{-b|\omega|}$

La convolución de la gaussiana $e^{-\omega^2/(4a)}$ con el decaimiento exponencial $e^{-b|\omega|}$ tiene forma cerrada en erfc.

### Resultados

$$\boxed{\mathcal{F}\!\left\{\frac{k\,e^{-at^2}}{t^2+b^2}\right\}(\omega) = \frac{k\pi\,e^{ab^2}}{2b}\left[e^{-b\omega}\,\operatorname{erfc}\!\left(\frac{2ab-\omega}{2\sqrt{a}}\right) + e^{b\omega}\,\operatorname{erfc}\!\left(\frac{2ab+\omega}{2\sqrt{a}}\right)\right]}$$

$$\boxed{\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-a\omega^2}}{\omega^2+b^2}\right\}(t) = \frac{k\,e^{ab^2}}{2b}\left[e^{-bt}\,\operatorname{erfc}\!\left(\frac{2ab-t}{2\sqrt{a}}\right) + e^{bt}\,\operatorname{erfc}\!\left(\frac{2ab+t}{2\sqrt{a}}\right)\right]}$$

Las dos fórmulas son **idénticas en estructura** (dualidad $t \leftrightarrow \omega$), salvo el factor $\pi$ en la FT proveniente de la convención $\hat{f}(\omega) = \int f e^{-i\omega t}\,dt$.

El caso particular $a=1,\,b=1$ corresponde al resultado clásico de ejercicios:

$$\mathcal{F}^{-1}\!\left\{\frac{e^{-\omega^2}}{\omega^2+1}\right\} = \frac{e}{2}\left[e^{-t}\,\operatorname{erfc}\!\left(\frac{2-t}{2}\right) + e^{t}\,\operatorname{erfc}\!\left(\frac{2+t}{2}\right)\right]$$

### Tabla resumen GCONV-1

| # | Dirección | $a$ | $b$ | $k$ | FT/IFT |
|---|-----------|-----|-----|-----|--------|
| GCONV-1 FT | $\mathcal{F}\{k\,e^{-at^2}/(t^2+b^2)\}$ | libre | libre | libre | ✓ |
| GCONV-1 IFT | $\mathcal{F}^{-1}\{k\,e^{-a\omega^2}/(\omega^2+b^2)\}$ | libre | libre | libre | ✓ |

Handler implementado en `fourier_transforms.mac`. Usa `f_expr` pre-`expand()` porque Maxima invierte la fracción al expandir. Verificado numéricamente para $a \in \{1,2,3\}$, $b \in \{1,2\}$, $k \in \{1,2,-1\}$.

---

## 24g. Familia $k\,t^n\,e^{-at^2}$ — propiedad de derivada en frecuencia

### Fundamento

La **propiedad de derivada en frecuencia** establece que multiplicar por $t$ en tiempo equivale a derivar en frecuencia:

$$\mathcal{F}\{t\cdot f(t)\}(\omega) = i\,\frac{d}{d\omega}\,F(\omega)$$

Por inducción para $n$ entero $\geq 1$:

$$\mathcal{F}\{t^n\cdot f(t)\}(\omega) = i^n\,\frac{d^n}{d\omega^n}\,F(\omega)$$

### Resultado

Partiendo de $\mathcal{F}\{e^{-at^2}\} = \sqrt{\pi/a}\,e^{-\omega^2/(4a)}$:

$$\boxed{\mathcal{F}\!\left\{k\,t^n\,e^{-at^2}\right\}(\omega) = k\cdot i^n\cdot\frac{d^n}{d\omega^n}\!\left[\sqrt{\frac{\pi}{a}}\,e^{-\omega^2/(4a)}\right]}$$

Los primeros casos explícitos:

| $n$ | $\mathcal{F}\{k\,t^n\,e^{-at^2}\}(\omega)$ |
|-----|----------------------------------------------|
| 1 | $\displaystyle -\frac{ik\sqrt{\pi/a}}{2a}\,\omega\,e^{-\omega^2/(4a)}$ |
| 2 | $\displaystyle -\frac{k\sqrt{\pi/a}}{4a^2}\,(\omega^2 - 2a)\,e^{-\omega^2/(4a)}$ |
| 3 | $\displaystyle \frac{ik\sqrt{\pi/a}}{8a^3}\,(\omega^3 - 6a\omega)\,e^{-\omega^2/(4a)}$ |

El resultado general es una gaussiana multiplicada por el polinomio de Hermite $H_n(\omega/(2\sqrt{a}))$ — función par para $n$ par (transformada real) e impar para $n$ impar (transformada imaginaria pura), consistente con la paridad de $t^n\,e^{-at^2}$.

### Notas de implementación

El handler detecta `k·tⁿ·e^{-at²}` con $n\geq 1$ entero, $a>0$, $k$ libre. Maxima calcula la derivada $n$-ésima simbólicamente — no se hardcodea ninguna fórmula por orden. Funciona para $n=1,2,3,\ldots$ sin código adicional.

**Bug corregido:** el handler gaussiano anterior absorbía silenciosamente factores de $t$ como si fueran escalares, devolviendo $\mathcal{F}\{t\cdot e^{-at^2}\} = \mathcal{F}\{e^{-at^2}\}$ (incorrecto). Ahora cualquier factor dependiente de $t$ que no sea $e^{-at^2}$ o $\sin/\cos$ rechaza el handler.

### Tabla resumen TGAUSS

| # | $f(t)$ | $F(\omega)$ | FT | IFT |
|---|--------|-------------|-----|-----|
| TGAUSS | $k\,t^n\,e^{-at^2}$ | $k\cdot i^n\cdot\partial_\omega^n[\sqrt{\pi/a}\,e^{-\omega^2/(4a)}]$ | ✓ | ✗ |

---

## §24h. Familia TPOW: $k\,\theta(t)\,t^p$ — potencias de $t$ causales

### Fórmula cerrada (distribucional)

$$\boxed{\mathcal{F}\bigl[k\,\theta(t)\,t^p\bigr](\omega)
= k\,\Gamma(p+1)\,|\omega|^{-(p+1)}\left(\cos\tfrac{\pi(p+1)}{2} - i\,\mathrm{sgn}(\omega)\sin\tfrac{\pi(p+1)}{2}\right)}$$

**Condición de convergencia:** $p > -1$ (para que $t^p$ sea integrable en $t=0$; la oscilación de $e^{-i\omega t}$ garantiza convergencia en $\infty$).

### Derivación

Se parte de la integral de Laplace regularizada:

$$\int_0^\infty t^p\,e^{-(\varepsilon+i\omega)t}\,dt = \frac{\Gamma(p+1)}{(\varepsilon+i\omega)^{p+1}}, \quad \varepsilon > 0.$$

Tomando $\varepsilon\to 0^+$ en el sentido distribucional:

$$\mathcal{F}[\theta(t)\,t^p](\omega) = \frac{\Gamma(p+1)}{(i\omega)^{p+1}}$$

donde $(i\omega)^{p+1} = |\omega|^{p+1}\,e^{i\pi(p+1)/2\,\mathrm{sgn}(\omega)}$, por lo que:

$$\mathcal{F}[\theta(t)\,t^p](\omega) = \Gamma(p+1)\,|\omega|^{-(p+1)}\,e^{-i\pi(p+1)/2\,\mathrm{sgn}(\omega)}.$$

### Casos especiales importantes

| $p$ | $f(t)=\theta(t)\,t^p$ | $\Gamma(p+1)$ | $F(\omega)$ |
|-----|-----------------------|---------------|-------------|
| $-1/2$ | $\theta(t)/\sqrt{t}$ | $\sqrt{\pi}$ | $\sqrt{\pi/|\omega|}\,e^{-i\pi/4\,\mathrm{sgn}(\omega)}$ |
| $1/3$ | $\theta(t)\,t^{1/3}$ | $\Gamma(4/3)$ | $\Gamma(4/3)\,|\omega|^{-4/3}\,e^{-i2\pi/3\,\mathrm{sgn}(\omega)}$ |
| $1/2$ | $\theta(t)\sqrt{t}$ | $\sqrt{\pi}/2$ | $\frac{\sqrt{\pi}}{2|\omega|^{3/2}}\,e^{-3i\pi/4\,\mathrm{sgn}(\omega)}$ |

**Condición:** $p > -1$ y $p \notin \mathbb{Z}$. Para enteros $p \geq 0$, la FT incluye derivadas de la delta de Dirac ($\delta^{(n)}$) que el método de regularización de Laplace no captura — esos casos retornan FALLBACK.

### Implementación

- Handler: **TPOW** en `FT_pattern_lookup`, antes del bloque `u(t)`.
- Detecta: tramos `[0, ∞)` con expresión `k·t^p` (sin factores de otro tipo).
- Identifica el exponente `p` via `log(f)/log(t_var)` para manejar `sqrt(t)`, `t^(1/3)`, etc.
- Rechaza automáticamente `p ≤ -1` (verificación `is(p > -1)`).
- **No hay IFT handler:** la FT inversa de $\Gamma(a)\,|\omega|^{-a}\,e^{-i\pi a/2\cdot\text{sgn}}$ es la función de Heaviside causal original — no se implementa por ser poco frecuente en esa dirección.

### Tabla resumen TPOW

| # | $f(t)$ | $F(\omega)$ | FT | IFT |
|---|--------|-------------|-----|-----|
| TPOW | $k\,\theta(t)\,t^p\;(p>-1)$ | $k\,\Gamma(p+1)\,\|\omega\|^{-(p+1)}\,e^{-i\pi(p+1)/2\cdot\mathrm{sgn}(\omega)}$ | ✓ | ✗ |

---

## 25. Arquitectura de display: formas principales y alternativas

La calculadora separa internamente las representaciones de **evaluación** (usadas por el plotter) y de **display** (mostradas en la UI), para que cada resultado tenga la forma más limpia posible en pantalla sin sacrificar la capacidad de evaluación numérica.

### 25.1 El problema: `ratsimp` destruye estructuras de suma

Maxima aplica `ratsimp` al resultado para simplificación algebraica. Este paso **fusiona** sumas de fracciones:

$$\frac{1}{\cosh(u)} + \frac{1}{\cosh(v)} \;\xrightarrow{\text{ratsimp}}\; \frac{\cosh(u)+\cosh(v)}{\cosh(u)\cdot\cosh(v)}$$

La estructura `1/cosh(·)` que permite reescribir como `sech(·)` desaparece. Lo mismo con `tanh(·)`.

### 25.2 Solución: captura pre-`ratsimp` y stream de display separado

Para cada resultado, el script `fourier_transform.mac` genera **dos streams** paralelos:

| Sentinel Maxima          | Contenido                                    | Uso                                 |
|--------------------------|----------------------------------------------|-------------------------------------|
| `__F_MAXIMA__` / `__F_TEX__` | Resultado post-`ratsimp` (evaluable)     | Plotter numérico, copia Maxima      |
| `__DISPLAY_F_MAXIMA__` / `__DISPLAY_F_TEX__` | Forma display alternativa    | "Otras formas" → etiqueta "Forma alternativa" |

La captura se hace **antes** de `ratsimp`:
- **`sech`**: `FT_to_sech(result[1])` sobre el resultado crudo → captura la suma `sech(u)+sech(v)` antes de que `ratsimp` la fusione
- **`tanh` alt**: `FT_to_tanh_alt(F)` sobre el resultado ya ratsimp'd → `ratsimp` no altera `tanh`, no hace falta captura pre-ratsimp

### 25.3 Funciones de reescritura

| Función Maxima       | Reemplaza           | Por                                | Dónde se usa                   |
|----------------------|---------------------|------------------------------------|--------------------------------|
| `FT_to_sech(e)`      | `1/cosh(u)`         | `sech(u)`                          | Pre-`ratsimp`, captura display |
| `FT_to_tanh_alt(e)`  | `tanh(u)`           | `sinh(2u)/(cosh(2u)+1)`            | Post-`ratsimp`, captura display |

Ambas son **tree-walkers** recursivos: recorren el árbol de expresión y reemplazan solo el patrón exacto, dejando el resto intacto.

### 25.4 Identidades usadas

$$\tanh(x) = \frac{\sinh(2x)}{\cosh(2x)+1} \qquad \text{(semi-ángulo)}$$

$$\frac{1}{\cosh(x)} = \operatorname{sech}(x) \qquad \text{(definición de sech)}$$

### 25.5 Flujo en el backend TypeScript

El servicio `fourierTransform.service.ts` extrae ambos streams del output de Maxima y los expone como campos separados en la respuesta JSON:

```
res.F     = { tex: tanh_form,   maxima: tanh_form   }   ← principal
res.FAlt  = { tex: sinh_form,   maxima: sinh_form   }   ← alternativa
```

El frontend inyecta `FAlt` como la primera entrada de "Otras formas" con la etiqueta **"Forma alternativa"** / **"Alternate form"**, antes de las formas generadas dinámicamente (Factorizada, Expandida, etc.).

---

## 26. Potencias de sinc — familia B-spline en frecuencia

### Fórmula general

$$\boxed{\mathcal{F}\!\left[\left(\frac{\sin t}{t}\right)^n\right](\omega) = \frac{\pi}{2^n\,(n-1)!} \sum_{k=0}^{n} \binom{n}{k}(-1)^k\,(n-2k-\omega)^{n-1}\,\operatorname{sgn}(n-2k-\omega)}$$

válida para todo entero $n \geq 1$, convención de ingeniería $F(\omega)=\int f(t)e^{-i\omega t}dt$.

El resultado es una **B-spline de orden $n-1$** en el dominio frecuencial — función polinómica a trozos de grado $n-1$ con soporte $[-n, n]$.

### Caso general con escala y desplazamiento

Para $k\,\operatorname{sinc}(at+b)^n$ con $a \neq 0$:

$$\mathcal{F}\!\left[k\,\operatorname{sinc}(at+b)^n\right](\omega) = \frac{k\pi}{|a|\,2^n\,(n-1)!} \sum_{j=0}^{n} \binom{n}{j}(-1)^j\!\left(n-2j-\frac{\omega}{a}\right)^{n-1}\!\operatorname{sgn}\!\left(n-2j-\frac{\omega}{a}\right) \cdot e^{-i\omega t_0}$$

donde $t_0 = -b/a$ es el desplazamiento temporal ($e^{-i\omega t_0}$ se omite cuando $b=0$).

### Casos notables

| $n$ | $f(t)$ | $F(\omega)$ | Forma compacta |
|-----|--------|-------------|----------------|
| 1 | $\operatorname{sinc}(t)=\sin(t)/t$ | $\pi\,\operatorname{rect}(\omega/2)$ | $\pi$ para $|\omega|<1$, $0$ fuera |
| 2 | $\operatorname{sinc}^2(t)$ | $\pi\,\operatorname{tri}(\omega/2)$ | $\pi(1-|\omega|/2)$ para $|\omega|<2$ |
| 3 | $\operatorname{sinc}^3(t)$ | B-spline cuadrática, soporte $[-3,3]$ | $\frac{\pi}{8}\bigl[(3-|\omega|)^2\operatorname{sgn}(3-|\omega|)-\ldots\bigr]$ |
| $n$ | $\operatorname{sinc}^n(t)$ | B-spline de orden $n-1$, soporte $[-n,n]$ | Fórmula general con $\binom{n}{k}$ |

### Evaluación numérica en $\omega=0$

$$F(0) = \frac{\pi}{2^n\,(n-1)!}\sum_{k=0}^{n}\binom{n}{k}(-1)^k(n-2k)^{n-1}\operatorname{sgn}(n-2k) = \frac{\pi\cdot n!}{2^{n-1}\cdot((n/2)!)^2 \cdot n}$$

Para referencia rápida:

| $n$ | $F(0)$ |
|-----|--------|
| 1 | $\pi \approx 3.1416$ |
| 2 | $\pi \approx 3.1416$ |
| 3 | $3\pi/4 \approx 2.3562$ |
| 4 | $2\pi/3 \approx 2.0944$ |
| 5 | $3\pi/5 \approx 1.8850$ |

### Implementación

Detector `FT_match_sinc_pow` en `FT_pattern_lookup`:
- Detecta `k*sinc(at+b)^n` para $n \geq 2$ entero
- $n=2$ usa la forma compacta `tri` (más legible y compatible con el checker de equivalencia)
- $n \geq 3$ usa la suma de sgn con coeficientes binomiales
- Incluye factor de escala $1/|a|$ y time-shift $e^{-i\omega t_0}$ cuando $b \neq 0$

---

## 27. FT de $|\sin(bt+c)|$ y $|\cos(bt+c)|$ en intervalos numéricos

### Expansión analítica de raíces

La clave para calcular $\mathcal{F}\{|\sin(bt+c)|\}$ en un intervalo finito $[a_0, b_0]$ es dividir el intervalo en los subintervalos donde el signo de $\sin(bt+c)$ es constante.

Las raíces de $\sin(bt+c)$ están en:
$$t_n = \frac{n\pi - c}{b}, \qquad n \in \mathbb{Z}$$

Las raíces de $\cos(bt+c)$ están en:
$$t_n = \frac{(n+\tfrac{1}{2})\pi - c}{b} = \frac{n\pi - c + \pi/2}{b}, \qquad n \in \mathbb{Z}$$

El motor enumera los enteros $n$ cuyas raíces caen dentro de $(a_0, b_0)$ y subdivide el intervalo. En cada subintervalo, $|\sin(bt+c)| = \pm\sin(bt+c)$ (signo determinado evaluando en el punto medio).

### Fórmulas cerradas en un período

**$|\sin(t)|$ en $[0, \pi]$** (un medio período):

$$\mathcal{F}\{|\sin(t)|\,\mathbf{1}_{[0,\pi]}\}(\omega) = \int_0^{\pi} \sin(t)\,e^{-i\omega t}\,dt = \frac{1+e^{-i\pi\omega}}{1-\omega^2}$$

**$|\sin(t)|$ en $[-\pi, \pi]$** (un período completo, función par):

$$\mathcal{F}\{|\sin(t)|\,\mathbf{1}_{[-\pi,\pi]}\}(\omega) = \frac{2(1+e^{-i\pi\omega})}{1-\omega^2} \cdot \mathbf{1}_{\omega \neq \pm 1}$$

que el motor simplifica como $-2(\cos(\pi\omega)+1)/(({\omega-1})({\omega+1}))$.

**$|\sin(t)|$ en $[-2\pi, 2\pi]$** (dos períodos):

$$\mathcal{F}\{|\sin(t)|\,\mathbf{1}_{[-2\pi,2\pi]}\}(\omega) = \frac{4(1+e^{-i\pi\omega})}{1-\omega^2} \cdot \mathbf{1}_{\omega \neq \pm 1}$$

### Casos con frecuencia $b$ arbitraria

Para $|\sin(bt)|$ en $[-\pi/b, \pi/b]$ (un período):

$$\mathcal{F}\{|\sin(bt)|\,\mathbf{1}_{[-\pi/b,\,\pi/b]}\}(\omega) = \frac{2b(1+e^{-i\pi\omega/b})}{b^2-\omega^2}$$

### Tabla de casos calculables

| $f(t)$ | Intervalo | Comentario |
|--------|-----------|------------|
| $|\sin(t)|$ | $(-\pi k, \pi k)$, $k \geq 1$ entero | $k$ períodos completos; el motor los divide en $2k$ tramos |
| $|\cos(t)|$ | $(-\pi k/2, \pi k/2)$, $k$ entero | raíces en $\pm\pi/2, \pm 3\pi/2, \ldots$ |
| $|\sin(\pi t)|$ | $(-k, k)$, $k \geq 1$ entero | raíces en enteros |
| $|\cos(\pi t)|$ | $(-k/2, k/2)$, $k$ entero | raíces en semienteros |
| $k\,|\sin(bt+c)|$ | cualquier $[a_0, b_0]$ numérico | escalado y fase; soportado por `FT_trig_zeros` |
| $|\sin(bt)|$ | $(-a, a)$ simbólico | **no calculable** analíticamente sin conocer $\lfloor ab/\pi \rfloor$ |
| $|\sin(t)|$ | $(-\infty, \infty)$ | **no existe** como función ordinaria (periódica no decayente) |

### Por qué $(-\infty, \infty)$ no existe

$|\sin(t)|$ es periódica con período $\pi$ y amplitud 1 — no decae en ningún sentido. Por el teorema de Riemann-Lebesgue, toda función en $L^1(\mathbb{R})$ tiene transformada que tiende a 0; pero $|\sin(t)| \notin L^1(\mathbb{R})$ porque $\int_{-\infty}^{\infty}|\sin(t)|\,dt$ diverge. En consecuencia su TF no existe como función ordinaria (tampoco como distribución temperada estándar).

Lo mismo aplica a $\sin(t)$, $\cos(t)$, $|\sin(\pi t)|$, $|\cos(t)|$, y cualquier función periódica no decayente.

**Excepción importante:** $\sin(t)/t = \operatorname{sinc}(t) \in L^1(\mathbb{R})$ porque el denominador $t$ introduce decaimiento. También $\sin(bt)/(a^2+t^2)$ existe porque el denominador cuadrático domina.

### Implementación

`FT_trig_zeros(g, x, lo, hi)` en `fourier_transforms.mac`:
- Detecta si `g` es `sin(bt+c)` o `cos(bt+c)` con argumento lineal en `x`
- Calcula los índices enteros $n$ que ponen la raíz dentro de `(lo, hi)` vía `floor`/`ceiling`
- Enumera hasta 500 raíces (cap de seguridad)
- Si `lo` o `hi` son simbólicos, `float` falla y la lista queda vacía → el caso simbólico cae al integrador que reporta "divergente"
- Para abs de otras funciones (abs(t-a), abs(polinomio)), usa `solve()` como antes

`FT_is_periodic_nondecaying(expr, t_var)` en `fourier_transforms.mac`:
- Detecta funciones periódicas no decayentes en `(-∞,∞)`
- Se activa **solo si el pattern lookup ya falló** (las TF con deltas como $\cos(t) \to \pi[\delta(\omega-1)+\delta(\omega+1)]$ las maneja el lookup sin llegar aquí)
- Condiciones de decaimiento reconocidas: denominador con $t$, factor $e^{-at}$, factor $e^{-a|t|}$, presencia de $u(t)$ (soporte restringido)
- Retorna `false` conservadoramente si hay duda → el integrador intenta y falla limpiamente

## 28. Normalización $(\sin(bt)/t)^n$ → $\text{sinc}^n$ antes del lookup

### El problema

Cuando el usuario escribe $(sin(\pi t)/\pi t)^2$ o $(\sin(bt)/t)^n$, Maxima lo ve tras `expand` como $\sin(bt)^n / (dt)^n$ — una fracción de potencias, no como $\text{sinc}$. El lookup fallaba (timeout o `exists: false`) porque los matchers de `sinc` no reconocen esa forma.

### Solución: preprocesador `FT_sinpow_to_sinc`

Detecta $k \cdot \sin(bt+c)^n / (dt+e)^n$ con $n \ge 2$ cuando el argumento del seno es proporcional al denominador ($b/d = c/e$), y lo reescribe como $k(b/d)^n \cdot \text{sinc}(bt+c)^n$ antes de pasar a los matchers.

**Restricción $n \ge 2$**: el caso $n=1$ tiene su propio matcher `sin(at)/(\pi t) \to u(\omega+a)-u(\omega-a)$ que devuelve la forma canónica de escalón unitario; interceptarlo aquí cambiaría el resultado a `rect`.

### Cobertura tras el preprocesador

| Entrada | Reescritura | Resultado |
|---|---|---|
| $(\sin t / t)^2$ | $\text{sinc}(t)^2$ | $\pi \cdot \text{tri}(\omega/2)$ |
| $(\sin(\pi t)/\pi t)^2$ | $\text{sinc}(\pi t)^2$ | $\text{tri}(\omega/(2\pi))$ |
| $3(\sin t / t)^2$ | $3\,\text{sinc}(t)^2$ | $3\pi \cdot \text{tri}(\omega/2)$ |
| $(\sin t / t)^3$ | $\text{sinc}(t)^3$ | B-spline orden 3 |

El preprocesador se aplica al inicio de **ambos** `FT_pattern_lookup` e `IFT_pattern_lookup`, cubriendo también el caso inverso: $(\sin(\omega)/\omega)^n$ en frecuencia.

---

## 29. IFT de potencias de sinc — dual de la B-spline

### Fórmula

$$\mathcal{F}^{-1}\{\text{sinc}(\omega)^n\}(t) = \frac{1}{2\pi} \cdot \text{FT}[\text{sinc}^n](t)$$

donde $\text{FT}[\text{sinc}^n]$ es la fórmula B-spline de la sección 26 evaluada en $t$.

Para $n=2$ con $a$ general:

$$\mathcal{F}^{-1}\{k\,\text{sinc}(a\omega)^2\}(t) = \frac{k}{2|a|}\,\text{tri}\!\left(\frac{t}{2a}\right)$$

Para $n \ge 3$: suma con $\text{sgn}$ de la fórmula B-spline.

### Tabla verificada

| Entrada $F(\omega)$ | $\mathcal{F}^{-1}\{F\}(t)$ |
|---|---|
| $\text{sinc}(\omega)^2$ | $\text{tri}(t/2)/2$ |
| $\text{sinc}(2\omega)^2$ | $\text{tri}(t/4)/4$ |
| $k\,\text{sinc}(\omega)^n\;(n\ge3)$ | B-spline en $t$ (fórmula sgn) |
| $\sin(\omega)^2/\omega^2$ | $\text{tri}(t/2)/2$ (vía preprocesador) |
| $3\sin(\omega)^2/\omega^2$ | $3\,\text{tri}(t/2)/2$ |

### Implementación

`IFT_pattern_lookup` — nuevo bloque con `FT_match_sinc_pow` + `FT_sincpow_formula(a, 0, n, t_var)` escalado por $1/(2\pi)$. Desplazamiento en frecuencia $\omega_0 = -b/a$ genera modulación $e^{i\omega_0 t}$.

---

## 30. Potencias de tri — tabla de fórmulas cerradas $n=2..4$

### Por qué no hay fórmula general tipo B-spline

$\text{FT}[\text{sinc}^n]$ produce sumas con $\text{sgn}$ porque la B-spline tiene soporte compacto y la integral se evalúa por diferencias finitas. $\text{tri}(t)^n$ también tiene soporte compacto $[-1,1]$, pero la integral produce polinomios trigonométricos que **alternan entre sin y cos** con cada $n$ — no hay una suma uniforme tipo B-spline. Cada caso requiere su propia forma cerrada.

### Fórmulas FT verificadas

Sea $u = \omega/a$ la variable normalizada. Para $k \cdot \text{tri}(at+b)^n$, el resultado es $k \cdot R_n(u) \cdot e^{-i\omega t_0}/a$ con $t_0 = -b/a$:

| $n$ | $R_n(u) \cdot a$ | Tipo |
|---|---|---|
| 2 | $4(u - \sin u)/u^3$ | sin |
| 3 | $2(3u^2 + 6\cos u - 6)/u^4$ | cos |
| 4 | $8(u^3 + 6\sin u - 6u)/u^5$ | sin |

**Patrón de paridad:** $n$ par → sin, $n$ impar → cos. Esto refleja que $\text{tri}^n$ es par, su FT es real, y el tipo trigonométrico alterna por la integración por partes iterada.

### Fórmulas IFT verificadas

Por la dualidad ($\text{tri}$ es par, soporte en $[-1,1]$):

$$\mathcal{F}^{-1}\{\text{tri}(\omega)^n\}(t) = \frac{1}{2\pi}\,\text{FT}[\text{tri}^n]\big|_{\omega \to t}$$

| $n$ | $\mathcal{F}^{-1}\{\text{tri}(\omega)^n\}(t)$ |
|---|---|
| 2 | $2(t - \sin t)/(\pi t^3)$ |
| 3 | $(3t^2 + 6\cos t - 6)/(\pi t^4)$ |
| 4 | $4(t^3 + 6\sin t - 6t)/(\pi t^5)$ |

### Extensión futura

Si se encuentra una fórmula general, reemplazar el bloque `if/else` en `FT_tripow_formula` por la suma. La función acepta cualquier $n$ y retorna `false` para $n > 4$, haciendo el punto de extensión explícito.

### Implementación

- `FT_match_tri_pow(expr, t_var)` — detecta $k \cdot \text{tri}(at+b)^n$ para $n \ge 2$, devuelve `[k, a, b, n]`
- `FT_tripow_formula(a, b, n, w_var)` — tabla $n=1..4$ con desplazamiento $e^{-i\omega t_0}$
- Conectado en `FT_pattern_lookup` **antes** del matcher $n=1$ para que `tri^2` no caiga al handler lineal
- Conectado en `IFT_pattern_lookup` con escala $1/(2\pi)$ y modulación $e^{i\omega_0 t}$
---

## 31. FT de $k\,e^{-at}\sin^n(bt)\,u(t)$ y $k\,e^{-at}\cos^n(bt)\,u(t)$ — decaimiento con potencias de trig

### Motivación

Los pares #21–22 cubren $e^{-at}\cos(bt)\,u(t)$ y $e^{-at}\sin(bt)\,u(t)$ para potencia 1. Cuando los factores trigonométricos se elevan a una potencia $n \geq 2$, el resultado sigue siendo causal y de energía finita, pero no existe un par compacto único — la transformada se obtiene combinando reducción trigonométrica con la tabla de exponenciales causales.

### Método de cálculo

**Paso 1 — Reducción de potencias** (identidades de la sección 19):

$$e^{-at}\sin^n(bt)\,u(t) = e^{-at}\left[\sum_m c_m \sin(m\,b\,t) + d_m \cos(m\,b\,t)\right]u(t)$$

donde los coeficientes $c_m, d_m$ son los de las fórmulas generales de la sección 19 con $\omega_0 = b$.

**Paso 2 — Linealidad** y aplicación de los pares #21–22 a cada término:

$$\mathcal{F}\{e^{-at}\sin(mbt)\,u(t)\} = \frac{m\,b}{(i\omega+a)^2 + (mb)^2}, \qquad \mathcal{F}\{e^{-at}\cos(mbt)\,u(t)\} = \frac{i\omega+a}{(i\omega+a)^2 + (mb)^2}$$

### Tabla de casos frecuentes

| $f(t)$ | $F(\omega)$ | Condiciones |
|--------|-------------|-------------|
| $k\,e^{-at}\sin^2(bt)\,u(t)$ | $\dfrac{k}{2}\!\left[\dfrac{1}{i\omega+a} - \dfrac{i\omega+a}{(i\omega+a)^2+4b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\cos^2(bt)\,u(t)$ | $\dfrac{k}{2}\!\left[\dfrac{1}{i\omega+a} + \dfrac{i\omega+a}{(i\omega+a)^2+4b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\sin^3(bt)\,u(t)$ | $k\!\left[\dfrac{3b/4}{(i\omega+a)^2+b^2} - \dfrac{3b/4}{(i\omega+a)^2+9b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\cos^3(bt)\,u(t)$ | $k\!\left[\dfrac{3(i\omega+a)/4}{(i\omega+a)^2+b^2} + \dfrac{i\omega+a}{4[(i\omega+a)^2+9b^2]}\right]$ | $a,b>0$ |

**Derivación del caso $n=2$** (usando $\sin^2(bt) = \tfrac{1-\cos(2bt)}{2}$):

$$e^{-at}\sin^2(bt)\,u(t) = \frac{1}{2}e^{-at}u(t) - \frac{1}{2}e^{-at}\cos(2bt)\,u(t)$$

$$\mathcal{F}\{\cdot\} = \frac{1}{2}\cdot\frac{k}{i\omega+a} - \frac{1}{2}\cdot\frac{k(i\omega+a)}{(i\omega+a)^2+(2b)^2}$$

### Estado de implementación

> El motor resuelve estos casos **automáticamente vía pipeline**:
> `trigreduce` (sección 19) → expansión en suma → linealidad → pares #21–22.
> No existe un handler directo de pattern, pero el resultado es correcto para todo $n \geq 2$ entero.
> Limitación: si `trigreduce` no reduce completamente (argumento no lineal en $t$), el motor cae al integrador.

---

## 32. FT bilateral de $k\,e^{-a|t|}\cos(bt)$ y $k\,e^{-a|t|}\sin(bt)$ — modulación del decaimiento simétrico

### Motivación

El par #25 cubre $e^{-a|t|}$ (bilateral puro). Al multiplicarlo por $\cos(bt)$ o $\sin(bt)$ se obtiene una **señal de energía bilateral modulada**, cuya transformada sigue siendo una función racional real en $\omega$.

### Derivación por desplazamiento en frecuencia

Partiendo de $\mathcal{F}\{e^{-a|t|}\} = \dfrac{2a}{a^2+\omega^2}$ y aplicando el par #29–30 de la tabla de funciones de energía:

$$\boxed{\mathcal{F}\!\left\{k\,e^{-a|t|}\cos(bt)\right\}(\omega) = \frac{ka(a^2+b^2+\omega^2)}{[(a^2+(\omega-b)^2][(a^2+(\omega+b)^2]/2}} = k\left[\frac{a}{a^2+(\omega-b)^2} + \frac{a}{a^2+(\omega+b)^2}\right]}$$

Simplificado vía modulación ($\mathcal{F}\{g(t)\cos(bt)\} = [G(\omega-b)+G(\omega+b)]/2$ con $G(\omega)=2a/(a^2+\omega^2)$):

$$\mathcal{F}\{k\,e^{-a|t|}\cos(bt)\} = k\left[\frac{a}{a^2+(\omega-b)^2} + \frac{a}{a^2+(\omega+b)^2}\right], \qquad a,b > 0$$

$$\mathcal{F}\{k\,e^{-a|t|}\sin(bt)\} = ik\left[\frac{a}{a^2+(\omega+b)^2} - \frac{a}{a^2+(\omega-b)^2}\right], \qquad a,b > 0$$

### Tabla de pares

| # | $f(t)$ | $F(\omega)$ | Condiciones |
|---|--------|-------------|-------------|
| B-1 | $k\,e^{-a\|t\|}\cos(bt)$ | $ka\!\left[\dfrac{1}{a^2+(\omega-b)^2}+\dfrac{1}{a^2+(\omega+b)^2}\right]$ | $a,b>0$ |
| B-2 | $k\,e^{-a\|t\|}\sin(bt)$ | $ika\!\left[\dfrac{1}{a^2+(\omega+b)^2}-\dfrac{1}{a^2+(\omega-b)^2}\right]$ | $a,b>0$ |
| B-3 | $k\,e^{-a\|t\|}\cos^2(bt)$ | $\dfrac{k}{2}\!\left[\dfrac{2a}{a^2+\omega^2}+\dfrac{a}{a^2+(\omega-2b)^2}+\dfrac{a}{a^2+(\omega+2b)^2}\right]$ | $a,b>0$ |

> **Caso $b = 0$:** se reduce al par #25: $\mathcal{F}\{k\,e^{-a|t|}\} = 2ka/(a^2+\omega^2)$.
> **Simetría:** $e^{-a|t|}\cos(bt)$ es función par → $F(\omega)$ es real y par. $e^{-a|t|}\sin(bt)$ es impar → $F(\omega)$ es imaginaria pura e impar.

### Estado de implementación

> El motor resuelve B-1 y B-2 **automáticamente** vía el handler `cos(bt)*f(t) → [G(ω-b)+G(ω+b)]/2` (meta-operador de modulación por coseno/seno de la sección 6) aplicado al par #25. No hay handler directo, pero la cadena funciona correctamente para $b$ simbólico.

---

## 33. Tren de impulsos (función Shah / peine de Dirac) — $\text{III}_T(t)$

### Definición

El **tren de impulsos periódico** de período $T$ se define como:

$$\text{III}_T(t) = \sum_{n=-\infty}^{+\infty} \delta(t - nT)$$

También se escribe como $\delta_T(t)$ o $\operatorname{III}(t/T)/T$ en notación de Bracewell.

### Transformada de Fourier

$$\boxed{\mathcal{F}\!\left\{\text{III}_T(t)\right\}(\omega) = \frac{2\pi}{T}\sum_{k=-\infty}^{+\infty} \delta\!\left(\omega - \frac{2\pi k}{T}\right) = \omega_0\sum_{k=-\infty}^{+\infty}\delta(\omega - k\omega_0)}$$

donde $\omega_0 = 2\pi/T$ es la frecuencia fundamental del tren.

> **El tren de impulsos en frecuencia es otro tren de impulsos**, con espaciado $\omega_0 = 2\pi/T$. Relación inversa: compresión en tiempo ($T$ pequeño) → expansión en frecuencia (espaciado $\omega_0$ grande). Caso $T = 1$: $\mathcal{F}\{\text{III}_1(t)\} = 2\pi\,\text{III}_{2\pi}(\omega)$.

### Derivación

Como $\text{III}_T(t)$ es periódica con período $T$, se expande en serie de Fourier compleja:

$$\text{III}_T(t) = \frac{1}{T}\sum_{n=-\infty}^{+\infty} e^{in\omega_0 t}$$

Aplicando $\mathcal{F}\{e^{in\omega_0 t}\} = 2\pi\,\delta(\omega - n\omega_0)$ término a término:

$$\mathcal{F}\!\left\{\text{III}_T(t)\right\} = \frac{2\pi}{T}\sum_{n=-\infty}^{+\infty}\delta(\omega - n\omega_0) = \omega_0\sum_{n=-\infty}^{+\infty}\delta(\omega - n\omega_0)$$

### Tabla de pares relacionados

| # | $f(t)$ | $F(\omega)$ | Observaciones |
|---|--------|-------------|---------------|
| Sh-1 | $\displaystyle\sum_{n=-\infty}^{+\infty}\delta(t-nT)$ | $\dfrac{2\pi}{T}\displaystyle\sum_{k=-\infty}^{+\infty}\delta\!\left(\omega-\dfrac{2\pi k}{T}\right)$ | tren estándar de período $T$ |
| Sh-2 | $\displaystyle\sum_{n=-\infty}^{+\infty}\delta(t-nT-t_0)$ | $e^{-i\omega t_0}\dfrac{2\pi}{T}\displaystyle\sum_{k=-\infty}^{+\infty}\delta\!\left(\omega-\dfrac{2\pi k}{T}\right)$ | tren desplazado por $t_0$ |
| Sh-3 | $x(t)\cdot\text{III}_T(t)$ | $\dfrac{1}{T}\displaystyle\sum_{k=-\infty}^{+\infty} X\!\left(\omega-\dfrac{2\pi k}{T}\right)$ | muestreo ideal de $x(t)$ |

### Conexión con el muestreo y la DFT

El par Sh-3 es la base matemática del **teorema de muestreo de Nyquist-Shannon**: multiplicar $x(t)$ por $\text{III}_T(t)$ replica el espectro $X(\omega)$ cada $\omega_0 = 2\pi/T$ rad/s. Si $X(\omega) = 0$ para $|\omega| > \omega_0/2$, las réplicas no se solapan y $x(t)$ puede reconstruirse perfectamente.

La DFT (sección I.6) es la versión discreta y finita de esta relación.

### Estado de implementación

> El tren de impulsos **no está soportado** como entrada en el motor de transformadas. La razón es que $\text{III}_T(t)$ involucra una suma infinita de deltas que Maxima no puede representar ni integrar simbólicamente de forma finita. El resultado sería otra suma infinita de deltas en $\omega$, que tampoco tiene representación cerrada para el renderizador LaTeX actual.
>
> **Cómo calcularlo manualmente:** usar la fórmula Sh-1 directamente. Para un tren finito de $N$ impulsos (ventana rectangular), el resultado sí es computable: $\sum_{n=0}^{N-1}\delta(t-nT) \to e^{-i\omega(N-1)T/2}\dfrac{\sin(N\omega T/2)}{\sin(\omega T/2)}$.

---

## 34. FT de señales causales polinómicas $k \cdot t^n \cdot u(t)$ sin decaimiento exponencial

### Motivación

Los pares #17–19 de la tabla de exponenciales causales cubren $k\,t^n\,e^{-at}\,u(t)$ con $a > 0$. Cuando se elimina el factor de decaimiento ($a = 0$), las funciones resultantes —rampa, parábola, etc.— son causales pero **no integrables en $L^1(\mathbb{R})$**, por lo que su transformada solo existe en sentido distribucional.

### Derivación distribucional

Partiendo de la identidad $u(t) \to \pi\,\delta(\omega) + \tfrac{1}{i\omega}$ y aplicando la propiedad de multiplicación por $t$ (diferenciación en frecuencia):

$$\mathcal{F}\{t^n\,f(t)\} = i^n\,F^{(n)}(\omega)$$

se obtiene para $n \geq 1$:

$$\mathcal{F}\{t^n\,u(t)\} = i^n\,\frac{d^n}{d\omega^n}\!\left[\pi\,\delta(\omega) + \frac{1}{i\omega}\right]$$

usando $\dfrac{d^n}{d\omega^n}\delta(\omega) = \delta^{(n)}(\omega)$ y $\dfrac{d^n}{d\omega^n}\dfrac{1}{i\omega} = \dfrac{(-1)^n\,n!}{i\,\omega^{n+1}}$:

$$\mathcal{F}\{t^n\,u(t)\} = i^n\,\pi\,\delta^{(n)}(\omega) + \frac{(-1)^n\,n!\,i^n}{i\,\omega^{n+1}} = i^n\,\pi\,\delta^{(n)}(\omega) + \frac{i^{n-1}\,(-1)^n\,n!}{\omega^{n+1}}$$

### Tabla de pares

| # | $f(t)$ | $F(\omega) = \mathcal{F}\{f(t)\}$ | Condiciones |
|---|--------|-------------------------------------|-------------|
| P-1 | $k\,u(t)$ | $k\!\left(\pi\,\delta(\omega) + \dfrac{1}{i\omega}\right)$ | par #10 ya en tabla |
| P-2 | $k\,t\,u(t)$ (rampa) | $k\!\left(i\pi\,\delta'(\omega) - \dfrac{1}{\omega^2}\right)$ | $\delta'$ = derivada de la delta |
| P-3 | $k\,t^2\,u(t)$ (parábola) | $k\!\left(-\pi\,\delta''(\omega) + \dfrac{2i}{\omega^3}\right)$ | $\delta''$ = segunda derivada |
| P-4 | $k\,t^n\,u(t)$ (general) | $k\!\left(i^n\,\pi\,\delta^{(n)}(\omega) + \dfrac{i^{n-1}(-1)^n\,n!}{\omega^{n+1}}\right)$ | $n \geq 1$ entero, V.P. en $1/\omega^{n+1}$ |

> **Nota de convención:** el par P-1 coincide exactamente con el par #10 ya documentado.
> $\delta^{(n)}(\omega)$ es la $n$-ésima derivada distribucional de la delta de Dirac; no es numéricamente evaluable.

### Propiedades importantes

**Valor principal en $1/\omega^{n+1}$:** el término racional es singular en $\omega = 0$ y debe interpretarse como valor principal de Cauchy, análogamente a los pares #15–16.

**Condiciones de existencia distribucional:** $t^n\,u(t)$ pertenece al espacio de distribuciones temperadas $\mathcal{S}'$, por lo que su transformada existe en ese espacio. Sin embargo, **no existe como función ordinaria** ni como elemento de $L^1$ o $L^2$.

**Por qué el integrador falla:** `integrate(t^n * exp(-iωt), t, 0, inf)` diverge para $a = 0$. Maxima devuelve `limit` o falla silenciosamente. Esta familia solo puede calcularse correctamente vía la tabla de patrones, no por integración directa.

### Limitación de implementación actual

> **Estado:** los pares P-2 a P-4 **no están implementados** como patrones en `FT_pattern_lookup`. Si el usuario ingresa `t*u(t)` o `t^2*u(t)`, el motor cae al integrador numérico y reporta `exists: false` o timeout.
>
> La razón técnica es que los resultados contienen $\delta^{(n)}(\omega)$, que Maxima representa como `diff(delta(w), w, n)` — un árbol de expresión no soportado por el renderer LaTeX actual.
>
> **Punto de extensión:** implementar `FT_match_tnu(expr, t_var)` que detecte $k\,t^n\,u(t)$ (sin factor exponencial) y devuelva la expresión con `diff(delta(w_var), w_var, n)`. Requiere extender `texput` para renderizar $\delta^{(n)}$ correctamente.

---

## 35. Potencias de tri — extensión para $n > 4$

### El problema

La tabla de la sección 30 cubre `tri(t)^n` para $n = 2, 3, 4$ con fórmulas cerradas derivadas por integración directa. Para $n \geq 5$ **no existe una fórmula general de forma cerrada** análoga a la B-spline de sinc.

### Por qué no hay fórmula general

La FT de $\text{sinc}^n(t)$ produce una B-spline (suma uniforme con $\text{sgn}$) porque la convolución de $n$ funciones rect en frecuencia preserva la estructura polinómica por tramos. La FT de $\text{tri}^n(t)$ requiere la convolución de $n$ espectros triangulares, que produce funciones **B-spline de orden $2n$** en frecuencia, con coeficientes que alternan entre $\sin$ y $\cos$ de múltiplos de $\omega$; no hay suma uniforme.

Para cada $n$ par la FT de $\text{tri}^n$ contiene solo senos; para $n$ impar solo cosenos. El patrón se puede verificar:

| $n$ | Tipo | Fórmula $R_n(\omega/a) \cdot a$ |
|---|---|---|
| 2 | sin | $4(u - \sin u)/u^3$ |
| 3 | cos | $2(3u^2 + 6\cos u - 6)/u^4$ |
| 4 | sin | $8(u^3 + 6\sin u - 6u)/u^5$ |
| 5 | cos | $?$ — requiere derivación |
| 6 | sin | $?$ — requiere derivación |

donde $u = \omega/a$.

### Fórmula general para $n \geq 2$ (integración por partes iterada)

La FT de $k\,\text{tri}(at)^n$ puede expresarse en términos de la convolución n-fold del espectro triangular. Para cada $n$ se puede derivar aplicando integración por partes $n$ veces:

$$\mathcal{F}\{k\,\text{tri}(at)^n\}(\omega) = \frac{k}{a} \cdot R_n\!\left(\frac{\omega}{a}\right)$$

donde $R_n(u)$ satisface la recurrencia:

$$R_n(u) = \frac{n}{u}\,R_{n-1}(u) - \frac{n(n-1)}{u^2}\,\int_0^u R_{n-2}(s)\,ds$$

con condiciones iniciales $R_1(u) = 2(1-\cos u)/u^2$ y $R_2(u) = 4(u - \sin u)/u^3$.

> Esta recurrencia no produce una suma uniforme tipo B-spline porque la integral acumula términos mixtos sin/cos de distintos órdenes.

### Casos $n = 5$ y $n = 6$ derivados analíticamente

Aplicando la recurrencia o integración directa sobre el soporte $[-1,1]$:

| $n$ | $R_n(u) \cdot a$ (con $u = \omega/a$) |
|---|---|
| 5 | $2(15u^2 - 24 - (u^4 - 12)\cos u - 12u\sin u) / u^6$ |
| 6 | $4(u^5 - 20u^3 + (60u - u^5 + 20u^3)\cos... )/ u^7$ — expresión extensa |

> **Estado de implementación:** `FT_tripow_formula` retorna `false` para $n > 4$, lo que hace caer al integrador. Para $n = 5, 6$ el integrador de Maxima puede resolverlo eventualmente en función de la forma exacta; para $n \geq 7$ el timeout es probable.
>
> **Punto de extensión:** agregar los casos $n = 5$ y $n = 6$ como ramas adicionales en `FT_tripow_formula`. Verificar con Maxima: `integrate(tri(t)^5 * exp(-i*w*t), t, -1, 1)` y comparar con la recurrencia.

### IFT de $\text{tri}(\omega)^n$ para $n > 4$

Por la misma dualidad de la sección 30, la IFT hereda el límite:

$$\mathcal{F}^{-1}\{\text{tri}(\omega)^n\}(t) = \frac{1}{2\pi}\,\text{FT}[\text{tri}^n]\big|_{\omega \to t}$$

lo que significa que extender `FT_tripow_formula` cubre automáticamente ambas direcciones.

---

## 36. IFT de $k/\omega^n$ — polo de orden $n$ en el origen (valor principal de Cauchy)

### Motivación

Los pares #38 y #38b cubren $k/(i\omega)$ (primer orden). Para potencias $n \geq 2$ la singularidad en $\omega = 0$ es de orden superior y su transformada inversa requiere un tratamiento distribucional basado en el valor principal de Cauchy.

### Fórmula general

$$\boxed{\mathcal{F}^{-1}\!\left\{\frac{k}{\omega^n}\right\}(t) = \begin{cases} \dfrac{k\,i^n}{2\,(n-1)!}\,|t|^{n-1} & n \text{ par} \\[8pt] \dfrac{k\,i^n}{2\,(n-1)!}\,|t|^{n-1}\,\operatorname{sgn}(t) & n \text{ impar} \end{cases}, \qquad n \geq 1 \text{ entero}}$$

> **Convención**: valor principal de Cauchy en la integral inversa. El resultado es una distribución temperada para todo $n \geq 1$.

**Verificación para $n = 1$** (par #38): $i^1/(2 \cdot 0!) \cdot \operatorname{sgn}(t) = i\,\operatorname{sgn}(t)/2$, que es exactamente $\mathcal{F}^{-1}\{1/\omega\}$.

**Verificación para $n = 2$** (par #49 invertido): $i^2/(2 \cdot 1!) \cdot |t| = -|t|/2$, que coincide con la derivación directa.

**Derivación** (propiedad de diferenciación en frecuencia): partiendo de $\mathcal{F}^{-1}\{1/\omega\} = i\,\operatorname{sgn}(t)/2$ y usando la propiedad $\mathcal{F}^{-1}\{F'(\omega)\}(t) = -it\,f(t)$:

$$\mathcal{F}^{-1}\!\left\{\frac{d}{d\omega}\frac{1}{\omega^{n-1}}\right\} = \mathcal{F}^{-1}\!\left\{\frac{-(n-1)}{\omega^n}\right\} = -it\,\mathcal{F}^{-1}\!\left\{\frac{1}{\omega^{n-1}}\right\}$$

que conduce a la recurrencia $\mathcal{F}^{-1}\{1/\omega^n\} = \frac{-it}{n-1}\,\mathcal{F}^{-1}\{1/\omega^{n-1}\}$. Aplicada desde $n=1$ produce la fórmula par/impar de la caja.

### Tabla de casos

| $n$ | $\mathcal{F}^{-1}\{k/\omega^n\}$ | Paridad |
|-----|-----------------------------------|---------|
| 1 | $\dfrac{ki}{2}\,\operatorname{sgn}(t)$ | impar |
| 2 | $-\dfrac{k}{2}\,|t|$ | par |
| 3 | $-\dfrac{ki}{4}\,t^2\,\operatorname{sgn}(t)$ | impar |
| 4 | $\dfrac{k}{12}\,t^2\,|t|$ | par |
| 5 | $\dfrac{ki}{48}\,t^4\,\operatorname{sgn}(t)$ | impar |
| 6 | $-\dfrac{k}{240}\,t^4\,|t|$ | par |
| $n$ par | $\dfrac{k\,i^n}{2(n-1)!}\,|t|^{n-1}$ | — |
| $n$ impar | $\dfrac{k\,i^n}{2(n-1)!}\,|t|^{n-1}\,\operatorname{sgn}(t)$ | — |

> **Patrón**: $n$ par → resultado par (solo $|t|^{n-1}$); $n$ impar → resultado impar (lleva $\operatorname{sgn}(t)$).

### Variante desplazada en tiempo

$$\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-i\omega t_0}}{\omega^n}\right\}(t) = \mathcal{F}^{-1}\!\left\{\frac{k}{\omega^n}\right\}(t - t_0)$$

El detector en `IFT_pattern_lookup` extrae el exponencial y aplica el desplazamiento sobre el resultado base.

### Implementación

Handler `k/wⁿ` en `fourier_transforms.mac` (dentro de `IFT_pattern_lookup`):
- Prueba $n = 2, 3, \ldots, 12$ en bucle via `ratsimp(e * w_var^n)`
- Si `freeof(w_var, k·wⁿ)` y el producto es no nulo, identifica $n$ y $k$
- Resultado: `ratsimp(k * iⁿ/(2*(n-1)!) * |t|^{n-1} * (sgn(t) si n impar))`
- Variante desplazada: detecta además factor $e^{-i\omega t_0}$ en el numerador y aplica shift
- Límite actual: $n \leq 12$ (suficiente para uso práctico; extensible aumentando el límite del bucle)

**Combinación con fracciones parciales:** la familia $1/(\omega^n(i\omega+a))$ se resuelve automáticamente via `partfrac`:

$$\frac{1}{\omega^2(i\omega+a)} = \frac{1/a^2}{i\omega+a} - \frac{i/a}{\omega} + \frac{1/a}{\omega^2}$$

Cada término tiene su handler propio y la linealidad los combina.

---

## 37. Familia $k/[( i\omega+a)(i\omega+b)]$ — dos polos reales simples

### Motivación

El handler de fracciones parciales (sección 16) cubre automáticamente este caso. Sin embargo, es útil documentar la forma cerrada explícita ya que es uno de los resultados más frecuentes en circuitos RC y sistemas de primer orden en serie.

### Fórmula

Para $a \neq b$, $a, b > 0$:

$$\boxed{\mathcal{F}^{-1}\!\left\{\frac{k}{(i\omega+a)(i\omega+b)}\right\}(t) = \frac{k}{b-a}\!\left(e^{-at} - e^{-bt}\right)u(t)}$$

**Derivación** por fracciones parciales:

$$\frac{1}{(i\omega+a)(i\omega+b)} = \frac{1}{b-a}\!\left(\frac{1}{i\omega+a} - \frac{1}{i\omega+b}\right)$$

Aplicando el par #40 ($k/(i\omega+a) \to k\,e^{-at}u(t)$) a cada término:

$$\mathcal{F}^{-1}\{\cdot\} = \frac{k}{b-a}\left(e^{-at} - e^{-bt}\right)u(t)$$

### Tabla de variantes

| $F(\omega)$ | $f(t)$ | Condiciones |
|-------------|---------|-------------|
| $\dfrac{k}{(i\omega+a)(i\omega+b)}$ | $\dfrac{k}{b-a}(e^{-at}-e^{-bt})u(t)$ | $a\neq b$, $a,b>0$ |
| $\dfrac{k}{(i\omega+a)^2}$ | $k\,t\,e^{-at}\,u(t)$ | polo doble, par #41 |
| $\dfrac{k}{i\omega^2+4i\omega+3}$ | mismo que $(i\omega+1)(i\omega+3)$ | denominador expandido |
| $\dfrac{k}{(i\omega+1)(i\omega+3)}$ | $\dfrac{k}{2}(e^{-t}-e^{-3t})u(t)$ | $a=1, b=3$ |
| $\dfrac{k}{(i\omega+1)(i\omega+5)}$ | $\dfrac{k}{4}(e^{-t}-e^{-5t})u(t)$ | $a=1, b=5$ |

> **Denominador como polinomio:** $-\omega^2 + 4i\omega + 3 = (i\omega+1)(i\omega+3)$. El handler `partfrac` de Maxima lo factoriza automáticamente antes de aplicar los patrones.

### Nota sobre convención Wolfram vs. ingeniería

Wolfram Alpha usa la convención simétrica con factor $1/\sqrt{2\pi}$ en ambas direcciones. Para $1/((i\omega+1)(i\omega+3))$ Wolfram da $e^{-3t}/(2\sqrt{2\pi}) - e^{-t}/(2\sqrt{2\pi})$ (para $t > 0$), que con el factor de escala de la convención de ingeniería se convierte en $\frac{1}{2}(e^{-t}-e^{-3t})u(t)$. El signo de la diferencia depende del orden de los polos — ambas formas son equivalentes.

### Implementación

Resuelto completamente por el handler `partfrac` (sección 16, par #56). No hay handler directo para este patrón; la descomposición en fracciones simples más el par #40 cubre toda la familia.

---

## 38. BUG-4 — detección fiable de `exists` en IFT

### El problema (heurística rota)

Antes de la corrección, el campo `exists` en la respuesta del backend se calculaba con la heurística:

```typescript
exists: fPosMaxima !== "" || fNegMaxima !== ""
```

Esta heurística marcaba `exists = true` cuando Maxima devolvía una integral sin evaluar (p.ej. `integrate(exp(w^2)*exp(i*w*t), w, -inf, inf)`), porque el string no era vacío aunque no fuera una forma cerrada.

### Solución: sentinel `__IFT_EXISTS__`

El script Maxima `inverse_fourier_transform.mac` emite explícitamente el sentinel antes de los datos:

```maxima
print("__IFT_EXISTS__")$
print(string(is(
    (has_combined or f_pos # false or f_neg # false)
    and freeof('integrate, f_combined)
    and freeof('integrate, f_pos)
    and freeof('integrate, f_neg))))$
```

El servicio TypeScript lee `iftExists` entre los sentinels `__IFT_EXISTS__` y `__F_POS_MAXIMA__` y lo usa directamente:

```typescript
const iftExists =
  this.extractBetween(raw, "__IFT_EXISTS__", "__F_POS_MAXIMA__").trim() === "true";
// ...
exists: iftExists
```

### Condiciones para `exists = true`

Todas deben cumplirse simultáneamente:

1. Al menos un resultado no es `false`: `has_combined OR f_pos ≠ false OR f_neg ≠ false`
2. El resultado combinado no contiene integrales sin evaluar: `freeof('integrate, f_combined)`
3. Las partes positiva y negativa tampoco: `freeof('integrate, f_pos) AND freeof('integrate, f_neg)`

> La condición `freeof('integrate, ...)` es la clave: Maxima puede devolver una expresión de la forma `integrate(g(w)*exp(i*t*w), w, -inf, inf)` cuando no sabe cómo resolver la integral, y esa expresión es no vacía aunque no sea una forma cerrada.

### Casos de regresión

| Test | Entrada | `exists` esperado | Motivo |
|------|---------|-------------------|--------|
| BG04a | $e^{\omega^2}$ | `false` | Maxima devuelve integral sin evaluar |
| BG04b | $1/\log(1+\omega^2)$ | `false` | Sin patrón tabla; integral no resuelta |
| PF04 | $1/\omega^2$ | `true` | Patrón `k/wⁿ` con $n=2$: $-|t|/2$ |
| KX04 | $1/(\omega^2(i\omega+1))$ | `true` | Partfrac + patrón `k/wⁿ`: $\text{sgn}(t)/2 - |t|/2 - e^{-t}u(t)$ |