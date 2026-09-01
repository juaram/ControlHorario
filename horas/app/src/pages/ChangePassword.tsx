import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ChangePassword() {
  const { user, cambiarPassword } = useAuth();
  const [pass, setPass] = useState('');
  const [conf, setConf] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Sin sesión → login; si ya cambió la contraseña, el flag se desactiva y se sale solo
  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/fichar" replace />;

  async function guardar() {
    setError('');
    if (!pass) {
      setError('Escribe la nueva contraseña');
      return;
    }
    if (pass !== conf) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setEnviando(true);
    try {
      await cambiarPassword(pass); // sin contraseña anterior: es un cambio forzado por el admin
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-800">Cambia tu contraseña</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          El administrador te ha pedido que cambies tu contraseña antes de continuar.
          No necesitas introducir la anterior.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Repite la contraseña
            </label>
            <input
              type="password"
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
        </div>

        <button
          onClick={() => void guardar()}
          disabled={enviando}
          className="mt-6 w-full text-sm px-4 py-2.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  );
}
