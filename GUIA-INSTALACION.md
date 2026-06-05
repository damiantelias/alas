# 🪶 Alas — Guía de instalación paso a paso

Esta guía te lleva desde cero hasta tener la API corriendo en tu computadora.
No necesitás saber nada de servidores — seguí los pasos en orden.

---

## Paso 1 — Instalá Node.js

Bajate Node.js versión 20 desde:
👉 https://nodejs.org/en/download

Elegí "LTS" (la versión estable). Instalalo normalmente como cualquier programa.

Verificá que quedó bien: abrí una terminal y escribí:
```
node --version
```
Tiene que mostrar algo como `v20.x.x`

---

## Paso 2 — Instalá Docker Desktop

Docker es lo que va a correr la base de datos y Redis en tu computadora.
👉 https://www.docker.com/products/docker-desktop/

Instalalo y abrilo. Tiene que quedar corriendo en la barra de tareas.

---

## Paso 3 — Descomprimí el proyecto

Descomprimí el ZIP `alas-proyecto-v3.zip` en una carpeta de tu elección.
Por ejemplo: `C:\proyectos\alas` o `~/proyectos/alas`

---

## Paso 4 — Abrí la terminal en la carpeta del proyecto

En Windows: hacé click derecho dentro de la carpeta → "Abrir en Terminal"
En Mac: arrastrá la carpeta a la Terminal, o usá cd:
```
cd ~/proyectos/alas
```

---

## Paso 5 — Copiá el archivo de configuración

En la terminal escribí:
```
cp .env.example .env
```

El archivo `.env` tiene las configuraciones locales. Para desarrollo local
no necesitás cambiar nada — funciona tal cual.

---

## Paso 6 — Levantá la base de datos y Redis

```
docker-compose up -d
```

Esto descarga e instala PostgreSQL y Redis automáticamente.
La primera vez puede tardar un par de minutos.

Verificá que están corriendo:
```
docker-compose ps
```
Tienen que aparecer dos servicios con estado "Up".

---

## Paso 7 — Creá las tablas en la base de datos

```
docker exec -i alas_postgres psql -U alas_user -d alas_db < infra/db/migrations/001_initial_schema.sql
```

---

## Paso 8 — Instalá las dependencias del proyecto

```
npm install
```

---

## Paso 9 — Arrancá la API

```
npm run dev:api
```

Si todo salió bien vas a ver:

```
🚀 Alas API → http://localhost:4000
📡 Socket.io activo
🔍 Health  → http://localhost:4000/health
🌍 Entorno → development
```

---

## Paso 10 — Verificá que funciona

Abrí tu navegador y entrá a:
👉 http://localhost:4000/health

Tenés que ver algo así:
```json
{
  "ok": true,
  "services": { "postgres": true, "redis": true }
}
```

✅ **Si ves eso, el backend de Alas está corriendo correctamente.**

---

## Comandos útiles del día a día

| Qué querés hacer | Comando |
|---|---|
| Arrancar la API | `npm run dev:api` |
| Parar la base de datos | `docker-compose stop` |
| Arrancar la base de datos | `docker-compose start` |
| Ver logs de la DB | `docker-compose logs postgres` |
| Reiniciar todo | `docker-compose restart` |

---

## Si algo falla

**"Cannot connect to Docker"** → Docker Desktop no está abierto. Abrilo desde el menú de aplicaciones.

**"Port 5432 already in use"** → Tenés PostgreSQL instalado localmente. Pará el servicio o cambiá el puerto en docker-compose.yml.

**"MODULE_NOT_FOUND"** → Falta correr `npm install`. Ejecutalo de nuevo.

**Cualquier otra cosa** → Mandame el mensaje de error y lo resolvemos juntos.

---

*Alas · Backend v0.1 · 2026*

---

## Cómo pasar el ZIP desde el celular a la PC

### Con Google Drive (recomendado)

1. En el celular, abrí Google Drive
2. Tocá el botón "+" y elegí "Subir"
3. Seleccioná el archivo `alas-proyecto-v4.zip`
4. Esperá que suba (son pocos MB, va rápido)
5. En la PC, abrí drive.google.com en el navegador
6. Buscá el archivo, hacé click derecho → "Descargar"
7. Descomprimilo y seguí los pasos de instalación de arriba

### Con TeraBox

1. En el celular, subí el ZIP a TeraBox igual que con Drive
2. En la PC entrá a terabox.com
3. Bajá el archivo y descomprimilo

---
