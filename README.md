# Control Horario — Registro de Jornada Laboral

Aplicación para el registro de jornada laboral: **backend PHP 8** (API REST con
PDO + SQLite) y **frontend React 19 / TypeScript / Vite / Tailwind CSS 4**.

## Estructura

| Carpeta | Contenido |
|---|---|
| `horas/` | Código fuente completo (backend PHP + frontend React) |
| `HOSTALIA/` | Desplegable listo para subir a Hostalia en `https://<dominio>/horas` |

## Documentación

Instalación, configuración, despliegue en Hostalia y API: [`horas/README.md`](horas/README.md).

Para regenerar el desplegable tras cambios en el frontend:

```bash
cd horas/app
npm run build:prod   # typecheck + build + genera el desplegable en HOSTALIA/
```
