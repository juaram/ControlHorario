<?php
/**
 * GET  /api/clock/status
 * POST /api/clock/clock-in | clock-out | break-start | break-end | notes
 * GET  /api/clock/history
 * GET  /api/clock/today
 */

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

class ClockController
{
    /* ---------- helpers de tiempo ---------- */

    private function hoy(): string
    {
        return date('Y-m-d');
    }

    private function ahora(): string
    {
        return date('H:i');
    }

    private function registroDeHoy(int $userId): ?array
    {
        return dbFetch(
            'SELECT * FROM ' . T_CLOCK . ' WHERE user_id = ? AND date = ?',
            [$userId, $this->hoy()]
        );
    }

    private function estado(array $r): string
    {
        if (!$r['clock_in']) {
            return 'pending';
        }
        if ($r['clock_out']) {
            return 'completed';
        }
        if ($r['break_start'] && !$r['break_end']) {
            return 'on_break';
        }
        return 'working';
    }

    private function parseTime(string $t): int
    {
        [$h, $m] = array_map('intval', explode(':', $t));
        return $h * 60 + $m;
    }

    private function minutosPausa(array $r): int
    {
        if (!$r['break_start']) {
            return 0;
        }
        $start = $this->parseTime($r['break_start']);
        $end   = $r['break_end'] ? $this->parseTime($r['break_end']) : $this->parseTime($this->ahora());
        return max(0, $end - $start);
    }

    /* ---------- endpoints ---------- */

    /**
     * Comprueba la ubicación del móvil contra las coordenadas del puesto de
     * trabajo guardadas en el panel de administración.
     *
     * Devuelve los valores geográficos para guardar en el registro (auditoría).
     */
    private function validarUbicacion(array $b): array
    {
        $latT = setting('trabajo_lat');
        $lonT = setting('trabajo_lon');
        $radio = (int)(setting('trabajo_radio') ?? TRABAJO_RADIO);
        $obligatoria = (setting('ubicacion_obligatoria') ?? UBICACION_OBLIGATORIA) === '1';

        $geo = ['lat' => null, 'lon' => null, 'accuracy_m' => null, 'distance_m' => null];

        // Sin coordenadas configuradas o verificación desactivada: no se comprueba
        if (!$obligatoria || $latT === null || $lonT === null || $latT === '' || $lonT === '') {
            return $geo;
        }

        $lat = (isset($b['lat']) && $b['lat'] !== '') ? (float)$b['lat'] : null;
        $lon = (isset($b['lon']) && $b['lon'] !== '') ? (float)$b['lon'] : null;
        if ($lat === null || $lon === null) {
            responderError(
                'No se recibió tu ubicación. Permite el acceso a la ubicación en el navegador y vuelve a intentarlo.',
                403
            );
        }

        $accuracy = isset($b['accuracy']) && $b['accuracy'] !== '' ? (float)$b['accuracy'] : 0.0;
        // La precisión del GPS se descuenta: da margen por el error del dispositivo
        $distancia = max(0.0, $this->distanciaMetros((float)$latT, (float)$lonT, $lat, $lon) - $accuracy);

        $geo = [
            'lat'         => $lat,
            'lon'         => $lon,
            'accuracy_m'  => round($accuracy, 1),
            'distance_m'  => round($distancia, 1),
        ];

        if ($distancia > $radio) {
            responderError(
                sprintf(
                    'Estás a %d m del puesto de trabajo (máximo permitido: %d m). Acércate antes de fichar.',
                    (int)round($distancia),
                    $radio
                ),
                403
            );
        }

        return $geo;
    }

    private function distanciaMetros(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371000; // radio de la Tierra en metros
        $dlat = deg2rad($lat2 - $lat1);
        $dlon = deg2rad($lon2 - $lon1);
        $a = sin($dlat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dlon / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function ip(): ?string
    {
        return $_SERVER['REMOTE_ADDR'] ?? null;
    }

    private function userAgent(): ?string
    {
        return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255) ?: null;
    }

    public function status(): void
    {
        $user = autenticar();
        $record = $this->registroDeHoy((int)$user['id']);

        if (!$record) {
            responder(['status' => 'pending', 'record' => null]);
        }
        responder(['status' => $this->estado($record), 'record' => $record]);
    }

    public function clockIn(): void
    {
        $user = autenticar();
        $b = cuerpo();
        $geo = $this->validarUbicacion($b);

        $record = $this->registroDeHoy((int)$user['id']);

        if ($record) {
            responderError('Ya has fichado hoy. Si no has salido, usa finalizar jornada.', 400);
        }

        dbRun(
            'INSERT INTO ' . T_CLOCK
            . ' (user_id, date, clock_in, lat, lon, accuracy_m, distance_m, ip, user_agent)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$user['id'], $this->hoy(), $this->ahora(),
                $geo['lat'], $geo['lon'], $geo['accuracy_m'], $geo['distance_m'],
                $this->ip(), $this->userAgent(),
            ]
        );
        $record = $this->registroDeHoy((int)$user['id']);

        responder(['message' => 'Jornada iniciada', 'status' => 'working', 'record' => $record]);
    }

    public function clockOut(): void
    {
        $user = autenticar();
        $b = cuerpo();
        $geo = $this->validarUbicacion($b);

        $record = $this->registroDeHoy((int)$user['id']);

        if (!$record || !$record['clock_in']) {
            responderError('No has iniciado la jornada hoy', 400);
        }
        if ($record['clock_out']) {
            responderError('La jornada de hoy ya está finalizada', 400);
        }

        $total = $this->parseTime($this->ahora()) - $this->parseTime($record['clock_in']) - $this->minutosPausa($record);

        dbRun(
            'UPDATE ' . T_CLOCK
            . ' SET clock_out = ?, total_work_minutes = ?, lat = ?, lon = ?, accuracy_m = ?, distance_m = ?, ip = ?, user_agent = ?'
            . ' WHERE id = ?',
            [
                $this->ahora(), max(0, $total),
                $geo['lat'], $geo['lon'], $geo['accuracy_m'], $geo['distance_m'],
                $this->ip(), $this->userAgent(),
                (int)$record['id'],
            ]
        );
        $record = dbFetch('SELECT * FROM ' . T_CLOCK . ' WHERE id = ?', [(int)$record['id']]);

        responder(['message' => 'Jornada finalizada', 'status' => 'completed', 'record' => $record]);
    }

    public function breakStart(): void
    {
        $user = autenticar();
        $record = $this->registroDeHoy((int)$user['id']);

        if (!$record || !$record['clock_in']) {
            responderError('No has iniciado la jornada', 400);
        }
        if ($record['break_start'] && !$record['break_end']) {
            responderError('Ya tienes una pausa activa. Fínala antes de iniciar otra.', 400);
        }

        dbRun('UPDATE ' . T_CLOCK . ' SET break_start = ? WHERE id = ?', [$this->ahora(), (int)$record['id']]);
        $record = dbFetch('SELECT * FROM ' . T_CLOCK . ' WHERE id = ?', [(int)$record['id']]);

        responder(['message' => 'Pausa iniciada', 'status' => 'on_break', 'record' => $record]);
    }

    public function breakEnd(): void
    {
        $user = autenticar();
        $record = $this->registroDeHoy((int)$user['id']);

        if (!$record || !$record['break_start']) {
            responderError('No hay una pausa activa', 400);
        }
        if ($record['break_end']) {
            responderError('La pausa ya fue finalizada', 400);
        }

        dbRun('UPDATE ' . T_CLOCK . ' SET break_end = ? WHERE id = ?', [$this->ahora(), (int)$record['id']]);
        $record = dbFetch('SELECT * FROM ' . T_CLOCK . ' WHERE id = ?', [(int)$record['id']]);

        responder(['message' => 'Pausa finalizada', 'status' => 'working', 'record' => $record]);
    }

    public function notes(): void
    {
        $user = autenticar();
        $b = cuerpo();
        $notes = isset($b['notes']) && $b['notes'] !== '' ? trim((string)$b['notes']) : null;

        $record = $this->registroDeHoy((int)$user['id']);
        if (!$record) {
            responderError('No hay registro de hoy', 400);
        }

        dbRun('UPDATE ' . T_CLOCK . ' SET notes = ? WHERE id = ?', [$notes, (int)$record['id']]);
        responder(['message' => 'Notas guardadas']);
    }

    public function history(): void
    {
        $user = autenticar();

        $page  = max(1, (int)query('page', 1));
        $limit = (int)query('limit', 30);
        if ($limit < 1) {
            $limit = 30;
        }
        $offset = ($page - 1) * $limit;

        $where = 'WHERE user_id = ?';
        $params = [(int)$user['id']];

        $from = query('from');
        if ($from !== null && $from !== '') {
            $where .= ' AND date >= ?';
            $params[] = $from;
        }
        $to = query('to');
        if ($to !== null && $to !== '') {
            $where .= ' AND date <= ?';
            $params[] = $to;
        }

        $count = dbFetch('SELECT COUNT(*) AS total FROM ' . T_CLOCK . ' ' . $where, $params);
        $records = dbAll(
            'SELECT * FROM ' . T_CLOCK . ' ' . $where . ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
            [...$params, $limit, $offset]
        );

        responder([
            'records' => $records,
            'total'   => (int)$count['total'],
            'page'    => $page,
            'limit'   => $limit,
        ]);
    }

    public function today(): void
    {
        $user = autenticar();
        $records = dbAll(
            'SELECT * FROM ' . T_CLOCK . ' WHERE user_id = ? AND date = ? ORDER BY id DESC',
            [(int)$user['id'], $this->hoy()]
        );
        responder(['records' => $records]);
    }
}