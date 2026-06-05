# 🪶 Alas

> La primera app de citas y comunidad LGBTQ+ hecha desde y para América Latina.

---

## Requisitos previos

- Node.js 20+
- Docker + Docker Compose
- Git

---

## Setup inicial (primera vez)

### 1. Clonar el repo e instalar dependencias

```bash
git clone https://github.com/tu-usuario/alas.git
cd alas
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editá .env con tus valores locales
```

### 3. Levantar PostgreSQL + Redis localmente

```bash
docker-compose up -d
# Verificar que estén corriendo:
docker-compose ps
```

### 4. Crear las tablas en la base de datos

```bash
psql postgresql://alas_user:alas_pass@localhost:5432/alas_db -f infra/db/migrations/001_initial_schema.sql
```

### 5. Arrancar la API en modo desarrollo

```bash
npm run dev:api
# → API en http://localhost:4000
# → Health: http://localhost:4000/health
```

---

## Estructura del proyecto

```
alas/
├── apps/
│   ├── api/          # Node.js + Express + Socket.io
│   └── mobile/       # React Native (Expo) — próximamente
├── packages/
│   ├── shared-types/ # Tipos TypeScript compartidos
│   └── validators/   # Schemas Zod compartidos
├── infra/
│   └── db/
│       └── migrations/  # SQL migrations
├── docker-compose.yml    # Postgres + Redis local
└── .env.example
```

---

## Endpoints disponibles (MVP)

| Método | Ruta | Auth |
|--------|------|------|
| GET    | /health | — |
| POST   | /api/auth/register | — |
| POST   | /api/auth/login | — |
| POST   | /api/auth/refresh | — |
| POST   | /api/auth/logout | ✅ |
| GET    | /api/profiles/me | ✅ |
| PUT    | /api/profiles/me | ✅ |
| GET    | /api/profiles/:id | ✅ |
| GET    | /api/discover | ✅ |
| POST   | /api/likes | ✅ |
| GET    | /api/matches | ✅ |
| GET    | /api/matches/:id/messages | ✅ |

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Mobile | React Native (Expo) |
| API | Node.js + Express + TypeScript |
| DB | PostgreSQL + PostGIS |
| Cache / RT | Redis + Socket.io |
| Storage | Supabase |
| Deploy | Railway |
| CDN / SSL | Cloudflare |
| Pagos | MercadoPago + Stripe |

---

## Deploy en Railway

1. Crear proyecto en [railway.app](https://railway.app)
2. Conectar el repo de GitHub
3. Agregar servicio PostgreSQL y Redis desde el dashboard
4. Copiar las variables de entorno desde `.env.example`
5. Railway deploya automáticamente en cada `git push main`

---

*Desarrollado con 💜 — Alas, 2026*
