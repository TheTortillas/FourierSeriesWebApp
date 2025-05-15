# Problemas de Compatibilidad del Backend con Windows

Este documento explica en detalle por qué el backend de Fourier Web Calculator solo puede ejecutarse en sistemas Linux y no es compatible con Windows.

## Diferencias en la Ejecución de Comandos

### Sintaxis de Comandos

La forma en que Node.js ejecuta comandos externos a través del módulo `child_process` difiere significativamente entre Linux y Windows:

**En Linux (funciona):**

```javascript
// Comando en Linux
const command = `echo "declare(n, integer)$ string(integrate(${func}, x));" | maxima --very-quiet`;
```

**En Windows (problemático):**

```javascript
// Comando en Windows
const command = `echo declare(n, integer)$ string(integrate(${func}, x)); | maxima --very-quiet`;
```

La diferencia principal está en las comillas y la forma en que se pasan los comandos al shell.

### Operadores Matemáticos

Los operadores matemáticos como el de potencia (`^`) funcionan de manera diferente:

**En Windows:**

```javascript
// Es necesario convertir operadores
func = func.replace(/\^/g, "**"); // Reemplaza ^ por ** para potencias
```

**En Linux:**
No se requiere esta transformación.

## Ejemplos de Código

Comparando los dos archivos de ejemplo:

`script.js` (Linux):

```javascript
// Funciona en Linux
app.post("/", (req, res) => {
  let func = req.body.function;
  // No necesita transformación de operadores
  const command = `echo "declare(n, integer)$ string(integrate(${func}, x));" | maxima --very-quiet`;
  // ...
});
```

`script_windows.js` (Windows - problemático):

```javascript
app.post("/", (req, res) => {
  let func = req.body.function;
  // Requiere transformación de operadores
  func = func.replace(/\^/g, "**");
  const command = `echo declare(n, integer)$ string(integrate(${func}, x)); | maxima --very-quiet`;
  // ...
});
```

## Conclusión

Debido a estas diferencias fundamentales en la sintaxis de comandos y el manejo de operadores matemáticos, no es posible hacer que el backend funcione correctamente en Windows sin reescribir gran parte del código.

La solución más práctica es ejecutar el backend exclusivamente en un entorno Linux. Si necesitas desarrollar o probar en un sistema Windows, considera usar una máquina virtual con Linux.
