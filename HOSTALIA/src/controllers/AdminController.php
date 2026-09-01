<?php
/**
 * GET  /api/admin/users
 * PUT  /api/admin/users/{id}
 * GET  /api/admin/records
 * GET  /api/admin/stats
 * GET  /api/admin/export        (CSV con BOM, separador ';')
 */

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

class AdminController
{
    private const COLUMNAS_USUARIO = 'id, username, full_name, email, role, active, must_change_password, created_at';

    public function getConfig(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $lat = setting('trabajo_lat');
        $lon = setting('trabajo_lon');
        responder([
            'trabajo_lat'           => ($lat === null || $lat === '') ? null : (float)$lat,
            'trabajo_lon'           => ($lon === null || $lon === '') ? null : (float)$lon,
            'trabajo_radio'         => (int)(setting('trabajo_radio') ?? TRABAJO_RADIO),
            'ubicacion_obligatoria' => (setting('ubicacion_obligatoria') ?? UBICACION_OBLIGATORIA) === '1',
        ]);
    }

    public function updateConfig(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $b = cuerpo();

        $lat = $b['trabajo_lat'] ?? null;
        $lon = $b['trabajo_lon'] ?? null;
        if (($lat !== null && $lat !== '' && !is_numeric($lat))
            || ($lon !== null && $lon !== '' && !is_numeric($lon))) {
            responderError('Coordenadas no válidas', 400);
        }
        $radio = $b['trabajo_radio'] ?? null;
        if ($radio !== null && (!is_numeric($radio) || (int)$radio < 10)) {
            responderError('El radio debe ser un número de al menos 10 metros', 400);
        }

        if ($lat !== null && $lat !== '') {
            guardarSetting('trabajo_lat', (string)(float)$lat);
        } elseif ($lat === '') {
            guardarSetting('trabajo_lat', null);
        }
        if ($lon !== null && $lon !== '') {
            guardarSetting('trabajo_lon', (string)(float)$lon);
        } elseif ($lon === '') {
            guardarSetting('trabajo_lon', null);
        }
        if ($radio !== null) {
            guardarSetting('trabajo_radio', (string)(int)$radio);
        }
        if (isset($b['ubicacion_obligatoria'])) {
            guardarSetting('ubicacion_obligatoria', $b['ubicacion_obligatoria'] ? '1' : '0');
        }

        responder(['message' => 'Configuración guardada']);
    }

    public function users(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $users = dbAll(
            'SELECT ' . self::COLUMNAS_USUARIO . ' FROM ' . T_USERS . ' ORDER BY full_name'
        );
        responder(['users' => $users]);
    }

    public function updateUser(int $id): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $user = dbFetch('SELECT id FROM ' . T_USERS . ' WHERE id = ?', [$id]);
        if (!$user) {
            responderError('Usuario no encontrado', 404);
        }

        $b = cuerpo();
        $updates = [];
        $params = [];

        if (array_key_exists('full_name', $b)) {
            $updates[] = 'full_name = ?';
            $params[] = trim((string)$b['full_name']);
        }
        if (array_key_exists('email', $b)) {
            $updates[] = 'email = ?';
            $params[] = $b['email'] !== null && $b['email'] !== '' ? $b['email'] : null;
        }
        if (array_key_exists('role', $b)) {
            $updates[] = 'role = ?';
            $params[] = (string)$b['role'];
        }
        if (array_key_exists('active', $b)) {
            $updates[] = 'active = ?';
            $params[] = $b['active'] ? 1 : 0;
        }
        if (array_key_exists('must_change_password', $b)) {
            $updates[] = 'must_change_password = ?';
            $params[] = $b['must_change_password'] ? 1 : 0;
        }
        if (!empty($b['password'])) {
            $updates[] = 'password = ?';
            $params[] = password_hash((string)$b['password'], PASSWORD_BCRYPT);
        }

        if (count($updates) === 0) {
            responderError('Sin cambios', 400);
        }

        $params[] = $id;
        dbRun(
            'UPDATE ' . T_USERS . ' SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );

        $updated = dbFetch(
            'SELECT ' . self::COLUMNAS_USUARIO . ' FROM ' . T_USERS . ' WHERE id = ?',
            [$id]
        );
        responder(['message' => 'Usuario actualizado', 'user' => $updated]);
    }

    public function records(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $page  = max(1, (int)query('page', 1));
        $limit = (int)query('limit', 50);
        if ($limit < 1) {
            $limit = 50;
        }
        $offset = ($page - 1) * $limit;

        $where = 'WHERE 1=1';
        $params = [];

        $from = query('from');
        if ($from !== null && $from !== '') {
            $where .= ' AND cr.date >= ?';
            $params[] = $from;
        }
        $to = query('to');
        if ($to !== null && $to !== '') {
            $where .= ' AND cr.date <= ?';
            $params[] = $to;
        }
        $userId = query('user_id');
        if ($userId !== null && $userId !== '') {
            $where .= ' AND cr.user_id = ?';
            $params[] = (int)$userId;
        }

        $count = dbFetch(
            'SELECT COUNT(*) AS total FROM ' . T_CLOCK . ' cr ' . $where,
            $params
        );
        $records = dbAll(
            'SELECT cr.*, u.full_name, u.username FROM ' . T_CLOCK . ' cr '
            . 'JOIN ' . T_USERS . ' u ON cr.user_id = u.id '
            . $where . ' ORDER BY cr.date DESC, cr.id DESC LIMIT ? OFFSET ?',
            [...$params, $limit, $offset]
        );

        responder([
            'records' => $records,
            'total'   => (int)$count['total'],
            'page'    => $page,
            'limit'   => $limit,
        ]);
    }

    public function updateRecord(int $id): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $record = dbFetch('SELECT * FROM ' . T_CLOCK . ' WHERE id = ?', [$id]);
        if (!$record) {
            responderError('Registro no encontrado', 404);
        }

        $b = cuerpo();
        $updates = [];
        $params = [];
        $toSet = $record; // estado resultante (parte del actual) para recalcular

        // Campos editables: para corregir olvidos de fichaje del empleado
        foreach (['date', 'clock_in', 'clock_out', 'break_start', 'break_end', 'notes'] as $campo) {
            if (array_key_exists($campo, $b)) {
                $v = $b[$campo];
                $v = ($v === null || $v === '') ? null : (string)$v;
                $updates[] = $campo . ' = ?';
                $params[] = $v;
                $toSet[$campo] = $v;
            }
        }

        // Recalcular el total a partir de la entrada/salida y pausas editadas
        if ($toSet['clock_in'] && $toSet['clock_out']) {
            $total = $this->minutos($toSet['clock_in'], $toSet['clock_out']);
            if ($toSet['break_start'] && $toSet['break_end']) {
                $total -= $this->minutos($toSet['break_start'], $toSet['break_end']);
            }
            $updates[] = 'total_work_minutes = ?';
            $params[] = max(0, $total);
        } else {
            // Sin entrada o sin salida: "en curso" (null)
            $updates[] = 'total_work_minutes = ?';
            $params[] = null;
        }

        if (count($updates) === 0) {
            responderError('Sin cambios', 400);
        }

        $params[] = $id;
        dbRun(
            'UPDATE ' . T_CLOCK . ' SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );

        $updated = dbFetch('SELECT * FROM ' . T_CLOCK . ' WHERE id = ?', [$id]);
        responder(['message' => 'Registro actualizado', 'record' => $updated]);
    }

    private function minutos(string $inicio, string $fin): int
    {
        [$h1, $m1] = array_map('intval', explode(':', $inicio));
        [$h2, $m2] = array_map('intval', explode(':', $fin));
        return ($h2 * 60 + $m2) - ($h1 * 60 + $m1);
    }

    public function stats(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $today = date('Y-m-d');
        $weekAgo = date('Y-m-d', time() - 7 * 86400);

        $totalEmployees = dbFetch(
            "SELECT COUNT(*) AS count FROM " . T_USERS . " WHERE role = 'employee' AND active = 1"
        );
        $todayActive = dbFetch(
            'SELECT COUNT(DISTINCT user_id) AS count FROM ' . T_CLOCK
            . ' WHERE date = ? AND clock_in IS NOT NULL AND clock_out IS NULL',
            [$today]
        );
        $weekHours = dbFetch(
            'SELECT SUM(total_work_minutes) AS total FROM ' . T_CLOCK
            . ' WHERE date >= ? AND date <= ? AND clock_out IS NOT NULL',
            [$weekAgo, $today]
        );

        $total = (int)($weekHours['total'] ?? 0);
        responder([
            'total_employees' => (int)$totalEmployees['count'],
            'today_active'    => (int)$todayActive['count'],
            'week_hours'      => round($total / 60 * 10) / 10,
        ]);
    }

    public function exportCsv(): void
    {
        $admin = autenticar();
        exigirAdmin($admin);

        $where = 'WHERE 1=1';
        $params = [];

        $from = query('from');
        if ($from !== null && $from !== '') {
            $where .= ' AND cr.date >= ?';
            $params[] = $from;
        }
        $to = query('to');
        if ($to !== null && $to !== '') {
            $where .= ' AND cr.date <= ?';
            $params[] = $to;
        }
        $userId = query('user_id');
        if ($userId !== null && $userId !== '') {
            $where .= ' AND cr.user_id = ?';
            $params[] = (int)$userId;
        }

        $records = dbAll(
            'SELECT cr.*, u.full_name, u.username FROM ' . T_CLOCK . ' cr '
            . 'JOIN ' . T_USERS . ' u ON cr.user_id = u.id '
            . $where . ' ORDER BY cr.date DESC, cr.id DESC',
            $params
        );

        $BOM = "\xEF\xBB\xBF"; // UTF-8 BOM para Excel
        $header = 'Empleado;Usuario;Fecha;Entrada;Salida;Pausa ini;Pausa fin;Total minutos;Notas';
        $lines = [$header];
        foreach ($records as $r) {
            $total = $r['total_work_minutes'] !== null ? (string)$r['total_work_minutes'] : '';
            $lines[] = implode(';', [
                $r['full_name'],
                $r['username'],
                $r['date'],
                $r['clock_in'] ?? '',
                $r['clock_out'] ?? '',
                $r['break_start'] ?? '',
                $r['break_end'] ?? '',
                $total,
                str_replace(';', ',', $r['notes'] ?? ''),
            ]);
        }

        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=registros-horario.csv');
        echo $BOM . implode("\n", $lines) . "\n";
        exit;
    }
}