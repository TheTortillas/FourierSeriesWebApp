# Business Logic Review — Fourier Web Calculator

> Archivo de trabajo interno. NO commitear.
> Rama de trabajo: `feat/business-logic-fixes` (desde `develop`)

---

## Prioridad ALTA

### [A1] `refreshToken` expuesto en body de respuesta — SEGURIDAD
**Archivos:** `fourier-backend/src/api/routes/auth.routes.ts`, `fourier-backend/src/application/auth/authService.ts`

**Problema:**
Los endpoints `/api/auth/register`, `/api/auth/login`, `/api/auth/google` y `/api/auth/refresh`
devuelven `AuthResult` completo, que incluye el campo `refreshToken` en el JSON de respuesta.
El `refreshToken` es visible en DevTools → Network → Response para cualquier usuario.

Aunque el token TAMBIÉN se envía como cookie httpOnly (que es la forma segura y la que usa el frontend),
exponerlo en el body es una vulnerabilidad grave:

- Cualquier script XSS puede leerlo del body de la respuesta si intercepta el fetch antes de que se descarte.
- Extensiones de browser maliciosas o proxies pueden loguear el body.
- Logs del servidor (si están mal configurados) podrían capturarlo.
- El frontend nunca usa `response.refreshToken` — solo usa `response.accessToken` y la cookie.

**Solución:**
Eliminar `refreshToken` de `AuthResult` en el backend. El frontend ya usa la cookie httpOnly exclusivamente.
El campo `refreshToken` en `buildAuthResult` debe desaparecer de la respuesta JSON.

- [x] Eliminar `refreshToken` de la interfaz `AuthResult` en `authService.ts`
- [x] Crear `AuthServiceResult extends AuthResult` con `refreshToken` para uso interno del router
- [x] Actualizar `buildAuthResult` para recibir y devolver `refreshToken` en el tipo interno
- [x] Router desestructura `{ refreshToken, ...clientResult }` — cookie con token, JSON sin él
- [x] Verificar que el frontend no lee `response.refreshToken` en ningún lugar (confirmado: no lo hace)
- [x] Verificar que `/api/auth/refresh` sigue seteando la cookie correctamente
- [x] Eliminar `passwordHash` de la interfaz `User` en el frontend — reemplazado por `hasPassword: boolean`
- [x] Backend `/me` y `/profile` calculan `hasPassword: passwordHash !== null` sin exponer el hash
- [x] Template de perfil actualizado: `passwordHash === null` → `!user.hasPassword`
- [x] TypeScript check backend y frontend: sin errores

---

### [A2] Race condition en quota check + increment
**Archivo:** `fourier-backend/src/infrastructure/persistence/UserRepository.ts` (líneas 241-283)
**Archivo:** `fourier-backend/src/api/middlewares/requireTierLimit.ts`

**Problema:**
`requireTierLimit` llama a `getWeeklyCount()` para verificar el límite, y luego el router llama a
`incrementWeeklyCount()` si el cálculo fue exitoso. Son dos queries separadas.

Con requests concurrentes: dos requests simultáneos pueden ambos ver `count = 99` (límite 100),
ambos pasar el check, y resultar en `count = 101`. El límite no es confiable bajo carga.

**Solución:**
Combinar check e incremento en una sola query atómica que devuelva el nuevo count.
Si el nuevo count supera el límite, hacer rollback o usar `RETURNING` con una condición.

```sql
-- Patrón: incrementar solo si no se superó el límite, devolver si fue exitoso
UPDATE user_calculation_counters
SET count = count + 1, updated_at = NOW()
WHERE user_id = $1 AND week_start = $2 AND count < $3
RETURNING count;
-- Si no devuelve fila → ya estaba en el límite
```

- [ ] Crear método `checkAndIncrementWeeklyCount(userId, limit)` que sea atómico
- [ ] Crear método `checkAndIncrementAnonymousCount(ip, limit)` análogo
- [ ] Reemplazar la lógica en `requireTierLimit.ts` para usar los nuevos métodos
- [ ] Eliminar las llamadas separadas a `incrementCalculationCount` en los routers de fourier/transforms/dft
- [ ] Test: verificar que requests concurrentes no superan el límite

---

### [A3] `changePassword` no invalida sesiones activas
**Archivo:** `fourier-backend/src/application/auth/authService.ts` (líneas 394-418)

**Problema:**
`resetPassword` llama a `revokeAllUserTokens(userId)` correctamente.
`changePassword` (cambio estando autenticado) NO lo hace.

Si el usuario cambia su contraseña porque sospecha que su cuenta fue comprometida,
todos sus refresh tokens en otros dispositivos siguen siendo válidos. Es un fallo de seguridad.

**Solución:** Añadir `await this.tokenRepo.revokeAllUserTokens(input.userId)` al final de `changePassword`.
El access token actual (15 min) expirará solo; solo se invalidan los refresh tokens.

- [x] Añadir `revokeAllUserTokens` en `changePassword` en `authService.ts`
- [ ] Opcional: devolver flag `sessionsRevoked: true` en la respuesta para que el frontend
      pueda notificar al usuario ("Se cerraron las sesiones en otros dispositivos")

---

## Prioridad MEDIA

### [M1] `verifyEmail` hace query directa a la DB desde el servicio de aplicación
**Archivo:** `fourier-backend/src/application/auth/authService.ts` (líneas 340-342)

**Problema:**
```ts
await db.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [record.userId]);
```
El servicio de aplicación importa `db` directamente, violando la arquitectura limpia
(la capa de aplicación no debe conocer la infraestructura de DB).

**Solución:** Añadir `markEmailVerified(userId: string): Promise<void>` a `IUserRepository`
e implementarlo en `UserRepository`.

- [x] Añadir `markEmailVerified(userId)` a `IUserRepository`
- [x] Añadir `updatePassword(userId, hash)` a `IUserRepository`
- [x] Implementar ambos en `UserRepository`
- [x] Reemplazar `db.query` directo en `authService.verifyEmail` → `userRepo.markEmailVerified`
- [x] Reemplazar `db.query` directo en `authService.resetPassword` → `userRepo.updatePassword`
- [x] Reemplazar `db.query` directo en `authService.changePassword` → `userRepo.updatePassword`
- [x] Eliminar import de `db` de `authService.ts` (ya no se usa)
- [x] Eliminar import de `sendRecoveryEmail` (declarado pero nunca usado)
- [x] Prefijar `ipAddress` → `_ipAddress` en `resendVerification` (intencional, no loguear)

### [M2] `activate` (admin) puede resucitar cuentas soft-deleted con email inválido
**Archivo:** `fourier-backend/src/infrastructure/persistence/UserRepository.ts` (líneas 404-408)

**Problema:**
```ts
await db.query(`UPDATE users SET is_active = TRUE, deleted_at = NULL WHERE id = $1`, [id]);
```
El `activate` admin borra el `deleted_at`, "resucitando" cuentas eliminadas.
Esas cuentas tienen el email obfuscado a `deleted_<id>@deleted.invalid` y sin proveedores de auth.
El usuario quedaría con una cuenta activa pero inutilizable.

`activate` debería ser solo para cuentas desactivadas por admin (`is_active = FALSE` con `deleted_at IS NULL`),
nunca para cuentas soft-deleted.

**Solución:**
```sql
UPDATE users SET is_active = TRUE
WHERE id = $1 AND deleted_at IS NULL  -- solo si NO está eliminada
```

- [ ] Añadir `AND deleted_at IS NULL` al UPDATE en `activate`
- [ ] En la ruta admin PATCH `/users/:id`, separar la lógica de `activate`/`deactivate`
      de la detección de cuentas eliminadas (devolver 400 si se intenta activar una cuenta deleted)

---

## Prioridad BAJA

### [B1] `getWeeklyCount` tiene side effects de escritura
**Archivo:** `fourier-backend/src/infrastructure/persistence/UserRepository.ts` (líneas 241-263)

**Problema:**
`getWeeklyCount` y `getAnonymousWeeklyCount` hacen un `INSERT ... ON CONFLICT DO UPDATE`
para resetear el contador si cambió la semana. Una función de lectura no debería escribir.
El endpoint `GET /api/auth/quota` termina haciendo escrituras innecesarias en la DB.

**Solución:** Separar la lógica de reset en `incrementWeeklyCount` (ya lo hace también),
y hacer que `getWeeklyCount` sea un `SELECT` puro con lógica de "si week_start < esta semana, devuelve 0".

```sql
SELECT CASE
  WHEN week_start < $2 THEN 0
  ELSE count
END as count
FROM user_calculation_counters
WHERE user_id = $1
```

- [ ] Refactorizar `getWeeklyCount` a SELECT puro
- [ ] Refactorizar `getAnonymousWeeklyCount` a SELECT puro
- [ ] Verificar que el reset de semana sigue funcionando desde `increment`

### [B2] Fallback de `refreshToken` en body del request
**Archivo:** `fourier-backend/src/api/routes/auth.routes.ts` (líneas 244-247, 297-300)

**Problema:**
`/api/auth/refresh` y `/api/auth/logout` aceptan el refresh token tanto por cookie como por body.
Si el body es logueado por algún middleware, proxy o herramienta de monitoreo, el token queda expuesto.
El frontend siempre usa la cookie — el fallback por body no es necesario para el uso actual.

**Solución:** Eliminar el fallback `req.body.refreshToken`. Solo aceptar la cookie httpOnly.
Si en el futuro se necesita soporte móvil, se puede evaluar entonces con el contexto adecuado.

- [ ] Eliminar fallback `req.body.refreshToken` en `/refresh`
- [ ] Eliminar fallback `req.body.refreshToken` en `/logout`
- [ ] Actualizar Swagger doc de ambos endpoints

### [B3] `generalLimiter` asignado al bucket `"auth"` incorrectamente
**Archivo:** `fourier-backend/src/api/middlewares/rateLimiter.ts` (líneas 203-207)

**Problema:**
```ts
handler: rateLimitHandler("auth", "general", ...)
```
Los bloqueos del general limiter (que aplica a rutas como `/api/history`, `/api/feedback`, etc.)
se contabilizan dentro del bucket `"auth"` en las métricas del dashboard admin.
Esto distorsiona los ratios y hace difícil identificar el origen real del abuso.

**Solución:** Agregar un bucket `"general"` al tipo `RateLimitBucket` y usarlo aquí.

- [ ] Añadir `"general"` a `RateLimitBucket`
- [ ] Actualizar `metrics` para incluir el bucket `"general"`
- [ ] Actualizar `generalLimiter` para usar el bucket correcto
- [ ] Actualizar el endpoint admin `/api/admin/rate-limit/metrics` si expone los buckets por nombre

### [B4] `resendVerification` no tiene cooldown por usuario
**Archivo:** `fourier-backend/src/application/auth/authService.ts` (líneas 420-433)

**Problema:**
Hay rate limit por IP (`authRecoveryLimiter`), pero si un atacante conoce un email no verificado
puede enviar muchos reenvíos desde distintas IPs. No hay límite a nivel de la cuenta.

**Solución:** Verificar si existe un token de verificación creado hace menos de N minutos
antes de crear y enviar uno nuevo. Si existe uno reciente, devolver silenciosamente (sin error para no revelar info).

```ts
const recent = await this.tokenRepo.findPendingVerificationToken(user.id);
const COOLDOWN_MIN = 5;
if (recent && (Date.now() - recent.createdAt.getTime()) < COOLDOWN_MIN * 60_000) {
  return; // silencioso — no revelar que hay un token reciente
}
```

Requiere añadir `createdAt` al tipo devuelto por `findPendingVerificationToken`.

- [ ] Añadir `createdAt` al resultado de `findPendingVerificationToken`
- [ ] Añadir check de cooldown en `resendVerification`

---

## Notas generales

- El `ACCESS_TOKEN` incluye `tier` y `role` — si el admin cambia el tier de un usuario,
  el cambio no se refleja hasta que el access token (15 min) expire. Aceptable, pero documentarlo.
- El sistema de ip blocklist es fail-open (si la DB falla, deja pasar) — es una decisión de diseño
  correcta para disponibilidad. Está documentada en el código.
- No hay sistema de pagos implementado. El tier se cambia manualmente desde el panel admin.
