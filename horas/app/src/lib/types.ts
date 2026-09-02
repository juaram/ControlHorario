export type Rol = 'admin' | 'employee';

export interface UsuarioSesion {
  id: number;
  username: string;
  full_name: string;
  role: Rol;
  must_change_password: boolean;
}

export interface Usuario extends UsuarioSesion {
  email: string | null;
  active: number;
  created_at: string;
}

export type EstadoFichaje = 'pending' | 'working' | 'on_break' | 'completed';

export interface Registro {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_work_minutes: number | null;
  notes: string | null;
  created_at: string;
  full_name?: string;
  username?: string;
}

export interface RespuestaEstado {
  status: EstadoFichaje;
  record: Registro | null;
}

export interface RespuestaFichaje {
  message: string;
  status: EstadoFichaje;
  record: Registro;
}

export interface RespuestaHistorial {
  records: Registro[];
  total: number;
  page: number;
  limit: number;
}

export interface ConfigTrabajo {
  trabajo_lat: number | null;
  trabajo_lon: number | null;
  trabajo_lugar: string | null;
  trabajo_radio: number;
  ubicacion_obligatoria: boolean;
}

export interface Estadisticas {
  total_employees: number;
  today_active: number;
  week_hours: number;
}

export interface Filtros {
  from?: string;
  to?: string;
  user_id?: number;
  page: number;
  limit: number;
}