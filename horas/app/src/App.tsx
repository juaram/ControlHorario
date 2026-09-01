import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Admin from './pages/Admin';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function PantallaCarga() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Cargando…
    </div>
  );
}

function RutaProtegida({ children, soloAdmin = false }: { children: ReactNode; soloAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <PantallaCarga />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/cambiar-contrasena" replace />;
  if (soloAdmin && user.role !== 'admin') return <Navigate to="/fichar" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <PantallaCarga />;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.must_change_password ? '/cambiar-contrasena' : '/fichar'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/cambiar-contrasena" element={<ChangePassword />} />
      <Route
        path="/fichar"
        element={
          <RutaProtegida>
            <Dashboard />
          </RutaProtegida>
        }
      />
      <Route
        path="/admin"
        element={
          <RutaProtegida soloAdmin>
            <Admin />
          </RutaProtegida>
        }
      />
      <Route path="/" element={<Navigate to="/fichar" replace />} />
      <Route path="*" element={<Navigate to="/fichar" replace />} />
    </Routes>
  );
}