<?php
/**
 * Conexión PDO a SQLite + creación automática del esquema y usuario admin
 * en el primer arranque (mismo comportamiento que la app Node original).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        if (!is_dir(DATA_DIR)) {
            @mkdir(DATA_DIR, 0775, true);
        }
        $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        initSchema($pdo);
    }
    return $pdo;
}

function initSchema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ' . T_USERS . " (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','employee')),
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )"
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ' . T_CLOCK . " (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES " . T_USERS . "(id),
            date TEXT NOT NULL,
            clock_in TEXT,
            clock_out TEXT,
            break_start TEXT,
            break_end TEXT,
            total_work_minutes INTEGER DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )"
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clock_user_date ON ' . T_CLOCK . '(user_id, date)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clock_date ON ' . T_CLOCK . '(date)');

    // Configuración de la app (coordenadas del puesto, etc.)
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ' . T_SETTINGS . " (
            clave TEXT PRIMARY KEY,
            valor TEXT
        )"
    );
    // Valores iniciales (solo la primera vez; después se gestionan desde el panel)
    $valoresIniciales = [
        'trabajo_radio'           => (string)TRABAJO_RADIO,
        'ubicacion_obligatoria'   => UBICACION_OBLIGATORIA,
    ];
    if (TRABAJO_LAT !== null) {
        $valoresIniciales['trabajo_lat'] = (string)TRABAJO_LAT;
    }
    if (TRABAJO_LON !== null) {
        $valoresIniciales['trabajo_lon'] = (string)TRABAJO_LON;
    }
    foreach ($valoresIniciales as $clave => $valor) {
        $pdo->exec(
            "INSERT OR IGNORE INTO " . T_SETTINGS . " (clave, valor) VALUES ("
            . $pdo->quote($clave) . ', ' . $pdo->quote($valor) . ')'
        );
    }

    // Migración: columnas de auditoría y ubicación en registros de fichaje (BD ya existentes)
    foreach (['ip', 'user_agent', 'lat', 'lon', 'accuracy_m', 'distance_m'] as $columna) {
        $cols = $pdo->query('PRAGMA table_info(' . T_CLOCK . ')')->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!in_array($columna, $cols, true)) {
            $tipo = in_array($columna, ['lat', 'lon', 'accuracy_m', 'distance_m'], true) ? ' TEXT' : ' TEXT';
            $pdo->exec('ALTER TABLE ' . T_CLOCK . ' ADD COLUMN ' . $columna . $tipo);
        }
    }

    // Usuario admin inicial (solo si no existe ya)
    $stmt = $pdo->prepare('SELECT id FROM ' . T_USERS . ' WHERE username = ?');
    $stmt->execute(['admin']);
    if (!$stmt->fetch()) {
        $hash = password_hash(ADMIN_PASSWORD, PASSWORD_BCRYPT);
        $ins = $pdo->prepare(
            'INSERT INTO ' . T_USERS . ' (username, password, full_name, role) VALUES (?, ?, ?, ?)'
        );
        $ins->execute(['admin', $hash, 'Administrador', 'admin']);
    }
}

function dbRun(string $sql, array $params = []): void
{
    db()->prepare($sql)->execute($params);
}

function dbFetch(string $sql, array $params = []): ?array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function dbAll(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/* ---------- Configuración (horas_settings) ---------- */

function setting(string $clave, ?string $defecto = null): ?string
{
    $fila = dbFetch('SELECT valor FROM ' . T_SETTINGS . ' WHERE clave = ?', [$clave]);
    if ($fila !== null && $fila['valor'] !== null) {
        return (string)$fila['valor'];
    }
    return $defecto;
}

function guardarSetting(string $clave, ?string $valor): void
{
    dbRun(
        'INSERT OR REPLACE INTO ' . T_SETTINGS . ' (clave, valor) VALUES (?, ?)',
        [$clave, $valor]
    );
}