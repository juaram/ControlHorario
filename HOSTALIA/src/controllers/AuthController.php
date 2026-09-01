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
            'user'  => $this->usuarioPublico($user),
        ]);
    }

    /**
     * POST /api/auth/change-password
     *
     * Si el usuario tiene must_change_password = 1 (lo marcó el admin) NO se
     * pide la contraseña anterior. En caso contrario se exige y verifica.
     */
    public function changePassword(): void
    {
        $user = autenticar();

        $b = cuerpo();
        $nueva = (string)($b['new_password'] ?? '');
        if ($nueva === '') {
            responderError('La nueva contraseña es obligatoria', 400);
        }

        $forzado = (int)($user['must_change_password'] ?? 0) === 1;
        if (!$forzado) {
            $anterior = (string)($b['old_password'] ?? '');
            $actual = dbFetch('SELECT password FROM ' . T_USERS . ' WHERE id = ?', [(int)$user['id']]);
            if (!$actual || !password_verify($anterior, $actual['password'])) {
                responderError('La contraseña actual no es correcta', 401);
            }
        }

        dbRun(
            'UPDATE ' . T_USERS . ' SET password = ?, must_change_password = 0 WHERE id = ?',
            [password_hash($nueva, PASSWORD_BCRYPT), (int)$user['id']]
        );

        $actualizado = dbFetch(
            'SELECT * FROM ' . T_USERS . ' WHERE id = ?',
            [(int)$user['id']]
        );
        responder(['message' => 'Contraseña actualizada', 'user' => $this->usuarioPublico($actualizado)]);
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

        $mustChange = !empty($b['must_change_password']) ? 1 : 0;
        dbRun(
            'INSERT INTO ' . T_USERS . ' (username, password, full_name, email, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?)',
            [$username, password_hash($password, PASSWORD_BCRYPT), $full_name, $email, $role, $mustChange]
        );

        responder(['message' => 'Usuario creado correctamente']);
    }

    /** Forma pública de un usuario (sin password) */
    private function usuarioPublico(array $u): array
    {
        return [
            'id'                  => (int)$u['id'],
            'username'            => $u['username'],
            'full_name'           => $u['full_name'],
            'role'                => $u['role'],
            'must_change_password' => (int)($u['must_change_password'] ?? 0) === 1,
        ];
    }
}