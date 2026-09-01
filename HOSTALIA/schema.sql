-- Esquema de referencia (la app lo crea automáticamente en el primer arranque).
-- Prefijo horas_ preparado para una futura migración a MariaDB.

CREATE TABLE IF NOT EXISTS horas_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','employee')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS horas_clock_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES horas_users(id),
  date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  break_start TEXT,
  break_end TEXT,
  total_work_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_clock_user_date ON horas_clock_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_clock_date ON horas_clock_records(date);