# Fourier Web Calculator

A full-stack web application for symbolic computation, visualization, and interactive exploration of Fourier Series and Fourier Transforms. Combines a Maxima-powered mathematical engine with a modern Angular frontend featuring user authentication, calculation history, and a quota system.

**Live:** [fouriersolver.com](https://fouriersolver.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Running in Development](#running-in-development)
- [API Overview](#api-overview)
- [Architecture Notes](#architecture-notes)
- [Branch Strategy](#branch-strategy)

---

## Features

**Mathematical computation**
- Trigonometric Fourier series (symbolic coefficients, exact closed form)
- Complex exponential Fourier series
- Half-range series (sine and cosine expansions)
- Continuous Fourier Transform and its inverse
- Discrete Fourier Transform (DFT/FFT) — from points, from function samples, or from function definition
- Expression parsing (LaTeX → Maxima), simplification, and integrability checks

**Visualization**
- Real-time series reconstruction with adjustable harmonic count
- Amplitude and phase spectrum
- DFT epicycle animation
- Coefficient tables with CSV export

**User system**
- Email/password registration with email verification
- Google OAuth sign-in
- Password reset via email
- JWT authentication with rotating refresh tokens
- Weekly calculation quota (anonymous: 10 / free: 50 / premium: unlimited)
- Calculation history with favorites and rename
- User profile with name editing

**Infrastructure**
- Rate limiting per endpoint and per tier
- LRU cache (in-memory) with optional Redis layer
- Audit log (all auth events and calculations)
- Admin dashboard (user management, history, audit log)
- SEO: per-page meta tags, Open Graph, hreflang, sitemap, robots.txt
- Google Analytics 4 (production only — zero dev pollution)
- Bilingual UI: Spanish and English (Transloco)
- PWA-ready (service worker, manifest)
- SSR via Angular Universal

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, TypeScript, Tailwind CSS 4 |
| Rendering | Angular SSR (Universal), MathJax 4, MathQuill |
| i18n | Transloco (ES / EN) |
| Backend | Express 5, TypeScript, Node.js |
| Math engine | Maxima CAS (via shell subprocess) |
| Database | PostgreSQL 14+ |
| Cache | LRU-cache (always) + Redis (optional) |
| Auth | JWT (access + refresh rotation), Google OAuth 2 |
| Email | Nodemailer (SMTP) |
| API docs | Swagger / OpenAPI (`/api-docs`) |

---

## Project Structure

```
Fourier-Web-Calculator/
├── fourier-backend/        # Express + TypeScript API
│   ├── src/
│   │   ├── api/
│   │   │   ├── middlewares/    # Auth, rate-limit, sanitize, validate, quota
│   │   │   └── routes/         # auth, fourier, transforms, history, admin, …
│   │   ├── application/
│   │   │   ├── auth/           # authService, tokenService
│   │   │   ├── fourier/        # trigonometric, complex, halfRange services
│   │   │   ├── transforms/     # fourierTransform, dft services
│   │   │   └── auxiliary/      # simplify, parse
│   │   ├── domain/
│   │   │   ├── interfaces/     # Repository contracts
│   │   │   └── types/          # Shared type definitions
│   │   ├── infrastructure/
│   │   │   ├── database/       # pg connection pool
│   │   │   ├── persistence/    # UserRepository, HistoryRepository, …
│   │   │   ├── maxima/         # maximaRunner, outputParser, scriptLoader
│   │   │   ├── cache/          # fourierCache (LRU + Redis)
│   │   │   └── email/          # emailService (Nodemailer)
│   │   └── scripts/maxima/     # .mac scripts for each calculation type
│   └── .env.example
│
├── fourier-frontend/       # Angular 21 SPA + SSR
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── guards/         # auth, admin, guest, lang, dev-only
│   │   │   │   ├── interceptors/   # token injection, error handling
│   │   │   │   └── services/       # api, auth, analytics, seo, theme, …
│   │   │   ├── features/
│   │   │   │   ├── home/
│   │   │   │   ├── calculator/     # Main Fourier series calculator
│   │   │   │   ├── transforms/     # Continuous + DFT transforms
│   │   │   │   ├── history/        # Calculation history & favorites
│   │   │   │   ├── profile/        # User profile
│   │   │   │   ├── auth/           # Login, register, forgot/reset password
│   │   │   │   └── admin/          # Admin dashboard
│   │   │   └── shared/             # Reusable components, directives, pipes
│   │   ├── assets/i18n/            # es.json, en.json
│   │   └── environments/           # environment.ts, environment.prod.ts
│   └── public/                     # sitemap.xml, robots.txt, icons
│
├── fourier-database/       # PostgreSQL schema
│   ├── fourier_db.sql      # Full schema (tables, indexes, triggers, enums)
│   └── reset_db.sql        # Drop & recreate for dev
│
├── backend/                # Legacy v0 backend (Node.js/JS) — see archive/v0-legacy
├── frontend/               # Legacy v0 frontend (Angular 18) — see archive/v0-legacy
│
├── Makefile
├── FOURIER_TABLES.md       # Database schema documentation
└── LICENSE
```

---

## Requirements

- **Node.js** 18+
- **npm** 9+
- **Angular CLI** 21+ — `npm install -g @angular/cli`
- **PostgreSQL** 14+
- **Maxima CAS** — *must run on Linux* (see note below)
- **Redis** (optional — falls back to in-memory LRU if unavailable)

### Why Linux for the backend

The backend calls Maxima as a shell subprocess. The invocation syntax and how Node.js pipes stdin/stdout differ between Linux and Windows in ways that break Maxima's output parsing. The application is designed and tested exclusively on Linux (Ubuntu/Debian). The frontend can be developed on any OS.

### Installing Maxima

```bash
# Ubuntu / Debian
sudo apt-get install maxima

# Arch Linux
sudo pacman -S maxima

# macOS (unsupported for production, but works for local testing)
brew install maxima
```

Verify: `maxima --version`

---

## Setup

```bash
git clone https://github.com/TheTortillas/FourierSeriesWebApp.git
cd FourierSeriesWebApp

# Install all dependencies
make install
```

---

## Environment Variables

Copy the example and fill in your values:

```bash
cp fourier-backend/.env.example fourier-backend/.env
```

Key variables:

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/fourier_db

# JWT (generate strong random secrets)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Maxima
MAXIMA_TIMEOUT_MS=15000
MAXIMA_TRANSFORMS_TIMEOUT_MS=60000
MAXIMA_SCRIPTS_PATH=src/scripts/maxima

# Google OAuth (optional — disables Google sign-in if not set)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email / SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=...
SMTP_FROM=noreply@example.com

# URLs
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:4200
FRONTEND_DEFAULT_LANG=es
ALLOWED_ORIGINS=http://localhost:4200

# Weekly calculation limits (-1 = unlimited)
CALC_LIMIT_ANONYMOUS=10
CALC_LIMIT_FREE=50
CALC_LIMIT_PREMIUM=-1

# Redis (optional)
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# Cache (LRU fallback — always active)
CACHE_MAX_SIZE=500
CACHE_TTL_DAYS=7
```

Frontend environment is configured in `fourier-frontend/src/environments/`:
- `environment.ts` — development (GA4 disabled: `ga4Id: ''`)
- `environment.prod.ts` — production (`ga4Id` set, `googleClientId` injected by CI/CD)

---

## Database

```bash
# Create the database
createdb fourier_db

# Apply schema (tables, enums, triggers, indexes)
psql -d fourier_db -f fourier-database/fourier_db.sql
```

The schema includes:
- `persons` + `users` — user accounts with soft-delete
- `user_auth_providers` — Google OAuth linking
- `user_refresh_tokens` — token rotation with family-based reuse detection
- `user_email_tokens` — email verification and password reset tokens
- `calculations` — canonical inputs deduplicated by SHA-256 hash
- `calculation_events` — per-user/IP history, favorites, rename
- `anonymous_calculation_counters` + `user_calculation_counters` — weekly quota with auto-reset trigger
- `audit_log` — immutable event trail (auth, calculations, tier changes)

All primary keys use ULIDs via a custom `gen_ulid()` PostgreSQL function included in the schema.

To reset in development:

```bash
psql -d fourier_db -f fourier-database/reset_db.sql
psql -d fourier_db -f fourier-database/fourier_db.sql
```

---

## Running in Development

```bash
# Both services at once
make dev

# Or separately (recommended — separate terminals)
make dev-backend    # http://localhost:3000  (tsx watch, auto-reload)
make dev-frontend   # http://localhost:4200  (ng serve)
```

Swagger API docs: `http://localhost:3000/api-docs`

---

## API Overview

All routes are prefixed with `/api`.

| Group | Prefix | Description |
|---|---|---|
| Auth | `/api/auth` | Register, login, Google OAuth, token refresh, email verification, password reset, profile, quota |
| Fourier series | `/api/fourier` | Trigonometric, complex, half-range — coefficients and first-N terms |
| Transforms | `/api/transforms` | Continuous Fourier Transform, Inverse FT, DFT (points / samples / function) |
| Parse | `/api/parse` | LaTeX → Maxima expression parsing |
| Simplify | `/api/simplify` | Symbolic simplification |
| History | `/api/history` | CRUD for calculation history and favorites (auth required) |
| Admin | `/api/admin` | User management, audit log, system stats (admin role required) |
| Cache | `/api/cache` | Cache inspection and invalidation |
| Health | `/health` | Liveness check |

Full interactive documentation: `http://localhost:3000/api-docs`

---

## Architecture Notes

**Maxima integration** — Each calculation type has its own `.mac` script under `fourier-backend/src/scripts/maxima/`. The `MaximaRunner` spawns a Maxima subprocess, pipes the script via stdin, captures stdout, and the `MaximaOutputParser` converts the result to JSON. Results are cached by a SHA-256 hash of the input to avoid redundant computation.

**Cache strategy** — Two-tier: in-memory LRU (always active, configurable size/TTL) and Redis (optional). Redis is enabled via `REDIS_ENABLED=true`. If Redis is unavailable, the app falls back to LRU transparently.

**Authentication flow** — Access tokens (15 min) + rotating refresh tokens (30 days). Refresh token rotation uses family tracking to detect token reuse (replay attack prevention). Google OAuth tokens are verified server-side via `google-auth-library`.

**Quota system** — Anonymous users are tracked by IP. Authenticated users have per-account weekly counters stored in PostgreSQL. Counters reset automatically via a trigger every Monday. Limits are configurable per environment variable (`CALC_LIMIT_*`).

**GA4 analytics** — `AnalyticsService` injects the gtag script only when `environment.ga4Id` is non-empty. In development the service exits early and is a no-op, so dev traffic never contaminates analytics.

**SSR** — The Angular frontend uses Angular Universal for server-side rendering. Prerendered routes are defined in `app.routes.server.ts`. `SeoService` sets title, meta description, Open Graph tags, and canonical URL per route. Private pages (profile, history, auth) receive `noindex, nofollow`.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Tagged releases (`v0.9`, …) |
| `develop` | Integration branch — all feature branches merge here first |
| `feat/theory-section` | Long-running branch for theory content and documentation pages |
| `archive/v0-legacy` | Snapshot of the original v0 app (Angular 18 + plain JS backend, no auth) |

Feature branches: `feat/<name>`. Bug fixes: `fix/<name>`. Always branch from `develop`, merge back with `--no-ff`.

---

## License

Custom non-commercial license. See [`LICENSE`](./LICENSE). For commercial use, contact the author.
