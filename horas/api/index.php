<?php
/**
 * Front controller de la API.
 *
 * En producción, .htaccess reescribe /horas/api/* → este fichero.
 * Para pruebas locales: php -S 127.0.0.1:8080 dev-router.php (mismo resultado).
 *
 * Enrutador propio, sin dependencias de Composer.
 */

declare(strict_types=1);

require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/controllers/AuthController.php';
require_once __DIR__ . '/../src/controllers/ClockController.php';
require_once __DIR__ . '/../src/controllers/AdminController.php';

// 1. Normalizar la ruta: quitar la base (/horas) del path
$uri  = rawurldecode($_SERVER['REQUEST_URI'] ?? '/');
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
$base = BASE_PATH === '/' ? '' : BASE_PATH;
if ($base !== '' && $path === $base) {
    $path = '/';
} elseif ($base !== '' && str_starts_with($path, $base . '/')) {
    $path = substr($path, strlen($base));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 2. Rutas estáticas
$rutas = [
    'POST /api/auth/login'          => ['AuthController', 'login'],
    'GET /api/auth/me'              => ['AuthController', 'me'],
    'POST /api/auth/register'       => ['AuthController', 'register'],
    'POST /api/auth/change-password' => ['AuthController', 'changePassword'],

    'GET /api/clock/status'     => ['ClockController', 'status'],
    'POST /api/clock/clock-in'  => ['ClockController', 'clockIn'],
    'POST /api/clock/clock-out' => ['ClockController', 'clockOut'],
    'POST /api/clock/break-start' => ['ClockController', 'breakStart'],
    'POST /api/clock/break-end'   => ['ClockController', 'breakEnd'],
    'POST /api/clock/notes'       => ['ClockController', 'notes'],
    'GET /api/clock/history'      => ['ClockController', 'history'],
    'GET /api/clock/today'        => ['ClockController', 'today'],

    'GET /api/admin/users'      => ['AdminController', 'users'],
    'GET /api/admin/config'     => ['AdminController', 'getConfig'],
    'POST /api/admin/config'    => ['AdminController', 'updateConfig'],
    'GET /api/admin/records'    => ['AdminController', 'records'],
    'GET /api/admin/stats'      => ['AdminController', 'stats'],
    'GET /api/admin/export'     => ['AdminController', 'exportCsv'],
];

$key = $method . ' ' . $path;
if (isset($rutas[$key])) {
    [$clase, $metodo] = $rutas[$key];
    (new $clase())->$metodo();
    exit;
}

// 3. Rutas dinámicas
// Hostalia (hosting compartido) bloquea PUT en scripts PHP con 405, por eso
// se acepta POST (y PUT por compatibilidad con clientes antiguos).
if (($method === 'POST' || $method === 'PUT') && preg_match('#^/api/admin/users/(\d+)$#', $path, $m)) {
    (new AdminController())->updateUser((int)$m[1]);
    exit;
}
// Borrar usuario (solo si no tiene registros): POST para evitar el 405 de Hostalia
if ($method === 'POST' && preg_match('#^/api/admin/users/(\d+)/delete$#', $path, $m)) {
    (new AdminController())->deleteUser((int)$m[1]);
    exit;
}
if ($method === 'DELETE' && preg_match('#^/api/admin/users/(\d+)$#', $path, $m)) {
    (new AdminController())->deleteUser((int)$m[1]);
    exit;
}
if (($method === 'POST' || $method === 'PUT') && preg_match('#^/api/admin/records/(\d+)$#', $path, $m)) {
    (new AdminController())->updateRecord((int)$m[1]);
    exit;
}
// Borrar registro: POST para evitar el 405 que Hostalia da a PUT/DELETE directos
if ($method === 'POST' && preg_match('#^/api/admin/records/(\d+)/delete$#', $path, $m)) {
    (new AdminController())->deleteRecord((int)$m[1]);
    exit;
}
if ($method === 'DELETE' && preg_match('#^/api/admin/records/(\d+)$#', $path, $m)) {
    (new AdminController())->deleteRecord((int)$m[1]);
    exit;
}

responderError('Ruta no encontrada', 404);