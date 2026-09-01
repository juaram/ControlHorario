<?php
/**
 * Utilidades de la API: JWT HS256 propio (sin dependencias), respuestas
 * JSON y autenticación (middleware de rol).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

/* ---------- JWT (HS256) ---------- */

function b64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwtEncode(array $payload, string $secret = JWT_SECRET): string
{
    $header = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body   = b64url(json_encode($payload));
    $sign   = b64url(hash_hmac('sha256', "$header.$body", $secret, true));
    return "$header.$body.$sign";
}

function jwtDecode(string $token, string $secret = JWT_SECRET): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$header, $body, $sign] = $parts;

    $expected = b64url(hash_hmac('sha256', "$header.$body", $secret, true));
    if (!hash_equals($expected, $sign)) {
        return null;
    }

    $payload = json_decode(base64_decode(strtr($body, '-_', '+/')), true);
    if (!is_array($payload) || !isset($payload['exp']) || (int)$payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

/* ---------- Respuestas ---------- */

function cuerpo(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function responder(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function responderError(string $message, int $status = 400): void
{
    responder(['error' => $message], $status);
}

function query(string $name, $default = null)
{
    return $_GET[$name] ?? $default;
}

/* ---------- Autenticación ---------- */

/**
 * Valida el token Bearer y devuelve el usuario activo, o responde 401.
 */
function autenticar(): array
{
    if (!db()) {
        responderError('Error de base de datos', 500);
    }

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        responderError('Token requerido', 401);
    }

    $payload = jwtDecode(trim($m[1]));
    if ($payload === null || !isset($payload['id'])) {
        responderError('Token inválido o expirado', 401);
    }

    $user = dbFetch(
        'SELECT id, username, full_name, role, must_change_password FROM ' . T_USERS . ' WHERE id = ? AND active = 1',
        [(int)$payload['id']]
    );
    if (!$user) {
        responderError('Usuario no encontrado o inactivo', 401);
    }
    return $user;
}

function exigirAdmin(array $user): void
{
    if ($user['role'] !== 'admin') {
        responderError('Acceso denegado: se requiere rol de administrador', 403);
    }
}
