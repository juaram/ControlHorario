import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout({
  titulo,
  enlaceAdmin,
  children,
}: {
  titulo: string;
  enlaceAdmin: boolean;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const salir = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-50 h-14 px-6 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-slate-600">{user.full_name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {user.role === 'admin' ? 'Administrador' : 'Empleado'}
              </span>
              {user.role === 'admin' && (
                <Link
                  to={enlaceAdmin ? '/admin' : '/fichar'}
                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  {enlaceAdmin ? 'Panel admin' : 'Mi panel'}
                </Link>
              )}
            </>
          )}
          <button
            onClick={salir}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-800"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  );
}