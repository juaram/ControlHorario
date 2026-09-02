import type { GeoPosicion } from './geo';
import type {
  ConfigTrabajo,
  Estadisticas,
  Filtros,
  Registro,
  RespuestaEstado,
  RespuestaFichaje,
  RespuestaHistorial,
  Usuario,
  UsuarioSesion,
} from './types';

// En producción la API vive en /horas/api (mismo origen que la SPA)
export const API_BASE = import.meta.env.VITE_API_BASE || '/horas/api';
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/horas';

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? '?' + s : '';
}

class ApiClient {
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  clearToken(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor');
    }

    const text = await res.text();
    let data: { error?: string } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      /* respuesta no JSON (HTML, red...) */
    }

    if (!res.ok) {
      throw new Error(data.error || `Error de conexión (HTTP ${res.status})`);
    }
    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  auth = {
    login: (username: string, password: string) =>
      this.post<{ token: string; user: UsuarioSesion }>('/auth/login', { username, password }),
    me: () => this.get<{ user: UsuarioSesion }>('/auth/me'),
    register: (d: {
      username: string;
      password: string;
      full_name: string;
      email?: string;
      role: string;
      must_change_password?: boolean;
    }) => this.post<{ message: string }>('/auth/register', d),
    changePassword: (d: { new_password: string; old_password?: string }) =>
      this.post<{ message: string; user: UsuarioSesion }>('/auth/change-password', d),
  };

  clock = {
    status: () => this.get<RespuestaEstado>('/clock/status'),
    clockIn: (geo?: GeoPosicion) =>
      this.post<RespuestaFichaje>(
        '/clock/clock-in',
        geo ? { lat: geo.lat, lon: geo.lon, accuracy: geo.accuracy } : undefined,
      ),
    clockOut: (geo?: GeoPosicion) =>
      this.post<RespuestaFichaje>(
        '/clock/clock-out',
        geo ? { lat: geo.lat, lon: geo.lon, accuracy: geo.accuracy } : undefined,
      ),
    breakStart: () => this.post<RespuestaFichaje>('/clock/break-start'),
    breakEnd: () => this.post<RespuestaFichaje>('/clock/break-end'),
    notes: (notes: string) => this.post<{ message: string }>('/clock/notes', { notes }),
    history: (f: Filtros) =>
      this.get<RespuestaHistorial>(`/clock/history${qs(f)}`),
    today: () => this.get<{ records: UsuarioSesion[] }>('/clock/today'),
  };

  admin = {
    users: () => this.get<{ users: Usuario[] }>('/admin/users'),
    // POST (no PUT): los hostings compartidos rechazan PUT en scripts PHP (405)
    updateUser: (id: number, d: Record<string, unknown>) =>
      this.post<{ message: string; user: Usuario }>(`/admin/users/${id}`, d),
    // POST (no DELETE): los hostings compartidos rechazan DELETE en scripts PHP (405)
    deleteUser: (id: number) => this.post<{ message: string }>(`/admin/users/${id}/delete`),
    records: (f: Filtros) => this.get<RespuestaHistorial>(`/admin/records${qs(f)}`),
    updateRecord: (id: number, d: Record<string, unknown>) =>
      this.post<{ message: string; record: Registro }>(`/admin/records/${id}`, d),
    // POST (no DELETE): los hostings compartidos rechazan DELETE en scripts PHP (405)
    deleteRecord: (id: number) =>
      this.post<{ message: string }>(`/admin/records/${id}/delete`),
    config: () => this.get<ConfigTrabajo>('/admin/config'),
    saveConfig: (d: ConfigTrabajo) => this.post<{ message: string }>('/admin/config', d),
    stats: () => this.get<Estadisticas>('/admin/stats'),
  };

  async exportCsv(f: { from?: string; to?: string; user_id?: number }): Promise<void> {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/admin/export${qs(f)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = 'Error al exportar';
      try {
        const d = await res.json();
        if (d.error) msg = d.error;
      } catch {
        /* no JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registros-horario.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();