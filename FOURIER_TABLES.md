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

---

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
