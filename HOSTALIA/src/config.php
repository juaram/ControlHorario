<?php
/**
 * Configuración central de la aplicación.
 *
 * Sobrescribir en producción vía variables de entorno del hosting
 * (Hostalia: panel de la aplicación PHP) o, si no es posible, editando
 * este fichero directamente (está protegido por .htaccess).
 *
 *   BASE_PATH      = /horas      (subdirectorio de la URL)
 *   JWT_SECRET     = secreto aleatorio largo
 *   ADMIN_PASSWORD = contraseña inicial del usuario admin (solo primer arranque)
 */

declare(strict_types=1);

// Rutas
define('ROOT', dirname(__DIR__));           // carpeta horas/
define('DATA_DIR', ROOT . '/data');
define('DB_FILE', DATA_DIR . '/horario.db');

// Base de la URL donde vive la app: https://<dominio>/horas
define('BASE_PATH', getenv('BASE_PATH') ?: '/horas');

// Seguridad
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'cambia-este-secreto-por-uno-largo-en-produccion');
define('JWT_TTL', 43200);                    // 12 horas, en segundos
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: 'admin123');

// Verificación de ubicación por geolocalización para el control horario.
// Las coordenadas del puesto se guardan y editan desde el Panel de
// Administración (tabla horas_settings); estos valores solo se usan como
// valor inicial la primera vez. Dejar TRABAJO_LAT/LON sin definir hasta
// configurarlas desde el panel.
define('TRABAJO_LAT', (getenv('TRABAJO_LAT') !== false && is_numeric(getenv('TRABAJO_LAT'))) ? (float)getenv('TRABAJO_LAT') : null);
define('TRABAJO_LON', (getenv('TRABAJO_LON') !== false && is_numeric(getenv('TRABAJO_LON'))) ? (float)getenv('TRABAJO_LON') : null);
define('TRABAJO_RADIO', (int)(getenv('TRABAJO_RADIO') ?: 300)); // metros de tolerancia
define('UBICACION_OBLIGATORIA', getenv('UBICACION_OBLIGATORIA') ?: '1'); // '0' desactiva la comprobación

// Prefijo de tablas (preparado para migrar a MariaDB: horas_users, horas_clock_records)
define('T_USERS', 'horas_users');
define('T_CLOCK', 'horas_clock_records');
define('T_SETTINGS', 'horas_settings');

// Zona horaria (la app es un registro de jornada español)
date_default_timezone_set('Europe/Madrid');