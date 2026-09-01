import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Introduce usuario y contraseña');
      return;
    }
    setEnviando(true);
    try {
      await login(username.trim(), password);
      nav('/fichar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-slate-900 via-blue-950 to-indigo-950">
      <div className="w-full max-w-sm bg-white rounded-2xl p-10 shadow-2xl">
        <h2 className="text-2xl font-bold text-slate-900">Control Horario</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Registro de jornada laboral</p>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-user" className="block text-sm font-medium text-slate-600 mb-1">
              Usuario
            </label>
            <input
              id="login-user"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
            />
          </div>
          <div>
            <label htmlFor="login-pass" className="block text-sm font-medium text-slate-600 mb-1">
              Contraseña
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {enviando ? 'Entrando…' : 'Acceder'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Cumple con el RD 8/2019 de registro de jornada
        </p>
      </div>
    </div>
  );
}