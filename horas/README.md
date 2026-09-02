# Control Horario — versión PHP 8 + React 19 (Hostalia)

Aplicación de registro de jornada laboral (RD 8/2019) reescrita para **PHP 8+ en
Hostalia** (sin Node.js en producción):

- **Backend**: PHP 8 (PDO + SQLite, router propio, JWT HS256 sin dependencias de Composer)
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4 (build estático)
- **Base de datos**: SQLite (`data/horario.db`) con tablas con prefijo `horas_`
- **URL**: `https://<dominio>/horas`

## Estructura

```
horas/
├── .htaccess          → API a api/index.php + SPA a index.html + cabecera Authorization
├── api/index.php      → front controller y router propio
├── src/               → config, PDO, JWT y controladores (PROTEGIDO: .htaccess)
├── data/              → horario.db (se crea sola; PROTEGIDO: .htaccess)
├── index.html         → SPA compilada (se genera con el build)
├── assets/            → JS/CSS del build (se generan con el build)
├── dev-router.php     → solo para pruebas locales (php -S)
├── schema.sql         → esquema de referencia
└── app/               → fuente React (NO se sube al hosting)
```

## Carpeta de despliegue: HOSTALIA/

El desplegable se genera en **`HOSTALIA/`** (raíz del proyecto), no en un zip:

```bash
cd horas/app
npm run build:prod   # typecheck + build + copia el desplegable a HOSTALIA/
```

`HOSTALIA/` contiene exactamente lo que hay que subir: `index.html`, `assets/`,
`api/`, `src/`, `.htaccess`, `schema.sql` y `data/` (con `.htaccess` de
protección, sin base de datos local).

## Despliegue en Hostalia

1. Sube el **contenido de `HOSTALIA/`** a la carpeta que tu hosting mapea a
   `https://<dominio>/horas` (gestor de archivos o FTP). No hace falta
   `npm install` ni Composer en el servidor: es PHP + ficheros estáticos.

2. Asegúrate de que el hosting usa **PHP 8.x** y tiene habilitada la extensión
   **`pdo_sqlite`** (Hostalia: panel → Ajustes PHP / versión y extensiones).
   Apache debe permitir `.htaccess` (es lo habitual).

3. Configura los secretos (según lo que permita tu plan):
   - **Si Hostalia permite variables de entorno** en la app: define
     `JWT_SECRET=<secreto largo aleatorio>` y `ADMIN_PASSWORD=<contraseña fuerte>`.
   - **Si no**: edita `src/config.php` directamente con esos valores (el fichero
     está protegido contra acceso web).

4. Revisa que la carpeta `data/` tenga permisos de escritura para el usuario de
   PHP (suele ser suficiente con 775).

5. Entra en `https://<dominio>/horas`.

El primer arranque crea automáticamente la base de datos y el usuario admin
(página: `admin`, contraseña: `ADMIN_PASSWORD` o `admin123` por defecto).

> Tras generar de nuevo el desplegable, revisa que `HOSTALIA/data/` solo
> contenga `.htaccess` (sin `horario.db`) antes de subir, para que en el
> servidor se cree la base de datos nueva.

## Verificación por geolocalización en el puesto

Para que el empleado no pueda fichar desde fuera (por ejemplo, desde el autobús),
la app puede exigir que el móvil esté **cerca del puesto de trabajo** al iniciar
y finalizar la jornada:

1. En el **Panel de Administración** tienes la tarjeta **«Ubicación del puesto
   de trabajo»**: guarda la **latitud y longitud** del centro (botón *Usar mi
   ubicación actual*, o escríbelas) y el **radio permitido** en metros.
2. Al **iniciar y finalizar la jornada**, el móvil pide permiso de ubicación
   (solo en ese momento, no hay seguimiento continuo) y la envía con el fichaje.
3. El servidor calcula la distancia al puesto (fórmula del haversine) y
   **rechaza el fichaje si supera el radio**: «Estás a X m del puesto de
   trabajo (máximo permitido: Y m)…». Las **pausas no exigen ubicación**.
4. Cada fichaje guarda en el registro la **auditoría**: latitud, longitud,
   precisión, distancia al puesto, IP y navegador.
5. Si el empleado deniega el permiso de ubicación en el navegador, el fichaje
   se rechaza con un mensaje claro pidiendo que lo active.

Configuración (variables de entorno o `src/config.php`), guardada también en
la tabla `horas_settings` y editable desde el panel de administración:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `TRABAJO_LAT` / `TRABAJO_LON` | vacío | Coordenadas del puesto (si están vacías y la verificación está activa, el fichaje se permite sin comprobar) |
| `TRABAJO_RADIO` | `300` | Radio permitido en metros |
| `UBICACION_OBLIGATORIA` | `1` | `0` desactiva la comprobación temporalmente (solo pruebas) |

## Probar en local (misma estructura que producción)

Requisitos: PHP 8 CLI con `pdo_sqlite`.

```bash
cd horas
php -S 127.0.0.1:8080 dev-router.php
# Abre http://127.0.0.1:8080/horas
```

## Recompilar el frontend (solo si cambias algo de React)

Necesitas Node.js en tu máquina de desarrollo (no en el servidor):

```bash
cd horas/app
npm install
npm run build:prod    # typecheck + build + genera el desplegable en HOSTALIA/
```

## API (mismo contrato que la app Node original)

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register` (admin), `POST /api/auth/change-password` (sin contraseña anterior si el admin marcó el cambio forzado)
- `GET /api/clock/status`, `POST /api/clock/clock-in|clock-out|break-start|break-end|notes` (entrada/salida aceptan `lat`,`lon`,`accuracy` y se validan contra la ubicación del puesto si está activa)
- `GET /api/clock/history`, `GET /api/clock/today`
- `GET /api/admin/users`, `POST /api/admin/users/{id}` (editar; POST y no PUT porque los hostings compartidos rechazan PUT en PHP), `POST /api/admin/users/{id}/delete` (eliminar solo si el usuario no tiene registros de fichaje; tampoco admite borrar administradores ni el propio usuario; POST en lugar de DELETE por el mismo motivo), `GET /api/admin/records`, `POST /api/admin/records/{id}` (corregir registro: fecha, entrada/salida, pausas y notas; recalcula el total), `POST /api/admin/records/{id}/delete` (eliminar; POST en lugar de DELETE por el mismo motivo)
- `GET /api/admin/config`, `POST /api/admin/config` (ver/guardar latitud, longitud, radio y nombre del lugar del puesto; si el nombre está vacío, el panel lo rellena automáticamente con la dirección de OpenStreetMap/Nominatim antes de guardar)
- `GET /api/admin/stats`, `GET /api/admin/export` (CSV)

## Contexto de la migración

Sustituye a la versión Node.js (Express + sql.js) que había antes; estas
instrucciones asumen que **no se necesitan los datos antiguos** (la BD se
crea nueva en el primer arranque). Los hashes bcrypt son compatibles: si algún
día quieres importar usuarios antiguos, `password_verify()` los acepta tal cual.