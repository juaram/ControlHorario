<?php
/**
 * Router de desarrollo para pruebas locales SIN Apache.
 *
 * Uso (desde la carpeta horas/):
 *   php -S 127.0.0.1:8080 dev-router.php
 *
 * Emula el .htaccess de producción: sirve la API en /horas/api/*,
 * los ficheros estáticos del build y el index.html (SPA) para el resto.
 */

declare(strict_types=1);

$uri  = rawurldecode($_SERVER['REQUEST_URI'] ?? '/');
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

$base = getenv('BASE_PATH') ?: '/horas';
if ($base !== '' && $path === $base) {
    $path = $base . '/';
} elseif ($base !== '' && str_starts_with($path, $base . '/')) {
    $resto = substr($path, strlen($base));
    $path = $resto === '' ? '/' : $resto;
}

// API → front controller (idéntico comportamiento que en Apache)
if (str_starts_with($path, '/api')) {
    $_SERVER['REQUEST_URI'] = $base . $path;
    require __DIR__ . '/api/index.php';
    return true;
}

// Proteger src/ y data/ igual que el .htaccess de producción
if (preg_match('#^/(src|data)(/|$)#', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Acceso denegado';
    return true;
}

// Ficheros reales (assets del build): deja que php -S los sirva
$file = __DIR__ . $path;
if (is_file($file) && !str_contains($path, '..')) {
    return false;
}

// SPA: todo lo demás → index.html
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
return true;