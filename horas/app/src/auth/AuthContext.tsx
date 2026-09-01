import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { UsuarioSesion } from '../lib/types';

interface AuthContexto {
  user: UsuarioSesion | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  cambiarPassword: (nueva: string, anterior?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioSesion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!api.getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.auth.me();
        setUser(data.user);
      } catch {
        api.clearToken();
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.auth.login(username, password);
    api.setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
  }, []);

  const cambiarPassword = useCallback(async (nueva: string, anterior?: string) => {
    const data = await api.auth.changePassword({ new_password: nueva, old_password: anterior });
    setUser(data.user); // must_change_password vuelve a false → la app desbloquea las rutas
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, cambiarPassword }),
    [user, loading, login, logout, cambiarPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContexto {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}