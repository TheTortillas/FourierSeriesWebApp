# Guía de despliegue — Fourier Web Calculator v0.9.1

Servidor limpio (Ubuntu/Debian) → sitio en producción.

---

## Índice

1. [Base del sistema](#1-base-del-sistema)
2. [Node.js con nvm](#2-nodejs-con-nvm)
3. [PostgreSQL](#3-postgresql)
   3b. [Redis](#3b-redis)
4. [Nginx](#4-nginx)
5. [Estructura de directorios](#5-estructura-de-directorios)
6. [Certificados SSL](#6-certificados-ssl)
7. [Configuración de Nginx](#7-configuración-de-nginx)
8. [El archivo .env](#8-el-archivo-env)
9. [Esquema de base de datos](#9-esquema-de-base-de-datos)
10. [Cómo funciona rsync](#10-cómo-funciona-rsync)
11. [Cómo se generan los builds](#11-cómo-se-generan-los-builds)
12. [Deploy inicial](#12-deploy-inicial)
13. [Lanzar procesos con pm2](#13-lanzar-procesos-con-pm2)
14. [Script de deploy futuro](#14-script-de-deploy-futuro)
15. [Solución al error SSRF del frontend](#15-solución-al-error-ssrf-del-frontend)
16. [Google OAuth — configuración en Google Cloud Console](#16-google-oauth--configuración-en-google-cloud-console)
17. [Reglas del .env](#17-reglas-del-env)

---

## 1. Base del sistema

```bash
apt update && apt upgrade -y
apt install -y git curl build-essential sbcl texinfo autoconf automake
```

---

## 1b. Maxima 5.47 (compilación desde fuente)

Los repositorios de Ubuntu/Debian incluyen la versión **5.46**. La aplicación requiere **5.47**, que debe compilarse desde fuente.

```bash
cd ~
wget https://sourceforge.net/projects/maxima/files/Maxima-source/5.47.0-source/maxima-5.47.0.tar.gz
tar -xzf maxima-5.47.0.tar.gz
cd maxima-5.47.0
./configure --with-sbcl
make -j$(nproc)
sudo make install
cd ~ && rm -rf maxima-5.47.0 maxima-5.47.0.tar.gz
```

> El `make` tarda entre 10 y 20 minutos dependiendo de los recursos de la VM. Es normal.
> El `export MAXIMA_IMAGESDIR` que aparece en algunos tutoriales **no es necesario** — `sudo make install` instala en las rutas estándar del sistema.

Verificar:

```bash
maxima --version
# Maxima 5.47.0
```

---

## 2. Node.js con nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
source ~/.bashrc

nvm install 22
node -v    # v22.x.x
npm -v

npm install -g pm2
```

---

## 3. PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
```

Crear usuario y base de datos:

```bash
sudo -u postgres psql <<SQL
CREATE USER fourier_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
CREATE DATABASE fourier_db OWNER fourier_user;
GRANT ALL PRIVILEGES ON DATABASE fourier_db TO fourier_user;
SQL
```

> **Importante:** `GRANT ALL PRIVILEGES ON DATABASE` solo da permisos de conexión,
> **no** de tablas. Los permisos a nivel de tabla se otorgan en el [paso 9](#9-esquema-de-base-de-datos)
> una vez que el schema está creado.

---

## 3b. Redis

Redis es opcional, pero si quieres activar `REDIS_ENABLED=true` en el backend necesitas que el servidor Redis exista y esté en ejecución. Si no está disponible, el backend no se cae: usa la caché LRU local como respaldo.

### Redis en el mismo servidor

```bash
apt install -y redis-server
systemctl enable --now redis-server
```

Verificar:

```bash
redis-cli ping
# PONG

curl http://localhost:3000/api/cache/stats
# debe mostrar backend: "redis" y connected: true
```

### Redis en un servidor externo

Si usas un Redis gestionado o una máquina aparte, no instales `redis-server` aquí. Solo cambia `REDIS_URL` en el `.env` para apuntar al host correcto y verifica que el puerto esté accesible desde el backend.

---

## 4. Nginx

```bash
apt install -y nginx
systemctl enable --now nginx
```

---

## 5. Estructura de directorios

```bash
mkdir -p /root/fourierWebApp/backend/dist
mkdir -p /root/fourierWebApp/backend/src/scripts
mkdir -p /root/fourierWebApp/frontend
mkdir -p /etc/nginx/ssl/fouriersolver
```

---

## 6. Certificados SSL

Desde tu máquina local, sube los archivos del certificado:

```bash
rsync tu_cert.cer \
  root@fouriersolver.com:/etc/nginx/ssl/fouriersolver/fouriersolver.com_ssl_certificate.cer

rsync tu_key.key \
  root@fouriersolver.com:/etc/nginx/ssl/fouriersolver/_.fouriersolver.com_private_key.key
```

En el servidor:

```bash
chmod 600 /etc/nginx/ssl/fouriersolver/*
chown root:root /etc/nginx/ssl/fouriersolver/*
```

---

## 7. Configuración de Nginx

```bash
nano /etc/nginx/sites-available/fouriersolver
```

```nginx
upstream angular {
    server 127.0.0.1:4000;
}

upstream api {
    server 127.0.0.1:3000;
}

# HTTP → HTTPS
server {
    listen 80;
    server_name fouriersolver.com www.fouriersolver.com;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl;
    server_name fouriersolver.com www.fouriersolver.com;

    ssl_certificate     /etc/nginx/ssl/fouriersolver/fouriersolver.com_ssl_certificate.cer;
    ssl_certificate_key /etc/nginx/ssl/fouriersolver/_.fouriersolver.com_private_key.key;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # API — sin diagonal al final para preservar el prefijo /api/
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Angular SSR
    location / {
        proxy_pass http://angular;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 20m;
}
```

```bash
ln -s /etc/nginx/sites-available/fouriersolver /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 8. El archivo .env

El `.env` **vive únicamente en el servidor** y nunca se sube a git. Se crea una sola vez manualmente.

```bash
nano /root/fourierWebApp/backend/.env
```

```env
# Server
PORT=3000
NODE_ENV=production

# Maxima
MAXIMA_TIMEOUT_MS=15000
MAXIMA_TRANSFORMS_TIMEOUT_MS=60000
MAXIMA_SCRIPTS_PATH=/root/fourierWebApp/backend/src/scripts/maxima

# Cache
CACHE_MAX_SIZE=500
CACHE_TTL_DAYS=7

# Redis (actívalo solo si redis-server está instalado y accesible)
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_GENERAL=100
RATE_LIMIT_MAX_COMPUTE=20
RATE_LIMIT_MAX_PARSE=200
RATE_LIMIT_MAX_COMPUTE_AUTH=120
RATE_LIMIT_PARSE_BURST_WINDOW_MS=60000
RATE_LIMIT_MAX_PARSE_BURST_ANON=120
RATE_LIMIT_MAX_PARSE_BURST_AUTH=240
RATE_LIMIT_MAX_PARSE_ANON=400
RATE_LIMIT_MAX_PARSE_AUTH=1500
RATE_LIMIT_MAX_AUTH=200
RATE_LIMIT_AUTH_SIGNIN_WINDOW_MS=900000
RATE_LIMIT_MAX_AUTH_SIGNIN=30
RATE_LIMIT_MAX_AUTH_RECOVERY=40

# Database
DATABASE_URL=postgresql://fourier_user:CAMBIA_ESTA_PASSWORD@localhost:5432/fourier_db

# JWT — genera con: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_ACCESS_SECRET=GENERA_UN_SECRET_AQUI
JWT_REFRESH_SECRET=GENERA_OTRO_SECRET_AQUI
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret

# Cálculos
CALC_LIMIT_ANONYMOUS=10
CALC_LIMIT_FREE=50
CALC_LIMIT_PREMIUM=-1

# Email SMTP
SMTP_HOST=smtp.ionos.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@fouriersolver.com
SMTP_PASS=tu_password_smtp
SMTP_FROM=noreply@fouriersolver.com

# URLs
APP_URL=https://fouriersolver.com
FRONTEND_URL=https://fouriersolver.com
FRONTEND_DEFAULT_LANG=es
ALLOWED_ORIGINS=https://fouriersolver.com,https://www.fouriersolver.com
```

Para generar los JWT secrets (ejecuta dos veces):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 9. Esquema de base de datos

Desde tu máquina local, **parado en la raíz del proyecto**:

```bash
rsync fourier-database/fourier_db.sql root@fouriersolver.com:/tmp/
ssh root@fouriersolver.com "sudo -u postgres psql -d fourier_db -f /tmp/fourier_db.sql"
```

Verificar que las tablas se crearon:

```bash
ssh root@fouriersolver.com "sudo -u postgres psql -d fourier_db -c '\dt'"
```

**Después de cargar el schema**, otorga permisos de tabla a `fourier_user`:

```bash
ssh root@fouriersolver.com "sudo -u postgres psql -d fourier_db <<SQL
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fourier_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fourier_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO fourier_user;
SQL"
```

> El schema lo crea el superusuario `postgres`, por lo que `fourier_user` hereda
> solo los permisos de conexión. Sin este `GRANT`, el backend recibe
> `permission denied for table ...` al primer acceso.

---

## 10. Cómo funciona rsync

`rsync` transfiere archivos desde tu máquina local al servidor **solo los que cambiaron**, lo que lo hace mucho más rápido que SFTP en actualizaciones futuras.

**Sintaxis:**

```
rsync -az  <origen_local>  <usuario@servidor:destino_remoto>
           ^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
           ruta en tu PC   ruta en el servidor
```

- `-a` — preserva permisos, fechas y estructura de carpetas
- `-z` — comprime los datos en tránsito

**Dónde ejecutarlo:** siempre desde la **raíz del proyecto** (`Fourier-Web-Calculator/`). Las rutas locales son relativas a esa carpeta:

```
Fourier-Web-Calculator/          ← aquí ejecutas todos los comandos
├── fourier-backend/
│   ├── dist/                    ← rsync -az fourier-backend/dist/ ...
│   └── src/scripts/             ← rsync -az fourier-backend/src/scripts/ ...
├── fourier-frontend/
│   └── dist/fourier-frontend/   ← rsync -az fourier-frontend/dist/fourier-frontend/ ...
└── deploy.sh
```

**La diagonal al final importa:**

```bash
# Con diagonal — sube el CONTENIDO de dist/ (los archivos dentro)
rsync -az fourier-backend/dist/  servidor:/ruta/backend/dist/

# Sin diagonal — subiría la CARPETA dist dentro del destino (no es lo que queremos)
rsync -az fourier-backend/dist   servidor:/ruta/backend/dist/
```

**Requisito:** tu clave SSH debe estar configurada para conectar al servidor sin contraseña. Si ya puedes hacer `ssh root@fouriersolver.com` sin que te pida password, rsync funciona igual de automático.

---

## 11. Cómo se generan los builds

Los builds se hacen en tu **máquina local** antes de subir. El servidor solo recibe los archivos compilados y nunca necesita instalar Angular CLI ni TypeScript.

### Backend (TypeScript → JavaScript)

```bash
cd fourier-backend
npm run build
```

- Ejecuta `tsc` (TypeScript compiler)
- Lee `fourier-backend/src/server.ts` y todo lo que importa
- Genera `fourier-backend/dist/server.js` (y archivos auxiliares)
- El servidor ejecutará `node dist/server.js`

```
fourier-backend/
├── src/          ← código fuente TypeScript (lo que editas)
└── dist/         ← código compilado JavaScript (lo que sube al servidor)
    └── server.js
```

### Frontend (Angular → bundle optimizado + SSR)

```bash
cd fourier-frontend
npm run build:prod
```

- Ejecuta `ng build --configuration production`
- Compila, minimifica y optimiza todo el código Angular
- Genera dos carpetas dentro de `dist/fourier-frontend/`:

```
fourier-frontend/dist/fourier-frontend/
├── browser/        ← archivos estáticos (JS, CSS, imágenes, index.html)
└── server/
    └── server.mjs  ← servidor SSR que pm2 ejecuta en el servidor
```

- El `server.mjs` sirve el HTML pre-renderizado (SSR) en el puerto 4000
- Nginx redirige todo el tráfico web hacia ese puerto

> **Tiempo aproximado:** el build del backend tarda ~5 segundos. El de Angular tarda ~2-3 minutos la primera vez.

---

## 12. Deploy inicial

Parado en la raíz del proyecto (`Fourier-Web-Calculator/`):

```bash
SERVER="root@fouriersolver.com"

# 1. Generar los builds
cd fourier-backend && npm run build && cd ..
cd fourier-frontend && npm run build:prod && cd ..

# 2. Subir backend compilado
rsync -az fourier-backend/dist/              $SERVER:/root/fourierWebApp/backend/dist/
rsync -az fourier-backend/src/scripts/       $SERVER:/root/fourierWebApp/backend/src/scripts/
rsync -az fourier-backend/package.json       $SERVER:/root/fourierWebApp/backend/
rsync -az fourier-backend/package-lock.json  $SERVER:/root/fourierWebApp/backend/

# 3. Subir frontend compilado
rsync -az fourier-frontend/dist/fourier-frontend/ $SERVER:/root/fourierWebApp/frontend/

# 4. Instalar dependencias de producción del backend en el servidor
ssh $SERVER "cd /root/fourierWebApp/backend && npm install --omit=dev --silent"
```

> `--omit=dev` instala solo lo necesario para ejecutar (excluye TypeScript, eslint, etc.).
> El frontend no necesita `npm install` en el servidor — solo se ejecuta el `server.mjs`.

---

## 13. Lanzar procesos con pm2

```bash
ssh root@fouriersolver.com
```

```bash
# NODE_ENV=production es obligatorio — sin él, pino intenta cargar pino-pretty
# (que no está instalado en producción) y el proceso falla al arrancar.
NODE_ENV=production pm2 start /root/fourierWebApp/backend/dist/server.js \
  --name backend \
  --cwd /root/fourierWebApp/backend

pm2 start /root/fourierWebApp/frontend/server/server.mjs \
  --name frontend

pm2 save
pm2 startup
# Copia y ejecuta el comando que te muestre pm2 startup
```

Verificar que todo funciona:

```bash
pm2 status
curl http://localhost:3000/health
curl http://localhost:4000
```

> **Si el backend muere con** `unable to determine transport target for "pino-pretty"`:
> el proceso se lanzó sin `NODE_ENV=production`. El logger intenta usar pino-pretty
> (modo dev), pero no está instalado (`--omit=dev`). Solución:
>
> ```bash
> pm2 delete backend
> NODE_ENV=production pm2 start /root/fourierWebApp/backend/dist/server.js \
>   --name backend --cwd /root/fourierWebApp/backend
> pm2 save
> ```

---

## 14. Script de deploy futuro

Guarda esto como `deploy.sh` en la raíz del proyecto y dale permisos (`chmod +x deploy.sh`).
Ejecútalo siempre desde la raíz del proyecto.

```bash
#!/bin/bash
set -e

SERVER="root@fouriersolver.com"

echo "▸ Build backend..."
cd fourier-backend && npm run build && cd ..

echo "▸ Build frontend..."
cd fourier-frontend && npm run build:prod && cd ..

echo "▸ Sync backend..."
rsync -az fourier-backend/dist/              $SERVER:/root/fourierWebApp/backend/dist/
rsync -az fourier-backend/src/scripts/       $SERVER:/root/fourierWebApp/backend/src/scripts/
rsync -az fourier-backend/package.json       $SERVER:/root/fourierWebApp/backend/
rsync -az fourier-backend/package-lock.json  $SERVER:/root/fourierWebApp/backend/

echo "▸ Sync frontend..."
rsync -az fourier-frontend/dist/fourier-frontend/ $SERVER:/root/fourierWebApp/frontend/

echo "▸ Install & restart..."
ssh $SERVER "cd /root/fourierWebApp/backend && npm install --omit=dev --silent && pm2 restart all"

echo "✓ Deploy completado"
```

Uso:

```bash
bash deploy.sh
```

---

## 15. Solución al error SSRF del frontend

Angular 18+ bloquea cualquier petición `HttpClient` a un hostname externo durante el
SSR (renderizado en servidor). Si el frontend usa una URL absoluta como `apiUrl`,
el SSR lanza:

```
URL with hostname "fouriersolver.com" is not allowed.
```

**La solución ya está aplicada en el código** (desde v0.9.1). Consiste en dos cambios:

### a) `fourier-frontend/src/environments/environment.prod.ts`

```typescript
// ✗ absoluta — bloqueada por SSRF
apiUrl: 'https://fouriersolver.com/api',

// ✓ relativa — Angular SSR la resuelve contra localhost:4000
apiUrl: '/api',
```

### b) `fourier-frontend/src/server.ts` — proxy inverso

El SSR server escucha en el puerto 4000. Cuando un componente hace `GET /api/...`
durante el SSR, la petición llega al propio servidor Express. Un proxy
la reenvía al backend real (puerto 3000):

```typescript
import { request as httpRequest } from "node:http";

// Antes del bloque de archivos estáticos:
app.use("/api", (req, res) => {
  const backendReq = httpRequest(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api" + (req.url ?? ""),
      method: req.method,
      headers: { ...req.headers, host: "localhost:3000" },
    },
    (backendRes) => {
      res.writeHead(backendRes.statusCode ?? 502, backendRes.headers);
      backendRes.pipe(res, { end: true });
    },
  );
  backendReq.on("error", () => res.status(502).end());
  req.pipe(backendReq, { end: true });
});
```

> El proxy solo afecta peticiones SSR internas. Las peticiones del navegador
> pasan primero por Nginx, que las enruta directamente al puerto 3000 sin
> pasar por el SSR server.

**Si aparece este error en producción**, significa que se subió un build
anterior al fix. La solución es reconstruir el frontend y redeplegar:

```bash
cd fourier-frontend && npm run build:prod && cd ..
rsync -az fourier-frontend/dist/fourier-frontend/ root@fouriersolver.com:/root/fourierWebApp/frontend/
ssh root@fouriersolver.com "pm2 restart frontend"
```

---

## 16. Google OAuth — configuración en Google Cloud Console

El inicio de sesión con Google requiere que el dominio de producción esté
autorizado en Google Cloud Console. Sin esto, el popup muestra el error
_"no cumple con la política OAuth 2.0 de Google"_.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials → tu OAuth 2.0 client ID**
3. En **Authorized JavaScript origins**, añade:
   ```
   https://fouriersolver.com
   https://www.fouriersolver.com
   ```
4. Guarda. Google tarda ~5 minutos en propagar el cambio.

> El flujo usa ID tokens (popup en el navegador), no authorization code redirect,
> así que **no** necesitas configurar redirect URIs.

---

## 18. Migraciones de base de datos

### 2025-05 — Trazabilidad de bloqueos por rate limit

Añade el valor `rate_limit_blocked` al enum `audit_action` para registrar cada
solicitud bloqueada por el rate limiter directamente en `audit_log`.

**Ejecutar una sola vez en producción (no destructivo, no requiere lock de tabla):**

```sql
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rate_limit_blocked';
```

**Cómo aplicarlo:**

```bash
ssh root@fouriersolver.com
psql -U fourier_user -d fourier_db -c "ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rate_limit_blocked';"
# No hace falta reiniciar el backend — el tipo se recarga automáticamente.
```

> `IF NOT EXISTS` hace el comando idempotente: seguro de re-ejecutar.
> Tras esto, el backend empezará a insertar filas en `audit_log` con
> `action = 'rate_limit_blocked'` en cada 429, incluyendo la IP, el
> endpoint, el limiter y el método HTTP en la columna `metadata`.

---

## 17. Reglas del .env

|                              | Tu máquina                                  | Servidor                                                                |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `.env` (valores reales)      | ✗ nunca                                     | ✓ solo aquí                                                             |
| `.env.example` (sin valores) | ✓ en git                                    | ✗ no necesario                                                          |
| Actualizar una variable      | Editar `.env` local                         | `ssh` → `nano /root/fourierWebApp/backend/.env` → `pm2 restart backend` |
| Añadir nueva variable        | Añadir al `.env.example` en git (sin valor) | SSH al servidor y añadir el valor real al `.env`                        |
