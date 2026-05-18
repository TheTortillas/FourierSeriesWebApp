# Guía de despliegue — Fourier Web Calculator

Servidor limpio (Ubuntu/Debian) → sitio en producción.  
Ejecuta los pasos en orden. Los pasos del 1 al 16 son de **instalación inicial**; a partir del 17 es el flujo de **deploy continuo**.

---

## Índice

1. [Base del sistema](#1-base-del-sistema)
2. [Maxima 5.47](#2-maxima-547-compilación-desde-fuente)
3. [Node.js con nvm](#3-nodejs-con-nvm)
4. [PostgreSQL](#4-postgresql)
5. [Redis (opcional)](#5-redis-opcional)
6. [Nginx](#6-nginx)
7. [Estructura de directorios](#7-estructura-de-directorios)
8. [Certificados SSL](#8-certificados-ssl)
9. [Configuración de Nginx](#9-configuración-de-nginx)
10. [El archivo .env](#10-el-archivo-env)
11. [Esquema de base de datos](#11-esquema-de-base-de-datos)
12. [SSH keys — deploy sin contraseña](#12-ssh-keys--deploy-sin-contraseña)
13. [Cómo se generan los builds](#13-cómo-se-generan-los-builds)
14. [Deploy inicial](#14-deploy-inicial)
15. [Lanzar procesos con pm2](#15-lanzar-procesos-con-pm2)
16. [Google OAuth — configuración en Google Cloud Console](#16-google-oauth--configuración-en-google-cloud-console)
17. [Script de deploy continuo](#17-script-de-deploy-continuo)
18. [Solución al error SSRF del frontend](#18-solución-al-error-ssrf-del-frontend)
19. [Reglas del .env](#19-reglas-del-env)
20. [Migraciones de base de datos](#20-migraciones-de-base-de-datos)

---

## 1. Base del sistema

```bash
apt update && apt upgrade -y
apt install -y git curl build-essential sbcl texinfo autoconf automake
```

---

## 2. Maxima 5.47 (compilación desde fuente)

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

> El `make` tarda entre 10 y 20 minutos dependiendo de los recursos de la VM.
> El `export MAXIMA_IMAGESDIR` que aparece en algunos tutoriales **no es necesario** — `sudo make install` instala en las rutas estándar del sistema.

Verificar:

```bash
maxima --version
# Maxima 5.47.0
```

---

## 3. Node.js con nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
source ~/.bashrc

nvm install 22
node -v    # v22.x.x
npm -v

npm install -g pm2
```

> **Nota importante:** nvm carga su PATH en `.bashrc`, que solo se ejecuta en shells interactivas. Las conexiones SSH no interactivas (como las del script de deploy) no ven `pm2` ni `npm` en el PATH. Esto se resuelve en la [sección 12](#12-ssh-keys--deploy-sin-contraseña) usando la ruta completa del binario.

---

## 4. PostgreSQL

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

> **Importante:** `GRANT ALL PRIVILEGES ON DATABASE` solo da permisos de conexión, **no** de tablas. Los permisos a nivel de tabla se otorgan en el [paso 11](#11-esquema-de-base-de-datos) una vez que el schema está creado.

---

## 5. Redis (opcional)

Redis es opcional. Si `REDIS_ENABLED=false` en el `.env`, el backend usa la caché LRU local como respaldo y funciona sin Redis.

```bash
apt install -y redis-server
systemctl enable --now redis-server
```

Verificar:

```bash
redis-cli ping
# PONG
```

---

## 6. Nginx

```bash
apt install -y nginx
systemctl enable --now nginx
```

---

## 7. Estructura de directorios

```bash
mkdir -p /root/fourierWebApp/backend/dist
mkdir -p /root/fourierWebApp/backend/src/scripts
mkdir -p /root/fourierWebApp/frontend
mkdir -p /etc/nginx/ssl/fouriersolver
```

---

## 8. Certificados SSL

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

## 9. Configuración de Nginx

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

    # API
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

## 10. El archivo .env

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

# Cálculos semanales por tier
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

Para generar los JWT secrets (ejecuta dos veces, uno para cada):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 11. Esquema de base de datos

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

> El schema lo crea el superusuario `postgres`, por lo que `fourier_user` hereda solo los permisos de conexión. Sin este `GRANT`, el backend recibe `permission denied for table ...` al primer acceso.

---

## 12. SSH keys — deploy sin contraseña

El script de deploy usa `rsync` y `ssh` para conectarse al servidor. Sin SSH keys, cada conexión pide contraseña. Configúralas **una sola vez** desde tu máquina local:

```bash
# Genera el par de claves (sin passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/fourier_deploy -N ""

# Copia la clave pública al servidor (pedirá contraseña por última vez)
ssh-copy-id -i ~/.ssh/fourier_deploy.pub root@209.46.121.183
```

Verificar que funciona sin contraseña:

```bash
ssh -i ~/.ssh/fourier_deploy root@209.46.121.183 "echo ok"
# ok
```

> A partir de aquí, todas las conexiones al servidor (rsync, ssh) usan esta key automáticamente y no piden contraseña.

---

## 13. Cómo se generan los builds

Los builds se hacen en tu **máquina local**. El servidor solo recibe los archivos compilados y nunca necesita Angular CLI ni TypeScript.

### Backend (TypeScript → JavaScript)

```bash
cd fourier-backend && npm run build
```

Genera `fourier-backend/dist/server.js` (y auxiliares). El servidor ejecuta `node dist/server.js`.

### Frontend (Angular → bundle SSR)

```bash
cd fourier-frontend && npm run build:prod
```

Genera dos carpetas dentro de `dist/fourier-frontend/`:

```
fourier-frontend/dist/fourier-frontend/
├── browser/        ← archivos estáticos (JS, CSS, imágenes)
└── server/
    └── server.mjs  ← servidor SSR que pm2 ejecuta en el puerto 4000
```

> El build del backend tarda ~5 segundos. El de Angular tarda ~2-3 minutos la primera vez.

---

## 14. Deploy inicial

Parado en la raíz del proyecto (`Fourier-Web-Calculator/`), con las SSH keys ya configuradas:

```bash
SERVER="root@209.46.121.183"
SSH="ssh -i ~/.ssh/fourier_deploy"
REMOTE_PATH="/root/.nvm/versions/node/v22.22.2/bin"

# 1. Generar builds
cd fourier-backend && npm run build && cd ..
cd fourier-frontend && npm run build:prod && cd ..

# 2. Subir backend
rsync -az --delete -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-backend/dist/        $SERVER:/root/fourierWebApp/backend/dist/
rsync -az --delete -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-backend/src/scripts/ $SERVER:/root/fourierWebApp/backend/src/scripts/
rsync -az -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-backend/package.json      $SERVER:/root/fourierWebApp/backend/
rsync -az -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-backend/package-lock.json $SERVER:/root/fourierWebApp/backend/

# 3. Subir frontend
rsync -az --delete -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-frontend/dist/fourier-frontend/ $SERVER:/root/fourierWebApp/frontend/

# 4. Instalar dependencias de producción
$SSH $SERVER "export PATH=$REMOTE_PATH:\$PATH && cd /root/fourierWebApp/backend && npm install --omit=dev --silent"
```

> `--delete` elimina del servidor los archivos que ya no existen en el build local, evitando archivos huérfanos.  
> `--omit=dev` instala solo lo necesario para ejecutar (excluye TypeScript, eslint, etc.).

---

## 15. Lanzar procesos con pm2

```bash
ssh -i ~/.ssh/fourier_deploy root@209.46.121.183
```

```bash
# NODE_ENV=production es obligatorio — sin él, el logger intenta cargar pino-pretty
# (no instalado en producción) y el proceso falla al arrancar.
NODE_ENV=production pm2 start /root/fourierWebApp/backend/dist/server.js \
  --name backend \
  --cwd /root/fourierWebApp/backend

pm2 start /root/fourierWebApp/frontend/server/server.mjs \
  --name frontend

pm2 save
pm2 startup
# Copia y ejecuta el comando que muestre pm2 startup
```

Verificar:

```bash
pm2 status
curl http://localhost:3000/health
curl http://localhost:4000
```

> **Si el backend muere con** `unable to determine transport target for "pino-pretty"`:
> el proceso se lanzó sin `NODE_ENV=production`. Solución:
>
> ```bash
> pm2 delete backend
> NODE_ENV=production pm2 start /root/fourierWebApp/backend/dist/server.js \
>   --name backend --cwd /root/fourierWebApp/backend
> pm2 save
> ```

---

## 16. Google OAuth — configuración en Google Cloud Console

El inicio de sesión con Google requiere que el dominio esté autorizado. Sin esto el popup muestra _"no cumple con la política OAuth 2.0 de Google"_.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials → tu OAuth 2.0 client ID**
3. En **Authorized JavaScript origins**, añade:
   ```
   https://fouriersolver.com
   https://www.fouriersolver.com
   ```
4. Guarda. Google tarda ~5 minutos en propagar el cambio.

> El flujo usa ID tokens (popup en el navegador), no authorization code redirect, así que **no** necesitas configurar redirect URIs.

---

## 17. Script de deploy continuo

`deploy.sh` en la raíz del proyecto. Ejecútalo siempre desde ahí.

```bash
chmod +x deploy.sh
bash deploy.sh
```

El script actual (`deploy.sh`):

```bash
#!/bin/bash
set -e

echo "▸ Iniciando deploy..."
SERVER="root@209.46.121.183"
SSH="ssh -i ~/.ssh/fourier_deploy -o StrictHostKeyChecking=no"
RSYNC="rsync -az --delete -e 'ssh -i ~/.ssh/fourier_deploy -o StrictHostKeyChecking=no'"
REMOTE_PATH="/root/.nvm/versions/node/v22.22.2/bin"

# Para pm2 y npm usar la ruta completa del bin de nvm, ya que SSH no interactivo
# no carga .bashrc y no ve el PATH configurado por nvm.

echo "▸ Stop PM2..."
$SSH $SERVER "export PATH=$REMOTE_PATH:\$PATH && pm2 stop all"

echo "▸ Build backend..."
cd fourier-backend && npm run build && cd ..

echo "▸ Build frontend..."
cd fourier-frontend && npm run build:prod && cd ..

echo "▸ Sync backend..."
eval $RSYNC fourier-backend/dist/        $SERVER:/root/fourierWebApp/backend/dist/
eval $RSYNC fourier-backend/src/scripts/ $SERVER:/root/fourierWebApp/backend/src/scripts/
eval $RSYNC fourier-backend/package.json       $SERVER:/root/fourierWebApp/backend/
eval $RSYNC fourier-backend/package-lock.json  $SERVER:/root/fourierWebApp/backend/

echo "▸ Sync frontend..."
eval $RSYNC fourier-frontend/dist/fourier-frontend/ $SERVER:/root/fourierWebApp/frontend/

echo "▸ Install & restart..."
$SSH $SERVER "export PATH=$REMOTE_PATH:\$PATH && cd /root/fourierWebApp/backend && npm install --omit=dev --silent && pm2 restart all"

echo "✓ Deploy completado"
```

**Si actualizas Node en el servidor**, cambia la versión en `REMOTE_PATH` para que coincida con la que retorna `which pm2` en el servidor.

---

## 18. Solución al error SSRF del frontend

Angular 18+ bloquea cualquier petición `HttpClient` a un hostname externo durante el SSR. Si el frontend usa una URL absoluta como `apiUrl`, el SSR lanza:

```
URL with hostname "fouriersolver.com" is not allowed.
```

**La solución ya está aplicada en el código.** Consiste en dos cambios:

### a) `fourier-frontend/src/environments/environment.prod.ts`

```typescript
// ✗ absoluta — bloqueada por SSRF
apiUrl: 'https://fouriersolver.com/api',

// ✓ relativa — Angular SSR la resuelve contra localhost:4000
apiUrl: '/api',
```

### b) `fourier-frontend/src/server.ts` — proxy inverso

El SSR server escucha en el puerto 4000. Cuando un componente hace `GET /api/...` durante el SSR, un proxy lo reenvía al backend real (puerto 3000):

```typescript
import { request as httpRequest } from "node:http";

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

> El proxy solo afecta peticiones SSR internas. Las peticiones del navegador pasan por Nginx directamente al puerto 3000.

**Si aparece este error en producción**, significa que se subió un build anterior al fix:

```bash
cd fourier-frontend && npm run build:prod && cd ..
bash deploy.sh
```

---

## 19. Reglas del .env

|                              | Tu máquina          | Servidor                                                                 |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `.env` (valores reales)      | ✗ nunca             | ✓ solo aquí                                                              |
| `.env.example` (sin valores) | ✓ en git            | ✗ no necesario                                                           |
| Actualizar una variable      | Editar `.env` local | `ssh` → `nano /root/fourierWebApp/backend/.env` → `pm2 restart backend` |
| Añadir nueva variable        | Añadir a `.env.example` en git (sin valor) | SSH al servidor y añadir el valor real al `.env` |

---

## 20. Migraciones de base de datos

Las migraciones se aplican manualmente en producción. Los archivos SQL están en `fourier-database/`.

### v2 — Trazabilidad de bloqueos por rate limit

Añade el valor `rate_limit_blocked` al enum `audit_action`.

```bash
ssh -i ~/.ssh/fourier_deploy root@209.46.121.183 \
  "psql -U fourier_user -d fourier_db -c \"ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rate_limit_blocked';\""
```

### v3 — Hash de email para prevenir re-registro en la misma semana

Añade la columna `deleted_email_hash` a la tabla `users` para bloquear el abuso de borrar y re-crear una cuenta en la misma semana y obtener cuota fresca.

```bash
rsync -e "ssh -i ~/.ssh/fourier_deploy" \
  fourier-database/migrate_v3_deleted_email_hash.sql \
  root@209.46.121.183:/tmp/

ssh -i ~/.ssh/fourier_deploy root@209.46.121.183 \
  "psql -U fourier_user -d fourier_db -f /tmp/migrate_v3_deleted_email_hash.sql"
```

> Todos los scripts de migración usan `IF NOT EXISTS` — son seguros de re-ejecutar.
