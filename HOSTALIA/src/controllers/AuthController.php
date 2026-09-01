<?php
/**
 * POST /api/auth/login
 * GET  /api/auth/me
 * POST /api/auth/register   (solo admin)
 */

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

class AuthController
{
    public function login(): void
    {
        $b = cuerpo();
        $username = trim((string)($b['username'] ?? ''));
        $password = (string)($b['password'] ?? '');

        if ($username === '' || $password === '') {
            responderError('Usuario y contraseña requeridos', 400);
        }

        $user = dbFetch(
            'SELECT * FROM ' . T_USERS . ' WHERE username = ? AND active = 1',
            [$username]
        );

        // password_verify acepta los hashes bcrypt generados por la app Node (bcryptjs)
        if (!$user || !password_verify($password, $user['password'])) {
            responderError('Credenciales inválidas', 401);
        }

        $now = time();
        $token = jwtEncode([
            'id'   => (int)$user['id'],
            'role' => $user['role'],
            'iat'  => $now,
            'exp'  => $now + JWT_TTL,
        ]);

        responder([
            'token' => $token,
            'user'  => [
                'id'        => (int)$user['id'],
                'username'  => $user['username'],
                'full_name' => $user['full_name'],
                'role'      => $user['role'],
            ],
        ]);
    }

    public function me(): void
    {
        $user = autenticar();
        responder(['user' => $user]);
    }

    public function register(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $b = cuerpo();
        $username  = trim((string)($b['username'] ?? ''));
        $password  = (string)($b['password'] ?? '');
        $full_name = trim((string)($b['full_name'] ?? ''));
        $email     = isset($b['email']) && $b['email'] !== '' ? $b['email'] : null;
        $role      = (string)($b['role'] ?? 'employee');

        if ($username === '' || $password === '' || $full_name === '') {
            responderError('Usuario, contraseña y nombre completo requeridos', 400);
        }

        $existe = dbFetch('SELECT id FROM ' . T_USERS . ' WHERE username = ?', [$username]);
        if ($existe) {
            responderError('El nombre de usuario ya existe', 409);
        }

        dbRun(
            'INSERT INTO ' . T_USERS . ' (username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
            [$username, password_hash($password, PASSWORD_BCRYPT), $full_name, $email, $role]
        );

        responder(['message' => 'Usuario creado correctamente']);
    }
}