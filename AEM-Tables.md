# Tablas de la Transformada de Fourier

> Tabla de referencia matemática — pares y propiedades de la Transformada Continua de Fourier.
> Organizada por familia de función: cada bloque muestra el par **base** y luego sus
> variantes (desplazada, escalada, modulada, con potencia) derivadas aplicando las
> propiedades de la Sección 1. Si una fila no aparece explícitamente, probablemente
> se obtiene combinando un par base de este documento con una propiedad de la tabla 1.

---

## Convención

$$F(\omega) = \mathcal{F}\{f(t)\} = \int_{-\infty}^{\infty} f(t)\, e^{-i\omega t}\, dt$$

$$f(t) = \mathcal{F}^{-1}\{F(\omega)\} = \frac{1}{2\pi} \int_{-\infty}^{\infty} F(\omega)\, e^{i\omega t}\, d\omega$$

> **Convención de ingeniería**: factor $1$ en la FT directa, factor $1/(2\pi)$ en la inversa.
> **Parámetros**: salvo que se indique lo contrario, $a, b > 0$ son reales, $k$ es una constante
> (real o compleja), $n \geq 1$ entero, $t_0, \omega_0 \in \mathbb{R}$.

---

## 1. Propiedades — el "álgebra" de la tabla

Toda fila de las secciones siguientes que agregue un desplazamiento, escalado o modulación
a un par base es una **aplicación directa** de una de estas filas. Antes de buscar un par
"nuevo", comprobar si ya es consecuencia de una propiedad sobre un par existente.

| Propiedad                          | $f(t)$                                                  | $F(\omega)$                                                                      |
| ----------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Linealidad                          | $\alpha f(t) + \beta g(t)$                              | $\alpha F(\omega) + \beta G(\omega)$                                             |
| Escalar                             | $k \cdot f(t)$                                          | $k \cdot F(\omega)$                                                              |
| **Desplazamiento en tiempo**        | $f(t - t_0)$                                            | $e^{-i\omega t_0}\, F(\omega)$                                                     |
| **Desplazamiento en frecuencia** (modulación exponencial) | $e^{i\omega_0 t}\, f(t)$                 | $F(\omega - \omega_0)$                                                           |
| Escalado en tiempo                  | $f(at)$                                                 | $\dfrac{1}{\lvert a \rvert}\, F\!\left(\dfrac{\omega}{a}\right)$                  |
| Conjugado                           | $f^*(t)$                                                | $F^*(-\omega)$                                                                   |
| Dualidad                            | $F(t)$                                                  | $2\pi\, f(-\omega)$                                                                |
| Diferenciación en tiempo            | $f^{(n)}(t)$                                            | $(i\omega)^n\, F(\omega)$                                                         |
| **Diferenciación en frecuencia** (multiplicación por $t^n$) | $t^n\, f(t)$                             | $i^n\, F^{(n)}(\omega)$                                                           |
| Convolución en tiempo               | $(f * g)(t)$                                            | $F(\omega)\cdot G(\omega)$                                                       |
| Convolución en frecuencia (producto)| $f(t)\cdot g(t)$                                        | $\dfrac{1}{2\pi}(F * G)(\omega)$                                                 |
| **Modulación por coseno**           | $\cos(bt)\, f(t)$                                       | $\dfrac{F(\omega-b) + F(\omega+b)}{2}$                                           |
| **Modulación por seno**             | $\sin(bt)\, f(t)$                                       | $\dfrac{F(\omega-b) - F(\omega+b)}{2i}$                                          |
| Modulación por coseno (dual, en $F$)| $\dfrac{f(t+b) + f(t-b)}{2}$                            | $\cos(b\omega)\, F(\omega)$                                                       |
| Modulación por seno (dual, en $F$)  | $\dfrac{f(t+b) - f(t-b)}{2i}$                           | $\sin(b\omega)\, F(\omega)$                                                       |
| Parseval                            | $\displaystyle\int_{\mathbb{R}} \lvert f(t)\rvert^2 dt$ | $\dfrac{1}{2\pi}\displaystyle\int_{\mathbb{R}} \lvert F(\omega)\rvert^2 d\omega$ |

**Identidades auxiliares:**

$$e^{i\omega_0 t} = \cos(\omega_0 t) + i\sin(\omega_0 t), \qquad \cos(\omega_0 t) = \frac{e^{i\omega_0 t}+e^{-i\omega_0 t}}{2}, \qquad \sin(\omega_0 t) = \frac{e^{i\omega_0 t}-e^{-i\omega_0 t}}{2i}$$

$$\int_{-\infty}^{\infty}\delta(t-a)f(t)\,dt = f(a), \qquad \text{sgn}(t)=2u(t)-1,\qquad u(t)=\frac{1+\text{sgn}(t)}{2}$$

$$\frac{d}{dt}u(t)=\delta(t), \qquad \frac{d}{dt}\text{sgn}(t)=2\delta(t)$$

---

## 2. Impulsos, constantes y exponenciales complejas

Familia base: $\delta(t)$ y $e^{i\omega_0 t}$. Todo lo demás en este bloque es
desplazamiento en tiempo o frecuencia sobre estos dos pares.

| $f(t)$                     | $F(\omega)$                                                        | Obtenido de                          | Condiciones |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------- | ----------- |
| $\delta(t)$                | $1$                                                                   | base                                 |             |
| $\delta(t-a)$               | $e^{-i\omega a}$                                                      | shift en tiempo sobre $\delta(t)$    |             |
| $1$                        | $2\pi\,\delta(\omega)$                                                | dualidad de $\delta(t)\to 1$         |             |
| $c$ (constante)             | $2\pi c\,\delta(\omega)$                                              | escalar sobre fila anterior          |             |
| $e^{i\omega_0 t}$          | $2\pi\,\delta(\omega-\omega_0)$                                       | shift en frecuencia sobre $1$        |             |
| $\cos(\omega_0 t)$          | $\pi[\delta(\omega-\omega_0)+\delta(\omega+\omega_0)]$                | Euler sobre fila anterior             |             |
| $\sin(\omega_0 t)$          | $-i\pi[\delta(\omega-\omega_0)-\delta(\omega+\omega_0)]$              | Euler sobre fila anterior             |             |
| $\cos(\omega_0 t+\theta)$   | $\pi[e^{i\theta}\delta(\omega-\omega_0)+e^{-i\theta}\delta(\omega+\omega_0)]$ | fase sobre $\cos(\omega_0 t)$  |             |
| $\sin(\omega_0 t+\theta)$   | $-i\pi[e^{i\theta}\delta(\omega-\omega_0)-e^{-i\theta}\delta(\omega+\omega_0)]$ | fase sobre $\sin(\omega_0 t)$ |             |
| $\cos(b\,\omega)$ *(par IFT dual)* | $\dfrac{\delta(t+b)+\delta(t-b)}{2}$                           | dual distribucional de $\cos(\omega_0 t)$ | $b \in \mathbb{R}$ |
| $\sin(b\,\omega)$ *(par IFT dual)* | $\dfrac{i}{2}[\delta(t-b)-\delta(t+b)]$                        | dual distribucional de $\sin(\omega_0 t)$ | $b \in \mathbb{R}$ |
| $A\cos(b\omega+\theta)$ *(IFT dual)* | $\dfrac{A}{2}[e^{i\theta}\delta(t+b)+e^{-i\theta}\delta(t-b)]$ | generaliza fila anterior              | $A,b,\theta\in\mathbb{R}$ |
| $A\sin(b\omega+\theta)$ *(IFT dual)* | $\dfrac{A}{2i}[e^{i\theta}\delta(t+b)-e^{-i\theta}\delta(t-b)]$ | generaliza fila anterior              | $A,b,\theta\in\mathbb{R}$ |

### Potencias de seno/coseno — reducción trigonométrica

$\sin^n(\omega_0 t)$ y $\cos^n(\omega_0 t)$ se reducen a sumas de $\sin(m\omega_0 t)$, $\cos(m\omega_0 t)$
(identidad de reducción de potencias) y luego cada término usa las filas de arriba.

$$\sin^n(\omega_0 t) = \begin{cases} \dfrac{1}{2^n}\dbinom{n}{n/2} + \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{n/2-1}(-1)^{n/2-k}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ par} \\[10pt] \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{(n-1)/2}(-1)^{(n-1)/2-k}\dbinom{n}{k}\sin\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ impar} \end{cases}$$

$$\cos^n(\omega_0 t) = \begin{cases} \dfrac{1}{2^n}\dbinom{n}{n/2} + \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{n/2-1}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ par} \\[10pt] \dfrac{2}{2^n}\displaystyle\sum_{k=0}^{(n-1)/2}\dbinom{n}{k}\cos\!\bigl((n-2k)\omega_0 t\bigr) & n \text{ impar} \end{cases}$$

**Casos explícitos** ($\omega_0=1$):

| $f(t)$ | $F(\omega)$ |
| ------- | ----------- |
| $\sin^2(t)$ | $\dfrac{\pi}{2}[2\delta(\omega)-\delta(\omega-2)-\delta(\omega+2)]$ |
| $\cos^2(t)$ | $\dfrac{\pi}{2}[\delta(\omega-2)+2\delta(\omega)+\delta(\omega+2)]$ |
| $\sin^3(t)$ | $\dfrac{i\pi}{4}[3\delta(\omega+1)-3\delta(\omega-1)-\delta(\omega+3)+\delta(\omega-3)]$ |
| $\cos^3(t)$ | $\dfrac{\pi}{4}[3\delta(\omega-1)+3\delta(\omega+1)+\delta(\omega-3)+\delta(\omega+3)]$ |

> **Paridad:** $\sin^n$ con $n$ par → solo cosenos (más DC). $\sin^n$ con $n$ impar → solo senos
> (sin DC). $\cos^n$ → siempre solo cosenos.

---

## 3. Escalón, signo y su familia racional

Familia base: $u(t)$ y $\text{sgn}(t)$.

| $f(t)$                     | $F(\omega)$                                                              | Obtenido de                            | Condiciones |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| $u(t)$                      | $\pi\,\delta(\omega)+\dfrac{1}{i\omega}$                                    | base                                     |             |
| $u(t-t_0)$                  | $\left(\pi\delta(\omega)+\dfrac{1}{i\omega}\right)e^{-i\omega t_0}$          | shift en tiempo                          |             |
| $u(-t)$                     | $\pi\,\delta(\omega)+\dfrac{i}{\omega}$                                     | reflexión temporal de $u(t)$             |             |
| $k\,u(t_0-t)$               | $k\left(\pi\delta(\omega)-\dfrac{e^{-i\omega t_0}}{i\omega}\right)$          | reflexión + shift; $u(t_0-t)=u(-(t-t_0))$ |             |
| $\text{sgn}(t)$             | $\dfrac{2}{i\omega}$                                                        | $2u(t)-1$                                |             |
| $k\,\text{sgn}(t-t_0)$      | $\dfrac{2k\,e^{-i\omega t_0}}{i\omega}$                                     | shift en tiempo                          | $t_0\neq 0$ |
| $\dfrac{\sin(at)}{\pi t}$   | $u(\omega+a)-u(\omega-a)$                                                    | dualidad (rect en frecuencia)            |             |
| $k\,[u(\omega+a)-u(\omega-a)]$ *(IFT)* | $\dfrac{k\sin(at)}{\pi t}$                                        | par dual de la fila anterior             |             |

### Cocientes $k/t^n$ (valor principal de Cauchy)

$$\mathcal{F}\!\left\{\frac{k}{t^n}\right\} \stackrel{\text{V.P.}}{=} \frac{k\,(-i\omega)^{n-1}}{(n-1)!}\cdot(-i\pi\,\text{sgn}(\omega)), \qquad n\geq 1 \text{ entero}$$

| $f(t)$ | $F(\omega)$ | Nota |
| ------- | ----------- | ---- |
| $k/t$   | $-ik\pi\,\text{sgn}(\omega)$ | base ($n=1$) |
| $k/(ct)$ | $-\dfrac{ik\pi}{c}\text{sgn}(\omega)$ | escalar, $c\neq0$ |
| $k/t^2$ | $-k\pi\omega\,\text{sgn}(\omega)$ | $n=2$ |
| $k/t^3$ | $\dfrac{ik\pi\omega^2}{2}\text{sgn}(\omega)$ | $n=3$ |
| $k/(t-a)^n$ | $e^{-i\omega a}\cdot\dfrac{k(-i\omega)^{n-1}}{(n-1)!}(-i\pi\,\text{sgn}(\omega))$ | shift en tiempo, $a\neq0$ |
| $k\,u(t-a)/t$ | $k\left[-\text{Ci}(a\lvert\omega\rvert)-i\,\text{sgn}(\omega)\left(\dfrac{\pi}{2}-\text{Si}(a\lvert\omega\rvert)\right)\right]$ | $a>0$; vía $\int_a^\infty\cos(\omega t)/t\,dt=-\text{Ci}(a\omega)$, $\int_a^\infty\sin(\omega t)/t\,dt=\pi/2-\text{Si}(a\omega)$ |
| $k\,u(\lvert t\rvert-a)/\lvert t\rvert$ (par, hueco central) | $-2k\,\text{Ci}(a\lvert\omega\rvert)$ | $a>0$; distinto del anterior — el espejo en $t<-a$ cancela la parte impar Si/sgn, dejando transformada real y par pura |

### Potencias bilaterales $|t|^\alpha$, $\alpha$ no entero (generaliza $k/t^n$ y $k|t|^{n-1}$ a exponente real)

$$\mathcal{F}\{k\,|t|^\alpha\} = \frac{-2k\sin(\alpha\pi/2)\,\Gamma(\alpha+1)}{|\omega|^{\alpha+1}}, \qquad \mathcal{F}\{k\,|t|^\alpha\,\text{sgn}(t)\} = \frac{-2ik\cos(\alpha\pi/2)\,\Gamma(\alpha+1)\,\text{sgn}(\omega)}{|\omega|^{\alpha+1}}, \qquad \alpha>-1$$

| $f(t)$ | $F(\omega)$ | Nota |
| ------- | ----------- | ---- |
| $|t|^{-1/2}$ | $\sqrt{2\pi/|\omega|}$ | caso clásico, $\alpha=-1/2$ |
| $|t|^{1/3}$ | $-2\sin(\pi/6)\,\Gamma(4/3)/|\omega|^{4/3}$ | $\alpha=1/3$ |
| $|t|^\alpha\,\text{sgn}(t)$, $\alpha=1/3$ | $-2i\cos(\pi/6)\,\Gamma(4/3)\,\text{sgn}(\omega)/|\omega|^{4/3}$ | versión impar |

> Para $\alpha$ entero par no negativo, Maxima reduce $|t|^\alpha$ a $t^\alpha$ (polinomio puro,
> sin singularidad), que se transforma por derivadas de $\delta(\omega)$ (Sección 4). Esta
> familia solo aplica a $\alpha$ no entero (o entero negativo vía el bloque anterior).

### IFT — cocientes $k/\omega^n$ (dual del bloque anterior)

$$\mathcal{F}^{-1}\!\left\{\frac{k}{\omega^n}\right\}(t) = \begin{cases}\dfrac{k\,i^n}{2(n-1)!}\,|t|^{n-1} & n\text{ par}\\[6pt]\dfrac{k\,i^n}{2(n-1)!}\,|t|^{n-1}\text{sgn}(t) & n\text{ impar}\end{cases}, \qquad n\geq1\text{ entero}$$

| $n$ | $f(t)=\mathcal{F}^{-1}\{k/\omega^n\}$ |
| --- | -------------------------------------- |
| 1   | $\dfrac{ki}{2}\text{sgn}(t)$ |
| 2   | $-\dfrac{k}{2}|t|$ |
| 3   | $-\dfrac{ki}{4}t^2\text{sgn}(t)$ |
| 4   | $\dfrac{k}{12}t^2|t|$ |

Con desplazamiento: $\mathcal{F}^{-1}\{k\,e^{-i\omega t_0}/\omega^n\}(t) = \mathcal{F}^{-1}\{k/\omega^n\}(t-t_0)$.

### IFT de $\dfrac{k}{i\omega}$ y variantes

| $F(\omega)$ | $f(t)$ | Obtenido de |
| ----------- | ------ | ----------- |
| $\dfrac{k}{i\omega}$ | $\dfrac{k}{2}\text{sgn}(t)$ | dual de $\text{sgn}(t)$ |
| $\dfrac{k\,e^{-i\omega t_0}}{i\omega}$ | $\dfrac{k}{2}\text{sgn}(t-t_0)$ | shift en tiempo |
| $\pi\delta(\omega)+\dfrac{1}{i\omega}$ | $u(t)$ | dual de $u(t)$ |
| $\dfrac{k}{\omega(i\omega+a)}$ | $\dfrac{ik}{a}\!\left(\dfrac{\text{sgn}(t)}{2}-e^{-at}u(t)\right)$ | fracciones parciales: $1/(a)\cdot1/\omega - i/(a)\cdot1/(i\omega+a)$ |

### Función bilateral impar $k\omega/(a^2+\omega^2)$

Se obtiene de la exponencial bilateral (Sección 5) vía derivada en frecuencia. Ver Sección 5.

---

## 4. Exponenciales causales — familia $e^{-at}u(t)$

Familia base: $k\,e^{-at}u(t)$. Todo lo demás es multiplicación por $t^n$ (derivada en $\omega$),
desplazamiento en tiempo, o modulación por $\sin/\cos$.

| $f(t)$                     | $F(\omega)$                                                        | Obtenido de                          | Condiciones |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------- | ----------- |
| $k\,e^{-at}u(t)$            | $\dfrac{k}{i\omega+a}$                                                  | base                                 | $a>0$       |
| $k\,e^{-at}u(t-t_0)$        | $\dfrac{k\,e^{-at_0}e^{-i\omega t_0}}{i\omega+a}$                       | shift en tiempo                       | $a>0,t_0\neq0$ |
| $k\,t\,e^{-at}u(t)$         | $\dfrac{k}{(i\omega+a)^2}$                                              | derivada en $\omega$ ($n=1$)          | $a>0$       |
| $k\,t^2 e^{-at}u(t)$        | $\dfrac{2k}{(i\omega+a)^3}$                                             | derivada en $\omega$ ($n=2$)          | $a>0$       |
| $k\,t^n e^{-at}u(t)$        | $\dfrac{k\,n!}{(i\omega+a)^{n+1}}$                                      | derivada en $\omega$, general         | $a>0,n\geq1$ |
| $k\,t^n e^{-at}u(t-t_0)$    | $k\,e^{-at_0}e^{-i\omega t_0}\displaystyle\sum_{j=0}^{n}\binom{n}{j}\dfrac{t_0^{n-j}j!}{(i\omega+a)^{j+1}}$ | shift en tiempo sobre fila anterior | $a>0,n\geq1$ |
| $k\,t^p e^{-at}u(t)$ ($p$ real) | $\dfrac{k\,\Gamma(p+1)}{(i\omega+a)^{p+1}}$                         | generaliza fila de $t^n$ a $p$ no entero vía $\Gamma$ | $a>0,p>-1$ |
| $\dfrac{\alpha^\nu t^{\nu-1}e^{-\alpha t}u(t)}{\Gamma(\nu)}$ (densidad Erlang/Gamma) | $\left(\dfrac{\alpha}{i\omega+\alpha}\right)^\nu$ | caso normalizado de la fila anterior, $p=\nu-1$ | $\alpha>0,\nu>0$ |
| $k\,e^{-at}\cos(bt)\,u(t)$  | $\dfrac{k(i\omega+a)}{(i\omega+a)^2+b^2}$                               | Euler / modulación                    | $a,b>0$     |
| $k\,e^{-at}\sin(bt)\,u(t)$  | $\dfrac{kb}{(i\omega+a)^2+b^2}$                                         | Euler / modulación                    | $a,b>0$     |
| $\sin(\omega_0 t)\,u(t)$    | $\dfrac{\omega_0}{\omega_0^2-\omega^2}+\dfrac{\pi}{2i}[\delta(\omega-\omega_0)-\delta(\omega+\omega_0)]$ | límite $a\to0$ de la fila anterior | $\omega_0>0$ |
| $\cos(\omega_0 t)\,u(t)$    | $\dfrac{i\omega}{\omega_0^2-\omega^2}+\dfrac{\pi}{2}[\delta(\omega-\omega_0)+\delta(\omega+\omega_0)]$ | límite $a\to0$ | $\omega_0>0$ |

### Potencias de seno/coseno moduladas: $e^{-at}\sin^n(bt)u(t)$, $e^{-at}\cos^n(bt)u(t)$

Se resuelven combinando la reducción trigonométrica de la Sección 2 con las dos filas
de modulación de arriba, término a término.

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $k\,e^{-at}\sin^2(bt)u(t)$ | $\dfrac{k}{2}\!\left[\dfrac{1}{i\omega+a}-\dfrac{i\omega+a}{(i\omega+a)^2+4b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\cos^2(bt)u(t)$ | $\dfrac{k}{2}\!\left[\dfrac{1}{i\omega+a}+\dfrac{i\omega+a}{(i\omega+a)^2+4b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\sin^3(bt)u(t)$ | $k\!\left[\dfrac{3b/4}{(i\omega+a)^2+b^2}-\dfrac{3b/4}{(i\omega+a)^2+9b^2}\right]$ | $a,b>0$ |
| $k\,e^{-at}\cos^3(bt)u(t)$ | $k\!\left[\dfrac{3(i\omega+a)/4}{(i\omega+a)^2+b^2}+\dfrac{i\omega+a}{4[(i\omega+a)^2+9b^2]}\right]$ | $a,b>0$ |

### Polo causal de orden $n$ — forma general (IFT)

$$\mathcal{F}^{-1}\!\left\{\frac{k}{(i\omega+a)^n}\right\} = \frac{k\,t^{n-1}}{(n-1)!}\,e^{-at}\,u(t), \qquad a>0,\;n\geq1$$

Con desplazamiento en tiempo:

$$\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-i\omega t_0}}{(i\omega+a)^n}\right\} = \frac{k\,(t-t_0)^{n-1}}{(n-1)!}\,e^{-a(t-t_0)}\,u(t-t_0)$$

**Generalización a orden $p$ no entero** (vía $\Gamma$, reemplaza $(n-1)!\to\Gamma(p)$):

$$\mathcal{F}^{-1}\!\left\{\frac{k}{(a+i\omega)^p}\right\} = \frac{k\,t^{p-1}}{\Gamma(p)}\,e^{-at}\,u(t), \qquad a>0,\;p>-1$$

Caso normalizado (par IFT de la densidad Erlang/Gamma):

$$\mathcal{F}^{-1}\!\left\{\left(\frac{\alpha}{a+i\omega}\right)^\nu\right\} = \frac{\alpha^\nu t^{\nu-1}e^{-\alpha t}u(t)}{\Gamma(\nu)}, \qquad \alpha>0,\;\nu>0$$

### Desplazamiento en frecuencia sobre polos causales

$$\mathcal{F}^{-1}\{F(\omega-\omega_0)\} = e^{i\omega_0 t}f(t)$$

| $F(\omega)$ | $f(t)$ |
| ----------- | ------ |
| $\dfrac{1}{i(\omega-3)+5}$ | $e^{3it}e^{-5t}u(t)$ |
| $\dfrac{1}{(i(\omega-2)+3)^2}$ | $e^{2it}\,t\,e^{-3t}u(t)$ |

### Dos polos reales simples — $k/[(i\omega+a)(i\omega+b)]$

$$\mathcal{F}^{-1}\!\left\{\frac{k}{(i\omega+a)(i\omega+b)}\right\}(t) = \frac{k}{b-a}\bigl(e^{-at}-e^{-bt}\bigr)u(t), \qquad a\neq b,\;a,b>0$$

Caso general: cualquier fracción racional propia y causal $P(\omega)/Q(\omega)$ (polos en el
semiplano izquierdo) se resuelve por **fracciones parciales** y aplicando estas filas a
cada término.

| $F(\omega)$ | $f(t)$ |
| ----------- | ------ |
| $\dfrac{1}{(i\omega+1)(i\omega+2)}$ | $(e^{-t}-e^{-2t})u(t)$ |
| $\dfrac{i\omega+3}{(i\omega+1)(i\omega+2)}$ | $(2e^{-t}-e^{-2t})u(t)$ |
| $\dfrac{i\omega}{(i\omega+1)^2}$ | $(1-t)e^{-t}u(t)$ |
| $\dfrac{1}{(i\omega+1)^2(i\omega+2)}$ | $(1-t)e^{-t}u(t)+e^{-2t}u(t)$ |

### Polo de orden fraccionario $k/\sqrt{i\omega+a}$

$$\mathcal{F}^{-1}\!\left\{\frac{k}{\sqrt{i\omega+a}}\right\} = \frac{k\,e^{-at}}{\sqrt{\pi t}}\,u(t), \qquad a>0$$

### Potencias causales sin decaimiento — $k\,t^n\,u(t)$ (distribucional)

Caso límite $a\to0$ de $t^n e^{-at}u(t)$; requiere derivadas de $\delta(\omega)$.

$$\mathcal{F}\{t^n u(t)\} = i^n\pi\,\delta^{(n)}(\omega) + \frac{i^{n-1}(-1)^n n!}{\omega^{n+1}}, \qquad n\geq1$$

| $f(t)$ | $F(\omega)$ |
| ------- | ----------- |
| $k\,t\,u(t)$ (rampa) | $k\!\left(i\pi\,\delta'(\omega)-\dfrac{1}{\omega^2}\right)$ |
| $k\,t^2\,u(t)$ (parábola) | $k\!\left(-\pi\,\delta''(\omega)+\dfrac{2i}{\omega^3}\right)$ |

> El término racional es valor principal de Cauchy, análogo a la familia $k/t^n$ de la Sección 3.

### Potencias de $t$ causales generales — $k\,\theta(t)\,t^p$, $p$ no entero

$$\mathcal{F}[k\,\theta(t)\,t^p](\omega) = k\,\Gamma(p+1)\,|\omega|^{-(p+1)}\left(\cos\tfrac{\pi(p+1)}{2}-i\,\text{sgn}(\omega)\sin\tfrac{\pi(p+1)}{2}\right), \qquad p>-1,\;p\notin\mathbb{Z}$$

| $p$ | $f(t)$ | $F(\omega)$ |
| --- | ------- | ----------- |
| $-1/2$ | $\theta(t)/\sqrt{t}$ | $\sqrt{\pi/|\omega|}\,e^{-i\frac{\pi}{4}\text{sgn}(\omega)}$ |
| $1/2$  | $\theta(t)\sqrt{t}$ | $\dfrac{\sqrt{\pi}}{2|\omega|^{3/2}}\,e^{-i\frac{3\pi}{4}\text{sgn}(\omega)}$ |

### Gumbel / doble-exponencial — familia $e^{bt}e^{-c\,e^{bt}}$

A diferencia del resto de esta sección, **no es causal**: está definida y decae en todo
$\mathbb{R}$ (crece como $e^{bt}$ hacia $t\to-\infty$ pero el factor $e^{-c\,e^{bt}}$ la
aplasta a 0 mucho más rápido hacia $t\to+\infty$, y viceversa para $b<0$). La sustitución
$u=c\,e^{bt}$ reduce la integral de Fourier directamente a la integral de Euler de $\Gamma$.

$$\mathcal{F}\{e^{bt}e^{-c\,e^{bt}}\}(\omega) = \frac{c^{\,i\omega/b}}{bc}\,\Gamma\!\left(1-\frac{i\omega}{b}\right), \qquad b,c>0$$

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $e^{t}e^{-e^{t}}$ (caso base $b=c=1$) | $\Gamma(1-i\omega)$ | — |
| $e^{bt}e^{-c\,e^{bt}}$ | $\dfrac{c^{\,i\omega/b}}{bc}\,\Gamma\!\left(1-\dfrac{i\omega}{b}\right)$ | $b,c>0$ |

**IFT** (reflexión temporal $b\to-b$ de la fila anterior):

$$\mathcal{F}^{-1}\{\Gamma(1+i\omega/b)\}(t) = e^{-bt}\,e^{-c\,e^{-bt}}, \qquad b,c>0$$

> Nota de convención: con el kernel $e^{+2\pi i s t}$ (usado por algunas fuentes en vez del
> $e^{-i\omega t}$ de ingeniería de este documento), la fórmula base aparece como
> $\Gamma(1+2\pi i s)$ — mismo par, signo de la parte imaginaria invertido por la
> convención del kernel.

---

## 5. Exponenciales bilaterales (funciones de energía) — familia $e^{-a|t|}$

Familia base: $e^{-a|t|}$ y su dual $1/(a^2+t^2)$ (par de Lorentz). El resto se obtiene
por dualidad, derivada en frecuencia, y modulación.

| $f(t)$                     | $F(\omega)$                                | Obtenido de                | Condiciones |
| --------------------------- | ---------------------------------------------- | ---------------------------- | ----------- |
| $e^{-a\lvert t\rvert}$      | $\dfrac{2a}{a^2+\omega^2}$                     | base                        | $a>0$       |
| $\dfrac{1}{a^2+t^2}$        | $\dfrac{\pi}{a}\,e^{-a\lvert\omega\rvert}$     | dualidad de la fila anterior | $a>0$       |
| $\dfrac{k}{a^2+\omega^2}$ *(IFT)* | $\dfrac{k}{2a}\,e^{-a\lvert t\rvert}$      | escalar                     | $a>0$       |
| $\dfrac{t}{a^2+t^2}$        | $-i\pi\,\text{sgn}(\omega)\,e^{-a\lvert\omega\rvert}$ | derivada en $\omega$ sobre par de Lorentz | $a>0$ |
| $e^{-a\lvert\omega+\omega_0\rvert}$ *(IFT)* | $\dfrac{a}{\pi}\,\dfrac{e^{-i\omega_0 t}}{a^2+t^2}$ | shift en frecuencia | $a>0$ |
| $\dfrac{k\omega}{a^2+\omega^2}$ *(IFT)* | $-\dfrac{ik}{2}\text{sgn}(t)e^{-a|t|}$ | derivada en frecuencia sobre $e^{-a|t|}$ | $a>0$ |
| $\dfrac{ki\omega}{a^2+\omega^2}$ *(IFT)* | $\dfrac{k}{2}\text{sgn}(t)e^{-a|t|}$ | igual que arriba, factor $i$ | $a>0$ |

### Modulación por coseno/seno

$$\mathcal{F}\{e^{-a|t|}\cos(bt)\} = a\!\left[\frac{1}{a^2+(\omega-b)^2}+\frac{1}{a^2+(\omega+b)^2}\right], \qquad \mathcal{F}\{e^{-a|t|}\sin(bt)\} = ia\!\left[\frac{1}{a^2+(\omega+b)^2}-\frac{1}{a^2+(\omega-b)^2}\right]$$

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $k\,e^{-a\lvert t\rvert}\cos(bt)$ | $ka\!\left[\dfrac{1}{a^2+(\omega-b)^2}+\dfrac{1}{a^2+(\omega+b)^2}\right]$ | $a,b>0$; $b=0$ recupera fila base $\times k$ |
| $k\,e^{-a\lvert t\rvert}\sin(bt)$ | $ika\!\left[\dfrac{1}{a^2+(\omega+b)^2}-\dfrac{1}{a^2+(\omega-b)^2}\right]$ | $a,b>0$ |
| $\dfrac{\cos(bt)}{a^2+t^2}$ | $\dfrac{\pi}{2a}\bigl[e^{-a\lvert\omega-b\rvert}+e^{-a\lvert\omega+b\rvert}\bigr]$ | $a,b>0$ (modulación sobre par de Lorentz) |
| $\dfrac{\sin(bt)}{a^2+t^2}$ | $\dfrac{\pi}{2ai}\bigl[e^{-a\lvert\omega-b\rvert}-e^{-a\lvert\omega+b\rvert}\bigr]$ | $a,b>0$ |

### Lorentziana generalizada — cuadrática en el denominador

Para $\dfrac{k}{At^2+Bt+C}$ con discriminante $B^2-4AC<0$: completar cuadrado
$At^2+Bt+C = A[(t-t_0)^2+a^2]$, $t_0=-B/(2A)$, $a=\sqrt{(4AC-B^2)/(4A^2)}$:

$$F(\omega) = \frac{k\pi}{Aa}\,e^{-a|\omega|}\,e^{-i\omega t_0}$$

Caso simple ($B=0$, $t_0=0$): recupera la fila base $\dfrac{k}{a^2+t^2}\to\dfrac{k\pi}{a}e^{-a|\omega|}$.
La versión IFT (dual, cuadrática en $\omega$) es idéntica en estructura:

$$f(t) = \mathcal{F}^{-1}\!\left\{\frac{k}{A\omega^2+B\omega+C}\right\} = \frac{k}{2Aa}\,e^{-a|t|}\,e^{i\omega_0 t}, \qquad \omega_0=-\tfrac{B}{2A},\; a=\sqrt{\tfrac{4AC-B^2}{4A^2}},\; A>0,\;4AC-B^2>0$$

---

## 6. Familia anti-causal — soporte $t<0$

Espejo temporal de la familia causal (Sección 4): $u(t)\to u(-t)$, $e^{-at}\to e^{at}$.
Los polos pasan del semiplano superior al inferior ($i\omega+a \to a-i\omega$).

| $f(t)$                     | $F(\omega)$                                    | Obtenido de                | Condiciones |
| --------------------------- | --------------------------------------------------- | ---------------------------- | ----------- |
| $k\,e^{at}u(-t)$            | $\dfrac{k}{a-i\omega}$                              | espejo temporal del par causal base | $a>0$ |
| $k\,e^{at}\cos(bt)\,u(-t)$  | $\dfrac{k(a-i\omega)}{(a-i\omega)^2+b^2}$            | modulación                   | $a,b>0$     |
| $k\,e^{at}\sin(bt)\,u(-t)$  | $\dfrac{-kb}{(a-i\omega)^2+b^2}$                     | modulación                   | $a,b>0$     |

### IFT anti-causales

| $F(\omega)$ | $f(t)$ | Condiciones |
| ----------- | ------ | ----------- |
| $\dfrac{k}{a-i\omega}$ | $k\,e^{at}u(-t)$ | $a>0$ |
| $\dfrac{k}{(a-i\omega)^n}$ | $\dfrac{(-1)^{n-1}k\,t^{n-1}}{(n-1)!}\,e^{at}u(-t)$ | $a>0,n\geq1$ |
| $\dfrac{a-i\omega}{(a-i\omega)^2+b^2}$ | $e^{at}\cos(bt)u(-t)$ | $a,b>0$ |
| $\dfrac{-b}{(a-i\omega)^2+b^2}$ | $e^{at}\sin(bt)u(-t)$ | $a,b>0$ |
| $\dfrac{k}{(a-i\omega)^2+b^2}$ | $\dfrac{-k}{b}\,e^{at}\sin(bt)u(-t)$ | $a,b>0$ |

> El factor $(-1)^{n-1}$ distingue causal de anti-causal en el polo de orden $n$.

---

## 7. Gaussiana — familia $e^{-at^2}$

La gaussiana es su propia transformada (auto-dual); es la única función $L^2$ con esta propiedad.

| $f(t)$                       | $F(\omega)$                                                                | Obtenido de           | Condiciones |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------ | ----------- |
| $k\,e^{-at^2}$                | $k\sqrt{\dfrac{\pi}{a}}\,e^{-\omega^2/(4a)}$                                  | base (auto-dual)        | $a>0$       |
| $k\,e^{-at^2}\cos(bt)$        | $k\sqrt{\dfrac{\pi}{a}}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\cosh\!\left(\dfrac{b\omega}{2a}\right)$ | modulación por coseno | $a>0$ |
| $k\,e^{-at^2}\sin(bt)$        | $-ik\sqrt{\dfrac{\pi}{a}}\,e^{-b^2/(4a)}\,e^{-\omega^2/(4a)}\sinh\!\left(\dfrac{b\omega}{2a}\right)$ | modulación por seno | $a>0$ |
| $k\,e^{-at^2}\cos(bt+\theta)$ | $\dfrac{k}{2}\sqrt{\dfrac{\pi}{a}}\!\left[e^{i\theta}e^{-(\omega-b)^2/(4a)}+e^{-i\theta}e^{-(\omega+b)^2/(4a)}\right]$ | fase sobre modulación | $a>0$ |
| $k\,e^{-at^2}\sin(bt+\theta)$ | $\dfrac{k}{2i}\sqrt{\dfrac{\pi}{a}}\!\left[e^{i\theta}e^{-(\omega-b)^2/(4a)}-e^{-i\theta}e^{-(\omega+b)^2/(4a)}\right]$ | fase sobre modulación | $a>0$ |

**Casos canónicos** ($a=1/2$):

| $f(t)$ | $F(\omega)$ |
| ------- | ----------- |
| $e^{-t^2/2}$ | $\sqrt{2\pi}\,e^{-\omega^2/2}$ |
| $e^{-t^2/2}\cos(\omega_0 t)$ | $\sqrt{2\pi}\,e^{-\omega_0^2/2}e^{-\omega^2/2}\cosh(\omega_0\omega)$ |
| $e^{-t^2/2}\sin(\omega_0 t)$ | $-i\sqrt{2\pi}\,e^{-\omega_0^2/2}e^{-\omega^2/2}\sinh(\omega_0\omega)$ |

### Multiplicación por potencias de $t$ — polinomios de Hermite

$$\mathcal{F}\{k\,t^n e^{-at^2}\}(\omega) = k\cdot i^n\cdot\frac{d^n}{d\omega^n}\!\left[\sqrt{\frac{\pi}{a}}\,e^{-\omega^2/(4a)}\right]$$

| $n$ | $F(\omega)$ |
| --- | ----------- |
| 1 | $-\dfrac{ik\sqrt{\pi/a}}{2a}\,\omega\,e^{-\omega^2/(4a)}$ |
| 2 | $-\dfrac{k\sqrt{\pi/a}}{4a^2}\,(\omega^2-2a)\,e^{-\omega^2/(4a)}$ |
| 3 | $\dfrac{ik\sqrt{\pi/a}}{8a^3}\,(\omega^3-6a\omega)\,e^{-\omega^2/(4a)}$ |

El resultado general es la gaussiana multiplicada por un polinomio de Hermite en $\omega/(2\sqrt a)$: real y par para $n$ par, imaginaria pura e impar para $n$ impar.

### Producto con Lorentziana — convolución en frecuencia

$$\mathcal{F}\!\left\{\frac{k\,e^{-at^2}}{t^2+b^2}\right\}(\omega) = \frac{k\pi\,e^{ab^2}}{2b}\left[e^{-b\omega}\,\text{erfc}\!\left(\frac{2ab-\omega}{2\sqrt a}\right)+e^{b\omega}\,\text{erfc}\!\left(\frac{2ab+\omega}{2\sqrt a}\right)\right]$$

Par IFT dual (idéntica estructura, $t\leftrightarrow\omega$):

$$\mathcal{F}^{-1}\!\left\{\frac{k\,e^{-a\omega^2}}{\omega^2+b^2}\right\}(t) = \frac{k\,e^{ab^2}}{2b}\left[e^{-bt}\,\text{erfc}\!\left(\frac{2ab-t}{2\sqrt a}\right)+e^{bt}\,\text{erfc}\!\left(\frac{2ab+t}{2\sqrt a}\right)\right]$$

Caso $a=b=1$: $\mathcal{F}^{-1}\{e^{-\omega^2}/(\omega^2+1)\} = \dfrac{e}{2}\left[e^{-t}\text{erfc}\!\left(\tfrac{2-t}{2}\right)+e^{t}\text{erfc}\!\left(\tfrac{2+t}{2}\right)\right]$.

### Gaussiana compleja generalizada — $e^{-\pi(\alpha+i\beta)^2t^2}$

Generaliza $e^{-at^2}$ (base de esta sección) a exponente cuadrático con parámetro
complejo $\alpha+i\beta$. Es la misma fórmula $\sqrt{\pi/A}\,e^{-\omega^2/(4A)}$ de siempre,
con $A=\pi(\alpha+i\beta)^2$; la condición $\alpha\geq|\beta|$ garantiza $\text{Re}(A)>0$
(convergencia de la integral).

$$\mathcal{F}\{e^{-\pi(\alpha+i\beta)^2t^2}\}(\omega) = \frac{e^{-\omega^2/(4\pi(\alpha+i\beta)^2)}}{\alpha+i\beta}, \qquad \alpha\geq|\beta|,\;\alpha+i\beta\neq0$$

Es un par **auto-dual** (misma estructura en ambas direcciones), igual que la gaussiana real:

$$\mathcal{F}^{-1}\!\left\{\frac{e^{-\omega^2/(4\pi A)}}{}\right\}(t) = \sqrt{A}\,e^{-\pi A t^2}, \qquad A=(\alpha+i\beta)^2$$

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $e^{-\pi(1+0.3i)^2t^2}$ | $\dfrac{e^{-\omega^2/(4\pi(1+0.3i)^2)}}{1+0.3i}$ | caso numérico, $\alpha=1,\beta=0.3$ |
| $e^{-\pi(\alpha+i\beta)^2t^2}$ | $\dfrac{e^{-\omega^2/(4\pi(\alpha+i\beta)^2)}}{\alpha+i\beta}$ | caso general, $\alpha\geq|\beta|$ |

---

## 8. Función error — familia $\text{erf}(bt)$

$$\mathcal{F}\{k\,\text{erf}(bt)\}(\omega) = \frac{-2ik}{\omega}\,e^{-\omega^2/(4b^2)}, \qquad b>0$$

Derivada de $\frac{d}{dt}\text{erf}(bt) = \frac{2b}{\sqrt\pi}e^{-b^2t^2}$ (par gaussiano, Sección 7) más
integración en frecuencia (inversa de la propiedad de diferenciación en tiempo).

| $f(t)$ | $F(\omega)$ | Obtenido de |
| ------- | ----------- | ----------- |
| $k\,\text{erf}(bt)$ | $\dfrac{-2ik}{\omega}\,e^{-\omega^2/(4b^2)}$ | base |
| $k\,\text{erf}(b(t-t_0))$ | $F_{\text{base}}(\omega)\,e^{-i\omega t_0}$ | shift en tiempo |
| $k\,\text{erfc}(bt) = k[1-\text{erf}(bt)]$ | $2k\pi\,\delta(\omega)-\dfrac{2ik}{\omega}e^{-\omega^2/(4b^2)}$ | linealidad sobre $u(t)\equiv$ constante $1$ |

---

## 9. Familias hiperbólicas

### 9.1 Cocientes trig/hiperbólico

$$\mathcal{F}\!\left\{\frac{k\sin(at)}{\sinh(bt)}\right\} = \frac{k\pi}{2b}\left[\tanh\!\left(\frac{\pi(a-\omega)}{2b}\right)+\tanh\!\left(\frac{\pi(a+\omega)}{2b}\right)\right], \qquad a,b>0$$

$$\mathcal{F}\!\left\{\frac{k\cos(at)}{\cosh(bt)}\right\} = \frac{k\pi}{2b}\left[\text{sech}\!\left(\frac{\pi(\omega-a)}{2b}\right)+\text{sech}\!\left(\frac{\pi(\omega+a)}{2b}\right)\right], \qquad a\geq0,\,b>0$$

$$k\,\text{sech}(bt) \;\longrightarrow\; \frac{k\pi}{b}\,\text{sech}\!\left(\frac{\pi\omega}{2b}\right) \qquad \text{(caso } a=0 \text{ de la fila anterior)}$$

### 9.2 Otras transformadas hiperbólicas de un solo argumento

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $k/\sinh(bt)$ | $\dfrac{-ik\pi}{\lvert b\rvert}\tanh\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b\neq0$ |
| $k\tanh(bt)$ | $\dfrac{-ik\pi}{\lvert b\rvert}\,\text{csch}\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b\neq0$ |
| $k\,\text{csch}^2(bt)$ | $\dfrac{-2k\pi\omega}{b^2}\coth\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b>0$ |
| $k\,\text{sech}^2(bt)$ | $\dfrac{k\pi\omega}{b^2}\,\text{csch}\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b>0$; derivada de $\tanh$ |
| $k\tanh(bt)\,\text{sech}(bt)$ | $\dfrac{-ik\pi\omega}{b}\,\text{sech}\!\left(\dfrac{\pi\omega}{2b}\right)$ | $b>0$ |

### 9.3 Familia general $\text{sech}^{2n+1}$ y $\tanh^{2m}\text{sech}^{2n+1}$

Con $u=\pi\omega/(2b)$ y la recurrencia $P_0(u)=1,\; P_{n+1}(u)=\dfrac{u^2+(2n+1)^2}{(2n+1)(2n+2)}P_n(u)$:

$$\mathcal{F}\{k\,\text{sech}^{2n+1}(bt)\}(\omega) = \frac{k\pi}{b}\cdot\frac{P_n(u)}{\cosh(u)}$$

$$\mathcal{F}\{k\,\tanh^{2m}(bt)\,\text{sech}^{2n+1}(bt)\}(\omega) = \frac{k\pi}{b}\cdot\frac{1}{\cosh(u)}\sum_{r=0}^{m}(-1)^r\binom{m}{r}P_{n+r}(u)$$

| $f(t)$ ($b=1$) | $F(\omega)$, $u=\pi\omega/2$ |
| --------------- | ------------------------------ |
| $\text{sech}^3(t)$ | $\frac{\pi}{2}(1+u^2)\,\text{sech}(u)$ |
| $\text{sech}^5(t)$ | $\frac{\pi}{24}(9+10u^2+u^4)\,\text{sech}(u)$ |
| $\tanh^2(t)\,\text{sech}(t)$ | $\frac{\pi}{2}(1-u^2)\,\text{sech}(u)$ |

---

## 10. Arctan — familia distribucional

$\arctan(bt)$ no es $L^1$; su transformada existe en sentido distribucional, derivada
integrando en frecuencia la TF de $\frac{d}{dt}\arctan(bt) = b/(1+b^2t^2)$ (Sección 5).

| $f(t)$ | $F(\omega)$ | Obtenido de |
| ------- | ----------- | ----------- |
| $k\arctan(bt)$ | $\dfrac{-ik\pi}{b\omega}\,e^{-\lvert\omega\rvert/b}$ | integración en frecuencia sobre par de Lorentz | 
| $k\arctan(b(t-t_0))$ | $F_{\text{base}}(\omega)\,e^{-i\omega t_0}$ | shift en tiempo |
| $\arctan(\alpha t)-\arctan(\beta t)$ | $\dfrac{-i\pi}{\omega}\!\left(\dfrac{e^{-\lvert\omega\rvert/\alpha}}{\alpha}-\dfrac{e^{-\lvert\omega\rvert/\beta}}{\beta}\right)$ | linealidad |
| $k\arctan(1/(bt))$ | $\dfrac{ik\pi}{\omega}\!\left(\dfrac{e^{-\lvert\omega\rvert/b}}{b}-1\right)$ | identidad $\arctan(1/x)=\tfrac\pi2\text{sgn}(x)-\arctan(x)$ |
| $k\arctan(bt)/t$ | $-k\pi\,\text{Ei}(-\lvert\omega\rvert/b)$ | propiedad de división por $t$ |
| $k\arctan(c/t^2)$ | $\dfrac{2k\pi}{\omega}\,e^{-\lvert\omega\rvert\sqrt{c/2}}\sin\!\left(\omega\sqrt{c/2}\right)$ | contorno de integración | 

---

## 11. Sinc y tri — funciones tipo ventana

### 11.1 Potencias de sinc — familia B-spline

$$\mathcal{F}\!\left[\left(\frac{\sin t}{t}\right)^n\right](\omega) = \frac{\pi}{2^n(n-1)!}\sum_{k=0}^{n}\binom{n}{k}(-1)^k(n-2k-\omega)^{n-1}\text{sgn}(n-2k-\omega), \qquad n\geq1$$

Es una **B-spline de orden $n-1$** con soporte $[-n,n]$ en frecuencia. Con escala/desplazamiento
$k\,\text{sinc}(at+b)^n$, $t_0=-b/a$: multiplicar por $\dfrac{k}{|a|}$ y por $e^{-i\omega t_0}$.

| $n$ | $f(t)$ | $F(\omega)$ |
| --- | ------- | ----------- |
| 1 | $\text{sinc}(t)$ | $\pi\,\text{rect}(\omega/2)$ |
| 2 | $\text{sinc}^2(t)$ | $\pi\,\text{tri}(\omega/2)$ |
| 3 | $\text{sinc}^3(t)$ | B-spline cuadrática, soporte $[-3,3]$ |

**Dual (IFT):** $\mathcal{F}^{-1}\{\text{sinc}(\omega)^n\}(t) = \frac{1}{2\pi}\cdot\text{FT}[\text{sinc}^n](t)$, p. ej.
$\mathcal{F}^{-1}\{k\,\text{sinc}(a\omega)^2\}(t) = \dfrac{k}{2|a|}\,\text{tri}(t/2a)$.

> **Nota**: $(\sin(bt)/t)^n$ debe reconocerse primero como $b^n\,\text{sinc}(bt)^n$ antes de aplicar
> la fórmula — la forma expandida $\sin(bt)^n/t^n$ es algebraicamente la misma función.

### 11.2 Potencias de tri — fórmulas cerradas $n=2..6$

No existe fórmula general uniforme (a diferencia de sinc): el tipo trigonométrico alterna
entre seno y coseno según la paridad de $n$. Con $u=\omega/a$, $R_n(u)\cdot a$:

| $n$ | Tipo | $R_n(u)\cdot a$ |
| --- | ---- | ---------------- |
| 2 | sin | $4(u-\sin u)/u^3$ |
| 3 | cos | $2(3u^2+6\cos u-6)/u^4$ |
| 4 | sin | $8(u^3+6\sin u-6u)/u^5$ |
| 5 | cos | $2(15u^2-24-(u^4-12)\cos u-12u\sin u)/u^6$ |

**Dual (IFT)**: $\mathcal{F}^{-1}\{\text{tri}(\omega)^n\}(t) = \frac{1}{2\pi}\text{FT}[\text{tri}^n]\big|_{\omega\to t}$, p. ej. para $n=2$: $\dfrac{2(t-\sin t)}{\pi t^3}$.

### 11.3 Integral senoidal $\text{Si}(t)$ y producto $\text{sgn}(t)\cdot\text{sinc}(t)$

$\text{Si}(t) = \displaystyle\int_0^t \frac{\sin u}{u}\,du$ no decae ($\text{Si}(\pm\infty)=\pm\pi/2$), pero su
derivada es $a\cdot\text{sinc}(at)$, así que su transformada se obtiene por la propiedad de
diferenciación en tiempo sobre el par de la Sección 11.1, no por integración directa.

$$\mathcal{F}\{k\,\text{Si}(at)\} = \frac{k\pi\,\text{sgn}(a)}{i\omega}\bigl[u(\omega+a)-u(\omega-a)\bigr], \qquad a\neq0$$

El producto $\text{sgn}(t)\cdot\text{sinc}(at)$ se obtiene por convolución en frecuencia de
$\mathcal{F}\{\text{sgn}(t)\}=2/(i\omega)$ con $\mathcal{F}\{\text{sinc}(at)\}=(\pi/a)\text{rect}(\omega/2a)$,
que se reduce a una integral de valor principal de $1/u$ con forma cerrada logarítmica:

$$\mathcal{F}\{k\,\text{sgn}(t)\cdot\text{sinc}(at)\} = \frac{-ik}{a}\ln\left|\frac{\omega+a}{\omega-a}\right|, \qquad a>0$$

| $f(t)$ | $F(\omega)$ | Condiciones |
| ------- | ----------- | ----------- |
| $\text{Si}(t)$ | $\dfrac{\pi[u(\omega+1)-u(\omega-1)]}{i\omega}$ | caso base $a=1$ |
| $\text{Si}(2t)$ | $\dfrac{\pi[u(\omega+2)-u(\omega-2)]}{i\omega}$ | escalado, $a=2$ |
| $\text{sgn}(t)\cdot\text{sinc}(t)$ | $-i\ln\lvert(\omega+1)/(\omega-1)\rvert$ | caso base $a=1$ |

---

## 12. Funciones periódicas de valor absoluto — $|\sin|$, $|\cos|$ en intervalo finito

Como $|\sin(t)|$ no decae, su FT solo existe restringida a un intervalo finito de $k$ períodos
(fuera de $(-\infty,\infty)$, donde no es $L^1$ y la transformada no existe como función ordinaria).

$$\mathcal{F}\{|\sin(t)|\cdot\mathbf{1}_{[0,\pi]}\}(\omega) = \frac{1+e^{-i\pi\omega}}{1-\omega^2}$$

$$\mathcal{F}\{|\sin(t)|\cdot\mathbf{1}_{[-\pi,\pi]}\}(\omega) = \frac{2(1+e^{-i\pi\omega})}{1-\omega^2}, \qquad \mathcal{F}\{|\sin(bt)|\cdot\mathbf{1}_{[-\pi/b,\pi/b]}\}(\omega) = \frac{2b(1+e^{-i\pi\omega/b})}{b^2-\omega^2}$$

> **Excepción notable:** $\sin(t)/t=\text{sinc}(t)$ y $\sin(bt)/(a^2+t^2)$ sí son $L^1(\mathbb{R})$
> porque el denominador introduce decaimiento — su FT sobre toda la recta existe (Secciones 5 y 11).

---

## 13. Tren de impulsos (peine de Dirac)

$$\text{III}_T(t) = \sum_{n=-\infty}^{\infty}\delta(t-nT) \qquad\Longrightarrow\qquad \mathcal{F}\{\text{III}_T(t)\}(\omega) = \omega_0\sum_{k=-\infty}^{\infty}\delta(\omega-k\omega_0), \qquad \omega_0=\frac{2\pi}{T}$$

> **El dual de un tren es otro tren**, con espaciado inverso ($\omega_0=2\pi/T$). Compresión en
> tiempo ⟺ expansión en frecuencia.

| $f(t)$ | $F(\omega)$ | Nota |
| ------- | ----------- | ---- |
| $\text{III}_T(t)$ | $\omega_0\sum_k\delta(\omega-k\omega_0)$ | base |
| $\text{III}_T(t-t_0)$ | $e^{-i\omega t_0}\,\omega_0\sum_k\delta(\omega-k\omega_0)$ | shift en tiempo |
| $x(t)\cdot\text{III}_T(t)$ | $\dfrac{1}{T}\sum_k X(\omega-k\omega_0)$ | muestreo ideal — base del teorema de Nyquist-Shannon |

Tren finito de $N$ impulsos (ventana rectangular, sí computable en forma cerrada):

$$\sum_{n=0}^{N-1}\delta(t-nT) \;\longrightarrow\; e^{-i\omega(N-1)T/2}\,\frac{\sin(N\omega T/2)}{\sin(\omega T/2)}$$

---

## 14. Índice rápido — ¿dónde busco $f(t)$?

| Si $f(t)$ contiene...                         | Ver sección |
| ----------------------------------------------- | ----------- |
| $\delta$, constante, $e^{i\omega_0 t}$, $\sin/\cos$ puro, potencias de $\sin/\cos$ | 2 |
| $u(t)$, $u(-t)$, $\text{sgn}(t)$, $1/t^n$, $\lvert t\rvert^\alpha$ ($\alpha$ no entero, con o sin $\text{sgn}(t)$) | 3 |
| $e^{-at}$ con $u(t)$ (causal), $t^n e^{-at}u(t)$, $t^p e^{-at}u(t)$ ($p$ no entero, Erlang/Gamma), fracciones racionales con polos en semiplano izquierdo | 4 |
| $e^{bt}e^{-c\,e^{bt}}$ (Gumbel/doble-exponencial, no causal) | 4 |
| $e^{-a\lvert t\rvert}$, $1/(a^2+t^2)$ (bilateral, sin escalón) | 5 |
| $e^{at}$ con $u(-t)$ (anti-causal)              | 6 |
| $e^{-at^2}$ (gaussiana), con o sin modulación   | 7 |
| $\text{erf}(bt)$, $\text{erfc}(bt)$             | 8 |
| $\sinh, \cosh, \tanh, \text{sech}, \text{csch}$ | 9 |
| $\arctan(bt)$ y variantes                       | 10 |
| $\text{sinc}(t)$, $\text{tri}(t)$ y potencias, $\text{Si}(t)$, $\text{sgn}(t)\cdot\text{sinc}(t)$ | 11 |
| $\lvert\sin(bt)\rvert$, $\lvert\cos(bt)\rvert$ en intervalo finito | 12 |
| Tren de impulsos / muestreo periódico           | 13 |
